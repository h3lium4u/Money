import { query, queryOne, execute } from "@/lib/db";
import { calculateTransaction, calculateDubaiClientTransfer, roundTo } from "@/lib/calculations";
import {
  getTodayDateString,
  getYesterdayDateString,
  getStartOfWeekDateString,
  getStartOfMonthDateString,
  getStartOfYearDateString,
} from "@/lib/date-utils";
import crypto from "node:crypto";

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  default_rate?: number | null;
  status: string;
  entity_type?: string;
  party_type?: "DUBAI" | "INDIA" | string;
  total_inr?: number;
  total_aed?: number;
  total_paid?: number;
  outstanding_balance?: number;
  created_at: string;
}

export interface DistributionSplitRecord {
  id: string;
  transaction_id: string;
  transaction_number?: string;
  customer_id?: string;
  customer_code?: string;
  customer_name?: string;
  distributor_id: string;
  distributor_name?: string;
  distributor_code?: string;
  group_type?: string;
  split_date: string;
  inr_amount: number;
  wholesale_rate?: number | null;
  aed_equivalent?: number | null;
  paid_amount_inr: number;
  balance_inr: number;
  status: string;
  notes?: string | null;
  is_demo?: boolean;
  created_at: string;
}

export interface TransactionRecord {
  id: string;
  transaction_number: string;
  transaction_date: string;
  customer_id: string;
  customer_code?: string | null;
  customer_name?: string;
  entity_type?: string;
  party_type?: string;
  inr_amount: number;
  total?: number;
  customer_rate: number;
  manual_rate?: number;
  aed_amount: number;
  in_dhirams?: number;
  base_rate: number;
  wholesale_rate?: number;
  cost_aed: number;
  gross_profit_aed: number;
  delivery_charge_pct: number;
  delivery_charge_aed: number;
  net_profit_aed: number;
  distributor_id?: string | null;
  distributor_name?: string | null;
  distributor_names?: string | null;
  distributor_split_details?: string | null;
  status: string;
  notes?: string | null;
  total_distributed_inr?: number;
  remaining_inr?: number;
  paid_aed?: number;
  paid_amount?: number;
  pending_aed?: number;
  balance_to_paid?: number;
  is_demo?: boolean;
  splits?: DistributionSplitRecord[];
  created_at: string;
}

export interface CustomerPaymentRecord {
  id: string;
  payment_number: string;
  payment_date: string;
  customer_id: string;
  customer_code?: string | null;
  customer_name?: string;
  transaction_id?: string | null;
  amount_aed: number;
  payment_method: string;
  reference_number?: string | null;
  notes?: string | null;
  is_demo?: boolean;
  created_at: string;
}

export interface DistributorRecord {
  id: string;
  code: string;
  name: string;
  partner_type: string;
  group_type: string; // 'IND' | 'AED'
  client_confirmation_note?: string | null;
  default_settlement_currency: string;
  status: string;
  total_inr?: number;
  total_aed?: number;
  total_paid?: number;
  outstanding_balance?: number;
  total_splits_inr?: number;
  total_splits_paid_inr?: number;
  splits_balance_inr?: number;
  created_at: string;
}

export interface BankDistripAccountRecord {
  id: string;
  account_code: string;
  account_name: string;
  bank_name?: string | null;
  account_number?: string | null;
  status: string;
  current_balance?: number;
  created_at: string;
}

export interface BankDistripRecord {
  id: string;
  record_date: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  order_inr: number;
  commission_inr: number;
  paid_inr: number;
  balance_inr: number;
  notes?: string | null;
  created_at: string;
}

export interface PartyPriorTransferItem {
  id: string;
  transaction_number: string;
  transaction_date: string;
  inr_amount: number;
  notes?: string | null;
}

export interface PartyPriorTransferSummary {
  partyId: string;
  partyCode: string;
  partyName: string;
  distributorId?: string;
  totalTransferredInr: number;
  totalSplitsAssignedInr: number;
  availablePriorBalanceInr: number;
  hasPriorTransfers: boolean;
  transfers: PartyPriorTransferItem[];
}

function formatDate(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function formatDateTime(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function mapCustomerRecord(r: any): Customer {
  const totalInr = roundTo(Number(r.total_inr || 0), 3);
  const totalAed = roundTo(Number(r.total_aed || 0), 3);
  const totalPaid = roundTo(Number(r.total_paid || 0), 3);
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    phone: r.phone || null,
    default_rate: r.default_rate != null ? Number(r.default_rate) : null,
    status: r.status,
    entity_type: r.entity_type || "CUSTOMER",
    party_type: r.party_type || (r.entity_type === "PARTY" ? "DUBAI" : undefined),
    total_inr: totalInr,
    total_aed: totalAed,
    total_paid: totalPaid,
    outstanding_balance: roundTo(totalAed - totalPaid, 3),
    created_at: formatDateTime(r.created_at),
  };
}

function mapTransactionRecord(r: any): TransactionRecord {
  const inrAmount = roundTo(Number(r.inr_amount), 3);
  const aedAmount = roundTo(Number(r.aed_amount), 3);
  const distributedInr = roundTo(Number(r.total_distributed_inr || 0), 3);
  const remainingInr = roundTo(Math.max(0, inrAmount - distributedInr), 3);
  const paidAed = roundTo(Number(r.paid_aed || 0), 3);
  const pendingAed = roundTo(Math.max(0, aedAmount - paidAed), 3);
  const customerRate = roundTo(Number(r.customer_rate), 3);
  const baseRate = roundTo(Number(r.base_rate), 3);

  return {
    id: r.id,
    transaction_number: r.transaction_number,
    transaction_date: formatDate(r.transaction_date),
    customer_id: r.customer_id,
    customer_code: r.customer_code || null,
    customer_name: r.customer_name,
    entity_type: r.entity_type || "CUSTOMER",
    party_type: r.party_type || (r.entity_type === "PARTY" ? "DUBAI" : undefined),
    inr_amount: inrAmount,
    total: inrAmount,
    customer_rate: customerRate,
    manual_rate: customerRate,
    aed_amount: aedAmount,
    in_dhirams: aedAmount,
    base_rate: baseRate,
    wholesale_rate: baseRate,
    cost_aed: roundTo(Number(r.cost_aed), 3),
    gross_profit_aed: roundTo(Number(r.gross_profit_aed), 3),
    delivery_charge_pct: Number(r.delivery_charge_pct),
    delivery_charge_aed: roundTo(Number(r.delivery_charge_aed), 3),
    net_profit_aed: roundTo(Number(r.net_profit_aed), 3),
    distributor_id: r.distributor_id || null,
    distributor_name: r.distributor_name || null,
    distributor_names: r.distributor_names && r.distributor_names !== '-' ? r.distributor_names : (r.distributor_name || null),
    distributor_split_details: r.distributor_split_details && r.distributor_split_details !== '-' ? r.distributor_split_details : null,
    status: r.status,
    notes: r.notes || null,
    is_demo: Boolean(r.is_demo),
    total_distributed_inr: distributedInr,
    remaining_inr: remainingInr,
    paid_aed: paidAed,
    paid_amount: paidAed,
    pending_aed: pendingAed,
    balance_to_paid: pendingAed,
    created_at: formatDateTime(r.created_at),
  };
}

function mapDistributionSplitRecord(r: any): DistributionSplitRecord {
  return {
    id: r.id,
    transaction_id: r.transaction_id,
    transaction_number: r.transaction_number,
    customer_id: r.customer_id,
    customer_code: r.customer_code,
    customer_name: r.customer_name,
    distributor_id: r.distributor_id,
    distributor_name: r.distributor_name,
    distributor_code: r.distributor_code,
    group_type: r.group_type || "IND",
    split_date: formatDate(r.split_date),
    inr_amount: roundTo(Number(r.inr_amount || 0), 3),
    wholesale_rate: r.wholesale_rate != null ? roundTo(Number(r.wholesale_rate), 3) : null,
    aed_equivalent: r.aed_equivalent != null ? roundTo(Number(r.aed_equivalent), 3) : null,
    paid_amount_inr: roundTo(Number(r.paid_amount_inr || 0), 3),
    balance_inr: roundTo(Number(r.balance_inr || 0), 3),
    status: r.status || "ALLOCATED",
    notes: r.notes || null,
    is_demo: Boolean(r.is_demo),
    created_at: formatDateTime(r.created_at),
  };
}

function mapBankDistripRecord(r: any): BankDistripRecord {
  return {
    id: r.id,
    record_date: formatDate(r.record_date),
    account_id: r.account_id,
    account_code: r.account_code || r.account_id,
    account_name: r.account_name,
    order_inr: roundTo(Number(r.order_inr || 0), 3),
    commission_inr: roundTo(Number(r.commission_inr || 0), 3),
    paid_inr: roundTo(Number(r.paid_inr || 0), 3),
    balance_inr: roundTo(Number(r.balance_inr || 0), 3),
    notes: r.notes || null,
    created_at: formatDateTime(r.created_at),
  };
}

// ---------------- GLOBAL CACHES (PERSISTENT ACROSS NEXT.JS HOT-RELOAD & ROUTE SEGMENTS) ----------------
interface CacheStore {
  customers: { timestamp: number; data: Record<string, Customer[]> } | null;
  customerLedger: Map<string, { timestamp: number; data: any }>;
  customerPayments: { timestamp: number; data: any[] } | null;
  partyTransfers: {
    timestamp: number;
    data: {
      transfers: TransactionRecord[];
      parties: Customer[];
      priorSummaries: Record<string, PartyPriorTransferSummary>;
      priorList: PartyPriorTransferSummary[];
    };
  } | null;
  bankDistrip: { timestamp: number; data: Map<string, any> } | null;
  dashboardKpi: { timestamp: number; key: string; data: any } | null;
  partySplitSummary: { timestamp: number; key: string; data: any } | null;
}

const g = globalThis as any;
if (!g.__PETTI_CACHE_STORE__) {
  g.__PETTI_CACHE_STORE__ = {
    customers: null,
    customerLedger: new Map(),
    customerPayments: null,
    partyTransfers: null,
    bankDistrip: null,
    dashboardKpi: null,
    partySplitSummary: null,
  };
}
const cacheStore: CacheStore = g.__PETTI_CACHE_STORE__;

type DataChangeCallback = () => void;
const dataChangeCallbacks: Set<DataChangeCallback> = new Set();

export function onDataChange(cb: DataChangeCallback): () => void {
  dataChangeCallbacks.add(cb);
  return () => dataChangeCallbacks.delete(cb);
}

export function notifyDataChange(): void {
  dataChangeCallbacks.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      console.error("[DataChange] Callback error:", err);
    }
  });

  // Automatically trigger disk workbook synchronization
  if (typeof window === "undefined") {
    import("@/lib/reports/normalized-master-generator")
      .then((m) => {
        if (typeof m.triggerMasterWorkbookSync === "function") {
          m.triggerMasterWorkbookSync();
        }
      })
      .catch((err) => {
        console.error("[DataChange] Error invoking triggerMasterWorkbookSync:", err);
      });
  }
}

export function invalidateAllCaches(): void {
  cacheStore.customers = null;
  cacheStore.customerLedger.clear();
  cacheStore.customerPayments = null;
  cacheStore.partyTransfers = null;
  cacheStore.bankDistrip = null;
  cacheStore.dashboardKpi = null;
  cacheStore.partySplitSummary = null;
  notifyDataChange();
}

export function invalidateCustomersCache(): void {
  invalidateAllCaches();
}

export function invalidatePartyTransfersCache(): void {
  invalidateAllCaches();
}

export function invalidateBankDistripCache(): void {
  invalidateAllCaches();
}

