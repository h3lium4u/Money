import type { IntentAnalysisResult, QueryIntentType, ExtractedEntities } from "./types.ts";
import { parseDateRange } from "./date-parser.ts";

// ─── Distributor Groups ────────────────────────────────────────────────────────
// IND = India-side parties (used in India Distribution / distribution splits)
export const KNOWN_IND_DISTRIBUTORS = [
  "AWAFI", "NF2", "HAJA", "SARABU", "BASID",
];

// AED = AED-side parties (used in AED Distribution)
export const KNOWN_AED_DISTRIBUTORS = [
  "SALA", "SARABU", "MK", "ISMAIL", "NNG",
];

// Combined list for backward compatibility
export const KNOWN_INDIA_DISTRIBUTORS = [
  ...KNOWN_IND_DISTRIBUTORS,
  "MK", "ISMAIL", "SALA", "NNG", "USAIN", "BLACK GRP",
];

// Names that exist in BOTH groups — require clarification from user
const AMBIGUOUS_DISTRIBUTOR_NAMES = new Set(["SARABU"]);

// List of common Dubai Customers
export const KNOWN_DUBAI_CUSTOMERS = [
  "SAMI", "DIVAN", "FAIZ BU", "RAKSAN", "SATHIK", "AJIFER", "ABBAS", "ARAFATH",
  "AKBAR DRY", "SMS", "BUHARI", "MALIK", "KADHAR", "JAHIR", "FAYAS", "AJMAL",
  "SALEEM", "IBRM APS", "RIYAS", "YUVRAJ", "FAIZAL", "SHAHUL", "ASF AKBAR",
  "GANI", "BEER", "ASF SHAJHN", "NAISAR", "ADIL RAS", "THARIK"
];

/** Detect if query explicitly mentions a group: "under IND", "IND distribution", "AED side", etc. */
function detectExplicitGroup(lower: string): "IND" | "AED" | null {
  if (/\b(ind distribution|india distribution|ind side|india side|india group|under ind|ind group)\b/i.test(lower)) return "IND";
  if (/\b(aed distribution|aed side|aed group|under aed)\b/i.test(lower)) return "AED";
  if (/\b(wholesale|split|distribut)\b/i.test(lower) && !/\baed\b/i.test(lower)) return "IND";
  if (/\baed\b/i.test(lower) && /\b(distribut|payout|account)\b/i.test(lower)) return "AED";
  return null;
}

/**
 * Analyzes natural language query for safety, intent, dates, and business entities.
 */
