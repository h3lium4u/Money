export type AIProviderName = "groq" | "gemini" | "local";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface AIGenerateResult {
  text: string;
  provider: AIProviderName;
  model: string;
  executionTimeMs: number;
  isFallback?: boolean;
}

export interface AIProvider {
  readonly name: AIProviderName;
  isConfigured(): boolean;
  generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<AIGenerateResult>;
}

export type QueryIntentType =
  | "TODAY_SUMMARY"
  | "PERIOD_SUMMARY"
  | "PROFIT_ANALYSIS"
  | "CUSTOMER_QUERY"
  | "CUSTOMERS_LIST"
  | "TRANSACTION_QUERY"
  | "RECEIVABLES_QUERY"
  | "INDIA_DISTRIBUTION"
  | "DISTRIBUTORS_LIST"
  | "BANK_DISTRIBUTION"
  | "DATABASE_OVERVIEW"
  | "COMPARE_PERIODS"
  | "MODIFY_ATTEMPT"
  | "GENERAL_BUSINESS_HELP"
  | "UNKNOWN";

export interface ParsedDateRange {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  label: string;
}

export interface ExtractedEntities {
  customerName?: string;
  distributorName?: string;
  distributorGroup?: "IND" | "AED"; // explicit group if detected
  requiresGroupClarification?: boolean; // true when SARABU mentioned without explicit group
  transactionNumber?: string;
  minAmount?: number;
  maxAmount?: number;
  dateRange?: ParsedDateRange;
  currency?: "INR" | "AED";
  compareWithPrevious?: boolean;
}

export interface IntentAnalysisResult {
  intent: QueryIntentType;
  confidence: number;
  entities: ExtractedEntities;
  isModificationAttempt: boolean;
  refusalReason?: string;
}

export interface VerifiedFinancialContext {
  topic: string;
  asOf: string;
  periodLabel?: string;
  dateRange?: { from?: string; to?: string };
  metrics: Record<string, any>;
  records?: any[];
  summaryNotes?: string[];
  insufficientData?: boolean;
}

export interface AIChatResponse {
  reply: string;
  provider: AIProviderName;
  model: string;
  isFallback: boolean;
  intent: QueryIntentType;
  verifiedDataTimestamp: string;
  executionTimeMs: number;
  sourceIndicator: string;
}
