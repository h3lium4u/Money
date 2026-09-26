import { Pool } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

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

async function main() {
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log("Connecting to Neon PostgreSQL...");
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  console.log("✓ Connected to Neon successfully!");

  console.log("Creating/updating tables in Neon PostgreSQL...");
  await client.query(`
    -- Ensure columns on existing tables
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE distributors ADD COLUMN IF NOT EXISTS client_confirmation_note TEXT;

    -- Create distribution_splits table
    CREATE TABLE IF NOT EXISTS distribution_splits (
      id VARCHAR(36) PRIMARY KEY,
      transaction_id VARCHAR(36) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      distributor_id VARCHAR(36) NOT NULL REFERENCES distributors(id),
      split_date DATE NOT NULL,
      inr_amount NUMERIC(15, 2) NOT NULL,
      wholesale_rate NUMERIC(10, 4),
      aed_equivalent NUMERIC(15, 2),
      paid_amount_inr NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
      balance_inr NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
      status VARCHAR(20) NOT NULL DEFAULT 'ALLOCATED',
      notes TEXT,
      is_demo BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_splits_txn ON distribution_splits(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_splits_dist ON distribution_splits(distributor_id);
    CREATE INDEX IF NOT EXISTS idx_splits_date ON distribution_splits(split_date);
  `);

  console.log("Ensuring all India Parties and Bank Accounts exist with proper classification...");
  // India Distributors & Reference Parties
  const parties = [
    { code: 'MK', name: 'MK', type: 'HYBRID', note: 'Single unified MK account (confirmed by client: duplicate block merged)' },
    { code: 'ISMAIL', name: 'ISMAIL', type: 'INDIA_DISTRIBUTOR', note: 'India-side distribution partner' },
    { code: 'SARABU', name: 'SARABU', type: 'INDIA_DISTRIBUTOR', note: 'India-side distribution partner' },
    { code: 'SALA', name: 'SALA', type: 'HYBRID', note: 'India-side distributor & bank payout network' },
    { code: 'NNG', name: 'NNG', type: 'HYBRID', note: 'India-side distributor & bank account' },
    { code: 'USAIN', name: 'USAIN', type: 'BANK_ACCOUNT', note: 'Bank distribution account' },
    { code: 'BLACK GRP', name: 'BLACK GRP', type: 'BANK_ACCOUNT', note: 'Bank distribution account' },
    // Unconfirmed parties
    { code: 'AWAFI', name: 'AWAFI', type: 'UNCONFIRMED_PARTNER', note: 'REQUIRES CLIENT CONFIRMATION: Role and classification pending client confirmation' },
    { code: 'NF2', name: 'NF2', type: 'UNCONFIRMED_PARTNER', note: 'REQUIRES CLIENT CONFIRMATION: Role and classification pending client confirmation' },
    { code: 'HAJA', name: 'HAJA', type: 'UNCONFIRMED_PARTNER', note: 'REQUIRES CLIENT CONFIRMATION: Role and classification pending client confirmation' },
    { code: 'BASID', name: 'BASID', type: 'UNCONFIRMED_PARTNER', note: 'REQUIRES CLIENT CONFIRMATION: Role and classification pending client confirmation' }
  ];

  for (const p of parties) {
    const id = `dist-${p.code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    await client.query(`
      INSERT INTO distributors (id, code, name, partner_type, client_confirmation_note)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (code) DO UPDATE 
      SET partner_type = $4, client_confirmation_note = $5;
    `, [id, p.code, p.name, p.type, p.note]);

    // If it's a bank account or hybrid, make sure it is in bank_distrip_accounts
    if (['HYBRID', 'BANK_ACCOUNT'].includes(p.type)) {
      await client.query(`
        INSERT INTO bank_distrip_accounts (id, account_code, account_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (account_code) DO NOTHING;
      `, [id, p.code, p.name]);
    }
  }

  console.log("Cleaning previous transactions, payments, and splits...");
  await client.query("DELETE FROM distribution_splits");
  await client.query("DELETE FROM customer_payments");
  await client.query("DELETE FROM transactions");
  await client.query("DELETE FROM bank_distrip_records");
  await client.query("DELETE FROM audit_logs");

  console.log("Inserting 5 realistic DEMO transactions with distribution splits and receivables...");

  // Customer IDs helper
  const custMap = {
    DIVAN: 'cust-2',
    SAMI: 'cust-1',
    'FAIZ BU': 'cust-3',
    RAKSAN: 'cust-4',
    SATHIK: 'cust-5'
  };

  // 1. TXN-2026-000001: DIVAN (Multi-split, fully distributed & paid)
  // Date: Today (2026-09-26)
  // INR: 2,000,000 | Daily Rate: 38.30 | My Rate: 26.18 | Delivery: 20%
  // AED Charged = 2000 * 38.30 = 76,600.00 AED
  // Cost AED = 2,000,000 / 26.18 = 76,394.19 AED
  // Gross Profit = 205.81 AED
  // Delivery Charge = 41.16 AED
  // Net Profit = 164.65 AED
  // Splits: MK 500k, ISMAIL 700k, SARABU 800k = 2,000,000 INR
  // Payment: 76,600 AED (Fully paid)
  const txn1Id = 'demo-txn-1';
  await client.query(`
    INSERT INTO transactions (
      id, transaction_number, transaction_date, customer_id,
      inr_amount, customer_rate, aed_amount, base_rate,
      cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
      net_profit_aed, status, notes, is_demo
    ) VALUES (
      $1, 'TXN-2026-000001', '2026-09-26', $2,
      2000000.00, 38.3000, 76600.00, 26.1800,
      76394.19, 205.81, 0.20, 41.16,
      164.65, 'CONFIRMED', 'DEMO DATA - Large multi-split India order with full cash collection', true
    )
  `, [txn1Id, custMap['DIVAN']]);

  // Splits for TXN-1
  await client.query(`
    INSERT INTO distribution_splits (id, transaction_id, distributor_id, split_date, inr_amount, wholesale_rate, aed_equivalent, paid_amount_inr, balance_inr, status, notes, is_demo)
    VALUES 
    ('split-1-1', $1, 'dist-mk', '2026-09-26', 500000.00, 26.18, 19098.55, 500000.00, 0.00, 'COMPLETED', 'DEMO DATA - MK Payout Part 1', true),
    ('split-1-2', $1, 'dist-ismail', '2026-09-26', 700000.00, 26.18, 26738.00, 700000.00, 0.00, 'COMPLETED', 'DEMO DATA - Ismail Payout Part 2', true),
    ('split-1-3', $1, 'dist-sarabu', '2026-09-26', 800000.00, 26.18, 30557.68, 800000.00, 0.00, 'COMPLETED', 'DEMO DATA - Sarabu Payout Part 3', true)
  `, [txn1Id]);

  // Payment for TXN-1 (Fully paid)
  await client.query(`
    INSERT INTO customer_payments (id, payment_number, payment_date, customer_id, transaction_id, amount_aed, payment_method, notes, is_demo)
    VALUES ('demo-pay-1', 'PAY-2026-000001', '2026-09-26', $1, $2, 76600.00, 'CASH', 'DEMO DATA - Full cash payment received in Dubai', true)
  `, [custMap['DIVAN'], txn1Id]);

  // 2. TXN-2026-000002: SAMI (Partially paid, single split)
  // Date: Today (2026-09-26)
  // INR: 1,500,000 | Daily Rate: 38.25 | My Rate: 26.20 | Delivery: 20%
  // AED Charged = 1500 * 38.25 = 57,375.00 AED
  // Cost AED = 1,500,000 / 26.20 = 57,251.91 AED
  // Gross Profit = 123.09 AED
  // Delivery Charge = 24.62 AED
  // Net Profit = 98.47 AED
  // Split: SALA 1,500,000 INR
  // Payment: 35,000.00 AED received, Outstanding: 22,375.00 AED
  const txn2Id = 'demo-txn-2';
  await client.query(`
    INSERT INTO transactions (
      id, transaction_number, transaction_date, customer_id,
      inr_amount, customer_rate, aed_amount, base_rate,
      cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
      net_profit_aed, status, notes, is_demo
    ) VALUES (
      $1, 'TXN-2026-000002', '2026-09-26', $2,
      1500000.00, 38.2500, 57375.00, 26.2000,
      57251.91, 123.09, 0.20, 24.62,
      98.47, 'CONFIRMED', 'DEMO DATA - Transfer with partial payment received', true
    )
  `, [txn2Id, custMap['SAMI']]);

  await client.query(`
    INSERT INTO distribution_splits (id, transaction_id, distributor_id, split_date, inr_amount, wholesale_rate, aed_equivalent, paid_amount_inr, balance_inr, status, notes, is_demo)
    VALUES 
    ('split-2-1', $1, 'dist-sala', '2026-09-26', 1500000.00, 26.20, 57251.91, 1500000.00, 0.00, 'COMPLETED', 'DEMO DATA - Sala Network Distribution', true)
  `, [txn2Id]);

  await client.query(`
    INSERT INTO customer_payments (id, payment_number, payment_date, customer_id, transaction_id, amount_aed, payment_method, notes, is_demo)
    VALUES ('demo-pay-2', 'PAY-2026-000002', '2026-09-26', $1, $2, 35000.00, 'BANK_TRANSFER', 'DEMO DATA - Partial payment via Bank Transfer', true)
  `, [custMap['SAMI'], txn2Id]);

  // 3. TXN-2026-000003: FAIZ BU (Pending payment, partial distribution)
  // Date: Yesterday (2026-09-25)
  // INR: 1,000,000 | Daily Rate: 38.20 | My Rate: 26.22 | Delivery: 20%
  // AED Charged = 1000 * 38.20 = 38,200.00 AED
  // Cost AED = 1,000,000 / 26.22 = 38,138.82 AED
  // Gross Profit = 61.18 AED
  // Delivery Charge = 12.24 AED
  // Net Profit = 48.94 AED
  // Split: NNG 600,000 INR (Remaining: 400,000 INR to distribute!)
  // Payment: 0.00 AED (Full 38,200.00 AED pending)
  const txn3Id = 'demo-txn-3';
  await client.query(`
    INSERT INTO transactions (
      id, transaction_number, transaction_date, customer_id,
      inr_amount, customer_rate, aed_amount, base_rate,
      cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
      net_profit_aed, status, notes, is_demo
    ) VALUES (
      $1, 'TXN-2026-000003', '2026-09-25', $2,
      1000000.00, 38.2000, 38200.00, 26.2200,
      38138.82, 61.18, 0.20, 12.24,
      48.94, 'CONFIRMED', 'DEMO DATA - Pending payment with remaining INR to distribute', true
    )
  `, [txn3Id, custMap['FAIZ BU']]);

  await client.query(`
    INSERT INTO distribution_splits (id, transaction_id, distributor_id, split_date, inr_amount, wholesale_rate, aed_equivalent, paid_amount_inr, balance_inr, status, notes, is_demo)
    VALUES 
    ('split-3-1', $1, 'dist-nng', '2026-09-25', 600000.00, 26.22, 22883.29, 600000.00, 0.00, 'ALLOCATED', 'DEMO DATA - Partial split; ₹4,00,000 remains pending', true)
  `, [txn3Id]);

  // 4. TXN-2026-000004: RAKSAN (Fully paid, split across MK and SARABU)
  // Date: Earlier this week (2026-09-22)
  // INR: 500,000 | Daily Rate: 38.35 | My Rate: 26.15 | Delivery: 20%
  // AED Charged = 500 * 38.35 = 19,175.00 AED
  // Cost AED = 500,000 / 26.15 = 19,120.46 AED
  // Gross Profit = 54.54 AED
  // Delivery Charge = 10.91 AED
  // Net Profit = 43.63 AED
  // Splits: MK 250k, SARABU 250k = 500k
  // Payment: 19,175.00 AED (Fully paid)
  const txn4Id = 'demo-txn-4';
  await client.query(`
    INSERT INTO transactions (
      id, transaction_number, transaction_date, customer_id,
      inr_amount, customer_rate, aed_amount, base_rate,
      cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
      net_profit_aed, status, notes, is_demo
    ) VALUES (
      $1, 'TXN-2026-000004', '2026-09-22', $2,
      500000.00, 38.3500, 19175.00, 26.1500,
      19120.46, 54.54, 0.20, 10.91,
      43.63, 'CONFIRMED', 'DEMO DATA - Standard completed remittance', true
    )
  `, [txn4Id, custMap['RAKSAN']]);

  await client.query(`
    INSERT INTO distribution_splits (id, transaction_id, distributor_id, split_date, inr_amount, wholesale_rate, aed_equivalent, paid_amount_inr, balance_inr, status, notes, is_demo)
    VALUES 
    ('split-4-1', $1, 'dist-mk', '2026-09-22', 250000.00, 26.15, 9560.23, 250000.00, 0.00, 'COMPLETED', 'DEMO DATA - MK Half Split', true),
    ('split-4-2', $1, 'dist-sarabu', '2026-09-22', 250000.00, 26.15, 9560.23, 250000.00, 0.00, 'COMPLETED', 'DEMO DATA - Sarabu Half Split', true)
  `, [txn4Id]);

  await client.query(`
    INSERT INTO customer_payments (id, payment_number, payment_date, customer_id, transaction_id, amount_aed, payment_method, notes, is_demo)
    VALUES ('demo-pay-4', 'PAY-2026-000004', '2026-09-22', $1, $2, 19175.00, 'CASH', 'DEMO DATA - Full settlement', true)
  `, [custMap['RAKSAN'], txn4Id]);

  // 5. TXN-2026-000005: SATHIK (Different rate, partially distributed, partially paid)
  // Date: Last week (2026-09-18)
  // INR: 800,000 | Daily Rate: 38.15 | My Rate: 26.25 | Delivery: 20%
  // AED Charged = 800 * 38.15 = 30,520.00 AED
  // Cost AED = 800,000 / 26.25 = 30,476.19 AED
  // Gross Profit = 43.81 AED
  // Delivery Charge = 8.76 AED
  // Net Profit = 35.05 AED
  // Split: ISMAIL 400,000 INR (Remaining: 400,000 INR pending allocation)
  // Payment: 10,000.00 AED (Outstanding: 20,520.00 AED)
  const txn5Id = 'demo-txn-5';
  await client.query(`
    INSERT INTO transactions (
      id, transaction_number, transaction_date, customer_id,
      inr_amount, customer_rate, aed_amount, base_rate,
      cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
      net_profit_aed, status, notes, is_demo
    ) VALUES (
      $1, 'TXN-2026-000005', '2026-09-18', $2,
      800000.00, 38.1500, 30520.00, 26.2500,
      30476.19, 43.81, 0.20, 8.76,
      35.05, 'CONFIRMED', 'DEMO DATA - Special rate, partially distributed and partially paid', true
    )
  `, [txn5Id, custMap['SATHIK']]);

  await client.query(`
    INSERT INTO distribution_splits (id, transaction_id, distributor_id, split_date, inr_amount, wholesale_rate, aed_equivalent, paid_amount_inr, balance_inr, status, notes, is_demo)
    VALUES 
    ('split-5-1', $1, 'dist-ismail', '2026-09-18', 400000.00, 26.25, 15238.10, 400000.00, 0.00, 'ALLOCATED', 'DEMO DATA - Ismail First Tranche', true)
  `, [txn5Id]);

  await client.query(`
    INSERT INTO customer_payments (id, payment_number, payment_date, customer_id, transaction_id, amount_aed, payment_method, notes, is_demo)
    VALUES ('demo-pay-5', 'PAY-2026-000005', '2026-09-18', $1, $2, 10000.00, 'CASH', 'DEMO DATA - Partial deposit in cash', true)
  `, [custMap['SATHIK'], txn5Id]);

  // Seed sample Bank Distrip records for MK, SALA, USAIN, BLACK GRP
  console.log("Seeding sample Bank Distribution records...");
  await client.query(`
    INSERT INTO bank_distrip_records (id, record_date, account_id, order_inr, commission_inr, paid_inr, balance_inr, notes)
    VALUES 
    ('bank-rec-1', '2026-09-26', 'dist-mk', 750000.00, 1500.00, 500000.00, 251500.00, 'DEMO DATA - Combined MK ledger order and payout'),
    ('bank-rec-2', '2026-09-26', 'dist-sala', 1500000.00, 3000.00, 1000000.00, 503000.00, 'DEMO DATA - Sala Network daily volume'),
    ('bank-rec-3', '2026-09-25', 'dist-usain', 400000.00, 800.00, 400000.00, 800.00, 'DEMO DATA - Usain bank transfer settlement'),
    ('bank-rec-4', '2026-09-24', 'dist-blackgrp', 600000.00, 1200.00, 601200.00, 0.00, 'DEMO DATA - Black Group full clearing')
  `);

  console.log("✓ Neon schema updated and 5 demo transactions successfully seeded!");
  client.release();
  await pool.end();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
