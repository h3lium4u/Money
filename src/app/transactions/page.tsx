"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  PlusCircle,
  FileSpreadsheet,
  Clock,
  Split,
  AlertCircle,
  ShieldCheck,
  Trash2,
  AlertTriangle,
} from "lucide-react";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick preset filter
  const [timeFilter, setTimeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Void modal state
  const [voidingTxn, setVoidingTxn] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);

  // Split modal state
  const [splittingTxn, setSplittingTxn] = useState<any | null>(null);
  const [splitDistId, setSplitDistId] = useState("");
  const [splitAmount, setSplitAmount] = useState("");
  const [splitNotes, setSplitNotes] = useState("");
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [timeFilter, selectedCustomer, statusFilter, fromDate, toDate]);

  const todayStr = "2026-09-26";
  const yesterdayStr = "2026-09-25";

  async function fetchMetadata() {
    try {
      const [cRes, dRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/distributors"),
      ]);
      const cData = await cRes.json();
      const dData = await dRes.json();
      setCustomers(cData || []);
      const activeDists = (dData || []).filter((d: any) =>
        ["INDIA_DISTRIBUTOR", "HYBRID", "BANK_ACCOUNT"].includes(d.partner_type)
      );
      setDistributors(activeDists);
      if (activeDists.length > 0) {
        setSplitDistId(activeDists[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchTransactions() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (timeFilter === "today") {
        params.set("from", todayStr);
        params.set("to", todayStr);
      } else if (timeFilter === "yesterday") {
        params.set("from", yesterdayStr);
        params.set("to", yesterdayStr);
      } else if (timeFilter === "week") {
        params.set("from", "2026-09-20");
        params.set("to", todayStr);
      } else if (timeFilter === "month") {
        params.set("from", "2026-09-01");
        params.set("to", todayStr);
      } else if (timeFilter === "custom" && fromDate && toDate) {
        params.set("from", fromDate);
        params.set("to", toDate);
      }

      if (selectedCustomer) params.set("customerId", selectedCustomer);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "100");

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

  async function handleAddSplit(e: React.FormEvent) {
    e.preventDefault();
    if (!splittingTxn) return;
    setSplitLoading(true);
    setSplitError(null);

    try {
      const res = await fetch("/api/distribution-splits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: splittingTxn.id,
          distributor_id: splitDistId,
          split_date: splittingTxn.transaction_date || todayStr,
          inr_amount: parseFloat(splitAmount),
          notes: splitNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSplittingTxn(null);
      setSplitAmount("");
      setSplitNotes("");
      fetchTransactions();
    } catch (err: any) {
      setSplitError(err.message || "Failed to add split");
    } finally {
      setSplitLoading(false);
    }
  }

  const formatINR = (val?: number) =>
    `₹ ${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatAED = (val?: number) =>
    `${(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Remittance Transfers</h2>
          <p className="text-xs text-slate-500">
            View all Dubai ➔ India transfers with authoritative AED calculations and India distribution status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/transactions/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Transfer</span>
          </Link>
          <Link
            href="/distributors"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50 shadow-sm"
          >
            <Split className="w-4 h-4 text-emerald-600" />
            <span>India Distribution</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        {/* Quick Time Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-600" /> Quick Date:
          </span>
          {[
            { id: "all", label: "All Time" },
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "custom", label: "Custom Range" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTimeFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeFilter === item.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by ID or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-slate-800"
            />
          </div>

          <div>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 text-slate-800"
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 text-slate-800"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="VOIDED">VOIDED</option>
            </select>
          </div>

          {timeFilter === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-1.5 text-slate-700"
              />
              <span className="text-slate-400 text-xs">➔</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-1.5 text-slate-700"
              />
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200 text-[10px]">
              <tr>
                <th className="px-4 py-3">Txn ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">INR Order</th>
                <th className="px-4 py-3">Customer Rate</th>
                <th className="px-4 py-3">AED Charged</th>
                <th className="px-4 py-3">Net Profit</th>
                <th className="px-4 py-3">India Distribution</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    Loading transfers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No remittance transactions found matching the filter.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr
                    key={t.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      t.status === "VOIDED" ? "opacity-60 bg-slate-50/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{t.transaction_number}</span>
                        {t.is_demo && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200 uppercase font-semibold">
                            DEMO
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.transaction_date}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${t.customer_id}`}
                        className="font-bold text-slate-800 hover:text-emerald-600 hover:underline"
                      >
                        {t.customer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatINR(t.inr_amount)}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{t.customer_rate.toFixed(4)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatAED(t.aed_amount)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">
                      {formatAED(t.net_profit_aed)}
                    </td>
                    <td className="px-4 py-3">
                      {t.remaining_inr === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                          <ShieldCheck className="w-3 h-3" />
                          <span>100% Split ({formatINR(t.total_distributed_inr)})</span>
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                            <AlertCircle className="w-3 h-3" />
                            <span>Pending {formatINR(t.remaining_inr)}</span>
                          </span>
                          <button
                            onClick={() => {
                              setSplittingTxn(t);
                              setSplitAmount(String(t.remaining_inr));
                              setSplitError(null);
                            }}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200"
                          >
                            + Split
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          t.status === "CONFIRMED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.status === "CONFIRMED" && (
                        <button
                          onClick={() => setVoidingTxn(t)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50"
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

      {/* QUICK SPLIT MODAL */}
      {splittingTxn && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Split className="w-5 h-5 text-emerald-600" />
                <span>Split Order to India Party</span>
              </h3>
              <button
                onClick={() => setSplittingTxn(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {splitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{splitError}</span>
              </div>
            )}

            <form onSubmit={handleAddSplit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction:</span>
                  <span className="font-mono font-bold text-slate-900">{splittingTxn.transaction_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">{splittingTxn.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Order:</span>
                  <span className="font-bold text-slate-900">{formatINR(splittingTxn.inr_amount)}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-bold pt-1 border-t border-slate-200">
                  <span>Remaining to Allocate:</span>
                  <span>{formatINR(splittingTxn.remaining_inr)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  India Party / Distributor
                </label>
                <select
                  value={splitDistId}
                  onChange={(e) => setSplitDistId(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900"
                >
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} • {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  INR Amount to Allocate
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={splitAmount}
                  onChange={(e) => setSplitAmount(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Reference
                </label>
                <input
                  type="text"
                  placeholder="Payout note..."
                  value={splitNotes}
                  onChange={(e) => setSplitNotes(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSplittingTxn(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={splitLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                >
                  {splitLoading ? "Saving Split..." : "Confirm Split"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VOID CONFIRMATION MODAL */}
      {voidingTxn && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Void Transaction Confirmation</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to void transfer <strong>{voidingTxn.transaction_number}</strong>? This action updates the status to VOIDED, reverses the customer’s receivable balance, and records an audit log.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for voiding (Required for audit log)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Order cancelled by customer or duplicate entry..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidingTxn(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={isVoiding}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
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
