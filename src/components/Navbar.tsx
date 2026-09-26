"use client";

import { usePathname } from "next/navigation";
import { Calendar, Globe } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  // Page title mapping
  let title = "Dashboard";
  if (pathname.startsWith("/transactions/new")) title = "New Transaction";
  else if (pathname.startsWith("/transactions")) title = "Transactions Registry";
  else if (pathname.startsWith("/customers")) title = "Customers & Balances";
  else if (pathname.startsWith("/distributors")) title = "Wholesale Liquidity Partners";
  else if (pathname.startsWith("/bank-distrip")) title = "India Bank Distribution";
  else if (pathname.startsWith("/receivables")) title = "Receivables & Cash on Hand";
  else if (pathname.startsWith("/reports")) title = "Financial Reports & Exports";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{today}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700 border border-emerald-200">
          <Globe className="w-3.5 h-3.5 text-emerald-600" />
          <span>AED (Dubai) ⇄ INR (India)</span>
        </div>
      </div>
    </header>
  );
}