export function analyzeIntent(queryText: string): IntentAnalysisResult {
  const text = queryText.trim();
  const lower = text.toLowerCase();

  // 1. Safety check: AI must be strictly read-only
  const modificationRegex = /\b(delete|remove|drop|truncate|alter|insert|update|create|modify|edit|set\s+rate|change\s+rate|clear\s+balance|pay\s+off|cancel)\b/i;
  // Make sure words like "how much was paid" or "cleared" don't trigger false positives
  const isQuestionAboutPayment = /\b(how much|what was|show|list|total|any|which|did)\b/i.test(text);
  
  if (modificationRegex.test(lower) && !isQuestionAboutPayment) {
    return {
      intent: "MODIFY_ATTEMPT",
      confidence: 1.0,
      entities: {},
      isModificationAttempt: true,
      refusalReason: "I can't modify transactions through the AI assistant. Please use the transaction management interface.",
    };
  }

  // 2. Parse Date expressions
  const dateRange = parseDateRange(lower);

  // 3. Extract Entities
  const entities: ExtractedEntities = {
    dateRange,
  };

  // Transaction number regex (e.g. TXN-2026-0005, TXN-0001, etc.)
  const txnMatch = text.match(/\bTXN[-\w\d]+\b/i);
  if (txnMatch) {
    entities.transactionNumber = txnMatch[0].toUpperCase();
  }

  // Amount extraction (e.g. above ₹500,000 or > 500000 or above 500000)
  const amountMatch = text.match(/(?:above|greater than|more than|>|over)\s*(?:₹|inr|rs\.?|aed)?\s*([0-9,]+)/i);
  if (amountMatch) {
    const num = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (!isNaN(num)) entities.minAmount = num;
  }

  // Detect explicit group context
  const explicitGroup = detectExplicitGroup(lower);
  if (explicitGroup) entities.distributorGroup = explicitGroup;

  // India distributor detection — check all known names across both groups
  const allKnownDistributors = [...new Set([...KNOWN_IND_DISTRIBUTORS, ...KNOWN_AED_DISTRIBUTORS])];
  for (const dist of allKnownDistributors) {
    const distRegex = new RegExp(`\\b${dist}\\b`, "i");
    if (distRegex.test(text)) {
      entities.distributorName = dist.toUpperCase();

      // If name is ambiguous (exists in both groups) and no explicit group detected
      if (AMBIGUOUS_DISTRIBUTOR_NAMES.has(dist.toUpperCase()) && !entities.distributorGroup) {
        entities.requiresGroupClarification = true;
      } else if (!entities.distributorGroup) {
        // Auto-assign group based on which list the name is in
        if (KNOWN_IND_DISTRIBUTORS.includes(dist.toUpperCase()) && !KNOWN_AED_DISTRIBUTORS.includes(dist.toUpperCase())) {
          entities.distributorGroup = "IND";
        } else if (KNOWN_AED_DISTRIBUTORS.includes(dist.toUpperCase()) && !KNOWN_IND_DISTRIBUTORS.includes(dist.toUpperCase())) {
          entities.distributorGroup = "AED";
        }
      }
      break;
    }
  }

  // Dubai customer detection (only if distributor not already detected with distribution keywords)
  const isDistributionContext = /\b(distribut|split|payout|wholesale|distrip)\b/i.test(lower);
  if (!entities.distributorName || !isDistributionContext) {
    for (const cust of KNOWN_DUBAI_CUSTOMERS) {
      const custRegex = new RegExp(`\\b${cust}\\b`, "i");
      if (custRegex.test(text)) {
        entities.customerName = cust;
        break;
      }
    }
  }

  // 4. Intent Classification

  // Database / System Overview (Neon query)
  if (
    /\b(neon|database|db status|system status|database overview|how many records|table counts)\b/i.test(lower) ||
    (/\b(overview|summary)\b/i.test(lower) && /\b(database|neon|system|records)\b/i.test(lower))
  ) {
    return {
      intent: "DATABASE_OVERVIEW",
      confidence: 0.95,
      entities,
      isModificationAttempt: false,
    };
  }

  // Distributor List (IND, AED, or all) — exclude if specifically asking about splits
  const isDistributorListQuery =
    !lower.includes("split") &&
    (/\b(who are|list|show|all|names of|what are|which)\b.*\b(distributor|distributors|parties|party)\b/i.test(lower) ||
    /\b(distributor|distributors|parties)\b.*\b(list|all|who|names|roster)\b/i.test(lower) ||
    /\b(india distributors?|ind distributors?|aed distributors?)\b/i.test(lower) ||
    (lower.includes("distributor") && (lower.includes("who") || lower.includes("list") || lower.includes("all"))));

  if (isDistributorListQuery && !entities.transactionNumber) {
    return {
      intent: "DISTRIBUTORS_LIST",
      confidence: 0.95,
      entities,
      isModificationAttempt: false,
    };
  }

  // Customer List & Balances
  const isCustomerListQuery =
    /\b(who are|list|show|all|how many|names of|what are)\b.*\b(customer|customers|client|clients)\b/i.test(lower) ||
    /\b(customer|customers|clients)\b.*\b(list|all|who|balances|balance|roster)\b/i.test(lower) ||
    (lower.includes("customer") && (lower.includes("how many") || lower.includes("list all") || lower.includes("who are")));

  if (isCustomerListQuery && !entities.customerName) {
    return {
      intent: "CUSTOMERS_LIST",
      confidence: 0.95,
      entities,
      isModificationAttempt: false,
    };
  }

  // Today's summary
  if (
    (/\b(summary of today|today('s)? summary|today's business|summary of today's business)\b/i.test(lower)) ||
    (lower.includes("today") && lower.includes("summary"))
  ) {
    return {
      intent: "TODAY_SUMMARY",
      confidence: 0.95,
      entities,
      isModificationAttempt: false,
    };
  }

  // Compare periods (e.g. "compare this month with last month")
  if (/\b(compare|comparison)\b/i.test(lower) && (lower.includes("month") || lower.includes("week") || lower.includes("year"))) {
    entities.compareWithPrevious = true;
    return {
      intent: "COMPARE_PERIODS",
      confidence: 0.9,
      entities,
      isModificationAttempt: false,
    };
  }

  // Bank distribution / Bank distrip
  if (
    /\b(bank distrip|bank distribution|commission|paid to|pending in bank|bank balance)\b/i.test(lower) ||
    (entities.distributorName && /\b(bank|account|commission)\b/i.test(lower))
  ) {
    return {
      intent: "BANK_DISTRIBUTION",
      confidence: 0.9,
      entities,
      isModificationAttempt: false,
    };
  }

  // India distribution / splits (specific distributor or txn splits)
  if (
    /\b(split|splits|distribution|distributions|distributed|wholesale|allocated?|allocation)\b/i.test(lower) ||
    (entities.distributorName && !entities.customerName)
  ) {
    return {
      intent: "INDIA_DISTRIBUTION",
      confidence: 0.9,
      entities,
      isModificationAttempt: false,
    };
  }

  // Profit analysis
  if (/\b(profit|margin|delivery cut|delivery charge)\b/i.test(lower)) {
    return {
      intent: "PROFIT_ANALYSIS",
      confidence: 0.9,
      entities,
      isModificationAttempt: false,
    };
  }

  // Receivables / Outstanding
  if (
    /\b(receivable|receivables|owe|owes|outstanding|partially paid|pending payment|unpaid)\b/i.test(lower)
  ) {
    if (entities.customerName) {
      return {
        intent: "CUSTOMER_QUERY",
        confidence: 0.9,
        entities,
        isModificationAttempt: false,
      };
    }
    return {
      intent: "RECEIVABLES_QUERY",
      confidence: 0.9,
      entities,
      isModificationAttempt: false,
    };
  }

  // Customer specific query
  if (entities.customerName) {
    return {
      intent: "CUSTOMER_QUERY",
      confidence: 0.85,
      entities,
      isModificationAttempt: false,
    };
  }

  // Transaction list / query
  if (
    /\b(transaction|transactions|transfers|orders|order)\b/i.test(lower) ||
    entities.transactionNumber ||
    entities.minAmount
  ) {
    return {
      intent: "TRANSACTION_QUERY",
      confidence: 0.85,
      entities,
      isModificationAttempt: false,
    };
  }

  // Period / Volume summary (e.g. "How much INR was processed today", "How much AED was collected last week")
  if (
    /\b(how much|total|volume|collected|processed)\b/i.test(lower) &&
    (lower.includes("inr") || lower.includes("aed") || dateRange !== undefined)
  ) {
    return {
      intent: "PERIOD_SUMMARY",
      confidence: 0.8,
      entities,
      isModificationAttempt: false,
    };
  }

  // General business questions
  return {
    intent: "GENERAL_BUSINESS_HELP",
    confidence: 0.6,
    entities,
    isModificationAttempt: false,
  };
}
