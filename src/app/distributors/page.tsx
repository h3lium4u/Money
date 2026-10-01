"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { numberToIndianWords } from "@/lib/number-to-words";
import { getTodayDateString } from "@/lib/date-utils";
import {
  Building2,
  Coins,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Banknote,
  Split,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  HelpCircle,
  Edit3,
  Trash2,
  User,
  ChevronRight,
  ChevronDown,
  Filter,
} from "lucide-react";

export default function IndiaDistributionPage() {
  const [activeTab, setActiveTab] = useState<"splits" | "partners" | "aed">("splits");
  const [distributors, setDistributors] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded transaction rows for detailed split breakdowns
  const [expandedTxnIds, setExpandedTxnIds] = useState<Set<string>>(new Set());

  function toggleExpandTxn(txnId: string) {
    setExpandedTxnIds((prev) => {
      const next = new Set(prev);
      if (next.has(txnId)) next.delete(txnId);
      else next.add(txnId);
      return next;
    });
  }

  // Selected Customer / Remittance Txn for focused split operations
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null);

  // Split Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTxnId, setModalTxnId] = useState("");
  const [modalDistId, setModalDistId] = useState("");
  const [modalDate, setModalDate] = useState(getTodayDateString());
  const [modalAmount, setModalAmount] = useState("");
  const [modalRate, setModalRate] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Split State
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [editDistId, setEditDistId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Split State
  const [deleteSplitTarget, setDeleteSplitTarget] = useState<any | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filter / Sort / Search State
  const [searchText, setSearchText] = useState("");
  const [filterDistributor, setFilterDistributor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortField, setSortField] = useState<"date" | "customer" | "distributor" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [groupByDistributor, setGroupByDistributor] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  function handleSelectTxn(txnId: string) {
    if (selectedTxnId === txnId) {
      setSelectedTxnId(null);
    } else {
      setSelectedTxnId(txnId);
      setModalTxnId(txnId);
    }
  }

  function openAddModalForTxn(txn: any) {
    setSelectedTxnId(txn.id);
    setModalTxnId(txn.id);
    const rem = Number(txn.remaining_inr || 0);
    setModalAmount(rem > 0 ? String(rem) : "");
    setModalDate(txn.transaction_date || getTodayDateString());
    setModalRate(txn.base_rate ? String(txn.base_rate) : "");
    setModalNotes("");
    setModalError(null);
    setShowAddModal(true);
  }

  function handleOpenTopAddModal() {
    const active = transactions.find((t) => t.id === selectedTxnId || t.transaction_number === selectedTxnId);
    if (active) {
      openAddModalForTxn(active);
    } else {
      const pendingTxn = transactions.find((t) => (t.remaining_inr || 0) > 0) || transactions[0];
      if (pendingTxn) {
        openAddModalForTxn(pendingTxn);
      } else {
        setModalDate(getTodayDateString());
        setShowAddModal(true);
      }
    }
  }

  function openEditSplit(s: any) {
    setEditSplit(s);
    setEditDistId(s.distributor_id);
    setEditDate(s.split_date);
    setEditAmount(String(s.inr_amount));
    setEditRate(s.wholesale_rate ? String(s.wholesale_rate) : "");
    setEditNotes(s.notes || "");
    setEditError(null);
  }

  async function handleUpdateSplit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSplit) return;
    setEditSubmitting(true);
    setEditError(null);

    try {
      const res = await fetch("/api/distribution-splits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editSplit.id,
          distributor_id: editDistId,
          split_date: editDate,
          inr_amount: parseFloat(editAmount),
          wholesale_rate: editRate ? parseFloat(editRate) : undefined,
          notes: editNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update split");

      setEditSplit(null);
      loadData();
    } catch (err: any) {
      setEditError(err.message || "Failed to update split");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteSplit() {
    if (!deleteSplitTarget) return;
    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/distribution-splits?id=${deleteSplitTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete split");

      setDeleteSplitTarget(null);
      loadData();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete split");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [distRes, splitsRes, txnsRes] = await Promise.all([
        fetch("/api/distributors"),
        fetch("/api/distribution-splits"),
        fetch("/api/transactions?limit=100"),
      ]);

      const distData = await distRes.json();
      const splitsData = await splitsRes.json();
      const txnsData = await txnsRes.json();

      const validDists = Array.isArray(distData) ? distData : [];
      const validSplits = Array.isArray(splitsData) ? splitsData : [];
      const validTxns = Array.isArray(txnsData) ? txnsData : [];

      setDistributors(validDists);
      setSplits(validSplits);
      setTransactions(validTxns);

      if (validDists.length > 0) {
        setModalDistId(validDists[0].id);
      }
      if (validTxns.length > 0) {
        setModalTxnId(validTxns[0].id);
      }

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const txnParam = params.get("txn");
        if (txnParam && validTxns.length > 0) {
          const match = validTxns.find((t: any) => t.id === txnParam || t.transaction_number === txnParam);
          if (match) {
            setSelectedTxnId(match.id);
            setModalTxnId(match.id);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setDistributors([]);
      setSplits([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSplit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch("/api/distribution-splits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: modalTxnId,
          distributor_id: modalDistId,
          split_date: modalDate,
          inr_amount: parseFloat(modalAmount),
          wholesale_rate: modalRate ? parseFloat(modalRate) : undefined,
          notes: modalNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowAddModal(false);
      setModalAmount("");
      setModalNotes("");
      loadData();
    } catch (err: any) {
      setModalError(err.message || "Failed to create split");
    } finally {
      setSubmitting(false);
    }
  }

  const formatINR = (val?: number) =>
    `₹ ${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatAED = (val?: number) =>
    `${(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

  // Filter parties by group_type (new structured groups)
  // IND group = India-side parties for distribution splits
  const confirmedIndiaParties = distributors.filter((d) => d.group_type === "IND");
  // AED group = AED-side parties  
  const aedParties = distributors.filter((d) => d.group_type === "AED" && d.partner_type !== "BANK_ACCOUNT");
  // SARABU exists in both — clearly visible in each group
  const unconfirmedParties: any[] = []; // No more UNCONFIRMED — all parties have been confirmed with group_type


  // Selected Txn in page / modal
  const selectedTxn = transactions.find(
    (t) => t.id === selectedTxnId || t.transaction_number === selectedTxnId
  );
  const selectedModalTxn = transactions.find((t) => t.id === modalTxnId) || selectedTxn || transactions[0];

  // Base pool: filter by selected customer first
  const baseSplits = selectedTxnId
    ? splits.filter(
        (s) =>
          s.transaction_id === selectedTxnId ||
          s.transaction_number === selectedTxn?.transaction_number
      )
    : splits;

  // Apply search + filters to raw splits (for grouped view)
  const filteredSplits = baseSplits.filter((s) => {
    const q = searchText.toLowerCase();
    if (q && !(
      s.customer_name?.toLowerCase().includes(q) ||
      s.distributor_name?.toLowerCase().includes(q) ||
      s.distributor_code?.toLowerCase().includes(q) ||
      s.transaction_number?.toLowerCase().includes(q) ||
      s.notes?.toLowerCase().includes(q)
    )) return false;
    if (filterDistributor !== "all" && s.distributor_id !== filterDistributor) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

  // Combine splits by transaction so each customer transaction is ONE single line
  const combinedTxnRows = transactions
    .map((t) => {
      const txnSplits = splits.filter(
        (s) => s.transaction_id === t.id || s.transaction_number === t.transaction_number
      );
      const totalAllocated = txnSplits.reduce((sum, s) => sum + Number(s.inr_amount || 0), 0);
      const orderInr = Number(t.inr_amount || 0);
      const remainingInr = Math.max(0, orderInr - totalAllocated);
      const isFullyAllocated = remainingInr === 0 && totalAllocated > 0;

      // Group distributors for this transaction
      const distMap: Record<string, { id: string; name: string; code: string; inr_amount: number; aed_equivalent: number }> = {};
      txnSplits.forEach((s) => {
        const dId = s.distributor_id;
        const dName = s.distributor_name || s.distributor_code || "Distributor";
        if (!distMap[dId]) {
          distMap[dId] = {
            id: dId,
            name: dName,
            code: s.distributor_code || dName,
            inr_amount: 0,
            aed_equivalent: 0,
          };
        }
        distMap[dId].inr_amount += Number(s.inr_amount || 0);
        distMap[dId].aed_equivalent += Number(s.aed_equivalent || 0);
      });

      const distList = Object.values(distMap);
      const distNamesStr = distList.map((d) => d.name).join(", ");
      const totalAedEq = txnSplits.reduce((sum, s) => sum + Number(s.aed_equivalent || 0), 0);
      const latestDate = txnSplits.length > 0 ? txnSplits[0].split_date : t.transaction_date;

      return {
        id: t.id,
        transaction_number: t.transaction_number,
        transaction_date: latestDate,
        customer_id: t.customer_id,
        customer_code: t.customer_code,
        customer_name: t.customer_name,
        order_inr: orderInr,
        total_allocated_inr: totalAllocated,
        remaining_inr: remainingInr,
        wholesale_rate: txnSplits[0]?.wholesale_rate || t.base_rate,
        total_aed_equivalent: totalAedEq,
        distributors: distList,
        distributor_names_str: distNamesStr || "-",
        is_fully_allocated: isFullyAllocated,
        status: isFullyAllocated ? "FULLY ALLOCATED" : totalAllocated > 0 ? "PARTIAL" : "UNALLOCATED",
        splits: txnSplits,
        notes: txnSplits.map((s) => s.notes).filter(Boolean).join("; ") || t.notes || "-",
        raw_txn: t,
      };
    })
    .filter((row) => row.splits.length > 0 || (selectedTxnId && (row.id === selectedTxnId || row.transaction_number === selectedTxn?.transaction_number)));

  // Filter combined rows
  const filteredTxnRows = combinedTxnRows.filter((r) => {
    if (selectedTxnId && r.id !== selectedTxnId && r.transaction_number !== selectedTxn?.transaction_number) {
      return false;
    }
    const q = searchText.toLowerCase().trim();
    if (q && !(
      r.customer_name?.toLowerCase().includes(q) ||
      r.distributor_names_str?.toLowerCase().includes(q) ||
      r.transaction_number?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    )) return false;
    if (filterDistributor !== "all" && !r.distributors.some((d) => d.id === filterDistributor)) return false;
    if (filterStatus !== "all") {
      if (filterStatus === "COMPLETED" && !r.is_fully_allocated) return false;
      if (filterStatus === "ALLOCATED" && (r.is_fully_allocated || r.total_allocated_inr === 0)) return false;
      if (filterStatus === "PENDING" && r.remaining_inr === 0) return false;
    }
    return true;
  });

  // Apply sort to combined rows
  const sortTxnKey: Record<typeof sortField, (s: any) => any> = {
    date: (s) => s.transaction_date,
    customer: (s) => s.customer_name?.toLowerCase() ?? "",
    distributor: (s) => s.distributor_names_str?.toLowerCase() ?? "",
    amount: (s) => s.total_allocated_inr,
  };
  const displayedTxnRows = [...filteredTxnRows].sort((a, b) => {
    const va = sortTxnKey[sortField](a);
    const vb = sortTxnKey[sortField](b);
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // Apply sort to raw splits
  const sortKey: Record<typeof sortField, (s: any) => any> = {
    date: (s) => s.split_date,
    customer: (s) => s.customer_name?.toLowerCase() ?? "",
    distributor: (s) => s.distributor_name?.toLowerCase() ?? "",
    amount: (s) => s.inr_amount,
  };
  const displayedSplits = [...filteredSplits].sort((a, b) => {
    const va = sortKey[sortField](a);
    const vb = sortKey[sortField](b);
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // Group by distributor (for grouped view)
  const groupedByDistributor: Record<string, { name: string; code: string; color: string; splits: any[] }> = {};
  const DIST_COLORS = [
    "emerald", "blue", "violet", "amber", "rose", "cyan", "indigo", "teal",
  ];
  let colorIdx = 0;
  const distColorMap: Record<string, string> = {};
  displayedSplits.forEach((s) => {
    const key = s.distributor_id;
    if (!groupedByDistributor[key]) {
      if (!distColorMap[key]) {
        distColorMap[key] = DIST_COLORS[colorIdx % DIST_COLORS.length];
        colorIdx++;
      }
      groupedByDistributor[key] = {
        name: s.distributor_name || s.distributor_code || key,
        code: s.distributor_code || "",
        color: distColorMap[key],
        splits: [],
      };
    }
    groupedByDistributor[key].splits.push(s);
  });

  // Sort/cycle column header helper
  function handleSortClick(field: typeof sortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }
  const SortIcon = ({ field }: { field: typeof sortField }) => (
    <span className="ml-0.5 inline-block text-[10px] opacity-60">
      {sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const activeFilters =
    searchText.trim() !== "" ||
    filterDistributor !== "all" ||
    filterStatus !== "all";

  const colorClasses: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    emerald: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900", badge: "bg-teal-100 text-teal-800 border-teal-300" },
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", badge: "bg-blue-100 text-blue-800 border-blue-300" },
    violet: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-900", badge: "bg-violet-100 text-violet-800 border-violet-300" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", badge: "bg-amber-100 text-amber-800 border-amber-300" },
    rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-900", badge: "bg-rose-100 text-rose-800 border-rose-300" },
    cyan: { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-900", badge: "bg-cyan-100 text-cyan-800 border-cyan-300" },
    indigo: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-900", badge: "bg-indigo-100 text-indigo-800 border-indigo-300" },
    teal: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900", badge: "bg-teal-100 text-teal-800 border-teal-300" },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Distribution Partners & Splits</span>
            <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-mono font-bold">
              Separate from Dubai Accounting
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            How received Dubai customer orders are allocated, split, and distributed across partner parties.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/parties"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold rounded-lg hover:bg-teal-100 shadow-2xs transition-colors"
          >
            <span>INR Parties Period Split Matrix ➔</span>
          </Link>

          <button
            onClick={handleOpenTopAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              {selectedTxn
                ? `+ Add Split for ${selectedTxn.customer_name}`
                : "+ Add Distribution Split"}
            </span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("splits")}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === "splits"
              ? "border-teal-700 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          1. Distribution Splits by Order ({splits.length})
        </button>
        <button
          onClick={() => setActiveTab("partners")}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === "partners"
              ? "border-teal-700 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          2. IND Parties ({confirmedIndiaParties.length})
        </button>
        <button
          onClick={() => setActiveTab("aed")}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "aed"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>3. AED Parties</span>
          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
            {aedParties.length}
          </span>
        </button>
      </div>

      {/* TAB 1: DISTRIBUTION SPLITS BY ORDER */}
      {activeTab === "splits" && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-3">
            <Split className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">One Customer Transaction ➔ Multiple India Distributions</p>
              <p className="text-slate-500 mt-0.5">
                Each Dubai customer order can be split among multiple India parties (e.g. MK, ISMAIL, SARABU). The system ensures total distribution cannot exceed the customer’s INR order amount.
              </p>
            </div>
          </div>

          {/* Customer Orders & Allocation Selector */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-teal-700" />
                  <span>Customer Orders & Remaining Allocation</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Click any customer below to view their remaining split balance and allocate to another India party.
                </p>
              </div>
              {selectedTxnId && (
                <button
                  type="button"
                  onClick={() => setSelectedTxnId(null)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-all"
                >
                  ✕ Show All ({splits.length} splits)
                </button>
              )}
            </div>

            {transactions.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No customer remittance orders found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {transactions.map((t) => {
                  const isSelected = selectedTxnId === t.id;
                  const rem = Number(t.remaining_inr || 0);
                  const isComplete = rem === 0;

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTxn(t.id)}
                      className={`cursor-pointer p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? "bg-teal-50 border-teal-500 ring-2 ring-teal-500/20 shadow-sm"
                          : "bg-slate-50/70 hover:bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-bold text-xs text-slate-900 truncate">{t.customer_name}</span>
                          {t.customer_code && (
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">({t.customer_code})</span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                            isComplete
                              ? "bg-teal-100 text-teal-800 border-teal-300"
                              : "bg-amber-100 text-amber-900 border-amber-300"
                          }`}
                        >
                          {isComplete ? "100% Split" : `Pending ${formatINR(rem)}`}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 flex justify-between items-center">
                        <span>{t.transaction_number}</span>
                        <span className="font-bold text-slate-700">₹{Number(t.inr_amount).toLocaleString()}</span>
                      </div>
                      {!isComplete && (
                        <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                          <span className="text-[10px] text-amber-700 font-semibold">Remaining to split:</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddModalForTxn(t);
                            }}
                            className="text-[10px] font-bold text-white bg-teal-700 hover:bg-teal-800 px-2 py-0.5 rounded shadow-sm"
                          >
                            + Split
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ACTIVE SELECTED CUSTOMER BANNER */}
          {selectedTxn && (
            <div className="p-4 bg-teal-50 border-2 border-teal-400 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-teal-950 bg-teal-200 px-2 py-0.5 rounded">
                    Selected Customer
                  </span>
                  <span className="text-base font-extrabold text-slate-900">{selectedTxn.customer_name}</span>
                  <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-teal-300">
                    {selectedTxn.transaction_number}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 pt-1">
                  <span>Total Order: <strong className="text-slate-900">{formatINR(selectedTxn.inr_amount)}</strong></span>
                  <span>Allocated: <strong className="text-emerald-700">{formatINR(selectedTxn.total_distributed_inr)}</strong></span>
                  <span>
                    Remaining to Split:{" "}
                    <strong
                      className={
                        (selectedTxn.remaining_inr || 0) > 0
                          ? "text-amber-800 font-extrabold text-sm"
                          : "text-teal-700 font-bold"
                      }
                    >
                      {formatINR(selectedTxn.remaining_inr)}
                    </strong>
                  </span>
                  {(selectedTxn.remaining_inr || 0) > 0 && numberToIndianWords(selectedTxn.remaining_inr) && (
                    <span className="text-[11px] text-teal-900 bg-white px-2 py-0.5 rounded border border-teal-200 font-medium">
                      ({numberToIndianWords(selectedTxn.remaining_inr)})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {(selectedTxn.remaining_inr || 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => openAddModalForTxn(selectedTxn)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ Add Split for {selectedTxn.customer_name} ({formatINR(selectedTxn.remaining_inr)})</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>100% Fully Distributed</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedTxnId(null)}
                  className="px-2.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-300"
                >
                  Show All
                </button>
              </div>
            </div>
          )}

          {/* ─── Filter & Sort Bar ─── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Global search */}
              <div className="relative flex-1 min-w-[200px]">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search customer, distributor, txn…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                />
              </div>

              {/* Distributor dropdown */}
              <select
                value={filterDistributor}
                onChange={(e) => setFilterDistributor(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50 text-slate-700"
              >
                <option value="all">All Distributors</option>
                {confirmedIndiaParties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>

              {/* Status dropdown */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50 text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="ALLOCATED">Allocated</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
              </select>

              {/* Group toggle */}
              <button
                type="button"
                onClick={() => setGroupByDistributor((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  groupByDistributor
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-700"
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>Group by Distributor</span>
              </button>

              {/* Clear */}
              {activeFilters && (
                <button
                  type="button"
                  onClick={() => { setSearchText(""); setFilterDistributor("all"); setFilterStatus("all"); }}
                  className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 rounded-lg"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Summary row */}
            <div className="flex items-center gap-3 text-[10px] text-slate-500 border-t border-slate-100 pt-2">
              <span>
                Showing <strong className="text-slate-800">{groupByDistributor ? displayedSplits.length : displayedTxnRows.length}</strong>
                {" "}{groupByDistributor ? "splits" : "customer transactions"} (<strong className="text-slate-800">{splits.length}</strong> splits total)
              </span>
              {activeFilters && (
                <span className="bg-teal-100 text-teal-800 border border-teal-300 px-1.5 py-0.5 rounded font-bold">
                  Filtered
                </span>
              )}
              {selectedTxnId && (
                <>
                  <span className="text-slate-300">|</span>
                  <span>
                    Customer: <strong className="text-teal-700">{selectedTxn?.customer_name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTxnId(null)}
                    className="text-teal-700 font-bold hover:underline"
                  >
                    View all →
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ─── Table / Grouped View ─── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {groupByDistributor ? (
              /* ── GROUPED VIEW ── */
              displayedSplits.length === 0 ? (
                <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Split className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No distribution splits found</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your filters or add a new split</p>
                  </div>
                  <button
                    onClick={handleOpenTopAddModal}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add Split
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {Object.values(groupedByDistributor).map((group) => {
                    const cc = colorClasses[group.color] || colorClasses["emerald"];
                    const groupTotal = group.splits.reduce((sum, s) => sum + (s.inr_amount || 0), 0);
                    const groupAed = group.splits.reduce((sum, s) => sum + (s.aed_equivalent || 0), 0);
                    return (
                      <div key={group.name} className="overflow-hidden">
                        {/* Group header */}
                        <div className={`flex items-center justify-between px-4 py-2.5 ${cc.bg} border-b ${cc.border}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded border ${cc.badge}`}>
                              {group.code || group.name}
                            </span>
                            <span className={`text-xs font-semibold ${cc.text}`}>{group.name}</span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {group.splits.length} split{group.splits.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="text-xs text-slate-700 flex items-center gap-3">
                            <span>Total INR: <strong className="text-slate-900">{formatINR(groupTotal)}</strong></span>
                            <span>Total AED: <strong className="text-slate-900">{formatAED(groupAed)}</strong></span>
                          </div>
                        </div>
                        {/* Group rows */}
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50/70 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-100">
                            <tr>
                              <th className="px-3 py-2">Txn / Date</th>
                              <th className="px-3 py-2">Customer</th>
                              <th className="px-3 py-2">INR Allocated</th>
                              <th className="px-3 py-2">AED / Rate</th>
                              <th className="px-3 py-2">Status & Notes</th>
                              <th className="px-3 py-2 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 font-medium">
                            {group.splits.map((s: any) => {
                              const rowTxn = transactions.find(
                                (t) => t.id === s.transaction_id || t.transaction_number === s.transaction_number
                              );
                              const isCustomerSelected = selectedTxnId === (rowTxn?.id || s.transaction_id);
                              return (
                                <tr
                                  key={s.id}
                                  className={`hover:bg-slate-50/60 transition-colors ${isCustomerSelected ? "bg-teal-50/30" : ""}`}
                                >
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <div className="font-mono font-bold text-slate-800 text-[11px]">{s.transaction_number}</div>
                                    <div className="text-[10px] text-slate-500">{s.split_date}</div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectTxn(rowTxn?.id || s.transaction_id)}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all ${
                                        isCustomerSelected
                                          ? "bg-teal-700 text-white"
                                          : "text-slate-800 bg-slate-100 hover:bg-teal-100 hover:text-teal-900 border border-slate-200"
                                      }`}
                                    >
                                      <User className="w-3 h-3 shrink-0" />
                                      <span className="truncate max-w-[120px]">{s.customer_name}</span>
                                      {s.customer_code && (
                                        <span className="text-[10px] font-mono opacity-70">({s.customer_code})</span>
                                      )}
                                    </button>
                                  </td>
                                  <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">{formatINR(s.inr_amount)}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <div className="text-slate-700 font-semibold">{s.aed_equivalent ? formatAED(s.aed_equivalent) : "-"}</div>
                                    <div className="text-[10px] font-mono text-slate-500">Rate: {s.wholesale_rate?.toFixed(2) ?? "-"}</div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                      s.status === "COMPLETED"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border border-amber-200"
                                    }`}>
                                      {s.status}
                                    </span>
                                    {s.notes && (
                                      <div className="text-[10px] text-slate-500 max-w-[120px] truncate mt-0.5" title={s.notes}>
                                        {s.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1.5">
                                      {rowTxn && (rowTxn.remaining_inr || 0) > 0 && (
                                        <button type="button" onClick={() => openAddModalForTxn(rowTxn)}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-teal-800 bg-teal-100 hover:bg-teal-200 rounded border border-teal-300">
                                          <PlusCircle className="w-3 h-3" />+ Split
                                        </button>
                                      )}
                                      <button type="button" onClick={() => openEditSplit(s)}
                                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200">
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button type="button" onClick={() => { setDeleteSplitTarget(s); setDeleteError(null); }}
                                        className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded border border-rose-200">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* ── FLAT TABLE VIEW ── */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200 text-[10px]">
                    <tr>
                      <th
                        className="px-3 py-2.5 cursor-pointer select-none hover:text-slate-800"
                        onClick={() => handleSortClick("date")}
                      >
                        Txn ID / Date <SortIcon field="date" />
                      </th>
                      <th
                        className="px-3 py-2.5 cursor-pointer select-none hover:text-slate-800"
                        onClick={() => handleSortClick("customer")}
                      >
                        Customer <SortIcon field="customer" />
                      </th>
                      <th
                        className="px-3 py-2.5 cursor-pointer select-none hover:text-slate-800"
                        onClick={() => handleSortClick("distributor")}
                      >
                        India Distributor(s) <SortIcon field="distributor" />
                      </th>
                      <th
                        className="px-3 py-2.5 cursor-pointer select-none hover:text-slate-800"
                        onClick={() => handleSortClick("amount")}
                      >
                        INR Allocation <SortIcon field="amount" />
                      </th>
                      <th className="px-3 py-2.5">AED / Rate</th>
                      <th className="px-3 py-2.5">Status & Notes</th>
                      <th className="px-3 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {displayedTxnRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              <Split className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No distribution splits found</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your filters or add a new split</p>
                            </div>
                            <button
                              onClick={handleOpenTopAddModal}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              Add Split
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayedTxnRows.map((row) => {
                        const isCustomerSelected = selectedTxnId === row.id;
                        const isExpanded = expandedTxnIds.has(row.id);

                        return (
                          <Fragment key={row.id}>
                            <tr
                              className={`transition-colors ${
                                row.is_fully_allocated
                                  ? "bg-teal-50/20 hover:bg-teal-50/40"
                                  : isCustomerSelected
                                  ? "bg-teal-50/50 hover:bg-teal-50/70"
                                  : "hover:bg-slate-50/80"
                              }`}
                            >
                              {/* 1. Txn ID / Date */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="font-mono font-bold text-slate-900">{row.transaction_number}</div>
                                <div className="text-[10px] text-slate-500">{row.transaction_date}</div>
                              </td>

                              {/* 2. Customer */}
                              <td className="px-3 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => handleSelectTxn(row.id)}
                                  title={`Click to select ${row.customer_name} & view remaining split`}
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold transition-all ${
                                    isCustomerSelected
                                      ? "bg-teal-700 text-white shadow-2xs"
                                      : "text-slate-800 bg-slate-100 hover:bg-teal-100 hover:text-teal-900 border border-slate-200"
                                  }`}
                                >
                                  <User className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[120px]">{row.customer_name}</span>
                                  {row.customer_code && (
                                    <span className="text-[10px] font-mono opacity-70 ml-0.5">({row.customer_code})</span>
                                  )}
                                </button>
                                {row.is_fully_allocated ? (
                                  <div className="text-[10px] text-emerald-700 font-extrabold mt-0.5 flex items-center gap-0.5">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    <span>Fully Allocated</span>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                                    Pending {formatINR(row.remaining_inr)}
                                  </div>
                                )}
                              </td>

                              {/* 3. India Distributor(s) */}
                              <td className="px-3 py-2.5">
                                {row.distributors.length === 0 ? (
                                  <span className="text-slate-400 italic text-xs">Unallocated</span>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1">
                                    {row.distributors.map((d, dIdx) => (
                                      <span
                                        key={d.id + dIdx}
                                        className="inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                                        title={`${d.name}: Allocated ${formatINR(d.inr_amount)} (${formatAED(d.aed_equivalent)})`}
                                      >
                                        <span>{d.name}</span>
                                        <span className="text-[10px] text-teal-700 font-mono font-medium">
                                          ({formatINR(d.inr_amount)})
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>

                              {/* 4. INR Allocation */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="font-bold text-slate-900">{formatINR(row.total_allocated_inr)}</div>
                                <div className="text-[10px] text-slate-500">
                                  {row.is_fully_allocated ? "100% of " : "of "}{formatINR(row.order_inr)}
                                </div>
                              </td>

                              {/* 5. AED / Rate */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="font-bold text-slate-700">{row.total_aed_equivalent ? formatAED(row.total_aed_equivalent) : "-"}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  Rate: {row.wholesale_rate ? row.wholesale_rate.toFixed(2) : "-"}
                                </div>
                              </td>

                              {/* 6. Status & Notes */}
                              <td className="px-3 py-2.5">
                                {row.is_fully_allocated ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    <span>FULLY ALLOCATED</span>
                                  </span>
                                ) : row.total_allocated_inr > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    <span>PARTIAL ({row.splits.length})</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    <span>UNALLOCATED</span>
                                  </span>
                                )}
                                {row.notes && (
                                  <div className="text-[10px] text-slate-500 truncate max-w-[130px] mt-0.5" title={row.notes}>
                                    {row.notes}
                                  </div>
                                )}
                              </td>

                              {/* 7. Actions */}
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  {row.remaining_inr > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => openAddModalForTxn(row.raw_txn)}
                                      title={`Split remaining ${formatINR(row.remaining_inr)} with another distributor`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white bg-teal-700 hover:bg-teal-800 rounded shadow-2xs transition-colors"
                                    >
                                      <PlusCircle className="w-3 h-3" />
                                      <span>+ Split</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandTxn(row.id)}
                                    title="View / Edit individual split breakdowns"
                                    className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded border transition-colors ${
                                      isExpanded
                                        ? "bg-slate-800 text-white border-slate-800"
                                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    <span>Splits ({row.splits.length})</span>
                                    <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Individual Splits Sub-Table */}
                            {isExpanded && (
                              <tr className="bg-slate-50/70 border-b border-slate-200">
                                <td colSpan={7} className="px-4 py-3">
                                  <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-xs">
                                      <div className="font-bold text-slate-800 flex items-center gap-2">
                                        <span>Split Breakdown for {row.customer_name} ({row.transaction_number})</span>
                                        <span className="text-[10px] text-slate-500 font-normal">
                                          Order: {formatINR(row.order_inr)} • Allocated: {formatINR(row.total_allocated_inr)} • Remaining: {formatINR(row.remaining_inr)}
                                        </span>
                                      </div>
                                      {row.remaining_inr > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => openAddModalForTxn(row.raw_txn)}
                                          className="text-[10px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-200"
                                        >
                                          + Add Split ({formatINR(row.remaining_inr)} unallocated)
                                        </button>
                                      )}
                                    </div>
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase border-b border-slate-100">
                                        <tr>
                                          <th className="px-3 py-1.5">Split Date</th>
                                          <th className="px-3 py-1.5">Distributor</th>
                                          <th className="px-3 py-1.5">Allocated INR / Rate</th>
                                          <th className="px-3 py-1.5">AED Equivalent</th>
                                          <th className="px-3 py-1.5">Status & Notes</th>
                                          <th className="px-3 py-1.5 text-center">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-medium">
                                        {row.splits.map((s: any) => (
                                          <tr key={s.id} className="hover:bg-slate-50/80">
                                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{s.split_date}</td>
                                            <td className="px-3 py-2">
                                              <span className="font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-[11px]">
                                                {s.distributor_code || s.distributor_name}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                              <div className="font-bold text-slate-900">{formatINR(s.inr_amount)}</div>
                                              <div className="text-[10px] text-slate-500 font-mono">Rate: {s.wholesale_rate ? s.wholesale_rate.toFixed(2) : "-"}</div>
                                            </td>
                                            <td className="px-3 py-2 text-slate-700 whitespace-nowrap font-medium">{s.aed_equivalent ? formatAED(s.aed_equivalent) : "-"}</td>
                                            <td className="px-3 py-2">
                                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                {s.status}
                                              </span>
                                              {s.notes && (
                                                <div className="text-[10px] text-slate-500 max-w-[130px] truncate mt-0.5" title={s.notes}>
                                                  {s.notes}
                                                </div>
                                              )}
                                            </td>
                                            <td className="px-3 py-2 text-center whitespace-nowrap">
                                              <div className="flex items-center justify-center gap-1">
                                                <button
                                                  type="button"
                                                  onClick={() => openEditSplit(s)}
                                                  title="Edit Split"
                                                  className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200"
                                                >
                                                  <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => { setDeleteSplitTarget(s); setDeleteError(null); }}
                                                  title="Delete Split"
                                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded border border-rose-200"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
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
            )}
          </div>
        </div>
      )}

      {/* TAB 2: IND DISTRIBUTION PARTIES */}
      {activeTab === "partners" && (
        <div className="space-y-4">
          <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl flex items-start gap-3 text-xs text-teal-900">
            <Layers className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-teal-950">IND Distribution Group — India-side Parties</p>
              <p className="text-teal-800 mt-0.5 leading-relaxed">
                These are the India-side distributors. Dubai customer INR orders are split and allocated to these parties.
                <strong className="ml-1">SARABU (IND)</strong> is separate from <strong>SARABU (AED)</strong> — different accounts, different balances.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {confirmedIndiaParties.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900">{p.name}</h4>
                      <span className="text-[10px] font-extrabold bg-teal-100 text-teal-800 border border-teal-300 px-2 py-0.5 rounded">
                        IND
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">{p.code}</p>
                  </div>
                  <Building2 className="w-5 h-5 text-slate-400" />
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Total Distributed:</span>
                    <span className="font-bold text-slate-900">{formatINR(p.total_splits_inr)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Total Paid/Disbursed:</span>
                    <span className="font-bold text-emerald-600">{formatINR(p.total_splits_paid_inr)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-100">
                    <span>Pending Balance:</span>
                    <span className={`font-bold ${(p.splits_balance_inr || 0) > 0 ? "text-amber-700" : "text-teal-700"}`}>
                      {formatINR(p.splits_balance_inr)}
                    </span>
                  </div>
                </div>

                {p.client_confirmation_note && (
                  <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-100">
                    {p.client_confirmation_note}
                  </p>
                )}
              </div>
            ))}

            {confirmedIndiaParties.length === 0 && (
              <div className="col-span-3 text-center text-slate-400 text-xs py-8">
                No IND group parties found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AED DISTRIBUTION PARTIES */}
      {activeTab === "aed" && (
        <div className="space-y-4">
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-900">
            <Coins className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-blue-950">AED Distribution Group — AED-side Parties</p>
              <p className="text-blue-800 mt-0.5 leading-relaxed">
                These are the AED-side distribution parties. <strong>SALA · SARABU · MK · ISMAIL · NNG</strong>.
                TOTAL is automatically calculated — it is never a manual entry.
                <strong className="ml-1">SARABU (AED)</strong> is a separate account from <strong>SARABU (IND)</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aedParties.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900">{p.name}</h4>
                      <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded">
                        AED
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">{p.code}</p>
                  </div>
                  <Banknote className="w-5 h-5 text-blue-400" />
                </div>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <p className="text-[11px] text-slate-400 italic">
                    AED distribution records are tracked separately in the AED distribution workflow.
                  </p>
                </div>
              </div>
            ))}

            {aedParties.length === 0 && (
              <div className="col-span-3 text-center text-slate-400 text-xs py-8">
                No AED group parties found.
              </div>
            )}
          </div>

          {/* TOTAL row — calculated */}
          {aedParties.length > 0 && (
            <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between text-sm font-bold">
              <span className="uppercase tracking-wider text-slate-300 text-xs">TOTAL (Calculated)</span>
              <span className="text-lg font-extrabold text-teal-400">
                Auto-Calculated · Not a manual entry
              </span>
            </div>
          )}

          {/* COMMISON notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>COMMISON</strong> — <span className="italic">REQUIRES CLIENT CONFIRMATION.</span>{" "}
              Its exact meaning (commission field vs. a separate party) has not been confirmed. Not implemented until clarified.
            </div>
          </div>
        </div>
      )}

      {/* ADD DISTRIBUTION SPLIT MODAL */}
      {showAddModal && selectedModalTxn && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Split className="w-5 h-5 text-teal-700" />
                <span>Add Distribution Split for {selectedModalTxn.customer_name}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
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

            {/* PRE-LOCKED CUSTOMER CONTEXT CARD */}
            <div className="p-3.5 bg-teal-50/90 rounded-xl border border-teal-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Customer:</span>
                  <span className="text-sm font-extrabold text-teal-950">{selectedModalTxn.customer_name}</span>
                </div>
                <span className="font-mono text-xs font-bold bg-white text-slate-800 px-2 py-0.5 rounded border border-teal-300">
                  {selectedModalTxn.transaction_number}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs pt-1.5 border-t border-teal-200/70">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Order</span>
                  <span className="font-extrabold text-slate-900">{formatINR(selectedModalTxn.inr_amount)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Allocated So Far</span>
                  <span className="font-bold text-emerald-700">{formatINR(selectedModalTxn.total_distributed_inr)}</span>
                </div>
                <div>
                  <span className="text-amber-800 block text-[10px] uppercase font-extrabold">Remaining to Split</span>
                  <span className="font-extrabold text-amber-700">{formatINR(selectedModalTxn.remaining_inr)}</span>
                </div>
              </div>
            </div>

            {/* Optional Customer Switcher if needed */}
            {transactions.length > 1 && (
              <details className="text-xs text-slate-600 group">
                <summary className="cursor-pointer text-teal-700 font-semibold hover:underline flex items-center gap-1">
                  <span>Switch to a different customer order</span>
                </summary>
                <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-200">
                  <select
                    value={modalTxnId}
                    onChange={(e) => {
                      const newTxn = transactions.find((t) => t.id === e.target.value);
                      if (newTxn) {
                        setModalTxnId(newTxn.id);
                        setSelectedTxnId(newTxn.id);
                        const rem = Number(newTxn.remaining_inr || 0);
                        setModalAmount(rem > 0 ? String(rem) : "");
                      }
                    }}
                    className="w-full text-xs font-bold border border-slate-300 rounded p-1.5 text-slate-900"
                  >
                    {transactions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.customer_name} • {t.transaction_number} (Remaining: ₹{(t.remaining_inr || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              </details>
            )}

            <form onSubmit={handleAddSplit} className="space-y-4">
              {/* Select India Party */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  IND Party / Distributor — India-side (Who will disburse this?)
                </label>
                <select
                  value={modalDistId}
                  onChange={(e) => setModalDistId(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {confirmedIndiaParties.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} [{d.group_type}] ({d.code})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Only IND-group parties shown. SARABU here = IND side.</p>
              </div>

              {/* Date & INR Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Split Date
                  </label>
                  <input
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      INR Amount
                    </label>
                    {(selectedModalTxn.remaining_inr || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setModalAmount(String(selectedModalTxn.remaining_inr))}
                        className="text-[10px] font-bold text-teal-700 hover:text-teal-800 underline"
                      >
                        Use Max (₹{selectedModalTxn.remaining_inr})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="Amount"
                      value={modalAmount}
                      onChange={(e) => setModalAmount(e.target.value)}
                      className="w-full text-xs font-bold pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Words side-by-side */}
              {numberToIndianWords(modalAmount) && (
                <div className="p-2 bg-teal-50/90 border border-teal-200 rounded-lg flex items-center gap-1.5 text-xs text-teal-950 animate-in fade-in duration-100">
                  <span className="font-bold text-[10px] tracking-wider uppercase bg-teal-200 text-teal-950 px-1.5 py-0.5 rounded font-mono shrink-0">
                    In Words:
                  </span>
                  <span className="font-semibold">{numberToIndianWords(modalAmount)}</span>
                </div>
              )}

              {/* Optional Rate & Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Wholesale Rate (Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="26.18"
                    value={modalRate}
                    onChange={(e) => setModalRate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Payout reference..."
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800 disabled:opacity-50 shadow-sm"
                >
                  {submitting ? "Saving Split..." : `Confirm Split for ${selectedModalTxn.customer_name}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DISTRIBUTION SPLIT MODAL */}
      {editSplit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-teal-700" />
                <span>Edit Distribution Split for {editSplit.customer_name}</span>
              </h3>
              <button
                onClick={() => setEditSplit(null)}
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

            {/* Read-only Context */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Remittance Txn:</span>
                <span className="font-mono font-bold text-slate-800">{editSplit.transaction_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Customer:</span>
                <span className="font-bold text-slate-800">{editSplit.customer_name}</span>
              </div>
            </div>

            <form onSubmit={handleUpdateSplit} className="space-y-4">
              {/* Change India Party / Distributor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  India Party / Distributor
                </label>
                <select
                  value={editDistId}
                  onChange={(e) => setEditDistId(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {confirmedIndiaParties.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Split Date
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
                    INR Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full text-xs font-bold pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {numberToIndianWords(editAmount) && (
                <div className="p-2 bg-teal-50/90 border border-teal-200 rounded-lg flex items-center gap-1.5 text-xs text-teal-950 animate-in fade-in duration-100">
                  <span className="font-bold text-[10px] tracking-wider uppercase bg-teal-200 text-teal-950 px-1.5 py-0.5 rounded font-mono shrink-0">
                    In Words:
                  </span>
                  <span className="font-semibold">{numberToIndianWords(editAmount)}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Wholesale Rate (Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>

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
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditSplit(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800 disabled:opacity-50 shadow-sm"
                >
                  {editSubmitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE DISTRIBUTION SPLIT MODAL */}
      {deleteSplitTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-rose-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <span>Delete Distribution Split</span>
              </h3>
              <button
                onClick={() => setDeleteSplitTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {deleteError ? (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{deleteError}</span>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-600">
                <p>
                  Are you sure you want to delete this split of{" "}
                  <strong className="text-slate-900">{formatINR(deleteSplitTarget.inr_amount)}</strong> allocated to{" "}
                  <strong className="text-slate-900">{deleteSplitTarget.distributor_code}</strong>?
                </p>
                <p className="text-teal-700 bg-teal-50 p-2.5 rounded border border-teal-200">
                  Deleting this will release the allocated amount back to remittance <strong>{deleteSplitTarget.transaction_number}</strong>.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteSplitTarget(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSplit}
                disabled={deleteSubmitting}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50 shadow-sm"
              >
                {deleteSubmitting ? "Deleting..." : "Yes, Delete Split"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