export async function listCustomers(entityType: string = "CUSTOMER"): Promise<Customer[]> {
  const now = Date.now();
  if (cacheStore.customers && (now - cacheStore.customers.timestamp < 30000)) {
    if (cacheStore.customers.data[entityType]) {
      return cacheStore.customers.data[entityType];
    }
  }

  let whereClause = "";
  const params: any[] = [];
  if (entityType !== "ALL") {
    params.push(entityType);
    whereClause = `WHERE COALESCE(c.entity_type, 'CUSTOMER') = $1`;
  }

  const rows = await query(`
    WITH txn_agg AS (
      SELECT customer_id, 
             SUM(inr_amount) AS total_inr, 
             SUM(aed_amount) AS total_aed
      FROM transactions 
      WHERE status = 'CONFIRMED'
      GROUP BY customer_id
    ),
    pay_agg AS (
      SELECT customer_id, 
             SUM(amount_aed) AS total_paid
      FROM customer_payments
      GROUP BY customer_id
    )
    SELECT 
      c.*,
      COALESCE(ta.total_inr, 0) as total_inr,
      COALESCE(ta.total_aed, 0) as total_aed,
      COALESCE(pa.total_paid, 0) as total_paid
    FROM customers c
    LEFT JOIN txn_agg ta ON ta.customer_id = c.id
    LEFT JOIN pay_agg pa ON pa.customer_id = c.id
    ${whereClause}
    ORDER BY c.name ASC
  `, params);

  const result = rows.map(mapCustomerRecord);
  if (!cacheStore.customers || (now - cacheStore.customers.timestamp >= 30000)) {
    cacheStore.customers = { timestamp: now, data: {} };
  }
  cacheStore.customers.data[entityType] = result;
  return result;
}

export async function listParties(partyType?: "DUBAI" | "INDIA" | "ALL"): Promise<Customer[]> {
  const cacheKey = `PARTY_${partyType || "ALL"}`;
  const now = Date.now();
  if (cacheStore.customers && (now - cacheStore.customers.timestamp < 30000)) {
    if (cacheStore.customers.data[cacheKey]) {
      return cacheStore.customers.data[cacheKey];
    }
  }

  let whereClause = "WHERE COALESCE(c.entity_type, 'CUSTOMER') = 'PARTY'";
  const params: any[] = [];
  if (partyType && partyType !== "ALL") {
    params.push(partyType);
    whereClause += ` AND COALESCE(c.party_type, 'DUBAI') = $1`;
  }

  const rows = await query(`
    WITH txn_agg AS (
      SELECT customer_id, 
             SUM(inr_amount) AS total_inr, 
             SUM(aed_amount) AS total_aed
      FROM transactions 
      WHERE status = 'CONFIRMED'
      GROUP BY customer_id
    ),
    pay_agg AS (
      SELECT customer_id, 
             SUM(amount_aed) AS total_paid
      FROM customer_payments
      GROUP BY customer_id
    )
    SELECT 
      c.*,
      COALESCE(ta.total_inr, 0) as total_inr,
      COALESCE(ta.total_aed, 0) as total_aed,
      COALESCE(pa.total_paid, 0) as total_paid
    FROM customers c
    LEFT JOIN txn_agg ta ON ta.customer_id = c.id
    LEFT JOIN pay_agg pa ON pa.customer_id = c.id
    ${whereClause}
    ORDER BY c.name ASC
  `, params);

  const result = rows.map(mapCustomerRecord);
  if (!cacheStore.customers || (now - cacheStore.customers.timestamp >= 30000)) {
    cacheStore.customers = { timestamp: now, data: {} };
  }
  cacheStore.customers.data[cacheKey] = result;
  return result;
}

export async function getPartiesPriorTransfersSummary(): Promise<{
  summaries: Record<string, PartyPriorTransferSummary>;
  list: PartyPriorTransferSummary[];
}> {
  const [parties, distributors, partyTxns, splits] = await Promise.all([
    listParties("ALL"),
    listDistributors(),
    query(`
      SELECT t.id, t.transaction_number, t.transaction_date, t.inr_amount, t.customer_id, t.notes
      FROM transactions t
      JOIN customers c ON c.id = t.customer_id
      WHERE COALESCE(c.entity_type, 'CUSTOMER') = 'PARTY' AND t.status = 'CONFIRMED'
      ORDER BY t.transaction_date ASC, t.created_at ASC
    `),
    query(`
      SELECT s.id, s.distributor_id, s.inr_amount, s.paid_amount_inr, s.balance_inr, s.transaction_id
      FROM distribution_splits s
      JOIN transactions t ON t.id = s.transaction_id
      WHERE t.status = 'CONFIRMED'
    `),
  ]);

  // Code to distributor mapping
  const codeToDistMap = new Map<string, string>();
  for (const d of distributors) {
    if (d.code) codeToDistMap.set(d.code.toUpperCase(), d.id);
  }

  // Distributor ID to code
  const distIdToCodeMap = new Map<string, string>();
  for (const d of distributors) {
    distIdToCodeMap.set(d.id, (d.code || d.name).toUpperCase());
  }

  // Party ID to code
  const partyIdToCodeMap = new Map<string, string>();
  for (const p of parties) {
    partyIdToCodeMap.set(p.id, (p.code || p.name).toUpperCase());
  }

  const list: PartyPriorTransferSummary[] = [];
  const summaries: Record<string, PartyPriorTransferSummary> = {};

  for (const p of parties) {
    const pCode = (p.code || p.name).toUpperCase();
    const distId = codeToDistMap.get(pCode) || p.id;

    // Filter party transfers sent to this party
    const pTxns = partyTxns.filter((t: any) => {
      const tCode = partyIdToCodeMap.get(t.customer_id);
      return t.customer_id === p.id || t.customer_id === distId || (tCode && tCode === pCode);
    });

    const totalTransferred = pTxns.reduce((sum: number, t: any) => sum + Number(t.inr_amount || 0), 0);

    // Filter splits assigned to this party
    const pSplits = splits.filter((s: any) => {
      const sCode = distIdToCodeMap.get(s.distributor_id) || partyIdToCodeMap.get(s.distributor_id);
      return s.distributor_id === distId || s.distributor_id === p.id || (sCode && sCode === pCode);
    });

    const totalSplits = pSplits.reduce((sum: number, s: any) => sum + Number(s.inr_amount || 0), 0);
    // Only subtract splits that were actually offset / paid against the prior advance
    const totalDeductedFromPrior = pSplits.reduce((sum: number, s: any) => sum + Number(s.paid_amount_inr || 0), 0);

    const availablePriorBalance = Math.max(0, roundTo(totalTransferred - totalDeductedFromPrior, 3));
    const hasPriorTransfers = availablePriorBalance > 0;

    const item: PartyPriorTransferSummary = {
      partyId: p.id,
      partyCode: p.code || p.name,
      partyName: p.name,
      distributorId: distId,
      totalTransferredInr: roundTo(totalTransferred, 3),
      totalSplitsAssignedInr: roundTo(totalSplits, 3),
      availablePriorBalanceInr: availablePriorBalance,
      hasPriorTransfers,
      transfers: pTxns.map((t: any) => ({
        id: t.id,
        transaction_number: t.transaction_number,
        transaction_date: t.transaction_date,
        inr_amount: Number(t.inr_amount || 0),
        notes: t.notes || null,
      })),
    };

    list.push(item);

    // Index by multiple keys for resilient lookup
    summaries[p.id] = item;
    if (distId) summaries[distId] = item;
    summaries[pCode] = item;
    summaries[p.name.toLowerCase()] = item;
  }

  return { summaries, list };
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const cachedLedger = cacheStore.customerLedger.get(id);
  if (cachedLedger && (Date.now() - cachedLedger.timestamp < 30000)) {
    return cachedLedger.data.customer;
  }
  const r = await queryOne(`
    WITH txn_agg AS (
      SELECT customer_id, 
             SUM(inr_amount) AS total_inr, 
             SUM(aed_amount) AS total_aed
      FROM transactions 
      WHERE status = 'CONFIRMED' AND (
        customer_id = $1 
        OR customer_id IN (SELECT id FROM customers WHERE UPPER(code) = UPPER($2) OR UPPER(name) = UPPER($2))
        OR distributor_id = $1
      )
      GROUP BY customer_id
    ),
    pay_agg AS (
      SELECT customer_id, 
             SUM(amount_aed) AS total_paid
      FROM customer_payments
      WHERE customer_id = $1 
         OR customer_id IN (SELECT id FROM customers WHERE UPPER(code) = UPPER($2) OR UPPER(name) = UPPER($2))
      GROUP BY customer_id
    )
    SELECT 
      c.*,
      COALESCE(ta.total_inr, 0) as total_inr,
      COALESCE(ta.total_aed, 0) as total_aed,
      COALESCE(pa.total_paid, 0) as total_paid
    FROM customers c
    LEFT JOIN txn_agg ta ON ta.customer_id = c.id
    LEFT JOIN pay_agg pa ON pa.customer_id = c.id
    WHERE c.id = $1 
       OR UPPER(c.code) = UPPER($2)
       OR UPPER(c.name) = UPPER($2)
       OR c.code IN (SELECT code FROM distributors WHERE id = $1)
       OR UPPER(c.name) IN (SELECT UPPER(name) FROM distributors WHERE id = $1)
    LIMIT 1
  `, [id, id]);

  if (!r) return null;
  return mapCustomerRecord(r);
}

