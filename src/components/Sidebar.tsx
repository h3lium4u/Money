"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Building2,
  ArrowRightLeft,
  Handshake,
  Split,
  Landmark,
  Wallet,
  FileSpreadsheet,
  Bot,
  Settings,
  X,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  highlight?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    label: "OVERVIEW",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "TRANSFERS",
    items: [
      { name: "Customer Transfers", href: "/remittances", icon: Receipt },
      { name: "Dubai Client (AED)", href: "/transactions", icon: Building2 },
      { name: "Party Transfers", href: "/party-transfers", icon: ArrowRightLeft },
    ],
  },
  {
    label: "PEOPLE & PARTNERS",
    items: [
      { name: "Parties & Ledger", href: "/parties", icon: Handshake },
      { name: "India Distribution", href: "/distributors", icon: Split },
    ],
  },
  {
    label: "SETTLEMENT",
    items: [
      { name: "Bank Distribution (IND)", href: "/bank-distrip", icon: Landmark },
      { name: "Receivables & Dues", href: "/receivables", icon: Wallet },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { name: "Reports & Export", href: "/reports", icon: FileSpreadsheet },
      { name: "AI Assistant", href: "/ai-assistant", icon: Bot },
      { name: "System Health", href: "/settings/system-health", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, isMobileMenuOpen, closeMobileMenu } = useTheme();
  const isDark = theme === "dark";

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col shrink-0 min-h-screen transition-transform duration-300 md:static md:translate-x-0 ${
        isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
      }`}
      style={{
        width: 250,
        background: isDark ? "#090A0F" : "#FFFFFF",
        borderRight: `1px solid ${isDark ? "#1F2333" : "#E2E8F0"}`,
      }}
    >
      {/* Brand Header — Cyber Iris & Violet Gradient */}
      <div
        style={{
          height: 64,
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          {/* Logo Option 3 — Dual Chevrons Remittance Bridge */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.15)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Accounts Dual Chevrons Logo"
            >
              <path
                d="M26 40L48 22L48 35L70 35"
                stroke="#38BDF8"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M74 60L52 78L52 65L30 65"
                stroke="#A78BFA"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div>
            <div
              style={{
                fontFamily: '"Helvetica Neue", Arial, sans-serif',
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "0.08em",
                color: "#FFFFFF",
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              ACCOUNTS
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                fontSize: 12,
                color: "#C7D2FE",
                marginTop: 3,
                letterSpacing: "0.04em",
              }}
            >
              Dubai → India
            </div>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={closeMobileMenu}
          className="p-1 rounded-md text-white/80 hover:text-white hover:bg-indigo-900/50 md:hidden"
          aria-label="Close Sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List — Clean Original Icons with Option D Colors */}
      <nav style={{ flex: 1, padding: "0 12px 16px", overflowY: "auto" }}>
        {navigationGroups.map((group, groupIndex) => (
          <div key={group.label}>
            {/* Group header label */}
            <div
              style={{
                padding: groupIndex === 0 ? "16px 12px 6px" : "14px 12px 6px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                color: isDark ? "#475569" : "#94A3B8",
                userSelect: "none" as const,
              }}
            >
              {group.label}
            </div>

            {/* Group items */}
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={closeMobileMenu}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 8,
                    marginBottom: 2,
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    textDecoration: "none",
                    color: isActive
                      ? isDark ? "#A78BFA" : "#6366F1"
                      : isDark ? "#94A3B8" : "#64748B",
                    background: isActive
                      ? isDark ? "rgba(139, 92, 246, 0.16)" : "#EEF2FF"
                      : "transparent",
                    borderLeft: `3px solid ${
                      isActive
                        ? isDark ? "#8B5CF6" : "#6366F1"
                        : "transparent"
                    }`,
                    transition: "color 0.12s, background 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = isDark ? "#F8FAFC" : "#0F172A";
                      (e.currentTarget as HTMLElement).style.background = isDark ? "#141622" : "#F8FAFC";
                    }
                    if (item.href === "/party-transfers") {
                      fetch("/api/party-transfers").catch(() => {});
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = isDark ? "#94A3B8" : "#64748B";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }
                  }}
                >
                  <Icon
                    style={{
                      width: 16,
                      height: 16,
                      flexShrink: 0,
                      color: isActive
                        ? isDark ? "#A78BFA" : "#6366F1"
                        : isDark ? "#64748B" : "#94A3B8",
                    }}
                  />
                  <span>{item.name}</span>

                  {/* Indicator dot for highlight items */}
                  {item.highlight && !isActive && (
                    <span
                      style={{
                        marginLeft: "auto",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: isDark ? "#8B5CF6" : "#6366F1",
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer User & Security Badge */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: `1px solid ${isDark ? "#1F2333" : "#E2E8F0"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#6366F1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 1px 3px rgba(99, 102, 241, 0.3)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#FFFFFF",
              }}
            >
              A
            </span>
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: isDark ? "#F8FAFC" : "#0F172A",
              }}
            >
              Accounts Admin
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#10B981",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 12, color: isDark ? "#64748B" : "#94A3B8" }}>
                Connected
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
