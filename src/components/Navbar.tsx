"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Calendar, Globe, Sparkles, Menu, Moon, Sun } from "lucide-react";
import AIQuickModal from "@/components/AIQuickModal";
import { useTheme } from "@/context/ThemeContext";

export default function Navbar() {
  const pathname = usePathname();
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const { theme, toggleTheme, toggleMobileMenu } = useTheme();
  const isDark = theme === "dark";

  let title = "Dashboard";
  if (pathname.startsWith("/transactions/new")) title = "New Remittance";
  else if (pathname.startsWith("/transactions"))  title = "Transactions Registry";
  else if (pathname.startsWith("/customers"))     title = "Customers & Balances";
  else if (pathname.startsWith("/party-transfers") || pathname.startsWith("/parties/transfers")) title = "Party Transfers";
  else if (pathname.startsWith("/parties"))       title = "Registered Parties & Ledger";
  else if (pathname.startsWith("/distributors"))  title = "India & AED Distributions";
  else if (pathname.startsWith("/bank-distrip") || pathname.startsWith("/bank-distribution-settlement")) title = "Bank Distribution Settlement";
  else if (pathname.startsWith("/receivables"))   title = "Receivables & Cash on Hand";
  else if (pathname.startsWith("/reports"))       title = "Financial Reports & Exports";
  else if (pathname.startsWith("/ai-assistant"))  title = "AI Business Assistant";
  else if (pathname.startsWith("/settings"))      title = "System Settings & Health";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });

  return (
    <>
      <header
        style={{
          height: 62,
          background: isDark ? "#0F172A" : "#FFFFFF",
          borderBottom: `1px solid ${isDark ? "#1E293B" : "#D9D9D9"}`,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
        className="sm:px-6 md:px-8"
      >
        {/* Left: Mobile hamburger + Page Title */}
        <div className="flex items-center gap-2.5">
          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            className={`p-2 rounded-lg md:hidden transition-colors cursor-pointer ${
              isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-800"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            }`}
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 16,
              color: isDark ? "#F8FAFC" : "#121827",
              letterSpacing: "-0.01em",
            }}
            className="truncate max-w-[160px] sm:max-w-none"
          >
            {title}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Ask AI — Fresh Teal pill */}
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 100,
              background: "#0F766E",
              color: "#FFFFFF",
              border: "none",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              transition: "background 0.15s, transform 0.1s",
              letterSpacing: "-0.01em",
              boxShadow: "0 1px 3px rgba(15,118,110,0.2)",
            }}
            className="hover:bg-teal-600"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-200" />
            <span className="hidden xs:inline">Ask AI</span>
            <span className="xs:hidden">AI</span>
            <span
              style={{
                paddingLeft: 6,
                borderLeft: "1px solid rgba(255,255,255,0.3)",
                fontSize: 11,
                fontWeight: 600,
                color: "#CCFBF1",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              className="hidden sm:flex"
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#5EEAD4",
                  display: "inline-block",
                }}
              />
              Neon
            </span>
          </button>

          {/* Theme Toggle Button (Light/Dark Mode) */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? "Switch to White Mode" : "Switch to Dark Mode"}
            className={`p-2 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
              isDark
                ? "border-slate-700 bg-slate-800 text-amber-300 hover:bg-slate-700 hover:text-amber-200"
                : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* Date pill — hidden on small mobile */}
          <div
            style={{
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 100,
              border: `1px solid ${isDark ? "#1E293B" : "#D9D9D9"}`,
              fontSize: 13,
              fontWeight: 400,
              color: isDark ? "#94A3B8" : "#666666",
              fontFamily: "var(--font-body)",
              background: isDark ? "#1E293B/50" : "#FFFFFF",
            }}
            className="hidden lg:flex"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{today}</span>
          </div>

          {/* Currency pill — hidden on narrow mobile */}
          <div
            style={{
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 100,
              border: `1px solid ${isDark ? "rgba(20, 184, 166, 0.3)" : "#CCFBF1"}`,
              background: isDark ? "rgba(20, 184, 166, 0.12)" : "#F0FDFA",
              fontSize: 13,
              fontWeight: 600,
              color: isDark ? "#2DD4BF" : "#0F766E",
              fontFamily: "var(--font-body)",
            }}
            className="hidden sm:flex"
          >
            <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>AED ⇄ INR</span>
          </div>
        </div>
      </header>

      <AIQuickModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </>
  );
}
