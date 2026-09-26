import { Pool, types } from "@neondatabase/serverless";

// Keep PostgreSQL DATE (OID 1082) as YYYY-MM-DD string to avoid timezone offsets
types.setTypeParser(1082, (val: string) => val);

let pool: Pool | null = null;

export function isNeonEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function getPool(): Pool | null {
  if (!isNeonEnabled()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const p = getPool();
  if (p) {
    const res = await p.query(sql, params);
    return res.rows as T[];
  }

  // Fallback to SQLite
  const { getSqliteDb } = await import("./sqlite_fallback");
  const sqlite = getSqliteDb();
  let index = 0;
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
  const p = getPool();
  if (p) {
    await p.query(sql, params);
    return;
  }

  // Fallback to SQLite
  const { getSqliteDb } = await import("./sqlite_fallback");
  const sqlite = getSqliteDb();
  const sqliteSql = sql
    .replace(/\$\d+/g, () => "?")
    .replace(/NOW\(\)/gi, "datetime('now')");
  
  sqlite.prepare(sqliteSql).run(...params);
}
