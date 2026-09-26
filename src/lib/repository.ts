import { getDb } from "@/lib/db";
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

// ---------------- CUSTOMERS ----------------
export function listCustomers(): Customer[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT 
      c.*,
      COALESCE((SELECT SUM(t.inr_amount) FROM transactions t WHERE t.customer_id = c.id AND t.status = 'CONFIRMED'), 0) as total_inr,
      COALESCE((SELECT SUM(t.aed_amount) FROM transactions t WHERE t.customer_id = c.id AND t.status = 'CONFIRMED'), 0) as total_aed,
      COALESCE((SELECT SUM(p.amount_aed) FROM customer_payments p WHERE p.customer_id = c.id), 0) as total_paid
    FROM customers c
    ORDER BY c.name ASC
  `).all() as any[];

  return rows.map(r => ({
    ...r,
    total_inr: roundTo(r.total_inr, 2),
    total_aed: roundTo(r.total_aed, 2),
    total_paid: roundTo(r.total_paid, 2),
    outstanding_balance: roundTo((r.total_aed || 0) - (r.total_paid || 0), 2)
  }));
}

export function getCustomer(id: string): Customer | null {
  const db = getDb();
  const r = db.prepare(`
    SELECT 
      c.*,
      COALESCE((SELECT SUM(t.inr_amount) FROM transactions t WHERE t.customer_id = c.id AND t.status = 'CONFIRMED'), 0) as total_inr,
      COALESCE((SELECT SUM(t.aed_amount) FROM transactions t WHERE t.customer_id = c.id AND t.status = 'CONFIRMED'), 0) as total_aed,
      COALESCE((SELECT SUM(p.amount_aed) FROM customer_payments p WHERE p.customer_id = c.id), 0) as total_paid
    FROM customers c
    WHERE c.id = ? OR c.code = ?
  `).get(id, id) as any;

  if (!r) return null;
  return {
    ...r,
    total_inr: roundTo(r.total_inr, 2),
    total_aed: roundTo(r.total_aed, 2),
    total_paid: roundTo(r.total_paid, 2),
    outstanding_balance: roundTo((r.total_aed || 0) - (r.total_paid || 0), 2)
  };
}

export function createCustomer(data: { name: string; code?: string; phone?: string; default_rate?: number }): Customer {
  const db = getDb();
  const id = crypto.randomUUID();
  const code = (data.code || data.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)) + "-" + Math.floor(100 + Math.random() * 900);
  
  db.prepare(`
    INSERT INTO customers (id, code, name, phone, default_rate, status)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE')
  `).run(id, code, data.name.trim(), data.phone || null, data.default_rate || 38.25);

  return getCustomer(id)!;
}

// ---------------- TRANSACTIONS ----------------
export function generateTransactionNumber(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `TXN-${year}-${randomSuffix}`;
}

export function listTransactions(filters?: {
  from?: string;
  to?: string;
  customerId?: string;
  status?: string;
  limit?: number;
}): TransactionRecord[] {
  const db = getDb();
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
    sql += ` AND t.transaction_date >= ?`;
    params.push(filters.from);
  }
  if (filters?.to) {
    sql += ` AND t.transaction_date <= ?`;
    params.push(filters.to);
  }
  if (filters?.customerId) {
    sql += ` AND t.customer_id = ?`;
    params.push(filters.customerId);
  }
  if (filters?.status) {
    sql += ` AND t.status = ?`;
    params.push(filters.status);
  }

  sql += ` ORDER BY t.transaction_date DESC, t.created_at DESC`;

  if (filters?.limit) {
    sql += ` LIMIT ?`;
    params.push(filters.limit);
  }

  return db.prepare(sql).all(...params) as any;
}

export function getTransaction(id: string): TransactionRecord | null {
  const db = getDb();
  return db.prepare(`
    SELECT 
      t.*,
      c.name as customer_name,
      d.name as distributor_name
    FROM transactions t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN distributors d ON d.id = t.distributor_id
    WHERE t.id = ? OR t.transaction_number = ?
  `).get(id, id) as any;
}

export function createTransaction(data: {
  transaction_date: string;
  customer_id: string;
  inr_amount: number;
  customer_rate: number;
  base_rate: number;
  delivery_charge_pct?: number;
  distributor_id?: string | null;
  notes?: string;
}): TransactionRecord {
  const db = getDb();
  const id = crypto.randomUUID();
  const txnNumber = generateTransactionNumber();

  // Authoritative calculations on server:
  const calc = calculateTransaction({
    inrAmount: data.inr_amount,
    customerRate: data.customer_rate,
    baseRate: data.base_rate,
    deliveryChargePct: data.delivery_charge_pct,
  });

  db.prepare(`
    INSERT INTO transactions (
      id, transaction_number, transaction_date, customer_id,
      inr_amount, customer_rate, aed_amount, base_rate,
      cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
      net_profit_aed, distributor_id, status, notes
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, 'CONFIRMED', ?
    )
  `).run(
    id, txnNumber, data.transaction_date, data.customer_id,
    calc.inrAmount, calc.customerRate, calc.aedAmount, calc.baseRate,
    calc.costAed, calc.grossProfitAed, calc.deliveryChargePct, calc.deliveryChargeAed,
    calc.netProfitAed, data.distributor_id || null, data.notes || null
  );

  // Record audit log
  db.prepare(`
    INSERT INTO audit_logs (id, entity_name, entity_id, action, new_values, reason)
    VALUES (?, 'TRANSACTION', ?, 'CREATE', ?, 'Initial transaction creation')
  `).run(crypto.randomUUID(), id, JSON.stringify(calc));

  return getTransaction(id)!;
}

export function voidTransaction(id: string, reason: string): TransactionRecord {
  const db = getDb();
  const existing = getTransaction(id);
  if (!existing) throw new Error("Transaction not found");

  db.prepare(`
    UPDATE transactions 
    SET status = 'VOIDED', updated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  db.prepare(`
    INSERT INTO audit_logs (id, entity_name, entity_id, action, old_values, reason)
    VALUES (?, 'TRANSACTION', ?, 'VOID', ?, ?)
  `).run(crypto.randomUUID(), id, JSON.stringify(existing), reason || "User voided transaction");

  return getTransaction(id)!;
}

