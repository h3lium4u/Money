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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // 1. Add entity_type column
    await client.query(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT 'CUSTOMER'
    `);
    console.log("Added entity_type column.");

    // 2. Set existing customers without entity_type to 'CUSTOMER'
    await client.query(`
      UPDATE customers 
      SET entity_type = 'CUSTOMER' 
      WHERE entity_type IS NULL
    `);

    // 3. Mark the 5 party records as 'PARTY'
    const parties = ["AWAFI", "BASID", "HAJA", "NF2", "SARABU"];
    for (const code of parties) {
      const partyId = `party-${code.toLowerCase()}`;
      // Check if code exists
      const existing = await client.query(`SELECT id FROM customers WHERE code = $1`, [code]);
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE customers SET id = $1, entity_type = 'PARTY' WHERE code = $2`,
          [partyId, code]
        );
        console.log(`Updated party ${code} to ID ${partyId}`);
      } else {
        await client.query(
          `INSERT INTO customers (id, code, name, default_rate, status, entity_type)
           VALUES ($1, $2, $2, 38.25, 'ACTIVE', 'PARTY')`,
          [partyId, code]
        );
        console.log(`Inserted party ${code} as ID ${partyId}`);
      }
    }

    const res = await client.query(`
      SELECT id, code, name, entity_type FROM customers ORDER BY entity_type, name
    `);
    console.log("Customers and Parties in DB:", res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
