import { query, execute } from "../src/lib/db.ts";

async function migrateRateConventions() {
  console.log("=== EXPLICIT RATE CONVENTION BACKWARD-COMPATIBLE MIGRATION ===");
  
  console.log("1. Adding customer_rate_convention column...");
  await execute(`
    ALTER TABLE transactions 
    ADD COLUMN IF NOT EXISTS customer_rate_convention VARCHAR(20) DEFAULT 'AED_PER_1000'
  `);

  console.log("2. Adding base_rate_convention column...");
  await execute(`
    ALTER TABLE transactions 
    ADD COLUMN IF NOT EXISTS base_rate_convention VARCHAR(20) DEFAULT 'INR_PER_AED'
  `);

  console.log("3. Verifying columns...");
  const cols = await query(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'transactions' 
      AND column_name IN ('customer_rate_convention', 'base_rate_convention')
  `);
  console.log("Migrated columns:", cols);
  console.log("✔ Rate convention migration complete successfully!");
}

migrateRateConventions().catch(console.error);