export async function createCustomer(data: {
  name: string;
  code?: string;
  phone?: string;
  default_rate?: number;
  entity_type?: string;
  party_type?: "DUBAI" | "INDIA" | string;
}): Promise<Customer> {
  const entityType = data.entity_type || "CUSTOMER";
  const partyType = data.party_type || (entityType === "PARTY" ? "DUBAI" : undefined);
  const id = entityType === "PARTY"
    ? `party-${(data.code || data.name).toLowerCase().replace(/[^a-z0-9]/g, "")}`
    : crypto.randomUUID();
  const code = data.code?.trim() || (
    data.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) +
    (entityType === "PARTY" ? "" : ("-" + Math.floor(100 + Math.random() * 900)))
  );
  
  await execute(`
    INSERT INTO customers (id, code, name, phone, default_rate, status, entity_type, party_type)
    VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7)
    ON CONFLICT (code) DO UPDATE SET 
      name = EXCLUDED.name,
      entity_type = EXCLUDED.entity_type,
      party_type = COALESCE(EXCLUDED.party_type, customers.party_type),
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      default_rate = COALESCE(EXCLUDED.default_rate, customers.default_rate)
  `, [id, code, data.name.trim(), data.phone || null, data.default_rate || 38.25, entityType, partyType || null]);

  // If this is an Indian party, ensure it's also registered in distributors (for splits) & bank_distrip_accounts
  if (entityType === "PARTY" && partyType === "INDIA") {
    const distId = `dist-${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    await execute(`
      INSERT INTO distributors (id, code, name, partner_type, group_type, default_settlement_currency, status)
      VALUES ($1, $2, $3, 'INDIA_DISTRIBUTOR', 'IND', 'INR', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;
    `, [distId, code, data.name.trim()]);

    await execute(`
      INSERT INTO bank_distrip_accounts (id, account_code, account_name, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET account_name = EXCLUDED.account_name, account_code = EXCLUDED.account_code;
    `, [distId, code, data.name.trim()]);
  } else if (entityType === "PARTY" && partyType === "DUBAI") {
    const distId = `dist-${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    await execute(`
      INSERT INTO distributors (id, code, name, partner_type, group_type, default_settlement_currency, status)
      VALUES ($1, $2, $3, 'WHOLESALE_PARTNER', 'AED', 'AED', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;
    `, [distId, code, data.name.trim()]);
  }

  invalidatePartyTransfersCache();
  const created = await getCustomer(id);
  return created!;
}

export async function createParty(data: {
  name: string;
  code?: string;
  phone?: string;
  default_rate?: number;
  party_type?: "DUBAI" | "INDIA" | string;
}): Promise<Customer> {
  return createCustomer({ ...data, entity_type: "PARTY", party_type: data.party_type || "DUBAI" });
}

// ---------------- TRANSACTIONS ----------------
export function generateTransactionNumber(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `TXN-${year}-${randomSuffix}`;
}

export async function listTransactions(filters?: {
  from?: string;
  to?: string;
  customerId?: string;
  status?: string;
  limit?: number;
  entityType?: string;
}): Promise<TransactionRecord[]> {
  const isPartyOnly = filters?.entityType === "PARTY";
  let sql = isPartyOnly
    ? `
    WITH pay_agg AS (
      SELECT cp.transaction_id, SUM(cp.amount_aed) AS paid_aed
      FROM customer_payments cp
      GROUP BY cp.transaction_id
    )
    SELECT 
      t.*,
      c.code as customer_code,
      c.name as customer_name,
      c.entity_type,
      c.party_type,
      d.name as distributor_name,
      '-' as distributor_names,
      '-' as distributor_split_details,
      0 as total_distributed_inr,
      COALESCE(pa.paid_aed, 0) as paid_aed
    FROM transactions t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN distributors d ON d.id = t.distributor_id
    LEFT JOIN pay_agg pa ON pa.transaction_id = t.id
    WHERE COALESCE(c.entity_type, 'CUSTOMER') = 'PARTY'
  `
    : `
    WITH split_agg AS (
      SELECT s2.transaction_id,
             STRING_AGG(DISTINCT d2.name, ', ' ORDER BY d2.name) AS distributor_names,
             STRING_AGG(d2.name || ' (\u20b9' || ROUND(s2.inr_amount)::text || ')', ', ') AS distributor_split_details,
             SUM(s2.inr_amount) AS total_distributed_inr
      FROM distribution_splits s2
      JOIN distributors d2 ON d2.id = s2.distributor_id
      GROUP BY s2.transaction_id
    ),
    pay_agg AS (
      SELECT cp.transaction_id, SUM(cp.amount_aed) AS paid_aed
      FROM customer_payments cp
      GROUP BY cp.transaction_id
    )
    SELECT
      t.*,
      c.code as customer_code,
      c.name as customer_name,
      c.entity_type,
      c.party_type,
      d.name as distributor_name,
      COALESCE(sa.distributor_names, d.name, '-') as distributor_names,
      COALESCE(sa.distributor_split_details, '-') as distributor_split_details,
      COALESCE(sa.total_distributed_inr, 0) as total_distributed_inr,
      COALESCE(pa.paid_aed, 0) as paid_aed
    FROM transactions t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN distributors d ON d.id = t.distributor_id
    LEFT JOIN split_agg sa ON sa.transaction_id = t.id
    LEFT JOIN pay_agg pa ON pa.transaction_id = t.id
    WHERE 1=1
  `;
  const params: any[] = [];


  if (filters?.from) {
    params.push(filters.from);
    sql += ` AND t.transaction_date >= $${params.length}`;
  }
  if (filters?.to) {
    params.push(filters.to);
    sql += ` AND t.transaction_date <= $${params.length}`;
  }
  if (filters?.customerId) {
    params.push(filters.customerId);
    sql += ` AND t.customer_id = $${params.length}`;
  }
  if (filters?.status) {
    params.push(filters.status);
    sql += ` AND t.status = $${params.length}`;
  }
  if (filters?.entityType && filters.entityType !== "ALL" && !isPartyOnly) {
    params.push(filters.entityType);
    sql += ` AND COALESCE(c.entity_type, 'CUSTOMER') = $${params.length}`;
  }

  sql += ` ORDER BY t.transaction_date DESC, t.created_at DESC`;

  if (filters?.limit) {
    params.push(filters.limit);
    sql += ` LIMIT $${params.length}`;
  }

  const rows = await query(sql, params);
  return rows.map(mapTransactionRecord);
}

// ---------------- PARTY TRANSFERS COMBINED FETCHER ----------------


export async function getPartyTransfersData(forceRefresh = false): Promise<{
  transfers: TransactionRecord[];
  parties: Customer[];
  priorSummaries: Record<string, PartyPriorTransferSummary>;
  priorList: PartyPriorTransferSummary[];
}> {
  const now = Date.now();
  // Fast cache for 30 seconds unless invalidated by any mutation
  if (!forceRefresh && cacheStore.partyTransfers && (now - cacheStore.partyTransfers.timestamp < 30000)) {
    return cacheStore.partyTransfers.data;
  }

  // Parallel fetch using Promise.all on server
  const [transfers, parties, priorData] = await Promise.all([
    listTransactions({ entityType: "PARTY", limit: 250 }),
    listParties(),
    getPartiesPriorTransfersSummary(),
  ]);

  const result = {
    transfers,
    parties,
    priorSummaries: priorData.summaries,
    priorList: priorData.list,
  };
  cacheStore.partyTransfers = {
    timestamp: now,
    data: result,
  };
  return result;
}

export async function getTransaction(id: string): Promise<TransactionRecord | null> {
  const r = await queryOne(`
    SELECT 
      t.*,
      c.code as customer_code,
      c.name as customer_name,
      d.name as distributor_name,
      COALESCE((
        SELECT STRING_AGG(DISTINCT d2.name, ', ' ORDER BY d2.name)
        FROM distribution_splits s2
        JOIN distributors d2 ON d2.id = s2.distributor_id
        WHERE s2.transaction_id = t.id
      ), d.name, '-') as distributor_names,
      COALESCE((
        SELECT STRING_AGG(d2.name || ' (₹' || ROUND(s2.inr_amount)::text || ')', ', ')
        FROM distribution_splits s2
        JOIN distributors d2 ON d2.id = s2.distributor_id
        WHERE s2.transaction_id = t.id
      ), '-') as distributor_split_details,
      COALESCE((SELECT SUM(s.inr_amount) FROM distribution_splits s WHERE s.transaction_id = t.id), 0) as total_distributed_inr,
      COALESCE((SELECT SUM(cp.amount_aed) FROM customer_payments cp WHERE cp.transaction_id = t.id), 0) as paid_aed
    FROM transactions t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN distributors d ON d.id = t.distributor_id
    WHERE t.id = $1 OR t.transaction_number = $2
  `, [id, id]);

  if (!r) return null;
  const mapped = mapTransactionRecord(r);

  // Fetch splits for this transaction
  const splits = await listDistributionSplits({ transaction_id: mapped.id });
  mapped.splits = splits;

  return mapped;
}

export async function createTransaction(data: {
  transaction_date: string;
  customer_id: string;
  inr_amount?: number;
  total?: number;
  customer_rate?: number;
  manual_rate?: number;
  base_rate?: number;
  paid_amount?: number;
  paid_aed?: number;
  delivery_charge_pct?: number;
  delivery_charge_aed?: number;
  distributor_id?: string | null;
  notes?: string;
  splits?: Array<{
    distributor_id: string;
    inr_amount: number;
    paid_amount_inr?: number;
    balance_inr?: number;
    notes?: string;
  }>;
}): Promise<TransactionRecord> {
  const id = crypto.randomUUID();
  const txnNumber = generateTransactionNumber();

  const total = Number(data.total ?? data.inr_amount);
  const manualRate = Number(data.manual_rate ?? data.customer_rate);
  const paidAmount = Number(data.paid_amount ?? data.paid_aed ?? 0);

  let inrAmount = total;
  let customerRate = manualRate;
  let aedAmount = 0;
  let baseRate = 0;
  let costAed = 0;
  let grossProfitAed = 0;
  let deliveryPct = 0;
  let deliveryChargeAed = 0;
  let netProfitAed = 0;

  if (data.base_rate !== undefined) {
    const calc = calculateTransaction({
      inrAmount: total,
      customerRate: manualRate,
      baseRate: Number(data.base_rate),
      deliveryChargePct: data.delivery_charge_pct,
      deliveryChargeAed: data.delivery_charge_aed,
    });
    inrAmount = calc.inrAmount;
    customerRate = calc.customerRate;
    aedAmount = calc.aedAmount;
    baseRate = calc.baseRate;
    costAed = calc.costAed;
    grossProfitAed = calc.grossProfitAed;
    deliveryPct = calc.deliveryChargePct;
    deliveryChargeAed = calc.deliveryChargeAed;
    netProfitAed = calc.netProfitAed;
  } else {
    // Authoritative Dubai Client calculation:
    // Whole sale rate = 1000 / manual value
    // In Dhirams = Total / Whole sale rate
    // Balance to paid = In Dhirams - paid amount
    const dubaiCalc = calculateDubaiClientTransfer({
      total,
      manualRate,
      paidAmount,
    });
    inrAmount = dubaiCalc.total;
    customerRate = dubaiCalc.manualRate;
    baseRate = dubaiCalc.wholesaleRate;
    aedAmount = dubaiCalc.inDhirams;
    costAed = dubaiCalc.inDhirams;
    grossProfitAed = 0;
    deliveryPct = 0;
    deliveryChargeAed = 0;
    netProfitAed = 0;
  }

  await execute(`
    INSERT INTO transactions (
      id, transaction_number, transaction_date, customer_id,
      inr_amount, customer_rate, aed_amount, base_rate,
      cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
      net_profit_aed, distributor_id, status, notes, is_demo
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, 'CONFIRMED', $15, false
    )
  `, [
    id, txnNumber, data.transaction_date, data.customer_id,
    inrAmount, customerRate, aedAmount, baseRate,
    costAed, grossProfitAed, deliveryPct, deliveryChargeAed,
    netProfitAed, data.distributor_id || null, data.notes || null
  ]);

  // If paidAmount is provided and > 0, record initial payment
  if (paidAmount > 0) {
    const paymentId = crypto.randomUUID();
    const pmtNumber = `PMT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    await execute(`
      INSERT INTO customer_payments (
        id, payment_number, payment_date, customer_id, transaction_id,
        amount_aed, payment_method, notes, is_demo
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, 'CASH', 'Initial payment upon transfer creation', false
      )
    `, [paymentId, pmtNumber, data.transaction_date, data.customer_id, id, paidAmount]);
  }

  // Insert initial splits if provided
  if (data.splits && data.splits.length > 0) {
    const rawSum = data.splits.reduce((sum, s) => sum + Number(s.inr_amount), 0);
    const splitDiff = Math.round((inrAmount - rawSum + Number.EPSILON) * 1000) / 1000;
    if (splitDiff < -1.00) {
      throw new Error(`Total distribution (₹${rawSum.toLocaleString()}) cannot exceed customer order (₹${inrAmount.toLocaleString()})`);
    }

    // Auto-absorb minor fractional discrepancy (<= 1.00 INR) into the last split item
    const splitsToInsert = [...data.splits];
    if (Math.abs(splitDiff) > 0 && Math.abs(splitDiff) <= 1.00 && splitsToInsert.length > 0) {
      const lastIdx = splitsToInsert.length - 1;
      const lastAmt = roundTo(Number(splitsToInsert[lastIdx].inr_amount) + splitDiff, 3);
      splitsToInsert[lastIdx] = {
        ...splitsToInsert[lastIdx],
        inr_amount: lastAmt,
        balance_inr: splitsToInsert[lastIdx].balance_inr !== undefined
          ? roundTo(Number(splitsToInsert[lastIdx].balance_inr) + splitDiff, 3)
          : undefined,
      };
    }

    for (const s of splitsToInsert) {
      const splitInr = Number(s.inr_amount);
      const paidInr = s.paid_amount_inr !== undefined ? Number(s.paid_amount_inr) : 0.00;
      const balanceInr = s.balance_inr !== undefined ? Number(s.balance_inr) : roundTo(splitInr - paidInr, 3);
      const splitStatus = balanceInr <= 0 ? 'SETTLED' : (paidInr > 0 ? 'PARTIAL' : 'ALLOCATED');
      const splitId = crypto.randomUUID();
      await execute(`
        INSERT INTO distribution_splits (
          id, transaction_id, distributor_id, split_date,
          inr_amount, wholesale_rate, aed_equivalent, paid_amount_inr,
          balance_inr, status, notes
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11
        )
      `, [
        splitId, id, s.distributor_id, data.transaction_date,
        splitInr, baseRate, baseRate > 0 ? roundTo(splitInr / baseRate, 3) : 0,
        paidInr, balanceInr, splitStatus, s.notes || null
      ]);
    }
    // Automatically recalculate India party running orders & balances
    const distIds = [...new Set(data.splits.map(s => s.distributor_id))];
    for (const did of distIds) {
      await recalculateBankDistripBalances(did).catch(err => console.error("Error updating bank distrip on create:", err));
    }
  } else if (data.distributor_id) {
    await recalculateBankDistripBalances(data.distributor_id).catch(err => console.error("Error updating bank distrip on create:", err));
  }

  // Record audit log
  await execute(`
    INSERT INTO audit_logs (id, entity_name, entity_id, action, new_values, reason)
    VALUES ($1, 'TRANSACTION', $2, 'CREATE', $3, 'Initial transaction creation')
  `, [crypto.randomUUID(), id, JSON.stringify({ inrAmount, customerRate, baseRate, aedAmount, paidAmount })]);

  const created = await getTransaction(id);
  invalidatePartyTransfersCache();
  return created!;
}

export async function voidTransaction(id: string, reason: string): Promise<TransactionRecord> {
  const existing = await getTransaction(id);
  if (!existing) throw new Error("Transaction not found");

  await execute(`
    UPDATE transactions 
    SET status = 'VOIDED', updated_at = NOW()
    WHERE id = $1
  `, [id]);

  await execute(`
    INSERT INTO audit_logs (id, entity_name, entity_id, action, old_values, reason)
    VALUES ($1, 'TRANSACTION', $2, 'VOID', $3, $4)
  `, [crypto.randomUUID(), id, JSON.stringify(existing), reason || "User voided transaction"]);

  // Recalculate affected distributors so voided order is deducted
  const splits = await query(`SELECT DISTINCT distributor_id FROM distribution_splits WHERE transaction_id = $1`, [id]);
  for (const s of splits) {
    if (s.distributor_id) {
      await recalculateBankDistripBalances(s.distributor_id).catch(err => console.error("Error updating bank distrip on void:", err));
    }
  }
  if (existing.distributor_id) {
    await recalculateBankDistripBalances(existing.distributor_id).catch(err => console.error("Error updating bank distrip on void:", err));
  }

  invalidatePartyTransfersCache();
  const updated = await getTransaction(id);
  return updated!;
}

// ---------------- INDIA DISTRIBUTION SPLITS ----------------
export async function listDistributionSplits(filters?: {
  transaction_id?: string;
  distributor_id?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<DistributionSplitRecord[]> {
  let sql = `
    SELECT 
      s.*,
      t.transaction_number,
      c.id as customer_id,
      c.code as customer_code,
      c.name as customer_name,
      d.name as distributor_name,
      d.code as distributor_code,
      d.group_type
    FROM distribution_splits s
    JOIN transactions t ON t.id = s.transaction_id
    JOIN customers c ON c.id = t.customer_id
    JOIN distributors d ON d.id = s.distributor_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters?.transaction_id) {
    params.push(filters.transaction_id);
    sql += ` AND s.transaction_id = $${params.length}`;
  }
  if (filters?.distributor_id) {
    params.push(filters.distributor_id);
    sql += ` AND s.distributor_id = $${params.length}`;
  }
  if (filters?.from) {
    params.push(filters.from);
    sql += ` AND s.split_date >= $${params.length}`;
  }
  if (filters?.to) {
    params.push(filters.to);
    sql += ` AND s.split_date <= $${params.length}`;
  }

  sql += ` ORDER BY s.split_date DESC, s.created_at DESC`;

  if (filters?.limit) {
    params.push(filters.limit);
    sql += ` LIMIT $${params.length}`;
  }

  const rows = await query(sql, params);
  return rows.map(mapDistributionSplitRecord);
}

export interface PartySplitPeriodTotals {
  party_id: string;
  party_name: string;
  party_code: string;
  group_type: string;
  today_inr: number;
  yesterday_inr: number;
  week_inr: number;
  month_inr: number;
  year_inr: number;
  total_inr: number;
  split_count: number;
}

export interface PartySplitSummaryResult {
  parties: PartySplitPeriodTotals[];
  grand_totals: {
    today: number;
    yesterday: number;
    week: number;
    month: number;
    year: number;
    total: number;
  };
  recent_assignments: DistributionSplitRecord[];
  dates: {
    today: string;
    yesterday: string;
    week_start: string;
    month_start: string;
    year_start: string;
  };
}

export async function getPartySplitSummary(todayParam?: string): Promise<PartySplitSummaryResult> {
  const cacheKey = todayParam || "default";
  const now = Date.now();
  if (cacheStore.partySplitSummary && cacheStore.partySplitSummary.key === cacheKey && (now - cacheStore.partySplitSummary.timestamp < 30000)) {
    return cacheStore.partySplitSummary.data;
  }

  const today = todayParam || getTodayDateString();
  const yesterday = getYesterdayDateString();
  const weekStart = getStartOfWeekDateString();
  const monthStart = getStartOfMonthDateString();
  const yearStart = getStartOfYearDateString();

  const partySql = `
    SELECT 
      COALESCE(c.id, d.id) as party_id,
      d.id as distributor_id,
      d.name as party_name,
      d.code as party_code,
      d.group_type,
      COALESCE(SUM(CASE WHEN s.split_date = $1 THEN s.inr_amount ELSE 0 END), 0) as today_inr,
      COALESCE(SUM(CASE WHEN s.split_date = $2 THEN s.inr_amount ELSE 0 END), 0) as yesterday_inr,
      COALESCE(SUM(CASE WHEN s.split_date >= $3 AND s.split_date <= $1 THEN s.inr_amount ELSE 0 END), 0) as week_inr,
      COALESCE(SUM(CASE WHEN s.split_date >= $4 AND s.split_date <= $1 THEN s.inr_amount ELSE 0 END), 0) as month_inr,
      COALESCE(SUM(CASE WHEN s.split_date >= $5 AND s.split_date <= $1 THEN s.inr_amount ELSE 0 END), 0) as year_inr,
      COALESCE(SUM(s.inr_amount), 0) as total_inr,
      COUNT(s.id) as split_count
    FROM distributors d
    LEFT JOIN customers c ON (UPPER(c.code) = UPPER(d.code) OR UPPER(c.name) = UPPER(d.name))
                         AND COALESCE(c.entity_type, 'CUSTOMER') = 'PARTY'
    LEFT JOIN distribution_splits s ON s.distributor_id = d.id
    WHERE d.group_type = 'IND' OR d.partner_type = 'INDIA_DISTRIBUTOR'
    GROUP BY d.id, c.id, d.name, d.code, d.group_type
    ORDER BY d.name ASC
  `;

  const rows = await query(partySql, [today, yesterday, weekStart, monthStart, yearStart]);

  const parties: PartySplitPeriodTotals[] = rows.map((r: any) => ({
    party_id: r.party_id,
    party_name: r.party_name,
    party_code: r.party_code || r.party_name,
    group_type: r.group_type || "IND",
    today_inr: roundTo(Number(r.today_inr || 0), 3),
    yesterday_inr: roundTo(Number(r.yesterday_inr || 0), 3),
    week_inr: roundTo(Number(r.week_inr || 0), 3),
    month_inr: roundTo(Number(r.month_inr || 0), 3),
    year_inr: roundTo(Number(r.year_inr || 0), 3),
    total_inr: roundTo(Number(r.total_inr || 0), 3),
    split_count: Number(r.split_count || 0),
  }));

  const grand_totals = parties.reduce(
    (acc, p) => ({
      today: roundTo(acc.today + p.today_inr, 3),
      yesterday: roundTo(acc.yesterday + p.yesterday_inr, 3),
      week: roundTo(acc.week + p.week_inr, 3),
      month: roundTo(acc.month + p.month_inr, 3),
      year: roundTo(acc.year + p.year_inr, 3),
      total: roundTo(acc.total + p.total_inr, 3),
    }),
    { today: 0, yesterday: 0, week: 0, month: 0, year: 0, total: 0 }
  );

  const recent_assignments = await listDistributionSplits({ limit: 150 });

  const result: PartySplitSummaryResult = {
    parties,
    grand_totals,
    recent_assignments,
    dates: {
      today,
      yesterday,
      week_start: weekStart,
      month_start: monthStart,
      year_start: yearStart,
    },
  };

  cacheStore.partySplitSummary = {
    timestamp: now,
    key: cacheKey,
    data: result,
  };

  return result;
}

export async function createDistributionSplit(data: {
  transaction_id: string;
  distributor_id: string;
  split_date: string;
  inr_amount: number;
  wholesale_rate?: number;
  notes?: string;
}): Promise<DistributionSplitRecord> {
  const txn = await getTransaction(data.transaction_id);
  if (!txn) throw new Error("Transaction not found");

  const currentDistributed = txn.total_distributed_inr || 0;
  const newTotal = currentDistributed + Number(data.inr_amount);

  if (newTotal > txn.inr_amount) {
    const maxAllowed = txn.inr_amount - currentDistributed;
    throw new Error(`Split amount (₹${data.inr_amount.toLocaleString()}) exceeds unallocated order balance (₹${maxAllowed.toLocaleString()}).`);
  }

  const id = crypto.randomUUID();
  const wholesaleRate = data.wholesale_rate || txn.base_rate;
  const aedEq = wholesaleRate ? roundTo(data.inr_amount / wholesaleRate, 3) : 0;

  await execute(`
    INSERT INTO distribution_splits (
      id, transaction_id, distributor_id, split_date,
      inr_amount, wholesale_rate, aed_equivalent, paid_amount_inr,
      balance_inr, status, notes
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, 0.00,
      $5, 'ALLOCATED', $8
    )
  `, [
    id, data.transaction_id, data.distributor_id, data.split_date,
    roundTo(data.inr_amount, 3), wholesaleRate, aedEq, data.notes || null
  ]);

  invalidateAllCaches();
  const rows = await listDistributionSplits({ transaction_id: data.transaction_id });
  return rows.find(r => r.id === id)!;
}

export async function deleteDistributionSplit(id: string): Promise<void> {
  await execute(`DELETE FROM distribution_splits WHERE id = $1`, [id]);
  invalidateAllCaches();
}

// ---------------- CUSTOMER PAYMENTS ----------------
export async function recordCustomerPayment(data: {
  customer_id: string;
  payment_date: string;
  amount_aed: number;
  payment_method?: string;
  reference_number?: string;
  transaction_id?: string;
  notes?: string;
}): Promise<CustomerPaymentRecord> {
  const custRow = await queryOne(`
    SELECT id FROM customers 
    WHERE id = $1 
       OR UPPER(code) = UPPER($1) 
       OR code IN (SELECT code FROM distributors WHERE id = $1)
       OR UPPER(name) IN (SELECT UPPER(name) FROM distributors WHERE id = $1)
    LIMIT 1
  `, [data.customer_id]);
  const resolvedCustomerId = custRow ? custRow.id : data.customer_id;

  const id = crypto.randomUUID();
  const paymentNumber = `PAY-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  await execute(`
    INSERT INTO customer_payments (
      id, payment_number, payment_date, customer_id, transaction_id,
      amount_aed, payment_method, reference_number, notes, is_demo
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
  `, [
    id, paymentNumber, data.payment_date, resolvedCustomerId, data.transaction_id || null,
    roundTo(data.amount_aed, 3), data.payment_method || 'CASH', data.reference_number || null, data.notes || null
  ]);

  await execute(`
    INSERT INTO audit_logs (id, entity_name, entity_id, action, new_values, reason)
    VALUES ($1, 'PAYMENT', $2, 'CREATE', $3, 'Customer payment received')
  `, [crypto.randomUUID(), id, JSON.stringify(data)]);

  const created = await queryOne(`SELECT * FROM customer_payments WHERE id = $1`, [id]);
  invalidatePartyTransfersCache();
  return {
    ...created,
    payment_date: formatDate(created.payment_date),
    amount_aed: roundTo(Number(created.amount_aed), 3),
    created_at: formatDateTime(created.created_at),
  };
}

export async function listCustomerPayments(filters?: {
  customerId?: string;
  from?: string;
  to?: string;
}): Promise<any[]> {
  const hasFilters = Boolean(filters?.customerId || filters?.from || filters?.to);
  const now = Date.now();
  if (!hasFilters && cacheStore.customerPayments && (now - cacheStore.customerPayments.timestamp < 30000)) {
    return cacheStore.customerPayments.data;
  }

  let sql = `
    SELECT cp.*, c.code as customer_code, c.name as customer_name, t.transaction_number
    FROM customer_payments cp
    JOIN customers c ON c.id = cp.customer_id
    LEFT JOIN transactions t ON t.id = cp.transaction_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (filters?.customerId) {
    params.push(filters.customerId);
    sql += ` AND cp.customer_id = $${params.length}`;
  }
  if (filters?.from) {
    params.push(filters.from);
    sql += ` AND cp.payment_date >= $${params.length}`;
  }
  if (filters?.to) {
    params.push(filters.to);
    sql += ` AND cp.payment_date <= $${params.length}`;
  }
  sql += ` ORDER BY cp.payment_date DESC, cp.created_at DESC`;

  const rows = await query(sql, params);
  const result = rows.map((r: any) => ({
    id: r.id,
    payment_number: r.payment_number,
    payment_date: formatDate(r.payment_date),
    customer_id: r.customer_id,
    customer_code: r.customer_code || null,
    customer_name: r.customer_name,
    transaction_id: r.transaction_id || null,
    transaction_number: r.transaction_number || null,
    amount_aed: roundTo(Number(r.amount_aed), 3),
    payment_method: r.payment_method || "CASH",
    reference_number: r.reference_number || null,
    notes: r.notes || null,
    created_at: formatDateTime(r.created_at),
  }));

  if (!hasFilters) {
    cacheStore.customerPayments = {
      timestamp: now,
      data: result,
    };
  }

  return result;
}

export async function getCustomerLedger(customerId: string): Promise<{
  customer: Customer;
  entries: Array<{
    id: string;
    date: string;
    type: 'TRANSACTION' | 'PAYMENT';
    entry_type?: 'TRANSACTION' | 'PAYMENT';
    reference: string;
    description: string;
    inr_amount?: number | null;
    notes?: string | null;
    debit_aed: number;
    credit_aed: number;
    running_balance_aed: number;
    running_due_aed?: number;
  }>;
  ledger?: any[];
}> {
  const now = Date.now();
  const cached = cacheStore.customerLedger.get(customerId);
  if (cached && (now - cached.timestamp < 30000)) {
    return cached.data;
  }

  // 1. Resolve customer or party record flexibly by id, code, or linked distributor id/code/name
  let custRow = await queryOne(`
    SELECT * FROM customers 
    WHERE id = $1 
       OR UPPER(code) = UPPER($1) 
       OR UPPER(name) = UPPER($1)
       OR code IN (SELECT code FROM distributors WHERE id = $1)
       OR UPPER(name) IN (SELECT UPPER(name) FROM distributors WHERE id = $1)
    LIMIT 1
  `, [customerId]);

  if (!custRow) {
    const distRow = await queryOne(`SELECT * FROM distributors WHERE id = $1 OR UPPER(code) = UPPER($1) OR UPPER(name) = UPPER($1)`, [customerId]);
    if (distRow) {
      custRow = await queryOne(`
        SELECT * FROM customers 
        WHERE (UPPER(code) = UPPER($1) OR UPPER(name) = UPPER($2))
          AND COALESCE(entity_type, 'CUSTOMER') = 'PARTY'
        LIMIT 1
      `, [distRow.code || '', distRow.name || '']);
    }
  }

  if (!custRow) throw new Error("Party account not found");

  const resolvedId = custRow.id;
  const resolvedCode = custRow.code;

  // Parallel fetch: confirmed transactions (orders/transfers) and payments (settlements)
  const [txns, pays] = await Promise.all([
    query(`
      SELECT id, transaction_date as date, 'TRANSACTION' as type, transaction_number as reference,
             'Order ' || inr_amount || ' INR @ ' || customer_rate as description,
             aed_amount as debit_aed, 0.0 as credit_aed, created_at,
             inr_amount, aed_amount, notes
      FROM transactions
      WHERE (
        customer_id = $1 
        OR customer_id = $2 
        OR customer_id IN (SELECT id FROM customers WHERE UPPER(code) = UPPER($3) OR UPPER(name) = UPPER($3))
        OR distributor_id = $1
        OR distributor_id = $2
      ) 
        AND status = 'CONFIRMED'
      ORDER BY transaction_date ASC, created_at ASC
    `, [resolvedId, customerId, resolvedCode]),
    query(`
      SELECT id, payment_date as date, 'PAYMENT' as type, payment_number as reference,
             'Payment (' || payment_method || ')' as description,
             0.0 as debit_aed, amount_aed as credit_aed, created_at,
             amount_aed, notes
      FROM customer_payments
      WHERE (
        customer_id = $1 
        OR customer_id = $2 
        OR customer_id IN (SELECT id FROM customers WHERE UPPER(code) = UPPER($3) OR UPPER(name) = UPPER($3))
      )
      ORDER BY payment_date ASC, created_at ASC
    `, [resolvedId, customerId, resolvedCode]),
  ]);

  const totalInr = roundTo(txns.reduce((sum: number, t: any) => sum + Number(t.inr_amount || 0), 0), 3);
  const totalAed = roundTo(txns.reduce((sum: number, t: any) => sum + Number(t.aed_amount || 0), 0), 3);
  const totalPaid = roundTo(pays.reduce((sum: number, p: any) => sum + Number(p.amount_aed || 0), 0), 3);
  const outstandingBalance = roundTo(totalAed - totalPaid, 3);

  const customer: Customer = {
    id: custRow.id,
    code: custRow.code,
    name: custRow.name,
    phone: custRow.phone || null,
    default_rate: custRow.default_rate != null ? Number(custRow.default_rate) : null,
    status: custRow.status,
    entity_type: custRow.entity_type || "CUSTOMER",
    party_type: custRow.party_type || (custRow.entity_type === "PARTY" ? "DUBAI" : undefined),
    total_inr: totalInr,
    total_aed: totalAed,
    total_paid: totalPaid,
    outstanding_balance: outstandingBalance,
    created_at: formatDateTime(custRow.created_at),
  };

  // Merge & sort chronologically
  const allEvents = [...txns, ...pays].map((e: any) => ({
    id: e.id,
    date: formatDate(e.date),
    type: e.type as 'TRANSACTION' | 'PAYMENT',
    reference: e.reference,
    description: e.description,
    inr_amount: e.inr_amount != null ? roundTo(Number(e.inr_amount), 3) : null,
    notes: e.notes || null,
    debit_aed: roundTo(Number(e.debit_aed || 0), 3),
    credit_aed: roundTo(Number(e.credit_aed || 0), 3),
    created_at: formatDateTime(e.created_at),
  })).sort((a: any, b: any) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.created_at.localeCompare(b.created_at);
  });

  let running = 0;
  const entries = allEvents.map((e: any) => {
    running = roundTo(running + e.debit_aed - e.credit_aed, 3);
    return {
      id: e.id,
      date: e.date,
      type: e.type as 'TRANSACTION' | 'PAYMENT',
      entry_type: e.type as 'TRANSACTION' | 'PAYMENT',
      reference: e.reference,
      description: e.description,
      inr_amount: e.inr_amount,
      notes: e.notes,
      debit_aed: e.debit_aed,
      credit_aed: e.credit_aed,
      running_balance_aed: running,
      running_due_aed: running,
    };
  });

  const result = { customer, entries, ledger: entries };
  cacheStore.customerLedger.set(customerId, { timestamp: now, data: result });
  if (custRow.id !== customerId) {
    cacheStore.customerLedger.set(custRow.id, { timestamp: now, data: result });
  }
  if (custRow.code && custRow.code !== customerId) {
    cacheStore.customerLedger.set(custRow.code, { timestamp: now, data: result });
  }

  return result;
}

// ---------------- DISTRIBUTORS & INDIA PARTIES ----------------
export async function listDistributors(groupType?: "IND" | "AED"): Promise<DistributorRecord[]> {
  let sql = `
    SELECT d.*,
           COALESCE((SELECT SUM(s.inr_amount) FROM distribution_splits s WHERE s.distributor_id = d.id), 0) as total_splits_inr,
           COALESCE((SELECT SUM(s.paid_amount_inr) FROM distribution_splits s WHERE s.distributor_id = d.id), 0) as total_splits_paid_inr,
           COALESCE((SELECT SUM(s.balance_inr) FROM distribution_splits s WHERE s.distributor_id = d.id), 0) as splits_balance_inr
    FROM distributors d
    WHERE 1=1
  `;
  const params: any[] = [];
  if (groupType) {
    params.push(groupType);
    sql += ` AND d.group_type = $${params.length}`;
  }
  sql += ` ORDER BY d.group_type ASC, d.name ASC`;

  const rows = await query(sql, params);
  return rows.map(d => ({
    ...d,
    group_type: d.group_type || "IND",
    total_splits_inr: roundTo(Number(d.total_splits_inr || 0), 3),
    total_splits_paid_inr: roundTo(Number(d.total_splits_paid_inr || 0), 3),
    splits_balance_inr: roundTo(Number(d.splits_balance_inr || 0), 3),
    created_at: formatDateTime(d.created_at),
  }));
}

/** Shortcut — only IND group (India-side parties for distribution splits) */
export async function listIndiaDistributors(): Promise<DistributorRecord[]> {
  return listDistributors("IND");
}

/** Shortcut — only AED group (AED-side parties) */
export async function listAedDistributors(): Promise<DistributorRecord[]> {
  return listDistributors("AED");
}

export async function createDistributor(data: {
  name: string;
  code?: string;
  group_type: "IND" | "AED";
  partner_type?: string;
  default_settlement_currency?: string;
}): Promise<DistributorRecord> {
  const id = crypto.randomUUID();
  const suffix = data.group_type === "IND" ? "-IND" : "-AED";
  const code = data.code || (data.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) + suffix);
  const partnerType = data.partner_type || (data.group_type === "IND" ? "INDIA_DISTRIBUTOR" : "AED_DISTRIBUTOR");
  const currency = data.default_settlement_currency || (data.group_type === "IND" ? "INR" : "AED");

  await execute(`
    INSERT INTO distributors (id, code, name, partner_type, group_type, default_settlement_currency, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
  `, [id, code, data.name.trim(), partnerType, data.group_type, currency]);

  // Sync to customers and bank accounts if needed
  if (data.group_type === "IND") {
    const partyId = `party-${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    await execute(`
      INSERT INTO customers (id, code, name, default_rate, status, entity_type, party_type)
      VALUES ($1, $2, $3, 38.25, 'ACTIVE', 'PARTY', 'INDIA')
      ON CONFLICT (code) DO UPDATE SET entity_type = 'PARTY', party_type = 'INDIA';
    `, [partyId, code, data.name.trim()]);

    await execute(`
      INSERT INTO bank_distrip_accounts (id, account_code, account_name, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET account_name = EXCLUDED.account_name, account_code = EXCLUDED.account_code;
    `, [id, code, data.name.trim()]);
  } else if (data.group_type === "AED") {
    const partyId = `party-${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    await execute(`
      INSERT INTO customers (id, code, name, default_rate, status, entity_type, party_type)
      VALUES ($1, $2, $3, 38.25, 'ACTIVE', 'PARTY', 'DUBAI')
      ON CONFLICT (code) DO UPDATE SET entity_type = 'PARTY', party_type = 'DUBAI';
    `, [partyId, code, data.name.trim()]);
  }

  const all = await listDistributors();
  return all.find(d => d.id === id)!;
}

export async function listBankDistripAccounts(): Promise<BankDistripAccountRecord[]> {
  const rows = await query(`
    SELECT b.*,
           (SELECT balance_inr FROM bank_distrip_records r WHERE r.account_id = b.id ORDER BY r.record_date DESC, r.created_at DESC, r.id DESC LIMIT 1) as current_balance
    FROM bank_distrip_accounts b
    ORDER BY b.account_name ASC
  `);


  return rows.map(r => ({
    ...r,
    current_balance: roundTo(Number(r.current_balance || 0), 3),
    created_at: formatDateTime(r.created_at),
  }));
}

export async function createBankDistripAccount(data: {
  account_code: string;
  account_name: string;
  bank_name?: string;
  account_number?: string;
}): Promise<BankDistripAccountRecord> {
  const code = data.account_code.trim().toUpperCase();
  const name = data.account_name.trim();
  const id = `dist-${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  // Mirror into distributors table as IND group
  await execute(`
    INSERT INTO distributors (id, code, name, partner_type, group_type, default_settlement_currency, status)
    VALUES ($1, $2, $3, 'INDIA_DISTRIBUTOR', 'IND', 'INR', 'ACTIVE')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;
  `, [id, code, name]);

  await execute(`
    INSERT INTO bank_distrip_accounts (id, account_code, account_name, bank_name, account_number, status)
    VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
    ON CONFLICT (id) DO UPDATE SET account_name = EXCLUDED.account_name, account_code = EXCLUDED.account_code;
  `, [id, code, name, data.bank_name || null, data.account_number || null]);

  invalidateBankDistripCache();
  const acc = await queryOne(`SELECT * FROM bank_distrip_accounts WHERE id = $1`, [id]);
  return {
    ...acc,
    current_balance: 0,
    created_at: formatDateTime(acc.created_at),
  };
}

/**
 * Returns the authoritative ORDER amount for a distributor on a specific date.
 * ORDER is strictly read-only and automatically aggregated from:
 * 1. distribution_splits (from confirmed customer remittance transactions)
 * 2. direct transactions assigned to this distributor (without splits)
 */
export async function getDistributorOrderForDate(accountId: string, date: string): Promise<number> {
  const row = await queryOne(`
    SELECT (
      COALESCE((
        SELECT SUM(s.inr_amount) 
        FROM distribution_splits s 
        JOIN transactions t ON t.id = s.transaction_id
        WHERE t.status = 'CONFIRMED'
          AND (
            s.distributor_id = $1 
            OR s.distributor_id IN (SELECT id FROM distributors WHERE code = (SELECT account_code FROM bank_distrip_accounts WHERE id = $1))
            OR s.distributor_id IN (SELECT account_code FROM bank_distrip_accounts WHERE id = $1)
            OR s.distributor_id IN (SELECT id FROM bank_distrip_accounts WHERE account_code = $1 OR id = $1)
          )
          AND s.split_date::text = $2
      ), 0) +
      COALESCE((
        SELECT SUM(t.inr_amount) 
        FROM transactions t 
        WHERE t.status = 'CONFIRMED'
          AND (
            t.distributor_id = $1 
            OR t.distributor_id IN (SELECT id FROM distributors WHERE code = (SELECT account_code FROM bank_distrip_accounts WHERE id = $1))
            OR t.distributor_id IN (SELECT account_code FROM bank_distrip_accounts WHERE id = $1)
            OR t.distributor_id IN (SELECT id FROM bank_distrip_accounts WHERE account_code = $1 OR id = $1)
          )
          AND t.transaction_date::text = $2 
          AND t.id NOT IN (SELECT transaction_id FROM distribution_splits)
      ), 0)
    ) as total_order
  `, [accountId, date]);

  return roundTo(Number(row?.total_order || 0), 3);
}

/**
 * Authoritative running balance recalculation for a Bank/Distributor account.
 * Re-evaluates every transaction in strict chronological sequence:
 * BAL(row) = BAL(previous row) + ORDER(row) + COM(row) - PAID(row)
 * with BAL(initial) = 0.
 * Automatically synchronizes ORDER from customer remittance splits and propagates to all subsequent transactions.
 */
export async function recalculateBankDistripBalances(accountId: string): Promise<void> {
  const today = getTodayDateString();
  // 1. Get all distinct dates for this account (including customer splits, direct txns, existing records, and today)
  const dates = await query(`
    SELECT DISTINCT d::text as record_date FROM (
      SELECT s.split_date::text as d 
      FROM distribution_splits s
      JOIN transactions t ON t.id = s.transaction_id
      WHERE t.status = 'CONFIRMED'
        AND (
          s.distributor_id = $1 
          OR s.distributor_id IN (SELECT id FROM distributors WHERE code = (SELECT account_code FROM bank_distrip_accounts WHERE id = $1))
          OR s.distributor_id IN (SELECT account_code FROM bank_distrip_accounts WHERE id = $1)
          OR s.distributor_id IN (SELECT id FROM bank_distrip_accounts WHERE account_code = $1 OR id = $1)
        )
      UNION
      SELECT t.transaction_date::text as d
      FROM transactions t
      WHERE t.status = 'CONFIRMED'
        AND (
          t.distributor_id = $1 
          OR t.distributor_id IN (SELECT id FROM distributors WHERE code = (SELECT account_code FROM bank_distrip_accounts WHERE id = $1))
          OR t.distributor_id IN (SELECT account_code FROM bank_distrip_accounts WHERE id = $1)
          OR t.distributor_id IN (SELECT id FROM bank_distrip_accounts WHERE account_code = $1 OR id = $1)
        )
        AND t.id NOT IN (SELECT transaction_id FROM distribution_splits)
      UNION
      SELECT record_date::text as d FROM bank_distrip_records WHERE account_id = $1
      UNION
      SELECT $2::text as d
    ) combined
    WHERE d IS NOT NULL AND d != ''
    ORDER BY record_date ASC
  `, [accountId, today]);

  let runningBal = 0;
  for (const { record_date } of dates) {
    if (!record_date) continue;
    const order = await getDistributorOrderForDate(accountId, record_date);
    const existing = await queryOne(`
      SELECT id, commission_inr, paid_inr, balance_inr, order_inr
      FROM bank_distrip_records
      WHERE account_id = $1 AND record_date::text = $2
      LIMIT 1
    `, [accountId, record_date]);

    const com = Number(existing?.commission_inr || 0);
    const paid = Number(existing?.paid_inr || 0);
    // Formula from Excel: Balance = Previous Balance + Order + Commission - Paid
    runningBal = roundTo(runningBal + order + com - paid, 3);

    if (existing) {
      if (Number(existing.order_inr) !== order || Number(existing.balance_inr) !== runningBal) {
        await execute(`
          UPDATE bank_distrip_records
          SET order_inr = $1, balance_inr = $2
          WHERE id = $3
        `, [order, runningBal, existing.id]);
      }
    } else {
      await execute(`
        INSERT INTO bank_distrip_records (id, record_date, account_id, order_inr, commission_inr, paid_inr, balance_inr)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [crypto.randomUUID(), record_date, accountId, order, com, paid, runningBal]);
    }
  }
}

