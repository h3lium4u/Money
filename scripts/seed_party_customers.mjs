import { Pool } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      const val = vals.join("=").replace(/^["']|["']$/g, "").trim();
      process.env[key.trim()] = val;
    }
  }
}

const connectionString = process.env.DATABASE_URL;

async function main() {
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  const customers = [
    { code: "AWAFI", name: "AWAFI" },
    { code: "BASID", name: "BASID" },
    { code: "HAJA", name: "HAJA" },
    { code: "NF2", name: "NF2" },
    { code: "SARABU", name: "SARABU" },
  ];

  for (const c of customers) {
    const id = `cust-${c.code.toLowerCase()}`;
    await client.query(
      `INSERT INTO customers (id, code, name, default_rate, status)
       VALUES ($1, $2, $3, 38.25, 'ACTIVE')
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
      [id, c.code, c.name]
    );
    console.log(`Seeded customer: ${c.name} (${c.code})`);
  }

  const res = await client.query("SELECT id, code, name, default_rate FROM customers ORDER BY name");
  console.log("Current customers:", res.rows);

  client.release();
  await pool.end();
}

main().catch(console.error);
