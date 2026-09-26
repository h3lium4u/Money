import type { ParsedDateRange } from "./types.ts";

/**
 * Helper to format Date into YYYY-MM-DD
 */
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

/**
 * Parses natural language date expressions into explicit YYYY-MM-DD boundaries
 * Uses reference date (defaults to current date).
 */
export function parseDateRange(input: string, refDate: Date = new Date()): ParsedDateRange | undefined {
  const text = input.toLowerCase().trim();
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const day = refDate.getDate();

  // 1. Today
  if (/\btoday\b|\btodays\b/.test(text)) {
    const todayStr = formatDate(refDate);
    return { from: todayStr, to: todayStr, label: "Today" };
  }

  // 2. Yesterday
  if (/\byesterday\b/.test(text)) {
    const y = new Date(refDate);
    y.setDate(day - 1);
    const yStr = formatDate(y);
    return { from: yStr, to: yStr, label: "Yesterday" };
  }

  // 3. This week (Monday to Sunday or beginning of week to today)
  if (/\bthis week\b/.test(text)) {
    const d = new Date(refDate);
    const dayOfWeek = d.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    d.setDate(d.getDate() - distanceToMonday);
    const startStr = formatDate(d);
    const endStr = formatDate(refDate);
    return { from: startStr, to: endStr, label: "This Week" };
  }

  // 4. Last week
  if (/\blast week\b/.test(text)) {
    const dEnd = new Date(refDate);
    const dayOfWeek = dEnd.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    // End of last week is Sunday before this Monday
    dEnd.setDate(dEnd.getDate() - distanceToMonday - 1);
    const dStart = new Date(dEnd);
    dStart.setDate(dEnd.getDate() - 6);
    return { from: formatDate(dStart), to: formatDate(dEnd), label: "Last Week" };
  }

  // 5. This month
  if (/\bthis month\b/.test(text)) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { from: formatDate(firstDay), to: formatDate(lastDay), label: `${refDate.toLocaleString('default', { month: 'long' })} ${year}` };
  }

  // 6. Last month
  if (/\blast month\b/.test(text)) {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    return { from: formatDate(firstDay), to: formatDate(lastDay), label: `${firstDay.toLocaleString('default', { month: 'long' })} ${firstDay.getFullYear()}` };
  }

  // 7. This year
  if (/\bthis year\b/.test(text)) {
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Year ${year}` };
  }

  // 8. Last year
  if (/\blast year\b/.test(text)) {
    return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, label: `Year ${year - 1}` };
  }

  // 9. Last 7 days
  if (/\blast 7 days\b/.test(text)) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - 7);
    return { from: formatDate(d), to: formatDate(refDate), label: "Last 7 Days" };
  }

  // 10. Last 30 days
  if (/\blast 30 days\b/.test(text)) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - 30);
    return { from: formatDate(d), to: formatDate(refDate), label: "Last 30 Days" };
  }

  // 11. "between 1 September and 15 September" or "from September 1 to September 15"
  const rangeMatch = text.match(/(?:between|from)\s+(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?\s+(?:and|to)\s+(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i) ||
                     text.match(/(?:between|from)\s+([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?\s+(?:and|to)\s+([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?/i);
  if (rangeMatch) {
    let d1: number, m1Str: string, y1: number;
    let d2: number, m2Str: string, y2: number;

    if (isNaN(parseInt(rangeMatch[1], 10))) {
      // Month first format: from September 1 to September 15
      m1Str = rangeMatch[1].toLowerCase();
      d1 = parseInt(rangeMatch[2], 10);
      y1 = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : year;
      m2Str = rangeMatch[4].toLowerCase();
      d2 = parseInt(rangeMatch[5], 10);
      y2 = rangeMatch[6] ? parseInt(rangeMatch[6], 10) : y1;
    } else {
      // Day first format: between 1 September and 15 September
      d1 = parseInt(rangeMatch[1], 10);
      m1Str = rangeMatch[2].toLowerCase();
      y1 = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : year;
      d2 = parseInt(rangeMatch[4], 10);
      m2Str = rangeMatch[5].toLowerCase();
      y2 = rangeMatch[6] ? parseInt(rangeMatch[6], 10) : y1;
    }

    if (MONTH_NAMES[m1Str] !== undefined && MONTH_NAMES[m2Str] !== undefined) {
      const dt1 = new Date(y1, MONTH_NAMES[m1Str], d1);
      const dt2 = new Date(y2, MONTH_NAMES[m2Str], d2);
      return {
        from: formatDate(dt1),
        to: formatDate(dt2),
        label: `${dt1.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${dt2.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      };
    }
  }

  // 12. Explicit ISO dates "between 2026-09-01 and 2026-09-15" or "from 2026-09-01 to 2026-09-15"
  const isoRangeMatch = text.match(/(\d{4}-\d{2}-\d{2})\s+(?:to|and|until)\s+(\d{4}-\d{2}-\d{2})/);
  if (isoRangeMatch) {
    return {
      from: isoRangeMatch[1],
      to: isoRangeMatch[2],
      label: `${isoRangeMatch[1]} to ${isoRangeMatch[2]}`
    };
  }

  // 13. Month with optional Year e.g. "September 2026" or "in September"
  for (const [mName, mIdx] of Object.entries(MONTH_NAMES)) {
    // Word boundary check for month name
    const monthRegex = new RegExp(`\\b${mName}\\b(?:\\s+(\\d{4}))?`, 'i');
    const match = text.match(monthRegex);
    if (match) {
      const targetYear = match[1] ? parseInt(match[1], 10) : year;
      const firstDay = new Date(targetYear, mIdx, 1);
      const lastDay = new Date(targetYear, mIdx + 1, 0);
      const capitalized = mName.charAt(0).toUpperCase() + mName.slice(1);
      return {
        from: formatDate(firstDay),
        to: formatDate(lastDay),
        label: `${capitalized} ${targetYear}`
      };
    }
  }

  return undefined;
}
