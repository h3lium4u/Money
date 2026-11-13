/**
 * Date Utility Helpers
 * Supports DD-MM-YYYY display format across the entire application and database layer.
 * Ensures all date pickers and database queries convert seamlessly.
 */

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDaysAgoDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getStartOfMonthDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function getStartOfWeekDateString(): string {
  const d = new Date();
  const day = d.getDay(); // 0 is Sunday, 1 is Monday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const date = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

export function getStartOfYearDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

export function getDayMonthYearString(d: Date = new Date()): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Universal date formatter to DD-MM-YYYY (e.g. 04-10-2026).
 * Accepts ISO string (2026-10-04), Date object, or DD-MM-YYYY string.
 */
export function formatDisplayDate(val: any): string {
  if (!val) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    const day = String(val.getDate()).padStart(2, "0");
    const month = String(val.getMonth() + 1).padStart(2, "0");
    const year = val.getFullYear();
    return `${day}-${month}-${year}`;
  }
  const s = String(val).trim();
  // Already in DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
  // If in YYYY-MM-DD or ISO timestamp format
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return `${ymd[3]}-${ymd[2]}-${ymd[1]}`;
  }
  // Fallback date parsing
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return s;
}

/**
 * Universal date parser to ISO YYYY-MM-DD for database storage and <input type="date">.
 * Converts DD-MM-YYYY or Date object to YYYY-MM-DD.
 */
export function toISODate(val: any): string {
  if (!val) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, "0");
    const day = String(val.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const s = String(val).trim();
  // If in DD-MM-YYYY format
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }
  // If in YYYY-MM-DD format
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  }
  return s.slice(0, 10);
}

/**
 * Safely parses any date string (DD-MM-YYYY or YYYY-MM-DD) into a valid Date object.
 */
export function parseDateSafe(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const [, year, month, day] = ymd;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
