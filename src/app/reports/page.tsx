"use client";

import { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  TrendingUp,
  Banknote,
  Coins,
  ArrowDownToLine,
  Filter,
} from "lucide-react";

export default function ReportsPage() {
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any | null>(null);
  const [dailyRows, setDailyRows] = useState<any[]>([]);

  useEffect(() => {
    fetchReport();
  }, [period, fromDate, toDate]);

  async function fetchReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period === "month") {
        const now = new Date();
        params.set("from", new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
      } else if (period === "week") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.set("from", d.toISOString().slice(0, 10));
      } else if (period === "custom" && fromDate && toDate) {
        params.set("from", fromDate);
        params.set("to", toDate);
      }

      const res = await fetch(`/api/dashboard/summary?${params.toString()}`);
      const json = await res.json();
      setKpis(json.kpis);
      setDailyRows(json.dailyTrends || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const formatINR = (val?: number) =>
    `₹ ${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const formatAED = (val?: number) =>
    `${(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} AED`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Business Financial Reports & Exports</h2>
          <p className="text-xs text-slate-500">
            Generate clean normalized Excel spreadsheets and printable executive summaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report (PDF)</span>
          </button>

          <a
            href={`/api/reports/export-excel${fromDate ? `?from=${fromDate}&to=${toDate}` : ""}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Download Excel (.xlsx)</span>
          </a>
        </div>
      </div>

      {/* Date Period Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Period:
          </span>
          {[
            { id: "all", label: "Full Period (All 145 Days)" },
            { id: "month", label: "This Month" },
            { id: "week", label: "Last 7 Days" },
            { id: "custom", label: "Custom Range" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === item.id
                  ? "bg-slate-900 text-white shadow-sm"
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

      {/* Financial Statement Summary Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900">Consolidated Statement of Operations</h3>
          <p className="text-xs text-slate-500">Summary across selected date range</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Volume (INR)</span>
            <p className="text-xl font-bold text-slate-900">{loading ? "..." : formatINR(kpis?.totalInrProcessed)}</p>
            <p className="text-[11px] text-slate-400">{kpis?.transactionCount || 0} Transactions</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross AED Billed</span>
            <p className="text-xl font-bold text-slate-900">{loading ? "..." : formatAED(kpis?.totalAedCharged)}</p>
            <p className="text-[11px] text-emerald-600 font-medium">Collected: {formatAED(kpis?.totalAedCollected)}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delivery Charges (20%)</span>
            <p className="text-xl font-bold text-slate-900">{loading ? "..." : formatAED(kpis?.deliveryChargesAed)}</p>
            <p className="text-[11px] text-slate-400">Collected from gross margin</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Retained Profit</span>
            <p className={`text-xl font-bold ${kpis?.netProfitAed >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {loading ? "..." : formatAED(kpis?.netProfitAed)}
            </p>
            <p className="text-[11px] text-slate-400">Gross: {formatAED(kpis?.grossProfitAed)}</p>
          </div>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-sm">Day-by-Day Historical Performance Breakdown</h4>
          <span className="text-xs text-slate-500">{dailyRows.length} Active Days</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Orders</th>
                <th className="py-3 px-4 text-right">INR Processed</th>
                <th className="py-3 px-4 text-right">AED Billed</th>
                <th className="py-3 px-4 text-right">Net Profit (AED)</th>
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
