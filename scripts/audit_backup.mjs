import { query } from "../src/lib/db.ts";

async function checkBackups() {
  const cols = await query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'scheduled_wipes'`);
  console.log("Columns in scheduled_wipes:", cols.map(c => `${c.column_name} (${c.data_type})`));
  const rows = await query(`SELECT * FROM scheduled_wipes`);
  console.log("Rows in scheduled_wipes:", rows);
}

checkBackups().catch(console.error);
