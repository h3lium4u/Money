"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  ArrowUpRight,
  PlusCircle,
  Coins,
  CheckCircle,
  AlertCircle,
  CreditCard,
} from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all"); // 'all', 'owing', 'cleared'

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      setCustomers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = customers.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.code.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (balanceFilter === "owing" && (c.outstanding_balance || 0) <= 0.01) return false;
    if (balanceFilter === "cleared" && Math.abs(c.outstanding_balance || 0) > 0.01) return false;
    return true;
  });

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Customer Accounts & Receivables</h2>
          <p className="text-xs text-slate-500">
            {customers.length} regular clients mapped from historical remittance accounts.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Total Customer Receivables</span>
            <p className="text-sm font-bold text-rose-950">
              {totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })} AED
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
          {[
            { id: "all", label: "All Customers" },
            { id: "owing", label: "Has Balance Due" },
            { id: "cleared", label: "Settled / Zero" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setBalanceFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                balanceFilter === item.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Grid / Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4 text-right">Default Rate</th>
                <th className="py-3 px-4 text-right">Total Processed (INR)</th>
                <th className="py-3 px-4 text-right">Total AED Billed</th>
                <th className="py-3 px-4 text-right">Total AED Paid</th>
                <th className="py-3 px-4 text-right">Outstanding (AED)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    Loading customers...
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const bal = c.outstanding_balance || 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <Link href={`/customers/${c.id}`} className="hover:underline text-emerald-800">
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{c.code}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                        {c.default_rate || 38.25}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                        ₹ {(c.total_inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-700">
                        {(c.total_aed || 0).toFixed(2)} AED
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-700 font-medium">
                        {(c.total_paid || 0).toFixed(2)} AED
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs ${
                            bal > 0.01
                              ? "bg-rose-100 text-rose-800 font-bold"
                              : bal < -0.01
                              ? "bg-blue-100 text-blue-800 font-bold"
                              : "bg-emerald-100 text-emerald-800 font-medium"
                          }`}
                        >
                          {bal.toFixed(2)} AED
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Link
                          href={`/customers/${c.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                        >
                          Ledger ➔
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
