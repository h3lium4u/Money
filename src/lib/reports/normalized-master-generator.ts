import ExcelJS from "exceljs";
import {
  listCustomers,
  listTransactions,
  listCustomerPayments,
  listDistributionSplits,
  listDistributors,
  listBankDistripAccounts,
  listBankDistripRecords,
} from "@/lib/repository";

export async function generateNormalizedMasterWorkbook(filters?: { from?: string; to?: string }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Petti Remittance Management System";
  wb.created = new Date();

  // Fetch live database records from Neon PostgreSQL
  const [
    customers,
    transactions,
    payments,
    splits,
    distributors,
    bankAccounts,
    bankRecords,
  ] = await Promise.all([
    listCustomers(),
    listTransactions({ from: filters?.from, to: filters?.to, limit: 10000 }),
    listCustomerPayments({ from: filters?.from, to: filters?.to }),
    listDistributionSplits({ from: filters?.from, to: filters?.to }),
    listDistributors(),
    listBankDistripAccounts(),
    listBankDistripRecords(),
  ]);

  // Lookup maps to ensure unique IDs are accurately mapped everywhere
  const custCodeMap = new Map(customers.map((c) => [c.id, c.code || c.id]));
  const distCodeMap = new Map(distributors.map((d) => [d.id, d.code || d.id]));
  const distGroupMap = new Map(distributors.map((d) => [d.id, d.group_type || "IND"]));
  const bankCodeMap = new Map(bankAccounts.map((b) => [b.id, b.account_code || b.id]));

  // Helper styles
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 01. CUSTOMERS
  // ═══════════════════════════════════════════════════════════════════════════
  const wsCust = wb.addWorksheet("01_Customers", { views: [{ state: "frozen", ySplit: 1 }] });
  wsCust.columns = [
    { header: "Customer ID", key: "id", width: 18 },
    { header: "Customer Name", key: "name", width: 25 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Default Rate", key: "rate", width: 15 },
    { header: "Status", key: "status", width: 14 },
    { header: "Notes", key: "notes", width: 35 },
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
      notes: `Customer balance: AED ${(c.outstanding_balance || 0).toLocaleString()}`,
      created_date: c.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    });
    row.getCell(4).numFmt = "0.0000";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 02. TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const wsTxn = wb.addWorksheet("02_Transactions", { views: [{ state: "frozen", ySplit: 1 }] });
  wsTxn.columns = [
    { header: "Transaction ID", key: "txn_id", width: 18 },             // Col A
    { header: "Date", key: "date", width: 14 },                          // Col B
    { header: "Customer ID", key: "cust_id", width: 16 },                // Col C (Unique ID for same name disambiguation)
    { header: "Customer Name", key: "cust_name", width: 24 },            // Col D
    { header: "INR Order Amount", key: "inr_amount", width: 18 },        // Col E
    { header: "Daily Rate", key: "daily_rate", width: 14 },              // Col F
    { header: "My Rate", key: "my_rate", width: 14 },                    // Col G
    { header: "AED at Daily Rate", key: "aed_daily", width: 18 },        // Col H: =(E/1000)*F
    { header: "AED at My Rate", key: "aed_my_rate", width: 18 },         // Col I: =E/G
    { header: "Gross Profit", key: "gross_profit", width: 16 },          // Col J: =H-I
    { header: "Delivery Charge %", key: "deliv_pct", width: 16 },        // Col K
    { header: "Delivery Charge Amount", key: "deliv_amt", width: 22 },   // Col L: =J*K
    { header: "Net Profit/Amount", key: "net_profit", width: 18 },       // Col M: =J-L
    { header: "India Distributors", key: "dist_names", width: 25 },      // Col N
    { header: "Split Breakdown", key: "split_details", width: 34 },      // Col O
    { header: "Split Status", key: "split_status", width: 18 },          // Col P
    { header: "Status", key: "status", width: 14 },                      // Col Q
    { header: "Notes", key: "notes", width: 30 },                        // Col R
  ];
  styleHeader(wsTxn.getRow(1), "FF065F46"); // Dark Emerald

  transactions.forEach((t, i) => {
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
    row.getCell(6).numFmt = "0.0000";   // Daily Rate
    row.getCell(7).numFmt = "0.0000";   // My Rate
    row.getCell(8).numFmt = "#,##0.00"; // AED at Daily Rate
    row.getCell(9).numFmt = "#,##0.00"; // AED at My Rate
    row.getCell(10).numFmt = "#,##0.00"; // Gross Profit
    row.getCell(11).numFmt = "0.00%";   // Delivery Charge %
    row.getCell(12).numFmt = "#,##0.00"; // Delivery Cut Amount
    row.getCell(13).numFmt = "#,##0.00"; // Net Profit

    styleDataRow(row, i % 2 === 1);

    // Green styling for fully allocated transactions
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 03. CUSTOMER PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  const wsPay = wb.addWorksheet("03_Customer_Payments", { views: [{ state: "frozen", ySplit: 1 }] });
  wsPay.columns = [
    { header: "Payment ID", key: "pay_id", width: 16 },             // Col A
    { header: "Date", key: "date", width: 14 },                      // Col B
    { header: "Customer ID", key: "cust_id", width: 16 },            // Col C (Unique Customer ID)
    { header: "Customer Name", key: "cust_name", width: 22 },        // Col D
    { header: "Transaction ID", key: "txn_id", width: 20 },          // Col E
    { header: "Amount (AED)", key: "amount", width: 16 },            // Col F
    { header: "Currency", key: "currency", width: 12 },              // Col G
    { header: "Payment Type", key: "type", width: 18 },              // Col H
    { header: "Notes", key: "notes", width: 30 },                    // Col I
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
      notes: p.notes || "-",
    });
    row.getCell(6).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 04. DISTRIBUTION SPLITS
  // ═══════════════════════════════════════════════════════════════════════════
  const wsSplits = wb.addWorksheet("04_Distribution_Splits", { views: [{ state: "frozen", ySplit: 1 }] });
  wsSplits.columns = [
    { header: "Split ID", key: "split_id", width: 16 },              // Col A
    { header: "Transaction ID", key: "txn_id", width: 20 },          // Col B
    { header: "Customer ID", key: "cust_id", width: 16 },            // Col C (Unique Customer ID)
    { header: "Customer Name", key: "cust_name", width: 20 },        // Col D
    { header: "Distributor ID", key: "dist_id", width: 16 },         // Col E (Unique Distributor ID)
    { header: "Distributor Name", key: "dist_name", width: 24 },     // Col F
    { header: "INR Amount", key: "inr_amount", width: 18 },          // Col G
    { header: "Wholesale Rate", key: "rate", width: 16 },            // Col H
    { header: "AED Equivalent", key: "aed_eq", width: 18 },          // Col I
    { header: "Status", key: "status", width: 14 },                  // Col J
    { header: "Notes", key: "notes", width: 35 },                    // Col K
  ];
  styleHeader(wsSplits.getRow(1), "FF1E40AF"); // Navy Blue

  splits.forEach((s, idx) => {
    const uniqueCustId = custCodeMap.get(s.customer_id || "") || s.customer_code || (s.customer_id ? s.customer_id.slice(0, 8) : "-");
    const uniqueDistId = distCodeMap.get(s.distributor_id) || s.distributor_code || s.distributor_id;
    const distGroup = distGroupMap.get(s.distributor_id) || s.group_type || "IND";

    const row = wsSplits.addRow({
      split_id: s.id.slice(0, 12),
      txn_id: s.transaction_number,
      cust_id: uniqueCustId,
      cust_name: s.customer_name,
      dist_id: uniqueDistId,
      dist_name: `${s.distributor_name || s.distributor_code} [${distGroup}]`,
      inr_amount: s.inr_amount,
      rate: s.wholesale_rate,
      aed_eq: s.aed_equivalent,
      status: s.status,
      notes: s.notes || "-",
    });
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(8).numFmt = "0.0000";
    row.getCell(9).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 05. DISTRIBUTORS
  // ═══════════════════════════════════════════════════════════════════════════
  const wsDist = wb.addWorksheet("05_Distributors", { views: [{ state: "frozen", ySplit: 1 }] });
  wsDist.columns = [
    { header: "Distributor ID", key: "id", width: 18 },              // Col A
    { header: "Distributor Name", key: "name", width: 22 },          // Col B
    { header: "Group Type", key: "group", width: 14 },              // Col C
    { header: "Partner Type", key: "type", width: 20 },             // Col D
    { header: "Status", key: "status", width: 14 },                  // Col E
    { header: "Total INR Allocated", key: "total_inr", width: 20 }, // Col F
    { header: "Outstanding Balance (INR)", key: "bal_inr", width: 24 }, // Col G
    { header: "Notes", key: "notes", width: 45 },                   // Col H
  ];
  styleHeader(wsDist.getRow(1), "FF1E3A8A"); // Indigo

  distributors.forEach((d, idx) => {
    const row = wsDist.addRow({
      id: d.code || d.id,
      name: d.name,
      group: d.group_type || "IND",
      type: d.partner_type || "DISTRIBUTOR",
      status: d.status || "ACTIVE",
      total_inr: d.total_splits_inr || 0,
      bal_inr: d.splits_balance_inr || 0,
      notes: d.name === "SARABU" ? `SARABU [${d.group_type}] - Separate entity from other group` : "-",
    });
    row.getCell(6).numFmt = "#,##0.00";
    row.getCell(7).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 06. INDIA DISTRIBUTION
  // ═══════════════════════════════════════════════════════════════════════════
  const wsInd = wb.addWorksheet("06_India_Distribution", { views: [{ state: "frozen", ySplit: 1 }] });
  wsInd.columns = [
    { header: "Distribution ID", key: "id", width: 18 },             // Col A
    { header: "Date", key: "date", width: 14 },                      // Col B
    { header: "Txn ID", key: "txn_num", width: 18 },                 // Col C
    { header: "Customer ID", key: "cust_id", width: 16 },            // Col D (Unique Customer ID)
    { header: "Customer Name", key: "cust_name", width: 20 },        // Col E
    { header: "IND Party ID", key: "dist_id", width: 16 },           // Col F (Unique Distributor ID)
    { header: "IND Party Name", key: "dist_name", width: 22 },       // Col G
    { header: "INR Amount", key: "inr_amount", width: 18 },          // Col H
    { header: "Wholesale Rate", key: "rate", width: 16 },            // Col I
    { header: "AED Equivalent", key: "aed_eq", width: 18 },          // Col J: =H/I
    { header: "Paid (INR)", key: "paid", width: 16 },                // Col K
    { header: "Balance (INR)", key: "balance", width: 16 },          // Col L: =H-K
    { header: "Status", key: "status", width: 14 },                  // Col M
    { header: "Notes", key: "notes", width: 35 },                    // Col N
  ];
  styleHeader(wsInd.getRow(1), "FF0F766E"); // Teal

  // Filter splits where distributor belongs to IND group
  const indDistributorIds = new Set(distributors.filter((d) => d.group_type === "IND").map((d) => d.id));
  const indSplits = splits.filter((s) => indDistributorIds.has(s.distributor_id));

  indSplits.forEach((d, idx) => {
    const rowNum = idx + 2;
    const uniqueCustId = custCodeMap.get(d.customer_id || "") || d.customer_code || (d.customer_id ? d.customer_id.slice(0, 8) : "-");
    const uniqueDistId = distCodeMap.get(d.distributor_id) || d.distributor_code || d.distributor_id;

    const row = wsInd.addRow({
      id: d.id.slice(0, 12),
      date: d.split_date,
      txn_num: d.transaction_number,
      cust_id: uniqueCustId,
      cust_name: d.customer_name,
      dist_id: uniqueDistId,
      dist_name: `${d.distributor_code || d.distributor_name} [IND]`,
      inr_amount: d.inr_amount,
      rate: d.wholesale_rate,
      aed_eq: { formula: `=H${rowNum}/I${rowNum}` },
      paid: d.paid_amount_inr,
      balance: { formula: `=H${rowNum}-K${rowNum}` },
      status: d.status,
      notes: d.notes || "-",
    });
    row.getCell(8).numFmt = "#,##0.00";
    row.getCell(9).numFmt = "0.0000";
    row.getCell(10).numFmt = "#,##0.00";
    row.getCell(11).numFmt = "#,##0.00";
    row.getCell(12).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 07. AED DISTRIBUTION
  // ═══════════════════════════════════════════════════════════════════════════
  const wsAed = wb.addWorksheet("07_AED_Distribution", { views: [{ state: "frozen", ySplit: 1 }] });
  wsAed.columns = [
    { header: "Distribution ID", key: "id", width: 18 },             // Col A
    { header: "Date", key: "date", width: 14 },                      // Col B
    { header: "Txn ID", key: "txn_num", width: 18 },                 // Col C
    { header: "Customer ID", key: "cust_id", width: 16 },            // Col D (Unique Customer ID)
    { header: "Customer Name", key: "cust_name", width: 20 },        // Col E
    { header: "AED Party ID", key: "dist_id", width: 16 },           // Col F (Unique Distributor ID)
    { header: "AED Party Name", key: "dist_name", width: 22 },       // Col G
    { header: "AED Amount", key: "aed_amount", width: 16 },          // Col H
    { header: "Paid Amount", key: "paid", width: 16 },               // Col I
    { header: "Balance", key: "balance", width: 16 },                // Col J: =H-I
    { header: "Status", key: "status", width: 14 },                  // Col K
    { header: "Notes", key: "notes", width: 35 },                    // Col L
  ];
  styleHeader(wsAed.getRow(1), "FF0369A1"); // Light Blue

  const aedDistributorIds = new Set(distributors.filter((d) => d.group_type === "AED").map((d) => d.id));
  const aedSplits = splits.filter((s) => aedDistributorIds.has(s.distributor_id));

  aedSplits.forEach((d, idx) => {
    const rowNum = idx + 2;
    const uniqueCustId = custCodeMap.get(d.customer_id || "") || d.customer_code || (d.customer_id ? d.customer_id.slice(0, 8) : "-");
    const uniqueDistId = distCodeMap.get(d.distributor_id) || d.distributor_code || d.distributor_id;

    const row = wsAed.addRow({
      id: d.id.slice(0, 12),
      date: d.split_date,
      txn_num: d.transaction_number,
      cust_id: uniqueCustId,
      cust_name: d.customer_name,
      dist_id: uniqueDistId,
      dist_name: `${d.distributor_code || d.distributor_name} [AED]`,
      aed_amount: d.aed_equivalent || 0,
      paid: d.aed_equivalent || 0,
      balance: { formula: `=H${rowNum}-I${rowNum}` },
      status: d.status,
      notes: d.notes || "-",
    });
    row.getCell(8).numFmt = "#,##0.00";
    row.getCell(9).numFmt = "#,##0.00";
    row.getCell(10).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 08. BANK DISTRIBUTION ACCOUNTS
  // ═══════════════════════════════════════════════════════════════════════════
  const wsBankAcc = wb.addWorksheet("08_Bank_Distribution_Accounts", { views: [{ state: "frozen", ySplit: 1 }] });
  wsBankAcc.columns = [
    { header: "Account ID / Code", key: "id", width: 20 },           // Col A
    { header: "Account Name", key: "name", width: 25 },              // Col B
    { header: "Current Balance (INR)", key: "bal", width: 22 },      // Col C
    { header: "Status", key: "status", width: 14 },                  // Col D
    { header: "Notes", key: "notes", width: 45 },                    // Col E
  ];
  styleHeader(wsBankAcc.getRow(1), "FF4338CA"); // Purple / Violet

  bankAccounts.forEach((a, idx) => {
    const row = wsBankAcc.addRow({
      id: a.account_code || a.id,
      name: a.account_name,
      bal: a.current_balance || 0,
      status: a.status || "ACTIVE",
      notes: a.account_name === "MK" ? "Single unified MK clearing account (duplicate legacy merged)" : "-",
    });
    row.getCell(3).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 09. BANK DISTRIBUTION TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const wsBankTxn = wb.addWorksheet("09_Bank_Distribution", { views: [{ state: "frozen", ySplit: 1 }] });
  wsBankTxn.columns = [
    { header: "Record ID", key: "id", width: 16 },                   // Col A
    { header: "Date", key: "date", width: 14 },                      // Col B
    { header: "Account ID / Code", key: "account_code", width: 18 }, // Col C (Unique Account ID)
    { header: "Account Name", key: "account_name", width: 20 },      // Col D
    { header: "Order Amount", key: "order_amt", width: 18 },         // Col E
    { header: "Commission", key: "comm", width: 16 },                // Col F
    { header: "Paid Amount", key: "paid_amt", width: 16 },           // Col G
    { header: "Balance", key: "balance", width: 18 },                // Col H: =prev+E+F-G
    { header: "Notes", key: "notes", width: 35 },                    // Col I
  ];
  styleHeader(wsBankTxn.getRow(1), "FF3730A3"); // Deep Violet

  bankRecords.forEach((b, idx) => {
    const rowNum = idx + 2;
    const prevCell = rowNum === 2 ? "0" : `H${rowNum - 1}`;
    const uniqueAccCode = bankCodeMap.get(b.account_id) || b.account_code || b.account_id;

    const row = wsBankTxn.addRow({
      id: b.id.slice(0, 12),
      date: b.record_date,
      account_code: uniqueAccCode,
      account_name: b.account_name || "-",
      order_amt: b.order_inr,
      comm: b.commission_inr || 0,
      paid_amt: b.paid_inr || 0,
      balance: { formula: `=${prevCell}+E${rowNum}+F${rowNum}-G${rowNum}` },
      notes: b.notes || "-",
    });
    row.getCell(5).numFmt = "#,##0.00";
    row.getCell(6).numFmt = "#,##0.00";
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(8).numFmt = "#,##0.00";
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. ACCOUNT LEDGER
  // ═══════════════════════════════════════════════════════════════════════════
  const wsLedger = wb.addWorksheet("10_Account_Ledger", { views: [{ state: "frozen", ySplit: 1 }] });
  wsLedger.columns = [
    { header: "Ledger ID", key: "id", width: 16 },                   // Col A
    { header: "Date", key: "date", width: 14 },                      // Col B
    { header: "Party ID / Code", key: "party_id", width: 18 },       // Col C (Unique Customer/Party ID)
    { header: "Account/Party Name", key: "party", width: 22 },       // Col D
    { header: "Party Type", key: "type", width: 18 },                // Col E
    { header: "Order INR", key: "inr", width: 18 },                  // Col F
    { header: "Rate", key: "rate", width: 14 },                      // Col G
    { header: "AED Amount", key: "aed", width: 16 },                 // Col H: =IF(G>0, (F/1000)*G, 0)
    { header: "AED Paid", key: "paid", width: 16 },                  // Col I
    { header: "Balance", key: "balance", width: 16 },                // Col J: =H-I
    { header: "Notes", key: "notes", width: 35 },                    // Col K
  ];
  styleHeader(wsLedger.getRow(1), "FF475569"); // Slate

  let ledgerRowIdx = 0;
  transactions.forEach((t) => {
    ledgerRowIdx++;
    const rowNum = ledgerRowIdx + 1;
    const uniqueCustId = custCodeMap.get(t.customer_id) || t.customer_code || (t.customer_id ? t.customer_id.slice(0, 8) : "-");

    const row = wsLedger.addRow({
      id: `TXN-${ledgerRowIdx}`,
      date: t.transaction_date,
      party_id: uniqueCustId,
      party: t.customer_name,
      type: "CUSTOMER",
      inr: t.inr_amount,
      rate: t.customer_rate,
      aed: { formula: `=IF(G${rowNum}>0, (F${rowNum}/1000)*G${rowNum}, 0)` },
      paid: t.paid_aed || 0,
      balance: { formula: `=H${rowNum}-I${rowNum}` },
      notes: `Order ${t.transaction_number}`,
    });
    row.getCell(6).numFmt = "#,##0.00";
    row.getCell(7).numFmt = "0.0000";
    row.getCell(8).numFmt = "#,##0.00";
    row.getCell(9).numFmt = "#,##0.00";
    row.getCell(10).numFmt = "#,##0.00";
    styleDataRow(row, ledgerRowIdx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. DAILY SUMMARY
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
  ];
  styleHeader(wsDaily.getRow(1), "FF0E7490"); // Cyan / Teal

  // Distinct dates from transactions
  const uniqueDates = Array.from(new Set(transactions.map((t) => t.transaction_date))).sort().reverse();
  uniqueDates.forEach((d, idx) => {
    const rowNum = idx + 2;
    const row = wsDaily.addRow({
      date: d,
      inr: { formula: `=SUMIFS('02_Transactions'!$E:$E, '02_Transactions'!$B:$B, A${rowNum})` },
      aed_daily: { formula: `=SUMIFS('02_Transactions'!$H:$H, '02_Transactions'!$B:$B, A${rowNum})` },
      aed_my_rate: { formula: `=SUMIFS('02_Transactions'!$I:$I, '02_Transactions'!$B:$B, A${rowNum})` },
      gross: { formula: `=SUMIFS('02_Transactions'!$J:$J, '02_Transactions'!$B:$B, A${rowNum})` },
      deliv: { formula: `=SUMIFS('02_Transactions'!$L:$L, '02_Transactions'!$B:$B, A${rowNum})` },
      net: { formula: `=SUMIFS('02_Transactions'!$M:$M, '02_Transactions'!$B:$B, A${rowNum})` },
      payments: { formula: `=SUMIFS('03_Customer_Payments'!$F:$F, '03_Customer_Payments'!$B:$B, A${rowNum})` },
      receivables: { formula: `=C${rowNum}-H${rowNum}` },
    });
    for (let c = 2; c <= 9; c++) {
      row.getCell(c).numFmt = "#,##0.00";
    }
    styleDataRow(row, idx % 2 === 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. REPORTS / EXECUTIVE SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const wsRep = wb.addWorksheet("12_Reports", { views: [{ showGridLines: true }] });
  wsRep.mergeCells("A1:G1");
  const titleCell = wsRep.getCell("A1");
  titleCell.value = "EXECUTIVE REMITTANCE DASHBOARD & KPI REPORTS (LIVE NEON POSTGRESQL DATA)";
  titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  wsRep.getRow(1).height = 36;

  // Filter Bar
  wsRep.getCell("A3").value = "From Date:";
  wsRep.getCell("A3").font = { bold: true };
  wsRep.getCell("B3").value = filters?.from || "2026-09-01";
  wsRep.getCell("B3").alignment = { horizontal: "center" };

  wsRep.getCell("C3").value = "To Date:";
  wsRep.getCell("C3").font = { bold: true };
  wsRep.getCell("D3").value = filters?.to || "2026-09-30";
  wsRep.getCell("D3").alignment = { horizontal: "center" };

  const kpis = [
    { title: "Total Volume Processed (INR)", formula: `=SUMIFS('02_Transactions'!$E:$E, '02_Transactions'!$B:$B, ">="&$B$3, '02_Transactions'!$B:$B, "<="&$D$3)`, fmt: "#,##0.00" },
    { title: "Total Customer Invoiced (AED)", formula: `=SUMIFS('02_Transactions'!$H:$H, '02_Transactions'!$B:$B, ">="&$B$3, '02_Transactions'!$B:$B, "<="&$D$3)`, fmt: "#,##0.00" },
    { title: "Total Payments Received (AED)", formula: `=SUMIFS('03_Customer_Payments'!$F:$F, '03_Customer_Payments'!$B:$B, ">="&$B$3, '03_Customer_Payments'!$B:$B, "<="&$D$3)`, fmt: "#,##0.00" },
    { title: "Outstanding Receivables (AED)", formula: `=B6-B7`, fmt: "#,##0.00" },
    { title: "Gross Remittance Profit (AED)", formula: `=SUMIFS('02_Transactions'!$J:$J, '02_Transactions'!$B:$B, ">="&$B$3, '02_Transactions'!$B:$B, "<="&$D$3)`, fmt: "#,##0.00" },
    { title: "Net Business Profit (AED)", formula: `=SUMIFS('02_Transactions'!$M:$M, '02_Transactions'!$B:$B, ">="&$B$3, '02_Transactions'!$B:$B, "<="&$D$3)`, fmt: "#,##0.00" },
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

  // Critical Business Rules
  wsRep.getCell("A13").value = "CRITICAL BUSINESS RULES & NOTES:";
  wsRep.getCell("A13").font = { bold: true, color: { argb: "FF991B1B" } };
  wsRep.getCell("A14").value = "1. Customer Disambiguation: Unique Customer ID / Code is displayed alongside Customer Name across all sheets to prevent confusion when multiple customers share the same name.";
  wsRep.getCell("A15").value = "2. Distributor Identification: Unique Distributor Code / Group is displayed to unambiguously distinguish between parties (e.g. SARABU [IND] vs SARABU [AED]).";
  wsRep.getCell("A16").value = "3. Bank Accounts: Unique Account Codes (e.g. MK, SALA, USAIN) are explicitly linked to all bank records.";
  wsRep.getCell("A17").value = "4. Automated Calculations: All profit, delivery cut, and balance metrics are dynamically computed via formulas.";

  wsRep.columns = [
    { width: 34 },
    { width: 24 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
