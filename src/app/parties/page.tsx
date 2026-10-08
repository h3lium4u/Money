"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Handshake,
  Search,
  Coins,
  CreditCard,
  UserPlus,
  AlertTriangle,
  Edit3,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Table,
  Clock,
  Filter,
  CheckCircle,
} from "lucide-react";
import { getTodayDateString } from "@/lib/date-utils";
import { FadeIn, PageTransition } from "@/components/AnimatedLayout";

export default function PartiesPage() {
  const router = useRouter();
  const [parties, setParties] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Active View / Period Tab: "matrix" | "today" | "yesterday" | "week" | "month" | "year" | "splits" | "accounts"
  const [selectedPeriod, setSelectedPeriod] = useState<
    "matrix" | "today" | "yesterday" | "week" | "month" | "year" | "splits" | "accounts"
  >("matrix");

  const [search, setSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState("all");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState<"all" | "DUBAI" | "INDIA">("all");

  // Create Party Modal State
  const [showModal, setShowModal] = useState(false);
  const [newPartyType, setNewPartyType] = useState<"DUBAI" | "INDIA">("DUBAI");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRate, setNewRate] = useState("38.25");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Party Modal State
  const [editParty, setEditParty] = useState<any | null>(null);
  const [editPartyType, setEditPartyType] = useState<"DUBAI" | "INDIA">("DUBAI");
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRate, setEditRate] = useState("38.25");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Party Modal State
  const [deletePartyTarget, setDeletePartyTarget] = useState<any | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Quick Settlement Modal State
  const [payingParty, setPayingParty] = useState<any | null>(null);
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNotes, setPayNotes] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    fetchParties();
    fetchSplitSummary();
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const tab = p.get("tab") || p.get("view");
      if (
        tab &&
        ["matrix", "today", "yesterday", "week", "month", "year", "splits", "accounts"].includes(tab)
      ) {
        setSelectedPeriod(tab as any);
      }
    }
  }, []);

  async function fetchParties() {
    setLoading(true);
    try {
      const res = await fetch("/api/parties");
      const data = await res.json();
      setParties(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setParties([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSplitSummary() {
    setLoadingSummary(true);
    try {
      const res = await fetch("/api/distribution-splits/summary");
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error(err);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleCreateParty(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setModalError("Party name is required");
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          code: newCode.trim() || undefined,
          phone: newPhone.trim() || undefined,
          default_rate: newRate ? parseFloat(newRate) : 38.25,
          party_type: newPartyType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create party");
      }

      setShowModal(false);
      setNewPartyType("DUBAI");
      setNewName("");
      setNewCode("");
      setNewPhone("");
      setNewRate("38.25");
      fetchParties();
      fetchSplitSummary();
    } catch (err: any) {
      setModalError(err.message || "Failed to create party");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(party: any) {
    setEditParty(party);
    setEditPartyType(party.party_type === "INDIA" ? "INDIA" : "DUBAI");
    setEditName(party.name);
    setEditCode(party.code || "");
    setEditPhone(party.phone || "");
    setEditRate(String(party.default_rate || 38.25));
    setEditError(null);
  }

  async function handleSaveEditParty(e: React.FormEvent) {
    e.preventDefault();
    if (!editParty) return;

    setEditSubmitting(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/parties/${editParty.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim() || undefined,
          phone: editPhone.trim() || undefined,
          default_rate: editRate ? parseFloat(editRate) : 38.25,
          party_type: editPartyType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update party");
      }

      setEditParty(null);
      fetchParties();
      fetchSplitSummary();
    } catch (err: any) {
      setEditError(err.message || "Failed to update party");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteParty() {
    if (!deletePartyTarget) return;

    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/parties/${deletePartyTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete party");
      }

      setDeletePartyTarget(null);
      fetchParties();
      fetchSplitSummary();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete party");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function handleOpenPayModal(party: any) {
    setPayingParty(party);
    setPayDate(getTodayDateString());
    setPayAmount(party.outstanding_balance > 0 ? String(party.outstanding_balance) : "");
    setPayMethod("CASH");
    setPayNotes(`Settlement for party ${party.name}`);
    setPayError(null);
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingParty) return;

    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      setPayError("Payment amount must be greater than zero");
      return;
    }

    setPaySubmitting(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/parties/${payingParty.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_date: payDate,
          amount_aed: amt,
          payment_method: payMethod,
          notes: payNotes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record payment");
      }

      setPayingParty(null);
      fetchParties();
      fetchSplitSummary();
    } catch (err: any) {
      setPayError(err.message || "Failed to record payment");
    } finally {
      setPaySubmitting(false);
    }
  }

  const formatINR = (val?: number) =>
    `₹ ${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatAED = (val?: number) =>
    `${(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

  // Summary parties and grand totals from backend
  const partyRows = summary?.parties || [];
  const grandTotals = summary?.grand_totals || {
    today: 0,
    yesterday: 0,
    week: 0,
    month: 0,
    year: 0,
    total: 0,
  };
  const dates = summary?.dates || {
    today: getTodayDateString(),
    yesterday: "-",
    week_start: "-",
    month_start: "-",
    year_start: "-",
  };

  // Recent customer remittance assignments
  const allAssignments: any[] = summary?.recent_assignments || [];

  // Filter assignments based on search and selected party
  const filteredAssignments = allAssignments.filter((a) => {
    if (partyFilter !== "all" && a.distributor_id !== partyFilter) return false;

    // Period filtering if viewed under specific period
    if (selectedPeriod === "today" && a.split_date !== dates.today) return false;
    if (selectedPeriod === "yesterday" && a.split_date !== dates.yesterday) return false;
    if (selectedPeriod === "week" && (a.split_date < dates.week_start || a.split_date > dates.today)) return false;
    if (selectedPeriod === "month" && (a.split_date < dates.month_start || a.split_date > dates.today)) return false;
    if (selectedPeriod === "year" && (a.split_date < dates.year_start || a.split_date > dates.today)) return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.transaction_number?.toLowerCase().includes(q) ||
      a.customer_name?.toLowerCase().includes(q) ||
      a.customer_code?.toLowerCase().includes(q) ||
      a.distributor_name?.toLowerCase().includes(q) ||
      (a.notes && a.notes.toLowerCase().includes(q))
    );
  });

  const totalFilteredSplitInr = filteredAssignments.reduce((sum, a) => sum + Number(a.inr_amount || 0), 0);

  // Filter parties for accounts view
  const filteredParties = parties.filter((p) => {
    if (regionFilter === "DUBAI" && p.party_type === "INDIA") return false;
    if (regionFilter === "INDIA" && p.party_type !== "INDIA") return false;
    if (
      search &&
      !p.name.toLowerCase().includes(search.toLowerCase()) &&
      !p.code.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    if (balanceFilter === "owing" && (p.outstanding_balance || 0) <= 0.01) return false;
    if (balanceFilter === "cleared" && Math.abs(p.outstanding_balance || 0) > 0.01) return false;
    return true;
  });

  const totalOutstanding = parties.reduce((sum, p) => sum + (p.outstanding_balance || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Parties & Remittance Settlement
            </h2>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              Dubai & India Partners
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tracks Dubai settlement parties (HAJA, SARAB, NF2) and India payout partners (MK, SALA) with live balance ledgers and grand totals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/transactions/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <span>+ New Remittance</span>
          </Link>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add New Party</span>
          </button>
        </div>
      </div>

      {/* TOP KPI GRAND TOTALS (TODAY, PREVIOUS DAY, WEEK, MONTH, YEAR) */}
      <FadeIn delay={0.08}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Today's Grand Total */}
        <div
          onClick={() => setSelectedPeriod("today")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
            selectedPeriod === "today"
              ? "bg-teal-50 dark:bg-teal-950/60 border-teal-500 ring-2 ring-teal-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Today's Total</span>
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
          </div>
          {loadingSummary ? (
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mt-1.5" />
          ) : (
            <p className="text-lg sm:text-xl font-mono font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatINR(grandTotals.today)}
            </p>
          )}
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
            {dates.today}
          </span>
        </div>

        {/* Previous Day Grand Total */}
        <div
          onClick={() => setSelectedPeriod("yesterday")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
            selectedPeriod === "yesterday"
              ? "bg-teal-50 dark:bg-teal-950/60 border-teal-500 ring-2 ring-teal-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Previous Day</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          {loadingSummary ? (
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mt-1.5" />
          ) : (
            <p className="text-lg sm:text-xl font-mono font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatINR(grandTotals.yesterday)}
            </p>
          )}
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
            {dates.yesterday}
          </span>
        </div>

        {/* This Week Grand Total */}
        <div
          onClick={() => setSelectedPeriod("week")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
            selectedPeriod === "week"
              ? "bg-teal-50 dark:bg-teal-950/60 border-teal-500 ring-2 ring-teal-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>This Week</span>
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
          </div>
          {loadingSummary ? (
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mt-1.5" />
          ) : (
            <p className="text-lg sm:text-xl font-mono font-bold text-teal-700 dark:text-teal-400 mt-1">
              {formatINR(grandTotals.week)}
            </p>
          )}
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
            From {dates.week_start}
          </span>
        </div>

        {/* This Month Grand Total */}
        <div
          onClick={() => setSelectedPeriod("month")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
            selectedPeriod === "month"
              ? "bg-teal-50 dark:bg-teal-950/60 border-teal-500 ring-2 ring-teal-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>This Month</span>
            <Layers className="w-3.5 h-3.5 text-blue-600" />
          </div>
          {loadingSummary ? (
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mt-1.5" />
          ) : (
            <p className="text-lg sm:text-xl font-mono font-bold text-blue-700 dark:text-blue-400 mt-1">
              {formatINR(grandTotals.month)}
            </p>
          )}
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
            From {dates.month_start}
          </span>
        </div>

        {/* This Year Grand Total */}
        <div
          onClick={() => setSelectedPeriod("year")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs col-span-2 sm:col-span-1 ${
            selectedPeriod === "year"
              ? "bg-teal-50 dark:bg-teal-950/60 border-teal-500 ring-2 ring-teal-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>This Year</span>
            <Coins className="w-3.5 h-3.5 text-amber-600" />
          </div>
          {loadingSummary ? (
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mt-1.5" />
          ) : (
            <p className="text-lg sm:text-xl font-mono font-bold text-amber-700 dark:text-amber-400 mt-1">
              {formatINR(grandTotals.year)}
            </p>
          )}
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
            From {dates.year_start}
          </span>
        </div>
      </div>
      </FadeIn>

      {/* VIEW & PERIOD NAVIGATION TABS */}
      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedPeriod("matrix")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === "matrix"
                ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Table className="w-3.5 h-3.5 text-teal-400" />
            <span>Comparison Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPeriod("today")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === "today"
                ? "bg-[#0F766E] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>Today</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-teal-800 text-teal-100">
              {formatINR(grandTotals.today)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPeriod("yesterday")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === "yesterday"
                ? "bg-[#0F766E] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>Previous Day</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {formatINR(grandTotals.yesterday)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPeriod("week")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === "week"
                ? "bg-[#0F766E] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>This Week</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {formatINR(grandTotals.week)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPeriod("month")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === "month"
                ? "bg-[#0F766E] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>This Month</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {formatINR(grandTotals.month)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPeriod("year")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === "year"
                ? "bg-[#0F766E] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>This Year</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {formatINR(grandTotals.year)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPeriod("splits")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === "splits"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-teal-400" />
            <span>Customer Splits</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-700 text-slate-200">
              {allAssignments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPeriod("accounts")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === "accounts"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Handshake className="w-3.5 h-3.5" />
            <span>Party Master</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {parties.length}
            </span>
          </button>
        </div>

        <Link
          href="/distributors"
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline px-2 py-1 shrink-0"
        >
          <span>India Distribution Module</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* VIEW 1: COMPARISON MATRIX TABLE (SHOWS EVERY PARTY SEPARATELY + GRAND TOTAL ROW) */}
      {selectedPeriod === "matrix" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Table className="w-4 h-4 text-teal-600" />
                <span>INR Parties Split Allocation Matrix</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Breakdown of customer remittance splits assigned to each India party across all periods.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Today: <span className="font-bold text-slate-900 dark:text-slate-100">{dates.today}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-2.5">INR Party</th>
                  <th className="py-2.5 px-2 text-right">Today</th>
                  <th className="py-2.5 px-2 text-right">Yesterday</th>
                  <th className="py-2.5 px-2 text-right">This Week</th>
                  <th className="py-2.5 px-2 text-right">This Month</th>
                  <th className="py-2.5 px-2 text-right">This Year</th>
                  <th className="py-2.5 px-2 text-right">All-Time Total</th>
                  <th className="py-2.5 px-1.5 text-center">Splits</th>
                  <th className="py-2.5 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                {loadingSummary ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                      Loading party split analytics...
                    </td>
                  </tr>
                ) : partyRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                      No INR parties found.
                    </td>
                  </tr>
                ) : (
                  partyRows.map((party: any) => (
                    <tr
                      key={party.party_id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-2.5 font-bold text-slate-900 dark:text-slate-100">
                        <Link
                          href={`/parties/${party.party_id}`}
                          className="hover:text-teal-600 hover:underline flex items-center gap-1.5"
                        >
                          <Handshake className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate max-w-[120px]">{party.party_name}</span>
                          {party.party_code && (
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              ({party.party_code})
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {party.today_inr > 0 ? (
                          <span className="text-teal-700 dark:text-teal-400 font-bold">
                            {formatINR(party.today_inr)}
                          </span>
                        ) : (
                          <span className="text-slate-400">₹ 0.00</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {party.yesterday_inr > 0 ? (
                          <span>{formatINR(party.yesterday_inr)}</span>
                        ) : (
                          <span className="text-slate-400">₹ 0.00</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-teal-700 dark:text-teal-400 whitespace-nowrap">
                        {party.week_inr > 0 ? (
                          <span>{formatINR(party.week_inr)}</span>
                        ) : (
                          <span className="text-slate-400">₹ 0.00</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                        {party.month_inr > 0 ? (
                          <span>{formatINR(party.month_inr)}</span>
                        ) : (
                          <span className="text-slate-400">₹ 0.00</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        {party.year_inr > 0 ? (
                          <span>{formatINR(party.year_inr)}</span>
                        ) : (
                          <span className="text-slate-400">₹ 0.00</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatINR(party.total_inr)}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-mono text-xs whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                          {party.split_count}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/parties/${party.party_id}`}
                            className="p-1 text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            title="View Statement & History"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setPartyFilter(party.party_id);
                              setSelectedPeriod("splits");
                            }}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="View Customer Splits for this party"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* DISTINCT GRAND TOTAL FOOTER ROW */}
              <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                <tr>
                  <td className="py-3 px-2.5 uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>GRAND TOTAL</span>
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs text-teal-400 font-bold whitespace-nowrap">
                    {formatINR(grandTotals.today)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs text-slate-200 font-bold whitespace-nowrap">
                    {formatINR(grandTotals.yesterday)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs text-teal-300 font-bold whitespace-nowrap">
                    {formatINR(grandTotals.week)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs text-blue-300 font-bold whitespace-nowrap">
                    {formatINR(grandTotals.month)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs text-amber-300 font-bold whitespace-nowrap">
                    {formatINR(grandTotals.year)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs text-white font-black whitespace-nowrap">
                    {formatINR(grandTotals.total)}
                  </td>
                  <td className="py-3 px-1.5 text-center font-mono text-xs text-slate-300 font-bold whitespace-nowrap">
                    {allAssignments.length}
                  </td>
                  <td className="py-3 px-2 text-right text-[10px] text-slate-400 whitespace-nowrap">All Parties</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: SPECIFIC PERIOD FOCUS (TODAY | PREVIOUS DAY | WEEK | MONTH | YEAR) */}
      {["today", "yesterday", "week", "month", "year"].includes(selectedPeriod) && (
        <div className="space-y-4">
          {/* Period Header Card */}
          <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-5 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                {selectedPeriod === "today"
                  ? "Today's Split Allocation"
                  : selectedPeriod === "yesterday"
                  ? "Previous Day (Yesterday's Split Allocation)"
                  : selectedPeriod === "week"
                  ? "This Week's Split Allocation"
                  : selectedPeriod === "month"
                  ? "This Month's Split Allocation"
                  : "This Year's Split Allocation"}
              </span>
              <h3 className="text-2xl font-mono font-black mt-1 text-white">
                {formatINR(
                  selectedPeriod === "today"
                    ? grandTotals.today
                    : selectedPeriod === "yesterday"
                    ? grandTotals.yesterday
                    : selectedPeriod === "week"
                    ? grandTotals.week
                    : selectedPeriod === "month"
                    ? grandTotals.month
                    : grandTotals.year
                )}
              </h3>
              <p className="text-xs text-teal-200/80 mt-1">
                Grand total of all customer remittance amounts assigned across all India parties for this period.
              </p>
            </div>

            <button
              onClick={() => setSelectedPeriod("matrix")}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-bold transition-colors self-start sm:self-auto cursor-pointer"
            >
              View Full Matrix Table
            </button>
          </div>

          {/* Cards for each party in this period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {partyRows.map((p: any) => {
              const amount =
                selectedPeriod === "today"
                  ? p.today_inr
                  : selectedPeriod === "yesterday"
                  ? p.yesterday_inr
                  : selectedPeriod === "week"
                  ? p.week_inr
                  : selectedPeriod === "month"
                  ? p.month_inr
                  : p.year_inr;

              const periodGrand =
                selectedPeriod === "today"
                  ? grandTotals.today
                  : selectedPeriod === "yesterday"
                  ? grandTotals.yesterday
                  : selectedPeriod === "week"
                  ? grandTotals.week
                  : selectedPeriod === "month"
                  ? grandTotals.month
                  : grandTotals.year;

              const pct = periodGrand > 0 ? ((amount / periodGrand) * 100).toFixed(1) : "0.0";

              return (
                <div
                  key={p.party_id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Handshake className="w-3.5 h-3.5 text-teal-600" />
                      <span>{p.party_name}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{pct}%</span>
                  </div>

                  <p className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                    {formatINR(amount)}
                  </p>

                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                    <span>Code: {p.party_code}</span>
                    <Link
                      href={`/parties/${p.party_id}`}
                      className="text-teal-600 hover:underline font-semibold"
                    >
                      Statement ➔
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Customer Splits assigned during this period */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                <span>Customer Remittance Splits in this Period</span>
              </h4>
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                Total: {formatINR(totalFilteredSplitInr)}
              </span>
            </div>

            {filteredAssignments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No customer remittance splits recorded in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Txn ID</th>
                      <th className="py-3 px-4">Assigned INR Party</th>
                      <th className="py-3 px-4 text-right">Split Amount</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredAssignments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{a.split_date}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                          {a.customer_name}
                          {a.customer_code && (
                            <span className="text-[10px] text-slate-400 font-mono ml-1 font-normal">
                              ({a.customer_code})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {a.transaction_number}
                        </td>
                        <td className="py-3 px-4 font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                          <Handshake className="w-3 h-3 text-teal-600" />
                          <span>{a.distributor_name}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatINR(a.inr_amount)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: CUSTOMER REMITTANCE SPLITS LEDGER (ALL ASSIGNMENTS) */}
      {selectedPeriod === "splits" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer, txn ID, party, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs font-medium pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
                className="text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All INR Parties ({partyRows.length})</option>
                {partyRows.map((p: any) => (
                  <option key={p.party_id} value={p.party_id}>
                    {p.party_name} {p.party_code ? `(${p.party_code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>Customer Remittances Assigned to INR Parties</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Showing {filteredAssignments.length} split allocation records.
                </p>
              </div>
              <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                Filtered Total: <span className="text-teal-600 font-extrabold">{formatINR(totalFilteredSplitInr)}</span>
              </div>
            </div>

            {filteredAssignments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No customer remittance splits match your query.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Txn / Date</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Assigned INR Party</th>
                      <th className="py-2.5 px-3 text-right">Split Amount</th>
                      <th className="py-2.5 px-3">Status & Notes</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredAssignments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{a.transaction_number}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{a.split_date}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <Link
                            href={`/customers/${a.customer_id}`}
                            className="font-bold text-slate-900 dark:text-slate-100 hover:text-teal-700 hover:underline"
                          >
                            {a.customer_name}
                          </Link>
                          {a.customer_code && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              ({a.customer_code})
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-teal-700 dark:text-teal-400">
                          <Link
                            href={`/parties/${a.distributor_id}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            <Handshake className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span>{a.distributor_name}</span>
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatINR(a.inr_amount)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {a.status}
                          </span>
                          {a.notes && (
                            <div className="text-slate-400 text-[10px] truncate max-w-[140px] mt-0.5" title={a.notes}>
                              {a.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <Link
                            href={`/parties/${a.distributor_id}`}
                            className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors inline-block"
                            title="View Party Statement"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-700">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 uppercase text-[10px]">
                        Filtered Splits Total
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs font-black text-teal-700 dark:text-teal-400 whitespace-nowrap">
                        {formatINR(totalFilteredSplitInr)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 4: PARTY MASTER & ACCOUNTS (REGISTRY & BALANCES) */}
      {selectedPeriod === "accounts" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search party by name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs font-medium pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Region Filter */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRegionFilter("all")}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    regionFilter === "all"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  All ({parties.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRegionFilter("DUBAI")}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    regionFilter === "DUBAI"
                      ? "bg-teal-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <span>🇦🇪 Dubai</span>
                  <span className="text-[10px] opacity-80 font-mono">
                    ({parties.filter((p) => p.party_type !== "INDIA").length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegionFilter("INDIA")}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    regionFilter === "INDIA"
                      ? "bg-orange-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <span>🇮🇳 India</span>
                  <span className="text-[10px] opacity-80 font-mono">
                    ({parties.filter((p) => p.party_type === "INDIA").length})
                  </span>
                </button>
              </div>

              {/* Status / Balance Filter */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {[
                  { id: "all", label: "All Balances" },
                  { id: "owing", label: "Has Balance" },
                  { id: "cleared", label: "Settled / Cleared" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setBalanceFilter(tab.id)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      balanceFilter === tab.id
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Parties Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs">Loading parties...</div>
            ) : filteredParties.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                {search ? "No parties match your search query." : "No parties found."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Party Name</th>
                      <th className="py-2.5 px-3">Default Rate</th>
                      <th className="py-2.5 px-3 text-right">Total Orders (INR)</th>
                      <th className="py-2.5 px-3 text-right">AED Billed & Paid</th>
                      <th className="py-2.5 px-3 text-right">Balance Due</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    {filteredParties.map((party) => {
                      const hasDue = (party.outstanding_balance || 0) > 0.01;
                      return (
                        <tr
                          key={party.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <Link
                              href={`/parties/${party.id}`}
                              className="font-bold text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1.5"
                            >
                              <Handshake className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>{party.name}</span>
                            </Link>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                                party.party_type === "INDIA"
                                  ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-800"
                                  : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800"
                              }`}>
                                {party.party_type === "INDIA" ? "🇮🇳 India" : "🇦🇪 Dubai"}
                              </span>
                              {party.code && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {party.code}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-600 dark:text-slate-300">
                            {party.default_rate ? Number(party.default_rate).toFixed(2) : "38.25"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            ₹{Number(party.total_inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                              {Number(party.total_aed || 0).toFixed(2)} AED
                            </div>
                            <div className="text-[10px] font-mono text-teal-700 dark:text-teal-400">
                              Paid: {Number(party.total_paid || 0).toFixed(2)} AED
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                            {hasDue ? (
                              <span className="text-rose-600 dark:text-rose-400">
                                {Number(party.outstanding_balance).toFixed(2)} AED
                              </span>
                            ) : (
                              <span className="text-teal-700 dark:text-teal-400 font-medium">
                                0.00 AED
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {hasDue && (
                                <button
                                  onClick={() => handleOpenPayModal(party)}
                                  className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                  title="Record Settlement / Payment"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => openEditModal(party)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Edit Party"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setDeletePartyTarget(party)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Delete Party"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              <Link
                                href={`/parties/${party.id}`}
                                className="p-1.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded transition-colors"
                                title="View Statement / Ledger"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE PARTY MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Handshake className="w-5 h-5 text-teal-600" />
                <span>Register New Party</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateParty} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Party Region & Settlement Currency *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPartyType("DUBAI")}
                    className={`p-2.5 rounded-lg border text-left text-xs font-bold transition-all cursor-pointer ${
                      newPartyType === "DUBAI"
                        ? "bg-teal-50 dark:bg-teal-950/70 border-teal-500 text-teal-900 dark:text-teal-200 ring-2 ring-teal-500/20"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>🇦🇪</span>
                      <span>Dubai Party (AED)</span>
                    </div>
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">e.g. HAJA, SARAB, NF2</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPartyType("INDIA")}
                    className={`p-2.5 rounded-lg border text-left text-xs font-bold transition-all cursor-pointer ${
                      newPartyType === "INDIA"
                        ? "bg-orange-50 dark:bg-orange-950/70 border-orange-500 text-orange-900 dark:text-orange-200 ring-2 ring-orange-500/20"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>🇮🇳</span>
                      <span>Indian Party (INR)</span>
                    </div>
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">e.g. MK, SALA</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Party Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder={newPartyType === "DUBAI" ? "e.g. HAJA, SARAB, NF2..." : "e.g. MK, SALA..."}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Party Code
                  </label>
                  <input
                    type="text"
                    placeholder={newPartyType === "DUBAI" ? "e.g. HJA" : "e.g. MK"}
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Default Rate
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="38.25"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+971..."
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Registering..." : "Register Party"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PARTY MODAL */}
      {editParty && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <span>Edit Party Profile</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditParty(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold cursor-pointer"
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

            <form onSubmit={handleSaveEditParty} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Party Region
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPartyType("DUBAI")}
                    className={`p-2.5 rounded-lg border text-left text-xs font-bold transition-all cursor-pointer ${
                      editPartyType === "DUBAI"
                        ? "bg-teal-50 dark:bg-teal-950/70 border-teal-500 text-teal-900 dark:text-teal-200 ring-2 ring-teal-500/20"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>🇦🇪</span>
                      <span>Dubai Party (AED)</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPartyType("INDIA")}
                    className={`p-2.5 rounded-lg border text-left text-xs font-bold transition-all cursor-pointer ${
                      editPartyType === "INDIA"
                        ? "bg-orange-50 dark:bg-orange-950/70 border-orange-500 text-orange-900 dark:text-orange-200 ring-2 ring-orange-500/20"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>🇮🇳</span>
                      <span>Indian Party (INR)</span>
                    </div>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Party Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Party Code
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Default Rate
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditParty(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {editSubmitting ? "Saving..." : "Update Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PARTY CONFIRMATION MODAL */}
      {deletePartyTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Delete Party Account?
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to delete{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {deletePartyTarget.name}
              </strong>
              ? This action cannot be undone if the party has recorded transactions.
            </p>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletePartyTarget(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleDeleteParty}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleteSubmitting ? "Deleting..." : "Delete Party"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK SETTLEMENT PAYMENT MODAL */}
      {payingParty && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-700" />
                <span>Record Party Settlement Payment</span>
              </h3>
              <button
                type="button"
                onClick={() => setPayingParty(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold cursor-pointer"
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
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Party Account:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{payingParty.name}</span>
                </div>
                <div className="flex justify-between text-rose-700 dark:text-rose-400 font-bold pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Current Outstanding Due:</span>
                  <span>{formatAED(payingParty.outstanding_balance)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Amount (AED) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
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
                  className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Settlement Notes
                </label>
                <textarea
                  rows={2}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Notes, reference number or payment details..."
                  className="w-full text-xs font-medium p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayingParty(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {paySubmitting ? "Recording..." : "Save Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
