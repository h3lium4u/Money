import { query, queryOne, execute } from "@/lib/db";
import { invalidateAllCaches, invalidateBankDistripCache } from "@/lib/repository";
import { generateNormalizedMasterWorkbook } from "@/lib/reports/normalized-master-generator";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export interface ScheduledWipeStatus {
  isScheduled: boolean;
  id?: string;
  status: "IDLE" | "SCHEDULED" | "REVOKED" | "EXECUTED";
  scheduledAt?: string;
  executeAt?: string;
  remainingSeconds: number;
  remainingFormatted: string;
  backupDownloaded?: boolean;
}

const STATE_FILE_PATH = path.resolve(process.cwd(), "data", "scheduled_wipe_state.json");
let isTableInitialized = false;

async function ensureTableInitialized() {
  if (isTableInitialized) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS scheduled_wipes (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        execute_at TEXT NOT NULL,
        backup_downloaded BOOLEAN DEFAULT false,
        created_at TEXT NOT NULL
      )
    `);
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
      remainingFormatted: "None",
    };
  }

  const now = Date.now();
  const executeTime = new Date(activeRecord.execute_at).getTime();
  const remainingSeconds = Math.max(0, Math.ceil((executeTime - now) / 1000));

  // If 24 hours have elapsed, execute the scheduled wipe automatically
  if (remainingSeconds <= 0) {
    console.log(`[ScheduledWipe] 24-hour delay reached for wipe ${activeRecord.id}. Executing complete ledger clear...`);
    await executeWipeNow(activeRecord.id);
    return {
      isScheduled: false,
      id: activeRecord.id,
      status: "EXECUTED",
      scheduledAt: activeRecord.scheduled_at,
      executeAt: activeRecord.execute_at,
      remainingSeconds: 0,
      remainingFormatted: "Executed",
    };
  }

  return {
    isScheduled: true,
    id: activeRecord.id,
    status: "SCHEDULED",
    scheduledAt: activeRecord.scheduled_at,
    executeAt: activeRecord.execute_at,
    remainingSeconds,
    remainingFormatted: formatRemaining(remainingSeconds),
    backupDownloaded: Boolean(activeRecord.backup_downloaded),
  };
}

/**
 * Schedules a complete ledger & Excel clear for 24 hours (86,400 seconds) in the future.
 */
export async function scheduleWipe(delayHours = 24): Promise<ScheduledWipeStatus> {
  await ensureTableInitialized();

  // Cancel any prior pending schedule
  await revokeWipe();

  const id = `wipe_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const now = new Date();
  const executeAt = new Date(now.getTime() + delayHours * 60 * 60 * 1000);

  const newRecord = {
    id,
    status: "SCHEDULED",
    scheduled_at: now.toISOString(),
    execute_at: executeAt.toISOString(),
    backup_downloaded: true,
    created_at: now.toISOString(),
  };

  try {
    await execute(`
      INSERT INTO scheduled_wipes (id, status, scheduled_at, execute_at, backup_downloaded, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [newRecord.id, newRecord.status, newRecord.scheduled_at, newRecord.execute_at, true, newRecord.created_at]);
  } catch (err) {
    console.warn("[ScheduledWipe] Failed to insert schedule into DB:", err);
  }

  await writeStateFile(newRecord);

  const remainingSeconds = delayHours * 3600;
  return {
    isScheduled: true,
    id,
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
 * Immediately halts the countdown and preserves all data intact.
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
 * Executes the complete ledger and Excel clear.
 * - Deletes all transactions, payments, distribution splits, and bank distrip records.
 * - Cleans non-party customer accounts.
 * - Preserves the 5 master parties (HAJA, MK, NF2, SALA, SARAB) and master distributor accounts.
 * - Automatically regenerates a pristine Remittance_Business_Normalized_Master.xlsx.
 */
export async function executeWipeNow(wipeId?: string): Promise<void> {
  console.log("[ScheduledWipe] Executing complete ledger clear...");

  // 1. Transactional tables
  try {
    await execute(`DELETE FROM distribution_splits`);
  } catch (err) {
    console.warn("[ScheduledWipe] Delete splits:", err);
  }

  try {
    await execute(`DELETE FROM customer_payments`);
  } catch (err) {
    console.warn("[ScheduledWipe] Delete payments:", err);
  }

  try {
    await execute(`DELETE FROM transactions`);
  } catch (err) {
    console.warn("[ScheduledWipe] Delete transactions:", err);
  }

  try {
    await execute(`DELETE FROM bank_distrip_records`);
  } catch (err) {
    console.warn("[ScheduledWipe] Delete bank records:", err);
  }

  try {
    await execute(`DELETE FROM wholesale_settlements`);
  } catch (err) {
    console.warn("[ScheduledWipe] Delete wholesale settlements:", err);
  }

  // 2. Clean temporary customer accounts, strictly preserving master parties
  try {
    await execute(`
      DELETE FROM customers 
      WHERE entity_type != 'PARTY' OR entity_type IS NULL
    `);
  } catch (err) {
    console.warn("[ScheduledWipe] Delete non-party customers:", err);
  }

  // 3. Reset balances on preserved master parties
  try {
    await execute(`
      UPDATE customers 
      SET total_inr = 0, total_aed = 0, total_paid = 0, outstanding_balance = 0 
      WHERE entity_type = 'PARTY'
    `);
  } catch (err) {
    console.warn("[ScheduledWipe] Reset party totals:", err);
  }

  // 4. Remove any test distributors, keep official distributors (HAJA, MK, NF2, SALA, SARAB)
  try {
    await execute(`
      DELETE FROM distributors 
      WHERE code NOT IN ('HAJA', 'MK', 'NF2', 'SALA', 'SARAB')
    `);
  } catch (err) {
    console.warn("[ScheduledWipe] Clean distributors:", err);
  }

  // 5. Invalidate in-memory caches
  invalidateAllCaches();
  invalidateBankDistripCache();

  // 6. Update wipe record status to EXECUTED
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

  // 7. Regenerate Remittance_Business_Normalized_Master.xlsx with zero records and fresh structure
  try {
    const buffer = await generateNormalizedMasterWorkbook();
    const filePath = path.resolve(process.cwd(), "Remittance_Business_Normalized_Master.xlsx");
    await fs.writeFile(filePath, buffer);
    console.log(`[ScheduledWipe] Remittance_Business_Normalized_Master.xlsx refreshed clean (${buffer.length} bytes)`);
  } catch (err) {
    console.error("[ScheduledWipe] Failed to regenerate clean master Excel:", err);
  }
}
