"use client";

import { useEffect, useState, useRef } from "react";
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
import {
  getTodayDateString,
  getYesterdayDateString,
  getDaysAgoDateString,
  getStartOfMonthDateString,
  getStartOfYearDateString,
} from "@/lib/date-utils";

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
  const [customFrom, setCustomFrom] = useState(getTodayDateString());
  const [customTo, setCustomTo] = useState(getTodayDateString());
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPIState | null>(null);
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);

  // Date input refs for opening calendar on click
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

  // Current system date context
  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  useEffect(() => {
    fetchDashboardData();
  }, [timeframe, customFrom, customTo]);

  async function fetchDashboardData() {
    setLoading(true);
    setDbError(null);
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
        params.set("from", getDaysAgoDateString(7));
        params.set("to", todayStr);
      } else if (timeframe === "month") {
        params.set("from", getStartOfMonthDateString());
        params.set("to", todayStr);
      } else if (timeframe === "year") {
        params.set("from", getStartOfYearDateString());
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
      if (res.ok && json.kpis) {
        setKpis(json.kpis);
        setDailyTrends(Array.isArray(json.dailyTrends) ? json.dailyTrends : []);
      } else if (!res.ok) {
        setDbError(json.error || "Failed to load dashboard data");
      }

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
      if (resTxns.ok && Array.isArray(jsonTxns)) {
        setRecentTxns(jsonTxns);
      } else {
        setRecentTxns([]);
        if (!resTxns.ok && !json.error) {
          setDbError(jsonTxns.error || "Failed to load recent transactions");
        }
      }
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || "Network error while connecting to server");
      setRecentTxns([]);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', letterSpacing: "-0.02em" }}>
            Remittance Dashboard
          </h2>
          <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-1">
            Real-time Dubai → India remittance volume, margins, profit, and receivables tracking.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Fresh Teal "New Transfer" button */}
          <Link
            href="/transactions/new"
            className="inline-flex items-center justify-center gap-1.5 flex-1 sm:flex-initial px-4 py-2 text-[13.5px] font-medium transition-colors cursor-pointer"
            style={{ background: "#0F766E", color: "#ffffff", borderRadius: 100, fontFamily: "var(--font-body)", border: "none", letterSpacing: "-0.01em", boxShadow: "0 1px 3px rgba(15,118,110,0.15)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#0D9488"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#0F766E"; }}
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Transfer</span>
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center justify-center gap-1.5 flex-1 sm:flex-initial px-4 py-2 text-[13.5px] font-medium transition-colors bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60"
            style={{ borderRadius: 100, fontFamily: "var(--font-body)", letterSpacing: "-0.01em" }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel Export</span>
          </Link>
        </div>
      </div>

      {/* Database Error Banner */}
      {dbError && (
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="text-[13px] text-amber-900 dark:text-amber-200">
              <span className="font-semibold block">Database Connection Notice</span>
              <p className="text-amber-800 dark:text-amber-300 mt-1">{dbError}</p>
            </div>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium shrink-0 cursor-pointer self-start sm:self-auto"
            style={{ background: "#0F766E", color: "#ffffff", borderRadius: 100, border: "none", fontFamily: "var(--font-body)" }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all">
        <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-medium mr-1.5 flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" /> View Range:
            </span>
            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "week", label: "This Week" },
              { id: "month", label: "This Month" },
              { id: "year", label: "This Year" },
              { id: "all", label: "All Time" },
              { id: "custom", label: "Custom Date" },
            ].map((item) => {
              const isSelected = timeframe === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTimeframe(item.id)}
                  className={`px-3.5 py-1.5 text-[13px] font-medium rounded-full transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#0F766E] text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {timeframe === "custom" && (
            <div className="flex items-center gap-2 pt-2.5 2xl:pt-0 border-t 2xl:border-t-0 border-slate-100 dark:border-slate-800 shrink-0 flex-nowrap">
              <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
                Range:
              </span>
              {/* Start Date Pill */}
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
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-[13px] bg-transparent text-slate-800 dark:text-slate-100 outline-none uppercase font-medium cursor-pointer w-[125px]"
                  title="Choose Start Date (DD-MM-YYYY)"
                />
              </div>
              <span className="text-[13px] text-slate-400 font-medium px-0.5">➔</span>
              {/* End Date Pill */}
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
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-[13px] bg-transparent text-slate-800 dark:text-slate-100 outline-none uppercase font-medium cursor-pointer w-[125px]"
                  title="Choose End Date (DD-MM-YYYY)"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: PRIMARY KPI CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-medium uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span>Primary Performance Metrics</span>
            <span className="px-2.5 py-0.5 text-[11px] font-medium normal-case border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
              {timeframe === "today" ? `Today · ${todayStr}` : "Filtered Range"}
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1 — INR Sent */}
          <div className="p-5 flex flex-col justify-between rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-400">
                {timeframe === "today" ? "INR Sent Today" : "Total INR Sent"}
              </span>
              <Coins className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="mt-5">
              <div className="text-[26px] font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', letterSpacing: "-0.02em" }}>
                {formatINR(timeframe === "today" ? kpis?.todayInr : kpis?.totalInrProcessed)}
              </div>
              <p className="text-[12px] mt-1 text-slate-400 dark:text-slate-400">India orders received from Dubai customers</p>
            </div>
          </div>

          {/* Card 2 — AED Charged */}
          <div className="p-5 flex flex-col justify-between rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-400">
                {timeframe === "today" ? "AED Charged Today" : "Total AED Charged"}
              </span>
              <Banknote className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="mt-5">
              <div className="text-[26px] font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', letterSpacing: "-0.02em" }}>
                {formatAED(timeframe === "today" ? kpis?.todayAed : kpis?.totalAedCharged)}
              </div>
              <p className="text-[12px] mt-1 text-slate-400 dark:text-slate-400">Calculated as: (INR / 1000) × Daily Rate</p>
            </div>
          </div>

          {/* Card 3 — Transfers */}
          <div className="p-5 flex flex-col justify-between rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-400">
                {timeframe === "today" ? "Transfers Today" : "Transfer Count"}
              </span>
              <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="mt-5">
              <div className="text-[26px] font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', letterSpacing: "-0.02em" }}>
                {(timeframe === "today" ? kpis?.todayTxnCount : kpis?.transactionCount) || 0} Transfers
              </div>
              <p className="text-[12px] mt-1 text-slate-400 dark:text-slate-400">Confirmed customer orders</p>
            </div>
          </div>

          {/* Card 4 — Net Profit (Fresh Teal Accent Card) */}
          <div className="p-5 flex flex-col justify-between rounded-lg bg-[#0F766E] border border-[#0F766E] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-widest text-[#CCFBF1]">
                {timeframe === "today" ? "Net Profit Today" : "Net Profit"}
              </span>
              <TrendingUp className="w-4 h-4 text-[#5EEAD4]" />
            </div>
            <div className="mt-5">
              <div className="text-[26px] font-bold text-white" style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', letterSpacing: "-0.02em" }}>
                {formatAED(timeframe === "today" ? kpis?.todayProfit : kpis?.netProfitAed)}
              </div>
              <p className="text-[12px] mt-1 text-[#CCFBF1]">Gross Profit minus 20% delivery charge</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: SECONDARY OPERATIONAL METRICS */}
      <div>
        <h3 className="text-[13.5px] font-semibold uppercase tracking-wider mb-3 text-slate-700 dark:text-slate-300">
          Secondary Operational Balances (Receivables & India Distribution)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* 1. Customer Outstanding Balance */}
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[13.5px] text-slate-600 dark:text-slate-300 font-medium mb-2">
              <span className="flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-rose-500" />
                Customer Balance Pending
              </span>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Receivable</span>
            </div>
            <div className="text-[22px] font-bold text-rose-600 dark:text-rose-400">
              {formatAED(kpis?.outstandingReceivablesAed)}
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
              Pending payment from Dubai customers
            </p>
          </div>

          {/* 2. Total AED Collected */}
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[13.5px] text-slate-600 dark:text-slate-300 font-medium mb-2">
              <span className="flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Total AED Collected
              </span>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Received</span>
            </div>
            <div className="text-[22px] font-bold text-teal-700 dark:text-teal-400">
              {formatAED(kpis?.totalAedCollected)}
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
              Payments successfully collected from customers
            </p>
          </div>

          {/* 3. India Distribution Pending */}
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[13.5px] text-slate-600 dark:text-slate-300 font-medium mb-2">
              <span className="flex items-center gap-1.5">
                <Split className="w-4 h-4 text-amber-500" />
                India Distribution Pending
              </span>
              <span className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded font-bold">Unallocated</span>
            </div>
            <div className="text-[22px] font-bold text-amber-600 dark:text-amber-400">
              {formatINR(kpis?.indiaDistributionPendingInr)}
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
              Customer orders waiting to be allocated to India parties
            </p>
          </div>

          {/* 4. Bank Distribution Pending */}
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[13.5px] text-slate-600 dark:text-slate-300 font-medium mb-2">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-500" />
                Bank Accounts Balance
              </span>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Bank Ledger</span>
            </div>
            <div className="text-[22px] font-bold text-slate-900 dark:text-slate-100">
              {formatINR(kpis?.bankDistributionPendingInr)}
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
              Net running balance across bank accounts (MK, SALA, etc.)
            </p>
          </div>

          {/* 5. Gross Profit */}
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[13.5px] text-slate-600 dark:text-slate-300 font-medium mb-2">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Gross Profit
              </span>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Profit</span>
            </div>
            <div className="text-[22px] font-bold text-indigo-600 dark:text-indigo-400">
              {formatAED(kpis?.grossProfitAed)}
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
              Profit before delivery fee deductions
            </p>
          </div>

          {/* 6. Delivery Charges Total */}
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[13.5px] text-slate-600 dark:text-slate-300 font-medium mb-2">
              <span className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-purple-500" />
                Delivery Fees (20%)
              </span>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Fee Cut</span>
            </div>
            <div className="text-[22px] font-bold text-slate-900 dark:text-slate-100">
              {formatAED(kpis?.deliveryChargesAed)}
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
              20% cut deducted from gross profit
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: VISUAL CHARTS & TRENDS */}
      {dailyTrends.length > 0 && (
        <div className="p-4 sm:p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13.5px] font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Daily Volume & Profit Progression
            </h3>
            <span className="text-[13px] text-slate-500 dark:text-slate-400 font-medium">
              {dailyTrends.length} Active Days in Period
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3 pt-2">
            {dailyTrends.map((d) => (
              <div
                key={d.date}
                className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-mono font-bold text-slate-800 dark:text-slate-200">{d.date}</span>
                  <span className="text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    {d.count} Txn
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider">INR Sent</span>
                  <span className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100">{formatINR(d.inrVolume)}</span>
                </div>
                <div>
                  <span className="text-[11px] text-teal-700 dark:text-teal-400 block uppercase tracking-wider font-semibold">Net Profit</span>
                  <span className="text-[13.5px] font-bold text-teal-700 dark:text-teal-400">{formatAED(d.netProfit)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: RECENT TRANSACTIONS TABLE */}
      <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">Recent Remittance Transfers</h3>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
              Dubai customer orders and their India distribution status
            </p>
          </div>
          <Link
            href="/transactions"
            className="text-[13px] font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 text-[11px]">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {recentTxns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-[13px]">
                    {loading
                      ? "Loading transactions..."
                      : dbError
                      ? "Unable to load transactions (Database offline or waking up)."
                      : "No transactions found for the selected timeframe."}
                  </td>
                </tr>
              ) : (
                recentTxns.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      <span>{t.transaction_number}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{t.transaction_date}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{t.customer_name}</div>
                      {t.customer_code && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          {t.customer_code}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{formatINR(t.inr_amount)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{formatAED(t.aed_amount)}</td>
                    <td className="px-4 py-3 font-bold text-teal-700 dark:text-teal-400">{formatAED(t.net_profit_aed)}</td>
                    <td className="px-4 py-3">
                      {t.remaining_inr === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <span>100% Allocated ({formatINR(t.total_distributed_inr)})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Pending {formatINR(t.remaining_inr)}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
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
