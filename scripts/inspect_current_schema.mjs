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

async function dumpSchema() {
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log('Tables:', tablesRes.rows.map(r => r.table_name));

  for (const row of tablesRes.rows) {
    const tName = row.table_name;
    const colRes = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [tName]);
    console.log(`\nTable: ${tName}`);
    console.table(colRes.rows);
  }

  await pool.end();
}

dumpSchema().catch(console.error);
