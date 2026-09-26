import { getPool, isNeonEnabled } from "./db.ts";

export type StorageStatus = "normal" | "getting-high" | "high" | "critical";

export interface StorageStatusInfo {
  status: StorageStatus;
  label: string;
  badgeClass: string;
  barColorClass: string;
  textColorClass: string;
  message: string;
}

export interface TableStorageInfo {
  tableName: string;
  totalBytes: number;
  formattedSize: string;
}

export interface DatabaseUsageResult {
  usedBytes: number;
  limitBytes: number | null;
  availableBytes: number | null;
  usagePercent: number | null;
  usedFormatted: string;
  availableFormatted: string | null;
  limitFormatted: string | null;
  status: StorageStatus;
  statusLabel: string;
  statusMessage: string;
  limitKnown: boolean;
  checkedAt: string;
  databaseName: string;
  provider: string;
  topTables: TableStorageInfo[];
  isSimulated?: boolean;
  simulationScenario?: string;
}

/**
 * Format bytes into human-readable string (B, KB, MB, GB, TB)
 * Following clean formatting (e.g. 310 MB, 190 MB, 8.0 MB)
 */
export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return "Unavailable";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  // Show no decimals if exactly an integer, else up to `decimals`
  const formatted = val % 1 === 0 ? val.toFixed(0) : val.toFixed(decimals);
  return `${formatted} ${sizes[i]}`;
}

/**
 * Calculate storage status according to thresholds:
 * 0–70%   -> normal
 * 70–85%  -> getting-high
 * 85–95%  -> high
 * 95%+    -> critical
 */
export function getStorageStatus(percent: number | null): StorageStatusInfo {
  if (percent === null || isNaN(percent)) {
    return {
      status: "normal",
      label: "Storage Healthy",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      barColorClass: "bg-emerald-500",
      textColorClass: "text-emerald-700",
      message: "✓ Storage healthy (Quota limit not configured)",
    };
  }

  if (percent >= 95) {
    return {
      status: "critical",
      label: "Critical Storage",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
      barColorClass: "bg-rose-600",
      textColorClass: "text-rose-700",
      message: "🚨 Critical storage level (95%+ used) — immediate cleanup or plan upgrade required",
    };
  }

  if (percent >= 85) {
    return {
      status: "high",
      label: "High Storage",
      badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
      barColorClass: "bg-orange-500",
      textColorClass: "text-orange-700",
      message: "⚠ High storage usage (85%–95% used) — approaching capacity",
    };
  }

  if (percent >= 70) {
    return {
      status: "getting-high",
      label: "Getting High",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      barColorClass: "bg-amber-500",
      textColorClass: "text-amber-700",
      message: "⚠ Storage getting high (70%–85% used)",
    };
  }

  return {
    status: "normal",
    label: "Storage Healthy",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    barColorClass: "bg-emerald-500",
    textColorClass: "text-emerald-700",
    message: "✓ Storage healthy",
  };
}

/**
 * Attempt to retrieve storage limit from:
 * 1. Explicit env variables (DATABASE_STORAGE_LIMIT_BYTES, NEON_STORAGE_LIMIT_MB)
 * 2. Neon API if NEON_API_KEY is configured
 */
