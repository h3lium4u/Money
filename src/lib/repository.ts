import { query, queryOne, execute } from "@/lib/db";
import { calculateTransaction, roundTo } from "@/lib/calculations";
import crypto from "node:crypto";

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  default_rate?: number | null;
  status: string;
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
  inr_amount: number;
  customer_rate: number;
  aed_amount: number;
  base_rate: number;
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
  pending_aed?: number;
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
  const totalInr = roundTo(Number(r.total_inr || 0), 2);
  const totalAed = roundTo(Number(r.total_aed || 0), 2);
  const totalPaid = roundTo(Number(r.total_paid || 0), 2);
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    phone: r.phone || null,
    default_rate: r.default_rate != null ? Number(r.default_rate) : null,
    status: r.status,
    total_inr: totalInr,
    total_aed: totalAed,
    total_paid: totalPaid,
    outstanding_balance: roundTo(totalAed - totalPaid, 2),
    created_at: formatDateTime(r.created_at),
  };
}

function mapTransactionRecord(r: any): TransactionRecord {
  const inrAmount = roundTo(Number(r.inr_amount), 2);
  const aedAmount = roundTo(Number(r.aed_amount), 2);
  const distributedInr = roundTo(Number(r.total_distributed_inr || 0), 2);
  const remainingInr = roundTo(Math.max(0, inrAmount - distributedInr), 2);
  const paidAed = roundTo(Number(r.paid_aed || 0), 2);
  const pendingAed = roundTo(Math.max(0, aedAmount - paidAed), 2);

  return {
    id: r.id,
    transaction_number: r.transaction_number,
    transaction_date: formatDate(r.transaction_date),
    customer_id: r.customer_id,
    customer_code: r.customer_code || null,
    customer_name: r.customer_name,
    inr_amount: inrAmount,
    customer_rate: roundTo(Number(r.customer_rate), 4),
    aed_amount: aedAmount,
    base_rate: roundTo(Number(r.base_rate), 4),
    cost_aed: roundTo(Number(r.cost_aed), 2),
    gross_profit_aed: roundTo(Number(r.gross_profit_aed), 2),
    delivery_charge_pct: Number(r.delivery_charge_pct),
    delivery_charge_aed: roundTo(Number(r.delivery_charge_aed), 2),
    net_profit_aed: roundTo(Number(r.net_profit_aed), 2),
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
    pending_aed: pendingAed,
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
    inr_amount: roundTo(Number(r.inr_amount || 0), 2),
    wholesale_rate: r.wholesale_rate != null ? Number(r.wholesale_rate) : null,
    aed_equivalent: r.aed_equivalent != null ? roundTo(Number(r.aed_equivalent), 2) : null,
    paid_amount_inr: roundTo(Number(r.paid_amount_inr || 0), 2),
    balance_inr: roundTo(Number(r.balance_inr || 0), 2),
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
    order_inr: roundTo(Number(r.order_inr || 0), 2),
    commission_inr: roundTo(Number(r.commission_inr || 0), 2),
    paid_inr: roundTo(Number(r.paid_inr || 0), 2),
    balance_inr: roundTo(Number(r.balance_inr || 0), 2),
    notes: r.notes || null,
    created_at: formatDateTime(r.created_at),
  };
}

// ---------------- CUSTOMERS ----------------
export async function listCustomers(): Promise<Customer[]> {
  const rows = await query(`
    SELECT 
      c.*,
      COALESCE((SELECT SUM(t.inr_amount) FROM transactions t WHERE t.customer_id = c.id AND t.status = 'CONFIRMED'), 0) as total_inr,
      COALESCE((SELECT SUM(t.aed_amount) FROM transactions t WHERE t.customer_id = c.id AND t.status = 'CONFIRMED'), 0) as total_aed,
      COALESCE((SELECT SUM(p.amount_aed) FROM customer_payments p WHERE p.customer_id = c.id), 0) as total_paid
    FROM customers c
    ORDER BY c.name ASC
  `);

  return rows.map(mapCustomerRecord);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const r = await queryOne(`
    SELECT 
      c.*,
      COALESCE((SELECT SUM(t.inr_amount) FROM transactions t WHERE t.customer_id = c.id AND t.status = 'CONFIRMED'), 0) as total_inr,
      COALESCE((SELECT SUM(t.aed_amount) FROM transactions t WHERE t.customer_id = c.id AND t.status = 'CONFIRMED'), 0) as total_aed,
      COALESCE((SELECT SUM(p.amount_aed) FROM customer_payments p WHERE p.customer_id = c.id), 0) as total_paid
    FROM customers c
    WHERE c.id = $1 OR c.code = $2
  `, [id, id]);

  if (!r) return null;
  return mapCustomerRecord(r);
}

