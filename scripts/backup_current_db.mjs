import { Pool } from '@neondatabase/serverless';
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf-8');
for (const line of env.split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...v] = t.split('=');
    process.env[k.trim()] = v.join('=').replace(/^["']|["']$/g, '').trim();
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function backup() {
  console.log('Connecting to current Neon DB for full backup snapshot...');
  const tables = [
    'app_security',
    'distributors',
    'bank_distrip_accounts',
    'customers',
    'transactions',
    'distribution_splits',
    'customer_payments',
    'bank_distrip_records',
    'wholesale_settlements',
    'expenses',
    'audit_logs',
    'scheduled_wipes',
    'distributor_allocations'
  ];

  const backupData = {};
  for (const table of tables) {
    const res = await pool.query(`SELECT * FROM ${table}`);
    backupData[table] = res.rows;
    console.log(`✓ Fetched ${res.rows.length} rows from ${table}`);
  }

  const outPath = 'backups/current_db_snapshot.json';
  fs.writeFileSync(outPath, JSON.stringify(backupData, null, 2));
  console.log(`\n✓ Successfully saved complete snapshot to ${outPath}`);
  await pool.end();
}

backup().catch(console.error);
