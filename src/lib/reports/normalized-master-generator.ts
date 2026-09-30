import ExcelJS from "exceljs";
import {
  listCustomers,
  listTransactions,
  listCustomerPayments,
  listDistributionSplits,
  listDistributors,
  listBankDistripAccounts,
  listBankDistripRecords,
  getBankDistributionSettlement,
} from "@/lib/repository";

export async function generateNormalizedMasterWorkbook(filters?: {
  from?: string;
  to?: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Petti Remittance Management System";
  wb.created = new Date();

  // Fetch live database records from Neon PostgreSQL (or SQLite fallback)
  const [
    customers,
    parties,
    customerTransactions,
    partyTransfers,
    payments,
    splits,
    distributors,
    bankSettlementState,
    bankRecords,
  ] = await Promise.all([
    listCustomers("CUSTOMER"),
    listCustomers("PARTY"),
    listTransactions({ entityType: "CUSTOMER", from: filters?.from, to: filters?.to, limit: 10000 }),
    listTransactions({ entityType: "PARTY", from: filters?.from, to: filters?.to, limit: 10000 }),
    listCustomerPayments({ from: filters?.from, to: filters?.to }),
    listDistributionSplits({ from: filters?.from, to: filters?.to }),
    listDistributors(),
    getBankDistributionSettlement(undefined, { from: filters?.from, to: filters?.to }),
    listBankDistripRecords(undefined, "asc"),
  ]);

  // Lookup maps for disambiguation and code resolution
  const custCodeMap = new Map(customers.map((c) => [c.id, c.code || c.id]));
  const partyCodeMap = new Map(parties.map((p) => [p.id, p.code || p.id]));
  const distCodeMap = new Map(distributors.map((d) => [d.id, d.code || d.id]));

  // Reusable Styling Helpers
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  const totalRowFont = { bold: true, size: 10, color: { argb: "FF0F172A" } };
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
    row.eachCell((cell) => {
      cell.border = borderThin;
      cell.alignment = { vertical: "middle" };
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
  titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
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

  // KPI Section 1: Customer Remittances
  wsSumm.mergeCells("A5:B5");
  wsSumm.getCell("A5").value = "1. DUBAI CUSTOMER REMITTANCES";
  wsSumm.getCell("A5").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  wsSumm.getCell("A5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
  wsSumm.getRow(5).height = 22;

  const totalCustInr = customerTransactions.filter(t => t.status === "CONFIRMED").reduce((s, t) => s + (t.inr_amount || 0), 0);
  const totalCustAed = customerTransactions.filter(t => t.status === "CONFIRMED").reduce((s, t) => s + (t.aed_amount || 0), 0);
  const totalCustCostAed = customerTransactions.filter(t => t.status === "CONFIRMED").reduce((s, t) => s + (t.cost_aed || 0), 0);
  const totalGrossAed = customerTransactions.filter(t => t.status === "CONFIRMED").reduce((s, t) => s + (t.gross_profit_aed || 0), 0);
  const totalDelivAed = customerTransactions.filter(t => t.status === "CONFIRMED").reduce((s, t) => s + (t.delivery_charge_aed || 0), 0);
  const totalNetAed = customerTransactions.filter(t => t.status === "CONFIRMED").reduce((s, t) => s + (t.net_profit_aed || 0), 0);
  const totalPaymentsAed = payments.reduce((s, p) => s + (p.amount_aed || 0), 0);
  const outstandingReceivables = Math.max(0, totalCustAed - totalPaymentsAed);

  const custKpis = [
    { label: "Total Customer Volume (INR)", value: totalCustInr, fmt: "#,##0.00" },
    { label: "Total Customer Invoiced (AED)", value: totalCustAed, fmt: "#,##0.00" },
    { label: "Total Payout Cost (AED)", value: totalCustCostAed, fmt: "#,##0.00" },
    { label: "Gross Profit (AED)", value: totalGrossAed, fmt: "#,##0.00" },
    { label: "Delivery Charge Share (20%) (AED)", value: totalDelivAed, fmt: "#,##0.00" },
    { label: "Net Remittance Profit (AED)", value: totalNetAed, fmt: "#,##0.00" },
    { label: "Total Customer Payments Collected (AED)", value: totalPaymentsAed, fmt: "#,##0.00" },
    { label: "Outstanding Customer Receivables (AED)", value: outstandingReceivables, fmt: "#,##0.00" },
  ];

  custKpis.forEach((k, idx) => {
    const r = 6 + idx;
    wsSumm.getCell(`A${r}`).value = k.label;
    wsSumm.getCell(`A${r}`).font = { bold: true, color: { argb: "FF334155" } };
    wsSumm.getCell(`A${r}`).border = borderThin;
    wsSumm.getCell(`B${r}`).value = k.value;
    wsSumm.getCell(`B${r}`).font = { bold: true, size: 11, color: { argb: "FF065F46" } };
    wsSumm.getCell(`B${r}`).numFmt = k.fmt;
    wsSumm.getCell(`B${r}`).alignment = { horizontal: "right" };
    wsSumm.getCell(`B${r}`).border = borderThin;
    wsSumm.getRow(r).height = 20;
  });

  // KPI Section 2: India Settlement Party Transfers
  wsSumm.mergeCells("D5:E5");
  wsSumm.getCell("D5").value = "2. INDIA SETTLEMENT PARTY TRANSFERS";
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
    { label: "Total Party Transfers (INR)", value: totalPartyInr, fmt: "#,##0.00" },
    { label: "Total Party Payout Cost (INR)", value: totalPartyCostInr, fmt: "#,##0.00" },
    { label: "Net Profit on Party Transfers (INR)", value: totalPartyProfitInr, fmt: "#,##0.00" },
    { label: "Active IND Settlement Parties", value: parties.length, fmt: "#,##0" },
    { label: "Total Party Transfers Executed", value: partyTransfers.length, fmt: "#,##0" },
  ];

  partyKpis.forEach((k, idx) => {
    const r = 6 + idx;
    wsSumm.getCell(`D${r}`).value = k.label;
    wsSumm.getCell(`D${r}`).font = { bold: true, color: { argb: "FF334155" } };
    wsSumm.getCell(`D${r}`).border = borderThin;
    wsSumm.getCell(`E${r}`).value = k.value;
    wsSumm.getCell(`E${r}`).font = { bold: true, size: 11, color: { argb: "FF0F766E" } };
    wsSumm.getCell(`E${r}`).numFmt = k.fmt;
    wsSumm.getCell(`E${r}`).alignment = { horizontal: "right" };
    wsSumm.getCell(`E${r}`).border = borderThin;
  });

  // KPI Section 3: Bank Distribution Settlement (BANK DISTRIP)
  const bankStartRow = 15;
  wsSumm.mergeCells(`A${bankStartRow}:E${bankStartRow}`);
  wsSumm.getCell(`A${bankStartRow}`).value = "3. BANK DISTRIBUTION SETTLEMENT (BANK DISTRIP SUMMARY)";
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
    { label: "Grand Total Orders Assigned to Distributors (INR)", value: grandTotals.grand_order, fmt: "#,##0.00" },
    { label: "Grand Total Commission Earned (INR)", value: grandTotals.grand_commission, fmt: "#,##0.00" },
    { label: "Grand Total Paid / Settled (INR)", value: grandTotals.grand_paid, fmt: "#,##0.00" },
    { label: "Net Grand Closing Balance Across All Distributors (INR)", value: grandTotals.grand_balance, fmt: "#,##0.00" },
  ];

  bankKpis.forEach((k, idx) => {
    const r = bankStartRow + 1 + idx;
    wsSumm.mergeCells(`A${r}:C${r}`);
    wsSumm.getCell(`A${r}`).value = k.label;
    wsSumm.getCell(`A${r}`).font = { bold: true, color: { argb: "FF334155" } };
    wsSumm.getCell(`A${r}`).border = borderThin;
    wsSumm.mergeCells(`D${r}:E${r}`);
    wsSumm.getCell(`D${r}`).value = k.value;
    wsSumm.getCell(`D${r}`).font = { bold: true, size: 11, color: { argb: "FF3730A3" } };
    wsSumm.getCell(`D${r}`).numFmt = k.fmt;
    wsSumm.getCell(`D${r}`).alignment = { horizontal: "right" };
    wsSumm.getCell(`D${r}`).border = borderThin;
    wsSumm.getRow(r).height = 20;
  });

  // Business Operational Guidelines
  const noteRow = bankStartRow + 6;
  wsSumm.mergeCells(`A${noteRow}:G${noteRow}`);
  wsSumm.getCell(`A${noteRow}`).value = "WORKBOOK AUDIT & ARCHITECTURE STRUCTURE:";
  wsSumm.getCell(`A${noteRow}`).font = { bold: true, color: { argb: "FF991B1B" }, size: 10 };

  const guidelines = [
    "• Sheet 02 (Customers): Dubai remittance clients with contact details and live outstanding balances in AED.",
    "• Sheet 03 (IND Settlement Parties): India settlement parties (AWAFI, BASID, HAJA, NF2, SARABU) with settlement rates.",
    "• Sheet 04 (Customer Transactions): Complete Dubai customer remittance orders with INR, exchange rates, AED charged, cost, and net profit.",
    "• Sheet 05 (Party Transfers): Dedicated India party transfer registry with INR orders, party rates, cost rate, and net profit in INR.",
    "• Sheet 06 (Customer Payments): Customer cash/bank payment collection records in AED with receipt references.",
    "• Sheet 07 (Distribution Splits): Detailed India distributor split allocations with wholesale rates and AED equivalents.",
    "• Sheet 08 (Distributors): Master list of India payout distributors with total allocations and balances.",
    "• Sheet 09 (Bank Distribution): Exact replica of Excel BANK DISTRIP with independent running balances (BAL = PREV + ORDER + COM - PAID) and Grand Total.",
    "• Sheet 10 (Daily Summary): Daily operational turnover, transaction counts, and net business profitability.",
  ];

  guidelines.forEach((g, idx) => {
    const r = noteRow + 1 + idx;
    wsSumm.mergeCells(`A${r}:G${r}`);
    wsSumm.getCell(`A${r}`).value = g;
    wsSumm.getCell(`A${r}`).font = { size: 9, color: { argb: "FF475569" } };
  });

  wsSumm.columns = [
    { width: 36 },
    { width: 26 },
    { width: 6 },
    { width: 34 },
    { width: 26 },
    { width: 14 },
    { width: 14 },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // 02. DUBAI CUSTOMERS
  // ═══════════════════════════════════════════════════════════════════════════
  const wsCust = wb.addWorksheet("02_Customers", { views: [{ state: "frozen", ySplit: 1 }] });
  wsCust.columns = [
    { header: "Customer ID", key: "id", width: 18 },
    { header: "Customer Name", key: "name", width: 25 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Default Rate", key: "rate", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Total INR Processed", key: "total_inr", width: 22 },
    { header: "Total AED Charged", key: "total_aed", width: 20 },
    { header: "Total AED Paid", key: "total_paid", width: 20 },
    { header: "Outstanding Balance (AED)", key: "balance", width: 24 },
    { header: "Created Date", key: "created_date", width: 16 },
  ];
  styleHeader(wsCust.getRow(1), "FF047857"); // Emerald

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
    row.getCell(4).numFmt = "0.0000";
    row.getCell(6).numFmt = "#,##0.00";
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(8).numFmt = "#,##0.00";
    row.getCell(9).numFmt = "#,##0.00";
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
  custTotalRow.getCell(6).numFmt = "#,##0.00";
  custTotalRow.getCell(7).numFmt = "#,##0.00";
  custTotalRow.getCell(8).numFmt = "#,##0.00";
  custTotalRow.getCell(9).numFmt = "#,##0.00";
  styleTotalRow(custTotalRow);

  // ═══════════════════════════════════════════════════════════════════════════
  // 03. INDIA SETTLEMENT PARTIES (AWAFI, BASID, HAJA, NF2, SARABU)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsParty = wb.addWorksheet("03_IND_Settlement_Parties", { views: [{ state: "frozen", ySplit: 1 }] });
  wsParty.columns = [
    { header: "Party Code", key: "code", width: 18 },
    { header: "IND Party Name", key: "name", width: 25 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Default Settlement Rate", key: "rate", width: 24 },
    { header: "Entity Type", key: "type", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Total INR Transferred", key: "total_inr", width: 22 },
    { header: "Total Net Profit (INR)", key: "net_profit_inr", width: 22 },
    { header: "Created Date", key: "created_date", width: 16 },
  ];
  styleHeader(wsParty.getRow(1), "FF0F766E"); // Teal

  parties.forEach((p, idx) => {
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
      phone: p.phone || "-",
      rate: p.default_rate || 38.67,
      type: "IND_SETTLEMENT_PARTY",
      status: p.status || "ACTIVE",
      total_inr: pTotalInr,
      net_profit_inr: pProfitInr,
      created_date: p.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    });
    row.getCell(4).numFmt = "0.0000";
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(8).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  const lastPartyRow = parties.length + 1;
  const partyTotalRow = wsParty.addRow({
    code: "TOTAL",
    name: `${parties.length} Settlement Parties`,
    phone: "",
    rate: "",
    type: "",
    status: "",
    total_inr: { formula: `=SUM(G2:G${lastPartyRow})` },
    net_profit_inr: { formula: `=SUM(H2:H${lastPartyRow})` },
    created_date: "",
  });
  partyTotalRow.getCell(7).numFmt = "#,##0.00";
  partyTotalRow.getCell(8).numFmt = "#,##0.00";
  styleTotalRow(partyTotalRow);

  // ═══════════════════════════════════════════════════════════════════════════
  // 04. CUSTOMER TRANSACTIONS (DUBAI CUSTOMERS)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsTxn = wb.addWorksheet("04_Customer_Transactions", { views: [{ state: "frozen", ySplit: 1 }] });
  wsTxn.columns = [
    { header: "Transaction ID", key: "txn_id", width: 18 },             // Col A
    { header: "Date", key: "date", width: 14 },                          // Col B
    { header: "Customer ID", key: "cust_id", width: 16 },                // Col C
    { header: "Customer Name", key: "cust_name", width: 24 },            // Col D
    { header: "INR Order Amount", key: "inr_amount", width: 18 },        // Col E
    { header: "Customer Rate", key: "daily_rate", width: 15 },           // Col F
    { header: "Base Rate", key: "my_rate", width: 14 },                  // Col G
    { header: "AED Charged", key: "aed_daily", width: 18 },              // Col H: =(E/1000)*F
    { header: "AED Cost", key: "aed_my_rate", width: 18 },               // Col I: =E/G
    { header: "Gross Profit (AED)", key: "gross_profit", width: 18 },    // Col J: =H-I
    { header: "Delivery %", key: "deliv_pct", width: 14 },               // Col K
    { header: "Delivery Cut (AED)", key: "deliv_amt", width: 18 },       // Col L: =J*K
    { header: "Net Profit (AED)", key: "net_profit", width: 18 },        // Col M: =J-L
    { header: "India Distributors", key: "dist_names", width: 25 },      // Col N
    { header: "Split Breakdown", key: "split_details", width: 34 },      // Col O
    { header: "Split Status", key: "split_status", width: 18 },          // Col P
    { header: "Status", key: "status", width: 14 },                      // Col Q
    { header: "Notes", key: "notes", width: 30 },                        // Col R
  ];
  styleHeader(wsTxn.getRow(1), "FF065F46"); // Dark Emerald

  customerTransactions.forEach((t, i) => {
    const rowNum = i + 2;
    const isFullyAllocated = (t.remaining_inr === 0);
    const uniqueCustId = custCodeMap.get(t.customer_id) || t.customer_code || (t.customer_id ? t.customer_id.slice(0, 8) : "-");

    const row = wsTxn.addRow({
      txn_id: t.transaction_number,
      date: t.transaction_date,
      cust_id: uniqueCustId,
      cust_name: t.customer_name || "-",
      inr_amount: t.inr_amount,
      daily_rate: t.customer_rate,
      my_rate: t.base_rate,
      aed_daily: { formula: `=(E${rowNum}/1000)*F${rowNum}` },
      aed_my_rate: { formula: `=E${rowNum}/G${rowNum}` },
      gross_profit: { formula: `=H${rowNum}-I${rowNum}` },
      deliv_pct: t.delivery_charge_pct,
      deliv_amt: { formula: `=J${rowNum}*K${rowNum}` },
      net_profit: { formula: `=J${rowNum}-L${rowNum}` },
      dist_names: t.distributor_names || t.distributor_name || "-",
      split_details: t.distributor_split_details || "-",
      split_status: isFullyAllocated ? "FULLY ALLOCATED" : `Pending ₹${(t.remaining_inr || 0).toLocaleString()}`,
      status: t.status,
      notes: t.notes || "-",
    });

    row.getCell(5).numFmt = "#,##0.00"; // INR Order Amount
    row.getCell(6).numFmt = "0.0000";   // Customer Rate
    row.getCell(7).numFmt = "0.0000";   // Base Rate
    row.getCell(8).numFmt = "#,##0.00"; // AED Charged
    row.getCell(9).numFmt = "#,##0.00"; // AED Cost
    row.getCell(10).numFmt = "#,##0.00"; // Gross Profit
    row.getCell(11).numFmt = "0.00%";   // Delivery %
    row.getCell(12).numFmt = "#,##0.00"; // Delivery Cut
    row.getCell(13).numFmt = "#,##0.00"; // Net Profit

    styleDataRow(row, i % 2 === 1);

    if (isFullyAllocated) {
      [row.getCell(14), row.getCell(16)].forEach((c) => {
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD4EDDA" },
        };
        c.font = { color: { argb: "FF155724" }, bold: true };
      });
    }
  });

  const lastTxnRow = customerTransactions.length + 1;
  const txnTotalRow = wsTxn.addRow({
    txn_id: "TOTAL",
    date: "",
    cust_id: "",
    cust_name: `${customerTransactions.length} Transactions`,
    inr_amount: { formula: `=SUM(E2:E${lastTxnRow})` },
    daily_rate: "",
    my_rate: "",
    aed_daily: { formula: `=SUM(H2:H${lastTxnRow})` },
    aed_my_rate: { formula: `=SUM(I2:I${lastTxnRow})` },
    gross_profit: { formula: `=SUM(J2:J${lastTxnRow})` },
    deliv_pct: "",
    deliv_amt: { formula: `=SUM(L2:L${lastTxnRow})` },
    net_profit: { formula: `=SUM(M2:M${lastTxnRow})` },
    dist_names: "",
    split_details: "",
    split_status: "",
    status: "",
    notes: "",
  });
  txnTotalRow.getCell(5).numFmt = "#,##0.00";
  txnTotalRow.getCell(8).numFmt = "#,##0.00";
  txnTotalRow.getCell(9).numFmt = "#,##0.00";
  txnTotalRow.getCell(10).numFmt = "#,##0.00";
  txnTotalRow.getCell(12).numFmt = "#,##0.00";
  txnTotalRow.getCell(13).numFmt = "#,##0.00";
  styleTotalRow(txnTotalRow);

  // ═══════════════════════════════════════════════════════════════════════════
  // 05. PARTY TRANSFERS (INDIA SETTLEMENT PARTIES - IN INR)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsPt = wb.addWorksheet("05_Party_Transfers", { views: [{ state: "frozen", ySplit: 1 }] });
  wsPt.columns = [
    { header: "Transfer ID", key: "txn_id", width: 18 },              // Col A
    { header: "Date", key: "date", width: 14 },                       // Col B
    { header: "IND Party Code", key: "party_code", width: 16 },       // Col C
    { header: "IND Party Name", key: "party_name", width: 22 },       // Col D
    { header: "INR Order", key: "inr_order", width: 18 },             // Col E
    { header: "Party Rate", key: "party_rate", width: 15 },           // Col F
    { header: "Cost Rate", key: "cost_rate", width: 15 },             // Col G
    { header: "INR Cost", key: "inr_cost", width: 18 },               // Col H: =IF(F>0, E*(G/F), 0)
    { header: "Net Profit (INR)", key: "net_profit_inr", width: 18 }, // Col I: =E-H
    { header: "Payout Distributor", key: "dist_name", width: 22 },    // Col J
    { header: "Status", key: "status", width: 14 },                   // Col K
    { header: "Notes", key: "notes", width: 30 },                     // Col L
  ];
  styleHeader(wsPt.getRow(1), "FF0E7490"); // Cyan / Teal

  partyTransfers.forEach((t, i) => {
    const rowNum = i + 2;
    const uniquePartyCode = partyCodeMap.get(t.customer_id) || t.customer_code || t.customer_id || "-";

    const row = wsPt.addRow({
      txn_id: t.transaction_number,
      date: t.transaction_date,
      party_code: uniquePartyCode,
      party_name: t.customer_name || "-",
      inr_order: t.inr_amount,
      party_rate: t.customer_rate,
      cost_rate: t.base_rate,
      inr_cost: { formula: `=IF(F${rowNum}>0, E${rowNum}*(G${rowNum}/F${rowNum}), 0)` },
      net_profit_inr: { formula: `=E${rowNum}-H${rowNum}` },
      dist_name: t.distributor_names || t.distributor_name || "-",
      status: t.status,
      notes: t.notes || "-",
    });

    row.getCell(5).numFmt = "#,##0.00"; // INR Order
    row.getCell(6).numFmt = "0.0000";   // Party Rate
    row.getCell(7).numFmt = "0.0000";   // Cost Rate
    row.getCell(8).numFmt = "#,##0.00"; // INR Cost
    row.getCell(9).numFmt = "#,##0.00"; // Net Profit (INR)

    styleDataRow(row, i % 2 === 1);
  });

  const lastPtRow = partyTransfers.length + 1;
  const ptTotalRow = wsPt.addRow({
    txn_id: "TOTAL",
    date: "",
    party_code: "",
    party_name: `${partyTransfers.length} Party Transfers`,
    inr_order: { formula: `=SUM(E2:E${lastPtRow})` },
    party_rate: "",
    cost_rate: "",
    inr_cost: { formula: `=SUM(H2:H${lastPtRow})` },
    net_profit_inr: { formula: `=SUM(I2:I${lastPtRow})` },
    dist_name: "",
    status: "",
    notes: "",
  });
  ptTotalRow.getCell(5).numFmt = "#,##0.00";
  ptTotalRow.getCell(8).numFmt = "#,##0.00";
  ptTotalRow.getCell(9).numFmt = "#,##0.00";
  styleTotalRow(ptTotalRow);

  // ═══════════════════════════════════════════════════════════════════════════
  // 06. CUSTOMER PAYMENTS (COLLECTIONS IN AED)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsPay = wb.addWorksheet("06_Customer_Payments", { views: [{ state: "frozen", ySplit: 1 }] });
  wsPay.columns = [
    { header: "Payment ID", key: "pay_id", width: 16 },             // Col A
    { header: "Date", key: "date", width: 14 },                      // Col B
    { header: "Customer ID", key: "cust_id", width: 16 },            // Col C
    { header: "Customer Name", key: "cust_name", width: 22 },        // Col D
    { header: "Linked Txn #", key: "txn_id", width: 20 },            // Col E
    { header: "Amount (AED)", key: "amount", width: 18 },            // Col F
    { header: "Currency", key: "currency", width: 12 },              // Col G
    { header: "Payment Method", key: "type", width: 18 },            // Col H
    { header: "Reference / Receipt #", key: "ref_no", width: 22 },   // Col I
    { header: "Notes", key: "notes", width: 30 },                    // Col J
  ];
  styleHeader(wsPay.getRow(1), "FF15803D"); // Green

  payments.forEach((p: any, idx: number) => {
    const uniqueCustId = custCodeMap.get(p.customer_id) || p.customer_code || (p.customer_id ? p.customer_id.slice(0, 8) : "-");
    const row = wsPay.addRow({
      pay_id: p.payment_number || p.id,
      date: p.payment_date,
      cust_id: uniqueCustId,
      cust_name: p.customer_name,
      txn_id: p.transaction_number || "-",
      amount: p.amount_aed,
      currency: "AED",
      type: p.payment_method || "CASH",
      ref_no: p.reference_number || "-",
      notes: p.notes || "-",
    });
    row.getCell(6).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  const lastPayRow = payments.length + 1;
  const payTotalRow = wsPay.addRow({
    pay_id: "TOTAL",
    date: "",
    cust_id: "",
    cust_name: `${payments.length} Payments Collected`,
    txn_id: "",
    amount: { formula: `=SUM(F2:F${lastPayRow})` },
    currency: "AED",
    type: "",
    ref_no: "",
    notes: "",
  });
  payTotalRow.getCell(6).numFmt = "#,##0.00";
  styleTotalRow(payTotalRow);

  // ═══════════════════════════════════════════════════════════════════════════
  // 07. DISTRIBUTION SPLITS (INDIA ALLOCATIONS)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsSplits = wb.addWorksheet("07_Distribution_Splits", { views: [{ state: "frozen", ySplit: 1 }] });
  wsSplits.columns = [
    { header: "Split ID", key: "split_id", width: 16 },              // Col A
    { header: "Date", key: "date", width: 14 },                      // Col B
    { header: "Txn #", key: "txn_id", width: 20 },                   // Col C
    { header: "Customer ID", key: "cust_id", width: 16 },            // Col D
    { header: "Customer Name", key: "cust_name", width: 20 },        // Col E
    { header: "Distributor Code", key: "dist_code", width: 18 },     // Col F
    { header: "Distributor Name", key: "dist_name", width: 24 },     // Col G
    { header: "INR Split Amount", key: "inr_amount", width: 18 },    // Col H
    { header: "Wholesale Rate", key: "rate", width: 16 },            // Col I
    { header: "AED Equivalent", key: "aed_eq", width: 18 },          // Col J: =IF(I>0, H/I, 0)
    { header: "Status", key: "status", width: 14 },                  // Col K
    { header: "Notes", key: "notes", width: 35 },                    // Col L
  ];
  styleHeader(wsSplits.getRow(1), "FF1E40AF"); // Navy Blue

  splits.forEach((s, idx) => {
    const rowNum = idx + 2;
    const uniqueCustId = custCodeMap.get(s.customer_id || "") || s.customer_code || (s.customer_id ? s.customer_id.slice(0, 8) : "-");
    const uniqueDistCode = distCodeMap.get(s.distributor_id) || s.distributor_code || s.distributor_id;

    const row = wsSplits.addRow({
      split_id: s.id.slice(0, 12),
      date: s.split_date,
      txn_id: s.transaction_number,
      cust_id: uniqueCustId,
      cust_name: s.customer_name,
      dist_code: uniqueDistCode,
      dist_name: s.distributor_name || s.distributor_code,
      inr_amount: s.inr_amount,
      rate: s.wholesale_rate,
      aed_eq: { formula: `=IF(I${rowNum}>0, H${rowNum}/I${rowNum}, 0)` },
      status: s.status,
      notes: s.notes || "-",
    });
    row.getCell(8).numFmt = "#,##0.00";
    row.getCell(9).numFmt = "0.0000";
    row.getCell(10).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  const lastSplitRow = splits.length + 1;
  const splitTotalRow = wsSplits.addRow({
    split_id: "TOTAL",
    date: "",
    txn_id: "",
    cust_id: "",
    cust_name: `${splits.length} Allocations`,
    dist_code: "",
    dist_name: "",
    inr_amount: { formula: `=SUM(H2:H${lastSplitRow})` },
    rate: "",
    aed_eq: { formula: `=SUM(J2:J${lastSplitRow})` },
    status: "",
    notes: "",
  });
  splitTotalRow.getCell(8).numFmt = "#,##0.00";
  splitTotalRow.getCell(10).numFmt = "#,##0.00";
  styleTotalRow(splitTotalRow);

  // ═══════════════════════════════════════════════════════════════════════════
  // 08. DISTRIBUTORS MASTER LIST
  // ═══════════════════════════════════════════════════════════════════════════
  const wsDist = wb.addWorksheet("08_Distributors", { views: [{ state: "frozen", ySplit: 1 }] });
  wsDist.columns = [
    { header: "Distributor Code", key: "code", width: 18 },          // Col A
    { header: "Distributor Name", key: "name", width: 24 },          // Col B
    { header: "Partner Type", key: "type", width: 20 },             // Col C
    { header: "Settlement Currency", key: "curr", width: 18 },       // Col D
    { header: "Status", key: "status", width: 14 },                  // Col E
    { header: "Total INR Allocated", key: "total_inr", width: 22 }, // Col F
    { header: "Total Paid (INR)", key: "total_paid", width: 20 },    // Col G
    { header: "Outstanding Balance (INR)", key: "bal_inr", width: 24 }, // Col H
  ];
  styleHeader(wsDist.getRow(1), "FF1E3A8A"); // Indigo

  distributors.forEach((d, idx) => {
    const row = wsDist.addRow({
      code: d.code || d.id,
      name: d.name,
      type: d.partner_type || "DISTRIBUTOR",
      curr: d.default_settlement_currency || "INR",
      status: d.status || "ACTIVE",
      total_inr: d.total_splits_inr || 0,
      total_paid: d.total_splits_paid_inr || 0,
      bal_inr: d.splits_balance_inr || 0,
    });
    row.getCell(6).numFmt = "#,##0.00";
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(8).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  const lastDistRow = distributors.length + 1;
  const distTotalRow = wsDist.addRow({
    code: "TOTAL",
    name: `${distributors.length} Distributors`,
    type: "",
    curr: "",
    status: "",
    total_inr: { formula: `=SUM(F2:F${lastDistRow})` },
    total_paid: { formula: `=SUM(G2:G${lastDistRow})` },
    bal_inr: { formula: `=SUM(H2:H${lastDistRow})` },
  });
  distTotalRow.getCell(6).numFmt = "#,##0.00";
  distTotalRow.getCell(7).numFmt = "#,##0.00";
  distTotalRow.getCell(8).numFmt = "#,##0.00";
  styleTotalRow(distTotalRow);

  // ═══════════════════════════════════════════════════════════════════════════
  // 09. BANK DISTRIBUTION SETTLEMENT (BANK DISTRIP - EXCEL COMPLIANT)
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
    "Records",
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

    row.getCell(3).numFmt = "#,##0.00";
    row.getCell(4).numFmt = "#,##0.00";
    row.getCell(5).numFmt = "#,##0.00";
    row.getCell(6).numFmt = "#,##0.00";
    row.getCell(7).numFmt = "#,##0";
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

  grandTotalRow.getCell(3).numFmt = "#,##0.00";
  grandTotalRow.getCell(4).numFmt = "#,##0.00";
  grandTotalRow.getCell(5).numFmt = "#,##0.00";
  grandTotalRow.getCell(6).numFmt = "#,##0.00";
  grandTotalRow.getCell(7).numFmt = "#,##0";
  styleTotalRow(grandTotalRow, "FFE0E7FF"); // Soft Indigo fill

  // ─── PART 2: DATE-WISE SETTLEMENT LEDGERS PER DISTRIBUTOR ────────────────
  // Group records by account
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
    wsBank.mergeCells(`A${currRow}:F${currRow}`);
    const secCell = wsBank.getCell(`A${currRow}`);
    secCell.value = `DISTRIBUTOR: ${acc.account_code} - ${acc.account_name} (Closing Bal: ₹${acc.closing_balance.toLocaleString()})`;
    secCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    secCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF312E81" } }; // Darker Indigo
    wsBank.getRow(currRow).height = 24;
    currRow++;

    // Sub-table Columns
    const distSubHeaders = [
      "DATE",
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
      emptyRow.getCell(2).value = 0;
      emptyRow.getCell(3).value = 0;
      emptyRow.getCell(4).value = 0;
      emptyRow.getCell(5).value = 0;
      emptyRow.getCell(6).value = "No settlement records recorded yet";
      for (let c = 2; c <= 5; c++) emptyRow.getCell(c).numFmt = "#,##0.00";
      styleDataRow(emptyRow);
      currRow++;
    } else {
      accRecords.forEach((rec, recIdx) => {
        const rNum = currRow;
        const row = wsBank.getRow(rNum);
        row.getCell(1).value = rec.record_date;
        row.getCell(2).value = rec.order_inr;
        row.getCell(3).value = rec.commission_inr;
        row.getCell(4).value = rec.paid_inr;

        // Running balance formula: Row 1 = ORDER + COM - PAID, Row n = PrevBAL + ORDER + COM - PAID
        if (recIdx === 0) {
          row.getCell(5).value = { formula: `=B${rNum}+C${rNum}-D${rNum}` };
        } else {
          row.getCell(5).value = { formula: `=E${rNum - 1}+B${rNum}+C${rNum}-D${rNum}` };
        }

        row.getCell(6).value = rec.notes || "-";

        row.getCell(2).numFmt = "#,##0.00";
        row.getCell(3).numFmt = "#,##0.00";
        row.getCell(4).numFmt = "#,##0.00";
        row.getCell(5).numFmt = "#,##0.00";
        styleDataRow(row, recIdx % 2 === 1);
        currRow++;
      });
    }

    const distEndRow = currRow - 1;
    // Total Row for this distributor
    const dTotRow = wsBank.getRow(currRow);
    dTotRow.getCell(1).value = `TOTAL ${acc.account_code}`;
    dTotRow.getCell(2).value = { formula: `=SUM(B${distStartRow}:B${distEndRow})` };
    dTotRow.getCell(3).value = { formula: `=SUM(C${distStartRow}:C${distEndRow})` };
    dTotRow.getCell(4).value = { formula: `=SUM(D${distStartRow}:D${distEndRow})` };
    // Closing balance cell: Points to the last row's running balance cell!
    dTotRow.getCell(5).value = { formula: `=E${distEndRow}` };
    dTotRow.getCell(6).value = `Closing Balance for ${acc.account_code}`;

    dTotRow.getCell(2).numFmt = "#,##0.00";
    dTotRow.getCell(3).numFmt = "#,##0.00";
    dTotRow.getCell(4).numFmt = "#,##0.00";
    dTotRow.getCell(5).numFmt = "#,##0.00";
    styleTotalRow(dTotRow, "FFF3F4F6");

    currRow += 2; // Spacer between distributors
  }

  wsBank.columns = [
    { width: 16 }, // A: Date / Party Code
    { width: 28 }, // B: Order / Name
    { width: 22 }, // C: Com / Order
    { width: 22 }, // D: Paid / Com
    { width: 24 }, // E: Bal / Paid
    { width: 28 }, // F: Notes / Bal
    { width: 14 }, // G: Records
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. DAILY PERFORMANCE SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const wsDaily = wb.addWorksheet("10_Daily_Summary", { views: [{ state: "frozen", ySplit: 1 }] });
  wsDaily.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Customer Transfers", key: "count", width: 20 },
    { header: "Customer INR Volume", key: "inr", width: 22 },
    { header: "Customer Invoiced (AED)", key: "aed_daily", width: 24 },
    { header: "Customer Cost (AED)", key: "aed_cost", width: 22 },
    { header: "Gross Profit (AED)", key: "gross", width: 18 },
    { header: "Delivery Fee Share (AED)", key: "deliv", width: 24 },
    { header: "Net Profit (AED)", key: "net", width: 20 },
    { header: "Payments Received (AED)", key: "payments", width: 24 },
    { header: "Daily Net Cash Flow (AED)", key: "cash_flow", width: 24 },
  ];
  styleHeader(wsDaily.getRow(1), "FF0E7490"); // Cyan / Teal

  // Aggregate daily records
  const dateSet = new Set<string>();
  customerTransactions.forEach((t) => { if (t.transaction_date) dateSet.add(t.transaction_date); });
  payments.forEach((p) => { if (p.payment_date) dateSet.add(p.payment_date); });
  partyTransfers.forEach((pt) => { if (pt.transaction_date) dateSet.add(pt.transaction_date); });

  const sortedDates = Array.from(dateSet).sort().reverse();

  sortedDates.forEach((d, idx) => {
    const rowNum = idx + 2;
    const row = wsDaily.addRow({
      date: d,
      count: { formula: `=COUNTIFS('04_Customer_Transactions'!$B:$B, A${rowNum})` },
      inr: { formula: `=SUMIFS('04_Customer_Transactions'!$E:$E, '04_Customer_Transactions'!$B:$B, A${rowNum})` },
      aed_daily: { formula: `=SUMIFS('04_Customer_Transactions'!$H:$H, '04_Customer_Transactions'!$B:$B, A${rowNum})` },
      aed_cost: { formula: `=SUMIFS('04_Customer_Transactions'!$I:$I, '04_Customer_Transactions'!$B:$B, A${rowNum})` },
      gross: { formula: `=SUMIFS('04_Customer_Transactions'!$J:$J, '04_Customer_Transactions'!$B:$B, A${rowNum})` },
      deliv: { formula: `=SUMIFS('04_Customer_Transactions'!$L:$L, '04_Customer_Transactions'!$B:$B, A${rowNum})` },
      net: { formula: `=SUMIFS('04_Customer_Transactions'!$M:$M, '04_Customer_Transactions'!$B:$B, A${rowNum})` },
      payments: { formula: `=SUMIFS('06_Customer_Payments'!$F:$F, '06_Customer_Payments'!$B:$B, A${rowNum})` },
      cash_flow: { formula: `=I${rowNum}-E${rowNum}` },
    });

    row.getCell(2).numFmt = "#,##0";
    for (let c = 3; c <= 10; c++) {
      row.getCell(c).numFmt = "#,##0.00";
    }
    styleDataRow(row, idx % 2 === 1);
  });

  const lastDailyRow = sortedDates.length + 1;
  const dailyTotalRow = wsDaily.addRow({
    date: "TOTAL",
    count: { formula: `=SUM(B2:B${lastDailyRow})` },
    inr: { formula: `=SUM(C2:C${lastDailyRow})` },
    aed_daily: { formula: `=SUM(D2:D${lastDailyRow})` },
    aed_cost: { formula: `=SUM(E2:E${lastDailyRow})` },
    gross: { formula: `=SUM(F2:F${lastDailyRow})` },
    deliv: { formula: `=SUM(G2:G${lastDailyRow})` },
    net: { formula: `=SUM(H2:H${lastDailyRow})` },
    payments: { formula: `=SUM(I2:I${lastDailyRow})` },
    cash_flow: { formula: `=SUM(J2:J${lastDailyRow})` },
  });
  dailyTotalRow.getCell(2).numFmt = "#,##0";
  for (let c = 3; c <= 10; c++) {
    dailyTotalRow.getCell(c).numFmt = "#,##0.00";
  }
  styleTotalRow(dailyTotalRow);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
