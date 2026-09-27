"use client";

import { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Printer,
  ArrowDownToLine,
  Clock,
} from "lucide-react";

export default function ReportsPage() {
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any | null>(null);
  const [dailyRows, setDailyRows] = useState<any[]>([]);

  const todayStr = "2026-09-26";
  const yesterdayStr = "2026-09-25";

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
        params.set("from", "2026-09-20");
        params.set("to", todayStr);
      } else if (period === "month") {
        params.set("from", "2026-09-01");
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
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>

          <a
            href={`/api/reports/export-excel${fromDate && toDate ? `?from=${fromDate}&to=${toDate}` : ""}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all"
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
            <Clock className="w-3.5 h-3.5 text-emerald-600" /> Period:
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
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2.5 py-1.5 text-slate-700 font-medium"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2.5 py-1.5 text-slate-700 font-medium"
            />
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
            <p className="text-xl font-bold text-slate-900">{loading ? "..." : formatINR(kpis?.totalInrProcessed)}</p>
            <p className="text-[11px] text-slate-400">{kpis?.transactionCount || 0} Transfers</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total AED</span>
            <p className="text-xl font-bold text-slate-900">{loading ? "..." : formatAED(kpis?.totalAedCharged)}</p>
            <p className="text-[11px] text-emerald-600 font-semibold">Collected: {formatAED(kpis?.totalAedCollected)}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delivery Fee Share (20%)</span>
            <p className="text-xl font-bold text-slate-900">{loading ? "..." : formatAED(kpis?.deliveryChargesAed)}</p>
            <p className="text-[11px] text-slate-400">Share from profit</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Profit</span>
            <p className={`text-xl font-bold ${kpis?.netProfitAed >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {loading ? "..." : formatAED(kpis?.netProfitAed)}
            </p>
            <p className="text-[11px] text-slate-400">Gross: {formatAED(kpis?.grossProfitAed)}</p>
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
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Transfers</th>
                <th className="py-3 px-4 text-right">INR Sent</th>
                <th className="py-3 px-4 text-right">Customer Pays (AED)</th>
                <th className="py-3 px-4 text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dailyRows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900">{r.date}</td>
                  <td className="py-3 px-4 text-center font-mono text-slate-600">{r.count}</td>
                  <td className="py-3 px-4 text-right font-medium text-slate-900">{formatINR(r.inrVolume)}</td>
                  <td className="py-3 px-4 text-right font-medium text-slate-900">{formatAED(r.aedVolume)}</td>
                  <td
                    className={`py-3 px-4 text-right font-bold ${
                      r.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
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
    </div>
  );
}
