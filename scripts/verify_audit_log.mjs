import { query } from "../src/lib/db.ts";

async function verifyAuditLogs() {
  const logs = await query(`SELECT id, entity_name, entity_id, action, reason, created_at FROM audit_logs WHERE action = 'PERMANENT_DELETE' ORDER BY created_at DESC LIMIT 5`);
  console.log(`Found ${logs.length} PERMANENT_DELETE logs:`);
  for (const l of logs) {
    console.log(`  [${l.created_at}] Action: ${l.action}, Entity: ${l.entity_name} (${l.entity_id}), Reason: ${l.reason}`);
  }
}

verifyAuditLogs().catch(console.error);
