import { Pool } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      const val = vals.join("=").replace(/^["']|["']$/g, "").trim();
      process.env[key.trim()] = val;
    }
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  console.log("Connected to Neon DB");

  const distUpdates = [
    { code: "MK", name: "MK" },
    { code: "ISMAIL", name: "ISMAIL" },
    { code: "SARABU", name: "SARABU" },
    { code: "SALA", name: "SALA" },
    { code: "NNG", name: "NNG" },
    { code: "USAIN", name: "USAIN" },
    { code: "BLACK GRP", name: "BLACK GRP" },
    { code: "AWAFI", name: "AWAFI" },
    { code: "NF2", name: "NF2" },
    { code: "HAJA", name: "HAJA" },
    { code: "BASID", name: "BASID" },
  ];

  for (const d of distUpdates) {
    await client.query("UPDATE distributors SET name = $1 WHERE code = $2", [d.name, d.code]);
  }

  const bankUpdates = [
    { code: "MK", name: "MK" },
    { code: "NNG", name: "NNG" },
    { code: "SALA", name: "SALA" },
    { code: "USAIN", name: "USAIN" },
    { code: "BLACK GRP", name: "BLACK GRP" },
  ];

  for (const b of bankUpdates) {
    await client.query("UPDATE bank_distrip_accounts SET account_name = $1 WHERE account_code = $2", [b.name, b.code]);
  }

  console.log("Successfully updated names in distributors and bank_distrip_accounts.");

  const res1 = await client.query("SELECT code, name, partner_type FROM distributors ORDER BY code");
  console.log("Distributors in DB:", res1.rows);

  const res2 = await client.query("SELECT account_code, account_name FROM bank_distrip_accounts ORDER BY account_code");
  console.log("Bank Accounts in DB:", res2.rows);

  client.release();
  await pool.end();
}

main().catch(console.error);
