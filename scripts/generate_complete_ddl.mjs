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

async function getFullDDL() {
  const tables = [
    'app_security',
    'customers',
    'distributors',
    'bank_distrip_accounts',
    'bank_distrip_records',
    'transactions',
    'customer_payments',
    'distribution_splits',
    'wholesale_settlements',
    'expenses',
    'audit_logs',
    'scheduled_wipes',
    'distributor_allocations'
  ];

  let fullSQL = '-- Generated Complete Schema for Petti\n\n';

  for (const table of tables) {
    const colsRes = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length, 
        is_nullable, 
        column_default,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [table]);

    if (colsRes.rows.length === 0) continue;

    fullSQL += `CREATE TABLE IF NOT EXISTS ${table} (\n`;
    const colDefs = colsRes.rows.map(col => {
      let typeStr = col.data_type;
      if (col.data_type === 'character varying') {
        typeStr = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'VARCHAR(255)';
      } else if (col.data_type === 'numeric') {
        if (col.numeric_precision && col.numeric_scale !== null) {
          typeStr = `NUMERIC(${col.numeric_precision}, ${col.numeric_scale})`;
        } else {
          typeStr = 'NUMERIC';
        }
      } else if (col.data_type === 'timestamp with time zone') {
        typeStr = 'TIMESTAMPTZ';
      }

      let def = `  ${col.column_name} ${typeStr}`;
      if (col.is_nullable === 'NO') def += ' NOT NULL';
      if (col.column_default) def += ` DEFAULT ${col.column_default}`;
      return def;
    });

    // Check primary key
    const pkRes = await pool.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1;
    `, [table]);

    if (pkRes.rows.length > 0) {
      const pks = pkRes.rows.map(r => r.column_name).join(', ');
      colDefs.push(`  PRIMARY KEY (${pks})`);
    }

    fullSQL += colDefs.join(',\n');
    fullSQL += `\n);\n\n`;
  }

  // Get Indexes
  const idxRes = await pool.query(`
    SELECT indexdef 
    FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey';
  `);

  fullSQL += '-- Indexes\n';
  for (const idx of idxRes.rows) {
    fullSQL += `${idx.indexdef};\n`;
  }

  fs.writeFileSync('scripts/complete_schema.sql', fullSQL);
  console.log('✓ Successfully wrote scripts/complete_schema.sql');
  await pool.end();
}

getFullDDL().catch(console.error);