// ---------------- CUSTOMER PAYMENTS ----------------
export function recordCustomerPayment(data: {
  customer_id: string;
  payment_date: string;
  amount_aed: number;
  payment_method?: string;
  reference_number?: string;
  transaction_id?: string;
  notes?: string;
}): CustomerPaymentRecord {
  const db = getDb();
  const id = crypto.randomUUID();
  const paymentNumber = `PAY-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  db.prepare(`
    INSERT INTO customer_payments (
      id, payment_number, payment_date, customer_id, transaction_id,
      amount_aed, payment_method, reference_number, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, paymentNumber, data.payment_date, data.customer_id, data.transaction_id || null,
    roundTo(data.amount_aed, 2), data.payment_method || 'CASH', data.reference_number || null, data.notes || null
  );

  db.prepare(`
    INSERT INTO audit_logs (id, entity_name, entity_id, action, new_values, reason)
    VALUES (?, 'PAYMENT', ?, 'CREATE', ?, 'Customer payment received')
  `).run(crypto.randomUUID(), id, JSON.stringify(data));

  return db.prepare(`SELECT * FROM customer_payments WHERE id = ?`).get(id) as any;
}

export function getCustomerLedger(customerId: string): {
  customer: Customer;
  entries: Array<{
    date: string;
    type: 'TRANSACTION' | 'PAYMENT';
    reference: string;
    description: string;
    debit_aed: number; // Charged
    credit_aed: number; // Paid
    running_balance_aed: number;
  }>;
} {
  const customer = getCustomer(customerId);
  if (!customer) throw new Error("Customer not found");

  const db = getDb();
  const txns = db.prepare(`
    SELECT transaction_date as date, 'TRANSACTION' as type, transaction_number as reference,
           'Bank Order ' || inr_amount || ' INR @ ' || customer_rate as description,
           aed_amount as debit_aed, 0.0 as credit_aed, created_at
    FROM transactions
    WHERE customer_id = ? AND status = 'CONFIRMED'
  `).all(customerId) as any[];

  const pays = db.prepare(`
    SELECT payment_date as date, 'PAYMENT' as type, payment_number as reference,
           'Payment (' || payment_method || ')' as description,
           0.0 as debit_aed, amount_aed as credit_aed, created_at
    FROM customer_payments
    WHERE customer_id = ?
  `).all(customerId) as any[];

  // Merge & sort chronologically
  const allEvents = [...txns, ...pays].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.created_at.localeCompare(b.created_at);
  });

  let running = 0;
  const entries = allEvents.map(e => {
    running = roundTo(running + e.debit_aed - e.credit_aed, 2);
    return {
      date: e.date,
      type: e.type,
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
export function listDistributors(): DistributorRecord[] {
  const db = getDb();
  return db.prepare(`
    SELECT d.*,
           COALESCE((SELECT SUM(s.inr_amount) FROM wholesale_settlements s WHERE s.distributor_id = d.id), 0) as total_inr,
           COALESCE((SELECT SUM(s.aed_equivalent) FROM wholesale_settlements s WHERE s.distributor_id = d.id), 0) as total_aed,
           COALESCE((SELECT SUM(s.paid_amount_aed) FROM wholesale_settlements s WHERE s.distributor_id = d.id), 0) as total_paid
    FROM distributors d
    ORDER BY d.name ASC
  `).all() as any;
}

export function listBankDistripAccounts(): BankDistripAccountRecord[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT b.*,
           (SELECT balance_inr FROM bank_distrip_records r WHERE r.account_id = b.id ORDER BY r.record_date DESC, r.created_at DESC LIMIT 1) as current_balance
    FROM bank_distrip_accounts b
    ORDER BY b.account_name ASC
  `).all() as any[];

  return rows.map(r => ({
    ...r,
    current_balance: roundTo(r.current_balance || 0, 2)
  }));
}

export function listBankDistripRecords(accountId?: string): BankDistripRecord[] {
  const db = getDb();
  let sql = `
    SELECT r.*, a.account_name
    FROM bank_distrip_records r
    JOIN bank_distrip_accounts a ON a.id = r.account_id
  `;
  const params: any[] = [];
  if (accountId) {
    sql += ` WHERE r.account_id = ?`;
    params.push(accountId);
  }
  sql += ` ORDER BY r.record_date DESC, r.created_at DESC`;

  return db.prepare(sql).all(...params) as any;
}

export function createBankDistripRecord(data: {
  record_date: string;
  account_id: string;
  order_inr: number;
  commission_inr?: number;
  paid_inr?: number;
  notes?: string;
}): BankDistripRecord {
  const db = getDb();
  const id = crypto.randomUUID();

  // Get previous balance
  const lastRecord = db.prepare(`
    SELECT balance_inr 
    FROM bank_distrip_records 
    WHERE account_id = ? AND record_date <= ?
    ORDER BY record_date DESC, created_at DESC 
    LIMIT 1
  `).get(data.account_id, data.record_date) as any;

  const prevBal = lastRecord ? Number(lastRecord.balance_inr) : 0;
  const order = Number(data.order_inr || 0);
  const com = Number(data.commission_inr || 0);
  const paid = Number(data.paid_inr || 0);
  const balance = roundTo(prevBal + order + com - paid, 2);

  db.prepare(`
    INSERT INTO bank_distrip_records (id, record_date, account_id, order_inr, commission_inr, paid_inr, balance_inr, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.record_date, data.account_id, order, com, paid, balance, data.notes || null);

  return db.prepare(`SELECT * FROM bank_distrip_records WHERE id = ?`).get(id) as any;
}

// ---------------- DASHBOARD KPIS ----------------
export function getDashboardKPIs(filters?: { from?: string; to?: string }) {
  const db = getDb();
  let txnWhere = "WHERE status = 'CONFIRMED'";
  let payWhere = "WHERE 1=1";
  const txnParams: any[] = [];
  const payParams: any[] = [];

  if (filters?.from) {
    txnWhere += " AND transaction_date >= ?";
    payWhere += " AND payment_date >= ?";
    txnParams.push(filters.from);
    payParams.push(filters.from);
  }
  if (filters?.to) {
    txnWhere += " AND transaction_date <= ?";
    payWhere += " AND payment_date <= ?";
    txnParams.push(filters.to);
    payParams.push(filters.to);
  }

  const txnSummary = db.prepare(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(inr_amount), 0) as total_inr,
      COALESCE(SUM(aed_amount), 0) as total_aed,
      COALESCE(SUM(gross_profit_aed), 0) as gross_profit,
      COALESCE(SUM(delivery_charge_aed), 0) as delivery_charges,
      COALESCE(SUM(net_profit_aed), 0) as net_profit
    FROM transactions
    ${txnWhere}
  `).get(...txnParams) as any;

  const paySummary = db.prepare(`
    SELECT COALESCE(SUM(amount_aed), 0) as total_collected
    FROM customer_payments
    ${payWhere}
  `).get(...payParams) as any;

  // Receivables total across all customers (cumulative)
  const custReceivables = db.prepare(`
    SELECT 
      COALESCE(SUM(t.aed_amount), 0) - COALESCE(SUM(p.amount_aed), 0) as outstanding
    FROM (SELECT SUM(aed_amount) as aed_amount FROM transactions WHERE status = 'CONFIRMED') t
    LEFT JOIN (SELECT SUM(amount_aed) as amount_aed FROM customer_payments) p ON 1=1
  `).get() as any;

  // Daily trend data for charts (last 30 days or filtered range)
  const dailyTrends = db.prepare(`
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
  `).all(...txnParams) as any[];

  return {
    kpis: {
      totalInrProcessed: roundTo(txnSummary.total_inr, 2),
      totalAedCharged: roundTo(txnSummary.total_aed, 2),
      totalAedCollected: roundTo(paySummary.total_collected, 2),
      grossProfitAed: roundTo(txnSummary.gross_profit, 2),
      deliveryChargesAed: roundTo(txnSummary.delivery_charges, 2),
      netProfitAed: roundTo(txnSummary.net_profit, 2),
      transactionCount: Number(txnSummary.count),
      outstandingReceivablesAed: roundTo(custReceivables?.outstanding || 0, 2),
    },
    dailyTrends: dailyTrends.map(d => ({
      date: d.date,
      inrVolume: roundTo(d.inr_volume, 2),
      aedVolume: roundTo(d.aed_volume, 2),
      netProfit: roundTo(d.net_profit, 2),
      count: Number(d.txn_count),
    }))
  };
}
