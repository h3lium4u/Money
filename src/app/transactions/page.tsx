"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { FadeIn, PageTransition } from "@/components/AnimatedLayout";
import { toast } from "sonner";
import {
  Search,
  PlusCircle,
  Clock,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Edit2,
  Calculator,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  FileText,
  Users,
  Coins,
  ChevronRight,
  ArrowRightLeft,
  Building2,
  X,
  Ban,
} from "lucide-react";
import { numberToIndianWords } from "@/lib/number-to-words";
import { generateTransactionReceipt } from "@/lib/pdf-generator";
import {
  getTodayDateString,
  getYesterdayDateString,
  getDaysAgoDateString,
  getStartOfMonthDateString,
} from "@/lib/date-utils";
import Breadcrumbs from "@/components/Breadcrumbs";

function DubaiClientTransactionsContent() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Quick preset filter
  const [timeFilter, setTimeFilter] = useState(searchParams.get("period") || "all");
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [selectedCustomer, setSelectedCustomer] = useState(searchParams.get("customer") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [fromDate, setFromDate] = useState(searchParams.get("from") || getTodayDateString());
  const [toDate, setToDate] = useState(searchParams.get("to") || getTodayDateString());

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    if (timeFilter && timeFilter !== "all") params.set("period", timeFilter);
    if (search) params.set("q", search);
    if (selectedCustomer) params.set("customer", selectedCustomer);
    if (statusFilter) params.set("status", statusFilter);
    if (fromDate && fromDate !== getTodayDateString()) params.set("from", fromDate);
    if (toDate && toDate !== getTodayDateString()) params.set("to", toDate);

    const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
    window.history.replaceState({}, "", newUrl);
  }, [timeFilter, search, selectedCustomer, statusFilter, fromDate, toDate]);

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
  const [editTotal, setEditTotal] = useState("");
  const [editManualRate, setEditManualRate] = useState("");
  const [editPaidAmount, setEditPaidAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editPreview, setEditPreview] = useState<any | null>(null);

  // Quick payment modal state
  const [payingTxn, setPayingTxn] = useState<any | null>(null);
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Payment Method");
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  function handleOpenPayModal(txn: any) {
    setPayingTxn(txn);
    setPayDate(getTodayDateString());
    setPayAmount(String(txn.balance_to_paid ?? txn.pending_aed ?? ""));
    setPayMethod("Payment Method");
    setPayNotes(`Payment for transfer ${txn.transaction_number}`);
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
      const endpoint = `/api/customers/${payingTxn.customer_id}/payments`;

      const res = await fetch(endpoint, {
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
      toast.success("Payment recorded successfully");
    } catch (err: any) {
      setPayError(err.message || "Failed to record payment");
      toast.error(err.message || "Failed to record payment");
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

  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  async function fetchMetadata() {
    try {
      const res = await fetch("/api/parties?type=DUBAI");
      const pData = await res.json();
      setClients(Array.isArray(pData) ? pData : []);
    } catch (err) {
      console.error(err);
      setClients([]);
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
        params.set("from", getDaysAgoDateString(7));
        params.set("to", todayStr);
      } else if (timeFilter === "month") {
        params.set("from", getStartOfMonthDateString());
        params.set("to", todayStr);
      } else if (timeFilter === "custom" && fromDate && toDate) {
        params.set("from", fromDate);
        params.set("to", toDate);
      }

      if (selectedCustomer) params.set("customerId", selectedCustomer);
      if (statusFilter) params.set("status", statusFilter);
      params.set("entityType", "PARTY");
      params.set("limit", "250");

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
    setEditTotal(String(t.total ?? t.inr_amount));
    setEditManualRate(String(t.manual_rate ?? t.customer_rate));
    setEditPaidAmount(String(t.paid_amount ?? t.paid_aed ?? "0"));
    setEditNotes(t.notes || "");
    setEditReason("");
    setEditError(null);
  }

  // Live calculation for edit modal
  useEffect(() => {
    if (!editingTxn) return;
    const total = parseFloat(editTotal);
    const mRate = parseFloat(editManualRate);
    const pAmt = parseFloat(editPaidAmount || "0");

    if (!total || total <= 0 || !mRate || mRate <= 0) {
      setEditPreview(null);
      return;
    }

    const wholesaleRate = Math.round((1000 / mRate) * 1000) / 1000;
    const inDhirams = Math.round(((total * mRate) / 1000) * 1000) / 1000;
    const paid = isNaN(pAmt) ? 0 : Math.round(pAmt * 1000) / 1000;
    const balanceToPaid = Math.round((inDhirams - paid) * 1000) / 1000;

    setEditPreview({
      total,
      manualRate: mRate,
      wholesaleRate,
      inDhirams,
      paidAmount: paid,
      balanceToPaid,
    });
  }, [editingTxn, editTotal, editManualRate, editPaidAmount]);

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
          total: parseFloat(editTotal),
          manual_rate: parseFloat(editManualRate),
          paid_amount: parseFloat(editPaidAmount || "0"),
          notes: editNotes || undefined,
          reason: editReason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEditingTxn(null);
      fetchTransactions();
      toast.success("Dubai Client transfer updated successfully");
    } catch (err: any) {
      setEditError(err.message || "Failed to update transaction");
      toast.error(err.message || "Failed to update transaction");
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
      toast.success("Transfer deleted permanently");
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete transaction");
      toast.error(err.message || "Failed to delete transaction");
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
        toast.success("Transfer voided successfully");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to void transfer");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to void transfer");
    } finally {
      setIsVoiding(false);
    }
  }

  const formatINR = (val?: number) =>
    `₹ ${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;

  const formatAED = (val?: number) =>
    `${(val || 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} AED`;

  // Strictly Dubai Client transfers: only Dubai parties (exclude normal customers and Indian parties)
  const filtered = transactions.filter((t) => {
    if (t.entity_type === "CUSTOMER") return false;
    if (t.party_type === "INDIA") return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.transaction_number.toLowerCase().includes(q) ||
      t.customer_name?.toLowerCase().includes(q) ||
      t.customer_code?.toLowerCase().includes(q) ||
      (t.notes && t.notes.toLowerCase().includes(q))
    );
  });

  // Authoritative Aggregate KPIs
  const confirmedTransfers = filtered.filter((t) => t.status === "CONFIRMED");
  const totalVolumeInr = confirmedTransfers.reduce(
    (sum, t) => sum + (t.total ?? t.inr_amount ?? 0),
    0
  );
  const totalInDhirams = confirmedTransfers.reduce(
    (sum, t) => sum + (t.in_dhirams ?? t.aed_amount ?? 0),
    0
  );
  const totalPaidAed = confirmedTransfers.reduce(
    (sum, t) => sum + (t.paid_amount ?? t.paid_aed ?? 0),
    0
  );
  const totalBalanceDue = confirmedTransfers.reduce(
    (sum, t) => sum + (t.balance_to_paid ?? t.pending_aed ?? 0),
    0
  );

  // Cumulative Daily Balance calculation (Formula from Excel INDIA DISTRIBUTION: Daily Balance = Balance to be Paid + Previous Day's Daily Balance)
  const clientRunningBalances: Record<string, number> = {};
  const dailyBalanceMap = new Map<string, number>();

  // Sort chronological ascending (oldest first) to accumulate running balance per client
  const chronological = [...filtered]
    .filter((t) => t.status === "CONFIRMED")
    .sort((a, b) => {
      const cmp = (a.transaction_date || "").localeCompare(b.transaction_date || "");
      if (cmp !== 0) return cmp;
      return (a.created_at || "").localeCompare(b.created_at || "");
    });

  chronological.forEach((t) => {
    const cId = t.customer_id;
    const inDhiramsVal = t.in_dhirams ?? t.aed_amount ?? 0;
    const paidAmountVal = t.paid_amount ?? t.paid_aed ?? 0;
    const balanceToPaidVal = t.balance_to_paid ?? (inDhiramsVal - paidAmountVal);

    const prevBal = clientRunningBalances[cId] || 0;
    const newDailyBal = Math.round((prevBal + balanceToPaidVal + Number.EPSILON) * 1000) / 1000;
    clientRunningBalances[cId] = newDailyBal;
    dailyBalanceMap.set(t.id, newDailyBal);
  });

  const totalClosingDailyBalance = Math.round(
    (Object.values(clientRunningBalances).reduce((sum, val) => sum + val, 0) + Number.EPSILON) * 1000
  ) / 1000;

  return (
    <PageTransition>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Coins className="w-5 h-5 text-teal-700" />
              <span>Dubai Client</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative Dubai client transfers and settlement registry.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/transactions/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800 shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ New Dubai Client Transfer</span>
            </Link>
            <Link
              href="/api/reports/export-excel"
              className="inline-flex items-center gap-2 px-3 py-2 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>Download Excel</span>
            </Link>
          </div>
        </div>

        {/* Module Separation Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-xl shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <Building2 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Dubai Client Transfers
            </span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] hidden sm:inline">
              Strictly Dubai parties (HAJA, SARAB, NF2). Normal customer remittances are displayed separately.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/remittances"
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-900 hover:underline inline-flex items-center gap-1"
            >
              <span>Customer Remittances</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <Link
              href="/party-transfers"
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-900 hover:underline inline-flex items-center gap-1"
            >
              <span>Party Transfers (IND)</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 5 Key Financial Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Total Volume INR */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Total Volume (INR)
            </span>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              {formatINR(totalVolumeInr)}
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">
              Confirmed Transfers: {confirmedTransfers.length}
            </span>
          </div>

          {/* Card 2: Total In Dhirams */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-teal-200/90 dark:border-teal-800 shadow-2xs space-y-1 bg-teal-50/20 dark:bg-teal-950/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 block">
              Total In Dhirams (AED)
            </span>
            <div className="text-base sm:text-lg font-black text-teal-900 dark:text-teal-100 font-mono tracking-tight">
              {formatAED(totalInDhirams)}
            </div>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 block font-medium">
              = Total / Wholesale Rate
            </span>
          </div>

          {/* Card 3: Total Paid Amount */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Total Paid Amount (AED)
            </span>
            <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono tracking-tight">
              {formatAED(totalPaidAed)}
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">
              Settled Collections
            </span>
          </div>

          {/* Card 4: Balance to Paid */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-amber-200/90 dark:border-amber-800 shadow-2xs space-y-1 bg-amber-50/20 dark:bg-amber-950/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
              Balance to Paid (AED)
            </span>
            <div className={`text-base sm:text-lg font-black font-mono tracking-tight ${
              totalBalanceDue > 0 ? "text-amber-800 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-400"
            }`}>
              {formatAED(totalBalanceDue)}
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-medium">
              = In Dhirams - Paid Amount
            </span>
          </div>

          {/* Card 5: Daily Balance (Cumulative) */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-blue-200/90 dark:border-blue-800 shadow-2xs space-y-1 bg-blue-50/20 dark:bg-blue-950/20 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
              Daily Balance (AED)
            </span>
            <div className={`text-base sm:text-lg font-black font-mono tracking-tight ${
              totalClosingDailyBalance > 0 ? "text-blue-900 dark:text-blue-200" : totalClosingDailyBalance < 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
            }`}>
              {formatAED(totalClosingDailyBalance)}
            </div>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 block font-medium">
              = +Today + Prev Bal
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <FadeIn delay={0.1}>
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            {/* Quick Time Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mr-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" /> Date:
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeFilter === item.id
                      ? "bg-[#0F766E] text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Search & Dropdown Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search ID, client, notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="">All Dubai Clients ({clients.length})</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-teal-500 focus:outline-none"
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
                    className="w-full text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-1.5 text-slate-700 dark:text-slate-200"
                  />
                  <span className="text-slate-400 text-xs">➔</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-1.5 text-slate-700 dark:text-slate-200"
                  />
                </div>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Dubai Client Registry Table */}
        <FadeIn delay={0.2}>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="w-full">
              <table className="w-full text-left text-xs table-fixed">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 text-[10px]">
                  <tr>
                    <th className="px-2.5 py-3 w-[8%]">Date</th>
                    <th className="px-2.5 py-3 w-[11%]">Dubai Client</th>
                    <th className="px-2.5 py-3 w-[11%]">Total (INR)</th>
                    <th className="px-2.5 py-3 w-[8%]">Client Rate</th>
                    <th className="px-2.5 py-3 w-[8%]">Wholesale Rate</th>
                    <th className="px-2.5 py-3 w-[10%]">In Dhirams</th>
                    <th className="px-2.5 py-3 w-[10%]">Paid Amount</th>
                    <th className="px-2.5 py-3 w-[11%]">Balance to Paid</th>
                    <th className="px-2.5 py-3 w-[11%]">Daily Balance</th>
                    <th className="px-2.5 py-3 text-right w-[12%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-700" />
                        <span>Loading Dubai Client transfers...</span>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Coins className="w-8 h-8 text-slate-300" />
                          <p className="text-sm font-semibold text-slate-600">No Dubai Client transfers found</p>
                          <Link
                            href="/transactions/new"
                            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            + New Transfer
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t) => {
                      const totalVal = t.total ?? t.inr_amount ?? 0;
                      const manualRateVal = t.manual_rate ?? t.customer_rate ?? 0;
                      const wholesaleRateVal =
                        t.wholesale_rate ?? (manualRateVal > 0 ? 1000 / manualRateVal : 0);
                      const inDhiramsVal = t.in_dhirams ?? t.aed_amount ?? 0;
                      const paidAmountVal = t.paid_amount ?? t.paid_aed ?? 0;
                      const balanceToPaidVal =
                        t.balance_to_paid ?? (inDhiramsVal - paidAmountVal);
                      const dailyBalanceVal =
                        dailyBalanceMap.get(t.id) ?? balanceToPaidVal;

                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            t.status === "VOIDED" ? "opacity-60 bg-slate-50/40 dark:bg-slate-900/40" : ""
                          }`}
                        >
                          {/* 1. Date */}
                          <td className="px-2.5 py-2.5 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                {t.transaction_date}
                              </span>
                              {t.status === "VOIDED" && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                  Voided
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate" title={t.transaction_number}>
                              {t.transaction_number}
                            </div>
                          </td>

                          {/* 2. Dubai Client */}
                          <td className="px-2.5 py-2.5">
                            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-xs truncate">
                              <Building2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                              <span className="truncate" title={t.customer_name}>
                                {t.customer_name}
                              </span>
                            </div>
                            {t.customer_code &&
                              t.customer_code.trim().toUpperCase() !==
                                t.customer_name?.trim().toUpperCase() && (
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                  {t.customer_code}
                                </div>
                              )}
                          </td>

                          {/* 3. Total (INR) */}
                          <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                              {formatINR(totalVal)}
                            </div>
                          </td>

                          {/* 4. Manual Rate Value */}
                          <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">
                            <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                              {Number(manualRateVal).toFixed(3)}
                            </div>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500">AED/1000</span>
                          </td>

                          {/* 5. Whole Sale Rate */}
                          <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">
                            <div className="font-bold text-teal-700 dark:text-teal-400 text-xs">
                              {Number(wholesaleRateVal).toFixed(3)}
                            </div>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500">= 1000/Rate</span>
                          </td>

                          {/* 6. In Dhirams */}
                          <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">
                            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                              {formatAED(inDhiramsVal)}
                            </div>
                          </td>

                          {/* 7. Paid Amount */}
                          <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">
                            <div className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                              {formatAED(paidAmountVal)}
                            </div>
                          </td>

                          {/* 8. Balance to Paid */}
                          <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">
                            <div className={`font-bold text-xs ${
                              balanceToPaidVal > 0 ? "text-amber-700 dark:text-amber-400 font-extrabold" : balanceToPaidVal < 0 ? "text-rose-700 dark:text-rose-400 font-extrabold" : "text-emerald-700 dark:text-emerald-400"
                            }`}>
                              {formatAED(balanceToPaidVal)}
                            </div>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500">= In Dhirams - Paid</span>
                          </td>

                          {/* 9. Daily Balance */}
                          <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">
                            <div className={`font-bold text-xs ${
                              dailyBalanceVal > 0 ? "text-blue-900 dark:text-blue-300 font-extrabold" : dailyBalanceVal < 0 ? "text-rose-700 dark:text-rose-400 font-extrabold" : "text-emerald-700 dark:text-emerald-400 font-bold"
                            }`}>
                              {formatAED(dailyBalanceVal)}
                            </div>
                            <span className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold">= +Today + Prev Bal</span>
                          </td>

                          {/* 10. Actions */}
                          <td className="px-2.5 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5 shrink-0">
                              {/* Quick Pay */}
                              {t.status === "CONFIRMED" && balanceToPaidVal > 0 && (
                                <button
                                  onClick={() => handleOpenPayModal(t)}
                                  title="Record Payment in AED"
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-300 px-2 py-1 rounded shadow-2xs transition-colors shrink-0"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  <span>+ Pay</span>
                                </button>
                              )}

                              {/* Receipt */}
                              <button
                                onClick={() => generateTransactionReceipt(t)}
                                title="Download PDF Receipt"
                                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => handleOpenEdit(t)}
                                title="Edit Transfer"
                                className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Void */}
                              {t.status === "CONFIRMED" && (
                                <button
                                  onClick={() => {
                                    setVoidingTxn(t);
                                    setVoidReason("");
                                  }}
                                  title="Void Transfer"
                                  className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => {
                                  setDeletingTxn(t);
                                  setDeleteError(null);
                                }}
                                title="Permanently Delete Transfer"
                                className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>

        {/* EDIT TRANSACTION MODAL */}
        {editingTxn && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-teal-700" />
                    <span>Edit Dubai Client Transfer</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    {editingTxn.transaction_number}
                  </span>
                </div>
                <button
                  onClick={() => setEditingTxn(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  <X className="w-5 h-5" />
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
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Dubai Client
                    </label>
                    <select
                      value={editCustomerId}
                      onChange={(e) => setEditCustomerId(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.code ? `(${c.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Total (INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={editTotal}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/,/g, "");
                        if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
                          setEditTotal(clean);
                        }
                      }}
                      className="w-full text-sm font-bold pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Client Exchange Rate
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={editManualRate}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/,/g, "");
                        if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
                          setEditManualRate(clean);
                        }
                      }}
                      className="w-full text-xs font-bold font-mono border border-slate-300 rounded-lg p-2 text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400">AED / 1000 INR</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Paid Amount (AED)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editPaidAmount}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/,/g, "");
                        if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
                          setEditPaidAmount(clean);
                        }
                      }}
                      className="w-full text-xs font-bold font-mono border border-slate-300 rounded-lg p-2 text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400">Advance / Cash</span>
                  </div>
                </div>

                {/* Calculation Output Card */}
                {editPreview && (
                  <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-xs space-y-1.5 font-medium">
                    <div className="flex justify-between">
                      <span className="text-teal-800">Whole Sale Rate (=1000/Rate):</span>
                      <span className="font-mono font-bold text-teal-900">{editPreview.wholesaleRate.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-teal-900">In Dhirams (=Total/Wholesale):</span>
                      <span className="font-mono text-teal-900">AED {editPreview.inDhirams.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Paid Amount:</span>
                      <span className="font-mono text-slate-800">AED {editPreview.paidAmount.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1 border-t border-teal-200 text-amber-800">
                      <span>Balance to Paid:</span>
                      <span className="font-mono">AED {editPreview.balanceToPaid.toFixed(3)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Reason for Edit *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Corrected client exchange rate or order total"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingTxn(null)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-4 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QUICK PAYMENT MODAL */}
        {payingTxn && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-teal-700" />
                    <span>Record Client Payment</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {payingTxn.customer_name} • {payingTxn.transaction_number}
                  </span>
                </div>
                <button
                  onClick={() => setPayingTxn(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {payError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{payError}</span>
                </div>
              )}

              <form onSubmit={handleSavePayment} className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Pending Balance:</span>
                  <span className="font-mono font-bold text-amber-700 text-sm">
                    {formatAED(payingTxn.balance_to_paid ?? payingTxn.pending_aed)}
                  </span>
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
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Amount (AED) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <input
                    type="text"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    placeholder="Payment Method"
                    className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPayingTxn(null)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={payLoading}
                    className="px-4 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {payLoading ? "Recording..." : "Record Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VOID MODAL */}
        {voidingTxn && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Void Dubai Client Transfer?</span>
              </h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to void transfer{" "}
                <span className="font-mono font-bold text-slate-900">
                  {voidingTxn.transaction_number}
                </span>
                ? This marks the transfer inactive while preserving audit history.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Reason for Void *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Client requested cancellation"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setVoidingTxn(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmVoid}
                  disabled={isVoiding}
                  className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isVoiding ? "Voiding..." : "Confirm Void"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE MODAL */}
        {deletingTxn && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
              <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <span>Permanently Delete Transfer?</span>
              </h3>
              <p className="text-xs text-slate-600">
                This action cannot be undone. Transfer{" "}
                <span className="font-mono font-bold text-slate-900">
                  {deletingTxn.transaction_number}
                </span>{" "}
                and associated ledger records will be deleted.
              </p>
              {deleteError && (
                <p className="text-xs text-rose-600 font-semibold">{deleteError}</p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeletingTxn(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default function DubaiClientPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400">
          Loading Dubai Client Transfers...
        </div>
      }
    >
      <DubaiClientTransactionsContent />
    </Suspense>
  );
}
