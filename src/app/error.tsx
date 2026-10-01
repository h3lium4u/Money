"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, Database, ExternalLink } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error caught by ErrorBoundary:", error);
  }, [error]);

  const isDbError =
    error.message?.includes("DATABASE_URL") ||
    error.message?.includes("database") ||
    error.message?.includes("timeout") ||
    error.message?.includes("connection");

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {isDbError ? "Database Connection Notice" : "Something Went Wrong"}
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {error.message || "An unexpected error occurred while loading this page."}
          </p>
        </div>

        {isDbError && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-teal-700" />
              <span>How to resolve this on Vercel:</span>
            </div>
            <ol className="list-decimal list-inside text-slate-600 space-y-1 pl-1">
              <li>Open your <strong>Vercel Dashboard</strong> ➔ select project <strong>petti-remittance</strong>.</li>
              <li>Go to <strong>Settings</strong> ➔ <strong>Environment Variables</strong>.</li>
              <li>Add key <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-800">DATABASE_URL</code> with your Neon PostgreSQL connection string.</li>
              <li>Redeploy your project from the Deployments tab.</li>
            </ol>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <button
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            <span>Reload Page</span>
          </button>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
