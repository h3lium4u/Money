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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const client = await pool.connect();
  
  console.log("--- TRANSACTIONS ---");
  const txns = await client.query(`SELECT * FROM transactions`);
  console.log(txns.rows);

  console.log("--- SPLITS ---");
  const splits = await client.query(`SELECT * FROM distribution_splits`);
  console.log(splits.rows);

  console.log("--- CUSTOMERS ---");
  const custs = await client.query(`SELECT * FROM customers`);
  console.log(custs.rows);

  console.log("--- DISTRIBUTORS ---");
  const dists = await client.query(`SELECT id, code, name, partner_type, group_type FROM distributors`);
  console.log(dists.rows);

  console.log("--- AUDIT LOGS ---");
  const audits = await client.query(`SELECT * FROM audit_logs`);
  console.log(audits.rows);

  console.log("--- BANK ACCOUNTS ---");
  const baccs = await client.query(`SELECT * FROM bank_distrip_accounts`);
  console.log(baccs.rows);

  console.log("--- BANK RECORDS ---");
  const brecs = await client.query(`SELECT * FROM bank_distrip_records`);
  console.log(brecs.rows);

  console.log("--- PAYMENTS ---");
  const pays = await client.query(`SELECT * FROM customer_payments`);
  console.log(pays.rows);

  client.release();
  await pool.end();
}
check().catch(console.error);