export async function createCustomer(data: { name: string; code?: string; phone?: string; default_rate?: number }): Promise<Customer> {
  const id = crypto.randomUUID();
  const code = (data.code || data.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)) + "-" + Math.floor(100 + Math.random() * 900);
  
  await execute(`
    INSERT INTO customers (id, code, name, phone, default_rate, status)
    VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
  `, [id, code, data.name.trim(), data.phone || null, data.default_rate || 38.25]);

  const created = await getCustomer(id);
  return created!;
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
}): Promise<TransactionRecord[]> {
  let sql = `
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

  sql += ` ORDER BY t.transaction_date DESC, t.created_at DESC`;

  if (filters?.limit) {
    params.push(filters.limit);
    sql += ` LIMIT $${params.length}`;
  }

  const rows = await query(sql, params);
  return rows.map(mapTransactionRecord);
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
  inr_amount: number;
  customer_rate: number;
  base_rate: number;
  delivery_charge_pct?: number;
  distributor_id?: string | null;
  notes?: string;
  splits?: Array<{
    distributor_id: string;
    inr_amount: number;
    notes?: string;
  }>;
}): Promise<TransactionRecord> {
  const id = crypto.randomUUID();
  const txnNumber = generateTransactionNumber();

  // Authoritative calculations on server:
  const calc = calculateTransaction({
    inrAmount: data.inr_amount,
    customerRate: data.customer_rate,
    baseRate: data.base_rate,
    deliveryChargePct: data.delivery_charge_pct,
  });

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
    calc.inrAmount, calc.customerRate, calc.aedAmount, calc.baseRate,
    calc.costAed, calc.grossProfitAed, calc.deliveryChargePct, calc.deliveryChargeAed,
    calc.netProfitAed, data.distributor_id || null, data.notes || null
  ]);

  // Insert initial splits if provided
  if (data.splits && data.splits.length > 0) {
    let totalSplitInr = 0;
    for (const s of data.splits) {
      totalSplitInr += Number(s.inr_amount);
      if (totalSplitInr > calc.inrAmount) {
        throw new Error(`Total distribution (₹${totalSplitInr.toLocaleString()}) cannot exceed customer order (₹${calc.inrAmount.toLocaleString()})`);
      }
      const splitId = crypto.randomUUID();
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
        splitId, id, s.distributor_id, data.transaction_date,
        s.inr_amount, calc.baseRate, roundTo(s.inr_amount / calc.baseRate, 2), s.notes || null
      ]);
    }
  }

  // Record audit log
  await execute(`
    INSERT INTO audit_logs (id, entity_name, entity_id, action, new_values, reason)
    VALUES ($1, 'TRANSACTION', $2, 'CREATE', $3, 'Initial transaction creation')
  `, [crypto.randomUUID(), id, JSON.stringify(calc)]);

  const created = await getTransaction(id);
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

  const updated = await getTransaction(id);
  return updated!;
}

// ---------------- INDIA DISTRIBUTION SPLITS ----------------
export async function listDistributionSplits(filters?: {
  transaction_id?: string;
  distributor_id?: string;
  from?: string;
  to?: string;
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

  const rows = await query(sql, params);
  return rows.map(mapDistributionSplitRecord);
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
  const aedEq = wholesaleRate ? roundTo(data.inr_amount / wholesaleRate, 2) : 0;

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
    roundTo(data.inr_amount, 2), wholesaleRate, aedEq, data.notes || null
  ]);

  const rows = await listDistributionSplits({ transaction_id: data.transaction_id });
  return rows.find(r => r.id === id)!;
}

export async function deleteDistributionSplit(id: string): Promise<void> {
  await execute(`DELETE FROM distribution_splits WHERE id = $1`, [id]);
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
  const id = crypto.randomUUID();
  const paymentNumber = `PAY-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  await execute(`
    INSERT INTO customer_payments (
      id, payment_number, payment_date, customer_id, transaction_id,
      amount_aed, payment_method, reference_number, notes, is_demo
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
  `, [
    id, paymentNumber, data.payment_date, data.customer_id, data.transaction_id || null,
    roundTo(data.amount_aed, 2), data.payment_method || 'CASH', data.reference_number || null, data.notes || null
  ]);

  await execute(`
    INSERT INTO audit_logs (id, entity_name, entity_id, action, new_values, reason)
    VALUES ($1, 'PAYMENT', $2, 'CREATE', $3, 'Customer payment received')
  `, [crypto.randomUUID(), id, JSON.stringify(data)]);

  const created = await queryOne(`SELECT * FROM customer_payments WHERE id = $1`, [id]);
  return {
    ...created,
    payment_date: formatDate(created.payment_date),
    amount_aed: roundTo(Number(created.amount_aed), 2),
    created_at: formatDateTime(created.created_at),
  };
}

