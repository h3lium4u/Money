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

async function exportDDL() {
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log('TABLES FOUND IN CURRENT DATABASE:');
  console.log(tablesRes.rows.map(r => r.table_name));

  for (const { table_name } of tablesRes.rows) {
    const countRes = await pool.query(`SELECT count(*) as c FROM ${table_name}`);
    console.log(`- ${table_name}: ${countRes.rows[0].c} rows`);
  }

  await pool.end();
}

exportDDL().catch(console.error);
