"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/context/ThemeContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isMobileMenuOpen, closeMobileMenu } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden antialiased bg-white dark:bg-[#0B0F19] text-[#1a1a1a] dark:text-[#F8FAFC] transition-colors duration-200">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Responsive drawer on mobile, static column on desktop) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
