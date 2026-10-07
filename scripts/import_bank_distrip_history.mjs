import { Pool } from "@neondatabase/serverless";
import ExcelJS from "exceljs";
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

async function main() {
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  console.log("✓ Connected to Neon database.");

  // 1. Remove the default rates 5000 and 200000 and default notes text from MK on 2026-10-07
  console.log("1. Resetting test rates 5000 / 200000 and notes on 2026-10-07...");
  await client.query(`
    UPDATE bank_distrip_records
    SET commission_inr = 0, paid_inr = 0, notes = NULL
    WHERE account_id = 'dist-mk' AND record_date = '2026-10-07'
  `);
  console.log("✓ Test rates and default notes cleared.");

  // 2. Ensure distributor accounts exist
  const accountsToEnsure = [
    { id: "dist-mk", code: "MK", name: "MK" },
    { id: "dist-sala", code: "SALA", name: "SALA" },
    { id: "dist-usain", code: "USAIN", name: "USAIN" },
    { id: "dist-blackgrp", code: "BLACK GRP", name: "BLACK GRP" },
  ];

  for (const acc of accountsToEnsure) {
    await client.query(`
      INSERT INTO distributors (id, code, name, partner_type, group_type, default_settlement_currency, status)
      VALUES ($1, $2, $3, 'INDIA_DISTRIBUTOR', 'IND', 'INR', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;
    `, [acc.id, acc.code, acc.name]);

    await client.query(`
      INSERT INTO bank_distrip_accounts (id, account_code, account_name, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET account_name = EXCLUDED.account_name, account_code = EXCLUDED.account_code;
    `, [acc.id, acc.code, acc.name]);
  }
  console.log("✓ All 4 distributor accounts ensured (MK, SALA, USAIN, BLACK GRP).");

  // 3. Load Excel workbook and parse BANK DISTRIP sheet
  const excelPath = "C:/Users/F1ZZ4N/.gemini/antigravity/brain/391fc215-7568-43ab-88f4-e1ff253be3eb/.user_uploaded/media_1791386732620.xlsx";
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const sheet = wb.getWorksheet("BANK DISTRIP");

  function extractVal(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === "object" && v.result !== undefined) return Number(v.result) || 0;
    if (typeof v === "number") return v;
    return 0;
  }

  function extractDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().split("T")[0];
    if (typeof v === "string" && v.match(/^\d{4}-\d{2}-\d{2}/)) return v.substring(0, 10);
    return null;
  }

  const partyConfigs = [
    { accountId: "dist-mk", name: "MK", dateCol: 1, orderCol: 2, comCol: 3, paidCol: 4, balCol: 5 },
    { accountId: "dist-sala", name: "SALA", dateCol: 7, orderCol: 8, comCol: 9, paidCol: 10, balCol: 11 },
    { accountId: "dist-usain", name: "USAIN", dateCol: 13, orderCol: 14, comCol: 15, paidCol: 16, balCol: 17 },
    { accountId: "dist-blackgrp", name: "BLACK GRP", dateCol: 25, orderCol: 26, comCol: 27, paidCol: 28, balCol: 29 },
  ];

  for (const cfg of partyConfigs) {
    console.log(`\nImporting history for ${cfg.name}...`);
    let inserted = 0;
    let updated = 0;

    for (let r = 4; r <= 35; r++) {
      const row = sheet.getRow(r);
      const rawDate = row.getCell(cfg.dateCol).value;
      const dateStr = extractDate(rawDate);
      if (!dateStr) continue;

      const orderInr = Math.round(extractVal(row.getCell(cfg.orderCol).value) * 100) / 100;
      const comInr = Math.round(extractVal(row.getCell(cfg.comCol).value) * 100) / 100;
      const paidInr = Math.round(extractVal(row.getCell(cfg.paidCol).value) * 100) / 100;

      const existing = await client.query(`
        SELECT id FROM bank_distrip_records
        WHERE account_id = $1 AND record_date = $2
        LIMIT 1
      `, [cfg.accountId, dateStr]);

      if (existing.rows.length > 0) {
        await client.query(`
          UPDATE bank_distrip_records
          SET order_inr = $1, commission_inr = $2, paid_inr = $3
          WHERE id = $4
        `, [orderInr, comInr, paidInr, existing.rows[0].id]);
        updated++;
      } else {
        const id = crypto.randomUUID();
        await client.query(`
          INSERT INTO bank_distrip_records (id, record_date, account_id, order_inr, commission_inr, paid_inr, balance_inr)
          VALUES ($1, $2, $3, $4, $5, $6, 0)
        `, [id, dateStr, cfg.accountId, orderInr, comInr, paidInr]);
        inserted++;
      }
    }

    console.log(`✓ ${cfg.name}: ${inserted} inserted, ${updated} updated.`);

    // Recalculate running balance strictly in chronological order
    const allRecords = await client.query(`
      SELECT id, record_date, order_inr, commission_inr, paid_inr
      FROM bank_distrip_records
      WHERE account_id = $1
      ORDER BY record_date ASC, created_at ASC, id ASC
    `, [cfg.accountId]);

    let runningBal = 0;
    for (const rec of allRecords.rows) {
      const order = Number(rec.order_inr || 0);
      const com = Number(rec.commission_inr || 0);
      const paid = Number(rec.paid_inr || 0);
      runningBal = Math.round((runningBal + order + com - paid) * 100) / 100;

      await client.query(`
        UPDATE bank_distrip_records
        SET balance_inr = $1
        WHERE id = $2
      `, [runningBal, rec.id]);
    }
    console.log(`✓ ${cfg.name} closing running balance: ₹ ${runningBal.toLocaleString("en-IN")}`);
  }

  await client.end();
  await pool.end();
  console.log("\n✓ All history successfully imported and balances reconciled!");
}

main().catch(err => {
  console.error("Error importing history:", err);
  process.exit(1);
});
