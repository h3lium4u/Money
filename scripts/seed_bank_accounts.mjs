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

  const accounts = [
    { id: "dist-mk", code: "MK", name: "MK" },
    { id: "dist-sala", code: "SALA", name: "SALA" },
    { id: "dist-usain", code: "USAIN", name: "USAIN" },
    { id: "dist-mk2", code: "MK (separate ledger)", name: "MK (separate ledger)" },
    { id: "dist-blackgrp", code: "BLACK GRP", name: "BLACK GRP" },
    { id: "dist-tally", code: "TALLY", name: "TALLY" },
    { id: "dist-nng", code: "NNG", name: "NNG" },
  ];

  for (const acc of accounts) {
    await client.query(
      `INSERT INTO bank_distrip_accounts (id, account_code, account_name, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name`,
      [acc.id, acc.code, acc.name]
    );
    console.log(`Seeded account: ${acc.name} (${acc.code})`);
  }

  const res = await client.query("SELECT id, account_code, account_name, status FROM bank_distrip_accounts ORDER BY account_name");
  console.log("Current bank distrip accounts:", res.rows);

  client.release();
  await pool.end();
}

main().catch(console.error);
