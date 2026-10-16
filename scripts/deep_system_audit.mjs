import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { Pool } from "@neondatabase/serverless";

// 1. Load Environment
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      process.env[key.trim()] = vals.join("=").replace(/^["']|["']$/g, "").trim();
    }
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function audit() {
  console.log("================================================================================");
  console.log("                DEEP SYSTEM AUDIT: EXCEL VS NEON POSTGRESQL                     ");
  console.log("================================================================================\n");

  // 1. NEON DATABASE INVENTORY
  console.log("--- 1. NEON POSTGRESQL DATABASE TOTALS ---");
  const dbCustRes = await pool.query(`SELECT COUNT(*) as count FROM customers WHERE COALESCE(entity_type, 'CUSTOMER') = 'CUSTOMER'`);
  const dbPartyRes = await pool.query(`SELECT COUNT(*) as count FROM customers WHERE COALESCE(entity_type, 'CUSTOMER') = 'PARTY'`);
  const dbTxnCustRes = await pool.query(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(inr_amount), 0) as total_inr,
      COALESCE(SUM(aed_amount), 0) as total_aed,
      COALESCE(SUM(gross_profit_aed), 0) as total_gross_profit,
      COALESCE(SUM(net_profit_aed), 0) as total_net_profit
    FROM transactions t
    JOIN customers c ON c.id = t.customer_id
    WHERE COALESCE(c.entity_type, 'CUSTOMER') = 'CUSTOMER'
  `);
  const dbTxnPartyRes = await pool.query(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(inr_amount), 0) as total_inr,
      COALESCE(SUM(aed_amount), 0) as total_aed,
      COALESCE(SUM(cost_aed), 0) as total_cost_aed
    FROM transactions t
    JOIN customers c ON c.id = t.customer_id
    WHERE COALESCE(c.entity_type, 'CUSTOMER') = 'PARTY'
  `);
  const dbAllTxnRes = await pool.query(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(inr_amount), 0) as total_inr,
      COALESCE(SUM(aed_amount), 0) as total_aed
    FROM transactions
  `);
  const dbPayRes = await pool.query(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(amount_aed), 0) as total_paid_aed
    FROM customer_payments
  `);
  const dbSplitsRes = await pool.query(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(inr_amount), 0) as total_split_inr
    FROM distribution_splits
  `);
  const dbDistRes = await pool.query(`
    SELECT 
      COUNT(*) as count,
      COUNT(CASE WHEN group_type = 'IND' THEN 1 END) as ind_count,
      COUNT(CASE WHEN group_type = 'AED' THEN 1 END) as aed_count
    FROM distributors
  `);
  const dbBankRes = await pool.query(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(order_inr), 0) as total_orders,
      COALESCE(SUM(commission_inr), 0) as total_commissions,
      COALESCE(SUM(paid_inr), 0) as total_paid
    FROM bank_distrip_records
  `);

  console.log(`Customers (Retail):       ${dbCustRes.rows[0].count}`);
  console.log(`Parties (Wholesale/Dubai): ${dbPartyRes.rows[0].count}`);
  console.log(`Total Transactions in DB:  ${dbAllTxnRes.rows[0].count} (INR: ${Number(dbAllTxnRes.rows[0].total_inr).toLocaleString()})`);
  console.log(`  - Customer Transfers:    ${dbTxnCustRes.rows[0].count} (INR: ${Number(dbTxnCustRes.rows[0].total_inr).toLocaleString()}, AED: ${Number(dbTxnCustRes.rows[0].total_aed).toLocaleString()})`);
  console.log(`  - Party Transfers:       ${dbTxnPartyRes.rows[0].count} (INR: ${Number(dbTxnPartyRes.rows[0].total_inr).toLocaleString()}, AED: ${Number(dbTxnPartyRes.rows[0].total_aed).toLocaleString()})`);
  console.log(`Customer Payments:         ${dbPayRes.rows[0].count} (Total Paid AED: ${Number(dbPayRes.rows[0].total_paid_aed).toLocaleString()})`);
  console.log(`Distribution Splits:       ${dbSplitsRes.rows[0].count} (Total Split INR: ${Number(dbSplitsRes.rows[0].total_split_inr).toLocaleString()})`);
  console.log(`Distributors Master:       ${dbDistRes.rows[0].count} (IND: ${dbDistRes.rows[0].ind_count}, AED: ${dbDistRes.rows[0].aed_count})`);
  console.log(`Bank Distrip Records:      ${dbBankRes.rows[0].count} (Orders: ${Number(dbBankRes.rows[0].total_orders).toLocaleString()}, Paid: ${Number(dbBankRes.rows[0].total_paid).toLocaleString()})\n`);

  // 2. EXCEL FILE COMPARISON (Accounts_Business_Normalized_Master.xlsx)
  console.log("--- 2. EXCEL WORKBOOK (Accounts_Business_Normalized_Master.xlsx) COMPARISON ---");
  const masterPath = path.resolve(process.cwd(), "Accounts_Business_Normalized_Master.xlsx");
  if (fs.existsSync(masterPath)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(masterPath);

    console.log(`Total Worksheets in Master Excel: ${wb.worksheets.length}`);
    for (const ws of wb.worksheets) {
      console.log(`  - [${ws.name}] Rows: ${ws.rowCount}, Columns: ${ws.columnCount}`);
    }
    console.log();
  } else {
    console.warn("Master Excel file not found on disk!");
  }

  // 3. COMPARISON WITH SOURCE EXCEL F:\AYYAN JAN.xlsx
  console.log("--- 3. SOURCE EXCEL (F:\\AYYAN JAN.xlsx) AUDIT ---");
  const srcPath = "F:/AYYAN JAN.xlsx";
  if (fs.existsSync(srcPath)) {
    const srcWb = new ExcelJS.Workbook();
    await srcWb.xlsx.readFile(srcPath);
    console.log(`Source Excel Worksheets: ${srcWb.worksheets.map(w => w.name).join(", ")}`);

    const cp = srcWb.getWorksheet("COLLECTION & PROFIT");
    if (cp) {
      console.log(`COLLECTION & PROFIT: ${cp.rowCount} rows, ${cp.columnCount} columns`);
    }
    const id = srcWb.getWorksheet("INDIA DISTRIBUTION");
    if (id) {
      console.log(`INDIA DISTRIBUTION: ${id.rowCount} rows, ${id.columnCount} columns`);
    }
    const bd = srcWb.getWorksheet("BANK DISTRIP");
    if (bd) {
      console.log(`BANK DISTRIP: ${bd.rowCount} rows, ${bd.columnCount} columns`);
    }
  } else {
    console.warn("Source Excel F:\\AYYAN JAN.xlsx not found!");
  }
  console.log();

  // 4. API LATENCY BENCHMARK
  console.log("--- 4. API LATENCY BENCHMARK (MEASURING LIVE ENDPOINTS) ---");
  const endpoints = [
    { name: "Health Check", url: "http://localhost:3000/api/health" },
    { name: "List Transactions (Default limit)", url: "http://localhost:3000/api/transactions" },
    { name: "List Transactions (All PARTY entityType)", url: "http://localhost:3000/api/transactions?entityType=PARTY&limit=250" },
    { name: "List Customers", url: "http://localhost:3000/api/customers" },
    { name: "List Parties", url: "http://localhost:3000/api/parties?type=DUBAI" },
    { name: "Distributors Master", url: "http://localhost:3000/api/distributors" },
    { name: "Distributors Page Data (Aggregated)", url: "http://localhost:3000/api/distributors/page-data?refresh=true" },
    { name: "Bank Distrip Records", url: "http://localhost:3000/api/bank-distrip" },
    { name: "Distribution Splits", url: "http://localhost:3000/api/distribution-splits?limit=100" },
    { name: "Export Excel Report", url: "http://localhost:3000/api/reports/export-excel" },
  ];

  for (const ep of endpoints) {
    const start = performance.now();
    try {
      const res = await fetch(ep.url);
      const timeMs = Math.round(performance.now() - start);
      let sizeBytes = 0;
      if (res.headers.get("content-type")?.includes("json")) {
        const json = await res.json();
        sizeBytes = JSON.stringify(json).length;
        const itemCount = Array.isArray(json) ? json.length : (json.transactions ? json.transactions.length : (json.data ? json.data.length : "-"));
        console.log(`  ${ep.name.padEnd(40)}: HTTP ${res.status} | ${timeMs.toString().padStart(5)}ms | Size: ${(sizeBytes / 1024).toFixed(1).padStart(6)} KB | Items: ${itemCount}`);
      } else {
        const buf = await res.arrayBuffer();
        sizeBytes = buf.byteLength;
        console.log(`  ${ep.name.padEnd(40)}: HTTP ${res.status} | ${timeMs.toString().padStart(5)}ms | Size: ${(sizeBytes / 1024).toFixed(1).padStart(6)} KB | Binary`);
      }
    } catch (err) {
      const timeMs = Math.round(performance.now() - start);
      console.error(`  ${ep.name.padEnd(40)}: FAILED in ${timeMs}ms - ${err.message}`);
    }
  }

  await pool.end();
}

audit().catch(console.error);
