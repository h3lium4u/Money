"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  PlusCircle,
  FileSpreadsheet,
  XCircle,
  Eye,
  CheckCircle,
} from "lucide-react";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Void modal state
  const [voidingTxn, setVoidingTxn] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [selectedCustomer, statusFilter, fromDate, toDate]);

  async function fetchCustomers() {
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchTransactions() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCustomer) params.set("customerId", selectedCustomer);
      if (statusFilter) params.set("status", statusFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      params.set("limit", "200");

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      setTransactions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmVoid() {
    if (!voidingTxn) return;
    setIsVoiding(true);
    try {
      const res = await fetch(`/api/transactions/${voidingTxn.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason || "User voided transaction" }),
      });
      if (res.ok) {
        setVoidingTxn(null);
        setVoidReason("");
        fetchTransactions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVoiding(false);
    }
  }

  const filtered = transactions.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.transaction_number.toLowerCase().includes(q) ||
      t.customer_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Transactions Registry</h2>
          <p className="text-xs text-slate-500">Comprehensive database records of all cross-border transfers.</p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/reports/export-excel"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </a>

          <Link
            href="/transactions/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Transaction</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search Txn ID / Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Customer Select */}
        <select
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          className="text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">-- All Customers --</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">-- All Statuses --</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="VOIDED">Voided</option>
        </select>

        {/* Date From */}
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        {/* Date To */}
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">INR Order</th>
                <th className="py-3 px-4 text-right">Customer Rate</th>
                <th className="py-3 px-4 text-right">AED Charged</th>
                <th className="py-3 px-4 text-right">Cost AED</th>
                <th className="py-3 px-4 text-right">Net Profit</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-slate-400">
                    Loading records from database...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-slate-400">
                    No transactions found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{t.transaction_number}</td>
                    <td className="py-3 px-4 text-slate-600">{t.transaction_date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <Link href={`/customers/${t.customer_id}`} className="hover:underline text-emerald-700">
                        {t.customer_name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      ₹ {t.inr_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">{t.customer_rate}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      {t.aed_amount.toFixed(2)} AED
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 font-mono">
                      {t.cost_aed.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-semibold ${
                        t.net_profit_aed >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {t.net_profit_aed.toFixed(2)} AED
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === "CONFIRMED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {t.status === "CONFIRMED" && (
                        <button
                          onClick={() => setVoidingTxn(t)}
                          className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded"
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Void Dialog Modal */}
      {voidingTxn && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Void Transaction</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to void <span className="font-mono font-bold text-slate-900">{voidingTxn.transaction_number}</span>?
              This will mark the record as voided and adjust customer balances.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Cancellation (Required for Audit Trail)
              </label>
              <input
                type="text"
                placeholder="e.g. Customer requested cancellation / duplicate entry"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setVoidingTxn(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoid}
                disabled={isVoiding}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700"
              >
                {isVoiding ? "Voiding..." : "Confirm Void"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
