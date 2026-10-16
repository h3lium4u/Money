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
} from "../repository.ts";

export async function generateNormalizedMasterWorkbook(filters?: {
  from?: string;
  to?: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Accounts Management System";
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

  // Reusable Pre-allocated Styling Helpers (Fast & GC-friendly)
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

  const fillZebra: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };

  const alignCenter: Partial<ExcelJS.Alignment> = { vertical: "middle", horizontal: "center" };
  const alignRight: Partial<ExcelJS.Alignment> = { vertical: "middle", horizontal: "right" };
  const alignLeft: Partial<ExcelJS.Alignment> = { vertical: "middle", horizontal: "left" };

  function styleHeader(row: ExcelJS.Row, hexColor: string) {
    row.font = headerFont;
    row.height = 26;
    const fillHeader: ExcelJS.FillPattern = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: hexColor },
    };
    row.eachCell((cell) => {
      cell.fill = fillHeader;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = borderThin;
    });
  }

  function styleDataRow(row: ExcelJS.Row, isEven = false) {
    row.height = 21;
    row.font = dataFont;
    const fill = isEven ? fillZebra : undefined;
    row.eachCell((cell) => {
      cell.border = borderThin;
      if (!cell.alignment) {
        cell.alignment = alignLeft;
      } else {
        cell.alignment.vertical = "middle";
      }
      if (fill) cell.fill = fill;
    });
  }

  function styleTotalRow(row: ExcelJS.Row, fillHex = "FFF1F5F9") {
    row.height = 25;
    row.font = totalRowFont;
    const fillTotal: ExcelJS.FillPattern = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillHex },
    };
    row.eachCell((cell) => {
      cell.border = borderTotal;
      if (!cell.alignment) {
        cell.alignment = alignLeft;
      } else {
        cell.alignment.vertical = "middle";
      }
      cell.fill = fillTotal;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 01. DUBAI CUSTOMERS
  // ═══════════════════════════════════════════════════════════════════════════
  const wsCust = wb.addWorksheet("01_Customers", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
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
  wsCust.autoFilter = "A1:J1";

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
  // 02. PARTIES MASTER (HAJA, MK, NF2, SALA, SARAB)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsParty = wb.addWorksheet("02_Parties_Master", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
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
  wsParty.autoFilter = "A1:I1";

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
  // 03. DUBAI CLIENT TRANSFERS (CUSTOMER REMITTANCES)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsTxn = wb.addWorksheet("03_Dubai_Client_Transfers", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
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
  wsTxn.autoFilter = "A1:M1";

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
  // 04. PARTY TRANSFERS (AED & INR)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsPt = wb.addWorksheet("04_Party_Transfers", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
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
  wsPt.autoFilter = "A1:N1";

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
  // 05. CUSTOMER PAYMENTS (COLLECTIONS IN AED)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsPay = wb.addWorksheet("05_Customer_Payments", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
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
  wsPay.autoFilter = "A1:K1";

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
  // 06. DISTRIBUTION SPLITS (INDIA ALLOCATIONS)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsSplits = wb.addWorksheet("06_Distribution_Splits", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
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
  wsSplits.autoFilter = "A1:L1";

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
  // 07. DISTRIBUTORS MASTER LIST
  // ═══════════════════════════════════════════════════════════════════════════
  const wsDist = wb.addWorksheet("07_Distributors", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
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
  wsDist.autoFilter = "A1:H1";

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
  // 08. BANK DISTRIBUTION SETTLEMENT (BANK DISTRIP - AUTHORITATIVE LEDGER)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsBank = wb.addWorksheet("08_Bank_Distribution", { views: [{ state: "frozen", ySplit: 2, showGridLines: true }] });

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

  const grandTotals = bankSettlementState?.grandTotals || {
    grand_order: 0,
    grand_commission: 0,
    grand_paid: 0,
    grand_balance: 0,
    distributor_summaries: [],
  };

  const accountsSummary = grandTotals.distributor_summaries || [];
  let summaryRowIdx = 5;

  accountsSummary.forEach((acc: any) => {
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
  // 09. DAILY PERFORMANCE SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const wsDaily = wb.addWorksheet("09_Daily_Summary", { views: [{ state: "frozen", ySplit: 1, showGridLines: true }] });
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
  wsDaily.autoFilter = "A1:G1";

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
        count: { formula: `=COUNTIFS('03_Dubai_Client_Transfers'!$B:$B, A${rowNum})` },
        inr: { formula: `=SUMIFS('03_Dubai_Client_Transfers'!$F:$F, '03_Dubai_Client_Transfers'!$B:$B, A${rowNum})` },
        aed_daily: { formula: `=SUMIFS('03_Dubai_Client_Transfers'!$I:$I, '03_Dubai_Client_Transfers'!$B:$B, A${rowNum})` },
        paid_amount: { formula: `=SUMIFS('03_Dubai_Client_Transfers'!$J:$J, '03_Dubai_Client_Transfers'!$B:$B, A${rowNum})` },
        balance_to_paid: { formula: `=SUMIFS('03_Dubai_Client_Transfers'!$K:$K, '03_Dubai_Client_Transfers'!$B:$B, A${rowNum})` },
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

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATIC DISK WORKBOOK SYNCHRONIZATION
// Whenever parties, customers, transactions, payments, or splits change,
// this debounced sync updates Accounts_Business_Normalized_Master.xlsx
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
      const filePath = path.resolve(process.cwd(), "Accounts_Business_Normalized_Master.xlsx");
      await fs.writeFile(filePath, buffer);
      console.log(`[Excel Sync] Accounts_Business_Normalized_Master.xlsx auto-updated (${buffer.length} bytes)`);
    } catch (err) {
      console.error("[Excel Sync] Failed to auto-update Accounts_Business_Normalized_Master.xlsx:", err);
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

