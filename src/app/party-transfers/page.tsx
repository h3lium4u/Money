"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Handshake,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  FileText,
  Edit2,
  Trash2,
  Ban,
  PlusCircle,
  RefreshCw,
  Coins,
  ArrowRightLeft,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Layers,
  Sparkles,
} from "lucide-react";
import { generateTransactionReceipt } from "@/lib/pdf-generator";
import {
  getTodayDateString,
  getYesterdayDateString,
  getStartOfWeekDateString,
  getStartOfMonthDateString,
} from "@/lib/date-utils";
import { numberToIndianWords } from "@/lib/number-to-words";

interface Party {
  id: string;
  code: string;
  name: string;
  default_rate?: number;
  outstanding_balance?: number;
}

interface PartyTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  customer_id: string;
  customer_code?: string;
  customer_name: string;
  entity_type?: string;
  inr_amount: number;
  customer_rate: number;
  aed_amount: number;
  base_rate: number;
  cost_aed: number;
  gross_profit_aed: number;
  delivery_charge_pct: number;
  delivery_charge_aed: number;
  net_profit_aed: number;
  distributor_id?: string | null;
  distributor_name?: string | null;
  distributor_names?: string | null;
  distributor_split_details?: string | null;
  status: "CONFIRMED" | "VOIDED";
  notes?: string;
  total_distributed_inr?: number;
  remaining_inr?: number;
  paid_aed?: number;
  pending_aed?: number;
  created_at: string;
}

