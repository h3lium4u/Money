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
  ShieldCheck,
  AlertCircle,
  Building2,
  Wallet,
  ArrowRight,
  Split,
} from "lucide-react";

interface KPIState {
  todayInr: number;
  todayAed: number;
  todayTxnCount: number;
  todayProfit: number;
  totalInrProcessed: number;
  totalAedCharged: number;
  totalAedCollected: number;
  grossProfitAed: number;
  deliveryChargesAed: number;
  netProfitAed: number;
  transactionCount: number;
  outstandingReceivablesAed: number;
  indiaDistributionPendingInr: number;
  bankDistributionPendingInr: number;
}

export default function DashboardPage() {
  const [timeframe, setTimeframe] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIState | null>(null);
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);

  // Current system date context
  const todayStr = "2026-09-26";
  const yesterdayStr = "2026-09-25";

  useEffect(() => {
    fetchDashboardData();
  }, [timeframe, customFrom, customTo]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      let url = "/api/dashboard/summary";
      const params = new URLSearchParams();

      if (timeframe === "today") {
        params.set("from", todayStr);
        params.set("to", todayStr);
      } else if (timeframe === "yesterday") {
        params.set("from", yesterdayStr);
        params.set("to", yesterdayStr);
      } else if (timeframe === "week") {
        params.set("from", "2026-09-20");
        params.set("to", todayStr);
      } else if (timeframe === "month") {
        params.set("from", "2026-09-01");
        params.set("to", todayStr);
      } else if (timeframe === "year") {
        params.set("from", "2026-01-01");
        params.set("to", todayStr);
      } else if (timeframe === "custom" && customFrom && customTo) {
        params.set("from", customFrom);
        params.set("to", customTo);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      setKpis(json.kpis);
      setDailyTrends(json.dailyTrends || []);

      // Fetch transfers matching the date filter
      let txnUrl = `/api/transactions?limit=10`;
      if (timeframe === "today") {
        txnUrl += `&from=${todayStr}&to=${todayStr}`;
      } else if (timeframe === "yesterday") {
        txnUrl += `&from=${yesterdayStr}&to=${yesterdayStr}`;
      } else if (timeframe === "week") {
        txnUrl += `&from=2026-09-20&to=${todayStr}`;
      } else if (timeframe === "month") {
        txnUrl += `&from=2026-09-01&to=${todayStr}`;
      } else if (timeframe === "year") {
        txnUrl += `&from=2026-01-01&to=${todayStr}`;
      } else if (timeframe === "custom" && customFrom && customTo) {
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
      {/* Header and Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Remittance Dashboard</h2>
          <p className="text-xs text-slate-500">
            Real-time Dubai ➔ India remittance volume, margins, profit, and receivables tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/transactions/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Transfer</span>
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Export</span>
          </Link>
        </div>
      </div>

      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-600" /> View Range:
          </span>

          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "year", label: "This Year" },
            { id: "all", label: "All Time" },
            { id: "custom", label: "Custom Date" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTimeframe(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeframe === item.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {timeframe === "custom" && (
          <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg p-1.5 text-slate-700"
            />
            <span className="text-xs text-slate-400">➔</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg p-1.5 text-slate-700"
            />
          </div>
        )}
      </div>

      {/* SECTION 1: PRIMARY KPI CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span>Primary Performance Metrics</span>
            {timeframe === "today" ? (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 normal-case font-semibold">
                Showing Today ({todayStr})
              </span>
            ) : (
              <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 normal-case font-medium">
                Filtered Range
              </span>
            )}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's / Filtered INR */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {timeframe === "today" ? "Today's INR Sent" : "Total INR Sent"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                {formatINR(timeframe === "today" ? kpis?.todayInr : kpis?.totalInrProcessed)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">India orders received from Dubai customers</p>
            </div>
          </div>

          {/* Card 2: Today's / Filtered AED */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {timeframe === "today" ? "Today's AED Charged" : "Total AED Charged"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                {formatAED(timeframe === "today" ? kpis?.todayAed : kpis?.totalAedCharged)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Calculated as: (INR / 1000) × Daily Rate</p>
            </div>
          </div>

          {/* Card 3: Today's / Filtered Transactions */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {timeframe === "today" ? "Today's Transfers" : "Transfer Count"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                {timeframe === "today" ? kpis?.todayTxnCount || 0 : kpis?.transactionCount || 0} Transfers
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Confirmed customer orders</p>
            </div>
          </div>

          {/* Card 4: Today's / Filtered Net Profit */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white to-emerald-50/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                {timeframe === "today" ? "Today's Net Profit" : "Net Profit"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-emerald-600 tracking-tight">
                {formatAED(timeframe === "today" ? kpis?.todayProfit : kpis?.netProfitAed)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Gross Profit minus 20% delivery charge</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: SECONDARY OPERATIONAL METRICS */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Secondary Operational Balances (Receivables & India Distribution)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Customer Outstanding Balance */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-rose-500" />
                Customer Balance Pending
              </span>
              <span className="text-[10px] text-slate-400 uppercase">Receivable</span>
            </div>
            <div className="text-xl font-bold text-rose-600">
              {formatAED(kpis?.outstandingReceivablesAed)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Pending payment from Dubai customers
            </p>
          </div>

          {/* 2. Total AED Collected */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                Total AED Collected
              </span>
              <span className="text-[10px] text-slate-400 uppercase">Received</span>
            </div>
            <div className="text-xl font-bold text-emerald-600">
              {formatAED(kpis?.totalAedCollected)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Payments successfully collected from customers
            </p>
          </div>

          {/* 3. India Distribution Pending */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Split className="w-3.5 h-3.5 text-amber-500" />
                India Distribution Pending
              </span>
              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold">Unallocated</span>
            </div>
            <div className="text-xl font-bold text-amber-600">
              {formatINR(kpis?.indiaDistributionPendingInr)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Customer orders waiting to be allocated to India parties
            </p>
          </div>

          {/* 4. Bank Distribution Pending */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                Bank Accounts Balance
              </span>
              <span className="text-[10px] text-slate-400 uppercase">Bank Ledger</span>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {formatINR(kpis?.bankDistributionPendingInr)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Net running balance across bank accounts (MK, SALA, etc.)
            </p>
          </div>

          {/* 5. Gross Profit */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                Gross Profit
              </span>
              <span className="text-[10px] text-slate-400 uppercase">Profit</span>
            </div>
            <div className="text-xl font-bold text-indigo-600">
              {formatAED(kpis?.grossProfitAed)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Profit before delivery fee deductions
            </p>
          </div>

          {/* 6. Delivery Charges Total */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-purple-500" />
                Delivery Fees (20%)
              </span>
              <span className="text-[10px] text-slate-400 uppercase">Fee Cut</span>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {formatAED(kpis?.deliveryChargesAed)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              20% cut deducted from gross profit
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: VISUAL CHARTS & TRENDS */}
      {dailyTrends.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Daily Volume & Profit Progression
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {dailyTrends.length} Active Days in Period
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
            {dailyTrends.map((d) => (
              <div
                key={d.date}
                className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-800">{d.date}</span>
                  <span className="text-[10px] font-bold bg-white text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                    {d.count} Txn
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">INR Sent</span>
                  <span className="text-xs font-bold text-slate-900">{formatINR(d.inrVolume)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-700 block uppercase tracking-wider font-semibold">Net Profit</span>
                  <span className="text-xs font-bold text-emerald-600">{formatAED(d.netProfit)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: RECENT TRANSACTIONS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Remittance Transfers</h3>
            <p className="text-xs text-slate-500">
              Dubai customer orders and their India distribution status
            </p>
          </div>
          <Link
            href="/transactions"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200 text-[10px]">
              <tr>
                <th className="px-4 py-3">Txn ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">INR Order</th>
                <th className="px-4 py-3">AED Charged</th>
                <th className="px-4 py-3">Net Profit</th>
                <th className="px-4 py-3">India Distribution</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {recentTxns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No transactions found for the selected timeframe.
                  </td>
                </tr>
              ) : (
                recentTxns.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      <span>{t.transaction_number}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.transaction_date}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{t.customer_name}</div>
                      {t.customer_code && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {t.customer_code}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatINR(t.inr_amount)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatAED(t.aed_amount)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{formatAED(t.net_profit_aed)}</td>
                    <td className="px-4 py-3">
                      {t.remaining_inr === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                          <ShieldCheck className="w-3 h-3" />
                          <span>100% Allocated ({formatINR(t.total_distributed_inr)})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                          <AlertCircle className="w-3 h-3" />
                          <span>Pending {formatINR(t.remaining_inr)}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
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