export async function resolveStorageLimit(): Promise<{ limitBytes: number | null; source: string | null }> {
  // 1. Explicit GB environment variables (e.g. 0.5 or 0.5GB or 1)
  const gbEnv = process.env.NEON_STORAGE_LIMIT_GB || process.env.DATABASE_STORAGE_LIMIT_GB;
  if (gbEnv) {
    const cleanGb = gbEnv.toString().replace(/gb/i, "").trim();
    const gb = parseFloat(cleanGb);
    if (!isNaN(gb) && gb > 0) {
      // 0.5 GB maps cleanly to 500 MB (500 * 1024 * 1024)
      const mbEquivalent = gb === 0.5 ? 500 : Math.round(gb * 1024);
      return { limitBytes: mbEquivalent * 1024 * 1024, source: "env:STORAGE_LIMIT_GB" };
    }
  }

  // 2. Explicit MB environment variables (e.g. 500 or 500MB or 512)
  const mbEnv = process.env.NEON_STORAGE_LIMIT_MB || process.env.DATABASE_STORAGE_LIMIT_MB;
  if (mbEnv) {
    const cleanMb = mbEnv.toString().replace(/mb/i, "").trim();
    const mb = parseFloat(cleanMb);
    if (!isNaN(mb) && mb > 0) {
      return { limitBytes: Math.round(mb * 1024 * 1024), source: "env:STORAGE_LIMIT_MB" };
    }
  }

  // 3. Explicit Bytes environment variable (e.g. 524288000)
  if (process.env.DATABASE_STORAGE_LIMIT_BYTES) {
    const val = parseInt(process.env.DATABASE_STORAGE_LIMIT_BYTES.toString().trim(), 10);
    if (!isNaN(val) && val > 0) {
      return { limitBytes: val, source: "env:DATABASE_STORAGE_LIMIT_BYTES" };
    }
  }

  // 2. Neon API integration if NEON_API_KEY is provided
  if (process.env.NEON_API_KEY) {
    try {
      // Find project from DATABASE_URL or NEON_PROJECT_ID
      const projectId = process.env.NEON_PROJECT_ID;
      if (projectId) {
        const res = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}`, {
          headers: {
            Authorization: `Bearer ${process.env.NEON_API_KEY}`,
            Accept: "application/json",
          },
        });
        if (res.ok) {
          const json = await res.json();
          // Extract quota / limit if present in Neon API response
          const quotaBytes = json.project?.quota?.storage_limit_bytes || json.project?.consumption_limits?.storage_bytes;
          if (quotaBytes && typeof quotaBytes === "number") {
            return { limitBytes: quotaBytes, source: "neon_api" };
          }
        }
      }
    } catch (err) {
      console.warn("Could not retrieve quota from Neon API:", err);
    }
  }

  // Default: Do NOT assume or hardcode a fake limit as authoritative
  return { limitBytes: null, source: null };
}

/**
 * Query real database size from PostgreSQL:
 * SELECT pg_database_size(current_database());
 */
export async function getLiveDatabaseStats(): Promise<{
  sizeBytes: number;
  dbName: string;
  topTables: TableStorageInfo[];
}> {
  const p = getPool();

  if (p) {
    const dbInfo = await p.query(
      "SELECT pg_database_size(current_database()) as size_bytes, current_database() as db_name"
    );
    const sizeBytes = parseInt(dbInfo.rows[0]?.size_bytes || "0", 10);
    const dbName = dbInfo.rows[0]?.db_name || "neondb";

    let topTables: TableStorageInfo[] = [];
    try {
      const tableRows = await p.query(`
        SELECT 
          table_name,
          pg_total_relation_size(quote_ident(table_name)) as total_bytes
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY total_bytes DESC
        LIMIT 8
      `);
      topTables = tableRows.rows.map((r: any) => ({
        tableName: r.table_name,
        totalBytes: parseInt(r.total_bytes || "0", 10),
        formattedSize: formatBytes(parseInt(r.total_bytes || "0", 10)),
      }));
    } catch {
      // Table breakdown is non-critical
    }

    return { sizeBytes, dbName, topTables };
  }

  // SQLite fallback if ever needed
  try {
    const { getSqliteDb } = await import("./sqlite_fallback");
    const sqlite = getSqliteDb();
    const countRow = sqlite.prepare("PRAGMA page_count").get() as any;
    const sizeRow = sqlite.prepare("PRAGMA page_size").get() as any;
    const count = Number(Object.values(countRow || {})[0] || 0);
    const size = Number(Object.values(sizeRow || {})[0] || 4096);
    const sizeBytes = count * size;
    return { sizeBytes, dbName: "sqlite.db", topTables: [] };
  } catch {
    return { sizeBytes: 0, dbName: "unknown", topTables: [] };
  }
}

/**
 * Main function to retrieve database storage usage
 * Supports test scenarios (e.g. ?scenario=normal / getting-high / high / critical / unavailable)
 * without altering real database data.
 */
export async function getDatabaseUsage(options?: {
  scenario?: string | null;
  simulatePercent?: number | null;
}): Promise<DatabaseUsageResult> {
  const checkedAt = new Date().toISOString();

  // Test / Simulation Scenario Handling
  if (options?.scenario || options?.simulatePercent !== null && options?.simulatePercent !== undefined) {
    const totalSimLimit = 500 * 1024 * 1024; // 500 MB base for realistic simulation
    let pct: number | null = null;
    let limitBytes: number | null = totalSimLimit;
    const scenario = (options.scenario || "").toLowerCase();

    if (scenario === "unavailable") {
      limitBytes = null;
      pct = null;
    } else if (scenario === "normal" || options.simulatePercent === 62) {
      pct = 62;
    } else if (scenario === "getting-high" || options.simulatePercent === 76) {
      pct = 76;
    } else if (scenario === "high" || options.simulatePercent === 89) {
      pct = 89;
    } else if (scenario === "critical" || options.simulatePercent === 97) {
      pct = 97;
    } else if (typeof options.simulatePercent === "number") {
      pct = Math.min(100, Math.max(0, options.simulatePercent));
    } else {
      pct = 62;
    }

    let usedBytes = 0;
    let availableBytes: number | null = null;

    if (limitBytes !== null && pct !== null) {
      usedBytes = Math.round((totalSimLimit * pct) / 100);
      availableBytes = Math.max(0, limitBytes - usedBytes);
    } else {
      usedBytes = 8 * 1024 * 1024; // 8 MB
    }

    const statusInfo = getStorageStatus(pct);

    return {
      usedBytes,
      limitBytes,
      availableBytes,
      usagePercent: pct,
      usedFormatted: formatBytes(usedBytes),
      availableFormatted: limitBytes !== null ? formatBytes(availableBytes) : null,
      limitFormatted: limitBytes !== null ? formatBytes(limitBytes) : null,
      status: statusInfo.status,
      statusLabel: statusInfo.label,
      statusMessage: statusInfo.message,
      limitKnown: limitBytes !== null,
      checkedAt,
      databaseName: "neondb",
      provider: "Neon PostgreSQL",
      topTables: [
        { tableName: "distribution_splits", totalBytes: 81920, formattedSize: "80 KB" },
        { tableName: "customer_payments", totalBytes: 49152, formattedSize: "48 KB" },
        { tableName: "transactions", totalBytes: 49152, formattedSize: "48 KB" },
        { tableName: "distributors", totalBytes: 49152, formattedSize: "48 KB" },
        { tableName: "customers", totalBytes: 40960, formattedSize: "41 KB" },
      ],
      isSimulated: true,
      simulationScenario: scenario || `percent-${pct}`,
    };
  }

  // Live Database Execution
  const { sizeBytes, dbName, topTables } = await getLiveDatabaseStats();
  const { limitBytes } = await resolveStorageLimit();

  const limitKnown = limitBytes !== null && limitBytes > 0;
  let usagePercent: number | null = null;
  let availableBytes: number | null = null;

  if (limitKnown && limitBytes !== null) {
    usagePercent = Math.min(100, Math.round((sizeBytes / limitBytes) * 100));
    availableBytes = Math.max(0, limitBytes - sizeBytes);
  }

  const statusInfo = getStorageStatus(usagePercent);

  return {
    usedBytes: sizeBytes,
    limitBytes: limitKnown ? limitBytes : null,
    availableBytes: limitKnown ? availableBytes : null,
    usagePercent: limitKnown ? usagePercent : null,
    usedFormatted: formatBytes(sizeBytes),
    availableFormatted: limitKnown ? formatBytes(availableBytes) : null,
    limitFormatted: limitKnown ? formatBytes(limitBytes) : null,
    status: statusInfo.status,
    statusLabel: statusInfo.label,
    statusMessage: statusInfo.message,
    limitKnown,
    checkedAt,
    databaseName: dbName,
    provider: isNeonEnabled() ? "Neon PostgreSQL" : "SQLite Local",
    topTables,
    isSimulated: false,
  };
}
