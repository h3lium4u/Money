"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Calendar, Globe, Bot, Sparkles, Database } from "lucide-react";
import AIQuickModal from "@/components/AIQuickModal";

export default function Navbar() {
  const pathname = usePathname();
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Page title mapping
  let title = "Dashboard";
  if (pathname.startsWith("/transactions/new")) title = "New Transaction";
  else if (pathname.startsWith("/transactions")) title = "Transactions Registry";
  else if (pathname.startsWith("/customers")) title = "Customers & Balances";
  else if (pathname.startsWith("/distributors")) title = "India & AED Distributions";
  else if (pathname.startsWith("/bank-distrip")) title = "Bank Distribution Ledger";
  else if (pathname.startsWith("/receivables")) title = "Receivables & Cash on Hand";
  else if (pathname.startsWith("/reports")) title = "Financial Reports & Exports";
  else if (pathname.startsWith("/ai-assistant")) title = "AI Business Assistant (Neon)";
  else if (pathname.startsWith("/settings")) title = "System Settings & Health";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Button Linked to Neon */}
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all border border-emerald-500/30 group cursor-pointer"
            title="Ask AI Assistant (Direct Neon PostgreSQL Ground Truth)"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-200 group-hover:rotate-12 transition-transform" />
            <span>Ask AI</span>
            <span className="flex items-center gap-1 pl-1.5 border-l border-emerald-400/40 text-[10px] font-semibold text-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
              Neon
            </span>
          </button>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{today}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>AED (Dubai) ⇄ INR (India)</span>
          </div>
        </div>
      </header>

      {/* Slide-in AI Quick Assistant Drawer */}
      <AIQuickModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </>
  );
}