export async function listCustomerPayments(filters?: {
  customerId?: string;
  from?: string;
  to?: string;
}): Promise<any[]> {
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
  return rows.map((r: any) => ({
    id: r.id,
    payment_number: r.payment_number,
    payment_date: formatDate(r.payment_date),
    customer_id: r.customer_id,
    customer_code: r.customer_code || null,
    customer_name: r.customer_name,
    transaction_id: r.transaction_id || null,
    transaction_number: r.transaction_number || null,
    amount_aed: roundTo(Number(r.amount_aed), 2),
    payment_method: r.payment_method || "CASH",
    reference_number: r.reference_number || null,
    notes: r.notes || null,
    created_at: formatDateTime(r.created_at),
  }));
}

export async function getCustomerLedger(customerId: string): Promise<{
  customer: Customer;
  entries: Array<{
    id: string;
    date: string;
    type: 'TRANSACTION' | 'PAYMENT';
    reference: string;
    description: string;
    debit_aed: number;
    credit_aed: number;
    running_balance_aed: number;
  }>;
}> {
  const customer = await getCustomer(customerId);
  if (!customer) throw new Error("Customer not found");

  const txns = await query(`
    SELECT id, transaction_date as date, 'TRANSACTION' as type, transaction_number as reference,
           'Order ' || inr_amount || ' INR @ ' || customer_rate as description,
           aed_amount as debit_aed, 0.0 as credit_aed, created_at
    FROM transactions
    WHERE customer_id = $1 AND status = 'CONFIRMED'
  `, [customerId]);

  const pays = await query(`
    SELECT id, payment_date as date, 'PAYMENT' as type, payment_number as reference,
           'Payment (' || payment_method || ')' as description,
           0.0 as debit_aed, amount_aed as credit_aed, created_at
    FROM customer_payments
    WHERE customer_id = $1
  `, [customerId]);

  // Merge & sort chronologically
  const allEvents = [...txns, ...pays].map(e => ({
    ...e,
    id: e.id,
    date: formatDate(e.date),
    debit_aed: roundTo(Number(e.debit_aed || 0), 2),
    credit_aed: roundTo(Number(e.credit_aed || 0), 2),
    created_at: formatDateTime(e.created_at),
  })).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.created_at.localeCompare(b.created_at);
  });

  let running = 0;
  const entries = allEvents.map(e => {
    running = roundTo(running + e.debit_aed - e.credit_aed, 2);
    return {
      id: e.id,
      date: e.date,
      type: e.type as 'TRANSACTION' | 'PAYMENT',
      reference: e.reference,
      description: e.description,
      debit_aed: e.debit_aed,
      credit_aed: e.credit_aed,
      running_balance_aed: running
    };
  });

  return { customer, entries };
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
    total_splits_inr: roundTo(Number(d.total_splits_inr || 0), 2),
    total_splits_paid_inr: roundTo(Number(d.total_splits_paid_inr || 0), 2),
    splits_balance_inr: roundTo(Number(d.splits_balance_inr || 0), 2),
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

  const all = await listDistributors();
  return all.find(d => d.id === id)!;
}

