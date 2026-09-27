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
  Edit2,
  Calculator,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { numberToIndianWords } from "@/lib/number-to-words";
import { generateTransactionReceipt } from "@/lib/pdf-generator";

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

  // Delete modal state
  const [deletingTxn, setDeletingTxn] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit modal state
  const [editingTxn, setEditingTxn] = useState<any | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editInr, setEditInr] = useState("");
  const [editCustRate, setEditCustRate] = useState("");
  const [editBaseRate, setEditBaseRate] = useState("");
  const [editDeliveryPct, setEditDeliveryPct] = useState("20");
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editPreview, setEditPreview] = useState<any | null>(null);

  // Split modal state
  const [splittingTxn, setSplittingTxn] = useState<any | null>(null);
  const [splitDistId, setSplitDistId] = useState("");
  const [splitAmount, setSplitAmount] = useState("");
  const [splitNotes, setSplitNotes] = useState("");
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  // Quick payment modal state
  const [payingTxn, setPayingTxn] = useState<any | null>(null);
  const [payDate, setPayDate] = useState("2026-09-26");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  function handleOpenPayModal(txn: any) {
    setPayingTxn(txn);
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayAmount(String(txn.pending_aed ?? txn.aed_amount ?? ""));
    setPayMethod("CASH");
    setPayNotes(`Payment for ${txn.transaction_number}`);
    setPayError(null);
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingTxn) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      setPayError("Payment amount must be greater than zero");
      return;
    }

    setPayLoading(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/customers/${payingTxn.customer_id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: payingTxn.id,
          payment_date: payDate,
          amount_aed: amt,
          payment_method: payMethod,
          notes: payNotes || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to record payment");
      }

      setPayingTxn(null);
      await fetchTransactions();
    } catch (err: any) {
      setPayError(err.message || "Failed to record payment");
    } finally {
      setPayLoading(false);
    }
  }

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
      setCustomers(Array.isArray(cData) ? cData : []);
      const activeDists = (Array.isArray(dData) ? dData : []).filter((d: any) =>
        ["INDIA_DISTRIBUTOR", "HYBRID", "BANK_ACCOUNT"].includes(d.partner_type)
      );
      setDistributors(activeDists);
      if (activeDists.length > 0) {
        setSplitDistId(activeDists[0].id);
      }
    } catch (err) {
      console.error(err);
      setCustomers([]);
      setDistributors([]);
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
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  // Open Edit Modal
  function handleOpenEdit(t: any) {
    setEditingTxn(t);
    setEditDate(t.transaction_date);
    setEditCustomerId(t.customer_id);
    setEditInr(String(t.inr_amount));
    setEditCustRate(String(t.customer_rate));
    setEditBaseRate(String(t.base_rate));
    setEditDeliveryPct(String(t.delivery_charge_pct * 100));
    setEditNotes(t.notes || "");
    setEditReason("");
    setEditError(null);
  }

  // Live calculation for edit modal
  useEffect(() => {
    if (!editingTxn) return;
    const inr = parseFloat(editInr);
    const cRate = parseFloat(editCustRate);
    const bRate = parseFloat(editBaseRate);
    const dPct = parseFloat(editDeliveryPct) / 100;

    if (!inr || inr <= 0 || !cRate || cRate <= 0 || !bRate || bRate <= 0) {
      setEditPreview(null);
      return;
    }

    const aedAmount = (inr / 1000) * cRate;
    const costAed = inr / bRate;
    const grossProfitAed = aedAmount - costAed;
    const deliveryChargeAed = grossProfitAed * (isNaN(dPct) ? 0.2 : dPct);
    const netProfitAed = grossProfitAed - deliveryChargeAed;

    setEditPreview({
      aedAmount,
      grossProfitAed,
      deliveryChargeAed,
      netProfitAed,
    });
  }, [editingTxn, editInr, editCustRate, editBaseRate, editDeliveryPct]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTxn) return;

    setIsUpdating(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/transactions/${editingTxn.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: editDate,
          customer_id: editCustomerId,
          inr_amount: parseFloat(editInr),
          customer_rate: parseFloat(editCustRate),
          base_rate: parseFloat(editBaseRate),
          delivery_charge_pct: parseFloat(editDeliveryPct) / 100,
          notes: editNotes || undefined,
          reason: editReason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEditingTxn(null);
      fetchTransactions();
    } catch (err: any) {
      setEditError(err.message || "Failed to update transaction");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingTxn) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/transactions/${deletingTxn.id}?action=delete`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDeletingTxn(null);
      fetchTransactions();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete transaction");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleConfirmVoid() {
    if (!voidingTxn) return;
    setIsVoiding(true);
    try {
      const res = await fetch(`/api/transactions/${voidingTxn.id}?action=void`, {
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
            View, edit, void, or delete Dubai ➔ India transfers with authoritative AED calculations.
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
                    No remittance transactions found. Click "+ New Transfer" to add one.
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
                      <span>{t.transaction_number}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.transaction_date}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${t.customer_id}`}
                        className="font-bold text-slate-800 hover:text-emerald-600 hover:underline"
                      >
                        {t.customer_name}
                      </Link>
                      {t.customer_code && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {t.customer_code}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatINR(t.inr_amount)}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{t.customer_rate.toFixed(4)}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{formatAED(t.aed_amount)}</div>
                      {t.status === "CONFIRMED" && (
                        <div className="mt-1">
                          {(t.paid_aed || 0) >= t.aed_amount ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shadow-2xs">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Paid in Full</span>
                            </span>
                          ) : (t.paid_aed || 0) > 0 ? (
                            <div className="text-[10px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-block">
                              <span>Paid: {formatAED(t.paid_aed)}</span>
                              <span className="mx-1 text-slate-400">•</span>
                              <span className="text-rose-700 font-bold">Due: {formatAED(t.pending_aed)}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded inline-block">
                              Unpaid (Due: {formatAED(t.aed_amount)})
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-600">
                      {formatAED(t.net_profit_aed)}
                    </td>
                    <td className="px-4 py-3">
                      {/* Combined Distributor Names */}
                      {t.distributor_names && t.distributor_names !== "-" && (
                        <div className="mb-1">
                          <span className="font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {t.distributor_names}
                          </span>
                        </div>
                      )}
                      {t.remaining_inr === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300 shadow-2xs">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
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
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Payment Button */}
                        {t.status === "CONFIRMED" && (t.pending_aed === undefined || t.pending_aed > 0) && (
                          <button
                            onClick={() => handleOpenPayModal(t)}
                            title="Record Customer Payment for this Transfer"
                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-1 rounded shadow-2xs transition-colors"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>+ Pay</span>
                          </button>
                        )}

                        {/* Receipt Button */}
                        <button
                          onClick={() => generateTransactionReceipt(t)}
                          title="Download Receipt (PDF)"
                          className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(t)}
                          title="Edit Transfer"
                          className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Void Button */}
                        {t.status === "CONFIRMED" && (
                          <button
                            onClick={() => setVoidingTxn(t)}
                            title="Void Transfer"
                            className="text-[11px] text-amber-700 hover:text-amber-800 font-semibold px-1.5 py-0.5 rounded hover:bg-amber-50"
                          >
                            Void
                          </button>
                        )}

                        {/* Permanent Delete Button */}
                        <button
                          onClick={() => setDeletingTxn(t)}
                          title="Delete Permanently"
                          className="p-1 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT TRANSACTION MODAL */}
      {editingTxn && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-emerald-600" />
                  <span>Edit Remittance Transfer</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">{editingTxn.transaction_number}</span>
              </div>
              <button
                onClick={() => setEditingTxn(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Customer
                  </label>
                  <select
                    value={editCustomerId}
                    onChange={(e) => setEditCustomerId(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    INR Order Amount
                  </label>
                  {numberToIndianWords(editInr) && (
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {numberToIndianWords(editInr)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editInr}
                    onChange={(e) => setEditInr(e.target.value)}
                    className="w-full text-sm font-bold pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {numberToIndianWords(editInr) && (
                  <div className="mt-1.5 p-2 bg-emerald-50/90 border border-emerald-200/90 rounded-lg flex items-center gap-2 text-xs text-emerald-900 animate-in fade-in duration-100">
                    <span className="font-bold text-[10px] tracking-wider uppercase bg-emerald-200 text-emerald-950 px-1.5 py-0.5 rounded font-mono shrink-0">
                      In Words:
                    </span>
                    <span className="font-semibold">{numberToIndianWords(editInr)}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Daily Rate
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editCustRate}
                    onChange={(e) => setEditCustRate(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded p-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    My Rate
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editBaseRate}
                    onChange={(e) => setEditBaseRate(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded p-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Delivery %
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editDeliveryPct}
                    onChange={(e) => setEditDeliveryPct(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded p-2 text-slate-900"
                  />
                </div>
              </div>

              {/* Recalculation Preview */}
              {editPreview && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recalculated AED Charged:</span>
                    <strong className="text-slate-900 font-mono">{formatAED(editPreview.aedAmount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recalculated Net Profit:</span>
                    <strong className="text-emerald-600 font-mono">{formatAED(editPreview.netProfitAed)}</strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Edit (Required for Audit Trail)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rate correction or amended order amount..."
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTxn(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                >
                  {isUpdating ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE CONFIRMATION MODAL */}
      {deletingTxn && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Remittance Transfer</h3>
                <span className="text-xs font-mono text-slate-500">{deletingTxn.transaction_number}</span>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                {deleteError}
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this transfer? This will permanently remove the record and any associated India distribution splits, recalculating customer receivables accordingly.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingTxn(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    INR Amount to Allocate
                  </label>
                  {numberToIndianWords(splitAmount) && (
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {numberToIndianWords(splitAmount)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={splitAmount}
                    onChange={(e) => setSplitAmount(e.target.value)}
                    className="w-full text-xs font-bold pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {numberToIndianWords(splitAmount) && (
                  <div className="mt-1.5 p-2 bg-emerald-50/90 border border-emerald-200/90 rounded-lg flex items-center gap-1.5 text-xs text-emerald-900 animate-in fade-in duration-100">
                    <span className="font-bold text-[10px] tracking-wider uppercase bg-emerald-200 text-emerald-950 px-1.5 py-0.5 rounded font-mono shrink-0">
                      In Words:
                    </span>
                    <span className="font-semibold">{numberToIndianWords(splitAmount)}</span>
                  </div>
                )}
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
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 disabled:opacity-50"
              >
                {isVoiding ? "Voiding..." : "Confirm Void"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK PAYMENT MODAL */}
      {payingTxn && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>Record Customer Payment</span>
              </h3>
              <button
                onClick={() => setPayingTxn(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {payError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{payError}</span>
              </div>
            )}

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction:</span>
                  <span className="font-mono font-bold text-slate-900">{payingTxn.transaction_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">{payingTxn.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Billed:</span>
                  <span className="font-bold text-slate-900">{formatAED(payingTxn.aed_amount)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Already Paid:</span>
                  <span className="font-semibold">{formatAED(payingTxn.paid_aed || 0)}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-bold pt-1 border-t border-slate-200">
                  <span>Remaining Due:</span>
                  <span>{formatAED(payingTxn.pending_aed ?? payingTxn.aed_amount)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="CHEQUE">CHEQUE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Amount Paying Now (AED)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 5000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full text-base font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Receipt Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received partial cash in Dubai office"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayingTxn(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {payLoading ? "Recording..." : "Save Payment Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
