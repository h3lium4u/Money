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
import { downloadMasterExcel } from "@/lib/export-utils";
import { toast } from "sonner";
import {
  getTodayDateString,
  getYesterdayDateString,
  getDaysAgoDateString,
  getStartOfMonthDateString,
  getDayMonthYearString,
} from "@/lib/date-utils";
import { formatINR, formatAED, formatRate, integerToIndianWords } from "@/lib/number-to-words";

export default function ReportsPage() {
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState(getTodayDateString());
  const [toDate, setToDate] = useState(getTodayDateString());
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any | null>(null);
  const [dailyRows, setDailyRows] = useState<any[]>([]);
  const [showPrinterModal, setShowPrinterModal] = useState(false);

  // 10-Minute Scheduled Wipe & Backup State
  const [wipeStatus, setWipeStatus] = useState<any | null>(null);
  const [wipeLoading, setWipeLoading] = useState(false);
  const [countdownText, setCountdownText] = useState("");
  const [showConfirmSchedule, setShowConfirmSchedule] = useState(false);
  const [wipeScope, setWipeScope] = useState<"all" | "week" | "month" | "year">("all");
  const [wipePassword, setWipePassword] = useState("");

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
        setShowConfirmSchedule(true);
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
        setCountdownText("Executing...");
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
    if (!wipePassword.trim()) {
      toast.error("Master password is required to authorize wiping data.");
      return;
    }
    setWipeLoading(true);
    try {
      // 1. Trigger instantaneous pre-wipe backup download cleanly via blob with password authentication
      await downloadMasterExcel({
        url: `/api/system/scheduled-wipe/download-backup?schedule=true&minutes=10&scope=${wipeScope}`,
        headers: {
          "x-wipe-password": wipePassword.trim(),
        },
        filename: `Accounts_Backup_${wipeScope}_${getDayMonthYearString()}.xlsx`,
      });

      // 2. Fetch updated scheduled status
      const res = await fetch("/api/system/scheduled-wipe");
      const data = await res.json();
      setWipeStatus(data);

      const scopeName = wipeScope === "week" ? "Older than 1 Week" : wipeScope === "month" ? "Older than 1 Month" : wipeScope === "year" ? "Older than 1 Year" : "Entire Ledger";
      toast.success(`10-Minute Clear Scheduled! (${scopeName})`, {
        description: "Countdown is now running (10 minutes). Pre-wipe backup downloaded. You can revoke anytime.",
        duration: 8000,
      });
      setWipePassword("");
      setShowConfirmSchedule(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to schedule clear. Invalid password or server error.");
    } finally {
      setWipeLoading(false);
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:space-y-4">
      {/* Print-Only Professional Header */}
      <div className="hidden print-only border-b border-slate-300 pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">ACCOUNTS & FINANCIAL OPERATIONS (DUBAI ⇄ INDIA)</h1>
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

          <button
            type="button"
            onClick={() => downloadMasterExcel(fromDate && toDate ? { from: fromDate, to: toDate } : undefined)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-teal-700 text-white hover:bg-teal-800 shadow-sm transition-all cursor-pointer"
            title="Download complete Master Excel Workbook containing all sheets, customer IDs, and financial breakdowns"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Master Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 10-Minute Scheduled Ledger & Excel Clear Section - Hidden on Print */}
      {wipeStatus?.isScheduled ? (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border-2 border-rose-300 dark:border-rose-900 rounded-xl p-5 shadow-sm space-y-3.5 no-print animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm animate-pulse">
                <Hourglass className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-rose-900">10-Minute Ledger Clear Scheduled</h3>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-rose-200 text-rose-800 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                    Countdown Running
                  </span>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-200 text-amber-900 rounded-full uppercase">
                    Scope: {wipeStatus.scopeLabel || (wipeStatus.scope === "week" ? "Older than 1 Week" : wipeStatus.scope === "month" ? "Older than 1 Month" : wipeStatus.scope === "year" ? "Older than 1 Year" : "Entire Ledger")}
                  </span>
                </div>
                <p className="text-xs text-rose-700 font-medium">
                  Selected ledger data will ONLY be cleared when the 10-minute timer reaches zero. Master parties are preserved.
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

              <button
                type="button"
                onClick={() => downloadMasterExcel()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-white border border-rose-300 text-rose-800 hover:bg-rose-50 shadow-2xs transition-all cursor-pointer"
                title="Download another copy of the latest Excel file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Backup</span>
              </button>
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
                {wipeStatus.executeAt ? new Date(wipeStatus.executeAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "-"}
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
                10-Minute Scheduled Excel & Ledger Clear
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
                10-Min Safety Delay Guard
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Clear your ledger with a strict 10-minute safety delay. Choose to wipe entire data, old week, month, or year data. The latest backup downloads immediately upon scheduling. You can click <strong>Revoke</strong> anytime within 10 minutes to cancel.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmSchedule(true)}
            disabled={wipeLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all shrink-0 cursor-pointer active:scale-95"
            title="Schedule a ledger clear with a 10-minute delay buffer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Schedule 10-Minute Clear & Download Backup</span>
          </button>
        </div>
      )}

      {/* Confirmation & Scope Modal */}
      {showConfirmSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Schedule 10-Minute Ledger Clear</h3>
                <p className="text-xs text-slate-500">Choose data wipe scope with 10-minute safety revoke buffer</p>
              </div>
            </div>

            {/* Scope Selection Options */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Select Data Wipe Scope:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* 1. Entire Data */}
                <label
                  onClick={() => setWipeScope("all")}
                  className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    wipeScope === "all"
                      ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 ring-1 ring-rose-500"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-white">Entire Ledger</span>
                    <input
                      type="radio"
                      name="wipeScope"
                      checked={wipeScope === "all"}
                      onChange={() => setWipeScope("all")}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Full reset. Clears all transactions, splits & retail customers.
                  </p>
                </label>

                {/* 2. Old Week Data */}
                <label
                  onClick={() => setWipeScope("week")}
                  className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    wipeScope === "week"
                      ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 ring-1 ring-rose-500"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-white">Older than 1 Week</span>
                    <input
                      type="radio"
                      name="wipeScope"
                      checked={wipeScope === "week"}
                      onChange={() => setWipeScope("week")}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Deletes data &gt; 7 days old. Keeps the last 7 days of records.
                  </p>
                </label>

                {/* 3. Old Month Data */}
                <label
                  onClick={() => setWipeScope("month")}
                  className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    wipeScope === "month"
                      ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 ring-1 ring-rose-500"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-white">Older than 1 Month</span>
                    <input
                      type="radio"
                      name="wipeScope"
                      checked={wipeScope === "month"}
                      onChange={() => setWipeScope("month")}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Deletes data &gt; 30 days old. Keeps the last 30 days of records.
                  </p>
                </label>

                {/* 4. Old Year Data */}
                <label
                  onClick={() => setWipeScope("year")}
                  className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    wipeScope === "year"
                      ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 ring-1 ring-rose-500"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-white">Older than 1 Year</span>
                    <input
                      type="radio"
                      name="wipeScope"
                      checked={wipeScope === "year"}
                      onChange={() => setWipeScope("year")}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Deletes data &gt; 365 days old. Keeps current year transactions.
                  </p>
                </label>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 space-y-2 text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                Current latest Excel file will be downloaded immediately as backup.
              </p>
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Hourglass className="w-4 h-4 text-amber-600 shrink-0" />
                Data will NOT be touched for 10 minutes.
              </p>
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                You can Revoke / Cancel the clear anytime within 10 minutes.
              </p>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700">
                Core master parties (HAJA · MK · NF2 · SALA · SARAB) are permanently protected and never deleted.
              </p>
            </div>

            {/* Master Password Input for Security Authorization */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Enter Master Password to authorize wipe: <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-slate-400">Strictly required</span>
              </label>
              <input
                type="password"
                value={wipePassword}
                onChange={(e) => setWipePassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && wipePassword.trim() && !wipeLoading) {
                    handleScheduleWipe();
                  }
                }}
                placeholder="Enter master password..."
                className="w-full px-3.5 py-2.5 rounded-lg text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmSchedule(false);
                  setWipePassword("");
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScheduleWipe}
                disabled={wipeLoading || !wipePassword.trim()}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{wipeLoading ? "Processing..." : "Confirm & Download Backup (10m Delay)"}</span>
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
              <div>
                <p className="text-xl font-bold text-slate-900">{formatINR(kpis?.totalInrProcessed)}</p>
                <p className="text-[10px] text-teal-700 font-semibold leading-tight mt-0.5 break-words">
                  {integerToIndianWords(kpis?.totalInrProcessed)}
                </p>
              </div>
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
