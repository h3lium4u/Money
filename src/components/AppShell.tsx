"use client";

import React, { useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ScheduledWipeBanner from "@/components/ScheduledWipeBanner";
import LockScreen from "@/components/LockScreen";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isMobileMenuOpen, closeMobileMenu } = useTheme();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Pre-warm Neon PostgreSQL connection to eliminate cold-start delay
    fetch('/api/health')
      .then(() => {
        // Pre-warm party transfers cache in background
        fetch('/api/party-transfers').catch(() => {});
      })
      .catch(() => {});
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-[#1a1a1a] dark:text-[#F8FAFC]">
        <Toaster position="top-right" richColors closeButton duration={3000} toastOptions={{ className: 'font-sans' }} />
        <LockScreen />
        <ChangePasswordModal />
      </div>
    );
  }

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
        <ScheduledWipeBanner />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10">
          <Toaster position="top-right" richColors closeButton duration={3000} toastOptions={{ className: 'font-sans' }} />
          {children}
        </main>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal />
    </div>
  );
}