export async function listBankDistripAccounts(): Promise<BankDistripAccountRecord[]> {
  const rows = await query(`
    SELECT b.*,
           (SELECT balance_inr FROM bank_distrip_records r WHERE r.account_id = b.id ORDER BY r.record_date DESC, r.created_at DESC LIMIT 1) as current_balance
    FROM bank_distrip_accounts b
    ORDER BY b.account_name ASC
  `);

  return rows.map(r => ({
    ...r,
    current_balance: roundTo(Number(r.current_balance || 0), 2),
    created_at: formatDateTime(r.created_at),
  }));
}

export async function listBankDistripRecords(accountId?: string): Promise<BankDistripRecord[]> {
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
  sql += ` ORDER BY r.record_date DESC, r.created_at DESC`;

  const rows = await query(sql, params);
  return rows.map(mapBankDistripRecord);
}

export async function createBankDistripRecord(data: {
  record_date: string;
  account_id: string;
  order_inr: number;
  commission_inr?: number;
  paid_inr?: number;
  notes?: string;
}): Promise<BankDistripRecord> {
  const id = crypto.randomUUID();

  // Get previous balance up to this date
  const lastRecord = await queryOne(`
    SELECT balance_inr 
    FROM bank_distrip_records 
    WHERE account_id = $1 AND record_date <= $2
    ORDER BY record_date DESC, created_at DESC 
    LIMIT 1
  `, [data.account_id, data.record_date]);

  const prevBal = lastRecord ? Number(lastRecord.balance_inr) : 0;
  const order = Number(data.order_inr || 0);
  const com = Number(data.commission_inr || 0);
  const paid = Number(data.paid_inr || 0);
  const balance = roundTo(prevBal + order + com - paid, 2);

  await execute(`
    INSERT INTO bank_distrip_records (id, record_date, account_id, order_inr, commission_inr, paid_inr, balance_inr, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [id, data.record_date, data.account_id, order, com, paid, balance, data.notes || null]);

  const created = await queryOne(`
    SELECT r.*, a.account_name
    FROM bank_distrip_records r
    JOIN bank_distrip_accounts a ON a.id = r.account_id
    WHERE r.id = $1
  `, [id]);

  return mapBankDistripRecord(created);
}

// ---------------- DASHBOARD KPIS ----------------
export async function getDashboardKPIs(filters?: { from?: string; to?: string; timeframe?: string }) {
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
  const todayStr = new Date().toISOString().slice(0, 10);
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
        COALESCE((SELECT SUM(amount_aed) FROM customer_payments), 0) as outstanding
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

  return {
    kpis: {
      // Primary Cards
      todayInr: roundTo(Number(todaySummary?.total_inr || 0), 2),
      todayAed: roundTo(Number(todaySummary?.total_aed || 0), 2),
      todayTxnCount: Number(todaySummary?.count || 0),
      todayProfit: roundTo(Number(todaySummary?.net_profit || 0), 2),

      // Filtered Range Cards
      totalInrProcessed: roundTo(Number(txnSummary?.total_inr || 0), 2),
      totalAedCharged: roundTo(Number(txnSummary?.total_aed || 0), 2),
      totalAedCollected: roundTo(Number(paySummary?.total_collected || 0), 2),
      grossProfitAed: roundTo(Number(txnSummary?.gross_profit || 0), 2),
      deliveryChargesAed: roundTo(Number(txnSummary?.delivery_charges || 0), 2),
      netProfitAed: roundTo(Number(txnSummary?.net_profit || 0), 2),
      transactionCount: Number(txnSummary?.count || 0),

      // Secondary Global Cards
      outstandingReceivablesAed: roundTo(Number(custReceivables?.outstanding || 0), 2),
      indiaDistributionPendingInr: roundTo(Math.max(0, Number(distPending?.pending_inr || 0)), 2),
      bankDistributionPendingInr: roundTo(Number(bankPending?.bank_pending_inr || 0), 2),
    },
    dailyTrends: dailyTrends.map(d => ({
      date: formatDate(d.date),
      inrVolume: roundTo(Number(d.inr_volume || 0), 2),
      aedVolume: roundTo(Number(d.aed_volume || 0), 2),
      netProfit: roundTo(Number(d.net_profit || 0), 2),
      count: Number(d.txn_count || 0),
    }))
  };
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
  customer_rate?: number;
  base_rate?: number;
  delivery_charge_pct?: number;
  notes?: string;
  reason?: string;
}): Promise<TransactionRecord> {
  const existing = await getTransaction(id);
  if (!existing) throw new Error("Transaction not found");

  const inrAmount = data.inr_amount ?? existing.inr_amount;
  const customerRate = data.customer_rate ?? existing.customer_rate;
  const baseRate = data.base_rate ?? existing.base_rate;
  const deliveryChargePct = data.delivery_charge_pct ?? existing.delivery_charge_pct;
  const transactionDate = data.transaction_date ?? existing.transaction_date;
  const customerId = data.customer_id ?? existing.customer_id;
  const notes = data.notes !== undefined ? data.notes : existing.notes;

  // Validate splits if INR amount changed
  const currentSplits = await listDistributionSplits({ transaction_id: id });
  const totalSplitsInr = currentSplits.reduce((sum, s) => sum + s.inr_amount, 0);
  if (inrAmount < totalSplitsInr) {
    throw new Error(`New order amount (₹${inrAmount.toLocaleString()}) cannot be less than already allocated splits (₹${totalSplitsInr.toLocaleString()}). Adjust splits first.`);
  }

  // Authoritative re-calculation
  const calc = calculateTransaction({
    inrAmount,
    customerRate,
    baseRate,
    deliveryChargePct,
  });

  await execute(`
    UPDATE transactions
    SET transaction_date = $1, customer_id = $2, inr_amount = $3,
        customer_rate = $4, aed_amount = $5, base_rate = $6,
        cost_aed = $7, gross_profit_aed = $8, delivery_charge_pct = $9,
        delivery_charge_aed = $10, net_profit_aed = $11, notes = $12,
        updated_at = NOW()
    WHERE id = $13
  `, [
    transactionDate, customerId, calc.inrAmount,
    calc.customerRate, calc.aedAmount, calc.baseRate,
    calc.costAed, calc.grossProfitAed, calc.deliveryChargePct,
    calc.deliveryChargeAed, calc.netProfitAed, notes || null,
    id
  ]);

  // Log audit
  await execute(`
    INSERT INTO audit_logs (id, entity_name, entity_id, action, old_values, new_values, reason)
    VALUES ($1, 'TRANSACTION', $2, 'UPDATE', $3, $4, $5)
  `, [
    crypto.randomUUID(), id, JSON.stringify(existing), JSON.stringify(calc),
    data.reason || "User updated transaction"
  ]);

  return (await getTransaction(id))!;
}

export async function deleteTransaction(id: string): Promise<void> {
  const existing = await getTransaction(id);
  if (!existing) throw new Error("Transaction not found");

  await execute(`DELETE FROM distribution_splits WHERE transaction_id = $1`, [id]);
  await execute(`UPDATE customer_payments SET transaction_id = NULL WHERE transaction_id = $1`, [id]);
  await execute(`DELETE FROM audit_logs WHERE entity_id = $1`, [id]);
  await execute(`DELETE FROM transactions WHERE id = $1`, [id]);
}

export async function updateCustomer(id: string, data: {
  name?: string;
  code?: string;
  phone?: string;
  default_rate?: number;
  status?: string;
}): Promise<Customer> {
  const existing = await getCustomer(id);
  if (!existing) throw new Error("Customer not found");

  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const code = data.code !== undefined ? data.code.trim() : existing.code;
  const phone = data.phone !== undefined ? data.phone.trim() : existing.phone;
  const defaultRate = data.default_rate !== undefined ? data.default_rate : existing.default_rate;
  const status = data.status !== undefined ? data.status : existing.status;

  await execute(`
    UPDATE customers
    SET name = $1, code = $2, phone = $3, default_rate = $4, status = $5, updated_at = NOW()
    WHERE id = $6
  `, [name, code, phone || null, defaultRate || 38.25, status, id]);

  return (await getCustomer(id))!;
}

export async function deleteCustomer(id: string): Promise<void> {
  const txns = await query(`SELECT id FROM transactions WHERE customer_id = $1`, [id]);
  if (txns.length > 0) {
    throw new Error(`Cannot delete customer who has ${txns.length} active transactions. Delete or void their transactions first.`);
  }
  await execute(`DELETE FROM customer_payments WHERE customer_id = $1`, [id]);
  await execute(`DELETE FROM customers WHERE id = $1`, [id]);
}

export async function deleteCustomerPayment(id: string): Promise<void> {
  await execute(`DELETE FROM customer_payments WHERE id = $1`, [id]);
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

  const aedEq = wholesaleRate ? roundTo(newInr / wholesaleRate, 2) : 0;
  const paidInr = Number(existingSplit.paid_amount_inr || 0);
  const balanceInr = roundTo(newInr - paidInr, 2);

  await execute(`
    UPDATE distribution_splits
    SET distributor_id = $1, split_date = $2, inr_amount = $3,
        wholesale_rate = $4, aed_equivalent = $5, balance_inr = $6, notes = $7
    WHERE id = $8
  `, [
    distId, splitDate, roundTo(newInr, 2),
    wholesaleRate, aedEq, balanceInr, notes || null,
    id
  ]);

  const updatedRows = await listDistributionSplits({ transaction_id: txn.id });
  return updatedRows.find(s => s.id === id)!;
}

export async function deleteBankDistripRecord(id: string): Promise<void> {
  await execute(`DELETE FROM bank_distrip_records WHERE id = $1`, [id]);
}

export async function updateBankDistripRecord(id: string, data: {
  record_date?: string;
  order_inr?: number;
  commission_inr?: number;
  paid_inr?: number;
  notes?: string;
}): Promise<BankDistripRecord> {
  const existing = await queryOne(`SELECT * FROM bank_distrip_records WHERE id = $1`, [id]);
  if (!existing) throw new Error("Record not found");

  const recordDate = data.record_date || existing.record_date;
  const orderInr = data.order_inr !== undefined ? Number(data.order_inr) : Number(existing.order_inr);
  const commissionInr = data.commission_inr !== undefined ? Number(data.commission_inr) : Number(existing.commission_inr);
  const paidInr = data.paid_inr !== undefined ? Number(data.paid_inr) : Number(existing.paid_inr);
  const notes = data.notes !== undefined ? data.notes : existing.notes;

  const lastRecord = await queryOne(`
    SELECT balance_inr 
    FROM bank_distrip_records 
    WHERE account_id = $1 AND record_date <= $2 AND id != $3
    ORDER BY record_date DESC, created_at DESC 
    LIMIT 1
  `, [existing.account_id, recordDate, id]);

  const prevBal = lastRecord ? Number(lastRecord.balance_inr) : 0;
  const newBal = roundTo(prevBal + orderInr + commissionInr - paidInr, 2);

  await execute(`
    UPDATE bank_distrip_records
    SET record_date = $1, order_inr = $2, commission_inr = $3,
        paid_inr = $4, balance_inr = $5, notes = $6
    WHERE id = $7
  `, [recordDate, orderInr, commissionInr, paidInr, newBal, notes || null, id]);

  const updated = await queryOne(`
    SELECT r.*, a.account_name
    FROM bank_distrip_records r
    JOIN bank_distrip_accounts a ON a.id = r.account_id
    WHERE r.id = $1
  `, [id]);

  return mapBankDistripRecord(updated);
}
