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
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  for (const row of tables.rows) {
    const t = row.table_name;
    const cnt = await client.query(`SELECT count(*) FROM "${t}"`);
    console.log(`${t}: ${cnt.rows[0].count} rows`);
  }
  client.release();
  await pool.end();
}
check().catch(console.error);
