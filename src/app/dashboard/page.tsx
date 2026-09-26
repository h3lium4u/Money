"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Banknote,
  Coins,
  PlusCircle,
  FileSpreadsheet,
  Calendar,
  Layers,
  Clock,
} from "lucide-react";

interface KPIState {
  totalInrProcessed: number;
  totalAedCharged: number;
  totalAedCollected: number;
  grossProfitAed: number;
  deliveryChargesAed: number;
  netProfitAed: number;
  transactionCount: number;
  outstandingReceivablesAed: number;
}

export default function DashboardPage() {
  const [filter, setFilter] = useState("today"); // Default to 'today' so user immediately sees today!
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIState | null>(null);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [filter, customFrom, customTo]);

  // Current system date
  const todayStr = "2026-09-26";
  const yesterdayStr = "2026-09-25";

  async function fetchDashboardData() {
    setLoading(true);
    try {
      let url = "/api/dashboard/summary";
      const params = new URLSearchParams();

      if (filter === "today") {
        params.set("from", todayStr);
        params.set("to", todayStr);
      } else if (filter === "yesterday") {
        params.set("from", yesterdayStr);
        params.set("to", yesterdayStr);
      } else if (filter === "week") {
        params.set("from", "2026-09-20");
        params.set("to", todayStr);
      } else if (filter === "month") {
        params.set("from", "2026-09-01");
        params.set("to", todayStr);
      } else if (filter === "custom" && customFrom && customTo) {
        params.set("from", customFrom);
        params.set("to", customTo);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      setKpis(json.kpis);

      // Fetch transfers matching the date filter
      let txnUrl = `/api/transactions?limit=15`;
      if (filter === "today") {
        txnUrl += `&from=${todayStr}&to=${todayStr}`;
      } else if (filter === "yesterday") {
        txnUrl += `&from=${yesterdayStr}&to=${yesterdayStr}`;
      } else if (filter === "week") {
        txnUrl += `&from=2026-09-20&to=${todayStr}`;
      } else if (filter === "month") {
        txnUrl += `&from=2026-09-01&to=${todayStr}`;
      } else if (filter === "custom" && customFrom && customTo) {
        txnUrl += `&from=${customFrom}&to=${customTo}`;
      }

      const resTxns = await fetch(txnUrl);
      const jsonTxns = await resTxns.json();
      setRecentTxns(jsonTxns || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const formatINR = (val?: number) =>
    `₹ ${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatAED = (val?: number) =>
    `${(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Filter Bar with TODAY explicitly prominent */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-600" /> Filter:
          </span>

          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "all", label: "All Time" },
            { id: "custom", label: "Custom Date" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === item.id
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs */}
        {filter === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2.5 py-1.5 text-slate-700 font-medium"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2.5 py-1.5 text-slate-700 font-medium"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <a
            href="/api/reports/export-excel"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel Export</span>
          </a>

          <Link
            href="/transactions/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ New Transfer</span>
          </Link>
        </div>
      </div>

      {/* 4 Main Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total INR Sent */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total INR Sent</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {loading ? "..." : formatINR(kpis?.totalInrProcessed)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Paid out in India</p>
          </div>
        </div>

        {/* Total AED */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total AED</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {loading ? "..." : formatAED(kpis?.totalAedCharged)}
            </h3>
            <p className="text-xs text-emerald-600 font-semibold mt-1">
              Collected: {loading ? "..." : formatAED(kpis?.totalAedCollected)}
            </p>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Profit</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {loading ? "..." : formatAED(kpis?.netProfitAed)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Your clear earnings</p>
          </div>
        </div>

        {/* Total Transfers */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Transfers</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {loading ? "..." : `${kpis?.transactionCount || 0} Transfers`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Customer orders</p>
          </div>
        </div>
      </div>

      {/* Two Simple Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-rose-50 to-orange-50 p-5 rounded-xl border border-rose-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Customer Due (Unpaid Money)</span>
            <h4 className="text-2xl font-bold text-rose-950 mt-1">
              {loading ? "..." : formatAED(kpis?.outstandingReceivablesAed)}
            </h4>
            <p className="text-xs text-rose-700 mt-1">Customers still owe this in Dubai</p>
          </div>
          <Link
            href="/receivables"
            className="px-3.5 py-2 bg-white text-rose-700 text-xs font-bold rounded-lg shadow-sm border border-rose-200 hover:bg-rose-50"
          >
            Collect Payment
          </Link>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-xl border border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Delivery Fee Share</span>
            <h4 className="text-2xl font-bold text-white mt-1">
              {loading ? "..." : formatAED(kpis?.deliveryChargesAed)}
            </h4>
            <p className="text-xs text-slate-300 mt-1">20% fee collected from profit</p>
          </div>
          <Link
            href="/reports"
            className="px-3.5 py-2 bg-slate-800 text-emerald-400 text-xs font-bold rounded-lg shadow-sm border border-slate-700 hover:bg-slate-700"
          >
            View Reports
          </Link>
        </div>
      </div>

      {/* Transfers List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Transfers {filter === "today" ? "(Today)" : filter === "yesterday" ? "(Yesterday)" : ""}
            </h4>
            <p className="text-xs text-slate-500">
              Showing {recentTxns.length} transfers for the selected period
            </p>
          </div>
          <Link href="/transactions" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
            View All ➔
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Transfer #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">INR Amount</th>
                <th className="py-3 px-4 text-right">Rate</th>
                <th className="py-3 px-4 text-right">Customer Pays (AED)</th>
                <th className="py-3 px-4 text-right">Net Profit</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTxns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                    No transfers found for this filter.
                  </td>
                </tr>
              ) : (
                recentTxns.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{t.transaction_number}</td>
                    <td className="py-3 px-4 text-slate-600 font-medium">{t.transaction_date}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{t.customer_name}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">{formatINR(t.inr_amount)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">{t.customer_rate}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">{formatAED(t.aed_amount)}</td>
                    <td className={`py-3 px-4 text-right font-bold ${t.net_profit_aed >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatAED(t.net_profit_aed)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
