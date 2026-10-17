import { query, queryOne, execute } from "@/lib/db";
import { invalidateAllCaches, invalidateBankDistripCache } from "@/lib/repository";
import { generateNormalizedMasterWorkbook } from "@/lib/reports/normalized-master-generator";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type WipeScope = "all" | "week" | "month" | "year";

export interface ScheduledWipeStatus {
  isScheduled: boolean;
  id?: string;
  scope?: WipeScope;
  scopeLabel?: string;
  status: "IDLE" | "SCHEDULED" | "REVOKED" | "EXECUTED";
  scheduledAt?: string;
  executeAt?: string;
  remainingSeconds: number;
  remainingFormatted: string;
  backupDownloaded?: boolean;
}

const STATE_FILE_PATH = path.resolve(process.cwd(), "data", "scheduled_wipe_state.json");
let isTableInitialized = false;

export function getScopeLabel(scope?: WipeScope): string {
  switch (scope) {
    case "week":
      return "Older than 1 Week (> 7 Days)";
    case "month":
      return "Older than 1 Month (> 30 Days)";
    case "year":
      return "Older than 1 Year (> 365 Days)";
    case "all":
    default:
      return "Entire Ledger (Complete Reset)";
  }
}

async function ensureTableInitialized() {
  if (isTableInitialized) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS scheduled_wipes (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        scope TEXT DEFAULT 'all',
        scheduled_at TEXT NOT NULL,
        execute_at TEXT NOT NULL,
        backup_downloaded BOOLEAN DEFAULT false,
        created_at TEXT NOT NULL
      )
    `);
    // Attempt column migration if scope is missing
    try {
      await execute(`ALTER TABLE scheduled_wipes ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'all'`);
    } catch {}
    isTableInitialized = true;
  } catch (err) {
    console.warn("[ScheduledWipe] DB table check warning (falling back to JSON store):", err);
  }
}

async function readStateFile(): Promise<any | null> {
  try {
    const raw = await fs.readFile(STATE_FILE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeStateFile(data: any): Promise<void> {
  try {
    const dir = path.dirname(STATE_FILE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(STATE_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("[ScheduledWipe] Error writing state file:", err);
  }
}

function formatRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

/**
 * Retrieves the current scheduled wipe status.
 * Automatically triggers execution if the scheduled execute_at has passed.
 */
export async function getScheduledWipeStatus(): Promise<ScheduledWipeStatus> {
  await ensureTableInitialized();

  let activeRecord: any = null;

  // 1. Try querying database
  try {
    activeRecord = await queryOne(`
      SELECT * FROM scheduled_wipes
      WHERE status = 'SCHEDULED'
      ORDER BY created_at DESC
      LIMIT 1
    `);
  } catch (err) {
    console.warn("[ScheduledWipe] DB query error, falling back to state file:", err);
  }

  // 2. Fallback to state file if DB had no record
  if (!activeRecord) {
    const fileState = await readStateFile();
    if (fileState && fileState.status === "SCHEDULED") {
      activeRecord = fileState;
    }
  }

  if (!activeRecord) {
    return {
      isScheduled: false,
      status: "IDLE",
      remainingSeconds: 0,
      remainingFormatted: "0s",
      backupDownloaded: false,
    };
  }

  const now = Date.now();
  const executeAtTime = new Date(activeRecord.execute_at).getTime();
  const remainingSeconds = Math.max(0, Math.ceil((executeAtTime - now) / 1000));
  const scope: WipeScope = (activeRecord.scope as WipeScope) || "all";

  // Check if schedule expired and needs execution
  if (remainingSeconds <= 0) {
    console.log(`[ScheduledWipe] Scheduled timer reached 0 (${scope}). Executing automatic clean...`);
    try {
      await executeWipeNow(activeRecord.id, scope);
    } catch (e) {
      console.error("[ScheduledWipe] Auto-execution error:", e);
    }

    return {
      isScheduled: false,
      id: activeRecord.id,
      scope,
      scopeLabel: getScopeLabel(scope),
      status: "EXECUTED",
      scheduledAt: activeRecord.scheduled_at,
      executeAt: activeRecord.execute_at,
      remainingSeconds: 0,
      remainingFormatted: "Completed",
      backupDownloaded: true,
    };
  }

  return {
    isScheduled: true,
    id: activeRecord.id,
    scope,
    scopeLabel: getScopeLabel(scope),
    status: "SCHEDULED",
    scheduledAt: activeRecord.scheduled_at,
    executeAt: activeRecord.execute_at,
    remainingSeconds,
    remainingFormatted: formatRemaining(remainingSeconds),
    backupDownloaded: Boolean(activeRecord.backup_downloaded),
  };
}

/**
 * Schedules a ledger & Excel clear with safety buffer (default 10 minutes).
 */
export async function scheduleWipe(delayMinutes = 10, scope: WipeScope = "all"): Promise<ScheduledWipeStatus> {
  await ensureTableInitialized();

  // Cancel any prior pending schedule
  await revokeWipe();

  const id = `wipe_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const now = new Date();
  const executeAt = new Date(now.getTime() + delayMinutes * 60 * 1000);

  const newRecord = {
    id,
    status: "SCHEDULED",
    scope,
    scheduled_at: now.toISOString(),
    execute_at: executeAt.toISOString(),
    backup_downloaded: true,
    created_at: now.toISOString(),
  };

  try {
    await execute(`
      INSERT INTO scheduled_wipes (id, status, scope, scheduled_at, execute_at, backup_downloaded, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [newRecord.id, newRecord.status, newRecord.scope, newRecord.scheduled_at, newRecord.execute_at, true, newRecord.created_at]);
  } catch (err) {
    console.warn("[ScheduledWipe] Failed to insert schedule into DB:", err);
  }

  await writeStateFile(newRecord);

  const remainingSeconds = delayMinutes * 60;
  return {
    isScheduled: true,
    id,
    scope,
    scopeLabel: getScopeLabel(scope),
    status: "SCHEDULED",
    scheduledAt: newRecord.scheduled_at,
    executeAt: newRecord.execute_at,
    remainingSeconds,
    remainingFormatted: formatRemaining(remainingSeconds),
    backupDownloaded: true,
  };
}

/**
 * Revokes / Cancels any currently pending scheduled wipe.
 */
export async function revokeWipe(): Promise<ScheduledWipeStatus> {
  await ensureTableInitialized();

  try {
    await execute(`
      UPDATE scheduled_wipes
      SET status = 'REVOKED'
      WHERE status = 'SCHEDULED'
    `);
  } catch (err) {
    console.warn("[ScheduledWipe] Failed to update revoked status in DB:", err);
  }

  const fileState = await readStateFile();
  if (fileState && fileState.status === "SCHEDULED") {
    fileState.status = "REVOKED";
    await writeStateFile(fileState);
  }

  return {
    isScheduled: false,
    status: "REVOKED",
    remainingSeconds: 0,
    remainingFormatted: "Revoked",
  };
}

/**
 * Executes the ledger and Excel clear based on chosen scope.
 * Scope options:
 * - "all": Complete wipe of all transactions, splits, payments, settlements, non-party customers. Resets balances to 0.
 * - "week": Clears data older than 7 days, preserves last 7 days.
 * - "month": Clears data older than 30 days, preserves last 30 days.
 * - "year": Clears data older than 365 days, preserves current year.
 */
export async function executeWipeNow(wipeId?: string, forceScope?: WipeScope): Promise<void> {
  let scope: WipeScope = forceScope || "all";

  // If scope not provided, try to detect from active wipe record
  if (!forceScope) {
    try {
      const rec = await queryOne(`SELECT scope FROM scheduled_wipes WHERE status = 'SCHEDULED' ORDER BY created_at DESC LIMIT 1`);
      if (rec?.scope) scope = rec.scope as WipeScope;
    } catch {}
  }

  console.log(`[ScheduledWipe] Executing clear with scope: ${scope}...`);

  if (scope === "all") {
    // ── Scope ALL: Complete Reset ──
    try { await execute(`DELETE FROM distribution_splits`); } catch (err) { console.warn("Delete splits:", err); }
    try { await execute(`DELETE FROM customer_payments`); } catch (err) { console.warn("Delete payments:", err); }
    try { await execute(`DELETE FROM transactions`); } catch (err) { console.warn("Delete transactions:", err); }
    try { await execute(`DELETE FROM bank_distrip_records`); } catch (err) { console.warn("Delete bank records:", err); }
    try { await execute(`DELETE FROM wholesale_settlements`); } catch (err) { console.warn("Delete wholesale settlements:", err); }

    // Preserve all CUSTOMER and PARTY entity records (do not delete customer entity types)
    try {
      await execute(`
        DELETE FROM customers 
        WHERE entity_type NOT IN ('PARTY', 'CUSTOMER') AND entity_type IS NOT NULL
      `);
    } catch (err) { console.warn("Delete invalid customers:", err); }

    // Preserve active distributors, only remove inactive test entries
    try {
      await execute(`
        DELETE FROM distributors 
        WHERE status != 'ACTIVE' AND code NOT IN ('HAJA', 'MK', 'NF2', 'SALA', 'SARAB')
      `);
    } catch (err) { console.warn("Clean distributors:", err); }

  } else {
    // ── Time-based Scopes: week (7d), month (30d), year (365d) ──
    const now = Date.now();
    let daysToKeep = 7;
    if (scope === "month") daysToKeep = 30;
    if (scope === "year") daysToKeep = 365;

    const cutoffDate = new Date(now - daysToKeep * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    console.log(`[ScheduledWipe] Wiping records older than ${cutoffDate} (${daysToKeep} days retention)...`);

    // 1. Delete distribution splits for transactions older than cutoff
    try {
      await execute(`
        DELETE FROM distribution_splits 
        WHERE transaction_id IN (SELECT id FROM transactions WHERE transaction_date < $1)
      `, [cutoffDate]);
    } catch (err) { console.warn("Delete old splits:", err); }

    // 2. Delete transactions older than cutoff
    try {
      await execute(`DELETE FROM transactions WHERE transaction_date < $1`, [cutoffDate]);
    } catch (err) { console.warn("Delete old transactions:", err); }

    // 3. Delete customer payments older than cutoff
    try {
      await execute(`DELETE FROM customer_payments WHERE payment_date < $1`, [cutoffDate]);
    } catch (err) { console.warn("Delete old payments:", err); }

    // 4. Delete bank distrip records older than cutoff
    try {
      await execute(`DELETE FROM bank_distrip_records WHERE record_date < $1`, [cutoffDate]);
    } catch (err) { console.warn("Delete old bank records:", err); }

    // 5. Delete wholesale settlements older than cutoff
    try {
      await execute(`DELETE FROM wholesale_settlements WHERE settlement_date < $1`, [cutoffDate]);
    } catch (err) { console.warn("Delete old settlements:", err); }
  }

  // Invalidate in-memory caches
  invalidateAllCaches();
  invalidateBankDistripCache();

  // Update wipe record status to EXECUTED
  if (wipeId) {
    try {
      await execute(`UPDATE scheduled_wipes SET status = 'EXECUTED' WHERE id = $1`, [wipeId]);
    } catch {}
  } else {
    try {
      await execute(`UPDATE scheduled_wipes SET status = 'EXECUTED' WHERE status = 'SCHEDULED'`);
    } catch {}
  }

  const fileState = await readStateFile();
  if (fileState) {
    fileState.status = "EXECUTED";
    await writeStateFile(fileState);
  }

  // Regenerate clean master workbook
  try {
    const buffer = await generateNormalizedMasterWorkbook();
    const filePath = path.resolve(process.cwd(), "Remittance_Business_Normalized_Master.xlsx");
    await fs.writeFile(filePath, buffer);
    console.log(`[ScheduledWipe] Remittance_Business_Normalized_Master.xlsx refreshed (${buffer.length} bytes)`);
  } catch (err) {
    console.error("[ScheduledWipe] Failed to regenerate clean master Excel:", err);
  }
}