export async function listBankDistripRecords(
  accountId?: string,
  sortOrder: "asc" | "desc" = "asc"
): Promise<BankDistripRecord[]> {
  let sql = `
    SELECT r.*, a.account_code, a.account_name
    FROM bank_distrip_records r
    JOIN bank_distrip_accounts a ON a.id = r.account_id
  `;
  const params: any[] = [];
  if (accountId) {
    params.push(accountId);
    sql += ` WHERE r.account_id = $${params.length}`;
  }
  const orderDir = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";
  sql += ` ORDER BY r.record_date ${orderDir}, r.created_at ${orderDir}, r.id ${orderDir}`;

  const rows = await query(sql, params);
  return rows.map(mapBankDistripRecord);
}

export async function saveBankDistributionEntry(data: {
  account_id: string;
  record_date: string;
  commission_inr: number;
  paid_inr: number;
  notes?: string;
}): Promise<void> {
  const accountId = data.account_id;
  const recordDate = data.record_date;
  const com = roundTo(Number(data.commission_inr || 0), 3);
  const paid = roundTo(Number(data.paid_inr || 0), 3);
  const notes = data.notes?.trim() || null;

  // Retrieve automatic order from allocations / splits
  const order = await getDistributorOrderForDate(accountId, recordDate);

  const existing = await queryOne(`
    SELECT id FROM bank_distrip_records
    WHERE account_id = $1 AND record_date = $2
    LIMIT 1
  `, [accountId, recordDate]);

  if (existing) {
    await execute(`
      UPDATE bank_distrip_records
      SET commission_inr = $1, paid_inr = $2, notes = $3, order_inr = $4
      WHERE id = $5
    `, [com, paid, notes, order, existing.id]);
  } else {
    await execute(`
      INSERT INTO bank_distrip_records (id, record_date, account_id, order_inr, commission_inr, paid_inr, balance_inr, notes)
      VALUES ($1, $2, $3, $4, $5, $6, 0, $7)
    `, [crypto.randomUUID(), recordDate, accountId, order, com, paid, notes]);
  }

  // Recalculate this account's running balance
  await recalculateBankDistripBalances(accountId);
  invalidateBankDistripCache();
}

