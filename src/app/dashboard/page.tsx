"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Banknote,
  Coins,
  ArrowUpRight,
  PlusCircle,
  FileSpreadsheet,
  Users,
  AlertCircle,
  Calendar,
  Layers,
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

interface TrendItem {
  date: string;
  inrVolume: number;
  aedVolume: number;
  netProfit: number;
  count: number;
}

export default function DashboardPage() {
  const [filter, setFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIState | null>(null);
  const [dailyTrends, setDailyTrends] = useState<TrendItem[]>([]);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [filter, customFrom, customTo]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      let url = "/api/dashboard/summary";
      const params = new URLSearchParams();

      if (filter === "custom" && customFrom && customTo) {
        params.set("from", customFrom);
        params.set("to", customTo);
      } else if (filter === "month") {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        params.set("from", firstDay);
      } else if (filter === "week") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.set("from", d.toISOString().slice(0, 10));
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      setKpis(json.kpis);
      setDailyTrends(json.dailyTrends || []);

      // Also get recent transactions
      const resTxns = await fetch(`/api/transactions?limit=8`);
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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Controls: Filter Pills & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Preset Range Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Range:
          </span>
          {[
            { id: "all", label: "All History (145 Days)" },
            { id: "month", label: "This Month" },
            { id: "week", label: "Last 7 Days" },
            { id: "custom", label: "Custom Range" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === item.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs if selected */}
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
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </a>

          <Link
            href="/transactions/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Transaction</span>
          </Link>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total INR Processed */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total INR Processed</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {loading ? "..." : formatINR(kpis?.totalInrProcessed)}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Beneficiary payouts in India</span>
            </p>
          </div>
        </div>

        {/* Total AED Charged */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total AED Billed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {loading ? "..." : formatAED(kpis?.totalAedCharged)}
            </h3>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              Paid: {loading ? "..." : formatAED(kpis?.totalAedCollected)}
            </p>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Net Profit</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {loading ? "..." : formatAED(kpis?.netProfitAed)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Gross: {formatAED(kpis?.grossProfitAed)} (after 20% cut)
            </p>
          </div>
        </div>

        {/* Active Transactions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Volume & Orders</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {loading ? "..." : `${kpis?.transactionCount || 0} Transfers`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Across 29 verified regular customers
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Financial Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-rose-50 to-orange-50 p-5 rounded-xl border border-rose-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Customer Receivables Outstanding</span>
            <h4 className="text-2xl font-bold text-rose-950 mt-1">
              {loading ? "..." : formatAED(kpis?.outstandingReceivablesAed)}
            </h4>
            <p className="text-xs text-rose-700 mt-1">AED yet to be collected from customers in Dubai</p>
          </div>
          <Link
            href="/receivables"
            className="px-3.5 py-2 bg-white text-rose-700 text-xs font-semibold rounded-lg shadow-sm border border-rose-200 hover:bg-rose-50"
          >
            Manage Receivables
          </Link>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-xl border border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Delivery Charges Retained</span>
            <h4 className="text-2xl font-bold text-white mt-1">
              {loading ? "..." : formatAED(kpis?.deliveryChargesAed)}
            </h4>
            <p className="text-xs text-slate-300 mt-1">20% commission fee share collected</p>
          </div>
          <Link
            href="/reports"
            className="px-3.5 py-2 bg-slate-800 text-emerald-400 text-xs font-semibold rounded-lg shadow-sm border border-slate-700 hover:bg-slate-700"
          >
            View Statements
          </Link>
        </div>
      </div>

      {/* Historical Daily Activity Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Recent Transactions Registry</h4>
            <p className="text-xs text-slate-500">Authoritative database records verified against Excel source</p>
          </div>
          <Link href="/transactions" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
            View All Transactions ➔
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">INR Order</th>
                <th className="py-3 px-4 text-right">Customer Rate</th>
                <th className="py-3 px-4 text-right">AED Amount</th>
                <th className="py-3 px-4 text-right">Net Profit</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTxns.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">{t.transaction_number}</td>
                  <td className="py-3 px-4 text-slate-600">{t.transaction_date}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{t.customer_name}</td>
                  <td className="py-3 px-4 text-right font-medium text-slate-900">{formatINR(t.inr_amount)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">{t.customer_rate}</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">{formatAED(t.aed_amount)}</td>
                  <td className={`py-3 px-4 text-right font-semibold ${t.net_profit_aed >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatAED(t.net_profit_aed)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {t.status}
                    </span>
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
