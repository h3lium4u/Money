import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { generateNormalizedMasterWorkbook } from "@/lib/reports/normalized-master-generator";
import {
  listTransactions,
  listCustomers,
  listBankDistripRecords,
  listDistributionSplits,
  getDailySummaryReport,
  listIndiaDistributors,
  listAedDistributors,
} from "@/lib/repository";

// Helpers
const bold = { font: { bold: true } };
function headerRow(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F4FD" } };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const type = searchParams.get("type") || searchParams.get("template");

    // By default, or when type=master/normalized, generate the live 12-sheet relational workbook on-demand
    if (type !== "legacy") {
      const buffer = await generateNormalizedMasterWorkbook({ from, to });
      const filename = `Petti_Remittance_Master_${new Date().toISOString().slice(0, 10)}.xlsx`;
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Petti Remittance Management System";
    workbook.created = new Date();

    // ─── 1. Transactions Sheet (Dubai Customer Transactions) ───────────────────
    const wsTxn = workbook.addWorksheet("Transactions");
    wsTxn.columns = [
      { header: "Transaction ID", key: "txn_num", width: 20 },
      { header: "Date", key: "date", width: 14 },
      { header: "Customer ID", key: "cust_id", width: 16 },
      { header: "Customer Name", key: "cust_name", width: 22 },
      { header: "INR Order", key: "inr", width: 16 },
      { header: "Daily Rate", key: "rate", width: 15 },
      { header: "My Rate", key: "base", width: 14 },
      { header: "AED Charged", key: "aed", width: 16 },
      { header: "Gross Profit (AED)", key: "gross", width: 18 },
      { header: "Delivery %", key: "deliv_pct", width: 12 },
      { header: "Delivery Cut (AED)", key: "deliv_amt", width: 18 },
      { header: "Net Profit (AED)", key: "net", width: 18 },
      { header: "India Distributors", key: "dist_names", width: 25 },
      { header: "Split Breakdown", key: "split_details", width: 34 },
      { header: "Distributed (INR)", key: "dist_inr", width: 18 },
      { header: "Pending INR", key: "rem_inr", width: 16 },
      { header: "Split Allocation Status", key: "alloc_status", width: 24 },
      { header: "Txn Status", key: "status", width: 14 },
    ];
    headerRow(wsTxn);

    const txns = await listTransactions({ from, to, limit: 5000 });
    txns.forEach((t) => {
      const isFullyAllocated = (t.remaining_inr === 0);
      const allocStatus = isFullyAllocated
        ? "100% FULLY ALLOCATED"
        : (t.total_distributed_inr || 0) > 0
        ? `PARTIAL (Pending ₹${t.remaining_inr?.toLocaleString()})`
        : "UNALLOCATED";

      const row = wsTxn.addRow({
        txn_num: t.transaction_number,
        date: t.transaction_date,
        cust_id: t.customer_code || t.customer_id?.slice(0, 8) || "-",
        cust_name: t.customer_name,
        inr: t.inr_amount,
        rate: t.customer_rate,
        base: t.base_rate,
        aed: t.aed_amount,
        gross: t.gross_profit_aed,
        deliv_pct: t.delivery_charge_pct * 100 + "%",
        deliv_amt: t.delivery_charge_aed,
        net: t.net_profit_aed,
        dist_names: t.distributor_names || t.distributor_name || "-",
        split_details: t.distributor_split_details || "-",
        dist_inr: t.total_distributed_inr,
        rem_inr: t.remaining_inr,
        alloc_status: allocStatus,
        status: t.status,
      });

      // Highlight in GREEN when fully allocated
      if (isFullyAllocated) {
        // Green highlight for Pending INR and Allocation Status cells
        const pendingCell = row.getCell("rem_inr");
        const statusCell = row.getCell("alloc_status");
        const distNamesCell = row.getCell("dist_names");

        [pendingCell, statusCell, distNamesCell].forEach((c) => {
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD4EDDA" }, // Soft light green
          };
          c.font = {
            color: { argb: "FF155724" }, // Deep green text
            bold: true,
          };
        });
      }
    });

    // ─── 2. Customer Receivables & Balances ────────────────────────────────────
    const wsCust = workbook.addWorksheet("Customer Receivables");
    wsCust.columns = [
      { header: "Customer Code", key: "code", width: 15 },
      { header: "Customer Name", key: "name", width: 25 },
      { header: "Total INR Processed", key: "total_inr", width: 20 },
      { header: "Total AED Charged", key: "total_aed", width: 20 },
      { header: "Total AED Paid", key: "total_paid", width: 20 },
      { header: "Outstanding Balance (AED)", key: "balance", width: 25 },
    ];
    headerRow(wsCust);

    const customers = await listCustomers();
    customers.forEach((c) => {
      wsCust.addRow({
        code: c.code,
        name: c.name,
        total_inr: c.total_inr,
        total_aed: c.total_aed,
        total_paid: c.total_paid,
        balance: c.outstanding_balance,
      });
    });

    // ─── 3. IND Distribution — India-side party splits ─────────────────────────
    const wsInd = workbook.addWorksheet("IND Distribution");
    // Header note
    wsInd.addRow(["GROUP: IND — India-side Distribution Parties (AWAFI, NF2, HAJA, SARABU-IND, BASID)"]);
    wsInd.getRow(1).font = { bold: true, italic: true, color: { argb: "FF006600" } };
    wsInd.addRow(["NOTE: SARABU (IND) is a SEPARATE account from SARABU (AED). Different balances."]);
    wsInd.getRow(2).font = { italic: true, color: { argb: "FF888800" } };
    wsInd.addRow([]); // spacer

    const indHeaderRow = wsInd.addRow(["Split Date", "Transaction ID", "Customer ID", "Customer Name", "IND Party Code", "IND Party [GROUP]", "INR Amount", "Wholesale Rate", "AED Equivalent", "Paid (INR)", "Balance (INR)", "Status", "Notes"]);
    indHeaderRow.font = { bold: true };
    indHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4EDDA" } };

    wsInd.columns = [
      { key: "date", width: 14 },
      { key: "txn_num", width: 20 },
      { key: "cust_id", width: 16 },
      { key: "cust_name", width: 22 },
      { key: "party_code", width: 16 },
      { key: "party", width: 22 },
      { key: "inr", width: 18 },
      { key: "rate", width: 16 },
      { key: "aed_eq", width: 18 },
      { key: "paid_inr", width: 16 },
      { key: "bal_inr", width: 16 },
      { key: "status", width: 14 },
      { key: "notes", width: 25 },
    ];

    const splits = await listDistributionSplits({ from, to });
    // Load IND distributors to check group_type
    const indDists = await listIndiaDistributors();
    const indDistIds = new Set(indDists.map((d) => d.id));

    splits.forEach((s) => {
      const isIndGroup = indDistIds.has(s.distributor_id);
      const row = wsInd.addRow({
        date: s.split_date,
        txn_num: s.transaction_number,
        cust_id: s.customer_code || s.customer_id?.slice(0, 8) || "-",
        cust_name: s.customer_name,
        party_code: s.distributor_code || s.distributor_id,
        party: `${s.distributor_code || s.distributor_name} [${isIndGroup ? "IND" : "AED"}]`,
        inr: s.inr_amount,
        rate: s.wholesale_rate,
        aed_eq: s.aed_equivalent,
        paid_inr: s.paid_amount_inr,
        bal_inr: s.balance_inr,
        status: s.status,
        notes: s.notes,
      });

      if (s.status === "COMPLETED") {
        row.getCell("status").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD4EDDA" },
        };
        row.getCell("status").font = { color: { argb: "FF155724" }, bold: true };
      }
    });

    // IND summary totals
    wsInd.addRow([]);
    const indSummaryRow = wsInd.addRow({
      party: "TOTAL (IND)",
      inr: splits.filter((s) => indDistIds.has(s.distributor_id)).reduce((sum, s) => sum + s.inr_amount, 0),
      paid_inr: splits.filter((s) => indDistIds.has(s.distributor_id)).reduce((sum, s) => sum + s.paid_amount_inr, 0),
      bal_inr: splits.filter((s) => indDistIds.has(s.distributor_id)).reduce((sum, s) => sum + s.balance_inr, 0),
    });
    indSummaryRow.font = { bold: true };

    // ─── 4. AED Distribution — AED-side party list ────────────────────────────
    const wsAed = workbook.addWorksheet("AED Distribution");
    wsAed.addRow(["GROUP: AED — AED-side Distribution Parties (SALA, SARABU-AED, MK, ISMAIL, NNG)"]);
    wsAed.getRow(1).font = { bold: true, italic: true, color: { argb: "FF000066" } };
    wsAed.addRow(["NOTE: SARABU (AED) is a SEPARATE account from SARABU (IND). TOTAL = sum of all AED parties (calculated)."]);
    wsAed.getRow(2).font = { italic: true, color: { argb: "FF666600" } };
    wsAed.addRow([]);

    const aedHeaderRow = wsAed.addRow(["Party Name", "Group", "Code", "Partner Type", "Status"]);
    aedHeaderRow.font = { bold: true };
    aedHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCE5FF" } };

    wsAed.columns = [
      { key: "name", width: 20 },
      { key: "group", width: 10 },
      { key: "code", width: 14 },
      { key: "partner_type", width: 20 },
      { key: "status", width: 14 },
    ];

    const aedDists = await listAedDistributors();
    aedDists
      .filter((d) => d.partner_type !== "BANK_ACCOUNT")
      .forEach((d) => {
        wsAed.addRow({
          name: d.name,
          group: "AED",
          code: d.code,
          partner_type: d.partner_type,
          status: d.status,
        });
      });

    wsAed.addRow([]);
    const aedTotal = wsAed.addRow({ name: "TOTAL", group: "AED", code: "(Calculated — not a manual entry)" });
    aedTotal.font = { bold: true };

    // ─── 5. Bank Distribution Ledger ──────────────────────────────────────────
    const wsBank = workbook.addWorksheet("Bank Distribution");
    wsBank.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Account Code", key: "account_code", width: 16 },
      { header: "Account Name", key: "account", width: 20 },
      { header: "Order (INR)", key: "order", width: 18 },
      { header: "Commission (INR)", key: "com", width: 18 },
      { header: "Paid (INR)", key: "paid", width: 18 },
      { header: "Running Balance (INR)", key: "balance", width: 22 },
    ];
    headerRow(wsBank);

    const bankRecords = await listBankDistripRecords();
    bankRecords.forEach((b) => {
      wsBank.addRow({
        date: b.record_date,
        account_code: b.account_code || b.account_id,
        account: b.account_name,
        order: b.order_inr,
        com: b.commission_inr,
        paid: b.paid_inr,
        balance: b.balance_inr,
      });
    });

    // ─── 6. Daily Performance Summary ─────────────────────────────────────────
    const wsSummary = workbook.addWorksheet("Daily Summary");
    wsSummary.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Transactions", key: "count", width: 14 },
      { header: "Total INR", key: "inr", width: 20 },
      { header: "Total AED", key: "aed", width: 20 },
      { header: "Net Profit (AED)", key: "net_profit", width: 20 },
    ];
    headerRow(wsSummary);

    const dailyRows = await getDailySummaryReport();
    dailyRows.forEach((d) => {
      wsSummary.addRow({
        date: typeof d.date === "string" ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10),
        count: Number(d.count),
        inr: Number(d.total_inr),
        aed: Number(d.total_aed),
        net_profit: Number(d.net_profit),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Remittance_Report_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate Excel export" }, { status: 500 });
  }
}
