import { Pool } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      const val = vals.join("=").replace(/^["']|["']$/g, "").trim();
      process.env[key.trim()] = val;
    }
  }
}

const connectionString = process.env.DATABASE_URL;

function roundTo(val, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function calculateTxn(inr, custRate, baseRate, deliveryPct = 0.20) {
  const aedAmount = roundTo((inr / 1000) * custRate, 2);
  const costAed = roundTo((inr / 1000) * baseRate, 2);
  const grossProfitAed = roundTo(aedAmount - costAed, 2);
  const deliveryChargeAed = roundTo(grossProfitAed * deliveryPct, 2);
  const netProfitAed = roundTo(grossProfitAed - deliveryChargeAed, 2);
  return { aedAmount, costAed, grossProfitAed, deliveryChargeAed, netProfitAed };
}

async function seed() {
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  console.log("Connected to Neon PostgreSQL for AI dummy data seeding...");

  const today = new Date().toISOString().slice(0, 10);

  // 1. Ensure Customers exist
  const customers = [
    { code: "CUST-001", name: "SAMI", defaultRate: 38.25 },
    { code: "CUST-002", name: "DIVAN", defaultRate: 38.30 },
    { code: "CUST-003", name: "FAIZ BU", defaultRate: 38.35 },
    { code: "CUST-004", name: "RAKSAN", defaultRate: 38.20 },
    { code: "CUST-005", name: "SATHIK", defaultRate: 38.40 },
  ];

  const custMap = {};
  for (const c of customers) {
    let row = (await client.query("SELECT id FROM customers WHERE code = $1", [c.code])).rows[0];
    if (!row) {
      const id = crypto.randomUUID();
      await client.query(
        "INSERT INTO customers (id, code, name, default_rate, status) VALUES ($1, $2, $3, $4, 'ACTIVE')",
        [id, c.code, c.name, c.defaultRate]
      );
      custMap[c.name] = id;
    } else {
      custMap[c.name] = row.id;
    }
  }

  // 2. Ensure Distributors exist
  const distributors = [
    { code: "MK", name: "MK", type: "BANK_DISTRIBUTOR" },
    { code: "SARABU", name: "SARABU", type: "WHOLESALE_PARTNER" },
    { code: "ISMAIL", name: "ISMAIL", type: "WHOLESALE_PARTNER" },
    { code: "SALA", name: "SALA", type: "BANK_DISTRIBUTOR" },
    { code: "NNG", name: "NNG", type: "BANK_DISTRIBUTOR" },
  ];

  const distMap = {};
  for (const d of distributors) {
    let row = (await client.query("SELECT id FROM distributors WHERE code = $1", [d.code])).rows[0];
    if (!row) {
      const id = crypto.randomUUID();
      await client.query(
        "INSERT INTO distributors (id, code, name, partner_type, status) VALUES ($1, $2, $3, $4, 'ACTIVE')",
        [id, d.code, d.name, d.type]
      );
      distMap[d.code] = id;
    } else {
      distMap[d.code] = row.id;
    }

    // Ensure bank distribution account for bank distributors
    if (d.type === "BANK_DISTRIBUTOR") {
      await client.query(
        "INSERT INTO bank_distrip_accounts (id, account_code, account_name, bank_name, status) VALUES ($1, $2, $3, 'HDFC Bank', 'ACTIVE') ON CONFLICT (account_code) DO NOTHING",
        [distMap[d.code], d.code, d.name]
      );
    }
  }

  // Helper to insert or get transaction
  async function ensureTxn(txnNum, date, custName, inr, custRate, baseRate, notes) {
    let existing = (await client.query("SELECT id FROM transactions WHERE transaction_number = $1", [txnNum])).rows[0];
    if (existing) return existing.id;

    const calc = calculateTxn(inr, custRate, baseRate);
    const id = crypto.randomUUID();
    await client.query(`
      INSERT INTO transactions (
        id, transaction_number, transaction_date, customer_id,
        inr_amount, customer_rate, aed_amount, base_rate, cost_aed,
        gross_profit_aed, delivery_charge_pct, delivery_charge_aed, net_profit_aed,
        status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0.20, $11, $12, 'CONFIRMED', $13)
    `, [
      id, txnNum, date, custMap[custName],
      inr, custRate, calc.aedAmount, baseRate, calc.costAed,
      calc.grossProfitAed, calc.deliveryChargeAed, calc.netProfitAed, notes
    ]);
    return id;
  }

  // Helper to insert payment
  async function ensurePayment(payNum, date, custName, txnId, amountAed, notes) {
    const existing = (await client.query("SELECT id FROM customer_payments WHERE payment_number = $1", [payNum])).rows[0];
    if (existing) return existing.id;

    const id = crypto.randomUUID();
    await client.query(`
      INSERT INTO customer_payments (
        id, payment_number, payment_date, customer_id, transaction_id, amount_aed, payment_method, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, 'CASH', $7)
    `, [id, payNum, date, custMap[custName], txnId, amountAed, notes]);
    return id;
  }

  // Helper to insert distribution split
  async function ensureSplit(txnId, distCode, date, inrAmount, wholesaleRate, notes) {
    const existing = (await client.query(
      "SELECT id FROM distribution_splits WHERE transaction_id = $1 AND distributor_id = $2",
      [txnId, distMap[distCode]]
    )).rows[0];
    if (existing) return existing.id;

    const id = crypto.randomUUID();
    await client.query(`
      INSERT INTO distribution_splits (
        id, transaction_id, distributor_id, split_date, inr_amount, wholesale_rate,
        paid_amount_inr, balance_inr, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, $5, 'ALLOCATED', $7)
    `, [id, txnId, distMap[distCode], date, inrAmount, wholesaleRate, notes]);
    return id;
  }

  // Helper to insert bank distrip record
  async function ensureBankRecord(distCode, date, orderInr, commissionInr, paidInr, notes) {
    const acct = (await client.query("SELECT id FROM bank_distrip_accounts WHERE account_code = $1", [distCode])).rows[0];
    if (!acct) return;

    const id = crypto.randomUUID();
    const balanceInr = roundTo(orderInr + commissionInr - paidInr, 2);
    await client.query(`
      INSERT INTO bank_distrip_records (
        id, record_date, account_id, order_inr, commission_inr, paid_inr, balance_inr, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, date, acct.id, orderInr, commissionInr, paidInr, balanceInr, notes]);
  }

  console.log("Seeding 5 Realistic Dummy Records...");

  // Record 1: Fully paid customer transaction (SAMI)
  const txn1 = await ensureTxn("TXN-2026-0001", today, "SAMI", 500000, 38.25, 37.95, "Fully paid remittance for SAMI");
  await ensurePayment("PAY-2026-0001", today, "SAMI", txn1, 19125.00, "Full cash settlement from SAMI");

  // Record 2: Partially paid customer transaction (DIVAN)
  const txn2 = await ensureTxn("TXN-2026-0002", today, "DIVAN", 800000, 38.30, 38.00, "Partially paid remittance for DIVAN");
  await ensurePayment("PAY-2026-0002", today, "DIVAN", txn2, 20000.00, "Partial cash payment of 20,000 AED (balance 10,640 AED)");

  // Record 3: Outstanding customer transaction (RAKSAN)
  const txn3 = await ensureTxn("TXN-2026-0003", today, "RAKSAN", 600000, 38.20, 37.90, "Unpaid transfer for RAKSAN");

  // Record 4: Multi-distributor split transaction (FAIZ BU -> MK, SARABU, ISMAIL)
  const txn4 = await ensureTxn("TXN-2026-0004", today, "FAIZ BU", 2000000, 38.35, 38.05, "Multi-split India distribution transfer");
  await ensureSplit(txn4, "MK", today, 500000, 38.00, "Allocated to MK bank distributor");
  await ensureSplit(txn4, "SARABU", today, 800000, 38.05, "Allocated to SARABU wholesale");
  await ensureSplit(txn4, "ISMAIL", today, 700000, 38.02, "Allocated to ISMAIL wholesale");

  // Record 5: Different rates & previous month comparison (SATHIK)
  const txn5 = await ensureTxn("TXN-2026-0005", today, "SATHIK", 1200000, 38.40, 38.10, "High-rate transfer for SATHIK");
  await ensureSplit(txn5, "MK", today, 600000, 38.10, "Second allocation to MK");

  // Bank distribution records for MK & SALA
  await ensureBankRecord("MK", today, 500000, 1250, 400000, "Daily bank distribution orders & commission");
  await ensureBankRecord("SALA", today, 300000, 750, 300750, "Full payout settlement for SALA");

  console.log("✓ All 5 realistic dummy records & accounts seeded successfully into Neon PostgreSQL!");
  client.release();
  await pool.end();
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
