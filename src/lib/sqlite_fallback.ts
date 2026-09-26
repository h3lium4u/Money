import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

let sqliteDb: DatabaseSync | null = null;

export function getSqliteDb(): DatabaseSync {
  if (!sqliteDb) {
    const dbDir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, "remittance.db");
    sqliteDb = new DatabaseSync(dbPath);
    initSchema(sqliteDb);
  }
  return sqliteDb;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      default_rate REAL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS distributors (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      partner_type TEXT NOT NULL,
      default_settlement_currency TEXT NOT NULL DEFAULT 'AED',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      transaction_number TEXT UNIQUE NOT NULL,
      transaction_date TEXT NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      inr_amount REAL NOT NULL,
      customer_rate REAL NOT NULL,
      aed_amount REAL NOT NULL,
      base_rate REAL NOT NULL,
      cost_aed REAL NOT NULL,
      gross_profit_aed REAL NOT NULL,
      delivery_charge_pct REAL NOT NULL DEFAULT 0.20,
      delivery_charge_aed REAL NOT NULL DEFAULT 0.00,
      net_profit_aed REAL NOT NULL,
      distributor_id TEXT REFERENCES distributors(id),
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_payments (
      id TEXT PRIMARY KEY,
      payment_number TEXT UNIQUE NOT NULL,
      payment_date TEXT NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      transaction_id TEXT REFERENCES transactions(id),
      amount_aed REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      reference_number TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wholesale_settlements (
      id TEXT PRIMARY KEY,
      settlement_date TEXT NOT NULL,
      distributor_id TEXT NOT NULL REFERENCES distributors(id),
      inr_amount REAL NOT NULL DEFAULT 0.00,
      wholesale_rate REAL NOT NULL,
      aed_equivalent REAL NOT NULL,
      paid_amount_aed REAL NOT NULL DEFAULT 0.00,
      balance_aed REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_distrip_accounts (
      id TEXT PRIMARY KEY,
      account_code TEXT UNIQUE NOT NULL,
      account_name TEXT NOT NULL,
      bank_name TEXT,
      account_number TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_distrip_records (
      id TEXT PRIMARY KEY,
      record_date TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES bank_distrip_accounts(id),
      order_inr REAL NOT NULL DEFAULT 0.00,
      commission_inr REAL NOT NULL DEFAULT 0.00,
      paid_inr REAL NOT NULL DEFAULT 0.00,
      balance_inr REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      amount_aed REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_name TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      user_name TEXT DEFAULT 'Admin',
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
