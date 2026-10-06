import { neon } from "@neondatabase/serverless";
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

const sql = neon(process.env.DATABASE_URL);

async function run() {
  await sql.query("ALTER TABLE customers ALTER COLUMN party_type DROP DEFAULT;");
  await sql.query("UPDATE customers SET party_type = NULL WHERE entity_type = 'CUSTOMER';");
  console.log("Successfully set party_type = NULL for all normal CUSTOMER entities.");
  
  const customers = await sql.query("SELECT id, code, name, entity_type, party_type FROM customers ORDER BY name;");
  console.log("Current customers table records:", customers);
}

run().catch(console.error);
