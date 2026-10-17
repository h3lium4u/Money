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

async function applySchema() {
  console.log('Connecting to new Neon DB to apply complete schema...');
  const sql = fs.readFileSync('scripts/complete_schema.sql', 'utf-8');

  // Split into statements safely or execute directly
  await pool.query(sql);
  console.log('✓ Successfully executed complete_schema.sql on new Neon DB!');

  const res = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log('\nVerified tables created on new Neon DB:');
  console.table(res.rows);

  await pool.end();
}

applySchema().catch(err => {
  console.error('Error applying schema:', err);
  process.exit(1);
});
