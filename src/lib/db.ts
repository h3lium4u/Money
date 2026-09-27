import { Pool, neon, neonConfig, types } from "@neondatabase/serverless";
import ws from "ws";

// Neon requires ws in Node.js environments if using WebSockets/Pool
neonConfig.webSocketConstructor = ws;

// Keep PostgreSQL DATE (OID 1082) as YYYY-MM-DD string to avoid timezone offsets
types.setTypeParser(1082, (val: string) => val);

let pool: Pool | null = null;
let httpSql: ReturnType<typeof neon> | null = null;

export function isNeonEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

/**
 * Returns Neon HTTP client optimized for Serverless / Edge runtimes.
 * Does not require persistent WebSockets, zero connection pooling overhead,
 * and handles Neon compute auto-suspend cold-starts seamlessly.
 */
export function getNeonHttp() {
  if (!isNeonEnabled()) return null;
  if (!httpSql) {
    httpSql = neon(process.env.DATABASE_URL!.trim());
  }
  return httpSql;
}

/**
 * Fallback connection pool for legacy or session-based needs.
 * Uses 30,000ms timeout so Neon compute wake-up never aborts prematurely.
 */
export function getPool(): Pool | null {
  if (!isNeonEnabled()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL!.trim(),
      connectionTimeoutMillis: 30000, // 30s timeout allows Neon serverless to wake from sleep
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (isNeonEnabled()) {
    const sqlClient = getNeonHttp();
    if (sqlClient) {
      try {
        const rows = await sqlClient.query(sql, params);
        return rows as T[];
      } catch (err: any) {
        // Cold-start retry: If Neon compute was sleeping and the first request timed out or reset,
        // retry once after a short pause.
        const msg = String(err?.message || "").toLowerCase();
        if (msg.includes("fetch failed") || msg.includes("timeout") || msg.includes("connection") || msg.includes("econnreset")) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const rows = await sqlClient.query(sql, params);
          return rows as T[];
        }
        throw err;
      }
    }
  }

  if (process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is not configured in environment variables. Please add DATABASE_URL to your Vercel Project Settings (Settings -> Environment Variables)."
    );
  }

  // Fallback to SQLite (local development only)
  const { getSqliteDb } = await import("./sqlite_fallback");
  const sqlite = getSqliteDb();
  // Replace $1, $2 with ? for SQLite
  const sqliteSql = sql
    .replace(/\$\d+/g, () => "?")
    .replace(/NOW\(\)/gi, "datetime('now')");

  const stmt = sqlite.prepare(sqliteSql);
  return stmt.all(...params) as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  if (isNeonEnabled()) {
    const sqlClient = getNeonHttp();
    if (sqlClient) {
      try {
        await sqlClient.query(sql, params);
        return;
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (msg.includes("fetch failed") || msg.includes("timeout") || msg.includes("connection") || msg.includes("econnreset")) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await sqlClient.query(sql, params);
          return;
        }
        throw err;
      }
    }
  }

  if (process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is not configured in environment variables. Please add DATABASE_URL to your Vercel Project Settings (Settings -> Environment Variables)."
    );
  }

  // Fallback to SQLite (local development only)
  const { getSqliteDb } = await import("./sqlite_fallback");
  const sqlite = getSqliteDb();
  const sqliteSql = sql
    .replace(/\$\d+/g, () => "?")
    .replace(/NOW\(\)/gi, "datetime('now')");

  sqlite.prepare(sqliteSql).run(...params);
}
