import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs";

async function generateMasterWorkbook() {
  console.log("Generating Normalized Business-Data Excel Workbook...");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Petti Remittance Management System";
  wb.created = new Date();

  // Helper styles
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  function styleHeader(row: ExcelJS.Row, hexColor: string) {
    row.font = headerFont;
    row.height = 28;
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
    row.height = 22;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 01. CUSTOMERS SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  const wsCust = wb.addWorksheet("01_Customers", { views: [{ state: "frozen", ySplit: 1 }] });
  wsCust.columns = [
    { header: "Customer ID", key: "id", width: 16 },
    { header: "Customer Name", key: "name", width: 25 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Email", key: "email", width: 25 },
    { header: "Status", key: "status", width: 14 },
    { header: "Notes", key: "notes", width: 35 },
    { header: "Created Date", key: "created_date", width: 16 },
  ];
  styleHeader(wsCust.getRow(1), "FF047857"); // Emerald

  const sampleCustomers = [
    { id: "CUST-001", name: "SAMI", phone: "+971 50 123 4567", email: "sami@example.com", status: "ACTIVE", notes: "Regular Dubai trade customer", created_date: "2026-09-01" },
    { id: "CUST-002", name: "DIVAN", phone: "+971 52 987 6543", email: "divan@example.com", status: "ACTIVE", notes: "High volume INR remittances", created_date: "2026-09-01" },
    { id: "CUST-003", name: "FAIZ BU", phone: "+971 55 456 7890", email: "", status: "ACTIVE", notes: "Commercial wholesale trader", created_date: "2026-09-05" },
    { id: "CUST-004", name: "RAKSAN", phone: "+971 56 345 6789", email: "", status: "ACTIVE", notes: "Weekly settlement account", created_date: "2026-09-10" },
    { id: "CUST-005", name: "SATHIK", phone: "+971 50 876 5432", email: "", status: "ACTIVE", notes: "Dubai electronics merchant", created_date: "2026-09-12" },
    { id: "CUST-006", name: "Ahmad", phone: "+971 54 222 3344", email: "ahmad@example.com", status: "ACTIVE", notes: "Multi-distributor split account", created_date: "2026-09-15" },
    { id: "CUST-007", name: "Aslam", phone: "+971 58 111 2233", email: "aslam@example.com", status: "ACTIVE", notes: "Regular transfer client", created_date: "2026-09-20" },
  ];
  sampleCustomers.forEach((c, idx) => {
    const row = wsCust.addRow(c);
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 02. TRANSACTIONS SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  const wsTxn = wb.addWorksheet("02_Transactions", { views: [{ state: "frozen", ySplit: 1 }] });
  wsTxn.columns = [
    { header: "Transaction ID", key: "txn_id", width: 18 },
    { header: "Date", key: "date", width: 14 },
    { header: "Customer ID", key: "cust_id", width: 16 },
    { header: "INR Order Amount", key: "inr_amount", width: 18 },
    { header: "Daily Rate", key: "daily_rate", width: 14 },
    { header: "My Rate", key: "my_rate", width: 14 },
    { header: "AED at Daily Rate", key: "aed_daily", width: 18 },
    { header: "AED at My Rate", key: "aed_my_rate", width: 18 },
    { header: "Gross Profit", key: "gross_profit", width: 16 },
    { header: "Delivery Charge %", key: "deliv_pct", width: 16 },
    { header: "Delivery Charge Amount", key: "deliv_amt", width: 22 },
    { header: "Net Profit/Amount", key: "net_profit", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Notes", key: "notes", width: 30 },
    { header: "Created At", key: "created_at", width: 20 },
    { header: "Updated At", key: "updated_at", width: 20 },
  ];
  styleHeader(wsTxn.getRow(1), "FF065F46"); // Dark Emerald

  const sampleTxns = [
    { txn_id: "TXN-2026-000001", date: "2026-09-26", cust_id: "CUST-002", inr: 2000000, daily: 38.30, my: 26.18, deliv: 0.20, notes: "Large trade order - multi-split", created: "2026-09-26 10:00:00" },
    { txn_id: "TXN-2026-000002", date: "2026-09-26", cust_id: "CUST-001", inr: 1500000, daily: 38.25, my: 26.20, deliv: 0.20, notes: "Full INR distribution to Basid", created: "2026-09-26 11:30:00" },
    { txn_id: "TXN-2026-265218", date: "2026-09-26", cust_id: "CUST-007", inr: 10000, daily: 38.25, my: 26.20, deliv: 0.20, notes: "Aslam transfer", created: "2026-09-26 14:15:00" },
    { txn_id: "TXN-2026-879155", date: "2026-09-26", cust_id: "CUST-006", inr: 1000, daily: 38.25, my: 26.20, deliv: 0.20, notes: "Ahmad split between HAJA and BLACK GRP", created: "2026-09-26 15:45:00" },
  ];

  sampleTxns.forEach((t, i) => {
    const rowNum = i + 2;
    const row = wsTxn.addRow({
      txn_id: t.txn_id,
      date: t.date,
      cust_id: t.cust_id,
      inr_amount: t.inr,
      daily_rate: t.daily,
      my_rate: t.my,
      aed_daily: { formula: `=(D${rowNum}/1000)*E${rowNum}` },
      aed_my_rate: { formula: `=D${rowNum}/F${rowNum}` },
      gross_profit: { formula: `=G${rowNum}-H${rowNum}` },
      deliv_pct: t.deliv,
      deliv_amt: { formula: `=I${rowNum}*J${rowNum}` },
      net_profit: { formula: `=I${rowNum}-K${rowNum}` },
      status: "CONFIRMED",
      notes: t.notes,
      created_at: t.created,
      updated_at: t.created,
    });
    // Format percentages and currencies
    row.getCell(4).numFmt = "#,##0.00";
    row.getCell(5).numFmt = "0.0000";
    row.getCell(6).numFmt = "0.0000";
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(8).numFmt = "#,##0.00";
    row.getCell(9).numFmt = "#,##0.00";
    row.getCell(10).numFmt = "0.00%";
    row.getCell(11).numFmt = "#,##0.00";
    row.getCell(12).numFmt = "#,##0.00";
    styleDataRow(row, i % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 03. CUSTOMER PAYMENTS SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  const wsPay = wb.addWorksheet("03_Customer_Payments", { views: [{ state: "frozen", ySplit: 1 }] });
  wsPay.columns = [
    { header: "Payment ID", key: "pay_id", width: 16 },
    { header: "Date", key: "date", width: 14 },
    { header: "Customer ID", key: "cust_id", width: 16 },
    { header: "Transaction ID", key: "txn_id", width: 20 },
    { header: "Amount", key: "amount", width: 16 },
    { header: "Currency", key: "currency", width: 12 },
    { header: "Payment Type", key: "type", width: 18 },
    { header: "Notes", key: "notes", width: 30 },
    { header: "Created At", key: "created_at", width: 20 },
  ];
  styleHeader(wsPay.getRow(1), "FF15803D"); // Green

  const samplePayments = [
    { pay_id: "PAY-001", date: "2026-09-26", cust_id: "CUST-002", txn_id: "TXN-2026-000001", amount: 76600.00, currency: "AED", type: "BANK_TRANSFER", notes: "Full settlement for DIVAN order", created_at: "2026-09-26 12:00:00" },
    { pay_id: "PAY-002", date: "2026-09-26", cust_id: "CUST-001", txn_id: "TXN-2026-000002", amount: 50000.00, currency: "AED", type: "CASH", notes: "Partial cash payment on order", created_at: "2026-09-26 14:00:00" },
    { pay_id: "PAY-003", date: "2026-09-26", cust_id: "CUST-007", txn_id: "TXN-2026-265218", amount: 382.50, currency: "AED", type: "CASH", notes: "Paid in full", created_at: "2026-09-26 16:00:00" },
    { pay_id: "PAY-004", date: "2026-09-26", cust_id: "CUST-006", txn_id: "TXN-2026-879155", amount: 38.25, currency: "AED", type: "CASH", notes: "Paid in full", created_at: "2026-09-26 17:00:00" },
  ];
  samplePayments.forEach((p, idx) => {
    const row = wsPay.addRow(p);
    row.getCell(5).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 04. DISTRIBUTION SPLITS SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  const wsSplits = wb.addWorksheet("04_Distribution_Splits", { views: [{ state: "frozen", ySplit: 1 }] });
  wsSplits.columns = [
    { header: "Split ID", key: "split_id", width: 16 },
    { header: "Transaction ID", key: "txn_id", width: 20 },
    { header: "Distributor ID", key: "dist_id", width: 18 },
    { header: "INR Amount", key: "inr_amount", width: 18 },
    { header: "Percentage", key: "pct", width: 14 },
    { header: "Notes", key: "notes", width: 35 },
  ];
  styleHeader(wsSplits.getRow(1), "FF1E40AF"); // Navy Blue

  const sampleSplits = [
    { split_id: "SPLIT-001", txn_id: "TXN-2026-000001", dist_id: "DIST-AED-MK", inr: 500000, notes: "MK allocation part 1" },
    { split_id: "SPLIT-002", txn_id: "TXN-2026-000001", dist_id: "DIST-AED-ISMA", inr: 700000, notes: "ISMAIL allocation part 2" },
    { split_id: "SPLIT-003", txn_id: "TXN-2026-000001", dist_id: "DIST-IND-SARA", inr: 800000, notes: "SARABU [IND] allocation part 3" },
    { split_id: "SPLIT-004", txn_id: "TXN-2026-000002", dist_id: "DIST-IND-BASI", inr: 1500000, notes: "Direct to Basid" },
    { split_id: "SPLIT-005", txn_id: "TXN-2026-265218", dist_id: "DIST-AED-MK", inr: 1000, notes: "MK allocation" },
    { split_id: "SPLIT-006", txn_id: "TXN-2026-265218", dist_id: "DIST-IND-HAJA", inr: 9000, notes: "HAJA allocation" },
    { split_id: "SPLIT-007", txn_id: "TXN-2026-879155", dist_id: "DIST-IND-HAJA", inr: 800, notes: "HAJA allocation part 1" },
    { split_id: "SPLIT-008", txn_id: "TXN-2026-879155", dist_id: "DIST-AED-BLCK", inr: 200, notes: "BLACK GRP allocation part 2 (Fully allocated)" },
  ];
  sampleSplits.forEach((s, idx) => {
    const rowNum = idx + 2;
    // Formula looks up parent transaction order amount from 02_Transactions sheet
    const row = wsSplits.addRow({
      split_id: s.split_id,
      txn_id: s.txn_id,
      dist_id: s.dist_id,
      inr_amount: s.inr,
      pct: { formula: `=D${rowNum}/XLOOKUP(B${rowNum},'02_Transactions'!$A:$A,'02_Transactions'!$D:$D,1)` },
      notes: s.notes,
    });
    row.getCell(4).numFmt = "#,##0.00";
    row.getCell(5).numFmt = "0.00%";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 05. DISTRIBUTORS SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  const wsDist = wb.addWorksheet("05_Distributors", { views: [{ state: "frozen", ySplit: 1 }] });
  wsDist.columns = [
    { header: "Distributor ID", key: "id", width: 18 },
    { header: "Distributor Name", key: "name", width: 22 },
    { header: "Group Type", key: "group", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Notes", key: "notes", width: 45 },
  ];
  styleHeader(wsDist.getRow(1), "FF1E3A8A"); // Indigo

  const canonicalDistributors = [
    // IND Group
    { id: "DIST-IND-AWAF", name: "AWAFI", group: "IND", status: "ACTIVE", notes: "India-side distribution party" },
    { id: "DIST-IND-NF2", name: "NF2", group: "IND", status: "ACTIVE", notes: "India-side distribution party" },
    { id: "DIST-IND-HAJA", name: "HAJA", group: "IND", status: "ACTIVE", notes: "India-side distribution party" },
    { id: "DIST-IND-SARA", name: "SARABU", group: "IND", status: "ACTIVE", notes: "India-side distribution party (Distinct from AED SARABU)" },
    { id: "DIST-IND-BASI", name: "BASID", group: "IND", status: "ACTIVE", notes: "India-side distribution party" },
    // AED Group
    { id: "DIST-AED-SALA", name: "SALA", group: "AED", status: "ACTIVE", notes: "AED-side distribution party" },
    { id: "DIST-AED-SARA", name: "SARABU", group: "AED", status: "ACTIVE", notes: "AED-side distribution party (Distinct from IND SARABU)" },
    { id: "DIST-AED-MK", name: "MK", group: "AED", status: "ACTIVE", notes: "AED-side distribution & clearance party" },
    { id: "DIST-AED-ISMA", name: "ISMAIL", group: "AED", status: "ACTIVE", notes: "AED-side distribution party" },
    { id: "DIST-AED-NNG", name: "NNG", group: "AED", status: "ACTIVE", notes: "AED-side distribution party" },
    { id: "DIST-AED-BLCK", name: "BLACK GRP", group: "AED", status: "ACTIVE", notes: "Settlement clearance partner" },
    { id: "DIST-AED-USAI", name: "USAIN", group: "AED", status: "ACTIVE", notes: "Settlement clearance partner" },
  ];
  canonicalDistributors.forEach((d, idx) => {
    const row = wsDist.addRow(d);
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 06. INDIA DISTRIBUTION SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  const wsInd = wb.addWorksheet("06_India_Distribution", { views: [{ state: "frozen", ySplit: 1 }] });
  wsInd.columns = [
    { header: "Distribution ID", key: "id", width: 18 },
    { header: "Date", key: "date", width: 14 },
    { header: "Distributor ID", key: "dist_id", width: 18 },
    { header: "INR Amount", key: "inr_amount", width: 18 },
    { header: "Wholesale Rate", key: "rate", width: 16 },
    { header: "AED Equivalent", key: "aed_eq", width: 18 },
    { header: "Paid Amount", key: "paid", width: 16 },
    { header: "Balance", key: "balance", width: 16 },
    { header: "Commission", key: "comm", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Notes", key: "notes", width: 35 },
    { header: "Created At", key: "created_at", width: 20 },
  ];
  styleHeader(wsInd.getRow(1), "FF0F766E"); // Teal

  const sampleIndDist = [
    { id: "IND-001", date: "2026-09-26", dist_id: "DIST-IND-SARA", inr: 800000, rate: 26.18, paid: 800000, comm: 0, status: "SETTLED", notes: "SARABU [IND] full payout", created: "2026-09-26 10:30:00" },
    { id: "IND-002", date: "2026-09-26", dist_id: "DIST-IND-BASI", inr: 1500000, rate: 26.20, paid: 1000000, comm: 0, status: "PARTIAL", notes: "BASID partial payment (500k due)", created: "2026-09-26 11:45:00" },
    { id: "IND-003", date: "2026-09-26", dist_id: "DIST-IND-HAJA", inr: 9000, rate: 26.20, paid: 9000, comm: 0, status: "SETTLED", notes: "HAJA full settlement", created: "2026-09-26 14:30:00" },
    { id: "IND-004", date: "2026-09-26", dist_id: "DIST-IND-HAJA", inr: 800, rate: 26.20, paid: 800, comm: 0, status: "SETTLED", notes: "HAJA payout on Ahmad txn", created: "2026-09-26 15:50:00" },
  ];
  sampleIndDist.forEach((d, idx) => {
    const rowNum = idx + 2;
    const row = wsInd.addRow({
      id: d.id,
      date: d.date,
      dist_id: d.dist_id,
      inr_amount: d.inr,
      rate: d.rate,
      aed_eq: { formula: `=D${rowNum}/E${rowNum}` },
      paid: d.paid,
      balance: { formula: `=D${rowNum}-G${rowNum}` },
      comm: d.comm,
      status: d.status,
      notes: d.notes,
      created_at: d.created,
    });
    row.getCell(4).numFmt = "#,##0.00";
    row.getCell(5).numFmt = "0.0000";
    row.getCell(6).numFmt = "#,##0.00";
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(8).numFmt = "#,##0.00";
    row.getCell(9).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 07. AED DISTRIBUTION SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  const wsAed = wb.addWorksheet("07_AED_Distribution", { views: [{ state: "frozen", ySplit: 1 }] });
  wsAed.columns = [
    { header: "Distribution ID", key: "id", width: 18 },
    { header: "Date", key: "date", width: 14 },
    { header: "Distributor ID", key: "dist_id", width: 18 },
    { header: "AED Amount", key: "aed_amount", width: 16 },
    { header: "Paid Amount", key: "paid", width: 16 },
    { header: "Balance", key: "balance", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Notes", key: "notes", width: 35 },
    { header: "Created At", key: "created_at", width: 20 },
  ];
  styleHeader(wsAed.getRow(1), "FF0369A1"); // Light Blue

  const sampleAedDist = [
    { id: "AED-001", date: "2026-09-26", dist_id: "DIST-AED-MK", aed: 19098.55, paid: 19098.55, status: "SETTLED", notes: "MK AED payout", created: "2026-09-26 10:15:00" },
    { id: "AED-002", date: "2026-09-26", dist_id: "DIST-AED-ISMA", aed: 26738.00, paid: 26738.00, status: "SETTLED", notes: "ISMAIL AED payout", created: "2026-09-26 10:20:00" },
    { id: "AED-003", date: "2026-09-26", dist_id: "DIST-AED-MK", aed: 38.17, paid: 38.17, status: "SETTLED", notes: "MK small split", created: "2026-09-26 14:20:00" },
    { id: "AED-004", date: "2026-09-26", dist_id: "DIST-AED-BLCK", aed: 7.63, paid: 7.63, status: "SETTLED", notes: "BLACK GRP split", created: "2026-09-26 15:55:00" },
  ];
  sampleAedDist.forEach((d, idx) => {
    const rowNum = idx + 2;
    const row = wsAed.addRow({
      id: d.id,
      date: d.date,
      dist_id: d.dist_id,
      aed_amount: d.aed,
      paid: d.paid,
      balance: { formula: `=D${rowNum}-E${rowNum}` },
      status: d.status,
      notes: d.notes,
      created_at: d.created,
    });
    row.getCell(4).numFmt = "#,##0.00";
    row.getCell(5).numFmt = "#,##0.00";
    row.getCell(6).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 08. BANK DISTRIBUTION ACCOUNTS SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  const wsBankAcc = wb.addWorksheet("08_Bank_Distribution_Accounts", { views: [{ state: "frozen", ySplit: 1 }] });
  wsBankAcc.columns = [
    { header: "Account ID", key: "id", width: 18 },
    { header: "Account Name", key: "name", width: 25 },
    { header: "Status", key: "status", width: 14 },
    { header: "Notes", key: "notes", width: 45 },
  ];
  styleHeader(wsBankAcc.getRow(1), "FF4338CA"); // Purple / Violet

  const canonicalBankAccs = [
    { id: "ACC-MK", name: "MK", status: "ACTIVE", notes: "Single unified MK clearing account (duplicate legacy block merged)" },
    { id: "ACC-BLACKGRP", name: "BLACK GRP", status: "ACTIVE", notes: "Primary bank clearance partner account" },
    { id: "ACC-USAIN", name: "USAIN", status: "ACTIVE", notes: "Bank distribution settlement account" },
  ];
  canonicalBankAccs.forEach((a, idx) => {
    const row = wsBankAcc.addRow(a);
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 09. BANK DISTRIBUTION TRANSACTIONS SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  const wsBankTxn = wb.addWorksheet("09_Bank_Distribution", { views: [{ state: "frozen", ySplit: 1 }] });
  wsBankTxn.columns = [
    { header: "Record ID", key: "id", width: 16 },
    { header: "Date", key: "date", width: 14 },
    { header: "Account ID", key: "account_id", width: 18 },
    { header: "Order Amount", key: "order_amt", width: 18 },
    { header: "Commission", key: "comm", width: 16 },
    { header: "Paid Amount", key: "paid_amt", width: 16 },
    { header: "Balance", key: "balance", width: 18 },
    { header: "Notes", key: "notes", width: 35 },
    { header: "Created At", key: "created_at", width: 20 },
  ];
  styleHeader(wsBankTxn.getRow(1), "FF3730A3"); // Deep Violet

  const sampleBankDist = [
    { id: "BNK-001", date: "2026-09-26", acc_id: "ACC-MK", order: 500000, comm: 250, paid: 500000, notes: "MK wire batch 1", created: "2026-09-26 10:45:00" },
    { id: "BNK-002", date: "2026-09-26", acc_id: "ACC-BLACKGRP", order: 200000, comm: 100, paid: 200100, notes: "BLACK GRP clearance", created: "2026-09-26 11:15:00" },
    { id: "BNK-003", date: "2026-09-26", acc_id: "ACC-USAIN", order: 350000, comm: 150, paid: 350000, notes: "USAIN settlement", created: "2026-09-26 13:00:00" },
  ];
  sampleBankDist.forEach((b, idx) => {
    const rowNum = idx + 2;
    // Running balance formula: Previous balance + Order + Commission - Paid
    const prevCell = rowNum === 2 ? "0" : `G${rowNum - 1}`;
    const row = wsBankTxn.addRow({
      id: b.id,
      date: b.date,
      account_id: b.acc_id,
      order_amt: b.order,
      comm: b.comm,
      paid_amt: b.paid,
      balance: { formula: `=${prevCell}+D${rowNum}+E${rowNum}-F${rowNum}` },
      notes: b.notes,
      created_at: b.created,
    });
    row.getCell(4).numFmt = "#,##0.00";
    row.getCell(5).numFmt = "#,##0.00";
    row.getCell(6).numFmt = "#,##0.00";
    row.getCell(7).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. ACCOUNT LEDGER SHEET (Unified relational ledger)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsLedger = wb.addWorksheet("10_Account_Ledger", { views: [{ state: "frozen", ySplit: 1 }] });
  wsLedger.columns = [
    { header: "Ledger ID", key: "id", width: 16 },
    { header: "Date", key: "date", width: 14 },
    { header: "Account/Party", key: "party", width: 22 },
    { header: "Party Type", key: "type", width: 18 },
    { header: "Order INR", key: "inr", width: 18 },
    { header: "Rate", key: "rate", width: 14 },
    { header: "AED Amount", key: "aed", width: 16 },
    { header: "AED Paid", key: "paid", width: 16 },
    { header: "Balance", key: "balance", width: 16 },
    { header: "Notes", key: "notes", width: 35 },
  ];
  styleHeader(wsLedger.getRow(1), "FF475569"); // Slate

  const sampleLedger = [
    { id: "LEDG-001", date: "2026-09-26", party: "DIVAN", type: "CUSTOMER", inr: 2000000, rate: 38.30, paid: 76600, notes: "Customer full payment" },
    { id: "LEDG-002", date: "2026-09-26", party: "SAMI", type: "CUSTOMER", inr: 1500000, rate: 38.25, paid: 50000, notes: "Customer partial payment" },
    { id: "LEDG-003", date: "2026-09-26", party: "SARABU [IND]", type: "IND_DISTRIBUTOR", inr: 800000, rate: 26.18, paid: 30557.68, notes: "Distributor payout settlement" },
    { id: "LEDG-004", date: "2026-09-26", party: "MK", type: "AED_DISTRIBUTOR", inr: 500000, rate: 26.18, paid: 19098.55, notes: "MK distribution settlement" },
  ];
  sampleLedger.forEach((l, idx) => {
    const rowNum = idx + 2;
    const row = wsLedger.addRow({
      id: l.id,
      date: l.date,
      party: l.party,
      type: l.type,
      inr: l.inr,
      rate: l.rate,
      aed: { formula: `=IF(F${rowNum}>0, E${rowNum}/F${rowNum}, 0)` },
      paid: l.paid,
      balance: { formula: `=G${rowNum}-H${rowNum}` },
      notes: l.notes,
    });
    row.getCell(5).numFmt = "#,##0.00";
    row.getCell(6).numFmt = "0.0000";
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(8).numFmt = "#,##0.00";
    row.getCell(9).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. DAILY SUMMARY SHEET (Formula-Driven)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsDaily = wb.addWorksheet("11_Daily_Summary", { views: [{ state: "frozen", ySplit: 1 }] });
  wsDaily.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Total INR Processed", key: "inr", width: 22 },
    { header: "Total AED at Daily Rate", key: "aed_daily", width: 24 },
    { header: "Total AED at My Rate", key: "aed_my_rate", width: 22 },
    { header: "Total Gross Profit", key: "gross", width: 18 },
    { header: "Total Delivery Charges", key: "deliv", width: 22 },
    { header: "Total Net Profit/Amount", key: "net", width: 22 },
    { header: "Total Customer Payments", key: "payments", width: 24 },
    { header: "Outstanding Receivables", key: "receivables", width: 24 },
    { header: "Total IND Distribution", key: "ind_dist", width: 22 },
    { header: "Total AED Distribution", key: "aed_dist", width: 22 },
    { header: "Total Bank Distribution", key: "bank_dist", width: 22 },
  ];
  styleHeader(wsDaily.getRow(1), "FF0E7490"); // Cyan / Teal

  // Add formula row for 2026-09-26
  const rowNumDaily = 2;
  const rowDaily = wsDaily.addRow({
    date: "2026-09-26",
    inr: { formula: `=SUMIFS('02_Transactions'!$D:$D, '02_Transactions'!$B:$B, A${rowNumDaily})` },
    aed_daily: { formula: `=SUMIFS('02_Transactions'!$G:$G, '02_Transactions'!$B:$B, A${rowNumDaily})` },
    aed_my_rate: { formula: `=SUMIFS('02_Transactions'!$H:$H, '02_Transactions'!$B:$B, A${rowNumDaily})` },
    gross: { formula: `=SUMIFS('02_Transactions'!$I:$I, '02_Transactions'!$B:$B, A${rowNumDaily})` },
    deliv: { formula: `=SUMIFS('02_Transactions'!$K:$K, '02_Transactions'!$B:$B, A${rowNumDaily})` },
    net: { formula: `=SUMIFS('02_Transactions'!$L:$L, '02_Transactions'!$B:$B, A${rowNumDaily})` },
    payments: { formula: `=SUMIFS('03_Customer_Payments'!$E:$E, '03_Customer_Payments'!$B:$B, A${rowNumDaily})` },
    receivables: { formula: `=C${rowNumDaily}-H${rowNumDaily}` },
    ind_dist: { formula: `=SUMIFS('06_India_Distribution'!$D:$D, '06_India_Distribution'!$B:$B, A${rowNumDaily})` },
    aed_dist: { formula: `=SUMIFS('07_AED_Distribution'!$D:$D, '07_AED_Distribution'!$B:$B, A${rowNumDaily})` },
    bank_dist: { formula: `=SUMIFS('09_Bank_Distribution'!$D:$D, '09_Bank_Distribution'!$B:$B, A${rowNumDaily})` },
  });
  for (let c = 2; c <= 12; c++) {
    rowDaily.getCell(c).numFmt = "#,##0.00";
  }
  styleDataRow(rowDaily);

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. REPORTS / EXECUTIVE SUMMARY SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  const wsRep = wb.addWorksheet("12_Reports", { views: [{ showGridLines: true }] });
  
  // Title
  wsRep.mergeCells("A1:G1");
  const titleCell = wsRep.getCell("A1");
  titleCell.value = "EXECUTIVE REMITTANCE DASHBOARD & KPI REPORTS";
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  wsRep.getRow(1).height = 36;

  // Filter Bar
  wsRep.getCell("A3").value = "From Date:";
  wsRep.getCell("A3").font = { bold: true };
  wsRep.getCell("B3").value = "2026-09-01";
  wsRep.getCell("B3").alignment = { horizontal: "center" };

  wsRep.getCell("C3").value = "To Date:";
  wsRep.getCell("C3").font = { bold: true };
  wsRep.getCell("D3").value = "2026-09-30";
  wsRep.getCell("D3").alignment = { horizontal: "center" };

  // KPI Cards
  const kpis = [
    { title: "Total Volume Processed (INR)", formula: `=SUMIFS('02_Transactions'!$D:$D, '02_Transactions'!$B:$B, ">="&$B$3, '02_Transactions'!$B:$B, "<="&$D$3)`, fmt: "₹ #,##0.00" },
    { title: "Total Customer Invoiced (AED)", formula: `=SUMIFS('02_Transactions'!$G:$G, '02_Transactions'!$B:$B, ">="&$B$3, '02_Transactions'!$B:$B, "<="&$D$3)`, fmt: "#,##0.00 AED" },
    { title: "Total Payments Received (AED)", formula: `=SUMIFS('03_Customer_Payments'!$E:$E, '03_Customer_Payments'!$B:$B, ">="&$B$3, '03_Customer_Payments'!$B:$B, "<="&$D$3)`, fmt: "#,##0.00 AED" },
    { title: "Outstanding Receivables (AED)", formula: `=B6-B7`, fmt: "#,##0.00 AED" },
    { title: "Gross Remittance Profit (AED)", formula: `=SUMIFS('02_Transactions'!$I:$I, '02_Transactions'!$B:$B, ">="&$B$3, '02_Transactions'!$B:$B, "<="&$D$3)`, fmt: "#,##0.00 AED" },
    { title: "Net Business Profit (AED)", formula: `=SUMIFS('02_Transactions'!$L:$L, '02_Transactions'!$B:$B, ">="&$B$3, '02_Transactions'!$B:$B, "<="&$D$3)`, fmt: "#,##0.00 AED" },
  ];

  kpis.forEach((kpi, idx) => {
    const r = 5 + idx;
    wsRep.getCell(`A${r}`).value = kpi.title;
    wsRep.getCell(`A${r}`).font = { bold: true, color: { argb: "FF334155" } };
    wsRep.getCell(`B${r}`).value = { formula: kpi.formula };
    wsRep.getCell(`B${r}`).font = { bold: true, size: 12, color: { argb: "FF0F766E" } };
    wsRep.getCell(`B${r}`).numFmt = kpi.fmt;
    wsRep.getCell(`B${r}`).alignment = { horizontal: "right" };
    wsRep.getRow(r).height = 24;
  });

  // Notes Section
  wsRep.getCell("A13").value = "CRITICAL BUSINESS RULES & NOTES:";
  wsRep.getCell("A13").font = { bold: true, color: { argb: "FF991B1B" } };
  wsRep.getCell("A14").value = "1. Delivery Charge %: Currently models Delivery Cut = Gross Profit * Delivery Charge %. [REQUIRES CLIENT CONFIRMATION]";
  wsRep.getCell("A15").value = "2. COMMISON: Treated strictly as a commission deduction field, NOT an entity or person. [REQUIRES CLIENT CONFIRMATION]";
  wsRep.getCell("A16").value = "3. SARABU Distinction: SARABU [IND] and SARABU [AED] are separate accounts with independent balances.";
  wsRep.getCell("A17").value = "4. TOTAL is calculated automatically; never entered as an entity.";

  wsRep.columns = [
    { width: 34 },
    { width: 24 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  // Save workbook
  const outputPath = path.resolve(process.cwd(), "Remittance_Business_Normalized_Master.xlsx");
  await wb.xlsx.writeFile(outputPath);
  console.log(`✓ Workbook successfully created at: ${outputPath}`);
}

generateMasterWorkbook().catch(console.error);
