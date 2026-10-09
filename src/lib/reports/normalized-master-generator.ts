import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  listCustomers,
  listTransactions,
  listCustomerPayments,
  listDistributionSplits,
  listDistributors,
  listBankDistripAccounts,
  listBankDistripRecords,
  getBankDistributionSettlement,
  onDataChange,
} from "@/lib/repository";

export async function generateNormalizedMasterWorkbook(filters?: {
  from?: string;
  to?: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Petti Remittance Management System";
  wb.created = new Date();

  const baseUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  // Fetch live database records in clean batches to ensure reliable Neon serverless response
  const [customers, parties, distributors] = await Promise.all([
    listCustomers("CUSTOMER"),
    listCustomers("PARTY"),
    listDistributors(),
  ]);

  const [customerTransactions, partyTransfers, payments, splits] = await Promise.all([
    listTransactions({ entityType: "CUSTOMER", from: filters?.from, to: filters?.to, limit: 10000 }),
    listTransactions({ entityType: "PARTY", from: filters?.from, to: filters?.to, limit: 10000 }),
    listCustomerPayments({ from: filters?.from, to: filters?.to }),
    listDistributionSplits({ from: filters?.from, to: filters?.to }),
  ]);

  const [bankSettlementState, bankRecords] = await Promise.all([
    getBankDistributionSettlement(undefined, { from: filters?.from, to: filters?.to }),
    listBankDistripRecords(undefined, "asc"),
  ]);

  // Lookup maps for disambiguation and code resolution
  const custCodeMap = new Map(customers.map((c) => [c.id, c.code || c.id]));
  const partyCodeMap = new Map(parties.map((p) => [p.id, p.code || p.id]));
  const distCodeMap = new Map(distributors.map((d) => [d.id, d.code || d.id]));

  // Helper for human-readable day of week
  function getDayOfWeek(dateStr?: string): string {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleDateString("en-US", { weekday: "short" });
    } catch {
      return "-";
    }
  }

  // Reusable Styling Helpers
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
  const dataFont = { size: 10, name: "Calibri", color: { argb: "FF0F172A" } };
  const totalRowFont = { bold: true, size: 10, name: "Calibri", color: { argb: "FF0F172A" } };
  
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  const borderTotal: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF64748B" } },
    bottom: { style: "double", color: { argb: "FF0F172A" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  function styleHeader(row: ExcelJS.Row, hexColor: string) {
    row.font = headerFont;
    row.height = 26;
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: hexColor },
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = borderThin;
    });
  }

  function styleDataRow(row: ExcelJS.Row, isEven = false) {
    row.height = 20;
    row.font = dataFont;
    row.eachCell((cell) => {
      cell.border = borderThin;
      cell.alignment = { vertical: "middle", wrapText: false };
      if (isEven) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    });
  }

  function styleTotalRow(row: ExcelJS.Row, fillHex = "FFF1F5F9") {
    row.height = 24;
    row.font = totalRowFont;
    row.eachCell((cell) => {
      cell.border = borderTotal;
      cell.alignment = { vertical: "middle" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillHex },
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 01. EXECUTIVE SUMMARY & DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  const wsSumm = wb.addWorksheet("01_Executive_Summary", { views: [{ showGridLines: true }] });
  wsSumm.mergeCells("A1:G1");
  const titleCell = wsSumm.getCell("A1");
  titleCell.value = "PETTI REMITTANCE (DUBAI ⇄ INDIA) - MASTER OPERATIONS & AUDIT WORKBOOK";
  titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  wsSumm.getRow(1).height = 36;

  // Metadata Bar
  wsSumm.getCell("A3").value = "Export Period:";
  wsSumm.getCell("A3").font = { bold: true, size: 10, color: { argb: "FF475569" } };
  wsSumm.getCell("B3").value = filters?.from && filters?.to ? `${filters.from} to ${filters.to}` : "All Recorded Time";
  wsSumm.getCell("B3").font = { bold: true, size: 10, color: { argb: "FF0F766E" } };

  wsSumm.getCell("D3").value = "Generated On:";
  wsSumm.getCell("D3").font = { bold: true, size: 10, color: { argb: "FF475569" } };
  wsSumm.getCell("E3").value = new Date().toLocaleString();
  wsSumm.getCell("E3").font = { bold: true, size: 10 };

  // KPI Section 1: Dubai Client Transfers
  wsSumm.mergeCells("A5:B5");
  wsSumm.getCell("A5").value = "1. DUBAI CLIENT REMITTANCES";
  wsSumm.getCell("A5").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  wsSumm.getCell("A5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
  wsSumm.getRow(5).height = 22;

  const totalDubaiInr = customerTransactions.filter(t => t.status === "CONFIRMED").reduce((s, t) => s + (t.total ?? t.inr_amount ?? 0), 0);
  const totalInDhirams = customerTransactions.filter(t => t.status === "CONFIRMED").reduce((s, t) => s + (t.in_dhirams ?? t.aed_amount ?? 0), 0);
  const totalPaidAmount = customerTransactions.filter(t => t.status === "CONFIRMED").reduce((s, t) => s + (t.paid_amount ?? t.paid_aed ?? 0), 0);
  const totalBalanceToPaid = customerTransactions.filter(t => t.status === "CONFIRMED").reduce((s, t) => s + (t.balance_to_paid ?? t.pending_aed ?? 0), 0);

  const dubaiKpis = [
    { label: "Total Volume (INR)", value: totalDubaiInr, fmt: "#,##0.000" },
    { label: "Total in Dirhams (AED)", value: totalInDhirams, fmt: "#,##0.000" },
    { label: "Total Collected / Paid (AED)", value: totalPaidAmount, fmt: "#,##0.000" },
    { label: "Outstanding Balance (AED)", value: totalBalanceToPaid, fmt: "#,##0.000" },
    { label: "Total Orders Count", value: customerTransactions.length, fmt: "#,##0" },
  ];

  dubaiKpis.forEach((k, idx) => {
    const r = 6 + idx;
    wsSumm.getCell(`A${r}`).value = k.label;
    wsSumm.getCell(`A${r}`).font = { bold: true, color: { argb: "FF334155" }, size: 9 };
    wsSumm.getCell(`A${r}`).border = borderThin;
    wsSumm.getCell(`B${r}`).value = k.value;
    wsSumm.getCell(`B${r}`).font = { bold: true, size: 10, color: { argb: "FF065F46" } };
    wsSumm.getCell(`B${r}`).numFmt = k.fmt;
    wsSumm.getCell(`B${r}`).alignment = { horizontal: "right" };
    wsSumm.getCell(`B${r}`).border = borderThin;
    wsSumm.getRow(r).height = 20;
  });

  // KPI Section 2: Party Transfers
  wsSumm.mergeCells("D5:E5");
  wsSumm.getCell("D5").value = "2. PARTY TRANSFERS (AED & INR)";
  wsSumm.getCell("D5").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  wsSumm.getCell("D5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };

  const totalPartyInr = partyTransfers.filter(t => t.status === "CONFIRMED").reduce((s, t) => s + (t.inr_amount || 0), 0);
  const totalPartyCostInr = partyTransfers.filter(t => t.status === "CONFIRMED").reduce((s, t) => {
    const inr = t.inr_amount || 0;
    const cr = t.customer_rate || 0;
    const br = t.base_rate || 0;
    return s + (cr > 0 ? inr * (br / cr) : 0);
  }, 0);
  const totalPartyProfitInr = totalPartyInr - totalPartyCostInr;

  const partyKpis = [
    { label: "Total Party Transfers Volume", value: totalPartyInr, fmt: "#,##0.000" },
    { label: "Total Party Payout Cost", value: totalPartyCostInr, fmt: "#,##0.000" },
    { label: "Net Profit on Party Transfers", value: totalPartyProfitInr, fmt: "#,##0.000" },
    { label: "Registered Master Parties", value: parties.length, fmt: "#,##0" },
    { label: "Total Party Transfers Count", value: partyTransfers.length, fmt: "#,##0" },
  ];

  partyKpis.forEach((k, idx) => {
    const r = 6 + idx;
    wsSumm.getCell(`D${r}`).value = k.label;
    wsSumm.getCell(`D${r}`).font = { bold: true, color: { argb: "FF334155" }, size: 9 };
    wsSumm.getCell(`D${r}`).border = borderThin;
    wsSumm.getCell(`E${r}`).value = k.value;
    wsSumm.getCell(`E${r}`).font = { bold: true, size: 10, color: { argb: "FF0F766E" } };
    wsSumm.getCell(`E${r}`).numFmt = k.fmt;
    wsSumm.getCell(`E${r}`).alignment = { horizontal: "right" };
    wsSumm.getCell(`E${r}`).border = borderThin;
  });

  // KPI Section 3: Bank Distribution Settlement (BANK DISTRIP)
  const bankStartRow = 13;
  wsSumm.mergeCells(`A${bankStartRow}:E${bankStartRow}`);
  wsSumm.getCell(`A${bankStartRow}`).value = "3. BANK DISTRIBUTION SETTLEMENT (BANK DISTRIP - INDIA PAYOUTS)";
  wsSumm.getCell(`A${bankStartRow}`).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  wsSumm.getCell(`A${bankStartRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3730A3" } };
  wsSumm.getRow(bankStartRow).height = 22;

  const grandTotals = bankSettlementState?.grandTotals || {
    grand_order: 0,
    grand_commission: 0,
    grand_paid: 0,
    grand_balance: 0,
    distributor_summaries: [],
  };

  const bankKpis = [
    { label: "Grand Total Orders Assigned (INR)", value: grandTotals.grand_order, fmt: "#,##0.000" },
    { label: "Grand Total Commission Recorded (INR)", value: grandTotals.grand_commission, fmt: "#,##0.000" },
    { label: "Grand Total Paid / Disbursed (INR)", value: grandTotals.grand_paid, fmt: "#,##0.000" },
    { label: "Net Grand Closing Balance Across Distributors (INR)", value: grandTotals.grand_balance, fmt: "#,##0.000" },
  ];

  bankKpis.forEach((k, idx) => {
    const r = bankStartRow + 1 + idx;
    wsSumm.mergeCells(`A${r}:C${r}`);
    wsSumm.getCell(`A${r}`).value = k.label;
    wsSumm.getCell(`A${r}`).font = { bold: true, color: { argb: "FF334155" }, size: 9 };
    wsSumm.getCell(`A${r}`).border = borderThin;
    wsSumm.mergeCells(`D${r}:E${r}`);
    wsSumm.getCell(`D${r}`).value = k.value;
    wsSumm.getCell(`D${r}`).font = { bold: true, size: 10, color: { argb: "FF3730A3" } };
    wsSumm.getCell(`D${r}`).numFmt = k.fmt;
    wsSumm.getCell(`D${r}`).alignment = { horizontal: "right" };
    wsSumm.getCell(`D${r}`).border = borderThin;
    wsSumm.getRow(r).height = 20;
  });

  // KPI Section 4: 24-Hour Delayed Ledger Clear & Backup Controls
  const resetSectionRow = bankStartRow + 5;
  wsSumm.mergeCells(`A${resetSectionRow}:E${resetSectionRow}`);
  wsSumm.getCell(`A${resetSectionRow}`).value = "4. LEDGER RESET & 24-HOUR DELAYED CLEAR (WITH SAFETY REVOKE & BACKUP)";
  wsSumm.getCell(`A${resetSectionRow}`).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  wsSumm.getCell(`A${resetSectionRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF991B1B" } };
  wsSumm.getRow(resetSectionRow).height = 22;

  const btnRow = resetSectionRow + 1;
  wsSumm.mergeCells(`A${btnRow}:B${btnRow}`);
  const scheduleCell = wsSumm.getCell(`A${btnRow}`);
  scheduleCell.value = {
    text: "⚠️ SCHEDULE 24-HR CLEAR (DOWNLOAD BACKUP)",
    hyperlink: `${baseUrl}/reports?trigger=schedule-wipe`,
    tooltip: "Click to download backup now and schedule 24-hour delayed clear",
  };
  scheduleCell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" }, underline: true };
  scheduleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } };
  scheduleCell.alignment = { vertical: "middle", horizontal: "center" };
  scheduleCell.border = borderThin;

  const revokeCell = wsSumm.getCell(`C${btnRow}`);
  revokeCell.value = {
    text: "🛡️ REVOKE CLEAR",
    hyperlink: `${baseUrl}/reports?trigger=revoke-wipe`,
    tooltip: "Click to cancel and abort scheduled wipe",
  };
  revokeCell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" }, underline: true };
  revokeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
  revokeCell.alignment = { vertical: "middle", horizontal: "center" };
  revokeCell.border = borderThin;

  wsSumm.mergeCells(`D${btnRow}:E${btnRow}`);
  const backupCell = wsSumm.getCell(`D${btnRow}`);
  backupCell.value = {
    text: "📥 DOWNLOAD LATEST BACKUP (.XLSX)",
    hyperlink: `${baseUrl}/api/reports/export-excel`,
    tooltip: "Download current latest Excel workbook backup",
  };
  backupCell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" }, underline: true };
  backupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  backupCell.alignment = { vertical: "middle", horizontal: "center" };
  backupCell.border = borderThin;
  wsSumm.getRow(btnRow).height = 24;

  const noteRow = btnRow + 1;
  wsSumm.mergeCells(`A${noteRow}:E${noteRow}`);
  const noteCell = wsSumm.getCell(`A${noteRow}`);
  noteCell.value = "SAFETY BUFFER: Clicking 'Schedule 24-Hr Clear' immediately downloads the latest Excel backup and arms a strict 24-hour delayed countdown. The clear executes ONLY after 1 full day (24 hours). You can click 'REVOKE CLEAR' anytime to cancel. Master parties (HAJA, MK, NF2, SALA, SARAB) are permanently preserved.";
  noteCell.font = { italic: true, size: 8.5, color: { argb: "FF475569" } };
  noteCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  noteCell.border = borderThin;
  wsSumm.getRow(noteRow).height = 42;

  // Table of Contents / Sheet Guide
  const navHeaderRow = noteRow + 2;
  wsSumm.mergeCells(`A${navHeaderRow}:E${navHeaderRow}`);
  wsSumm.getCell(`A${navHeaderRow}`).value = "WORKBOOK SHEET GUIDE & AUDIT TRAIL";
  wsSumm.getCell(`A${navHeaderRow}`).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  wsSumm.getCell(`A${navHeaderRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  wsSumm.getRow(navHeaderRow).height = 22;

  const sheetGuide = [
    { code: "Sheet 02", name: "Customers", desc: "Dubai remittance clients, contact info, and outstanding balances in AED." },
    { code: "Sheet 03", name: "Parties_Master", desc: "Core trading parties (HAJA, MK, NF2, SALA, SARAB) with native currencies and rates." },
    { code: "Sheet 04", name: "Dubai_Client_Transfers", desc: "Order remittances with Date, Client Exchange Rate, Wholesale Rate, AED in Dirhams, and Balance." },
    { code: "Sheet 05", name: "Party_Transfers", desc: "Party transfers in AED & INR with Date, Party Rate, Cost, and Net Profit." },
    { code: "Sheet 06", name: "Customer_Payments", desc: "Date-wise payment receipts in AED, payment methods, and bank slip reference numbers." },
    { code: "Sheet 07", name: "Distribution_Splits", desc: "Order allocations split to India payout distributors (MK · SALA) with Date and AED equivalent." },
    { code: "Sheet 08", name: "Distributors", desc: "Master list of payout distributor accounts with allocated totals and balances." },
    { code: "Sheet 09", name: "Bank_Distribution", desc: "Authoritative Excel BANK DISTRIP daily settlement ledger with running balances (ORDER+COM-PAID)." },
    { code: "Sheet 10", name: "Daily_Summary", desc: "Date-by-date daily turnover, order count, and collections performance." },
    { code: "Sheet 11", name: "Ledger_Reset", desc: "Dedicated console to trigger 24-hour delayed clear, download backup, or revoke clear." },
  ];

  sheetGuide.forEach((g, idx) => {
    const r = navHeaderRow + 1 + idx;
    wsSumm.getCell(`A${r}`).value = g.code;
    wsSumm.getCell(`A${r}`).font = { bold: true, color: { argb: "FF0F766E" }, size: 9 };
    wsSumm.getCell(`A${r}`).border = borderThin;
    wsSumm.getCell(`B${r}`).value = g.name;
    wsSumm.getCell(`B${r}`).font = { bold: true, color: { argb: "FF0F172A" }, size: 9 };
    wsSumm.getCell(`B${r}`).border = borderThin;
    wsSumm.mergeCells(`C${r}:E${r}`);
    wsSumm.getCell(`C${r}`).value = g.desc;
    wsSumm.getCell(`C${r}`).font = { size: 9, color: { argb: "FF475569" } };
    wsSumm.getCell(`C${r}`).border = borderThin;
    wsSumm.getRow(r).height = 19;
  });

  wsSumm.columns = [
    { width: 28 }, // A
    { width: 26 }, // B
    { width: 14 }, // C
    { width: 26 }, // D
    { width: 26 }, // E
    { width: 12 }, // F
    { width: 12 }, // G
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // 02. DUBAI CUSTOMERS
  // ═══════════════════════════════════════════════════════════════════════════
  const wsCust = wb.addWorksheet("02_Customers", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
  wsCust.columns = [
    { header: "Customer ID", key: "id", width: 18 },
    { header: "Customer Name", key: "name", width: 26 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Default Rate", key: "rate", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Total INR Processed", key: "total_inr", width: 22 },
    { header: "Total AED Charged", key: "total_aed", width: 20 },
    { header: "Total AED Paid", key: "total_paid", width: 20 },
    { header: "Outstanding Balance (AED)", key: "balance", width: 24 },
    { header: "Registration Date", key: "created_date", width: 18 },
  ];
  styleHeader(wsCust.getRow(1), "FF047857"); // Emerald

  if (customers.length === 0) {
    const emptyRow = wsCust.addRow({
      id: "-",
      name: "No retail customers registered yet",
      phone: "-",
      rate: 0,
      status: "ACTIVE",
      total_inr: 0,
      total_aed: 0,
      total_paid: 0,
      balance: 0,
      created_date: "-",
    });
    styleDataRow(emptyRow);

    const custTotalRow = wsCust.addRow({
      id: "TOTAL",
      name: "0 Customers",
      phone: "",
      rate: "",
      status: "",
      total_inr: 0,
      total_aed: 0,
      total_paid: 0,
      balance: 0,
      created_date: "",
    });
    custTotalRow.getCell(6).numFmt = "#,##0.000";
    custTotalRow.getCell(7).numFmt = "#,##0.000";
    custTotalRow.getCell(8).numFmt = "#,##0.000";
    custTotalRow.getCell(9).numFmt = "#,##0.000";
    styleTotalRow(custTotalRow);
  } else {
    customers.forEach((c, idx) => {
      const row = wsCust.addRow({
        id: c.code || c.id,
        name: c.name,
        phone: c.phone || "-",
        rate: c.default_rate || 38.25,
        status: c.status || "ACTIVE",
        total_inr: c.total_inr || 0,
        total_aed: c.total_aed || 0,
        total_paid: c.total_paid || 0,
        balance: c.outstanding_balance || 0,
        created_date: c.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      });
      row.getCell(4).numFmt = "0.000";
      row.getCell(6).numFmt = "#,##0.000";
      row.getCell(7).numFmt = "#,##0.000";
      row.getCell(8).numFmt = "#,##0.000";
      row.getCell(9).numFmt = "#,##0.000";
      row.getCell(10).alignment = { horizontal: "center", vertical: "middle" };
      styleDataRow(row, idx % 2 === 1);
    });

    const lastCustRow = customers.length + 1;
    const custTotalRow = wsCust.addRow({
      id: "TOTAL",
      name: `${customers.length} Customers`,
      phone: "",
      rate: "",
      status: "",
      total_inr: { formula: `=SUM(F2:F${lastCustRow})` },
      total_aed: { formula: `=SUM(G2:G${lastCustRow})` },
      total_paid: { formula: `=SUM(H2:H${lastCustRow})` },
      balance: { formula: `=SUM(I2:I${lastCustRow})` },
      created_date: "",
    });
    custTotalRow.getCell(6).numFmt = "#,##0.000";
    custTotalRow.getCell(7).numFmt = "#,##0.000";
    custTotalRow.getCell(8).numFmt = "#,##0.000";
    custTotalRow.getCell(9).numFmt = "#,##0.000";
    styleTotalRow(custTotalRow);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 03. PARTIES MASTER (HAJA, MK, NF2, SALA, SARAB)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsParty = wb.addWorksheet("03_Parties_Master", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
  wsParty.columns = [
    { header: "Party Code", key: "code", width: 16 },
    { header: "Party Name", key: "name", width: 24 },
    { header: "Region / Market", key: "region", width: 18 },
    { header: "Settlement Currency", key: "currency", width: 20 },
    { header: "Default Rate", key: "rate", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Total Volume Processed", key: "total_inr", width: 22 },
    { header: "Total Net Profit (INR)", key: "net_profit_inr", width: 22 },
    { header: "Registration Date", key: "created_date", width: 18 },
  ];
  styleHeader(wsParty.getRow(1), "FF0F766E"); // Teal

  parties.forEach((p, idx) => {
    const isIndia = p.party_type === "INDIA" || p.name === "MK" || p.name === "SALA";
    const region = isIndia ? "🇮🇳 India (INR)" : "🇦🇪 Dubai (AED)";
    const currency = isIndia ? "INR" : "AED";

    const partyTxns = partyTransfers.filter(t => t.customer_id === p.id && t.status === "CONFIRMED");
    const pTotalInr = partyTxns.reduce((s, t) => s + (t.inr_amount || 0), 0);
    const pProfitInr = partyTxns.reduce((s, t) => {
      const inr = t.inr_amount || 0;
      const cr = t.customer_rate || 0;
      const br = t.base_rate || 0;
      const cost = cr > 0 ? inr * (br / cr) : 0;
      return s + (inr - cost);
    }, 0);

    const row = wsParty.addRow({
      code: p.code || p.id,
      name: p.name,
      region,
      currency,
      rate: p.default_rate || 38.25,
      status: p.status || "ACTIVE",
      total_inr: pTotalInr,
      net_profit_inr: pProfitInr,
      created_date: p.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    });
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(5).numFmt = "0.000";
    row.getCell(7).numFmt = "#,##0.000";
    row.getCell(8).numFmt = "#,##0.000";
    row.getCell(9).alignment = { horizontal: "center", vertical: "middle" };
    styleDataRow(row, idx % 2 === 1);
  });

  const lastPartyRow = parties.length + 1;
  const partyTotalRow = wsParty.addRow({
    code: "TOTAL",
    name: `${parties.length} Registered Parties`,
    region: "",
    currency: "",
    rate: "",
    status: "",
    total_inr: { formula: `=SUM(G2:G${lastPartyRow})` },
    net_profit_inr: { formula: `=SUM(H2:H${lastPartyRow})` },
    created_date: "",
  });
  partyTotalRow.getCell(7).numFmt = "#,##0.000";
  partyTotalRow.getCell(8).numFmt = "#,##0.000";
  styleTotalRow(partyTotalRow);

  // ═══════════════════════════════════════════════════════════════════════════
  // 04. DUBAI CLIENT TRANSFERS (CUSTOMER REMITTANCES)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsTxn = wb.addWorksheet("04_Dubai_Client_Transfers", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
  wsTxn.columns = [
    { header: "Transfer ID", key: "txn_id", width: 18 },                 // Col A
    { header: "Date", key: "date", width: 15 },                          // Col B
    { header: "Day", key: "day", width: 10 },                            // Col C
    { header: "Client ID", key: "cust_id", width: 16 },                  // Col D
    { header: "Client Name", key: "cust_name", width: 25 },              // Col E
    { header: "Total Order (INR)", key: "total_inr", width: 20 },        // Col F: Total amount in INR
    { header: "Client Exchange Rate (per 1000 INR)", key: "manual_rate", width: 28 }, // Col G: Client exchange rate
    { header: "Wholesale Rate", key: "wholesale_rate", width: 18 },     // Col H: =ROUND(1000/G{rowNum}, 3)
    { header: "Amount in Dirhams (AED)", key: "in_dhirams", width: 22 }, // Col I: =ROUND((F{rowNum}*G{rowNum})/1000, 3)
    { header: "Paid Amount (AED)", key: "paid_amount", width: 20 },      // Col J: Paid AED
    { header: "Balance to be Paid (AED)", key: "balance_to_paid", width: 22 }, // Col K: =ROUND(I{rowNum}-J{rowNum}, 3)
    { header: "Payment Status", key: "status", width: 16 },              // Col L
    { header: "Notes / Beneficiary", key: "notes", width: 32 },          // Col M
  ];
  styleHeader(wsTxn.getRow(1), "FF065F46"); // Dark Emerald

  if (customerTransactions.length === 0) {
    const emptyRow = wsTxn.addRow({
      txn_id: "-",
      date: "-",
      day: "-",
      cust_id: "-",
      cust_name: "No Dubai client transfers recorded for this period",
      total_inr: 0,
      manual_rate: 0,
      wholesale_rate: 0,
      in_dhirams: 0,
      paid_amount: 0,
      balance_to_paid: 0,
      status: "READY",
      notes: "Ledger ready for new transactions",
    });
    styleDataRow(emptyRow);

    const txnTotalRow = wsTxn.addRow({
      txn_id: "TOTAL",
      date: "-",
      day: "",
      cust_id: "",
      cust_name: "0 Transfers",
      total_inr: 0,
      manual_rate: "",
      wholesale_rate: "",
      in_dhirams: 0,
      paid_amount: 0,
      balance_to_paid: 0,
      status: "",
      notes: "",
    });
    txnTotalRow.getCell(6).numFmt = "#,##0.000";
    txnTotalRow.getCell(9).numFmt = "#,##0.000";
    txnTotalRow.getCell(10).numFmt = "#,##0.000";
    txnTotalRow.getCell(11).numFmt = "#,##0.000";
    styleTotalRow(txnTotalRow);
  } else {
    customerTransactions.forEach((t, i) => {
      const rowNum = i + 2;
      const uniqueCustId = custCodeMap.get(t.customer_id) || t.customer_code || (t.customer_id ? t.customer_id.slice(0, 8) : "-");
      const totalInr = Number(t.total ?? t.inr_amount ?? 0);
      const manualRate = Number(t.manual_rate ?? t.customer_rate ?? 0);
      const paidAmount = Number(t.paid_amount ?? t.paid_aed ?? 0);

      const row = wsTxn.addRow({
        txn_id: t.transaction_number,
        date: t.transaction_date,
        day: getDayOfWeek(t.transaction_date),
        cust_id: uniqueCustId,
        cust_name: t.customer_name || "-",
        total_inr: totalInr,
        manual_rate: manualRate,
        wholesale_rate: { formula: `=IF(G${rowNum}>0, ROUND(1000/G${rowNum}, 3), 0)` },
        in_dhirams: { formula: `=IF(G${rowNum}>0, ROUND((F${rowNum}*G${rowNum})/1000, 3), 0)` },
        paid_amount: paidAmount,
        balance_to_paid: { formula: `=ROUND(I${rowNum}-J${rowNum}, 3)` },
        status: t.status,
        notes: t.notes || "-",
      });

      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(6).numFmt = "#,##0.000"; // Total INR
      row.getCell(7).numFmt = "0.000";   // Customer Rate
      row.getCell(8).numFmt = "0.000";   // Wholesale Rate
      row.getCell(9).numFmt = "#,##0.000"; // In Dhirams (AED)
      row.getCell(10).numFmt = "#,##0.000"; // Paid Amount (AED)
      row.getCell(11).numFmt = "#,##0.000"; // Balance to Paid (AED)
      row.getCell(12).alignment = { horizontal: "center", vertical: "middle" };

      styleDataRow(row, i % 2 === 1);
    });

    const lastTxnRow = customerTransactions.length + 1;
    const txnTotalRow = wsTxn.addRow({
      txn_id: "TOTAL",
      date: "",
      day: "",
      cust_id: "",
      cust_name: `${customerTransactions.length} Dubai Client Transfers`,
      total_inr: { formula: `=SUM(F2:F${lastTxnRow})` },
      manual_rate: "",
      wholesale_rate: "",
      in_dhirams: { formula: `=SUM(I2:I${lastTxnRow})` },
      paid_amount: { formula: `=SUM(J2:J${lastTxnRow})` },
      balance_to_paid: { formula: `=SUM(K2:K${lastTxnRow})` },
      status: "",
      notes: "",
    });
    txnTotalRow.getCell(6).numFmt = "#,##0.000";
    txnTotalRow.getCell(9).numFmt = "#,##0.000";
    txnTotalRow.getCell(10).numFmt = "#,##0.000";
    txnTotalRow.getCell(11).numFmt = "#,##0.000";
    styleTotalRow(txnTotalRow);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 05. PARTY TRANSFERS (AED & INR)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsPt = wb.addWorksheet("05_Party_Transfers", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
  wsPt.columns = [
    { header: "Transfer ID", key: "txn_id", width: 18 },              // Col A
    { header: "Date", key: "date", width: 15 },                       // Col B
    { header: "Day", key: "day", width: 10 },                         // Col C
    { header: "Party Code", key: "party_code", width: 16 },           // Col D
    { header: "Party Name", key: "party_name", width: 22 },           // Col E
    { header: "Currency", key: "currency", width: 12 },               // Col F: AED or INR
    { header: "Order Amount", key: "order_amount", width: 20 },       // Col G
    { header: "Party Rate (per 1000)", key: "party_rate", width: 20 },// Col H
    { header: "Cost Rate (per 1000)", key: "cost_rate", width: 20 },  // Col I
    { header: "Cost Amount", key: "cost_amount", width: 20 },         // Col J: =IF(H>0, G*(I/H), 0)
    { header: "Net Profit", key: "net_profit", width: 20 },           // Col K: =G-J
    { header: "Settlement Distributor", key: "dist_name", width: 22 },// Col L
    { header: "Status", key: "status", width: 14 },                   // Col M
    { header: "Notes", key: "notes", width: 30 },                     // Col N
  ];
  styleHeader(wsPt.getRow(1), "FF0E7490"); // Cyan / Teal

  if (partyTransfers.length === 0) {
    const emptyRow = wsPt.addRow({
      txn_id: "-",
      date: "-",
      day: "-",
      party_code: "-",
      party_name: "No party transfers recorded for this period",
      currency: "-",
      order_amount: 0,
      party_rate: 0,
      cost_rate: 0,
      cost_amount: 0,
      net_profit: 0,
      dist_name: "-",
      status: "READY",
      notes: "Ledger ready for new party transfers",
    });
    styleDataRow(emptyRow);

    const ptTotalRow = wsPt.addRow({
      txn_id: "TOTAL",
      date: "-",
      day: "",
      party_code: "",
      party_name: "0 Transfers",
      currency: "",
      order_amount: 0,
      party_rate: "",
      cost_rate: "",
      cost_amount: 0,
      net_profit: 0,
      dist_name: "",
      status: "",
      notes: "",
    });
    ptTotalRow.getCell(7).numFmt = "#,##0.000";
    ptTotalRow.getCell(10).numFmt = "#,##0.000";
    ptTotalRow.getCell(11).numFmt = "#,##0.000";
    styleTotalRow(ptTotalRow);
  } else {
    partyTransfers.forEach((t, i) => {
      const rowNum = i + 2;
      const uniquePartyCode = partyCodeMap.get(t.customer_id) || t.customer_code || t.customer_id || "-";
      const isIndParty = uniquePartyCode === "MK" || uniquePartyCode === "SALA" || t.customer_name === "MK" || t.customer_name === "SALA";
      const currency = isIndParty ? "INR" : "AED";

      const row = wsPt.addRow({
        txn_id: t.transaction_number,
        date: t.transaction_date,
        day: getDayOfWeek(t.transaction_date),
        party_code: uniquePartyCode,
        party_name: t.customer_name || "-",
        currency,
        order_amount: t.inr_amount,
        party_rate: t.customer_rate,
        cost_rate: t.base_rate,
        cost_amount: { formula: `=IF(H${rowNum}>0, ROUND(G${rowNum}*(I${rowNum}/H${rowNum}), 3), 0)` },
        net_profit: { formula: `=ROUND(G${rowNum}-J${rowNum}, 3)` },
        dist_name: t.distributor_names || t.distributor_name || "-",
        status: t.status,
        notes: t.notes || "-",
      });

      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(7).numFmt = "#,##0.000";
      row.getCell(8).numFmt = "0.000";
      row.getCell(9).numFmt = "0.000";
      row.getCell(10).numFmt = "#,##0.000";
      row.getCell(11).numFmt = "#,##0.000";
      row.getCell(13).alignment = { horizontal: "center", vertical: "middle" };

      styleDataRow(row, i % 2 === 1);
    });

    const lastPtRow = partyTransfers.length + 1;
    const ptTotalRow = wsPt.addRow({
      txn_id: "TOTAL",
      date: "",
      day: "",
      party_code: "",
      party_name: `${partyTransfers.length} Party Transfers`,
      currency: "",
      order_amount: { formula: `=SUM(G2:G${lastPtRow})` },
      party_rate: "",
      cost_rate: "",
      cost_amount: { formula: `=SUM(J2:J${lastPtRow})` },
      net_profit: { formula: `=SUM(K2:K${lastPtRow})` },
      dist_name: "",
      status: "",
      notes: "",
    });
    ptTotalRow.getCell(7).numFmt = "#,##0.000";
    ptTotalRow.getCell(10).numFmt = "#,##0.000";
    ptTotalRow.getCell(11).numFmt = "#,##0.000";
    styleTotalRow(ptTotalRow);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 06. CUSTOMER PAYMENTS (COLLECTIONS IN AED)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsPay = wb.addWorksheet("06_Customer_Payments", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
  wsPay.columns = [
    { header: "Payment ID", key: "pay_id", width: 18 },             // Col A
    { header: "Payment Date", key: "date", width: 15 },              // Col B
    { header: "Day", key: "day", width: 10 },                        // Col C
    { header: "Customer ID", key: "cust_id", width: 16 },            // Col D
    { header: "Customer Name", key: "cust_name", width: 25 },        // Col E
    { header: "Linked Transfer #", key: "txn_id", width: 22 },       // Col F
    { header: "Amount Paid (AED)", key: "amount", width: 20 },       // Col G
    { header: "Currency", key: "currency", width: 12 },              // Col H
    { header: "Payment Method", key: "type", width: 18 },            // Col I
    { header: "Reference / Receipt #", key: "ref_no", width: 22 },   // Col J
    { header: "Notes / Remarks", key: "notes", width: 32 },          // Col K
  ];
  styleHeader(wsPay.getRow(1), "FF15803D"); // Green

  if (payments.length === 0) {
    const emptyRow = wsPay.addRow({
      pay_id: "-",
      date: "-",
      day: "-",
      cust_id: "-",
      cust_name: "No payment receipts recorded for this period",
      txn_id: "-",
      amount: 0,
      currency: "AED",
      type: "CASH",
      ref_no: "-",
      notes: "Receipts ledger ready",
    });
    styleDataRow(emptyRow);

    const payTotalRow = wsPay.addRow({
      pay_id: "TOTAL",
      date: "-",
      day: "",
      cust_id: "",
      cust_name: "0 Payments",
      txn_id: "",
      amount: 0,
      currency: "AED",
      type: "",
      ref_no: "",
      notes: "",
    });
    payTotalRow.getCell(7).numFmt = "#,##0.000";
    styleTotalRow(payTotalRow);
  } else {
    payments.forEach((p: any, idx: number) => {
      const uniqueCustId = custCodeMap.get(p.customer_id) || p.customer_code || (p.customer_id ? p.customer_id.slice(0, 8) : "-");
      const row = wsPay.addRow({
        pay_id: p.payment_number || p.id,
        date: p.payment_date,
        day: getDayOfWeek(p.payment_date),
        cust_id: uniqueCustId,
        cust_name: p.customer_name,
        txn_id: p.transaction_number || "-",
        amount: p.amount_aed,
        currency: "AED",
        type: p.payment_method || "CASH",
        ref_no: p.reference_number || "-",
        notes: p.notes || "-",
      });
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(7).numFmt = "#,##0.000";
      row.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
      styleDataRow(row, idx % 2 === 1);
    });

    const lastPayRow = payments.length + 1;
    const payTotalRow = wsPay.addRow({
      pay_id: "TOTAL",
      date: "",
      day: "",
      cust_id: "",
      cust_name: `${payments.length} Payments Collected`,
      txn_id: "",
      amount: { formula: `=SUM(G2:G${lastPayRow})` },
      currency: "AED",
      type: "",
      ref_no: "",
      notes: "",
    });
    payTotalRow.getCell(7).numFmt = "#,##0.000";
    styleTotalRow(payTotalRow);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 07. DISTRIBUTION SPLITS (INDIA ALLOCATIONS)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsSplits = wb.addWorksheet("07_Distribution_Splits", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
  wsSplits.columns = [
    { header: "Split ID", key: "split_id", width: 18 },              // Col A
    { header: "Split Date", key: "date", width: 15 },                // Col B
    { header: "Day", key: "day", width: 10 },                        // Col C
    { header: "Customer Remittance #", key: "txn_id", width: 22 },   // Col D
    { header: "Customer Name", key: "cust_name", width: 24 },        // Col E
    { header: "Distributor Code", key: "dist_code", width: 16 },     // Col F
    { header: "Distributor Name", key: "dist_name", width: 22 },     // Col G
    { header: "Allocated Amount (INR)", key: "inr_amount", width: 22 }, // Col H
    { header: "Wholesale Rate", key: "rate", width: 18 },            // Col I
    { header: "AED Equivalent", key: "aed_eq", width: 20 },          // Col J: =IF(I>0, H/I, 0)
    { header: "Status", key: "status", width: 14 },                  // Col K
    { header: "Notes / Split Details", key: "notes", width: 32 },    // Col L
  ];
  styleHeader(wsSplits.getRow(1), "FF1E40AF"); // Navy Blue

  if (splits.length === 0) {
    const emptyRow = wsSplits.addRow({
      split_id: "-",
      date: "-",
      day: "-",
      txn_id: "-",
      cust_name: "No distribution splits recorded for this period",
      dist_code: "-",
      dist_name: "-",
      inr_amount: 0,
      rate: 0,
      aed_eq: 0,
      status: "READY",
      notes: "Splits ledger ready",
    });
    styleDataRow(emptyRow);

    const splitTotalRow = wsSplits.addRow({
      split_id: "TOTAL",
      date: "-",
      day: "",
      txn_id: "",
      cust_name: "0 Allocations",
      dist_code: "",
      dist_name: "",
      inr_amount: 0,
      rate: "",
      aed_eq: 0,
      status: "",
      notes: "",
    });
    splitTotalRow.getCell(8).numFmt = "#,##0.000";
    splitTotalRow.getCell(10).numFmt = "#,##0.000";
    styleTotalRow(splitTotalRow);
  } else {
    splits.forEach((s, idx) => {
      const rowNum = idx + 2;
      const uniqueDistCode = distCodeMap.get(s.distributor_id) || s.distributor_code || s.distributor_id;

      const row = wsSplits.addRow({
        split_id: s.id.slice(0, 12),
        date: s.split_date,
        day: getDayOfWeek(s.split_date),
        txn_id: s.transaction_number,
        cust_name: s.customer_name,
        dist_code: uniqueDistCode,
        dist_name: s.distributor_name || s.distributor_code,
        inr_amount: s.inr_amount,
        rate: s.wholesale_rate,
        aed_eq: { formula: `=IF(I${rowNum}>0, ROUND(H${rowNum}/I${rowNum}, 3), 0)` },
        status: s.status,
        notes: s.notes || "-",
      });
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(8).numFmt = "#,##0.000";
      row.getCell(9).numFmt = "0.000";
      row.getCell(10).numFmt = "#,##0.000";
      row.getCell(11).alignment = { horizontal: "center", vertical: "middle" };
      styleDataRow(row, idx % 2 === 1);
    });

    const lastSplitRow = splits.length + 1;
    const splitTotalRow = wsSplits.addRow({
      split_id: "TOTAL",
      date: "",
      day: "",
      txn_id: "",
      cust_name: `${splits.length} Allocations`,
      dist_code: "",
      dist_name: "",
      inr_amount: { formula: `=SUM(H2:H${lastSplitRow})` },
      rate: "",
      aed_eq: { formula: `=SUM(J2:J${lastSplitRow})` },
      status: "",
      notes: "",
    });
    splitTotalRow.getCell(8).numFmt = "#,##0.000";
    splitTotalRow.getCell(10).numFmt = "#,##0.000";
    styleTotalRow(splitTotalRow);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 08. DISTRIBUTORS MASTER LIST
  // ═══════════════════════════════════════════════════════════════════════════
  const wsDist = wb.addWorksheet("08_Distributors", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
  wsDist.columns = [
    { header: "Distributor Code", key: "code", width: 18 },          // Col A
    { header: "Distributor Name", key: "name", width: 24 },          // Col B
    { header: "Group", key: "group", width: 14 },                    // Col C: IND or AED
    { header: "Settlement Currency", key: "curr", width: 20 },       // Col D
    { header: "Status", key: "status", width: 14 },                  // Col E
    { header: "Total Allocated (INR)", key: "total_inr", width: 22 },// Col F
    { header: "Total Paid / Settled (INR)", key: "total_paid", width: 22 }, // Col G
    { header: "Outstanding Balance (INR)", key: "bal_inr", width: 24 },     // Col H
  ];
  styleHeader(wsDist.getRow(1), "FF1E3A8A"); // Indigo

  distributors.forEach((d, idx) => {
    const isInd = d.group_type === "IND" || d.name === "MK" || d.name === "SALA";
    const group = isInd ? "IND" : "AED";
    const curr = isInd ? "INR" : "AED";

    const row = wsDist.addRow({
      code: d.code || d.id,
      name: d.name,
      group,
      curr,
      status: d.status || "ACTIVE",
      total_inr: d.total_splits_inr || 0,
      total_paid: d.total_splits_paid_inr || 0,
      bal_inr: d.splits_balance_inr || 0,
    });
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(6).numFmt = "#,##0.000";
    row.getCell(7).numFmt = "#,##0.000";
    row.getCell(8).numFmt = "#,##0.000";
    styleDataRow(row, idx % 2 === 1);
  });

  const lastDistRow = distributors.length + 1;
  const distTotalRow = wsDist.addRow({
    code: "TOTAL",
    name: `${distributors.length} Distributors`,
    group: "",
    curr: "",
    status: "",
    total_inr: { formula: `=SUM(F2:F${lastDistRow})` },
    total_paid: { formula: `=SUM(G2:G${lastDistRow})` },
    bal_inr: { formula: `=SUM(H2:H${lastDistRow})` },
  });
  distTotalRow.getCell(6).numFmt = "#,##0.000";
  distTotalRow.getCell(7).numFmt = "#,##0.000";
  distTotalRow.getCell(8).numFmt = "#,##0.000";
  styleTotalRow(distTotalRow);

  // ═══════════════════════════════════════════════════════════════════════════
  // 09. BANK DISTRIBUTION SETTLEMENT (BANK DISTRIP - AUTHORITATIVE LEDGER)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsBank = wb.addWorksheet("09_Bank_Distribution", { views: [{ showGridLines: true }] });

  // Banner
  wsBank.mergeCells("A1:G1");
  const bankBanner = wsBank.getCell("A1");
  bankBanner.value = "BANK DISTRIBUTION SETTLEMENT (EXCEL BANK DISTRIP SPECIFICATION)";
  bankBanner.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  bankBanner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3730A3" } }; // Deep Violet
  bankBanner.alignment = { vertical: "middle", horizontal: "center" };
  wsBank.getRow(1).height = 32;

  // Formula Note
  wsBank.mergeCells("A2:G2");
  const formulaNote = wsBank.getCell("A2");
  formulaNote.value = "Formula: CURRENT BALANCE = PREVIOUS BALANCE + CURRENT ORDER + CURRENT COM - CURRENT PAID";
  formulaNote.font = { italic: true, size: 9, color: { argb: "FF4338CA" } };
  formulaNote.alignment = { vertical: "middle", horizontal: "center" };
  wsBank.getRow(2).height = 18;

  // ─── PART 1: GRAND TOTAL SUMMARY MATRIX ──────────────────────────────────
  wsBank.getCell("A4").value = "OVERALL GRAND TOTAL SUMMARY BY DISTRIBUTOR";
  wsBank.getCell("A4").font = { bold: true, size: 11, color: { argb: "FF1E1B4B" } };

  const summaryHeaders = [
    "Party Code",
    "Distributor / Account Name",
    "Total Order (INR)",
    "Total Commission (INR)",
    "Total Paid (INR)",
    "Closing Balance (INR)",
    "Records Count",
  ];
  const summaryHeaderRow = wsBank.getRow(5);
  summaryHeaders.forEach((h, i) => {
    summaryHeaderRow.getCell(i + 1).value = h;
  });
  styleHeader(summaryHeaderRow, "FF4338CA");

  const accountsSummary = grandTotals.distributor_summaries || [];
  let summaryRowIdx = 5;

  accountsSummary.forEach((acc) => {
    summaryRowIdx++;
    const row = wsBank.getRow(summaryRowIdx);
    row.getCell(1).value = acc.account_code;
    row.getCell(2).value = acc.account_name;
    row.getCell(3).value = acc.total_order;
    row.getCell(4).value = acc.total_commission;
    row.getCell(5).value = acc.total_paid;
    row.getCell(6).value = acc.closing_balance;
    row.getCell(7).value = acc.record_count;

    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).numFmt = "#,##0.000";
    row.getCell(4).numFmt = "#,##0.000";
    row.getCell(5).numFmt = "#,##0.000";
    row.getCell(6).numFmt = "#,##0.000";
    row.getCell(7).numFmt = "#,##0";
    row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
    styleDataRow(row, summaryRowIdx % 2 === 0);
  });

  // GRAND TOTAL ROW
  summaryRowIdx++;
  const grandTotalRow = wsBank.getRow(summaryRowIdx);
  grandTotalRow.getCell(1).value = "GRAND TOTAL";
  grandTotalRow.getCell(2).value = `${accountsSummary.length} Distributors`;
  grandTotalRow.getCell(3).value = { formula: `=SUM(C6:C${summaryRowIdx - 1})` };
  grandTotalRow.getCell(4).value = { formula: `=SUM(D6:D${summaryRowIdx - 1})` };
  grandTotalRow.getCell(5).value = { formula: `=SUM(E6:E${summaryRowIdx - 1})` };
  // Grand Balance = Sum of Closing Balances (EXCEL SPEC: DO NOT sum daily balances)
  grandTotalRow.getCell(6).value = { formula: `=SUM(F6:F${summaryRowIdx - 1})` };
  grandTotalRow.getCell(7).value = { formula: `=SUM(G6:G${summaryRowIdx - 1})` };

  grandTotalRow.getCell(3).numFmt = "#,##0.000";
  grandTotalRow.getCell(4).numFmt = "#,##0.000";
  grandTotalRow.getCell(5).numFmt = "#,##0.000";
  grandTotalRow.getCell(6).numFmt = "#,##0.000";
  grandTotalRow.getCell(7).numFmt = "#,##0";
  grandTotalRow.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
  styleTotalRow(grandTotalRow, "FFE0E7FF"); // Soft Indigo fill

  // ─── PART 2: DATE-WISE SETTLEMENT LEDGERS PER DISTRIBUTOR ────────────────
  const recordsByAccount = new Map<string, typeof bankRecords>();
  for (const r of bankRecords) {
    const list = recordsByAccount.get(r.account_id) || [];
    list.push(r);
    recordsByAccount.set(r.account_id, list);
  }

  let currRow = summaryRowIdx + 3;

  for (const acc of accountsSummary) {
    const accRecords = recordsByAccount.get(acc.account_id) || [];
    accRecords.sort((a, b) => a.record_date.localeCompare(b.record_date) || a.created_at.localeCompare(b.created_at));

    // Section Header for Distributor
    wsBank.mergeCells(`A${currRow}:G${currRow}`);
    const secCell = wsBank.getCell(`A${currRow}`);
    secCell.value = `DISTRIBUTOR: ${acc.account_code} - ${acc.account_name} | Closing Balance: ₹${acc.closing_balance.toLocaleString()}`;
    secCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    secCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF312E81" } }; // Darker Indigo
    secCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    wsBank.getRow(currRow).height = 24;
    currRow++;

    // Sub-table Columns
    const distSubHeaders = [
      "DATE",
      "DAY",
      "ORDER (INR)",
      "COM (INR)",
      "PAID (INR)",
      "RUNNING BAL (INR)",
      "NOTES / REMARKS",
    ];
    const subHeaderRow = wsBank.getRow(currRow);
    distSubHeaders.forEach((h, i) => {
      subHeaderRow.getCell(i + 1).value = h;
    });
    styleHeader(subHeaderRow, "FF4F46E5");
    const distStartRow = currRow + 1;
    currRow++;

    if (accRecords.length === 0) {
      const emptyRow = wsBank.getRow(currRow);
      emptyRow.getCell(1).value = "-";
      emptyRow.getCell(2).value = "-";
      emptyRow.getCell(3).value = 0;
      emptyRow.getCell(4).value = 0;
      emptyRow.getCell(5).value = 0;
      emptyRow.getCell(6).value = 0;
      emptyRow.getCell(7).value = "No settlement records recorded yet";
      for (let c = 3; c <= 6; c++) emptyRow.getCell(c).numFmt = "#,##0.000";
      styleDataRow(emptyRow);
      currRow++;

      const dTotRow = wsBank.getRow(currRow);
      dTotRow.getCell(1).value = `TOTAL ${acc.account_code}`;
      dTotRow.getCell(2).value = "";
      dTotRow.getCell(3).value = 0;
      dTotRow.getCell(4).value = 0;
      dTotRow.getCell(5).value = 0;
      dTotRow.getCell(6).value = 0;
      dTotRow.getCell(7).value = `Closing Balance: ₹0.000`;
      for (let c = 3; c <= 6; c++) dTotRow.getCell(c).numFmt = "#,##0.000";
      styleTotalRow(dTotRow, "FFF3F4F6");
      currRow += 2;
    } else {
      accRecords.forEach((rec, recIdx) => {
        const rNum = currRow;
        const row = wsBank.getRow(rNum);
        row.getCell(1).value = rec.record_date;
        row.getCell(2).value = getDayOfWeek(rec.record_date);
        row.getCell(3).value = rec.order_inr;
        row.getCell(4).value = rec.commission_inr;
        row.getCell(5).value = rec.paid_inr;

        // Running balance formula: Row 1 = ORDER + COM - PAID, Row n = PrevBAL + ORDER + COM - PAID
        if (recIdx === 0) {
          row.getCell(6).value = { formula: `=C${rNum}+D${rNum}-E${rNum}` };
        } else {
          row.getCell(6).value = { formula: `=F${rNum - 1}+C${rNum}+D${rNum}-E${rNum}` };
        }

        row.getCell(7).value = rec.notes || "-";

        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(3).numFmt = "#,##0.000";
        row.getCell(4).numFmt = "#,##0.000";
        row.getCell(5).numFmt = "#,##0.000";
        row.getCell(6).numFmt = "#,##0.000";
        styleDataRow(row, recIdx % 2 === 1);
        currRow++;
      });

      const distEndRow = currRow - 1;
      // Total Row for this distributor
      const dTotRow = wsBank.getRow(currRow);
      dTotRow.getCell(1).value = `TOTAL ${acc.account_code}`;
      dTotRow.getCell(2).value = "";
      dTotRow.getCell(3).value = { formula: `=SUM(C${distStartRow}:C${distEndRow})` };
      dTotRow.getCell(4).value = { formula: `=SUM(D${distStartRow}:D${distEndRow})` };
      dTotRow.getCell(5).value = { formula: `=SUM(E${distStartRow}:E${distEndRow})` };
      // Closing balance cell: Points to the last row's running balance cell!
      dTotRow.getCell(6).value = { formula: `=F${distEndRow}` };
      dTotRow.getCell(7).value = `Closing Balance for ${acc.account_code}`;

      dTotRow.getCell(3).numFmt = "#,##0.000";
      dTotRow.getCell(4).numFmt = "#,##0.000";
      dTotRow.getCell(5).numFmt = "#,##0.000";
      dTotRow.getCell(6).numFmt = "#,##0.000";
      styleTotalRow(dTotRow, "FFF3F4F6");

      currRow += 2; // Spacer between distributors
    }
  }

  wsBank.columns = [
    { width: 16 }, // A: Date / Code
    { width: 26 }, // B: Day / Name
    { width: 22 }, // C: Order / Order
    { width: 20 }, // D: Com / Com
    { width: 22 }, // E: Paid / Paid
    { width: 24 }, // F: Running Bal / Bal
    { width: 30 }, // G: Notes / Records
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. DAILY PERFORMANCE SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const wsDaily = wb.addWorksheet("10_Daily_Summary", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
  wsDaily.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Day", key: "day", width: 12 },
    { header: "Transfers Count", key: "count", width: 18 },
    { header: "Total INR Volume", key: "inr", width: 22 },
    { header: "Total in Dirhams (AED)", key: "aed_daily", width: 24 },
    { header: "Paid Amount (AED)", key: "paid_amount", width: 22 },
    { header: "Balance to be Paid (AED)", key: "balance_to_paid", width: 24 },
  ];
  styleHeader(wsDaily.getRow(1), "FF0E7490"); // Cyan / Teal

  // Aggregate daily records
  const dateSet = new Set<string>();
  customerTransactions.forEach((t) => { if (t.transaction_date) dateSet.add(t.transaction_date); });
  payments.forEach((p) => { if (p.payment_date) dateSet.add(p.payment_date); });
  partyTransfers.forEach((pt) => { if (pt.transaction_date) dateSet.add(pt.transaction_date); });

  const sortedDates = Array.from(dateSet).sort().reverse();

  if (sortedDates.length === 0) {
    const emptyRow = wsDaily.addRow({
      date: "-",
      day: "-",
      count: 0,
      inr: 0,
      aed_daily: 0,
      paid_amount: 0,
      balance_to_paid: 0,
    });
    styleDataRow(emptyRow);

    const dailyTotalRow = wsDaily.addRow({
      date: "TOTAL",
      day: "",
      count: 0,
      inr: 0,
      aed_daily: 0,
      paid_amount: 0,
      balance_to_paid: 0,
    });
    dailyTotalRow.getCell(3).numFmt = "#,##0";
    for (let c = 4; c <= 7; c++) {
      dailyTotalRow.getCell(c).numFmt = "#,##0.000";
    }
    styleTotalRow(dailyTotalRow);
  } else {
    sortedDates.forEach((d, idx) => {
      const rowNum = idx + 2;
      const row = wsDaily.addRow({
        date: d,
        day: getDayOfWeek(d),
        count: { formula: `=COUNTIFS('04_Dubai_Client_Transfers'!$B:$B, A${rowNum})` },
        inr: { formula: `=SUMIFS('04_Dubai_Client_Transfers'!$F:$F, '04_Dubai_Client_Transfers'!$B:$B, A${rowNum})` },
        aed_daily: { formula: `=SUMIFS('04_Dubai_Client_Transfers'!$I:$I, '04_Dubai_Client_Transfers'!$B:$B, A${rowNum})` },
        paid_amount: { formula: `=SUMIFS('04_Dubai_Client_Transfers'!$J:$J, '04_Dubai_Client_Transfers'!$B:$B, A${rowNum})` },
        balance_to_paid: { formula: `=SUMIFS('04_Dubai_Client_Transfers'!$K:$K, '04_Dubai_Client_Transfers'!$B:$B, A${rowNum})` },
      });

      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(3).numFmt = "#,##0";
      for (let c = 4; c <= 7; c++) {
        row.getCell(c).numFmt = "#,##0.000";
      }
      styleDataRow(row, idx % 2 === 1);
    });

    const lastDailyRow = sortedDates.length + 1;
    const dailyTotalRow = wsDaily.addRow({
      date: "TOTAL",
      day: "",
      count: { formula: `=SUM(C2:C${lastDailyRow})` },
      inr: { formula: `=SUM(D2:D${lastDailyRow})` },
      aed_daily: { formula: `=SUM(E2:E${lastDailyRow})` },
      paid_amount: { formula: `=SUM(F2:F${lastDailyRow})` },
      balance_to_paid: { formula: `=SUM(G2:G${lastDailyRow})` },
    });
    dailyTotalRow.getCell(3).numFmt = "#,##0";
    for (let c = 4; c <= 7; c++) {
      dailyTotalRow.getCell(c).numFmt = "#,##0.000";
    }
    styleTotalRow(dailyTotalRow);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. LEDGER RESET & 24-HOUR DELAYED CLEAR CONSOLE
  // ═══════════════════════════════════════════════════════════════════════════
  const wsReset = wb.addWorksheet("11_Ledger_Reset", {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  wsReset.mergeCells("A1:F1");
  const rTitle = wsReset.getCell("A1");
  rTitle.value = "PETTI REMITTANCE — LEDGER RESET & 24-HOUR DELAYED CLEAR CONSOLE";
  rTitle.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  rTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  rTitle.alignment = { vertical: "middle", horizontal: "center" };
  wsReset.getRow(1).height = 36;

  // Subtitle
  wsReset.mergeCells("A3:F3");
  const rSub = wsReset.getCell("A3");
  rSub.value = "SAFETY CONTROLS: Click the buttons below to interact directly with the Petti server.";
  rSub.font = { bold: true, size: 10, color: { argb: "FF334155" } };
  rSub.alignment = { vertical: "middle" };

  // Button 1: Schedule 24h
  wsReset.mergeCells("B5:E5");
  const b1 = wsReset.getCell("B5");
  b1.value = {
    text: "⚠️ SCHEDULE 24-HOUR CLEAR & DOWNLOAD LATEST BACKUP",
    hyperlink: `${baseUrl}/reports?trigger=schedule-wipe`,
    tooltip: "Downloads offline backup immediately and starts 24-hour delayed countdown",
  };
  b1.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, underline: true };
  b1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } };
  b1.alignment = { vertical: "middle", horizontal: "center" };
  b1.border = borderThin;
  wsReset.getRow(5).height = 32;

  // Button 2: Revoke Clear
  wsReset.mergeCells("B7:E7");
  const b2 = wsReset.getCell("B7");
  b2.value = {
    text: "🛡️ REVOKE / CANCEL SCHEDULED CLEAR IMMEDIATELY",
    hyperlink: `${baseUrl}/reports?trigger=revoke-wipe`,
    tooltip: "Aborts pending wipe immediately; all records remain safe",
  };
  b2.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, underline: true };
  b2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
  b2.alignment = { vertical: "middle", horizontal: "center" };
  b2.border = borderThin;
  wsReset.getRow(7).height = 32;

  // Button 3: Download Backup
  wsReset.mergeCells("B9:E9");
  const b3 = wsReset.getCell("B9");
  b3.value = {
    text: "📥 DOWNLOAD CURRENT LATEST WORKBOOK BACKUP (.XLSX)",
    hyperlink: `${baseUrl}/api/reports/export-excel`,
    tooltip: "Click to download snapshot backup of this workbook",
  };
  b3.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, underline: true };
  b3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  b3.alignment = { vertical: "middle", horizontal: "center" };
  b3.border = borderThin;
  wsReset.getRow(9).height = 32;

  // Operational Rules Table
  wsReset.mergeCells("A11:F11");
  const rRulesHeader = wsReset.getCell("A11");
  rRulesHeader.value = "HOW THE 24-HOUR SAFETY DELAY & REVOCATION WORKS";
  rRulesHeader.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  rRulesHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  wsReset.getRow(11).height = 22;

  const rules = [
    { step: "1. Pre-Wipe Backup", text: "When you click 'Schedule 24-Hour Clear', your default browser immediately downloads the latest complete Excel workbook as an offline backup." },
    { step: "2. Strict 24-Hour Delay", text: "A 24-hour server timer begins. Absolutely NO records or files are cleared at this moment. All data remains active and accessible." },
    { step: "3. Revocation Anytime", text: "If you clicked by mistake or decide not to clear, click 'Revoke Clear' anytime during the 24 hours. The schedule will be cancelled instantly." },
    { step: "4. Execution After 24 Hours", text: "ONLY when the 24 hours have completely passed without revocation, all transactions, splits, payments, and bank distrip records are wiped." },
    { step: "5. Master Parties Preserved", text: "The 5 core trading parties (HAJA · MK · NF2 · SALA · SARAB) and master distributor accounts are PERMANENTLY preserved." },
  ];

  rules.forEach((rule, idx) => {
    const rowNum = 12 + idx;
    wsReset.getCell(`A${rowNum}`).value = rule.step;
    wsReset.getCell(`A${rowNum}`).font = { bold: true, size: 9.5, color: { argb: "FF0F766E" } };
    wsReset.getCell(`A${rowNum}`).border = borderThin;
    wsReset.mergeCells(`B${rowNum}:F${rowNum}`);
    const cellDesc = wsReset.getCell(`B${rowNum}`);
    cellDesc.value = rule.text;
    cellDesc.font = { size: 9.5, color: { argb: "FF334155" } };
    cellDesc.border = borderThin;
    wsReset.getRow(rowNum).height = 20;
  });

  wsReset.columns = [
    { width: 24 }, // A
    { width: 22 }, // B
    { width: 22 }, // C
    { width: 22 }, // D
    { width: 22 }, // E
    { width: 24 }, // F
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATIC DISK WORKBOOK SYNCHRONIZATION
// Whenever parties, customers, transactions, payments, or splits change,
// this debounced sync updates Remittance_Business_Normalized_Master.xlsx
// ═══════════════════════════════════════════════════════════════════════════
let syncTimeout: NodeJS.Timeout | null = null;
let isSyncing = false;

export function triggerMasterWorkbookSync(): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    if (isSyncing) return;
    try {
      isSyncing = true;
      const buffer = await generateNormalizedMasterWorkbook();
      const filePath = path.resolve(process.cwd(), "Remittance_Business_Normalized_Master.xlsx");
      await fs.writeFile(filePath, buffer);
      console.log(`[Excel Sync] Remittance_Business_Normalized_Master.xlsx auto-updated (${buffer.length} bytes)`);
    } catch (err) {
      console.error("[Excel Sync] Failed to auto-update Remittance_Business_Normalized_Master.xlsx:", err);
    } finally {
      isSyncing = false;
    }
  }, 1200);
}

// Register real-time sync listener on server startup
if (typeof window === "undefined") {
  onDataChange(() => {
    triggerMasterWorkbookSync();
  });
}