export async function createBankDistripRecord(data: {
  record_date: string;
  account_id: string;
  order_inr?: number;
  commission_inr?: number;
  paid_inr?: number;
  notes?: string;
}): Promise<BankDistripRecord> {
  await saveBankDistributionEntry({
    account_id: data.account_id,
    record_date: data.record_date,
    commission_inr: data.commission_inr || 0,
    paid_inr: data.paid_inr || 0,
    notes: data.notes,
  });

  const record = await queryOne(`
    SELECT r.*, a.account_code, a.account_name
    FROM bank_distrip_records r
    JOIN bank_distrip_accounts a ON a.id = r.account_id
    WHERE r.account_id = $1 AND r.record_date = $2
    LIMIT 1
  `, [data.account_id, data.record_date]);

  return mapBankDistripRecord(record);
}

// ---------------- BANK DISTRIP SETTLEMENT ----------------

export async function getBankDistributionSettlement(
  accountId?: string,
  options?: { from?: string; to?: string; sortOrder?: "asc" | "desc" }
): Promise<{
  accounts: (BankDistripAccountRecord & {
    total_order: number;
    total_commission: number;
    total_paid: number;
    closing_balance: number;
    record_count: number;
  })[];
  activeAccount: (BankDistripAccountRecord & {
    total_order: number;
    total_commission: number;
    total_paid: number;
    closing_balance: number;
    record_count: number;
  }) | null;
  records: BankDistripRecord[];
  totals: {
    total_order: number;
    total_commission: number;
    total_paid: number;
    closing_balance: number;
    record_count: number;
  };
  grandTotals: {
    grand_order: number;
    grand_commission: number;
    grand_paid: number;
    grand_balance: number;
    distributor_summaries: {
      account_id: string;
      account_code: string;
      account_name: string;
      total_order: number;
      total_commission: number;
      total_paid: number;
      closing_balance: number;
      record_count: number;
    }[];
  };
}> {
  const cacheKey = `${accountId || "DEFAULT"}_${options?.from || ""}_${options?.to || ""}_${options?.sortOrder || "asc"}`;
  const now = Date.now();
  if (cacheStore.bankDistrip && (now - cacheStore.bankDistrip.timestamp < 30000)) {
    const cached = cacheStore.bankDistrip.data.get(cacheKey);
    if (cached) return cached;
  }

  // 1. Single query for all accounts with aggregated metrics AND closing balance
  const accountsSql = `
    SELECT 
      a.id, a.account_code, a.account_name, a.bank_name, a.account_number, a.status, a.created_at,
      COALESCE(SUM(r.order_inr), 0) as total_order,
      COALESCE(SUM(r.commission_inr), 0) as total_commission,
      COALESCE(SUM(r.paid_inr), 0) as total_paid,
      COUNT(r.id)::int as record_count,
      COALESCE((
        SELECT r2.balance_inr 
        FROM bank_distrip_records r2 
        WHERE r2.account_id = a.id 
        ORDER BY r2.record_date DESC, r2.created_at DESC, r2.id DESC 
        LIMIT 1
      ), 0) as closing_balance
    FROM bank_distrip_accounts a
    LEFT JOIN bank_distrip_records r ON r.account_id = a.id
    GROUP BY a.id, a.account_code, a.account_name, a.bank_name, a.account_number, a.status, a.created_at
    ORDER BY 
      CASE 
        WHEN a.account_code = 'MK' THEN 1
        WHEN a.account_code = 'SALA' THEN 2
        WHEN a.account_code = 'USAIN' OR a.account_code = 'SARABU' THEN 3
        WHEN a.account_code = 'ISMAIL' THEN 4
        WHEN a.account_code = 'NNG' THEN 5
        WHEN a.account_code = 'BLACK GRP' THEN 6
        WHEN a.account_code = 'TALLY' THEN 7
        ELSE 8
      END,
      a.account_name ASC
  `;

  // 2. Query for chronological records of requested account (or default to MK / first account)
  let recordsSql = `
    SELECT r.*, a.account_code, a.account_name
    FROM bank_distrip_records r
    JOIN bank_distrip_accounts a ON a.id = r.account_id
  `;
  const recordsParams: any[] = [];
  if (accountId) {
    recordsParams.push(accountId);
    recordsSql += ` WHERE r.account_id = $${recordsParams.length}`;
  } else {
    recordsSql += ` WHERE r.account_id = (
      SELECT id FROM bank_distrip_accounts 
      ORDER BY CASE WHEN account_code = 'MK' THEN 1 ELSE 2 END, account_name LIMIT 1
    )`;
  }

  if (options?.from) {
    recordsParams.push(options.from);
    recordsSql += ` AND r.record_date >= $${recordsParams.length}`;
  }
  if (options?.to) {
    recordsParams.push(options.to);
    recordsSql += ` AND r.record_date <= $${recordsParams.length}`;
  }

  const sortDirection = options?.sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";
  recordsSql += ` ORDER BY r.record_date ${sortDirection}, r.created_at ${sortDirection}, r.id ${sortDirection}`;

  // Execute both queries in parallel with Promise.all
  const [accountsData, recordsRows] = await Promise.all([
    query(accountsSql),
    query(recordsSql, recordsParams),
  ]);

  const distributorSummaries: any[] = [];
  let grandOrder = 0;
  let grandCom = 0;
  let grandPaid = 0;
  let grandBal = 0;

  const accountsWithTotals: any[] = [];

  for (const acc of accountsData) {
    const total_order = roundTo(Number(acc.total_order || 0), 3);
    const total_commission = roundTo(Number(acc.total_commission || 0), 3);
    const total_paid = roundTo(Number(acc.total_paid || 0), 3);
    const closing_balance = roundTo(Number(acc.closing_balance || 0), 3);

    grandOrder += total_order;
    grandCom += total_commission;
    grandPaid += total_paid;
    grandBal += closing_balance;

    const summaryItem = {
      account_id: acc.id,
      account_code: acc.account_code,
      account_name: acc.account_name,
      total_order,
      total_commission,
      total_paid,
      closing_balance,
      record_count: Number(acc.record_count || 0),
    };

    distributorSummaries.push(summaryItem);

    accountsWithTotals.push({
      id: acc.id,
      account_code: acc.account_code,
      account_name: acc.account_name,
      bank_name: acc.bank_name,
      account_number: acc.account_number,
      status: acc.status,
      current_balance: closing_balance,
      total_order,
      total_commission,
      total_paid,
      closing_balance,
      record_count: Number(acc.record_count || 0),
      created_at: formatDateTime(acc.created_at),
    });
  }

  // Determine active account
  let targetAccountId = accountId;
  if (!targetAccountId || !accountsWithTotals.some(a => a.id === targetAccountId)) {
    targetAccountId = accountsWithTotals[0]?.id || "dist-mk";
  }

  const activeAccount = accountsWithTotals.find(a => a.id === targetAccountId) || null;
  const mappedRecords = recordsRows.map(mapBankDistripRecord);

  const activeTotals = activeAccount ? {
    total_order: activeAccount.total_order,
    total_commission: activeAccount.total_commission,
    total_paid: activeAccount.total_paid,
    closing_balance: activeAccount.closing_balance,
    record_count: activeAccount.record_count,
  } : {
    total_order: 0,
    total_commission: 0,
    total_paid: 0,
    closing_balance: 0,
    record_count: 0,
  };

  const result = {
    accounts: accountsWithTotals,
    activeAccount,
    records: mappedRecords,
    totals: activeTotals,
    grandTotals: {
      grand_order: roundTo(grandOrder, 3),
      grand_commission: roundTo(grandCom, 3),
      grand_paid: roundTo(grandPaid, 3),
      grand_balance: roundTo(grandBal, 3),
      distributor_summaries: distributorSummaries,
    },
  };

  if (!cacheStore.bankDistrip || (now - cacheStore.bankDistrip.timestamp >= 30000)) {
    cacheStore.bankDistrip = {
      timestamp: now,
      data: new Map(),
    };
  }
  cacheStore.bankDistrip.data.set(cacheKey, result);

  return result;
}

