import { Pool } from "@neondatabase/serverless";
import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const [k, ...v] = line.trim().split("=");
  if (k && !k.startsWith("#")) process.env[k.trim()] = v.join("=").trim().replace(/^['"]|['"]$/g, "");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const r = await pool.query("SELECT pg_database_size(current_database()) as size_bytes, current_database() as db_name, version() as version");
  console.log("Database info:", r.rows[0]);

  const tables = await pool.query(`
    SELECT 
      table_name,
      pg_total_relation_size(quote_ident(table_name)) as total_bytes,
      pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as pretty_size
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY total_bytes DESC
    LIMIT 10
  `);
  console.log("Top tables:", tables.rows);
  await pool.end();
}

run().catch(console.error);
