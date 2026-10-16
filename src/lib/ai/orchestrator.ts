import type {
  AIMessage,
  AIChatResponse,
  AIProvider,
  AIProviderName,
  IntentAnalysisResult,
  VerifiedFinancialContext,
} from "./types.ts";
import { analyzeIntent } from "./intent-router.ts";
import { retrieveVerifiedFinancialData } from "./data-retrieval.ts";
import { GroqProvider } from "./providers/groq-provider.ts";
import { GeminiProvider } from "./providers/gemini-provider.ts";
import { LocalVerifiedProvider } from "./providers/local-provider.ts";

// Instantiate providers
const groq = new GroqProvider();
const gemini = new GeminiProvider();
const localEngine = new LocalVerifiedProvider();

export interface ProcessChatMessageOptions {
  history?: AIMessage[];
}

/**
 * Main AI Orchestrator:
 * 1. Validates safety / read-only intent
 * 2. Parses dates & intent
 * 3. Retrieves verified financial data from Neon PostgreSQL
 * 4. Passes verified data to Groq (Primary) -> Gemini (Fallback) -> Local Engine
 */
export async function processChatMessage(
  userQuery: string,
  options?: ProcessChatMessageOptions
): Promise<AIChatResponse> {
  const startTime = Date.now();
  const trimmed = userQuery.trim();

  // 1. Safety check
  const analysis: IntentAnalysisResult = analyzeIntent(trimmed);

  if (analysis.isModificationAttempt) {
    return {
      reply: analysis.refusalReason || "I can't modify transactions through the AI assistant. Please use the transaction management interface.",
      provider: "local",
      model: "safety-guardrail",
      isFallback: false,
      intent: "MODIFY_ATTEMPT",
      verifiedDataTimestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      sourceIndicator: "Security Guardrail",
    };
  }

  // 2. Retrieve verified financial ground truth from PostgreSQL
  const verifiedData: VerifiedFinancialContext = await retrieveVerifiedFinancialData(analysis);

  const compactFacts = {
    ...verifiedData,
    records: verifiedData.records ? verifiedData.records.slice(0, 10) : undefined,
  };

  const systemPrompt = `You are the AI Business Assistant for a Dubai → India money remittance business.
The application uses Neon PostgreSQL and the active Master Excel Workbook (Accounts_Business_Normalized_Master.xlsx / AYYAN JAN.xlsx) as the authoritative single source of truth for business data.

SYSTEM FINANCIAL & PRESENTATION RULES:
1. The numbers provided below in the VERIFIED FACTS block are calculated directly by Neon PostgreSQL backend logic and authoritative Excel indexes.
2. The AI must NEVER calculate or extrapolate financial values independently. Always rely on the verified data.
3. PRESENTATION AND FORMATTING STANDARDS:
   - NEVER expose raw code or database variable names in titles or prose (e.g. NEVER write "paidInr = 0", "inr_amount", "aed_amount", "split_date", "partner_type").
   - NEVER say "Not Yet Routed (paidInr = 0)". Instead write professional status descriptions like "Pending Settlement", "Allocated (Awaiting Payout)", or "Settled".
   - ALWAYS format currency amounts cleanly:
     - INR values must include ₹ symbol and thousands separators, e.g. "₹1,000.00" or "₹1,000" (never write "1 000" or "1000 INR").
     - AED values must include AED, e.g. "38.17 AED".
     - Exchange rates should be clean decimals, e.g. "26.20" or "36.50".
   - Format lists and data using clean, well-structured Markdown tables with clear column headers:
     For Splits:
     | Split Date | Transaction | Customer | Distributor | Group | Allocated (INR) | Wholesale Rate | AED Equivalent | Status |
     For Customers:
     | Customer | Code | Total Orders (INR) | Total Billed (AED) | Total Paid (AED) | Outstanding (AED) | Status |
     For Distributors:
     | Distributor | Group | Code | Type | Currency | Balance (INR) |
     For Excel Worksheets:
     | Sheet Name | Data Rows | Columns |
   - Include a concise, professional financial summary card/box with clean bold bullet points.
4. Business Structure & Terminology:
   - Registered Dubai Customers & Wholesale Parties (42 total, e.g. SAMI, DIVAN, RAKSAN, SATHIK, SALEEM, GANI, BUHARI, KADHAR, MALIK, JAHIR, FAIZAL, ASLAM / AADHIL): Send money from Dubai, billed in AED.
   - Distributors:
     a) IND Distribution Group (India-side parties): BLACK GRP, ISMAIL, MK, NNG, SALA, SHEIK, USAIN.
        These parties disburse INR in India when Dubai customer orders are split.
     b) AED Distribution Group (AED-side parties): AADHIL (AWAFI), ANWAR, BASID, HAJA, NF2, SARAB.
   - CRITICAL SARAB RULE: SARAB exists in both distribution contexts as two distinct accounts. Do not merge them.
   - MK is an active wholesale partner and settlement account.
5. If the user asks about Excel or the spreadsheet (e.g. row counts, sheet details, or figures from xl), provide exact figures from the VERIFIED FACTS block.
6. If the user asks about all-time profit or totals across all data, always report the all-time figures (e.g. allTimeNetProfitAed) provided in the VERIFIED FACTS.
7. If a queried customer is not found, politely explain and provide the list of registered customers included in the summary notes.
8. If the verified data has insufficientData = true:
   Explicitly reply: "I don't have enough verified data to answer that accurately."
9. You are strictly read-only. Never invent numbers, hallucinate balances, or modify database records.

VERIFIED FACTS (DIRECT FROM NEON POSTGRESQL & AUTHORITATIVE EXCEL):
\`\`\`json
${JSON.stringify(compactFacts, null, 2)}
\`\`\`
`;

  // Build message sequence
  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // Include recent conversation context (last 4 messages if provided)
  if (options?.history && options.history.length > 0) {
    const recentHistory = options.history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-4);
    messages.push(...recentHistory);
  }

  messages.push({ role: "user", content: trimmed });

  // 4. Provider Strategy: Groq (Primary) -> Gemini (Fallback) -> Local Engine
  let finalReply = "";
  let providerUsed: AIProviderName = "groq";
  let modelUsed = "";
  let isFallback = false;

  // Try Primary: Groq
  if (groq.isConfigured()) {
    try {
      const res = await groq.generateText(messages);
      finalReply = res.text;
      providerUsed = "groq";
      modelUsed = res.model;
      isFallback = false;
      console.log(`[AI Orchestrator] Success with primary provider Groq (${res.model}) in ${res.executionTimeMs}ms`);
    } catch (groqErr: any) {
      console.warn(`[AI Orchestrator] Primary provider Groq failed: ${groqErr.message}. Attempting fallback to Gemini...`);
      
      // Fallback: Gemini
      if (gemini.isConfigured()) {
        try {
          const res = await gemini.generateText(messages);
          finalReply = res.text;
          providerUsed = "gemini";
          modelUsed = res.model;
          isFallback = true;
          console.log(`[AI Orchestrator] Success with fallback provider Gemini (${res.model}) in ${res.executionTimeMs}ms`);
        } catch (geminiErr: any) {
          console.warn(`[AI Orchestrator] Fallback provider Gemini failed: ${geminiErr.message}. Falling back to Local Verified Engine.`);
          const res = await localEngine.generateText(messages);
          finalReply = res.text;
          providerUsed = "local";
          modelUsed = "verified-engine-local";
          isFallback = true;
        }
      } else {
        const res = await localEngine.generateText(messages);
        finalReply = res.text;
        providerUsed = "local";
        modelUsed = "verified-engine-local";
        isFallback = true;
      }
    }
  } else if (gemini.isConfigured()) {
    // If only Gemini is configured
    try {
      const res = await gemini.generateText(messages);
      finalReply = res.text;
      providerUsed = "gemini";
      modelUsed = res.model;
      isFallback = false;
    } catch (geminiErr: any) {
      console.warn(`[AI Orchestrator] Gemini failed: ${geminiErr.message}. Falling back to Local Verified Engine.`);
      const res = await localEngine.generateText(messages);
      finalReply = res.text;
      providerUsed = "local";
      modelUsed = "verified-engine-local";
      isFallback = true;
    }
  } else {
    // No API keys configured yet
    const res = await localEngine.generateText(messages);
    finalReply = res.text;
    providerUsed = "local";
    modelUsed = "verified-engine-local";
    isFallback = false;
  }

  // Build clean source indicator label
  let sourceIndicator = "✓ Based on verified database data\n";
  if (providerUsed === "groq") {
    sourceIndicator += `AI: Groq (${modelUsed})`;
  } else if (providerUsed === "gemini") {
    sourceIndicator += isFallback ? `AI: Gemini (fallback: ${modelUsed})` : `AI: Gemini (${modelUsed})`;
  } else {
    sourceIndicator += "Local Verified Engine (PostgreSQL direct calculations)";
  }

  return {
    reply: finalReply,
    provider: providerUsed,
    model: modelUsed,
    isFallback,
    intent: analysis.intent,
    verifiedDataTimestamp: verifiedData.asOf,
    executionTimeMs: Date.now() - startTime,
    sourceIndicator,
  };
}