// ---------------- DASHBOARD KPIS ----------------
export async function getDashboardKPIs(filters?: { from?: string; to?: string; timeframe?: string }) {
  const cacheKey = `${filters?.from || ""}_${filters?.to || ""}_${filters?.timeframe || ""}`;
  const now = Date.now();
  if (cacheStore.dashboardKpi && cacheStore.dashboardKpi.key === cacheKey && (now - cacheStore.dashboardKpi.timestamp < 30000)) {
    return cacheStore.dashboardKpi.data;
  }

  let txnWhere = "WHERE status = 'CONFIRMED'";
  let payWhere = "WHERE 1=1";
  const txnParams: any[] = [];
  const payParams: any[] = [];

  if (filters?.from) {
    txnParams.push(filters.from);
    txnWhere += ` AND transaction_date >= $${txnParams.length}`;
    payParams.push(filters.from);
    payWhere += ` AND payment_date >= $${payParams.length}`;
  }
  if (filters?.to) {
    txnParams.push(filters.to);
    txnWhere += ` AND transaction_date <= $${txnParams.length}`;
    payParams.push(filters.to);
    payWhere += ` AND payment_date <= $${payParams.length}`;
  }

  // Run all independent queries in parallel via Promise.all
  const todayStr = getTodayDateString();
  const [
    todaySummary,
    txnSummary,
    paySummary,
    custReceivables,
    distPending,
    bankPending,
    dailyTrends,
  ] = await Promise.all([
    queryOne(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(inr_amount), 0) as total_inr,
        COALESCE(SUM(aed_amount), 0) as total_aed,
        COALESCE(SUM(net_profit_aed), 0) as net_profit
      FROM transactions
      WHERE status = 'CONFIRMED' AND transaction_date = $1
    `, [todayStr]),

    queryOne(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(inr_amount), 0) as total_inr,
        COALESCE(SUM(aed_amount), 0) as total_aed,
        COALESCE(SUM(gross_profit_aed), 0) as gross_profit,
        COALESCE(SUM(delivery_charge_aed), 0) as delivery_charges,
        COALESCE(SUM(net_profit_aed), 0) as net_profit
      FROM transactions
      ${txnWhere}
    `, txnParams),

    queryOne(`
      SELECT COALESCE(SUM(amount_aed), 0) as total_collected
      FROM customer_payments
      ${payWhere}
    `, payParams),

    queryOne(`
      SELECT 
        COALESCE((SELECT SUM(aed_amount) FROM transactions WHERE status = 'CONFIRMED'), 0) - 
        COALESCE((SELECT SUM(amount_aed) FROM customer_payments), 0) as outstanding,
        COALESCE((
          SELECT SUM(t.aed_amount) 
          FROM transactions t 
          JOIN customers c ON c.id = t.customer_id 
          WHERE t.status = 'CONFIRMED' AND COALESCE(c.entity_type, 'CUSTOMER') = 'CUSTOMER'
        ), 0) - 
        COALESCE((
          SELECT SUM(cp.amount_aed) 
          FROM customer_payments cp 
          JOIN customers c ON c.id = cp.customer_id 
          WHERE COALESCE(c.entity_type, 'CUSTOMER') = 'CUSTOMER'
        ), 0) as customer_outstanding,
        COALESCE((
          SELECT SUM(t.aed_amount) 
          FROM transactions t 
          JOIN customers c ON c.id = t.customer_id 
          WHERE t.status = 'CONFIRMED' AND c.entity_type = 'PARTY'
        ), 0) - 
        COALESCE((
          SELECT SUM(cp.amount_aed) 
          FROM customer_payments cp 
          JOIN customers c ON c.id = cp.customer_id 
          WHERE c.entity_type = 'PARTY'
        ), 0) as party_due_pending,
        COALESCE((
          SELECT SUM(cp.amount_aed) 
          FROM customer_payments cp 
          JOIN customers c ON c.id = cp.customer_id 
          WHERE c.entity_type = 'PARTY'
        ), 0) as party_paid
    `),

    queryOne(`
      SELECT 
        COALESCE((SELECT SUM(inr_amount) FROM transactions WHERE status = 'CONFIRMED'), 0) - 
        COALESCE((SELECT SUM(inr_amount) FROM distribution_splits), 0) as pending_inr
    `),

    queryOne(`
      SELECT COALESCE(SUM(current_balance), 0) as bank_pending_inr
      FROM (
        SELECT DISTINCT ON (account_id) balance_inr as current_balance
        FROM bank_distrip_records
        ORDER BY account_id, record_date DESC, created_at DESC
      ) latest_balances
    `),

    query(`
      SELECT 
        transaction_date as date,
        SUM(inr_amount) as inr_volume,
        SUM(aed_amount) as aed_volume,
        SUM(net_profit_aed) as net_profit,
        COUNT(*) as txn_count
      FROM transactions
      ${txnWhere}
      GROUP BY transaction_date
      ORDER BY transaction_date ASC
    `, txnParams),
  ]);

  const result = {
    kpis: {
      // Primary Cards
      todayInr: roundTo(Number(todaySummary?.total_inr || 0), 3),
      todayAed: roundTo(Number(todaySummary?.total_aed || 0), 3),
      todayTxnCount: Number(todaySummary?.count || 0),
      todayProfit: roundTo(Number(todaySummary?.net_profit || 0), 3),

      // Filtered Range Cards
      totalInrProcessed: roundTo(Number(txnSummary?.total_inr || 0), 3),
      totalAedCharged: roundTo(Number(txnSummary?.total_aed || 0), 3),
      totalAedCollected: roundTo(Number(paySummary?.total_collected || 0), 3),
      grossProfitAed: roundTo(Number(txnSummary?.gross_profit || 0), 3),
      deliveryChargesAed: roundTo(Number(txnSummary?.delivery_charges || 0), 3),
      netProfitAed: roundTo(Number(txnSummary?.net_profit || 0), 3),
      transactionCount: Number(txnSummary?.count || 0),

      // Secondary Global Cards
      outstandingReceivablesAed: roundTo(Number(custReceivables?.customer_outstanding ?? custReceivables?.outstanding ?? 0), 3),
      partyTransfersDueAed: roundTo(Math.max(0, Number(custReceivables?.party_due_pending || 0)), 3),
      partyTransfersPaidAed: roundTo(Number(custReceivables?.party_paid || 0), 3),
      indiaDistributionPendingInr: roundTo(Math.max(0, Number(distPending?.pending_inr || 0)), 3),
      bankDistributionPendingInr: roundTo(Number(bankPending?.bank_pending_inr || 0), 3),
    },
    dailyTrends: dailyTrends.map(d => ({
      date: formatDate(d.date),
      inrVolume: roundTo(Number(d.inr_volume || 0), 3),
      aedVolume: roundTo(Number(d.aed_volume || 0), 3),
      netProfit: roundTo(Number(d.net_profit || 0), 3),
      count: Number(d.txn_count || 0),
    }))
  };

  cacheStore.dashboardKpi = {
    timestamp: now,
    key: cacheKey,
    data: result,
  };

  return result;
}

