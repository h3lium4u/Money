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

async function main() {
  console.log("Starting party & distributor cleanup...");

  // 1. Column party_type on customers
  await sql.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS party_type VARCHAR(20) DEFAULT 'DUBAI'");

  // 2. Reassign any existing references from party-awafi to party-haja
  await sql.query("UPDATE transactions SET customer_id = 'party-haja' WHERE customer_id = 'party-awafi'");
  await sql.query("UPDATE customer_payments SET customer_id = 'party-haja' WHERE customer_id = 'party-awafi'");

  // 3. Delete non-retained parties from customers (AWAFI, BASID)
  await sql.query("DELETE FROM customers WHERE id IN ('party-awafi', 'party-basid')");

  // 4. Update SARABU code and name to SARAB in customers
  await sql.query("UPDATE customers SET code = 'SARAB', name = 'SARAB', party_type = 'DUBAI' WHERE id = 'party-sarabu' OR code = 'SARABU'");
  await sql.query("UPDATE customers SET party_type = 'DUBAI' WHERE id IN ('party-haja', 'party-nf2')");

  // 5. Ensure MK and SALA exist in customers as Indian parties
  await sql.query(`
    INSERT INTO customers (id, code, name, default_rate, status, entity_type, party_type)
    VALUES ('party-mk', 'MK', 'MK', 38.25, 'ACTIVE', 'PARTY', 'INDIA')
    ON CONFLICT (code) DO UPDATE SET entity_type = 'PARTY', party_type = 'INDIA'
  `);
  await sql.query(`
    INSERT INTO customers (id, code, name, default_rate, status, entity_type, party_type)
    VALUES ('party-sala', 'SALA', 'SALA', 38.25, 'ACTIVE', 'PARTY', 'INDIA')
    ON CONFLICT (code) DO UPDATE SET entity_type = 'PARTY', party_type = 'INDIA'
  `);

  // 6. Reassign any distribution split from non-MK/SALA to dist-mk
  await sql.query("UPDATE distribution_splits SET distributor_id = 'dist-mk' WHERE distributor_id NOT IN ('dist-mk', 'dist-sala')");

  // 7. Clean up distributors: keep MK, SALA (IND) and HAJA, SARAB, NF2 (AED)
  await sql.query("UPDATE distributors SET code = 'SARAB', name = 'SARAB' WHERE code = 'SARABU'");
  await sql.query("UPDATE distributors SET group_type = 'IND', partner_type = 'INDIA_DISTRIBUTOR' WHERE code IN ('MK', 'SALA')");
  await sql.query("UPDATE distributors SET group_type = 'AED', partner_type = 'WHOLESALE_PARTNER' WHERE code IN ('HAJA', 'SARAB', 'NF2')");
  await sql.query("DELETE FROM distributors WHERE code NOT IN ('MK', 'SALA', 'HAJA', 'SARAB', 'NF2')");

  // 8. Clean up bank_distrip_accounts: keep MK and SALA
  await sql.query("DELETE FROM bank_distrip_accounts WHERE account_code NOT IN ('MK', 'SALA')");

  // 9. Verify results
  const remainingParties = await sql.query("SELECT id, code, name, entity_type, party_type FROM customers WHERE entity_type = 'PARTY' ORDER BY party_type, name");
  console.log("REMAINING PARTIES IN CUSTOMERS:", remainingParties);

  const remainingDists = await sql.query("SELECT id, code, name, group_type, partner_type FROM distributors ORDER BY group_type, name");
  console.log("REMAINING DISTRIBUTORS:", remainingDists);

  const remainingBankAccs = await sql.query("SELECT id, account_code, account_name FROM bank_distrip_accounts ORDER BY account_name");
  console.log("REMAINING BANK DISTRIP ACCOUNTS:", remainingBankAccs);

  console.log("Cleanup script completed successfully!");
}

main().catch(console.error);
