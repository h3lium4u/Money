"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Hourglass, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function ScheduledWipeBanner() {
  const [wipeStatus, setWipeStatus] = useState<any | null>(null);
  const [countdownText, setCountdownText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
    // Poll every 15 seconds to sync status across tabs/windows
    const poll = setInterval(checkStatus, 15000);
    return () => clearInterval(poll);
  }, []);

  async function checkStatus() {
    try {
      const res = await fetch("/api/system/scheduled-wipe");
      const data = await res.json();
      setWipeStatus(data);
    } catch {}
  }

  useEffect(() => {
    if (!wipeStatus?.isScheduled || !wipeStatus?.executeAt) {
      setCountdownText("");
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const target = new Date(wipeStatus.executeAt).getTime();
      const diffSec = Math.max(0, Math.ceil((target - now) / 1000));

      if (diffSec <= 0) {
        checkStatus();
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

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [wipeStatus?.isScheduled, wipeStatus?.executeAt]);

  async function handleQuickRevoke() {
    setLoading(true);
    try {
      const res = await fetch("/api/system/scheduled-wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      const data = await res.json();
      setWipeStatus(data);
      toast.success("Scheduled Clear Revoked!", {
        description: "The scheduled 24-hour clear was cancelled. All records remain safe.",
      });
    } catch {
      toast.error("Failed to revoke scheduled clear");
    } finally {
      setLoading(false);
    }
  }

  if (!wipeStatus?.isScheduled) return null;

  return (
    <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-md z-30 shrink-0">
      <div className="flex items-center gap-2">
        <Hourglass className="w-4 h-4 animate-spin text-amber-200 shrink-0" style={{ animationDuration: "3s" }} />
        <span className="font-bold tracking-tight">
          24-Hour Ledger Clear Active:
        </span>
        <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded text-amber-100">
          {countdownText || wipeStatus.remainingFormatted}
        </span>
        <span className="hidden md:inline text-rose-100 text-[11px]">
          (Only clears when timer reaches zero. Master parties protected.)
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleQuickRevoke}
          disabled={loading}
          className="px-3 py-1 bg-white text-rose-800 hover:bg-rose-50 font-bold rounded shadow-xs cursor-pointer flex items-center gap-1 transition-all active:scale-95 text-[11px]"
          title="Cancel scheduled wipe immediately"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>{loading ? "Revoking..." : "Revoke Clear"}</span>
        </button>

        <Link
          href="/reports"
          className="text-white hover:text-amber-100 underline text-[11px] font-semibold flex items-center gap-0.5"
        >
          <span>View in Reports</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
