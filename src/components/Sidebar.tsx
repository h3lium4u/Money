"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Zap,
  ArrowLeftRight,
  Users,
  Handshake,
  ArrowRightLeft,
  Landmark,
  Wallet,
  FileSpreadsheet,
  Split,
  Settings,
  X,
  Bot,
  Building2,
  Receipt,
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
      { name: "Customer Remittances", href: "/remittances", icon: Receipt },
      { name: "Dubai Client (AED)", href: "/transactions", icon: Building2 },
      { name: "Party Transfers", href: "/party-transfers", icon: ArrowRightLeft },
    ],
  },
  {
    label: "PEOPLE & PARTNERS",
    items: [
      { name: "Retail Customers", href: "/customers", icon: Users },
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
        background: isDark ? "#0F172A" : "#FFFFFF",
        borderRight: `1px solid ${isDark ? "#1E293B" : "#D9D9D9"}`,
      }}
    >
      {/* Brand — Fresh Teal header */}
      <div
        style={{
          height: 64,
          background: "#0F766E",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          {/* Logo mark */}
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              background: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <span
              style={{
                fontFamily: '"Helvetica Neue", Arial, sans-serif',
                fontWeight: 700,
                fontSize: 16,
                color: "#0F766E",
                lineHeight: 1,
              }}
            >
              R
            </span>
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
              REMIT
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                fontSize: 12,
                color: "#CCFBF1",
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
          className="p-1 rounded-md text-white/80 hover:text-white hover:bg-teal-800/50 md:hidden"
          aria-label="Close Sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

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
                color: isDark ? "#475569" : "#A1A1AA",
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
                      ? isDark ? "#2DD4BF" : "#0F766E"
                      : isDark ? "#94A3B8" : "#666666",
                    background: isActive
                      ? isDark ? "rgba(20, 184, 166, 0.14)" : "#F0FDFA"
                      : "transparent",
                    borderLeft: `3px solid ${
                      isActive
                        ? isDark ? "#2DD4BF" : "#0F766E"
                        : "transparent"
                    }`,
                    transition: "color 0.12s, background 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = isDark ? "#F8FAFC" : "#1A1A1A";
                      (e.currentTarget as HTMLElement).style.background = isDark ? "#1E293B" : "#F5F5F5";
                    }
                    if (item.href === "/party-transfers") {
                      fetch("/api/party-transfers").catch(() => {});
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = isDark ? "#94A3B8" : "#666666";
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
                        ? isDark ? "#2DD4BF" : "#0F766E"
                        : isDark ? "#64748B" : "#999999",
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
                        background: isDark ? "#2DD4BF" : "#0F766E",
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: `1px solid ${isDark ? "#1E293B" : "#D9D9D9"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#0F766E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#FFFFFF",
              }}
            >
              R
            </span>
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: isDark ? "#F8FAFC" : "#1A1A1A",
              }}
            >
              Admin
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
              <span style={{ fontSize: 12, color: isDark ? "#64748B" : "#999999" }}>
                Online
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
