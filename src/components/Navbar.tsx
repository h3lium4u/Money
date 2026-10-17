"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Calendar, Globe, Sparkles, Menu, Moon, Sun, KeyRound, Lock } from "lucide-react";
import AIQuickModal from "@/components/AIQuickModal";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const pathname = usePathname();
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const { theme, toggleTheme, toggleMobileMenu } = useTheme();
  const { openChangePassword, lock } = useAuth();
  const isDark = theme === "dark";

  let title = "Dashboard";
  if (pathname.startsWith("/remittances/new")) title = "New Customer Transfer";
  else if (pathname.startsWith("/remittances")) title = "Customer Transfers";
  else if (pathname.startsWith("/transactions/new")) title = "New Dubai Client Transfer";
  else if (pathname.startsWith("/transactions")) title = "Dubai Client Transfers";
  else if (pathname.startsWith("/customers")) title = "Customers & Balances";
  else if (pathname.startsWith("/party-transfers") || pathname.startsWith("/parties/transfers")) title = "Party Transfers";
  else if (pathname.startsWith("/parties")) title = "Registered Parties & Ledger";
  else if (pathname.startsWith("/distributors")) title = "India Distribution & Splits";
  else if (pathname.startsWith("/bank-distrip") || pathname.startsWith("/bank-distribution-settlement")) title = "Bank Distribution Settlement";
  else if (pathname.startsWith("/receivables")) title = "Receivables & Cash on Hand";
  else if (pathname.startsWith("/reports")) title = "Financial Reports & Exports";
  else if (pathname.startsWith("/ai-assistant")) title = "AI Business Assistant";
  else if (pathname.startsWith("/settings")) title = "System Settings & Health";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });

  return (
    <>
      <header
        style={{
          height: 62,
          background: isDark ? "#090A0F" : "#FFFFFF",
          borderBottom: `1px solid ${isDark ? "#1F2333" : "#E2E8F0"}`,
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
              color: isDark ? "#F8FAFC" : "#0F172A",
              letterSpacing: "-0.01em",
            }}
            className="truncate max-w-[160px] sm:max-w-none"
          >
            {title}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Ask AI — Cyber Iris pill */}
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 100,
              background: "#6366F1",
              color: "#FFFFFF",
              border: "none",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              transition: "background 0.15s, transform 0.1s",
              letterSpacing: "-0.01em",
              boxShadow: "0 1px 3px rgba(99,102,241,0.25)",
            }}
            className="hover:bg-indigo-600"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
            <span className="hidden xs:inline">Ask AI</span>
            <span className="xs:hidden">AI</span>
            <span
              style={{
                paddingLeft: 6,
                borderLeft: "1px solid rgba(255,255,255,0.3)",
                fontSize: 11,
                fontWeight: 600,
                color: "#E0E7FF",
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
                  background: "#818CF8",
                  display: "inline-block",
                }}
              />
              Neon
            </span>
          </button>

          {/* Change Password Button */}
          <button
            type="button"
            onClick={openChangePassword}
            title="Change Master Password"
            className={`p-2 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
              isDark
                ? "border-slate-700 bg-slate-800 text-indigo-400 hover:bg-slate-700 hover:text-indigo-300"
                : "border-slate-300 bg-slate-50 text-indigo-700 hover:bg-slate-100 hover:text-indigo-800"
            }`}
            aria-label="Change Master Password"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          {/* Quick Lock Button */}
          <button
            type="button"
            onClick={lock}
            title="Lock System"
            className={`p-2 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
              isDark
                ? "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-rose-400"
                : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-rose-600"
            }`}
            aria-label="Lock System"
          >
            <Lock className="w-4 h-4" />
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
              border: `1px solid ${isDark ? "#1F2333" : "#E2E8F0"}`,
              fontSize: 13,
              fontWeight: 400,
              color: isDark ? "#94A3B8" : "#64748B",
              fontFamily: "var(--font-body)",
              background: isDark ? "#141622" : "#F8FAFC",
            }}
            className="hidden lg:flex"
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>{today}</span>
          </div>

          {/* Currency pill — hidden on narrow mobile */}
          <div
            style={{
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 100,
              border: `1px solid ${isDark ? "rgba(139, 92, 246, 0.4)" : "#C7D2FE"}`,
              background: isDark ? "rgba(139, 92, 246, 0.15)" : "#EEF2FF",
              fontSize: 13,
              fontWeight: 600,
              color: isDark ? "#A78BFA" : "#6366F1",
              fontFamily: "var(--font-body)",
            }}
            className="hidden sm:flex"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-violet-400" />
            <span>AED ⇄ INR</span>
          </div>
        </div>
      </header>

      <AIQuickModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </>
  );
}
