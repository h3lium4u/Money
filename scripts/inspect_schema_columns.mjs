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
const res = await pool.query(`
  SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
  FROM information_schema.columns
  WHERE table_name IN ('transactions', 'distribution_splits', 'customer_payments')
  ORDER BY table_name, ordinal_position;
`);
console.table(res.rows);
await pool.end();