export async function getAuditLogs(entityName: string, entityId: string): Promise<any[]> {
  return await query(`
    SELECT * FROM audit_logs 
    WHERE entity_id = $1 AND entity_name = $2
    ORDER BY created_at DESC
  `, [entityId, entityName]);
}

export async function getDailySummaryReport(): Promise<any[]> {
  return await query(`
    SELECT 
      transaction_date as date,
      COUNT(*) as count,
      SUM(inr_amount) as total_inr,
      SUM(aed_amount) as total_aed,
      SUM(net_profit_aed) as net_profit
    FROM transactions
    WHERE status = 'CONFIRMED'
    GROUP BY transaction_date
    ORDER BY transaction_date DESC
  `);
}

// ---------------- EDIT & DELETE CAPABILITIES ----------------

export async function updateTransaction(id: string, data: {
  transaction_date?: string;
  customer_id?: string;
  inr_amount?: number;
  total?: number;
  customer_rate?: number;
  manual_rate?: number;
  base_rate?: number;
  paid_amount?: number;
  paid_aed?: number;
  delivery_charge_pct?: number;
  delivery_charge_aed?: number;
  notes?: string;
  reason?: string;
  splits?: Array<{
    id?: string;
    distributor_id: string;
    inr_amount: number;
    notes?: string;
  }>;
}): Promise<TransactionRecord> {
  const existing = await getTransaction(id);
  if (!existing) throw new Error("Transaction not found");

  const total = Number(data.total ?? data.inr_amount ?? existing.inr_amount);
  const manualRate = Number(data.manual_rate ?? data.customer_rate ?? existing.customer_rate);
  const transactionDate = data.transaction_date ?? existing.transaction_date;
  const customerId = data.customer_id ?? existing.customer_id;
  const notes = data.notes !== undefined ? data.notes : existing.notes;

  // Validate splits if INR amount changed and splits are not explicitly being replaced
  if (!data.splits) {
    const currentSplits = await listDistributionSplits({ transaction_id: id });
    const totalSplitsInr = currentSplits.reduce((sum, s) => sum + s.inr_amount, 0);
    if (total < totalSplitsInr) {
      throw new Error(`New order amount (₹${total.toLocaleString()}) cannot be less than already allocated splits (₹${totalSplitsInr.toLocaleString()}). Adjust splits first.`);
    }
  }

  let inrAmount = total;
  let customerRate = manualRate;
  let baseRate = 0;
  let aedAmount = 0;
  let costAed = 0;
  let grossProfitAed = 0;
  let deliveryPct = 0;
  let deliveryChargeAed = 0;
  let netProfitAed = 0;

  if (data.base_rate !== undefined) {
    const calc = calculateTransaction({
      inrAmount: total,
      customerRate: manualRate,
      baseRate: Number(data.base_rate),
      deliveryChargePct: data.delivery_charge_pct !== undefined ? data.delivery_charge_pct : existing.delivery_charge_pct,
      deliveryChargeAed: data.delivery_charge_aed !== undefined ? data.delivery_charge_aed : existing.delivery_charge_aed,
    });
    inrAmount = calc.inrAmount;
    customerRate = calc.customerRate;
    baseRate = calc.baseRate;
    aedAmount = calc.aedAmount;
    costAed = calc.costAed;
    grossProfitAed = calc.grossProfitAed;
    deliveryPct = calc.deliveryChargePct;
    deliveryChargeAed = calc.deliveryChargeAed;
    netProfitAed = calc.netProfitAed;
  } else {
    const dubaiCalc = calculateDubaiClientTransfer({
      total,
      manualRate,
      paidAmount: Number(data.paid_amount ?? data.paid_aed ?? existing.paid_aed ?? 0),
    });
    inrAmount = dubaiCalc.total;
    customerRate = dubaiCalc.manualRate;
    baseRate = dubaiCalc.wholesaleRate;
    aedAmount = dubaiCalc.inDhirams;
    costAed = dubaiCalc.inDhirams;
    grossProfitAed = 0;
    deliveryPct = 0;
    deliveryChargeAed = 0;
    netProfitAed = 0;
  }

  await execute(`
    UPDATE transactions
    SET transaction_date = $1, customer_id = $2, inr_amount = $3,
        customer_rate = $4, aed_amount = $5, base_rate = $6,
        cost_aed = $7, gross_profit_aed = $8, delivery_charge_pct = $9,
        delivery_charge_aed = $10, net_profit_aed = $11, notes = $12,
        updated_at = NOW()
    WHERE id = $13
  `, [
    transactionDate, customerId, inrAmount,
    customerRate, aedAmount, baseRate,
    costAed, grossProfitAed, deliveryPct,
    deliveryChargeAed, netProfitAed, notes || null,
    id
  ]);

  if (data.paid_amount !== undefined || data.paid_aed !== undefined) {
    const newPaid = Number(data.paid_amount ?? data.paid_aed ?? 0);
    const existingPmt = await queryOne(`SELECT id FROM customer_payments WHERE transaction_id = $1 LIMIT 1`, [id]);
    if (existingPmt) {
      if (newPaid > 0) {
        await execute(`UPDATE customer_payments SET amount_aed = $1, payment_date = $2, customer_id = $3 WHERE id = $4`, [newPaid, transactionDate, customerId, existingPmt.id]);
      } else {
        await execute(`DELETE FROM customer_payments WHERE id = $1`, [existingPmt.id]);
      }
    } else if (newPaid > 0) {
      const pmtId = crypto.randomUUID();
      const pmtNumber = `PMT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      await execute(`
        INSERT INTO customer_payments (
          id, payment_number, payment_date, customer_id, transaction_id,
          amount_aed, payment_method, notes, is_demo
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, 'CASH', 'Payment recorded on update', false
        )
      `, [pmtId, pmtNumber, transactionDate, customerId, id, newPaid]);
    }
  }

  // Update/re-allocate splits if provided
  if (data.splits && data.splits.length > 0) {
    const rawSum = data.splits.reduce((sum, s) => sum + Number(s.inr_amount), 0);
    const splitDiff = Math.round((inrAmount - rawSum + Number.EPSILON) * 1000) / 1000;
    if (splitDiff < -1.00) {
      throw new Error(`Total distribution (₹${rawSum.toLocaleString()}) cannot exceed customer order (₹${inrAmount.toLocaleString()})`);
    }

    const splitsToInsert = [...data.splits];
    if (Math.abs(splitDiff) > 0 && Math.abs(splitDiff) <= 1.00 && splitsToInsert.length > 0) {
      const lastIdx = splitsToInsert.length - 1;
      const lastAmt = roundTo(Number(splitsToInsert[lastIdx].inr_amount) + splitDiff, 3);
      splitsToInsert[lastIdx] = {
        ...splitsToInsert[lastIdx],
        inr_amount: lastAmt,
      };
    }

    await execute(`DELETE FROM distribution_splits WHERE transaction_id = $1`, [id]);
    for (const s of splitsToInsert) {
      const splitId = s.id && !s.id.startsWith("new-") ? s.id : crypto.randomUUID();
      const aedEq = baseRate > 0 ? roundTo(s.inr_amount / baseRate, 3) : 0;
      await execute(`
        INSERT INTO distribution_splits (
          id, transaction_id, distributor_id, split_date,
          inr_amount, wholesale_rate, aed_equivalent, paid_amount_inr,
          balance_inr, status, notes
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, 0.00,
          $5, 'ALLOCATED', $8
        )
      `, [
        splitId, id, s.distributor_id, transactionDate,
        roundTo(s.inr_amount, 3), baseRate, aedEq, s.notes || null
      ]);
    }

    const distIds = [...new Set(data.splits.map(s => s.distributor_id))];
    for (const did of distIds) {
      await recalculateBankDistripBalances(did).catch(err => console.error("Error updating bank distrip on txn update:", err));
    }
  }

  // Log audit
  await execute(`
    INSERT INTO audit_logs (id, entity_name, entity_id, action, old_values, new_values, reason)
    VALUES ($1, 'TRANSACTION', $2, 'UPDATE', $3, $4, $5)
  `, [
    crypto.randomUUID(), id, JSON.stringify(existing), JSON.stringify({ inrAmount, customerRate, baseRate, aedAmount }),
    data.reason || "User updated transaction"
  ]);

  invalidatePartyTransfersCache();
  return (await getTransaction(id))!;
}

export async function deleteTransaction(id: string): Promise<void> {
  const existing = await getTransaction(id);
  if (!existing) throw new Error("Transaction not found");

  const splits = await query(`SELECT DISTINCT distributor_id FROM distribution_splits WHERE transaction_id = $1`, [id]);
  await execute(`DELETE FROM distribution_splits WHERE transaction_id = $1`, [id]);
  await execute(`UPDATE customer_payments SET transaction_id = NULL WHERE transaction_id = $1`, [id]);
  await execute(`DELETE FROM audit_logs WHERE entity_id = $1`, [id]);
  await execute(`DELETE FROM transactions WHERE id = $1`, [id]);
  invalidatePartyTransfersCache();

  for (const s of splits) {
    if (s.distributor_id) {
      await recalculateBankDistripBalances(s.distributor_id).catch(err => console.error("Error updating bank distrip on delete:", err));
    }
  }
  if (existing.distributor_id) {
    await recalculateBankDistripBalances(existing.distributor_id).catch(err => console.error("Error updating bank distrip on delete:", err));
  }
}

export async function updateCustomer(id: string, data: {
  name?: string;
  code?: string;
  phone?: string;
  default_rate?: number;
  status?: string;
  party_type?: "DUBAI" | "INDIA" | string;
}): Promise<Customer> {
  const existing = await getCustomer(id);
  if (!existing) throw new Error("Customer not found");

  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const code = data.code !== undefined ? data.code.trim() : existing.code;
  const phone = data.phone !== undefined ? data.phone.trim() : existing.phone;
  const defaultRate = data.default_rate !== undefined ? data.default_rate : existing.default_rate;
  const status = data.status !== undefined ? data.status : existing.status;
  const partyType = data.party_type !== undefined ? data.party_type : existing.party_type;

  await execute(`
    UPDATE customers
    SET name = $1, code = $2, phone = $3, default_rate = $4, status = $5, party_type = $6, updated_at = NOW()
    WHERE id = $7
  `, [name, code, phone || null, defaultRate || 38.25, status, partyType || null, id]);

  invalidatePartyTransfersCache();
  return (await getCustomer(id))!;
}

export async function deleteCustomer(id: string): Promise<void> {
  const txns = await query(`SELECT id FROM transactions WHERE customer_id = $1`, [id]);
  if (txns.length > 0) {
    throw new Error(`Cannot delete customer who has ${txns.length} active transactions. Delete or void their transactions first.`);
  }
  await execute(`DELETE FROM customer_payments WHERE customer_id = $1`, [id]);
  await execute(`DELETE FROM customers WHERE id = $1`, [id]);
  invalidatePartyTransfersCache();
}

export async function deleteCustomerPayment(id: string): Promise<void> {
  await execute(`DELETE FROM customer_payments WHERE id = $1`, [id]);
  invalidatePartyTransfersCache();
}

export async function updateDistributionSplit(id: string, data: {
  distributor_id?: string;
  split_date?: string;
  inr_amount?: number;
  wholesale_rate?: number;
  notes?: string;
}): Promise<DistributionSplitRecord> {
  const existingSplit = await queryOne(`SELECT * FROM distribution_splits WHERE id = $1`, [id]);
  if (!existingSplit) throw new Error("Split not found");

  const txn = await getTransaction(existingSplit.transaction_id);
  if (!txn) throw new Error("Parent transaction not found");

  const newInr = data.inr_amount !== undefined ? Number(data.inr_amount) : Number(existingSplit.inr_amount);
  const distId = data.distributor_id || existingSplit.distributor_id;
  const splitDate = data.split_date || existingSplit.split_date;
  const wholesaleRate = data.wholesale_rate !== undefined ? data.wholesale_rate : (existingSplit.wholesale_rate || txn.base_rate);
  const notes = data.notes !== undefined ? data.notes : existingSplit.notes;

  const allSplits = await listDistributionSplits({ transaction_id: txn.id });
  const otherSplitsTotal = allSplits
    .filter(s => s.id !== id)
    .reduce((sum, s) => sum + s.inr_amount, 0);

  if (otherSplitsTotal + newInr > txn.inr_amount) {
    const maxAllowed = txn.inr_amount - otherSplitsTotal;
    throw new Error(`New split amount (₹${newInr.toLocaleString()}) exceeds available unallocated order balance (₹${maxAllowed.toLocaleString()}).`);
  }

  const aedEq = wholesaleRate ? roundTo(newInr / wholesaleRate, 3) : 0;
  const paidInr = Number(existingSplit.paid_amount_inr || 0);
  const balanceInr = roundTo(newInr - paidInr, 3);

  await execute(`
    UPDATE distribution_splits
    SET distributor_id = $1, split_date = $2, inr_amount = $3,
        wholesale_rate = $4, aed_equivalent = $5, balance_inr = $6, notes = $7
    WHERE id = $8
  `, [
    distId, splitDate, roundTo(newInr, 3),
    wholesaleRate, aedEq, balanceInr, notes || null,
    id
  ]);

  await recalculateBankDistripBalances(distId).catch(err => console.error("Error updating bank distrip on split update:", err));
  if (existingSplit.distributor_id !== distId) {
    await recalculateBankDistripBalances(existingSplit.distributor_id).catch(err => console.error("Error updating bank distrip on split update:", err));
  }

  invalidateAllCaches();
  const updatedRows = await listDistributionSplits({ transaction_id: txn.id });
  return updatedRows.find(s => s.id === id)!;
}

export async function deleteBankDistripRecord(id: string): Promise<void> {
  const existing = await queryOne(`SELECT account_id FROM bank_distrip_records WHERE id = $1`, [id]);
  if (!existing) return;

  await execute(`DELETE FROM bank_distrip_records WHERE id = $1`, [id]);
  // Recalculate all remaining records for this account so subsequent running balances are accurate
  await recalculateBankDistripBalances(existing.account_id);
  invalidateBankDistripCache();
}

export async function updateBankDistripRecord(id: string, data: {
  record_date?: string;
  account_id?: string;
  order_inr?: number;
  commission_inr?: number;
  paid_inr?: number;
  notes?: string;
}): Promise<BankDistripRecord> {
  const existing = await queryOne(`SELECT * FROM bank_distrip_records WHERE id = $1`, [id]);
  if (!existing) throw new Error("Record not found");

  const recordDate = data.record_date || existing.record_date;
  const accountId = data.account_id || existing.account_id;
  const orderInr = data.order_inr !== undefined ? Number(data.order_inr) : Number(existing.order_inr);
  const commissionInr = data.commission_inr !== undefined ? Number(data.commission_inr) : Number(existing.commission_inr);
  const paidInr = data.paid_inr !== undefined ? Number(data.paid_inr) : Number(existing.paid_inr);
  const notes = data.notes !== undefined ? data.notes : existing.notes;

  await execute(`
    UPDATE bank_distrip_records
    SET record_date = $1, account_id = $2, order_inr = $3, commission_inr = $4,
        paid_inr = $5, notes = $6
    WHERE id = $7
  `, [recordDate, accountId, orderInr, commissionInr, paidInr, notes || null, id]);

  // Recalculate this account and any previous account if changed
  await recalculateBankDistripBalances(accountId);
  if (existing.account_id !== accountId) {
    await recalculateBankDistripBalances(existing.account_id);
  }
  invalidateBankDistripCache();

  const updated = await queryOne(`
    SELECT r.*, a.account_code, a.account_name
    FROM bank_distrip_records r
    JOIN bank_distrip_accounts a ON a.id = r.account_id
    WHERE r.id = $1
  `, [id]);

  return mapBankDistripRecord(updated);
}
