import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

export interface ExcelSheetStat {
  name: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
}

export interface ExcelCustomerRow {
  customerId: string;
  customerName: string;
  phone?: string;
  defaultRate?: number;
  status?: string;
  totalInr: number;
  totalAed: number;
  totalPaid: number;
  balanceAed: number;
  createdDate?: string;
}

export interface ExcelTransferRow {
  txnId: string;
  date: string;
  day?: string;
  customerId: string;
  customerName: string;
  totalInr: number;
  manualRate: number;
  wholesaleRate?: number;
  inDirhamsAed: number;
  paidAmountAed: number;
  balanceAed: number;
  status: string;
  notes?: string;
}

export interface ExcelWorkbookData {
  filePath: string;
  fileName: string;
  lastModified: string;
  fileSizeBytes: number;
  sheets: ExcelSheetStat[];
  totalRowsAcrossAllSheets: number;
  customers: ExcelCustomerRow[];
  transfers: ExcelTransferRow[];
  totals: {
    totalDubaiTransfers: number;
    totalInrVolume: number;
    totalAedBilled: number;
    totalAedPaid: number;
    totalOutstandingAed: number;
  };
}

let cachedExcelData: ExcelWorkbookData | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Finds the most authoritative Excel file available:
 * 1. Accounts_Business_Normalized_Master.xlsx in workspace root (generated, normalized, up-to-date)
 * 2. F:\AYYAN JAN.xlsx (original source file if available)
 */
export function getActiveExcelFilePath(): string | null {
  const masterPath = path.resolve(process.cwd(), "Accounts_Business_Normalized_Master.xlsx");
  if (fs.existsSync(masterPath)) {
    return masterPath;
  }
  const altPath = "F:/AYYAN JAN.xlsx";
  if (fs.existsSync(altPath)) {
    return altPath;
  }
  const dataPath = path.resolve(process.cwd(), "data/AYYAN_JAN_5.xlsx");
  if (fs.existsSync(dataPath)) {
    return dataPath;
  }
  return null;
}

function parseCellNumber(val: any, defaultVal = 0): number {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === "object" && val !== null) {
    if ("result" in val && val.result !== undefined) val = val.result;
    else if ("value" in val && val.value !== undefined) val = val.value;
  }
  if (typeof val === "number") return isNaN(val) ? defaultVal : val;
  if (typeof val === "string") {
    const clean = val.replace(/,/g, "").trim();
    if (clean === "" || clean.includes("#") || clean.toLowerCase() === "null") return defaultVal;
    const p = parseFloat(clean);
    return isNaN(p) ? defaultVal : p;
  }
  return defaultVal;
}

function parseCellString(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null) {
    if ("text" in val && val.text) return String(val.text).trim();
    if ("result" in val && val.result !== undefined) return String(val.result).trim();
    if ("value" in val && val.value !== undefined) return String(val.value).trim();
  }
  return String(val).trim();
}

/**
 * Loads and indexes the active Excel workbook.
 * Uses caching to ensure millisecond responses for conversational queries.
 */
