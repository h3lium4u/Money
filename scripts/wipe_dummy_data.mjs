import { Pool } from '@neondatabase/serverless';
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
  console.log("Connecting to Neon PostgreSQL to wipe all dummy data...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("Wiping distribution splits...");
    await client.query("DELETE FROM distribution_splits");

    console.log("Wiping customer payments...");
    await client.query("DELETE FROM customer_payments");

    console.log("Wiping bank distrip records...");
    await client.query("DELETE FROM bank_distrip_records");

    console.log("Wiping transactions...");
    await client.query("DELETE FROM transactions");

    console.log("Wiping audit logs...");
    await client.query("DELETE FROM audit_logs");

    console.log("Wiping test customers...");
    await client.query("DELETE FROM customers");

    try {
      await client.query("DELETE FROM expenses");
    } catch (e) {}
    try {
      await client.query("DELETE FROM wholesale_settlements");
    } catch (e) {}

    await client.query("COMMIT");
    console.log("✓ Neon PostgreSQL dummy data completely wiped!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error wiping Neon:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  await wipeNeon();
  console.log("All dummy data has been completely and safely removed.");
}

main().catch(console.error);
