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
  Trash2,
  AlertTriangle,
  Edit2,
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
  Split,
} from "lucide-react";
import { numberToIndianWords } from "@/lib/number-to-words";
import { generateTransactionReceipt } from "@/lib/pdf-generator";
import {
  getTodayDateString,
  getYesterdayDateString,
  getDaysAgoDateString,
  getStartOfMonthDateString,
} from "@/lib/date-utils";

function CustomerRemittancesContent() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
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
  const [editInr, setEditInr] = useState("");
  const [editCustRate, setEditCustRate] = useState("");
  const [editPaidAmount, setEditPaidAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // India Parties & Splits editing state
  const [indiaParties, setIndiaParties] = useState<any[]>([]);
  const [editSplits, setEditSplits] = useState<Array<{ id: string; distributor_id: string; inr_amount: string; notes?: string; deduct_prior?: boolean }>>([]);
  const [loadingEditSplits, setLoadingEditSplits] = useState(false);
  const [priorTransfersMap, setPriorTransfersMap] = useState<Record<string, any>>({});

  // Quick payment modal state
  const [payingTxn, setPayingTxn] = useState<any | null>(null);
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  function handleOpenPayModal(txn: any) {
    setPayingTxn(txn);
    setPayDate(getTodayDateString());
    setPayAmount(String(txn.pending_aed ?? txn.aed_amount ?? ""));
    setPayMethod("CASH");
    setPayNotes(`Payment for remittance ${txn.transaction_number}`);
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
      const [cRes, dRes, pRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/distributors?group=IND"),
        fetch("/api/parties/prior-transfers"),
      ]);
      const cData = await cRes.json();
      const dData = await dRes.json();
      const pData = await pRes.json().catch(() => ({}));
      setCustomers(Array.isArray(cData) ? cData : []);
      setIndiaParties(Array.isArray(dData) ? dData : []);
      if (pData && pData.summaries) {
        setPriorTransfersMap(pData.summaries);
      }
    } catch (err) {
      console.error(err);
      setCustomers([]);
      setIndiaParties([]);
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
      params.set("entityType", "CUSTOMER");
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

  async function handleOpenEdit(t: any) {
    setEditingTxn(t);
    setEditDate(t.transaction_date);
    setEditCustomerId(t.customer_id);
    setEditInr(String(t.inr_amount));
    setEditCustRate(String(t.customer_rate));
    setEditPaidAmount(String(t.paid_aed ?? "0"));
    setEditNotes(t.notes || "");
    setEditReason("");
    setEditError(null);
    setLoadingEditSplits(true);

    try {
      const res = await fetch(`/api/distribution-splits?transaction_id=${t.id}`);
      const splitsData = await res.json();
      if (Array.isArray(splitsData) && splitsData.length > 0) {
        setEditSplits(
          splitsData.map((s: any) => ({
            id: s.id,
            distributor_id: s.distributor_id,
            inr_amount: String(s.inr_amount),
            notes: s.notes || "",
          }))
        );
      } else {
        setEditSplits([
          {
            id: `new-${Date.now()}`,
            distributor_id: indiaParties[0]?.id || "",
            inr_amount: String(t.inr_amount),
            notes: "",
          },
        ]);
      }
    } catch (err) {
      console.error(err);
      setEditSplits([
        {
          id: `new-${Date.now()}`,
          distributor_id: indiaParties[0]?.id || "",
          inr_amount: String(t.inr_amount),
          notes: "",
        },
      ]);
    } finally {
      setLoadingEditSplits(false);
    }
  }

  function handleAddEditSplit() {
    if (indiaParties.length === 0) return;
    const currentOrder = parseFloat(editInr) || 0;
    const currentAllocated = editSplits.reduce((sum, s) => sum + (parseFloat(s.inr_amount) || 0), 0);
    const rem = Math.max(0, currentOrder - currentAllocated);
    const usedDistIds = new Set(editSplits.map((s) => s.distributor_id));
    const nextParty = indiaParties.find((p) => !usedDistIds.has(p.id)) || indiaParties[0];

    setEditSplits((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        distributor_id: nextParty.id,
        inr_amount: rem > 0 ? String(rem) : "",
      },
    ]);
  }

  function handleRemoveEditSplit(index: number) {
    if (editSplits.length <= 1) return;
    setEditSplits((prev) => prev.filter((_, i) => i !== index));
  }

  function handleEditSplitPartyChange(index: number, distId: string) {
    setEditSplits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], distributor_id: distId };
      return next;
    });
  }

  function handleEditSplitAmountChange(index: number, amount: string) {
    const clean = amount.replace(/,/g, "");
    if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
      setEditSplits((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], inr_amount: clean };
        return next;
      });
    }
  }

  function handleAllocateEditRemaining(index: number) {
    const currentOrder = parseFloat(editInr) || 0;
    const otherAllocated = editSplits.reduce(
      (sum, s, i) => (i === index ? sum : sum + (parseFloat(s.inr_amount) || 0)),
      0
    );
    const rem = Math.max(0, currentOrder - otherAllocated);
    handleEditSplitAmountChange(index, String(rem));
  }

  function handleEditSplitDeductPrior(index: number, deduct: boolean) {
    setEditSplits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], deduct_prior: deduct };
      return next;
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTxn) return;

    const parsedEditInr = parseFloat(editInr);
    if (!parsedEditInr || parsedEditInr <= 0) {
      setEditError("Please enter a valid order amount");
      return;
    }

    const totalEditSplits = editSplits.reduce((sum, s) => sum + (parseFloat(s.inr_amount) || 0), 0);
    if (editSplits.length === 0) {
      setEditError("Distribution split is mandatory. At least one party must be allocated.");
      return;
    }
    for (let i = 0; i < editSplits.length; i++) {
      const s = editSplits[i];
      if (!s.distributor_id) {
        setEditError(`Please select an India party for split line #${i + 1}`);
        return;
      }
      const amt = parseFloat(s.inr_amount);
      if (!amt || amt <= 0) {
        setEditError(`Please enter a valid amount (> 0) for split line #${i + 1}`);
        return;
      }
    }
    if (Math.abs(parsedEditInr - totalEditSplits) >= 0.001) {
      setEditError(
        `Total splits (₹${totalEditSplits.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}) must equal order amount (₹${parsedEditInr.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}). Difference: ₹${Math.abs(parsedEditInr - totalEditSplits).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}.`
      );
      return;
    }

    setIsUpdating(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/transactions/${editingTxn.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: editDate,
          customer_id: editCustomerId,
          inr_amount: parsedEditInr,
          customer_rate: parseFloat(editCustRate),
          paid_amount: parseFloat(editPaidAmount || "0"),
          notes: editNotes || undefined,
          reason: editReason || undefined,
          splits: (() => {
            const remainingPriorTracker: Record<string, number> = {};
            return editSplits.map((s) => {
              const splitAmt = parseFloat(s.inr_amount);
              const pInfo = priorTransfersMap[s.distributor_id];
              const shouldDeduct = s.deduct_prior === true;

              if (!pInfo || !pInfo.hasPriorTransfers || !shouldDeduct) {
                let noteText = s.notes || "";
                if (pInfo && pInfo.hasPriorTransfers && !shouldDeduct) {
                  const keepNote = `[Prior advance of ₹${pInfo.availablePriorBalanceInr.toLocaleString("en-IN")} kept as-is (untouched); Full ₹${splitAmt.toLocaleString("en-IN")} payable separately]`;
                  noteText = noteText ? `${noteText} • ${keepNote}` : keepNote;
                }
                return {
                  id: s.id.startsWith("new-") ? undefined : s.id,
                  distributor_id: s.distributor_id,
                  inr_amount: splitAmt,
                  paid_amount_inr: 0,
                  balance_inr: splitAmt,
                  notes: noteText || undefined,
                };
              }

              const partyKey = pInfo.partyCode || s.distributor_id;
              const currentPriorAvail = remainingPriorTracker[partyKey] !== undefined
                ? remainingPriorTracker[partyKey]
                : pInfo.availablePriorBalanceInr;

              const paidInr = Math.min(splitAmt, currentPriorAvail);
              const balanceInr = Math.max(0, splitAmt - paidInr);
              remainingPriorTracker[partyKey] = Math.max(0, currentPriorAvail - paidInr);

              let noteText = s.notes || "";
              if (paidInr > 0) {
                const offsetNote = `[Offset ₹${paidInr.toLocaleString("en-IN")} from prior transfer; Remaining to pay: ₹${balanceInr.toLocaleString("en-IN")}]`;
                noteText = noteText ? `${noteText} • ${offsetNote}` : offsetNote;
              }

              return {
                id: s.id.startsWith("new-") ? undefined : s.id,
                distributor_id: s.distributor_id,
                inr_amount: splitAmt,
                paid_amount_inr: paidInr,
                balance_inr: balanceInr,
                notes: noteText || undefined,
              };
            });
          })(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEditingTxn(null);
      fetchTransactions();
      toast.success("Customer remittance and party splits updated successfully");
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
      toast.success("Remittance deleted permanently");
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
        body: JSON.stringify({ reason: voidReason || "User voided remittance" }),
      });
      if (res.ok) {
        setVoidingTxn(null);
        setVoidReason("");
        fetchTransactions();
        toast.success("Remittance voided successfully");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to void remittance");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to void remittance");
    } finally {
      setIsVoiding(false);
    }
  }

  const formatINR = (val?: number) =>
    `₹ ${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;

  const formatAED = (val?: number) =>
    `${(val || 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} AED`;

  // Strictly customer remittances: only entity_type === 'CUSTOMER'
  const filtered = transactions.filter((t) => {
    if (t.entity_type === "PARTY") return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.transaction_number.toLowerCase().includes(q) ||
      t.customer_name?.toLowerCase().includes(q) ||
      t.customer_code?.toLowerCase().includes(q) ||
      (t.notes && t.notes.toLowerCase().includes(q))
    );
  });

  const confirmed = filtered.filter((t) => t.status === "CONFIRMED");
  const totalVolumeInr = confirmed.reduce((sum, t) => sum + (t.inr_amount || 0), 0);
  const totalInvoicedAed = confirmed.reduce((sum, t) => sum + (t.aed_amount || 0), 0);
  const totalPaidAed = confirmed.reduce((sum, t) => sum + (t.paid_aed || 0), 0);
  const totalDueAed = confirmed.reduce((sum, t) => sum + (t.pending_aed || 0), 0);

  return (
    <PageTransition>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-700" />
              <span>Customer Remittances</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative registry of retail customer remittance transfers (kept strictly separate from parties).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/remittances/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800 shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ New Customer Remittance</span>
            </Link>
            <Link
              href="/receivables"
              className="inline-flex items-center gap-2 px-3 py-2 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <Users className="w-4 h-4 text-teal-700" />
              <span>Receivables & Dues</span>
            </Link>
          </div>
        </div>

        {/* Module Separation Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 border border-slate-200/80 p-3 rounded-xl shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Users className="w-4 h-4 text-teal-700 shrink-0" />
            <span className="font-semibold text-slate-900">
              Customer Remittances Module
            </span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-slate-500 text-[11px] hidden sm:inline">
              Retail customers only. Dubai parties and Indian settlement parties are displayed separately.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/transactions"
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline inline-flex items-center gap-1"
            >
              <span>Dubai Client Transfers</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              href="/party-transfers"
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline inline-flex items-center gap-1"
            >
              <span>Party Transfers (IND)</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 Financial Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Total Volume (INR)
            </span>
            <div className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight">
              {formatINR(totalVolumeInr)}
            </div>
            <span className="text-[10px] text-slate-400 block font-medium">
              Confirmed Transfers: {confirmed.length}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-teal-200/90 shadow-2xs space-y-1 bg-teal-50/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block">
              Total Invoiced (AED)
            </span>
            <div className="text-base sm:text-lg font-black text-teal-900 font-mono tracking-tight">
              {formatAED(totalInvoicedAed)}
            </div>
            <span className="text-[10px] text-teal-600 block font-medium">
              Charged to Retail Customers
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Collected Payments
            </span>
            <div className="text-base sm:text-lg font-black text-emerald-700 font-mono tracking-tight">
              {formatAED(totalPaidAed)}
            </div>
            <span className="text-[10px] text-emerald-600 block font-medium">
              Recorded Customer Cash/Bank
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-amber-200/90 shadow-2xs space-y-1 bg-amber-50/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
              Outstanding Due (AED)
            </span>
            <div className={`text-base sm:text-lg font-black font-mono tracking-tight ${
              totalDueAed > 0 ? "text-amber-800" : "text-emerald-700"
            }`}>
              {formatAED(totalDueAed)}
            </div>
            <span className="text-[10px] text-amber-600 block font-medium">
              Pending Customer Dues
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <FadeIn delay={0.1}>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-teal-700" /> Date:
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
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search ID, customer, notes..."
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
                  <option value="">All Retail Customers ({customers.length})</option>
                  {customers.map((c) => (
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
        </FadeIn>

        {/* Customer Remittances Table */}
        <FadeIn delay={0.2}>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[1100px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 text-[10px]">
                  <tr>
                    <th className="px-3.5 py-3 w-[15%]">Txn ID / Date</th>
                    <th className="px-3.5 py-3 w-[16%]">Customer</th>
                    <th className="px-3.5 py-3 w-[16%]">INR Amount</th>
                    <th className="px-3.5 py-3 w-[10%]">Rate</th>
                    <th className="px-3.5 py-3 w-[12%]">AED Billed</th>
                    <th className="px-3.5 py-3 w-[16%]">Payment Status</th>
                    <th className="px-3.5 py-3 text-right w-[15%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-700 dark:text-teal-400" />
                        <span>Loading customer remittances...</span>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No customer remittances recorded</p>
                          <Link
                            href="/remittances/new"
                            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            + New Remittance
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t) => (
                      <tr
                        key={t.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          t.status === "VOIDED" ? "opacity-60 bg-slate-50/40 dark:bg-slate-900/40" : ""
                        }`}
                      >
                        <td className="px-3.5 py-2.5 font-mono">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {t.transaction_number}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {t.transaction_date}
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5">
                          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-xs truncate">
                            <Users className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                            <Link
                              href={`/customers/${t.customer_id}`}
                              className="hover:underline truncate"
                              title={t.customer_name}
                            >
                              {t.customer_name}
                            </Link>
                          </div>
                          {t.customer_code && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                              {t.customer_code}
                            </div>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5 font-mono whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {formatINR(t.inr_amount)}
                          </div>
                          {t.distributor_split_details && t.distributor_split_details !== "-" ? (
                            <div
                              className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold font-sans mt-0.5 truncate flex items-center gap-1"
                              title={t.distributor_split_details}
                            >
                              <Split className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400 shrink-0" />
                              <span className="truncate max-w-[160px]">{t.distributor_split_details}</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-sans mt-0.5">
                              No party split
                            </div>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5 font-mono whitespace-nowrap">
                          <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                            {Number(t.customer_rate).toFixed(3)}
                          </div>
                          <span className="text-[9px] text-slate-400">AED/1000</span>
                        </td>

                        <td className="px-3.5 py-2.5 font-mono whitespace-nowrap">
                          <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                            {formatAED(t.aed_amount)}
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5">
                          {(t.paid_aed || 0) >= t.aed_amount ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-md">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Paid in Full</span>
                            </span>
                          ) : (t.paid_aed || 0) > 0 ? (
                            <div className="inline-flex flex-col gap-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2 py-1 rounded-md font-mono whitespace-nowrap">
                              <span className="text-slate-600 dark:text-slate-400 text-[9px]">Paid: {formatAED(t.paid_aed)}</span>
                              <span className="text-rose-700 dark:text-rose-400 font-bold">Due: {formatAED(t.pending_aed)}</span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col gap-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md font-mono whitespace-nowrap">
                              <span className="text-slate-500 dark:text-slate-400 text-[9px] uppercase tracking-wider font-sans font-bold">Unpaid</span>
                              <span className="text-rose-700 dark:text-rose-400 font-bold">Due: {formatAED(t.aed_amount)}</span>
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {t.status === "CONFIRMED" && (t.pending_aed === undefined || t.pending_aed > 0) && (
                              <button
                                onClick={() => handleOpenPayModal(t)}
                                title="Record Payment"
                                className="flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-300 px-2 py-1 rounded shadow-2xs transition-colors"
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>+ Pay</span>
                              </button>
                            )}

                            <button
                              onClick={() => generateTransactionReceipt(t)}
                              title="Download Receipt (PDF)"
                              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleOpenEdit(t)}
                              title="Edit Transfer"
                              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {t.status === "CONFIRMED" && (
                              <button
                                onClick={() => {
                                  setVoidingTxn(t);
                                  setVoidReason("");
                                }}
                                title="Void Transfer"
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                              >
                                Void
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setDeletingTxn(t);
                                setDeleteError(null);
                              }}
                              title="Delete Transfer"
                              className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50"
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
        </FadeIn>

        {/* EDIT MODAL */}
        {editingTxn && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-teal-700" />
                  <span>Edit Customer Remittance</span>
                </h3>
                <button onClick={() => setEditingTxn(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editError && (
                <p className="text-xs text-rose-600 font-semibold">{editError}</p>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Customer</label>
                    <select
                      value={editCustomerId}
                      onChange={(e) => setEditCustomerId(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.code ? `(${c.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">INR Amount</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={editInr}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/,/g, "");
                        if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
                          setEditInr(clean);
                        }
                      }}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Customer Rate</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={editCustRate}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/,/g, "");
                        if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
                          setEditCustRate(clean);
                        }
                      }}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Paid Amount (AED)</label>
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
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                  />
                </div>

                {/* Mandatory India Party Splits Editing */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                        <Split className="w-3.5 h-3.5 text-teal-700" />
                        <span>India Party Splits</span>
                        <span className="text-rose-600 font-extrabold text-[10px]">* (MANDATORY)</span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Choose different party or adjust amounts to match order total.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddEditSplit}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-1 rounded shadow-2xs transition cursor-pointer"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>+ Add Split</span>
                    </button>
                  </div>

                  {loadingEditSplits ? (
                    <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-teal-700" />
                      <span>Loading party splits...</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {editSplits.map((s, idx) => (
                        <div
                          key={s.id}
                          className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                            <span>Party Split #{idx + 1}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAllocateEditRemaining(idx)}
                                className="text-teal-700 hover:underline cursor-pointer"
                              >
                                Fill Remaining
                              </button>
                              {editSplits.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditSplit(idx)}
                                  className="text-rose-600 hover:text-rose-800 cursor-pointer"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <select
                                required
                                value={s.distributor_id}
                                onChange={(e) => handleEditSplitPartyChange(idx, e.target.value)}
                                className="w-full text-xs font-bold border border-slate-300 rounded p-1.5 text-slate-900 bg-white"
                              >
                                <option value="">-- Choose Party --</option>
                                {indiaParties.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} {p.code ? `(${p.code})` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-xs">₹</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                required
                                placeholder="Amount"
                                value={s.inr_amount}
                                onChange={(e) => handleEditSplitAmountChange(idx, e.target.value)}
                                className="w-full text-xs font-bold font-mono pl-5 pr-2 py-1.5 border border-slate-300 rounded text-slate-900 bg-white"
                              />
                            </div>
                          </div>

                          {/* Prior Transfer Offset & Decision Card for this party if available */}
                          {(() => {
                            const partyInfo = priorTransfersMap[s.distributor_id];
                            if (!partyInfo || !partyInfo.hasPriorTransfers || partyInfo.availablePriorBalanceInr <= 0) {
                              return null;
                            }

                            const splitInr = parseFloat(s.inr_amount) || 0;
                            const priorAvailable = partyInfo.availablePriorBalanceInr;
                            const isSplitEntered = splitInr > 0;
                            const isDeducting = s.deduct_prior === true;
                            const remainingToGive = Math.max(0, splitInr - priorAvailable);
                            const remainingPriorBalance = Math.max(0, priorAvailable - splitInr);
                            const isExactMatch = isSplitEntered && Math.abs(splitInr - priorAvailable) < 0.01;

                            return (
                              <div className="p-2.5 rounded-lg bg-gradient-to-r from-amber-50/90 to-teal-50/60 border border-amber-300 text-[11px] space-y-2">
                                <div className="flex justify-between items-center text-amber-900 font-bold border-b border-amber-200/80 pb-1.5">
                                  <span>Prior Advance Available: ₹{priorAvailable.toLocaleString("en-IN")}</span>
                                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono">
                                    Pre-paid to {partyInfo.partyName}
                                  </span>
                                </div>

                                {/* Decision Buttons */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-0.5">
                                  <span className="text-[10px] font-bold text-slate-700">Advance Treatment:</span>
                                  <div className="inline-flex rounded-lg p-0.5 bg-white border border-slate-300 shadow-xs">
                                    <button
                                      type="button"
                                      onClick={() => handleEditSplitDeductPrior(idx, true)}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                        isDeducting
                                          ? "bg-[#0F766E] text-white shadow-xs"
                                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                      }`}
                                    >
                                      <span>⚡</span> Proceed with Reduced Amount {isDeducting && "✓"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleEditSplitDeductPrior(idx, false)}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                        !isDeducting
                                          ? "bg-slate-800 text-white shadow-xs"
                                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                      }`}
                                    >
                                      <span>🛡️</span> Keep Prior Amount As It Is {!isDeducting && "✓"}
                                    </button>
                                  </div>
                                </div>

                                {isSplitEntered ? (
                                  <div className="space-y-1 pt-1">
                                    {isDeducting ? (
                                      <>
                                        <div className="flex justify-between items-center text-slate-700 text-[10px]">
                                          <span>Split: <strong>₹{splitInr.toLocaleString("en-IN")}</strong></span>
                                          <span>Deducted from Advance: <strong className="text-amber-800">-₹{Math.min(splitInr, priorAvailable).toLocaleString("en-IN")}</strong></span>
                                        </div>
                                        {remainingToGive > 0 ? (
                                          <div className="p-1.5 bg-amber-100 rounded border border-amber-300 font-bold text-amber-950 flex justify-between items-center">
                                            <span>👉 Remaining to pay {partyInfo.partyName}:</span>
                                            <span>₹{remainingToGive.toLocaleString("en-IN")}</span>
                                          </div>
                                        ) : isExactMatch ? (
                                          <div className="p-1.5 bg-emerald-100 rounded border border-emerald-300 font-bold text-emerald-800">
                                            ✓ Settled against advance (₹0 to pay)
                                          </div>
                                        ) : (
                                          <div className="p-1.5 bg-emerald-50 rounded border border-emerald-200 font-semibold text-emerald-800 flex justify-between items-center">
                                            <span>✓ 100% covered (₹0 to pay now)</span>
                                            <span>Retains ₹{remainingPriorBalance.toLocaleString("en-IN")} advance</span>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <div className="p-2 bg-slate-100 rounded border border-slate-300 text-slate-900 space-y-0.5">
                                        <div className="flex justify-between items-center font-bold">
                                          <span>🛡️ Advance Kept Intact:</span>
                                          <span>₹{priorAvailable.toLocaleString("en-IN")} untouched</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-slate-700">
                                          <span>Full Amount Payable For This Order:</span>
                                          <span className="font-bold font-mono">₹{splitInr.toLocaleString("en-IN")}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-500 italic">
                                    Enter split INR amount above to calculate net remaining or retained advance.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Splits vs Order Total Match Indicator */}
                  {(() => {
                    const currentOrder = parseFloat(editInr) || 0;
                    const allocated = editSplits.reduce((sum, s) => sum + (parseFloat(s.inr_amount) || 0), 0);
                    const diff = currentOrder - allocated;
                    const isMatched = currentOrder > 0 && Math.abs(diff) < 0.01;

                    return (
                      <div
                        className={`p-2 rounded-lg border text-[11px] flex items-center justify-between font-mono ${
                          isMatched
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : diff > 0
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-rose-50 border-rose-200 text-rose-800"
                        }`}
                      >
                        <span className="font-sans font-semibold">
                          {isMatched
                            ? "✓ Splits match order total exactly."
                            : diff > 0
                            ? `⚠️ Unallocated: ₹${diff.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} remaining.`
                            : `⛔ Over-allocated by ₹${Math.abs(diff).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}.`}
                        </span>
                        <span className="font-bold">
                          ₹{allocated.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} / ₹{currentOrder.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reason for Edit *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rate adjustment or order update"
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
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-teal-700" />
                  <span>Record Customer Payment</span>
                </h3>
                <button onClick={() => setPayingTxn(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {payError && <p className="text-xs text-rose-600 font-semibold">{payError}</p>}

              <form onSubmit={handleSavePayment} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Date</label>
                    <input
                      type="date"
                      required
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Amount (AED) *</label>
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
                <span>Void Customer Remittance?</span>
              </h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to void remittance {voidingTxn.transaction_number}?
              </p>
              <input
                type="text"
                required
                placeholder="Reason for voiding"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setVoidingTxn(null)} className="px-3 py-1.5 text-xs font-semibold">
                  Cancel
                </button>
                <button
                  onClick={handleConfirmVoid}
                  disabled={isVoiding}
                  className="px-4 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg"
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
                <span>Permanently Delete Remittance?</span>
              </h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to delete {deletingTxn.transaction_number}? This cannot be undone.
              </p>
              {deleteError && <p className="text-xs text-rose-600 font-semibold">{deleteError}</p>}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setDeletingTxn(null)} className="px-3 py-1.5 text-xs font-semibold">
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg"
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

export default function CustomerRemittancesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400">
          Loading Customer Remittances...
        </div>
      }
    >
      <CustomerRemittancesContent />
    </Suspense>
  );
}
