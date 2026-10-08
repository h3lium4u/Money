"use client";

import React, { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import {
  Wallet,
  Coins,
  CreditCard,
  PlusCircle,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  History,
  Trash2,
  FileText,
  RefreshCw,
  Search,
  UserPlus,
  Edit3,
  Printer,
  X,
  AlertTriangle,
  Building2,
  Phone,
  FileSpreadsheet,
} from "lucide-react";
import { getTodayDateString } from "@/lib/date-utils";
import { ReceiptPrinterModal } from "@/components/animation/ReceiptPrinterModal";
import { toast } from "sonner";

interface CustomerRecord {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  default_rate?: number;
  total_inr?: number;
  total_aed?: number;
  total_paid?: number;
  outstanding_balance?: number;
}

interface LedgerEntry {
  id?: string;
  date: string;
  type: "TRANSACTION" | "PAYMENT";
  reference: string;
  description: string;
  debit_aed: number;
  credit_aed: number;
  running_balance_aed: number;
}

interface CustomerLedgerData {
  customer: CustomerRecord;
  entries: LedgerEntry[];
}

interface PaymentRecord {
  id: string;
  payment_number: string;
  payment_date: string;
  customer_id: string;
  customer_code?: string;
  customer_name: string;
  amount_aed: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export default function ReceivablesPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"ALL" | "OWING" | "CLEARED">("ALL");
  const [historySearch, setHistorySearch] = useState("");

  // Expanded inline statement / ledger per customer
  const [expandedCustId, setExpandedCustId] = useState<string | null>(null);
  const [customerLedgerMap, setCustomerLedgerMap] = useState<Record<string, CustomerLedgerData>>({});
  const [loadingLedgerCustId, setLoadingLedgerCustId] = useState<string | null>(null);

  // Print thermal statement modal
  const [printCustomerData, setPrintCustomerData] = useState<any | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState(false);

  // Quick payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCustId, setSelectedCustId] = useState("");
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNotes, setPayNotes] = useState("");
  const [submittingPay, setSubmittingPay] = useState(false);

  // Create Customer Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRate, setNewRate] = useState("38.25");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Customer Modal
  const [editCustomerTarget, setEditCustomerTarget] = useState<CustomerRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRate, setEditRate] = useState("38.25");
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Customer Modal
  const [deleteCustomerTarget, setDeleteCustomerTarget] = useState<CustomerRecord | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [deleteCustError, setDeleteCustError] = useState<string | null>(null);

  // Delete payment modal
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [deletingPaymentCustId, setDeletingPaymentCustId] = useState<string | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    await Promise.all([fetchCustomers(), fetchGlobalPayments()]);
    setLoading(false);
  }

  async function fetchCustomers() {
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      const validCusts = Array.isArray(data) ? data : [];
      setCustomers(validCusts);
      if (validCusts.length > 0 && !selectedCustId) {
        setSelectedCustId(validCusts[0].id);
      }
    } catch (err) {
      console.error(err);
      setCustomers([]);
    }
  }

  async function fetchGlobalPayments() {
    setLoadingPayments(true);
    try {
      const res = await fetch("/api/payments");
      const data = await res.json();
      const validPmts = Array.isArray(data) ? data : [];
      setAllPayments(validPmts);
    } catch (err) {
      console.error(err);
      setAllPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }

  async function prefetchCustomerLedger(custId: string) {
    if (customerLedgerMap[custId]) return;
    try {
      const res = await fetch(`/api/customers/${custId}`);
      const data = await res.json();
      if (data?.customer) {
        setCustomerLedgerMap((prev) => ({ ...prev, [custId]: data }));
      }
    } catch {
      // background prefetch: ignore
    }
  }

  async function toggleCustomerLedger(custId: string) {
    if (expandedCustId === custId) {
      setExpandedCustId(null);
      return;
    }

    setExpandedCustId(custId);

    // If not cached, fetch customer ledger
    if (!customerLedgerMap[custId]) {
      setLoadingLedgerCustId(custId);
      try {
        const res = await fetch(`/api/customers/${custId}`);
        const data = await res.json();
        if (data?.customer) {
          setCustomerLedgerMap((prev) => ({ ...prev, [custId]: data }));
        }
      } catch (err) {
        console.error("Failed to load customer statement:", err);
      } finally {
        setLoadingLedgerCustId(null);
      }
    }
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setCreateError("Customer name is required");
      return;
    }

    setCreatingCustomer(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          code: newCode.trim() || undefined,
          phone: newPhone.trim() || undefined,
          default_rate: newRate ? parseFloat(newRate) : 38.25,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create customer");

      setShowCreateModal(false);
      setNewName("");
      setNewCode("");
      setNewPhone("");
      setNewRate("38.25");
      toast.success("Customer created successfully");
      await fetchCustomers();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create customer");
      toast.error(err.message || "Failed to create customer");
    } finally {
      setCreatingCustomer(false);
    }
  }

  function openEditCustomerModal(c: CustomerRecord) {
    setEditCustomerTarget(c);
    setEditName(c.name || "");
    setEditCode(c.code || "");
    setEditPhone(c.phone || "");
    setEditRate(String(c.default_rate || 38.25));
    setEditError(null);
  }

  async function handleUpdateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!editCustomerTarget || !editName.trim()) return;

    setEditingCustomer(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/customers/${editCustomerTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim() || undefined,
          phone: editPhone.trim() || undefined,
          default_rate: editRate ? parseFloat(editRate) : 38.25,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update customer");

      setEditCustomerTarget(null);
      toast.success("Customer profile updated successfully");

      // Invalidate ledger cache for this customer
      setCustomerLedgerMap((prev) => {
        const next = { ...prev };
        delete next[editCustomerTarget.id];
        return next;
      });

      await fetchCustomers();
    } catch (err: any) {
      setEditError(err.message || "Failed to update customer");
      toast.error(err.message || "Failed to update customer");
    } finally {
      setEditingCustomer(false);
    }
  }

  async function handleDeleteCustomer() {
    if (!deleteCustomerTarget) return;

    setDeletingCustomer(true);
    setDeleteCustError(null);
    try {
      const res = await fetch(`/api/customers/${deleteCustomerTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete customer");

      if (expandedCustId === deleteCustomerTarget.id) {
        setExpandedCustId(null);
      }

      setDeleteCustomerTarget(null);
      toast.success("Customer removed successfully");
      await fetchCustomers();
    } catch (err: any) {
      setDeleteCustError(err.message || "Failed to delete customer");
      toast.error(err.message || "Failed to delete customer");
    } finally {
      setDeletingCustomer(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustId) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;

    setSubmittingPay(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_date: payDate,
          amount_aed: amt,
          payment_method: payMethod,
          notes: payNotes || undefined,
        }),
      });

      if (res.ok) {
        setShowPayModal(false);
        setPayDate(getTodayDateString());
        setPayAmount("");
        setPayNotes("");
        toast.success("Payment recorded successfully");

        // Invalidate ledger cache for this customer
        setCustomerLedgerMap((prev) => {
          const next = { ...prev };
          delete next[selectedCustId];
          return next;
        });

        await Promise.all([fetchCustomers(), fetchGlobalPayments()]);

        // Refresh inline statement if expanded
        if (expandedCustId === selectedCustId) {
          const lRes = await fetch(`/api/customers/${selectedCustId}`);
          const lData = await lRes.json();
          if (lData?.customer) {
            setCustomerLedgerMap((prev) => ({ ...prev, [selectedCustId]: lData }));
          }
        }
      } else {
        const errJson = await res.json();
        toast.error(errJson.error || "Failed to record payment");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to record payment");
    } finally {
      setSubmittingPay(false);
    }
  }

  async function handleDeletePayment() {
    if (!deletingPaymentId || !deletingPaymentCustId) return;
    setIsDeletingPayment(true);
    try {
      const res = await fetch(
        `/api/customers/${deletingPaymentCustId}/payments?paymentId=${deletingPaymentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Payment removed successfully");
        setDeletingPaymentId(null);
        setDeletingPaymentCustId(null);

        // Invalidate ledger cache
        setCustomerLedgerMap((prev) => {
          const next = { ...prev };
          delete next[deletingPaymentCustId];
          return next;
        });

        await Promise.all([fetchCustomers(), fetchGlobalPayments()]);

        // Refresh inline statement if expanded
        if (expandedCustId === deletingPaymentCustId) {
          const lRes = await fetch(`/api/customers/${deletingPaymentCustId}`);
          const lData = await lRes.json();
          if (lData?.customer) {
            setCustomerLedgerMap((prev) => ({ ...prev, [deletingPaymentCustId]: lData }));
          }
        }
      } else {
        toast.error("Failed to delete payment");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete payment");
    } finally {
      setIsDeletingPayment(false);
    }
  }

  function handleOpenThermalPrint(ledgerData: CustomerLedgerData) {
    const cust = ledgerData.customer;
    const entries = ledgerData.entries || [];
    setPrintCustomerData({
      name: cust.name,
      code: cust.code,
      totalInr: cust.total_inr,
      totalPaid: cust.total_paid,
      outstanding: cust.outstanding_balance,
      entriesCount: entries.length,
      entries: entries.map((e) => ({
        date: e.date,
        type: e.type,
        reference: e.reference,
        amount: e.type === "TRANSACTION" ? e.debit_aed : e.credit_aed,
        currency: "AED",
      })),
    });
    setShowPrinterModal(true);
  }

  // Filtering calculations
  const totalReceivables = customers.reduce(
    (sum, c) => sum + Math.max(0, c.outstanding_balance || 0),
    0
  );
  const totalPaidSum = allPayments.reduce((sum, p) => sum + (p.amount_aed || 0), 0);
  const settledCount = customers.filter((c) => (c.outstanding_balance || 0) <= 0.01).length;
  const owingCount = customers.filter((c) => (c.outstanding_balance || 0) > 0.01).length;

  const filteredCustomers = customers.filter((c) => {
    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchCode = c.code ? c.code.toLowerCase().includes(q) : false;
      const matchPhone = c.phone ? c.phone.toLowerCase().includes(q) : false;
      if (!matchName && !matchCode && !matchPhone) return false;
    }

    // Balance state filter
    if (balanceFilter === "OWING" && (c.outstanding_balance || 0) <= 0.01) return false;
    if (balanceFilter === "CLEARED" && (c.outstanding_balance || 0) > 0.01) return false;

    return true;
  });

  const filteredHistory = allPayments.filter((p) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      p.customer_name.toLowerCase().includes(q) ||
      (p.customer_code && p.customer_code.toLowerCase().includes(q)) ||
      (p.payment_number && p.payment_number.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-teal-700" />
            <span>Receivables & Customer Dues</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete retail customer directory, dues settlement, statement ledger, and live payment history.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-white text-teal-800 border border-teal-300 hover:bg-teal-50 shadow-2xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-teal-700" />
            <span>+ Add Customer</span>
          </button>

          <button
            onClick={() => {
              setPayDate(getTodayDateString());
              setShowPayModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-teal-700 text-white hover:bg-teal-800 shadow-sm transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Payment</span>
          </button>

          <button
            onClick={() => loadAllData()}
            disabled={loading}
            className="p-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center justify-center transition cursor-pointer"
            title="Refresh All Customer Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-teal-700" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Customer Receivables */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Pending Receivables
          </span>
          {loading ? (
            <div className="h-7 w-32 rounded bg-slate-200 animate-pulse mt-2" />
          ) : (
            <h3 className="text-2xl font-bold text-rose-600 mt-1 font-mono">
              {totalReceivables.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} AED
            </h3>
          )}
          <p className="text-[11px] text-slate-400 mt-1">Across {owingCount} accounts with pending dues</p>
        </div>

        {/* Card 2: Total Payments Collected */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Payments Received
          </span>
          {loading ? (
            <div className="h-7 w-32 rounded bg-slate-200 animate-pulse mt-2" />
          ) : (
            <h3 className="text-2xl font-bold text-teal-700 mt-1 font-mono">
              {totalPaidSum.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} AED
            </h3>
          )}
          <p className="text-[11px] text-slate-400 mt-1">{allPayments.length} recorded payments</p>
        </div>

        {/* Card 3: Settled Accounts */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Settled Customer Accounts
          </span>
          {loading ? (
            <div className="h-7 w-24 rounded bg-slate-200 animate-pulse mt-2" />
          ) : (
            <h3 className="text-2xl font-bold text-emerald-700 mt-1 font-mono">
              {settledCount} Accounts
            </h3>
          )}
          <p className="text-[11px] text-slate-400 mt-1">Zero balance / fully paid</p>
        </div>

        {/* Card 4: Total Accounts */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Customers Tracked
          </span>
          {loading ? (
            <div className="h-7 w-24 rounded bg-slate-200 animate-pulse mt-2" />
          ) : (
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              {customers.length} Accounts
            </h3>
          )}
          <p className="text-[11px] text-slate-400 mt-1">Verified retail ledger</p>
        </div>
      </div>

      {/* Main Customers Master & Receivables Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, customer code (e.g. AD-514), phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider mr-1">Filter:</span>
            {[
              { id: "ALL", label: `All (${customers.length})` },
              { id: "OWING", label: `Pending Due (${owingCount})` },
              { id: "CLEARED", label: `Settled (${settledCount})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setBalanceFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  balanceFilter === f.id
                    ? "bg-teal-700 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-3.5 w-[25%]">Customer Account</th>
                <th className="py-3 px-3 text-right w-[15%]">Pricing Rate</th>
                <th className="py-3 px-3 text-right w-[16%]">Total Billed</th>
                <th className="py-3 px-3 text-right w-[16%]">Total Paid</th>
                <th className="py-3 px-3 text-right w-[16%]">Outstanding Due</th>
                <th className="py-3 px-3.5 text-center w-[12%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-600 mb-2" />
                    <span>Loading customer accounts...</span>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                    No customer accounts match your search or filter.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const isExpanded = expandedCustId === c.id;
                  const ledgerData = customerLedgerMap[c.id];
                  const isLoadingThisLedger = loadingLedgerCustId === c.id;
                  const isOwing = (c.outstanding_balance || 0) > 0.01;

                  return (
                    <Fragment key={c.id}>
                      <tr className={`hover:bg-teal-50/20 transition-colors ${isExpanded ? "bg-teal-50/40" : ""}`}>
                        {/* Customer Info */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                <span>{c.name}</span>
                                {c.code && (
                                  <span className="text-[10px] font-mono text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded font-bold">
                                    {c.code}
                                  </span>
                                )}
                              </div>
                              {c.phone && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{c.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Pricing Rate */}
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                          {c.default_rate ? `${c.default_rate.toFixed(3)} AED` : "38.250 AED"}
                          <span className="text-[10px] text-slate-400 block font-sans">per 1000 INR</span>
                        </td>

                        {/* Total Billed */}
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {(c.total_aed || 0).toFixed(3)} AED
                          {c.total_inr && c.total_inr > 0 ? (
                            <span className="text-[10px] text-slate-400 block">
                              ₹ {c.total_inr.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </span>
                          ) : null}
                        </td>

                        {/* Total Paid */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-teal-700 whitespace-nowrap">
                          {(c.total_paid || 0).toFixed(3)} AED
                        </td>

                        {/* Outstanding Balance */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isOwing ? "text-rose-600" : "text-emerald-700"
                            }`}
                          >
                            {(c.outstanding_balance || 0).toFixed(3)} AED
                          </span>
                          <span
                            className={`block text-[10px] font-bold ${
                              isOwing ? "text-rose-500" : "text-emerald-600"
                            }`}
                          >
                            {isOwing ? "Due Pending" : "✓ Settled"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* Statement / Ledger Toggle */}
                            <button
                              type="button"
                              onMouseEnter={() => prefetchCustomerLedger(c.id)}
                              onFocus={() => prefetchCustomerLedger(c.id)}
                              onClick={() => toggleCustomerLedger(c.id)}
                              className={`px-2 py-1 text-[11px] font-bold rounded flex items-center gap-1 transition cursor-pointer ${
                                isExpanded
                                  ? "bg-teal-700 text-white shadow-2xs"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              }`}
                              title="Toggle inline account statement & ledger"
                            >
                              <History className="w-3 h-3" />
                              <span>History</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>

                            {/* Settle Payment */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCustId(c.id);
                                setShowPayModal(true);
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded transition cursor-pointer"
                              title="Record payment settlement"
                            >
                              Settle
                            </button>

                            {/* Edit Customer */}
                            <button
                              type="button"
                              onClick={() => openEditCustomerModal(c)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                              title="Edit Customer Profile"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Customer */}
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteCustomerTarget(c);
                                setDeleteCustError(null);
                              }}
                              className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Delete Customer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Inline Statement / Ledger Drawer */}
                      {isExpanded && (
                        <tr className="bg-teal-50/30">
                          <td colSpan={6} className="p-4 border-y border-teal-200/70">
                            <div className="bg-white rounded-xl border border-teal-200 p-4 space-y-4 shadow-sm">
                              {/* Header & Quick Actions */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                                    <h4 className="font-bold text-xs text-slate-900 tracking-tight">
                                      Official Account Statement & Ledger: {c.name} {c.code ? `(${c.code})` : ""}
                                    </h4>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Running balance ledger showing all remittance billings (debit) and payments recorded (credit).
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {ledgerData && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenThermalPrint(ledgerData)}
                                      className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                                      title="Print thermal statement receipt"
                                    >
                                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Print Thermal Statement</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCustId(c.id);
                                      setShowPayModal(true);
                                    }}
                                    className="px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5" />
                                    <span>+ Record Payment</span>
                                  </button>
                                </div>
                              </div>

                              {/* Ledger Content */}
                              {isLoadingThisLedger ? (
                                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                  <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                                  <span>Loading customer account ledger...</span>
                                </div>
                              ) : !ledgerData || ledgerData.entries?.length === 0 ? (
                                <div className="py-6 text-center text-xs text-slate-400">
                                  No statement transactions or payments recorded for this customer account yet.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {/* Metric Summary Ribbon */}
                                  <div className="grid grid-cols-3 gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs">
                                    <div>
                                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Volume</span>
                                      <span className="font-mono font-bold text-slate-900">
                                        ₹ {(ledgerData.customer?.total_inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Paid (AED)</span>
                                      <span className="font-mono font-bold text-teal-700">
                                        {(ledgerData.customer?.total_paid || 0).toFixed(3)} AED
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Balance (AED)</span>
                                      <span
                                        className={`font-mono font-bold ${
                                          (ledgerData.customer?.outstanding_balance || 0) > 0.001
                                            ? "text-rose-600"
                                            : "text-emerald-700"
                                        }`}
                                      >
                                        {(ledgerData.customer?.outstanding_balance || 0).toFixed(3)} AED
                                      </span>
                                    </div>
                                  </div>

                                  {/* Chronological Statement Entries */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase">
                                        <tr>
                                          <th className="py-2 px-3">Date</th>
                                          <th className="py-2 px-3">Type</th>
                                          <th className="py-2 px-3">Ref ID</th>
                                          <th className="py-2 px-3">Description</th>
                                          <th className="py-2 px-3 text-right">Debit (AED Billed)</th>
                                          <th className="py-2 px-3 text-right">Credit (AED Paid)</th>
                                          <th className="py-2 px-3 text-right">Running Balance (AED)</th>
                                          <th className="py-2 px-3 text-center">Action</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-medium">
                                        {ledgerData.entries.map((e, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50">
                                            <td className="py-2 px-3 text-slate-600">{e.date}</td>
                                            <td className="py-2 px-3">
                                              <span
                                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                  e.type === "TRANSACTION"
                                                    ? "bg-slate-100 text-slate-700"
                                                    : "bg-teal-100 text-teal-800"
                                                }`}
                                              >
                                                {e.type}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                              {e.reference}
                                            </td>
                                            <td className="py-2 px-3 text-slate-600 text-[11px] truncate max-w-xs">
                                              {e.description}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-900">
                                              {e.debit_aed > 0 ? `${e.debit_aed.toFixed(3)} AED` : "—"}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-teal-700">
                                              {e.credit_aed > 0 ? `${e.credit_aed.toFixed(3)} AED` : "—"}
                                            </td>
                                            <td
                                              className={`py-2 px-3 text-right font-mono font-bold ${
                                                e.running_balance_aed > 0.001
                                                  ? "text-rose-600"
                                                  : e.running_balance_aed < -0.001
                                                  ? "text-blue-600"
                                                  : "text-slate-700"
                                              }`}
                                            >
                                              {e.running_balance_aed.toFixed(3)} AED
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {e.type === "PAYMENT" && e.id ? (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setDeletingPaymentId(e.id!);
                                                    setDeletingPaymentCustId(c.id);
                                                  }}
                                                  className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                                  title="Delete payment record"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              ) : (
                                                <span className="text-slate-300 text-[10px]">—</span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Customer Payments History Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-700" />
            <h4 className="font-bold text-slate-900 text-sm">All Customer Payments History Ledger</h4>
            <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {filteredHistory.length} total
            </span>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search payments by customer, voucher..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Voucher #</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3 text-right">Amount (AED)</th>
                <th className="py-2.5 px-3">Notes</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loadingPayments ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-600 mb-2" />
                    <span>Loading payment history...</span>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No customer payment records found.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-600">{p.payment_date}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {p.payment_number || "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{p.customer_name}</div>
                      {p.customer_code && (
                        <div className="text-[10px] font-mono text-slate-500">{p.customer_code}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {p.payment_method || "CASH"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-700 whitespace-nowrap">
                      {Number(p.amount_aed).toFixed(3)} AED
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-xs">
                      {p.notes || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => {
                          setDeletingPaymentId(p.id);
                          setDeletingPaymentCustId(p.customer_id);
                        }}
                        className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="Delete payment record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD PAYMENT */}
      {/* ========================================================================= */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordPayment}
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-teal-700" />
                <span>Receive Customer Payment</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer</label>
              <select
                value={selectedCustId}
                onChange={(e) => setSelectedCustId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Due: {(c.outstanding_balance || 0).toFixed(3)} AED)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <input
                  type="text"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  placeholder="e.g. CASH, BANK, CHEQUE..."
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount Received (AED)
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 5000"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full text-sm font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Voucher</label>
              <input
                type="text"
                placeholder="Deposit slip / transfer reference"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPay}
                className="px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submittingPay ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD NEW CUSTOMER */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCustomer}
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-700" />
                <span>Register New Customer</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Al-Mansoor Trading"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Customer Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. AD-514"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full text-xs font-bold font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Default Rate
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="38.25"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-full text-xs font-bold font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="text"
                placeholder="+971 50 123 4567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingCustomer}
                className="px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {creatingCustomer ? "Registering..." : "Add Customer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT CUSTOMER */}
      {/* ========================================================================= */}
      {editCustomerTarget && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateCustomer}
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-teal-700" />
                <span>Edit Customer Profile</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditCustomerTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Customer Code
                </label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-full text-xs font-bold font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Default Rate
                </label>
                <input
                  type="number"
                  step="any"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  className="w-full text-xs font-bold font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditCustomerTarget(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editingCustomer}
                className="px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {editingCustomer ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CUSTOMER */}
      {/* ========================================================================= */}
      {deleteCustomerTarget && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Delete Customer Account</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete customer <strong>{deleteCustomerTarget.name}</strong>? This action cannot be undone if they have existing transactions.
            </p>
            {deleteCustError && (
              <p className="text-xs text-rose-600 font-medium">{deleteCustError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCustomerTarget(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={deletingCustomer}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                {deletingCustomer ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DELETE PAYMENT CONFIRMATION */}
      {/* ========================================================================= */}
      {deletingPaymentId && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Confirm Delete Payment</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete this payment record? This will reverse the credit on the customer&apos;s ledger.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setDeletingPaymentId(null);
                  setDeletingPaymentCustId(null);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePayment}
                disabled={isDeletingPayment}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                {isDeletingPayment ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: THERMAL STATEMENT RECEIPT PRINTER */}
      {/* ========================================================================= */}
      {showPrinterModal && printCustomerData && (
        <ReceiptPrinterModal
          isOpen={showPrinterModal}
          reportType="customer-statement"
          customerData={printCustomerData}
          onCompletePrint={() => setShowPrinterModal(false)}
          onClose={() => setShowPrinterModal(false)}
        />
      )}
    </div>
  );
}
