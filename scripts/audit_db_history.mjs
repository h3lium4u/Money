import { query } from "../src/lib/db.ts";

async function inspectHistory() {
  console.log("=== DATABASE READ-ONLY SAFETY AUDIT ===\n");

  // 1. Audit logs
  console.log("--- 1. audit_logs ---");
  const auditLogs = await query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50`);
  console.log(`Found ${auditLogs.length} audit logs:`);
  for (const log of auditLogs) {
    console.log(`  [${log.created_at}] Action: ${log.action}, Entity: ${log.entity_type} (${log.entity_id}), Details:`, JSON.stringify(log.details));
  }

  // 2. scheduled_wipes / backup records
  console.log("\n--- 2. scheduled_wipes ---");
  const wipes = await query(`SELECT * FROM scheduled_wipes ORDER BY created_at DESC LIMIT 10`);
  console.log(`Found ${wipes.length} wipe records:`);
  for (const w of wipes) {
    console.log(`  ID: ${w.id}, Scheduled: ${w.scheduled_at}, Status: ${w.status}, Mode: ${w.mode}`);
    if (w.backup_data) {
      console.log(`    Backup Data present: length = ${JSON.stringify(w.backup_data).length} chars`);
    }
  }

  // 3. Customers
  console.log("\n--- 3. customers ---");
  const customers = await query(`SELECT id, name, code, phone, party_type, created_at FROM customers ORDER BY created_at ASC`);
  console.log(`Found ${customers.length} customers:`);
  for (const c of customers) {
    console.log(`  ${c.name} (${c.code || "NO_CODE"}) - Type: ${c.party_type}, Phone: ${c.phone}, Created: ${c.created_at}`);
  }

  // 4. Distributors
  console.log("\n--- 4. distributors ---");
  const distributors = await query(`SELECT id, name, code, status, created_at FROM distributors ORDER BY created_at ASC`);
  console.log(`Found ${distributors.length} distributors:`);
  for (const d of distributors) {
    console.log(`  ${d.name} (${d.code}) - Status: ${d.status}, Created: ${d.created_at}`);
  }

  // 5. Bank Distrip Accounts & Records
  console.log("\n--- 5. bank_distrip_accounts & records ---");
  const accounts = await query(`SELECT * FROM bank_distrip_accounts`);
  console.log(`Found ${accounts.length} bank distrip accounts:`);
  for (const a of accounts) {
    console.log(`  Account: ${a.account_name} (${a.code || "N/A"}) - Balance: ${a.current_balance}`);
  }

  const bRecords = await query(`SELECT * FROM bank_distrip_records ORDER BY created_at DESC LIMIT 10`);
  console.log(`Found ${bRecords.length} bank distrip records:`);
  for (const r of bRecords) {
    console.log(`  Date: ${r.record_date}, Order: ${r.order_inr}, Com: ${r.commission_inr}, Paid: ${r.paid_inr}, Bal: ${r.balance_inr}`);
  }

  // 6. Check Postgres transaction/table history / WAL / Vacuum
  console.log("\n--- 6. Table row counts & creation info ---");
  const tables = [
    "transactions",
    "customer_payments",
    "distribution_splits",
    "distributors",
    "customers",
    "bank_distrip_accounts",
    "bank_distrip_records",
    "audit_logs",
    "expenses",
    "wholesale_settlements",
    "scheduled_wipes"
  ];
  for (const t of tables) {
    const res = await query(`SELECT count(*) as cnt FROM ${t}`);
    console.log(`  ${t.padEnd(25)} : ${res[0].cnt} rows`);
  }
}

inspectHistory().catch(console.error);