export default function PartyTransfersPage() {
  const [transfers, setTransfers] = useState<PartyTransaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedParty, setSelectedParty] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL"); // ALL, TODAY, YESTERDAY, WEEK, MONTH
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Modal states
  const [showNewModal, setShowNewModal] = useState(false);
  const [payingTxn, setPayingTxn] = useState<PartyTransaction | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [editingTxn, setEditingTxn] = useState<PartyTransaction | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editPartyId, setEditPartyId] = useState("");
  const [editInrAmount, setEditInrAmount] = useState("");
  const [editCustomerRate, setEditCustomerRate] = useState("");
  const [editBaseRate, setEditBaseRate] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [voidingTxn, setVoidingTxn] = useState<PartyTransaction | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const [deletingTxn, setDeletingTxn] = useState<PartyTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // New Party Transfer Form State
  const [newDate, setNewDate] = useState(getTodayDateString());
  const [newPartyId, setNewPartyId] = useState("");
  const [newInrAmounts, setNewInrAmounts] = useState<string[]>(["", "", ""]);
  const [newCustomerRate, setNewCustomerRate] = useState("38.67");
  const [newBaseRate, setNewBaseRate] = useState("30.00");
  const [newError, setNewError] = useState<string | null>(null);
  const [showConfirmNew, setShowConfirmNew] = useState(false);
  const [savingNew, setSavingNew] = useState(false);

  // Extra party creation inside new transfer modal
  const [showAddPartyField, setShowAddPartyField] = useState(false);
  const [extraPartyName, setExtraPartyName] = useState("");
  const [extraPartyCode, setExtraPartyCode] = useState("");
  const [savingExtraParty, setSavingExtraParty] = useState(false);

  const newDateRef = useRef<HTMLInputElement>(null);

  const formatINR = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return "₹0.00";
    return "₹ " + Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatAED = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return "0.00 AED";
    return Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " AED";
  };

  async function loadData() {
    setLoading(true);
    try {
      const [txnRes, partiesRes] = await Promise.all([
        fetch("/api/transactions?entityType=PARTY&limit=250"),
        fetch("/api/parties"),
      ]);
      const txns = await txnRes.json();
      const prts = await partiesRes.json();
      setTransfers(Array.isArray(txns) ? txns : []);
      const partyList = Array.isArray(prts) ? prts : [];
      setParties(partyList);
      if (partyList.length > 0 && !newPartyId) {
        setNewPartyId(partyList[0].id);
        if (partyList[0].default_rate) {
          setNewCustomerRate(String(partyList[0].default_rate));
        }
      }
    } catch (err) {
      console.error("Failed to load party transfers data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Helper calculations for INR Cost & Profit
  function getTransferCostInr(t: PartyTransaction): number {
    if (!t.inr_amount) return 0;
    if (t.aed_amount && t.aed_amount > 0 && t.cost_aed !== undefined && t.cost_aed !== null) {
      const inrPerAed = t.inr_amount / t.aed_amount;
      return t.cost_aed * inrPerAed;
    }
    const cr = t.customer_rate || 0;
    const br = t.base_rate || 0;
    const cr1000 = cr >= 30 ? cr : (cr > 0 ? 1000 / cr : 0);
    const br1000 = br >= 30 ? br : (br > 0 ? 1000 / br : 0);
    if (cr1000 > 0) {
      return (t.inr_amount * br1000) / cr1000;
    }
    return 0;
  }

  function getTransferNetProfitInr(t: PartyTransaction): number {
    if (!t.inr_amount) return 0;
    if (t.aed_amount && t.aed_amount > 0 && t.net_profit_aed !== undefined && t.net_profit_aed !== null) {
      const inrPerAed = t.inr_amount / t.aed_amount;
      return t.net_profit_aed * inrPerAed;
    }
    const inr = t.inr_amount || 0;
    const cost = getTransferCostInr(t);
    return inr - cost;
  }

  // Compute live preview for new party transfer
  const validNewAmounts = newInrAmounts
    .map((v) => parseFloat(v))
    .filter((n) => !isNaN(n) && n > 0);
  const totalNewInr = validNewAmounts.reduce((a, b) => a + b, 0);
  const cRate = parseFloat(newCustomerRate) || 0;
  const bRate = parseFloat(newBaseRate) || 0;

  // Normalized rates per 1000 INR
  const custRatePer1000 = cRate >= 30 ? cRate : (cRate > 0 ? 1000 / cRate : 0);
  const baseRatePer1000 = bRate >= 30 ? bRate : (bRate > 0 ? 1000 / bRate : 0);

  const calculatedAedCharged = custRatePer1000 > 0 ? (totalNewInr / 1000) * custRatePer1000 : 0;
  const calculatedCostAed = baseRatePer1000 > 0 ? (totalNewInr / 1000) * baseRatePer1000 : 0;
  const calculatedNetProfitAed = calculatedAedCharged - calculatedCostAed;

  // In INR
  const calculatedInrCharged = totalNewInr;
  const calculatedCostInr = custRatePer1000 > 0
    ? (totalNewInr * baseRatePer1000) / custRatePer1000
    : 0;
  const calculatedNetProfitInr = calculatedInrCharged - calculatedCostInr;

  function handleAddInrAmount() {
    setNewInrAmounts((prev) => [...prev, ""]);
  }

  function handleRemoveInrAmount(idx: number) {
    if (newInrAmounts.length <= 1) {
      setNewInrAmounts([""]);
      return;
    }
    setNewInrAmounts((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleInrAmountChange(idx: number, val: string) {
    const next = [...newInrAmounts];
    next[idx] = val;
    setNewInrAmounts(next);
  }

  function handlePartySelect(partyId: string) {
    setNewPartyId(partyId);
    const p = parties.find((x) => x.id === partyId);
    if (p?.default_rate) {
      setNewCustomerRate(String(p.default_rate));
    }
  }

  async function handleCreateExtraParty() {
    if (!extraPartyName.trim()) return;
    setSavingExtraParty(true);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: extraPartyName.trim(),
          code: extraPartyCode.trim() || extraPartyName.trim().toUpperCase(),
          default_rate: parseFloat(newCustomerRate) || 38.67,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "Failed to create party");
      setParties((prev) => [...prev, created]);
      setNewPartyId(created.id);
      setShowAddPartyField(false);
      setExtraPartyName("");
      setExtraPartyCode("");
    } catch (err: any) {
      alert(err.message || "Failed to add party");
    } finally {
      setSavingExtraParty(false);
    }
  }

  function initiateSaveNewTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!newPartyId) {
      setNewError("Please select a party");
      return;
    }
    if (totalNewInr <= 0) {
      setNewError("Please enter at least one valid INR Order Amount");
      return;
    }
    if (cRate <= 0) {
      setNewError("Customer rate must be greater than zero");
      return;
    }
    if (bRate <= 0) {
      setNewError("Base rate must be greater than zero");
      return;
    }
    setNewError(null);
    setShowConfirmNew(true);
  }

  async function handleConfirmSaveTransfer() {
    setSavingNew(true);
    setNewError(null);
    try {
      const notesString =
        validNewAmounts.length > 1
          ? `Breakdown: ${validNewAmounts.map((a) => formatINR(a)).join(" + ")}`
          : undefined;

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: newDate,
          customer_id: newPartyId,
          inr_amount: totalNewInr,
          customer_rate: cRate,
          base_rate: bRate,
          delivery_charge_pct: 0,
          notes: notesString,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save party transfer");

      setShowConfirmNew(false);
      setShowNewModal(false);
      // Reset form
      setNewDate(getTodayDateString());
      setNewInrAmounts(["", "", ""]);
      await loadData();
    } catch (err: any) {
      setNewError(err.message || "Failed to save party transfer");
      setShowConfirmNew(false);
    } finally {
      setSavingNew(false);
    }
  }

  // Payments
  function handleOpenPay(t: PartyTransaction) {
    setPayingTxn(t);
    const due = t.pending_aed ?? t.aed_amount;
    setPayAmount(due > 0 ? String(due) : "");
    setPayDate(getTodayDateString());
    setPayMethod("CASH");
    setPayNotes("");
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
      const res = await fetch(`/api/parties/${payingTxn.customer_id}/payments`, {
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
      await loadData();
    } catch (err: any) {
      setPayError(err.message || "Failed to record payment");
    } finally {
      setPayLoading(false);
    }
  }

  // Edit
  function handleOpenEdit(t: PartyTransaction) {
    setEditingTxn(t);
    setEditDate(t.transaction_date?.slice(0, 10) || getTodayDateString());
    setEditPartyId(t.customer_id);
    setEditInrAmount(String(t.inr_amount));
    setEditCustomerRate(String(t.customer_rate));
    setEditBaseRate(String(t.base_rate));
    setEditReason("");
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTxn) return;
    setIsUpdating(true);
    setEditError(null);
    try {
      const inr = parseFloat(editInrAmount);
      const cr = parseFloat(editCustomerRate);
      const br = parseFloat(editBaseRate);
      if (!inr || inr <= 0) throw new Error("Invalid INR amount");
      if (!cr || cr <= 0) throw new Error("Invalid customer rate");
      if (!br || br <= 0) throw new Error("Invalid base rate");

      const res = await fetch(`/api/transactions/${editingTxn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: editDate,
          customer_id: editPartyId,
          inr_amount: inr,
          customer_rate: cr,
          base_rate: br,
          delivery_charge_pct: 0,
          reason: editReason || "Party transfer rate/amount amendment",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update transfer");
      setEditingTxn(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || "Failed to save edit");
    } finally {
      setIsUpdating(false);
    }
  }

  // Void
  async function handleConfirmVoid() {
    if (!voidingTxn) return;
    setIsVoiding(true);
    setVoidError(null);
    try {
      const res = await fetch(`/api/transactions/${voidingTxn.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason || "User voided party transfer" }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to void transaction");
      }
      setVoidingTxn(null);
      await loadData();
    } catch (err: any) {
      setVoidError(err.message || "Failed to void transaction");
    } finally {
      setIsVoiding(false);
    }
  }

  // Delete
  async function handleConfirmDelete() {
    if (!deletingTxn) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/transactions/${deletingTxn.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to delete transaction");
      }
      setDeletingTxn(null);
      await loadData();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete transaction");
    } finally {
      setIsDeleting(false);
    }
  }

  // Metrics
  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();
  const monthStartStr = getStartOfMonthDateString();
  const weekStartStr = getStartOfWeekDateString();

  const todayTransfers = transfers.filter(
    (t) => t.status === "CONFIRMED" && t.transaction_date?.slice(0, 10) === todayStr
  );
  const todayInrTotal = todayTransfers.reduce((sum, t) => sum + (t.inr_amount || 0), 0);

  const yesterdayTransfers = transfers.filter(
    (t) => t.status === "CONFIRMED" && t.transaction_date?.slice(0, 10) === yesterdayStr
  );
  const yesterdayInrTotal = yesterdayTransfers.reduce((sum, t) => sum + (t.inr_amount || 0), 0);

  const monthTransfers = transfers.filter(
    (t) => t.status === "CONFIRMED" && t.transaction_date?.slice(0, 10) >= monthStartStr
  );
  const monthInrTotal = monthTransfers.reduce((sum, t) => sum + (t.inr_amount || 0), 0);

  const totalInrBilledAll = transfers
    .filter((t) => t.status === "CONFIRMED")
    .reduce((sum, t) => sum + (t.inr_amount || 0), 0);

  const totalNetProfitInrAll = transfers
    .filter((t) => t.status === "CONFIRMED")
    .reduce((sum, t) => sum + getTransferNetProfitInr(t), 0);

  const totalAedCharged = transfers
    .filter((t) => t.status === "CONFIRMED")
    .reduce((sum, t) => sum + (t.aed_amount || 0), 0);

  const totalOutstandingDueAed = transfers
    .filter((t) => t.status === "CONFIRMED")
    .reduce((sum, t) => sum + (t.pending_aed ?? t.aed_amount ?? 0), 0);

  // Filtering
  const filteredTransfers = transfers.filter((t) => {
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTxn = t.transaction_number.toLowerCase().includes(q);
      const matchParty = t.customer_name?.toLowerCase().includes(q) || t.customer_code?.toLowerCase().includes(q);
      const matchNotes = t.notes?.toLowerCase().includes(q);
      const matchAmount = String(t.inr_amount).includes(q) || String(t.aed_amount).includes(q);
      if (!matchTxn && !matchParty && !matchNotes && !matchAmount) return false;
    }

    // Party filter
    if (selectedParty !== "ALL" && t.customer_id !== selectedParty) {
      return false;
    }

    // Status filter
    if (statusFilter !== "ALL" && t.status !== statusFilter) {
      return false;
    }

    // Date Presets
    const txnDate = t.transaction_date?.slice(0, 10);
    if (dateFilter === "TODAY" && txnDate !== todayStr) return false;
    if (dateFilter === "YESTERDAY" && txnDate !== yesterdayStr) return false;
    if (dateFilter === "WEEK" && (txnDate < weekStartStr || txnDate > todayStr)) return false;
    if (dateFilter === "MONTH" && (txnDate < monthStartStr || txnDate > todayStr)) return false;
    if (customFrom && txnDate < customFrom) return false;
    if (customTo && txnDate > customTo) return false;

    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-lg relative overflow-hidden border border-teal-700/50">
        <div className="absolute right-0 top-0 w-96 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-200 border border-teal-400/30 text-xs font-bold tracking-wide uppercase">
              <Handshake className="w-3.5 h-3.5" />
              <span>IND Settlement Parties Entity</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Party Transfers
            </h1>
            <p className="text-teal-100/80 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Dedicated financial movement and transfer transactions for India settlement parties (<strong>AWAFI</strong>, <strong>BASID</strong>, <strong>HAJA</strong>, <strong>NF2</strong>, <strong>SARABU</strong>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setShowNewModal(true);
                setNewDate(getTodayDateString());
              }}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ New Party Transfer</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-xs transition flex items-center justify-center cursor-pointer"
              title="Refresh Transfer Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Card 1: Today */}
        <div className="bg-white p-4 rounded-xl border border-teal-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">Today&apos;s Transfers</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">
              {todayTransfers.length} txns
            </span>
          </div>
          <div className="mt-2 font-mono font-bold text-lg text-slate-900 truncate">
            {formatINR(todayInrTotal)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Recorded on {todayStr}</div>
        </div>

        {/* Card 2: Yesterday */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Previous Day</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
              {yesterdayTransfers.length} txns
            </span>
          </div>
          <div className="mt-2 font-mono font-bold text-lg text-slate-900 truncate">
            {formatINR(yesterdayInrTotal)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Recorded on {yesterdayStr}</div>
        </div>

        {/* Card 3: This Month */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">This Month</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
              {monthTransfers.length} txns
            </span>
          </div>
          <div className="mt-2 font-mono font-bold text-lg text-slate-900 truncate">
            {formatINR(monthInrTotal)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Since {monthStartStr}</div>
        </div>

        {/* Card 4: Total INR Billed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">INR Billed (All)</div>
          <div className="mt-2 font-mono font-bold text-lg text-slate-900 truncate">
            {formatINR(totalInrBilledAll)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{transfers.length} total party transfers</div>
        </div>

        {/* Card 5: Total Net Profit in INR */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Total Net Profit (INR)</div>
          <div className="mt-2 font-mono font-bold text-lg text-emerald-900 truncate">
            {formatINR(totalNetProfitInrAll)}
          </div>
          <div className="text-[10px] text-emerald-700/80 mt-0.5">Across all confirmed party transfers</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by TXN ID, Party name (AWAFI, NF2...), amount..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
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

          {/* Party Filter Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Party:</span>
            </div>
            <select
              value={selectedParty}
              onChange={(e) => setSelectedParty(e.target.value)}
              className="border border-slate-300 rounded-lg text-xs font-bold text-slate-800 py-1.5 px-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Parties ({parties.length})</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.code ? `(${p.code})` : ""}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-lg text-xs font-bold text-slate-800 py-1.5 px-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="VOIDED">VOIDED</option>
            </select>
          </div>
        </div>

        {/* Date Presets Pill Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Period:</span>
            {[
              { id: "ALL", label: "All Time" },
              { id: "TODAY", label: "Today" },
              { id: "YESTERDAY", label: "Previous Day" },
              { id: "WEEK", label: "This Week" },
              { id: "MONTH", label: "This Month" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setDateFilter(p.id);
                  setCustomFrom("");
                  setCustomTo("");
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  dateFilter === p.id && !customFrom && !customTo
                    ? "bg-teal-700 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Custom:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setDateFilter("CUSTOM");
              }}
              className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 text-slate-800"
              title="From date"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setDateFilter("CUSTOM");
              }}
              className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 text-slate-800"
              title="To date"
            />
            {(customFrom || customTo) && (
              <button
                onClick={() => {
                  setCustomFrom("");
                  setCustomTo("");
                  setDateFilter("ALL");
                }}
                className="text-[11px] text-rose-600 hover:underline font-bold"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Party Transfers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Party Transfers Registry
            </h2>
            <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 bg-teal-100 dark:bg-teal-950/70 border border-teal-200/50 dark:border-teal-800/60 px-2 py-0.5 rounded-full">
              {filteredTransfers.length} records
            </span>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing only transfers for <strong className="text-slate-700 dark:text-slate-200">IND Settlement Parties</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <th className="px-4 py-3">TXN ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">IND Party</th>
                <th className="px-4 py-3">INR Order</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">INR Cost</th>
                <th className="px-4 py-3">Net Profit (INR)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
                    <span>Loading party transfers...</span>
                  </td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Handshake className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="font-bold text-slate-700 dark:text-slate-200">No party transfers found</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No party transfers match your current filter criteria.
                      </p>
                      <button
                        onClick={() => {
                          setShowNewModal(true);
                          setNewDate(getTodayDateString());
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg font-bold text-xs hover:bg-teal-700 cursor-pointer shadow-sm"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Create First Party Transfer</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => {
                  const isPaid = (t.paid_aed || 0) >= (t.aed_amount || 0);
                  const isVoided = t.status === "VOIDED";

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-teal-50/30 dark:hover:bg-slate-800/40 transition-colors ${
                        isVoided ? "bg-slate-50/80 dark:bg-slate-900/40 opacity-70" : ""
                      }`}
                    >
                      {/* TXN ID */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span>{t.transaction_number}</span>
                        </div>
                        {t.notes && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 max-w-xs truncate" title={t.notes}>
                            {t.notes}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {t.transaction_date?.slice(0, 10)}
                      </td>

                      {/* IND Party */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/parties/${t.customer_id}`}
                            className="font-bold text-teal-700 dark:text-teal-400 hover:text-teal-600 dark:hover:text-teal-300 hover:underline flex items-center gap-1"
                          >
                            <Handshake className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                            <span>{t.customer_name}</span>
                          </Link>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 tracking-wider">
                            IND PARTY
                          </span>
                        </div>
                        {t.customer_code && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                            {t.customer_code}
                          </div>
                        )}
                      </td>

                      {/* INR Order */}
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100 font-mono whitespace-nowrap">
                        {formatINR(t.inr_amount)}
                      </td>

                      {/* Rate */}
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                        {t.customer_rate?.toFixed(4)}
                      </td>

                      {/* INR Cost */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {formatINR(getTransferCostInr(t))}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          Base Cost: {formatAED(t.cost_aed)}
                        </div>
                      </td>

                      {/* Net Profit (INR) */}
                      <td className="px-4 py-3 font-bold font-mono whitespace-nowrap">
                        <div className={getTransferNetProfitInr(t) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {formatINR(getTransferNetProfitInr(t))}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          Profit: {formatAED(t.net_profit_aed)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            t.status === "CONFIRMED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Pay Button */}
                          {!isVoided && !isPaid && (
                            <button
                              onClick={() => handleOpenPay(t)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                              title="Record Payment in AED"
                            >
                              <CreditCard className="w-3 h-3 text-emerald-600" />
                              <span>+ Pay</span>
                            </button>
                          )}

                          {/* Receipt */}
                          <button
                            onClick={() => generateTransactionReceipt(t)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                            title="Download PDF Receipt"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          {!isVoided && (
                            <button
                              onClick={() => handleOpenEdit(t)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                              title="Edit Transfer Rates/Amounts"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Void */}
                          {!isVoided && (
                            <button
                              onClick={() => {
                                setVoidingTxn(t);
                                setVoidReason("");
                                setVoidError(null);
                              }}
                              className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition text-[11px] font-semibold cursor-pointer"
                              title="Void Transfer"
                            >
                              Void
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => {
                              setDeletingTxn(t);
                              setDeleteError(null);
                            }}
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Permanently Delete Transfer"
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

      {/* ========================================================================= */}
      {/* MODAL 1: NEW PARTY TRANSFER (With 3 Default INR Fields & Confirmation) */}
      {/* ========================================================================= */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-5 border border-slate-200 animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                  <Handshake className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">New Party Transfer</h3>
                  <p className="text-xs text-slate-500">Record a financial transfer for an IND settlement party</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {newError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{newError}</span>
              </div>
            )}

            <form onSubmit={initiateSaveNewTransfer} className="space-y-4">
              {/* Date & Party */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Transfer Date
                  </label>
                  <input
                    ref={newDateRef}
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Defaults to today</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      IND Party
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddPartyField(!showAddPartyField)}
                      className="text-[11px] text-teal-700 hover:underline font-bold"
                    >
                      {showAddPartyField ? "Cancel Extra" : "+ Add Extra Party"}
                    </button>
                  </div>

                  {!showAddPartyField ? (
                    <select
                      value={newPartyId}
                      onChange={(e) => handlePartySelect(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-teal-500"
                    >
                      {parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.code ? `(${p.code})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 bg-teal-50/70 border border-teal-200 rounded-lg space-y-2">
                      <input
                        type="text"
                        placeholder="Party Name (e.g. AWAFI, SARABU...)"
                        value={extraPartyName}
                        onChange={(e) => setExtraPartyName(e.target.value)}
                        className="w-full text-xs border border-teal-300 rounded p-1.5 text-slate-900 bg-white"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Code (Optional)"
                          value={extraPartyCode}
                          onChange={(e) => setExtraPartyCode(e.target.value)}
                          className="w-1/2 text-xs border border-teal-300 rounded p-1.5 text-slate-900 bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleCreateExtraParty}
                          disabled={savingExtraParty}
                          className="w-1/2 bg-teal-700 text-white rounded text-xs font-bold py-1.5 hover:bg-teal-800 disabled:opacity-50"
                        >
                          {savingExtraParty ? "Saving..." : "Save Party"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3 Default INR Fields (dynamic add/delete) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      INR Order Amount (₹)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      3 fields provided by default. Add or remove fields as needed. Empty fields are ignored.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddInrAmount}
                    className="px-2.5 py-1 bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-300 rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  >
                    <PlusCircle className="w-3 h-3 text-teal-700" />
                    <span>+ Add Field</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {newInrAmounts.map((amt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 font-mono w-6 text-right">
                        #{idx + 1}
                      </span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="any"
                          placeholder={`Enter amount ${idx + 1}...`}
                          value={amt}
                          onChange={(e) => handleInrAmountChange(idx, e.target.value)}
                          className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      {newInrAmounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveInrAmount(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Delete field"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Total Calculated INR */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">Total INR Order:</span>
                  <span className="font-mono font-bold text-base text-teal-900">
                    {formatINR(totalNewInr)}
                  </span>
                </div>
                {totalNewInr > 0 && (
                  <p className="text-[11px] text-teal-700 italic">
                    {numberToIndianWords(totalNewInr)} Rupees Only
                  </p>
                )}
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Customer / Party Rate
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newCustomerRate}
                    onChange={(e) => setNewCustomerRate(e.target.value)}
                    className="w-full text-xs font-bold font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Party billing rate (e.g. 38.25)</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Base / Cost Rate
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newBaseRate}
                    onChange={(e) => setNewBaseRate(e.target.value)}
                    className="w-full text-xs font-bold font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Cost rate to India payout (e.g. 30.00)</span>
                </div>
              </div>

              {/* Live Preview Box in INR */}
              <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">INR Amount Charged:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatINR(calculatedInrCharged)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">INR Cost:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {formatINR(calculatedCostInr)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-teal-200">
                  <span className="font-bold text-teal-900">Net Profit (INR):</span>
                  <span className={`font-mono font-bold ${calculatedNetProfitInr >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    {formatINR(calculatedNetProfitInr)}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800 transition shadow-sm cursor-pointer"
                >
                  Review & Confirm Transfer →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRMATION PROMPT BEFORE SAVING */}
      {/* ========================================================================= */}
      {showConfirmNew && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-teal-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-teal-800">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-teal-700" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Confirm Party Transfer Details</h3>
                <span className="text-xs text-slate-500">Please review before saving to database</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Transfer Date:</span>
                <span className="font-mono font-bold text-slate-900">{newDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">IND Party:</span>
                <span className="font-bold text-teal-900">
                  {parties.find((p) => p.id === newPartyId)?.name || "Selected Party"}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Total INR Order:</span>
                <span className="font-mono font-bold text-slate-900">{formatINR(totalNewInr)}</span>
              </div>
              {validNewAmounts.length > 1 && (
                <div className="text-[10px] text-slate-500 pl-2 border-l-2 border-teal-300">
                  Breakdown: {validNewAmounts.map((a) => formatINR(a)).join(" + ")}
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Party Rate:</span>
                <span className="font-mono font-bold text-slate-700">{cRate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Base Cost Rate:</span>
                <span className="font-mono font-bold text-slate-700">{bRate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-teal-950 font-bold">
                <span>INR Charged:</span>
                <span className="font-mono">{formatINR(calculatedInrCharged)}</span>
              </div>
              <div className="flex justify-between text-slate-700 font-semibold">
                <span>INR Cost:</span>
                <span className="font-mono">{formatINR(calculatedCostInr)}</span>
              </div>
              <div className={`flex justify-between font-bold ${calculatedNetProfitInr >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                <span>Net Profit (INR):</span>
                <span className="font-mono">{formatINR(calculatedNetProfitInr)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmNew(false)}
                disabled={savingNew}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveTransfer}
                disabled={savingNew}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {savingNew ? "Saving Record..." : "Confirm & Save Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RECORD PAYMENT IN AED FOR PARTY */}
      {/* ========================================================================= */}
      {payingTxn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>Record Party Settlement (AED)</span>
              </h3>
              <button
                onClick={() => setPayingTxn(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
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
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {payingTxn.transaction_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">IND Party:</span>
                  <span className="font-bold text-teal-900">{payingTxn.customer_name}</span>
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
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full text-sm font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Reference
                </label>
                <input
                  type="text"
                  placeholder="Optional receipt notes..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayingTxn(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {payLoading ? "Recording..." : "Save Payment Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT PARTY TRANSFER */}
      {/* ========================================================================= */}
      {editingTxn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Edit Party Transfer</h3>
              <button
                onClick={() => setEditingTxn(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">IND Party</label>
                  <select
                    value={editPartyId}
                    onChange={(e) => setEditPartyId(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded p-2 text-slate-900"
                  >
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">INR Amount</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editInrAmount}
                  onChange={(e) => setEditInrAmount(e.target.value)}
                  className="w-full text-xs font-bold font-mono border border-slate-300 rounded p-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Customer / Party Rate</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editCustomerRate}
                    onChange={(e) => setEditCustomerRate(e.target.value)}
                    className="w-full text-xs font-bold font-mono border border-slate-300 rounded p-2 text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Party billing rate (e.g. 38.25)</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Base / Cost Rate</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editBaseRate}
                    onChange={(e) => setEditBaseRate(e.target.value)}
                    className="w-full text-xs font-bold font-mono border border-slate-300 rounded p-2 text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Cost rate to India payout (e.g. 30.00)</span>
                </div>
              </div>

              {/* Live Preview Box in INR for Edit */}
              {(() => {
                const editInrNum = parseFloat(editInrAmount) || 0;
                const editCrNum = parseFloat(editCustomerRate) || 0;
                const editBrNum = parseFloat(editBaseRate) || 0;
                const editCr1000 = editCrNum >= 30 ? editCrNum : (editCrNum > 0 ? 1000 / editCrNum : 0);
                const editBr1000 = editBrNum >= 30 ? editBrNum : (editBrNum > 0 ? 1000 / editBrNum : 0);
                const editCostInr = editCr1000 > 0 ? (editInrNum * editBr1000) / editCr1000 : 0;
                const editNetProfitInr = editInrNum - editCostInr;
                if (editInrNum <= 0) return null;
                return (
                  <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">INR Amount Charged:</span>
                      <span className="font-mono font-bold text-slate-900">{formatINR(editInrNum)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">INR Cost:</span>
                      <span className="font-mono font-bold text-slate-700">{formatINR(editCostInr)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-teal-200">
                      <span className="font-bold text-teal-900">Net Profit (INR):</span>
                      <span className={`font-mono font-bold ${editNetProfitInr >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {formatINR(editNetProfitInr)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Audit Reason</label>
                <input
                  type="text"
                  placeholder="Reason for amendment..."
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-2 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTxn(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: VOID PARTY TRANSFER */}
      {/* ========================================================================= */}
      {voidingTxn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600">
              <Ban className="w-6 h-6 text-amber-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Void Party Transfer</h3>
                <span className="text-xs font-mono text-slate-500">{voidingTxn.transaction_number}</span>
              </div>
            </div>

            {voidError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                {voidError}
              </div>
            )}

            <p className="text-xs text-slate-600">
              Voiding this party transfer will exclude it from calculations while preserving the audit record.
            </p>

            <input
              type="text"
              placeholder="Reason for voiding..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded p-2 text-slate-900"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVoidingTxn(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={isVoiding}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
              >
                {isVoiding ? "Voiding..." : "Confirm Void"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: DELETE PARTY TRANSFER */}
      {/* ========================================================================= */}
      {deletingTxn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <Trash2 className="w-6 h-6 text-rose-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Party Transfer</h3>
                <span className="text-xs font-mono text-slate-500">{deletingTxn.transaction_number}</span>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                {deleteError}
              </div>
            )}

            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete this party transfer? This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingTxn(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
