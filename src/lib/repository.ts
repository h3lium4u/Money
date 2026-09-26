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

export interface TransactionRecord {
  id: string;
  transaction_number: string;
  transaction_date: string;
  customer_id: string;
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
  status: string;
  notes?: string | null;
  created_at: string;
}

export interface CustomerPaymentRecord {
  id: string;
  payment_number: string;
  payment_date: string;
  customer_id: string;
  customer_name?: string;
  transaction_id?: string | null;
  amount_aed: number;
  payment_method: string;
  reference_number?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface DistributorRecord {
  id: string;
  code: string;
  name: string;
  partner_type: string;
  default_settlement_currency: string;
  status: string;
  total_inr?: number;
  total_aed?: number;
  total_paid?: number;
  outstanding_balance?: number;
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
  return {
    id: r.id,
    transaction_number: r.transaction_number,
    transaction_date: formatDate(r.transaction_date),
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    inr_amount: roundTo(Number(r.inr_amount), 2),
    customer_rate: roundTo(Number(r.customer_rate), 4),
    aed_amount: roundTo(Number(r.aed_amount), 2),
    base_rate: roundTo(Number(r.base_rate), 4),
    cost_aed: roundTo(Number(r.cost_aed), 2),
    gross_profit_aed: roundTo(Number(r.gross_profit_aed), 2),
    delivery_charge_pct: Number(r.delivery_charge_pct),
    delivery_charge_aed: roundTo(Number(r.delivery_charge_aed), 2),
    net_profit_aed: roundTo(Number(r.net_profit_aed), 2),
    distributor_id: r.distributor_id || null,
    distributor_name: r.distributor_name || null,
    status: r.status,
    notes: r.notes || null,
    created_at: formatDateTime(r.created_at),
  };
}

function mapBankDistripRecord(r: any): BankDistripRecord {
  return {
    id: r.id,
    record_date: formatDate(r.record_date),
    account_id: r.account_id,
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
      c.name as customer_name,
      d.name as distributor_name
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
      c.name as customer_name,
      d.name as distributor_name
    FROM transactions t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN distributors d ON d.id = t.distributor_id
    WHERE t.id = $1 OR t.transaction_number = $2
  `, [id, id]);

  if (!r) return null;
  return mapTransactionRecord(r);
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
      net_profit_aed, distributor_id, status, notes
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, 'CONFIRMED', $15
    )
  `, [
    id, txnNumber, data.transaction_date, data.customer_id,
    calc.inrAmount, calc.customerRate, calc.aedAmount, calc.baseRate,
    calc.costAed, calc.grossProfitAed, calc.deliveryChargePct, calc.deliveryChargeAed,
    calc.netProfitAed, data.distributor_id || null, data.notes || null
  ]);

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
      amount_aed, payment_method, reference_number, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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

export async function getCustomerLedger(customerId: string): Promise<{
  customer: Customer;
  entries: Array<{
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
    SELECT transaction_date as date, 'TRANSACTION' as type, transaction_number as reference,
           'Bank Order ' || inr_amount || ' INR @ ' || customer_rate as description,
           aed_amount as debit_aed, 0.0 as credit_aed, created_at
    FROM transactions
    WHERE customer_id = $1 AND status = 'CONFIRMED'
  `, [customerId]);

  const pays = await query(`
    SELECT payment_date as date, 'PAYMENT' as type, payment_number as reference,
           'Payment (' || payment_method || ')' as description,
           0.0 as debit_aed, amount_aed as credit_aed, created_at
    FROM customer_payments
    WHERE customer_id = $1
  `, [customerId]);

  // Merge & sort chronologically
  const allEvents = [...txns, ...pays].map(e => ({
    ...e,
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

// ---------------- DISTRIBUTORS & BANK DISTRIP ----------------
export async function listDistributors(): Promise<DistributorRecord[]> {
  const rows = await query(`
    SELECT d.*,
           COALESCE((SELECT SUM(s.inr_amount) FROM wholesale_settlements s WHERE s.distributor_id = d.id), 0) as total_inr,
           COALESCE((SELECT SUM(s.aed_equivalent) FROM wholesale_settlements s WHERE s.distributor_id = d.id), 0) as total_aed,
           COALESCE((SELECT SUM(s.paid_amount_aed) FROM wholesale_settlements s WHERE s.distributor_id = d.id), 0) as total_paid
    FROM distributors d
    ORDER BY d.name ASC
  `);

  return rows.map(d => ({
    ...d,
    total_inr: roundTo(Number(d.total_inr || 0), 2),
    total_aed: roundTo(Number(d.total_aed || 0), 2),
    total_paid: roundTo(Number(d.total_paid || 0), 2),
    outstanding_balance: roundTo(Number(d.total_aed || 0) - Number(d.total_paid || 0), 2),
    created_at: formatDateTime(d.created_at),
  }));
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
    SELECT r.*, a.account_name
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
export async function getDashboardKPIs(filters?: { from?: string; to?: string }) {
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

  const txnSummary = await queryOne(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(inr_amount), 0) as total_inr,
      COALESCE(SUM(aed_amount), 0) as total_aed,
      COALESCE(SUM(gross_profit_aed), 0) as gross_profit,
      COALESCE(SUM(delivery_charge_aed), 0) as delivery_charges,
      COALESCE(SUM(net_profit_aed), 0) as net_profit
    FROM transactions
    ${txnWhere}
  `, txnParams);

  const paySummary = await queryOne(`
    SELECT COALESCE(SUM(amount_aed), 0) as total_collected
    FROM customer_payments
    ${payWhere}
  `, payParams);

  // Cumulative outstanding across entire confirmed ledger
  const custReceivables = await queryOne(`
    SELECT 
      COALESCE((SELECT SUM(aed_amount) FROM transactions WHERE status = 'CONFIRMED'), 0) - 
      COALESCE((SELECT SUM(amount_aed) FROM customer_payments), 0) as outstanding
  `);

  const dailyTrends = await query(`
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
  `, txnParams);

  return {
    kpis: {
      totalInrProcessed: roundTo(Number(txnSummary?.total_inr || 0), 2),
      totalAedCharged: roundTo(Number(txnSummary?.total_aed || 0), 2),
      totalAedCollected: roundTo(Number(paySummary?.total_collected || 0), 2),
      grossProfitAed: roundTo(Number(txnSummary?.gross_profit || 0), 2),
      deliveryChargesAed: roundTo(Number(txnSummary?.delivery_charges || 0), 2),
      netProfitAed: roundTo(Number(txnSummary?.net_profit || 0), 2),
      transactionCount: Number(txnSummary?.count || 0),
      outstandingReceivablesAed: roundTo(Number(custReceivables?.outstanding || 0), 2),
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
