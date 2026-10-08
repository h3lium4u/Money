import { Pool } from '@neondatabase/serverless';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').replace(/^["']|["']$/g, '').trim();
      process.env[key.trim()] = val;
    }
  }
}

async function wipeNeon() {
  if (!process.env.DATABASE_URL) {
    console.error("No DATABASE_URL found.");
    process.exit(1);
  }
  console.log("Connecting to Neon PostgreSQL to wipe all saved records and mock data...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("1. Wiping distribution splits...");
    await client.query("DELETE FROM distribution_splits");

    console.log("2. Wiping customer payments...");
    await client.query("DELETE FROM customer_payments");

    console.log("3. Wiping bank distrip records...");
    await client.query("DELETE FROM bank_distrip_records");

    console.log("4. Wiping distributor allocations...");
    await client.query("DELETE FROM distributor_allocations");

    console.log("5. Wiping transactions...");
    await client.query("DELETE FROM transactions");

    console.log("6. Wiping audit logs...");
    await client.query("DELETE FROM audit_logs");

    try {
      await client.query("DELETE FROM expenses");
    } catch (e) {}
    try {
      await client.query("DELETE FROM wholesale_settlements");
    } catch (e) {}

    console.log("7. Wiping mock/test customers (strictly preserving available PARTY records)...");
    await client.query("DELETE FROM customers WHERE entity_type != 'PARTY' OR entity_type IS NULL");

    const remainingParties = await client.query("SELECT id, code, name, entity_type, party_type, default_rate FROM customers ORDER BY name ASC");
    console.log("✓ Preserved Parties in Neon:", remainingParties.rows);

    const remainingDists = await client.query("SELECT id, code, name, partner_type, group_type FROM distributors ORDER BY name ASC");
    console.log("✓ Preserved Distributors in Neon:", remainingDists.rows);

    await client.query("COMMIT");
    console.log("✓ Neon PostgreSQL records completely wiped!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error wiping Neon:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function cleanExcelFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`Excel file not found at ${filePath}, skipping...`);
    return;
  }
  console.log(`Cleaning Excel workbook at ${filePath}...`);
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    for (const ws of wb.worksheets) {
      const name = ws.name.toUpperCase();
      // Keep headers on row 1 or 2
      // If it's a transactions, splits, payments, or orders sheet, clear rows after header
      if (
        name.includes("TRANSACTION") ||
        name.includes("PAYMENT") ||
        name.includes("SPLIT") ||
        name.includes("COLLECTION") ||
        name.includes("RECEIVABLE")
      ) {
        const startRow = name.includes("COLLECTION") || name.includes("RECEIVABLE") ? 3 : 2;
        while (ws.rowCount >= startRow) {
          ws.spliceRows(startRow, 1);
        }
      }
    }

    await wb.xlsx.writeFile(filePath);
    console.log(`✓ Cleaned Excel workbook at ${filePath}`);
  } catch (err) {
    console.error(`Error cleaning Excel at ${filePath}:`, err.message);
  }
}

async function main() {
  await wipeNeon();
  await cleanExcelFile(path.resolve(process.cwd(), "Remittance_Business_Normalized_Master.xlsx"));
  console.log("✓ All mock and saved records removed successfully while keeping party names!");
}

main().catch(console.error);