export async function loadExcelWorkbookData(forceReload = false): Promise<ExcelWorkbookData | null> {
  const now = Date.now();
  if (!forceReload && cachedExcelData && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedExcelData;
  }

  const filePath = getActiveExcelFilePath();
  if (!filePath) {
    return null;
  }

  try {
    const stats = fs.statSync(filePath);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    const sheetStats: ExcelSheetStat[] = [];
    let totalRowsAcrossAllSheets = 0;
    const customers: ExcelCustomerRow[] = [];
    const transfers: ExcelTransferRow[] = [];

    let totalDubaiTransfers = 0;
    let totalInrVolume = 0;
    let totalAedBilled = 0;
    let totalAedPaid = 0;

    wb.eachSheet((ws) => {
      const rowCount = ws.rowCount;
      const colCount = ws.columnCount;
      totalRowsAcrossAllSheets += Math.max(0, rowCount - 1);

      // Extract headers from Row 1
      const headers: string[] = [];
      const headerRow = ws.getRow(1);
      headerRow.eachCell((cell) => {
        headers.push(parseCellString(cell.value));
      });

      sheetStats.push({
        name: ws.name,
        rowCount,
        columnCount: colCount,
        headers,
      });

      // If this is the Customers sheet (01_Customers or similar)
      if (ws.name.includes("Customers") || ws.name === "01_Customers") {
        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const id = parseCellString(row.getCell(1).value);
          const name = parseCellString(row.getCell(2).value);
          if (!name || id === "TOTAL" || name.includes("Customers")) return;

          const totalInr = parseCellNumber(row.getCell(6).value);
          const totalAed = parseCellNumber(row.getCell(7).value);
          const totalPaid = parseCellNumber(row.getCell(8).value);
          const balanceAed = parseCellNumber(row.getCell(9).value);

          customers.push({
            customerId: id,
            customerName: name,
            phone: parseCellString(row.getCell(3).value),
            defaultRate: parseCellNumber(row.getCell(4).value, 38.25),
            status: parseCellString(row.getCell(5).value) || "ACTIVE",
            totalInr,
            totalAed,
            totalPaid,
            balanceAed,
            createdDate: parseCellString(row.getCell(10).value),
          });
        });
      }

      // If this is the Dubai Transfers sheet (03_Dubai_Client_Transfers or COLLECTION & PROFIT)
      if (ws.name.includes("Dubai_Client_Transfers") || ws.name.includes("COLLECTION")) {
        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const txnId = parseCellString(row.getCell(1).value);
          const custName = parseCellString(row.getCell(5).value);
          if (!txnId || txnId === "TOTAL" || !custName) return;

          const totalInr = parseCellNumber(row.getCell(6).value);
          const manualRate = parseCellNumber(row.getCell(7).value);
          const wholesaleRate = parseCellNumber(row.getCell(8).value);
          const inDirhamsAed = parseCellNumber(row.getCell(9).value);
          const paidAmountAed = parseCellNumber(row.getCell(10).value);
          const balanceAed = parseCellNumber(row.getCell(11).value);

          totalDubaiTransfers++;
          totalInrVolume += totalInr;
          totalAedBilled += inDirhamsAed;
          totalAedPaid += paidAmountAed;

          transfers.push({
            txnId,
            date: parseCellString(row.getCell(2).value),
            day: parseCellString(row.getCell(3).value),
            customerId: parseCellString(row.getCell(4).value),
            customerName: custName,
            totalInr,
            manualRate,
            wholesaleRate,
            inDirhamsAed,
            paidAmountAed,
            balanceAed,
            status: parseCellString(row.getCell(12).value) || "CONFIRMED",
            notes: parseCellString(row.getCell(13).value),
          });
        });
      }
    });

    cachedExcelData = {
      filePath,
      fileName: path.basename(filePath),
      lastModified: stats.mtime.toISOString().slice(0, 10),
      fileSizeBytes: stats.size,
      sheets: sheetStats,
      totalRowsAcrossAllSheets,
      customers,
      transfers,
      totals: {
        totalDubaiTransfers,
        totalInrVolume: Math.round(totalInrVolume * 100) / 100,
        totalAedBilled: Math.round(totalAedBilled * 100) / 100,
        totalAedPaid: Math.round(totalAedPaid * 100) / 100,
        totalOutstandingAed: Math.round((totalAedBilled - totalAedPaid) * 100) / 100,
      },
    };
    lastCacheTime = now;
    return cachedExcelData;
  } catch (err: any) {
    console.error("[Excel Retrieval Error]:", err?.message || err);
    return null;
  }
}

/**
 * Searches Excel workbook for customer information by name or code.
 */
export async function searchExcelCustomer(nameOrCode: string): Promise<{
  customer: ExcelCustomerRow | null;
  recentTransfers: ExcelTransferRow[];
  totalTransfersCount: number;
} | null> {
  const data = await loadExcelWorkbookData();
  if (!data) return null;

  const q = nameOrCode.trim().toLowerCase();

  // Search exact or substring match in customers list
  let matchedCust = data.customers.find(
    (c) => c.customerName.toLowerCase() === q || c.customerId.toLowerCase() === q
  );

  if (!matchedCust) {
    matchedCust = data.customers.find(
      (c) => c.customerName.toLowerCase().includes(q) || c.customerId.toLowerCase().includes(q)
    );
  }

  // Filter transfers for this customer
  const targetName = matchedCust ? matchedCust.customerName.toLowerCase() : q;
  const matchedTransfers = data.transfers.filter((t) =>
    t.customerName.toLowerCase().includes(targetName) ||
    t.customerId.toLowerCase().includes(targetName)
  );

  if (!matchedCust && matchedTransfers.length > 0) {
    // Synthesize customer summary from transfers
    const totalInr = matchedTransfers.reduce((s, t) => s + t.totalInr, 0);
    const totalAed = matchedTransfers.reduce((s, t) => s + t.inDirhamsAed, 0);
    const totalPaid = matchedTransfers.reduce((s, t) => s + t.paidAmountAed, 0);
    matchedCust = {
      customerId: matchedTransfers[0].customerId || "-",
      customerName: matchedTransfers[0].customerName,
      totalInr: Math.round(totalInr * 100) / 100,
      totalAed: Math.round(totalAed * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balanceAed: Math.round((totalAed - totalPaid) * 100) / 100,
    };
  }

  if (!matchedCust) return null;

  return {
    customer: matchedCust,
    recentTransfers: matchedTransfers.slice(-10).reverse(),
    totalTransfersCount: matchedTransfers.length,
  };
}
