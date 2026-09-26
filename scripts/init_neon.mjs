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

  console.log("Creating tables in Neon PostgreSQL...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(36) PRIMARY KEY,
      code VARCHAR(30) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(30),
      default_rate NUMERIC(10, 4),
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS distributors (
      id VARCHAR(36) PRIMARY KEY,
      code VARCHAR(30) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      partner_type VARCHAR(30) NOT NULL,
      default_settlement_currency VARCHAR(5) NOT NULL DEFAULT 'AED',
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(36) PRIMARY KEY,
      transaction_number VARCHAR(30) UNIQUE NOT NULL,
      transaction_date DATE NOT NULL,
      customer_id VARCHAR(36) NOT NULL REFERENCES customers(id),
      inr_amount NUMERIC(15, 2) NOT NULL,
      customer_rate NUMERIC(10, 4) NOT NULL,
      aed_amount NUMERIC(15, 2) NOT NULL,
      base_rate NUMERIC(10, 4) NOT NULL,
      cost_aed NUMERIC(15, 2) NOT NULL,
      gross_profit_aed NUMERIC(15, 2) NOT NULL,
      delivery_charge_pct NUMERIC(6, 4) NOT NULL DEFAULT 0.20,
      delivery_charge_aed NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
      net_profit_aed NUMERIC(15, 2) NOT NULL,
      distributor_id VARCHAR(36) REFERENCES distributors(id),
      status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customer_payments (
      id VARCHAR(36) PRIMARY KEY,
      payment_number VARCHAR(30) UNIQUE NOT NULL,
      payment_date DATE NOT NULL,
      customer_id VARCHAR(36) NOT NULL REFERENCES customers(id),
      transaction_id VARCHAR(36) REFERENCES transactions(id),
      amount_aed NUMERIC(15, 2) NOT NULL,
      payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH',
      reference_number VARCHAR(50),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wholesale_settlements (
      id VARCHAR(36) PRIMARY KEY,
      settlement_date DATE NOT NULL,
      distributor_id VARCHAR(36) NOT NULL REFERENCES distributors(id),
      inr_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
      wholesale_rate NUMERIC(10, 4) NOT NULL,
      aed_equivalent NUMERIC(15, 2) NOT NULL,
      paid_amount_aed NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
      balance_aed NUMERIC(15, 2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bank_distrip_accounts (
      id VARCHAR(36) PRIMARY KEY,
      account_code VARCHAR(30) UNIQUE NOT NULL,
      account_name VARCHAR(100) NOT NULL,
      bank_name VARCHAR(100),
      account_number VARCHAR(50),
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bank_distrip_records (
      id VARCHAR(36) PRIMARY KEY,
      record_date DATE NOT NULL,
      account_id VARCHAR(36) NOT NULL REFERENCES bank_distrip_accounts(id),
      order_inr NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
      commission_inr NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
      paid_inr NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
      balance_inr NUMERIC(15, 2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(36) PRIMARY KEY,
      expense_date DATE NOT NULL,
      category VARCHAR(50) NOT NULL,
      description TEXT,
      amount_aed NUMERIC(15, 2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(36) PRIMARY KEY,
      entity_name VARCHAR(50) NOT NULL,
      entity_id VARCHAR(36) NOT NULL,
      action VARCHAR(20) NOT NULL,
      old_values TEXT,
      new_values TEXT,
      user_name VARCHAR(50) DEFAULT 'Admin',
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("Seeding Customers into Neon...");
  const customerNames = [
    'SAMI', 'DIVAN', 'FAIZ BU', 'RAKSAN', 'SATHIK', 'AJIFER', 'ABBAS', 'ARAFATH',
    'AKBAR DRY', 'SMS', 'BUHARI', 'MALIK', 'KADHAR', 'JAHIR', 'FAYAS', 'AJMAL',
    'SALEEM', 'IBRM APS', 'RIYAS', 'YUVRAJ', 'FAIZAL', 'SHAHUL', 'ASF AKBAR',
    'GANI', 'BEER', 'ASF SHAJHN', 'NAISAR', 'ADIL RAS', 'THARIK'
  ];

  for (let i = 0; i < customerNames.length; i++) {
    const name = customerNames[i];
    const code = `CUST-${String(i + 1).padStart(3, "0")}`;
    const id = `cust-${i + 1}`;
    await client.query(`
      INSERT INTO customers (id, code, name, default_rate, status)
      VALUES ($1, $2, $3, 38.25, 'ACTIVE')
      ON CONFLICT (code) DO NOTHING
    `, [id, code, name]);
  }

  console.log("Seeding Bank and Wholesale Distributors into Neon...");
  const bankDists = [
    ['MK', 'MK'],
    ['SALA', 'SALA'],
    ['USAIN', 'USAIN'],
    ['NNG', 'NNG'],
    ['BLACK GRP', 'BLACK GRP']
  ];
  for (const [code, name] of bankDists) {
    const id = `dist-${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    await client.query(`
      INSERT INTO distributors (id, code, name, partner_type)
      VALUES ($1, $2, $3, 'BANK_DISTRIBUTOR')
      ON CONFLICT (code) DO NOTHING
    `, [id, code, name]);

    await client.query(`
      INSERT INTO bank_distrip_accounts (id, account_code, account_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (account_code) DO NOTHING
    `, [id, code, name]);
  }

  const wholesaleDists = [
    ['AWAFI', 'AWAFI'],
    ['NF2', 'NF2'],
    ['HAJA', 'HAJA'],
    ['SARABU', 'SARABU'],
    ['BASID', 'BASID']
  ];
  for (const [code, name] of wholesaleDists) {
    const id = `dist-${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    await client.query(`
      INSERT INTO distributors (id, code, name, partner_type)
      VALUES ($1, $2, $3, 'WHOLESALE_PARTNER')
      ON CONFLICT (code) DO NOTHING
    `, [id, code, name]);
  }

  console.log("✓ Neon PostgreSQL tables & master data initialized successfully!");
  client.release();
  await pool.end();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
