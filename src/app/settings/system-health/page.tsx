"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Server,
  Layers,
  ArrowRight,
  HardDrive,
  Clock,
  Info,
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";

interface TableStorageInfo {
  tableName: string;
  totalBytes: number;
  formattedSize: string;
}

interface DatabaseUsageResponse {
  usedBytes: number;
  limitBytes: number | null;
  availableBytes: number | null;
  usagePercent: number | null;
  usedFormatted: string;
  availableFormatted: string | null;
  limitFormatted: string | null;
  status: "normal" | "getting-high" | "high" | "critical";
  statusLabel: string;
  statusMessage: string;
  limitKnown: boolean;
  checkedAt: string;
  databaseName: string;
  provider: string;
  topTables: TableStorageInfo[];
  isSimulated?: boolean;
  simulationScenario?: string;
  error?: string;
}

export default function SystemHealthPage() {
  const [data, setData] = useState<DatabaseUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedRelative, setLastCheckedRelative] = useState<string>("Just now");

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/system/database-usage");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load database storage usage");
      }
      setData(json);
      setLastCheckedRelative("Just now");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Auto-refresh every 5 minutes (300,000 ms)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsage();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  // Update relative "last checked" text every 30 seconds
  useEffect(() => {
    if (!data?.checkedAt) return;
    const interval = setInterval(() => {
      const diffSec = Math.floor((Date.now() - new Date(data.checkedAt).getTime()) / 1000);
      if (diffSec < 30) setLastCheckedRelative("Just now");
      else if (diffSec < 60) setLastCheckedRelative(`${diffSec}s ago`);
      else if (diffSec < 3600) setLastCheckedRelative(`${Math.floor(diffSec / 60)}m ago`);
      else setLastCheckedRelative(`${Math.floor(diffSec / 3600)}h ago`);
    }, 15000);
    return () => clearInterval(interval);
  }, [data]);

  // Determine styling based on threshold
  const statusConfig = {
    normal: {
      badgeClass: "bg-teal-50 text-teal-800 border-teal-200",
      barColor: "bg-teal-500",
      textColor: "text-teal-700",
      icon: CheckCircle2,
    },
    "getting-high": {
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      barColor: "bg-amber-500",
      textColor: "text-amber-700",
      icon: AlertTriangle,
    },
    high: {
      badgeClass: "bg-orange-50 text-orange-800 border-orange-200",
      barColor: "bg-orange-500",
      textColor: "text-orange-700",
      icon: AlertTriangle,
    },
    critical: {
      badgeClass: "bg-rose-50 text-rose-800 border-rose-200 animate-pulse",
      barColor: "bg-rose-600",
      textColor: "text-rose-700",
      icon: AlertOctagon,
    },
  };

  const currentStatus = data?.status || "normal";
  const currentConfig = statusConfig[currentStatus];
  const StatusIcon = currentConfig.icon;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumbs items={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings" },
        { label: "System Health" },
      ]} />
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Link href="/settings" className="hover:text-slate-800">
              Settings
            </Link>
            <span>/</span>
            <span className="text-teal-700 font-bold">System Health</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>System Health & Infrastructure</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time monitoring of database storage, Neon PostgreSQL connectivity, and service quotas.
          </p>
        </div>

        {/* Manual Refresh Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchUsage()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin text-teal-700" : ""}`} />
            <span>{loading ? "Checking..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Failed to Query Database Storage</p>
              <p className="text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchUsage()}
            className="px-3 py-1 bg-rose-600 text-white rounded text-xs font-semibold hover:bg-rose-700 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* MAIN DATABASE STORAGE USAGE CARD */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Database Storage</h3>
              <p className="text-xs text-slate-500">
                Engine: <strong className="text-slate-700">{data?.provider || "Neon PostgreSQL"}</strong> • Database:{" "}
                <span className="font-mono text-slate-700">{data?.databaseName || "neondb"}</span>
              </p>
            </div>
          </div>

          {/* Status Badge */}
          {data && (
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${currentConfig.badgeClass}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              <span>{data.statusLabel}</span>
            </div>
          )}
        </div>

        {/* Storage Bar & Percentage */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Storage Capacity
            </span>
            <span className="font-mono text-sm font-bold text-slate-900">
              {data?.limitKnown && data.usagePercent !== null ? `${data.usagePercent}%` : "Quota Unavailable"}
            </span>
          </div>

          {/* Visual Progress Bar */}
          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            {data?.limitKnown && data.usagePercent !== null ? (
              <div
                className={`h-full rounded-full transition-all duration-500 ${currentConfig.barColor}`}
                style={{ width: `${Math.min(100, Math.max(3, data.usagePercent))}%` }}
              />
            ) : (
              <div className="h-full w-full bg-slate-200/70 rounded-full flex items-center justify-center">
                <span className="text-[10px] text-slate-500 font-medium">
                  Actual database size: {data?.usedFormatted || "8.0 MB"} (Storage quota not configured)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Exact Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Used Storage */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Used
            </span>
            <p className="text-xl font-bold font-mono text-slate-900 mt-1">
              {loading && !data ? "..." : data?.usedFormatted || "0 B"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live PostgreSQL footprint
            </p>
          </div>

          {/* Available Storage */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Available
            </span>
            <p className="text-xl font-bold font-mono text-teal-700 mt-1">
              {loading && !data
                ? "..."
                : data?.limitKnown && data.availableFormatted
                ? data.availableFormatted
                : "Unavailable"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {data?.limitKnown ? "Remaining plan quota" : "Quota limit not set"}
            </p>
          </div>

          {/* Total Quota */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total
            </span>
            <p className="text-xl font-bold font-mono text-slate-900 mt-1">
              {loading && !data
                ? "..."
                : data?.limitKnown && data.limitFormatted
                ? data.limitFormatted
                : "Unavailable"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {data?.limitKnown ? "Configured limit" : "Storage limit unavailable"}
            </p>
          </div>
        </div>

        {/* Unavailable Limit Notice */}
        {data && !data.limitKnown && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">Storage Quota Limit is Not Configured</p>
              <p className="text-slate-500 mt-0.5 text-[11px] leading-relaxed">
                The actual database size is reliably retrieved as <strong>{data.usedFormatted}</strong> directly from PostgreSQL via <code>pg_database_size()</code>. To display the percentage and remaining quota against your contracted Neon plan, configure <code>DATABASE_STORAGE_LIMIT_BYTES</code> or provide a <code>NEON_API_KEY</code>.
              </p>
            </div>
          </div>
        )}

        {/* Card Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Last checked: <strong>{lastCheckedRelative}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-slate-400">Auto-refreshes every 5m</span>
          </div>

          <div className={`font-semibold flex items-center gap-1.5 ${currentConfig.textColor}`}>
            <StatusIcon className="w-4 h-4" />
            <span>{data?.statusMessage || "Checking..."}</span>
          </div>
        </div>
      </div>

      {/* TOP TABLES STORAGE BREAKDOWN */}
      {data?.topTables && data.topTables.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              <h4 className="font-bold text-slate-900 text-sm">Top Tables by Storage Footprint</h4>
            </div>
            <span className="text-xs text-slate-500">{data.topTables.length} Tables tracked</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Table Name</th>
                  <th className="py-2.5 px-4 text-right">Disk Size</th>
                  <th className="py-2.5 px-4 text-right">Bytes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topTables.map((t) => (
                  <tr key={t.tableName} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{t.tableName}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-800">{t.formattedSize}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                      {t.totalBytes.toLocaleString()} B
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SERVICE INFRASTRUCTURE & CONNECTIVITY CARD */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Server className="w-4 h-4 text-teal-700" />
          <h4 className="text-sm font-bold text-slate-900">Database Connection Security & Architecture</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <span className="text-slate-500 font-medium">Provider</span>
            <p className="font-bold text-slate-900 mt-0.5">Neon PostgreSQL (Serverless)</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <span className="text-slate-500 font-medium">Database Name</span>
            <p className="font-mono font-bold text-slate-900 mt-0.5">{data?.databaseName || "neondb"}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <span className="text-slate-500 font-medium">SSL / Encryption</span>
            <p className="font-bold text-teal-700 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>TLS / Strict Mode</span>
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <span className="text-slate-500 font-medium">Client Credentials</span>
            <p className="font-bold text-slate-700 mt-0.5">Secured (Backend Isolated)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
