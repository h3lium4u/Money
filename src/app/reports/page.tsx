"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileSpreadsheet,
  Printer,
  ArrowDownToLine,
  Clock,
  Calendar,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Download,
  CheckCircle2,
  Hourglass,
  ShieldCheck,
} from "lucide-react";
import { ReceiptPrinterModal } from "@/components/animation/ReceiptPrinterModal";
import { toast } from "sonner";
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

  // 24-Hour Scheduled Wipe & Backup State
  const [wipeStatus, setWipeStatus] = useState<any | null>(null);
  const [wipeLoading, setWipeLoading] = useState(false);
  const [countdownText, setCountdownText] = useState("");
  const [showConfirmSchedule, setShowConfirmSchedule] = useState(false);

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

  async function fetchWipeStatus() {
    try {
      const res = await fetch("/api/system/scheduled-wipe");
      const data = await res.json();
      setWipeStatus(data);
    } catch (e) {
      console.error("Failed to fetch wipe status:", e);
    }
  }

  // Check URL query trigger (from Excel hyperlinks) on initial mount
  useEffect(() => {
    fetchWipeStatus();
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const trigger = sp.get("trigger") || sp.get("action");
      if (trigger === "schedule-wipe") {
        handleScheduleWipe();
        window.history.replaceState({}, "", window.location.pathname);
      } else if (trigger === "revoke-wipe") {
        handleRevokeWipe();
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  // Real-time 1-second countdown ticker for active 24-hour wipe
  useEffect(() => {
    if (!wipeStatus?.isScheduled || !wipeStatus?.executeAt) {
      setCountdownText("");
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const target = new Date(wipeStatus.executeAt).getTime();
      const diffSec = Math.max(0, Math.ceil((target - now) / 1000));

      if (diffSec <= 0) {
        fetchWipeStatus();
        fetchReport();
        return;
      }

      const h = Math.floor(diffSec / 3600);
      const m = Math.floor((diffSec % 3600) / 60);
      const s = diffSec % 60;
      const parts = [];
      if (h > 0) parts.push(`${h}h`);
      if (m > 0 || h > 0) parts.push(`${m}m`);
      parts.push(`${s}s`);
      setCountdownText(parts.join(" "));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [wipeStatus?.isScheduled, wipeStatus?.executeAt]);

  async function handleScheduleWipe() {
    setWipeLoading(true);
    try {
      // 1. Trigger instantaneous pre-wipe backup download
      const dl = document.createElement("a");
      dl.href = "/api/system/scheduled-wipe/download-backup?schedule=true";
      dl.download = "";
      document.body.appendChild(dl);
      dl.click();
      document.body.removeChild(dl);

      // 2. Fetch updated scheduled status
      const res = await fetch("/api/system/scheduled-wipe");
      const data = await res.json();
      setWipeStatus(data);

      toast.success("24-Hour Clear Scheduled! Pre-wipe backup downloaded.", {
        description: "Countdown is now running. All data will ONLY be cleared after 24 hours. You can revoke anytime.",
        duration: 8000,
      });
    } catch (err: any) {
      toast.error("Failed to schedule clear: " + (err?.message || "Unknown error"));
    } finally {
      setWipeLoading(false);
      setShowConfirmSchedule(false);
    }
  }

  async function handleRevokeWipe() {
    setWipeLoading(true);
    try {
      const res = await fetch("/api/system/scheduled-wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      const data = await res.json();
      setWipeStatus(data);
      toast.success("Scheduled Clear Revoked!", {
        description: "The scheduled wipe has been cancelled. All transactions, master parties, and Excel files remain untouched.",
        duration: 6000,
      });
    } catch (err: any) {
      toast.error("Failed to revoke clear: " + (err?.message || "Unknown error"));
    } finally {
      setWipeLoading(false);
    }
  }

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

      {/* 24-Hour Scheduled Ledger & Excel Clear Section - Hidden on Print */}
      {wipeStatus?.isScheduled ? (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border-2 border-rose-300 dark:border-rose-900 rounded-xl p-5 shadow-sm space-y-3.5 no-print animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm animate-pulse">
                <Hourglass className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-rose-900">24-Hour Ledger Clear Scheduled</h3>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-rose-200 text-rose-800 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                    Countdown Running
                  </span>
                </div>
                <p className="text-xs text-rose-700 font-medium">
                  Ledger and Excel data will ONLY be cleared when the 24-hour timer expires. Master parties are preserved.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleRevokeWipe}
                disabled={wipeLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer transition-all active:scale-95"
                title="Immediately abort and cancel the scheduled clear"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{wipeLoading ? "Revoking..." : "Revoke / Cancel Clear"}</span>
              </button>

              <a
                href="/api/reports/export-excel"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-white border border-rose-300 text-rose-800 hover:bg-rose-50 shadow-2xs transition-all"
                title="Download another copy of the latest Excel file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Backup</span>
              </a>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 rounded-lg p-3.5 border border-rose-200 dark:border-rose-900/50 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Time Remaining:</span>
              <span className="font-mono font-bold text-rose-700 text-sm tracking-wide bg-rose-100/70 px-2 py-0.5 rounded">
                {countdownText || wipeStatus.remainingFormatted}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Scheduled Execution:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {wipeStatus.executeAt ? new Date(wipeStatus.executeAt).toLocaleString() : "-"}
              </span>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Protected: Core master parties (HAJA, MK, NF2, SALA, SARAB)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                24-Hour Scheduled Excel & Ledger Clear
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
                Safety Delay Guard
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Clear all transactions and reset the Excel ledger with a strict 24-hour safety delay. Clicking the button immediately downloads the latest Excel backup file and starts the countdown. You can click <strong>Revoke</strong> anytime within 24 hours to cancel.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmSchedule(true)}
            disabled={wipeLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all shrink-0 cursor-pointer active:scale-95"
            title="Schedule a full clear of the Excel workbook and database with a 24-hour delayed timer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Schedule 24-Hour Clear & Download Backup</span>
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Schedule 24-Hour Ledger Clear?</h3>
                <p className="text-xs text-slate-500">24-hour delayed reset with safety revoke</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 space-y-2 text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                Current latest Excel file will be downloaded immediately as backup.
              </p>
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Hourglass className="w-4 h-4 text-amber-600 shrink-0" />
                Data will NOT be touched for 24 hours.
              </p>
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                You can Revoke / Cancel the clear anytime within the 24 hours.
              </p>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700">
                Core master parties (HAJA · MK · NF2 · SALA · SARAB) are permanently protected and never deleted.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmSchedule(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScheduleWipe}
                disabled={wipeLoading}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{wipeLoading ? "Processing..." : "Confirm & Download Backup"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
