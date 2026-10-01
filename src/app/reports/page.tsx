"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileSpreadsheet,
  Printer,
  ArrowDownToLine,
  Clock,
  Calendar,
} from "lucide-react";
import { ReceiptPrinterModal } from "@/components/animation/ReceiptPrinterModal";
import {
  getTodayDateString,
  getYesterdayDateString,
  getDaysAgoDateString,
  getStartOfMonthDateString,
} from "@/lib/date-utils";

export default function ReportsPage() {
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState(getTodayDateString());
  const [toDate, setToDate] = useState(getTodayDateString());
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any | null>(null);
  const [dailyRows, setDailyRows] = useState<any[]>([]);
  const [showPrinterModal, setShowPrinterModal] = useState(false);

  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);

  const openDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (!ref.current) return;
    try {
      if (typeof ref.current.showPicker === "function") {
        ref.current.showPicker();
      } else {
        ref.current.focus();
      }
    } catch {
      ref.current.focus();
    }
  };

  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  useEffect(() => {
    fetchReport();
  }, [period, fromDate, toDate]);

  async function fetchReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period === "today") {
        params.set("from", todayStr);
        params.set("to", todayStr);
      } else if (period === "yesterday") {
        params.set("from", yesterdayStr);
        params.set("to", yesterdayStr);
      } else if (period === "week") {
        params.set("from", getDaysAgoDateString(7));
        params.set("to", todayStr);
      } else if (period === "month") {
        params.set("from", getStartOfMonthDateString());
        params.set("to", todayStr);
      } else if (period === "custom" && fromDate && toDate) {
        params.set("from", fromDate);
        params.set("to", toDate);
      }

      const res = await fetch(`/api/dashboard/summary?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.kpis) {
        setKpis(json.kpis);
        setDailyRows(Array.isArray(json.dailyTrends) ? json.dailyTrends : []);
      } else {
        setDailyRows([]);
      }
    } catch (err) {
      console.error(err);
      setDailyRows([]);
    } finally {
      setLoading(false);
    }
  }

  const formatINR = (val?: number) =>
    `₹ ${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const formatAED = (val?: number) =>
    `${(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} AED`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:space-y-4">
      {/* Print-Only Professional Header */}
      <div className="hidden print-only border-b border-slate-300 pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">PETTI REMITTANCE (DUBAI ⇄ INDIA)</h1>
            <p className="text-xs text-slate-600">Financial Operations & Period Report</p>
          </div>
          <div className="text-right text-xs text-slate-700">
            <p className="font-bold">Period: {period.toUpperCase()}</p>
            <p>Printed on: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Top Header - Hidden on Print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Reports & Excel Export</h2>
          <p className="text-xs text-slate-500">
            Download clean Excel reports or print business summaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPrinterModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer transition-all"
            title="Preview and print thermal report receipt"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>

          <a
            href={`/api/reports/export-excel${fromDate && toDate ? `?from=${fromDate}&to=${toDate}` : ""}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-teal-700 text-white hover:bg-teal-800 shadow-sm transition-all"
            title="Download complete Master Excel Workbook containing all sheets, customer IDs, and financial breakdowns"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Master Excel (.xlsx)</span>
          </a>
        </div>
      </div>

      {/* Date Period Controls with Today & Yesterday - Hidden on Print */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-teal-700" /> Period:
          </span>
          {[
            { id: "all", label: "All Time" },
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "custom", label: "Custom Dates" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === item.id
                  ? "bg-teal-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-2 shrink-0 flex-nowrap">
            <div
              onClick={() => openDatePicker(fromDateRef)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-500 dark:hover:border-teal-400 focus-within:border-teal-600 dark:focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all shadow-2xs cursor-pointer group"
              title="Click anywhere to choose Start Date"
            >
              <Calendar
                className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 cursor-pointer group-hover:scale-110 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  openDatePicker(fromDateRef);
                }}
              />
              <input
                ref={fromDateRef}
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-[13px] bg-transparent text-slate-800 dark:text-slate-100 outline-none uppercase font-medium cursor-pointer w-[125px]"
                title="Choose Start Date (DD-MM-YYYY)"
              />
            </div>
            <span className="text-[13px] text-slate-400 font-medium px-0.5">➔</span>
            <div
              onClick={() => openDatePicker(toDateRef)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-500 dark:hover:border-teal-400 focus-within:border-teal-600 dark:focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all shadow-2xs cursor-pointer group"
              title="Click anywhere to choose End Date"
            >
              <Calendar
                className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 cursor-pointer group-hover:scale-110 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  openDatePicker(toDateRef);
                }}
              />
              <input
                ref={toDateRef}
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-[13px] bg-transparent text-slate-800 dark:text-slate-100 outline-none uppercase font-medium cursor-pointer w-[125px]"
                title="Choose End Date (DD-MM-YYYY)"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Box */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">Period Summary</h3>
          <p className="text-xs text-slate-500">Totals for the selected dates</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total INR Sent</span>
            {loading ? (
              <div className="h-7 w-32 bg-slate-200 animate-pulse rounded my-1" />
            ) : (
              <p className="text-xl font-bold text-slate-900">{formatINR(kpis?.totalInrProcessed)}</p>
            )}
            {loading ? (
              <div className="h-3.5 w-16 bg-slate-200 animate-pulse rounded" />
            ) : (
              <p className="text-[11px] text-slate-400">{kpis?.transactionCount || 0} Transfers</p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total AED</span>
            {loading ? (
              <div className="h-7 w-28 bg-slate-200 animate-pulse rounded my-1" />
            ) : (
              <p className="text-xl font-bold text-slate-900">{formatAED(kpis?.totalAedCharged)}</p>
            )}
            {loading ? (
              <div className="h-3.5 w-24 bg-slate-200 animate-pulse rounded" />
            ) : (
              <p className="text-[11px] text-teal-700 font-semibold">Collected: {formatAED(kpis?.totalAedCollected)}</p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delivery Fee Share (20%)</span>
            {loading ? (
              <div className="h-7 w-24 bg-slate-200 animate-pulse rounded my-1" />
            ) : (
              <p className="text-xl font-bold text-slate-900">{formatAED(kpis?.deliveryChargesAed)}</p>
            )}
            <p className="text-[11px] text-slate-400">Share from profit</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Profit</span>
            {loading ? (
              <div className="h-7 w-28 bg-slate-200 animate-pulse rounded my-1" />
            ) : (
              <p className={`text-xl font-bold ${kpis?.netProfitAed >= 0 ? "text-teal-700" : "text-rose-600"}`}>
                {formatAED(kpis?.netProfitAed)}
              </p>
            )}
            {loading ? (
              <div className="h-3.5 w-20 bg-slate-200 animate-pulse rounded" />
            ) : (
              <p className="text-[11px] text-slate-400">Gross: {formatAED(kpis?.grossProfitAed)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Daily Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-sm">Daily Summary</h4>
          <span className="text-xs text-slate-500">{dailyRows.length} Days with activity</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-center">Transfers</th>
                <th className="py-2.5 px-3 text-right">INR Sent</th>
                <th className="py-2.5 px-3 text-right">Customer Pays (AED)</th>
                <th className="py-2.5 px-3 text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {dailyRows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">{r.date}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-600">{r.count}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-slate-900 whitespace-nowrap">{formatINR(r.inrVolume)}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-slate-900 whitespace-nowrap">{formatAED(r.aedVolume)}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                      r.netProfit >= 0 ? "text-teal-700" : "text-rose-600"
                    }`}
                  >
                    {formatAED(r.netProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Animated Receipt Printer Modal */}
      <ReceiptPrinterModal
        isOpen={showPrinterModal}
        reportType="financial-report"
        reportData={{
          title: "BUSINESS FINANCIAL REPORT",
          period:
            period === "today"
              ? "TODAY"
              : period === "yesterday"
              ? "YESTERDAY"
              : period === "week"
              ? "THIS WEEK"
              : period === "month"
              ? "THIS MONTH"
              : period === "custom" && fromDate && toDate
              ? `${fromDate} to ${toDate}`
              : "ALL TIME",
          totalInr: kpis?.totalInrProcessed || kpis?.todayInr || 0,
          totalAed: kpis?.totalAedCharged || kpis?.todayAed || 0,
          netProfit: kpis?.netProfitAed || kpis?.todayProfit || 0,
          txnCount: kpis?.transactionCount || kpis?.todayTxnCount || 0,
        }}
        onCompletePrint={() => {
          window.print();
        }}
        onClose={() => setShowPrinterModal(false)}
      />
    </div>
  );
}
