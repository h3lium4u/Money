import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listTransactions, listCustomers, listBankDistripRecords } from "@/lib/repository";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Petti Remittance Management System";
    workbook.created = new Date();

    // 1. Transactions Sheet
    const wsTxn = workbook.addWorksheet("Transactions");
    wsTxn.columns = [
      { header: "Transaction ID", key: "txn_num", width: 20 },
      { header: "Date", key: "date", width: 14 },
      { header: "Customer Name", key: "cust_name", width: 22 },
      { header: "INR Order", key: "inr", width: 16 },
      { header: "Customer Rate", key: "rate", width: 15 },
      { header: "AED Charged", key: "aed", width: 16 },
      { header: "Base Rate", key: "base", width: 14 },
      { header: "Gross Profit (AED)", key: "gross", width: 18 },
      { header: "Delivery %", key: "deliv_pct", width: 12 },
      { header: "Delivery Amt (AED)", key: "deliv_amt", width: 18 },
      { header: "Net Profit (AED)", key: "net", width: 18 },
      { header: "Status", key: "status", width: 14 },
    ];
    wsTxn.getRow(1).font = { bold: true };

    const txns = listTransactions({ from, to, limit: 5000 });
    txns.forEach((t) => {
      wsTxn.addRow({
        txn_num: t.transaction_number,
        date: t.transaction_date,
        cust_name: t.customer_name,
        inr: t.inr_amount,
        rate: t.customer_rate,
        aed: t.aed_amount,
        base: t.base_rate,
        gross: t.gross_profit_aed,
        deliv_pct: t.delivery_charge_pct * 100 + "%",
        deliv_amt: t.delivery_charge_aed,
        net: t.net_profit_aed,
        status: t.status,
      });
    });

    // 2. Customers & Outstanding
    const wsCust = workbook.addWorksheet("Customer Balances");
    wsCust.columns = [
      { header: "Customer Code", key: "code", width: 15 },
      { header: "Customer Name", key: "name", width: 25 },
      { header: "Total INR Processed", key: "total_inr", width: 20 },
      { header: "Total AED Charged", key: "total_aed", width: 20 },
      { header: "Total AED Paid", key: "total_paid", width: 20 },
      { header: "Outstanding Balance (AED)", key: "balance", width: 25 },
    ];
    wsCust.getRow(1).font = { bold: true };

    const customers = listCustomers();
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

    // 3. Bank Distrip
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

    const bankRecords = listBankDistripRecords();
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

    // 4. Daily Performance Summary
    const wsSummary = workbook.addWorksheet("Daily Summary");
    wsSummary.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Transactions", key: "count", width: 14 },
      { header: "Total INR", key: "inr", width: 20 },
      { header: "Total AED", key: "aed", width: 20 },
      { header: "Net Profit (AED)", key: "net_profit", width: 20 },
    ];
    wsSummary.getRow(1).font = { bold: true };

    const db = getDb();
    const dailyRows = db.prepare(`
      SELECT 
        transaction_date as date,
        COUNT(*) as count,
        SUM(inr_amount) as total_inr,
        SUM(aed_amount) as total_aed,
        SUM(net_profit_aed) as net_profit
      FROM transactions
      WHERE status = 'CONFIRMED'
      GROUP BY transaction_date
      ORDER BY transaction_date DESC
    `).all() as any[];

    dailyRows.forEach((d) => {
      wsSummary.addRow({
        date: d.date,
        count: d.count,
        inr: d.total_inr,
        aed: d.total_aed,
        net_profit: d.net_profit,
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
