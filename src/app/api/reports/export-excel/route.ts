import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import {
  listTransactions,
  listCustomers,
  listBankDistripRecords,
  listDistributionSplits,
  getDailySummaryReport,
} from "@/lib/repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Petti Remittance Management System";
    workbook.created = new Date();

    // 1. Transactions Sheet (Dubai Customer Transactions)
    const wsTxn = workbook.addWorksheet("Transactions");
    wsTxn.columns = [
      { header: "Transaction ID", key: "txn_num", width: 20 },
      { header: "Date", key: "date", width: 14 },
      { header: "Customer Name", key: "cust_name", width: 22 },
      { header: "INR Order", key: "inr", width: 16 },
      { header: "Daily Rate", key: "rate", width: 15 },
      { header: "My Rate", key: "base", width: 14 },
      { header: "AED Charged", key: "aed", width: 16 },
      { header: "Gross Profit (AED)", key: "gross", width: 18 },
      { header: "Delivery %", key: "deliv_pct", width: 12 },
      { header: "Delivery Cut (AED)", key: "deliv_amt", width: 18 },
      { header: "Net Profit (AED)", key: "net", width: 18 },
      { header: "Distributed (INR)", key: "dist_inr", width: 18 },
      { header: "Pending INR", key: "rem_inr", width: 16 },
      { header: "Status", key: "status", width: 14 },
    ];
    wsTxn.getRow(1).font = { bold: true };

    const txns = await listTransactions({ from, to, limit: 5000 });
    txns.forEach((t) => {
      wsTxn.addRow({
        txn_num: t.transaction_number,
        date: t.transaction_date,
        cust_name: t.customer_name,
        inr: t.inr_amount,
        rate: t.customer_rate,
        base: t.base_rate,
        aed: t.aed_amount,
        gross: t.gross_profit_aed,
        deliv_pct: t.delivery_charge_pct * 100 + "%",
        deliv_amt: t.delivery_charge_aed,
        net: t.net_profit_aed,
        dist_inr: t.total_distributed_inr,
        rem_inr: t.remaining_inr,
        status: t.status,
      });
    });

    // 2. Customer Receivables & Balances
    const wsCust = workbook.addWorksheet("Customer Receivables");
    wsCust.columns = [
      { header: "Customer Code", key: "code", width: 15 },
      { header: "Customer Name", key: "name", width: 25 },
      { header: "Total INR Processed", key: "total_inr", width: 20 },
      { header: "Total AED Charged", key: "total_aed", width: 20 },
      { header: "Total AED Paid", key: "total_paid", width: 20 },
      { header: "Outstanding Balance (AED)", key: "balance", width: 25 },
    ];
    wsCust.getRow(1).font = { bold: true };

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

    // 3. India Distribution Splits
    const wsSplits = workbook.addWorksheet("India Distribution");
    wsSplits.columns = [
      { header: "Split Date", key: "date", width: 14 },
      { header: "Transaction ID", key: "txn_num", width: 20 },
      { header: "Customer", key: "cust_name", width: 22 },
      { header: "India Party", key: "party", width: 18 },
      { header: "INR Amount", key: "inr", width: 18 },
      { header: "Wholesale Rate", key: "rate", width: 16 },
      { header: "AED Equivalent", key: "aed_eq", width: 18 },
      { header: "Status", key: "status", width: 14 },
      { header: "Notes", key: "notes", width: 25 },
    ];
    wsSplits.getRow(1).font = { bold: true };

    const splits = await listDistributionSplits({ from, to });
    splits.forEach((s) => {
      wsSplits.addRow({
        date: s.split_date,
        txn_num: s.transaction_number,
        cust_name: s.customer_name,
        party: s.distributor_code,
        inr: s.inr_amount,
        rate: s.wholesale_rate,
        aed_eq: s.aed_equivalent,
        status: s.status,
        notes: s.notes,
      });
    });

    // 4. Bank Distribution Ledger
    const wsBank = workbook.addWorksheet("Bank Distribution");
    wsBank.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Account", key: "account", width: 20 },
      { header: "Order (INR)", key: "order", width: 18 },
      { header: "Commission (INR)", key: "com", width: 18 },
      { header: "Paid (INR)", key: "paid", width: 18 },
      { header: "Running Balance (INR)", key: "balance", width: 22 },
    ];
    wsBank.getRow(1).font = { bold: true };

    const bankRecords = await listBankDistripRecords();
    bankRecords.forEach((b) => {
      wsBank.addRow({
        date: b.record_date,
        account: b.account_name,
        order: b.order_inr,
        com: b.commission_inr,
        paid: b.paid_inr,
        balance: b.balance_inr,
      });
    });

    // 5. Daily Performance Summary
    const wsSummary = workbook.addWorksheet("Daily Summary");
    wsSummary.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Transactions", key: "count", width: 14 },
      { header: "Total INR", key: "inr", width: 20 },
      { header: "Total AED", key: "aed", width: 20 },
      { header: "Net Profit (AED)", key: "net_profit", width: 20 },
    ];
    wsSummary.getRow(1).font = { bold: true };

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
