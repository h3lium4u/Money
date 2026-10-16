"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  lock: () => void;
  isChangePasswordOpen: boolean;
  openChangePassword: () => void;
  closeChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // In-memory authentication state:
  // Reset to false whenever the page is refreshed or opened in a new tab/window.
  // Preserved seamlessly during client-side Next.js route navigation ("only not always").
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);

  const login = async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || "Incorrect password. Please try again.",
        };
      }

      setIsAuthenticated(true);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Failed to authenticate. Server connection error.",
      };
    }
  };

  const lock = () => {
    setIsAuthenticated(false);
  };

  const openChangePassword = () => {
    setIsChangePasswordOpen(true);
  };

  const closeChangePassword = () => {
    setIsChangePasswordOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login,
        lock,
        isChangePasswordOpen,
        openChangePassword,
        closeChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
