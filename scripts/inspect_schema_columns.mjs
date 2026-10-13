import { query } from "../src/lib/db.ts";

async function inspect() {
  const cols = await query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position`);
  console.log("=== TRANSACTIONS TABLE SCHEMA ===");
  cols.forEach(c => console.log(`  ${c.column_name.padEnd(25)}: ${c.data_type}`));
}

inspect().catch(console.error);
