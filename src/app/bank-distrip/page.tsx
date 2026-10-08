"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Landmark,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Edit3,
  Trash2,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowUpDown,
  Building2,
  Info,
  Lock,
  Calculator,
  CheckCircle2,
  DollarSign,
  PieChart,
  Search,
  ArrowRight,
  Filter,
} from "lucide-react";
import { getTodayDateString } from "@/lib/date-utils";
import { FadeIn, PageTransition, StaggerContainer, StaggerItem } from "@/components/AnimatedLayout";

interface BankAccount {
  id: string;
  account_code: string;
  account_name: string;
  bank_name?: string | null;
  account_number?: string | null;
  status: string;
  current_balance?: number;
  total_order?: number;
  total_commission?: number;
  total_paid?: number;
  closing_balance?: number;
  record_count?: number;
  created_at?: string;
}

interface BankRecord {
  id: string;
  record_date: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  order_inr: number;
  commission_inr: number;
  paid_inr: number;
  balance_inr: number;
  notes?: string | null;
  created_at: string;
}

interface DistributorSummary {
  account_id: string;
  account_code: string;
  account_name: string;
  total_order: number;
  total_commission: number;
  total_paid: number;
  closing_balance: number;
  record_count: number;
}

interface GrandTotals {
  grand_order: number;
  grand_commission: number;
  grand_paid: number;
  grand_balance: number;
  distributor_summaries: DistributorSummary[];
}

// In-memory client cache for instant (0ms) account switching and page navigation
let clientBankDistripCache: {
  accounts: BankAccount[];
  recordsByAccount: Record<string, BankRecord[]>;
  grandTotals: GrandTotals | null;
} | null = null;

export default function BankDistripPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>(() => clientBankDistripCache?.accounts || []);
  const [records, setRecords] = useState<BankRecord[]>(() => {
    if (!clientBankDistripCache) return [];
    const firstAcc = clientBankDistripCache.accounts[0]?.id || "";
    return clientBankDistripCache.recordsByAccount[firstAcc] || [];
  });
  const [activeAccountData, setActiveAccountData] = useState<BankAccount | null>(null);
  const [grandTotals, setGrandTotals] = useState<GrandTotals | null>(() => clientBankDistripCache?.grandTotals || null);
  const [loading, setLoading] = useState(() => !clientBankDistripCache);
  const [selectedAccount, setSelectedAccount] = useState<string>(() => clientBankDistripCache?.accounts[0]?.id || "");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchFilter, setSearchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState<"ledger" | "grand-total">("ledger");

  const lastFetchKeyRef = useRef<string>("");

  // Date picker refs
  const addDateRef = useRef<HTMLInputElement>(null);
  const editDateRef = useRef<HTMLInputElement>(null);
  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);

  // Add Transaction Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDate, setAddDate] = useState(getTodayDateString());
  const [addAccountId, setAddAccountId] = useState("");
  const [addOrder, setAddOrder] = useState<number>(0);
  const [loadingAddOrder, setLoadingAddOrder] = useState(false);
  const [addCom, setAddCom] = useState("");
  const [addPaid, setAddPaid] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Transaction Modal State
  const [editRecord, setEditRecord] = useState<BankRecord | null>(null);
  const [editDateVal, setEditDateVal] = useState("");
  const [editOrder, setEditOrder] = useState<number>(0);
  const [loadingEditOrder, setLoadingEditOrder] = useState(false);
  const [editCom, setEditCom] = useState("");
  const [editPaid, setEditPaid] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Transaction Modal State
  const [deleteTarget, setDeleteTarget] = useState<BankRecord | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // New Account Modal State
  const [showNewAccModal, setShowNewAccModal] = useState(false);
  const [newAccCode, setNewAccCode] = useState("");
  const [newAccName, setNewAccName] = useState("");
  const [newAccBank, setNewAccBank] = useState("");
  const [newAccNumber, setNewAccNumber] = useState("");
  const [newAccSubmitting, setNewAccSubmitting] = useState(false);
  const [newAccError, setNewAccError] = useState<string | null>(null);

  const openDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current) {
      try {
        if (typeof ref.current.showPicker === "function") {
          ref.current.showPicker();
        } else {
          ref.current.focus();
        }
      } catch {
        ref.current.focus();
      }
    }
  };

  useEffect(() => {
    const hasData = records.length > 0 || accounts.length > 0;
    fetchBankData(selectedAccount, hasData);
  }, [selectedAccount, sortOrder, dateFrom, dateTo]);

  // Fetch automatic order when date or account changes in Add modal
  useEffect(() => {
    if (showAddModal && addAccountId && addDate) {
      fetchOrderForDate(addAccountId, addDate, (order) => setAddOrder(order));
    }
  }, [showAddModal, addAccountId, addDate]);

  async function fetchOrderForDate(accountId: string, date: string, callback: (val: number) => void) {
    try {
      setLoadingAddOrder(true);
      const res = await fetch(`/api/bank-distrip?action=order&accountId=${accountId}&date=${date}`);
      if (res.ok) {
        const json = await res.json();
        callback(Number(json.order_inr || 0));
      }
    } catch (err) {
      console.error("Failed to fetch order for date:", err);
    } finally {
      setLoadingAddOrder(false);
    }
  }

  async function fetchBankData(targetAcc?: string, isBackground = false) {
    const accToFetch = targetAcc !== undefined ? targetAcc : selectedAccount;
    const fetchKey = `${accToFetch}_${sortOrder}_${dateFrom}_${dateTo}`;

    // Avoid duplicate fetch
    if (lastFetchKeyRef.current === fetchKey && !isBackground) {
      return;
    }
    lastFetchKeyRef.current = fetchKey;

    if (!isBackground && records.length === 0) {
      setLoading(true);
    }

    try {
      let url = `/api/bank-distrip?sort=${sortOrder}`;
      if (accToFetch) url += `&accountId=${accToFetch}`;
      if (dateFrom) url += `&from=${dateFrom}`;
      if (dateTo) url += `&to=${dateTo}`;

      const res = await fetch(url);
      const json = await res.json();
      const validAccounts: BankAccount[] = Array.isArray(json.accounts) ? json.accounts : [];
      const validRecords: BankRecord[] = Array.isArray(json.records) ? json.records : [];

      setAccounts(validAccounts);
      setRecords(validRecords);
      setActiveAccountData(json.activeAccount || null);
      if (json.grandTotals) {
        setGrandTotals(json.grandTotals);
      }

      // Update client cache
      const effectiveAcc = accToFetch || validAccounts[0]?.id || "";
      const existingRecords = clientBankDistripCache?.recordsByAccount || {};
      clientBankDistripCache = {
        accounts: validAccounts,
        recordsByAccount: {
          ...existingRecords,
          [effectiveAcc]: validRecords,
        },
        grandTotals: json.grandTotals || null,
      };

      // Auto-select the first account if none is selected yet
      if (!accToFetch && validAccounts.length > 0) {
        const defaultId = validAccounts[0].id;
        // Suppress duplicate fetch when setSelectedAccount triggers useEffect
        lastFetchKeyRef.current = `${defaultId}_${sortOrder}_${dateFrom}_${dateTo}`;
        setSelectedAccount(defaultId);
        setAddAccountId(defaultId);
      } else if (accToFetch && !addAccountId) {
        setAddAccountId(accToFetch);
      }
    } catch (err) {
      console.error("Failed to load bank distrip data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Active account
  const activeAccount = accounts.find((a) => a.id === selectedAccount) || activeAccountData;

  // Filtered records
  const filteredRecords = records.filter((r) => {
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchDate = r.record_date.toLowerCase().includes(q);
      const matchNotes = (r.notes || "").toLowerCase().includes(q);
      const matchAccount = (r.account_code || "").toLowerCase().includes(q);
      return matchDate || matchNotes || matchAccount;
    }
    return true;
  });

  // Totals for active account
  const totalOrders = activeAccount?.total_order ?? records.reduce((sum, r) => sum + (Number(r.order_inr) || 0), 0);
  const totalCommission = activeAccount?.total_commission ?? records.reduce((sum, r) => sum + (Number(r.commission_inr) || 0), 0);
  const totalPaid = activeAccount?.total_paid ?? records.reduce((sum, r) => sum + (Number(r.paid_inr) || 0), 0);
  const closingBalance = activeAccount?.closing_balance ?? (records.length > 0 ? records[records.length - 1].balance_inr : 0);

  // Today's metrics for active account
  const todayStr = getTodayDateString();
  const todayRecord = records.find((r) => r.record_date === todayStr);
  const todayOrder = todayRecord ? Number(todayRecord.order_inr || 0) : 0;
  const todayCom = todayRecord ? Number(todayRecord.commission_inr || 0) : 0;
  const todayPaid = todayRecord ? Number(todayRecord.paid_inr || 0) : 0;
  const todayBalance = todayRecord ? Number(todayRecord.balance_inr || 0) : closingBalance;

  // Previous balance for Add Modal live preview
  const prevBalForAdd = records.length > 0
    ? (sortOrder === "asc" ? records[records.length - 1].balance_inr : records[0].balance_inr)
    : 0;

  const addComNum = parseFloat(addCom) || 0;
  const addPaidNum = parseFloat(addPaid) || 0;
  const addCalculatedBalance = prevBalForAdd + addOrder + addComNum - addPaidNum;

  // Previous balance for Edit Modal live preview
  const editRecordIdx = editRecord ? records.findIndex(r => r.id === editRecord.id) : -1;
  const editPrevBal = editRecordIdx > 0 ? Number(records[editRecordIdx - 1].balance_inr || 0) : 0;
  const editComNum = parseFloat(editCom) || 0;
  const editPaidNum = parseFloat(editPaid) || 0;
  const editCalculatedBalance = editPrevBal + editOrder + editComNum - editPaidNum;

  // Open Edit Modal
  function openEditModal(record: BankRecord) {
    setEditRecord(record);
    setEditDateVal(record.record_date);
    setEditOrder(Number(record.order_inr || 0));
    setEditCom(record.commission_inr && Number(record.commission_inr) !== 0 ? String(record.commission_inr) : "");
    setEditPaid(record.paid_inr && Number(record.paid_inr) !== 0 ? String(record.paid_inr) : "");
    setEditNotes(record.notes || "");
    setEditError(null);
  }

  // Handle Add Transaction Submit
  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    const targetAccId = addAccountId || selectedAccount;
    if (!targetAccId) {
      setAddError("Please select a bank/distributor account.");
      return;
    }

    setAddSubmitting(true);
    setAddError(null);
    try {
      const res = await fetch("/api/bank-distrip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: targetAccId,
          record_date: addDate,
          commission_inr: parseFloat(addCom) || 0,
          paid_inr: parseFloat(addPaid) || 0,
          notes: addNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create settlement entry");

      setShowAddModal(false);
      setAddDate(getTodayDateString());
      setAddCom("");
      setAddPaid("");
      setAddNotes("");
      await fetchBankData();
      toast.success("Settlement entry created successfully");
    } catch (err: any) {
      setAddError(err.message || "Failed to create settlement entry");
      toast.error(err.message || "Failed to create settlement entry");
    } finally {
      setAddSubmitting(false);
    }
  }

  // Handle Edit Transaction Submit
  async function handleUpdateTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!editRecord) return;

    setEditSubmitting(true);
    setEditError(null);
    try {
      const res = await fetch("/api/bank-distrip", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editRecord.id,
          account_id: editRecord.account_id,
          record_date: editDateVal,
          commission_inr: parseFloat(editCom) || 0,
          paid_inr: parseFloat(editPaid) || 0,
          notes: editNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settlement entry");

      setEditRecord(null);
      await fetchBankData();
      toast.success("Settlement entry updated successfully");
    } catch (err: any) {
      setEditError(err.message || "Failed to update settlement entry");
      toast.error(err.message || "Failed to update settlement entry");
    } finally {
      setEditSubmitting(false);
    }
  }

  // Handle Delete Transaction
  async function handleDeleteTransaction() {
    if (!deleteTarget) return;

    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/bank-distrip?id=${deleteTarget.id}&accountId=${deleteTarget.account_id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete settlement record");

      setDeleteTarget(null);
      await fetchBankData();
      toast.success("Settlement entry deleted successfully");
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete settlement record");
      toast.error(err.message || "Failed to delete settlement record");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  // Handle Create New Account
  async function handleCreateNewAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newAccCode.trim() || !newAccName.trim()) {
      setNewAccError("Account Code and Account Name are required.");
      return;
    }

    setNewAccSubmitting(true);
    setNewAccError(null);
    try {
      const res = await fetch("/api/bank-distrip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_account",
          account_code: newAccCode.trim().toUpperCase(),
          account_name: newAccName.trim(),
          bank_name: newAccBank.trim() || undefined,
          account_number: newAccNumber.trim() || undefined,
        }),
      });

      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "Failed to create account");

      setShowNewAccModal(false);
      setNewAccCode("");
      setNewAccName("");
      setNewAccBank("");
      setNewAccNumber("");
      await fetchBankData();
      setSelectedAccount(created.id);
      setAddAccountId(created.id);
      toast.success("Account created successfully");
    } catch (err: any) {
      setNewAccError(err.message || "Failed to create account");
      toast.error(err.message || "Failed to create account");
    } finally {
      setNewAccSubmitting(false);
    }
  }

  // Indian currency formatting (preserves negative values)
  function formatINR(val?: number) {
    if (val === undefined || val === null || isNaN(val)) return "₹ 0.000";
    const isNegative = val < 0;
    const abs = Math.abs(val);
    const formatted = abs.toLocaleString("en-IN", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    return isNegative ? `-₹ ${formatted}` : `₹ ${formatted}`;
  }

  // Format date readable (e.g. 2026-05-03 -> 03-May-2026)
  function formatDateReadable(dateStr: string) {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${parts[2]}-${months[mIdx] || parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }

  return (
    <PageTransition>
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#0F766E] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Bank Distribution Settlement
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Authoritative Date-wise Settlement Ledger & Running Balances
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  Excel Exact
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("ledger")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === "ledger"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Distributor Ledger
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("grand-total")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "grand-total"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Grand Total</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowNewAccModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="hidden sm:inline">+ New Account</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAddAccountId(selectedAccount || (accounts[0]?.id || ""));
              setAddDate(getTodayDateString());
              setAddCom("");
              setAddPaid("");
              setAddNotes("");
              setAddError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-sm transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Record Settlement</span>
          </button>
        </div>
      </div>

      {/* Logic Callout Banner */}
      <div className="bg-gradient-to-r from-teal-50/80 via-teal-50/50 to-teal-50/80 dark:from-teal-950/40 dark:via-teal-950/20 dark:to-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 rounded-xl p-3 sm:p-4 text-xs text-slate-700 dark:text-slate-300 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Calculator className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Excel Balance Formula:</span>
                <code className="text-teal-800 dark:text-teal-300 font-mono font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                  CURRENT BAL = PREVIOUS BAL + CURRENT ORDER + CURRENT COM - CURRENT PAID
                </code>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                <strong>ORDER</strong> is automatically linked from transaction splits and collection allocations (Read-Only). 
                Enter <strong>COM</strong> and <strong>PAID</strong> (supports negative values like <code className="font-mono text-rose-600 dark:text-rose-400">-56,530</code>).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-teal-800 dark:text-teal-300 bg-teal-100/60 dark:bg-teal-900/40 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800 self-start md:self-auto shrink-0">
            <Lock className="w-3 h-3" />
            <span>Single Source of Truth for Orders</span>
          </div>
        </div>
      </div>

      {/* Distributor Tabs / Selector */}
      <FadeIn delay={0.1}>
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Distributor / India Party Accounts:
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              ({accounts.length} registered)
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Click on any party below to inspect their independent running ledger
          </div>
        </div>

        {/* Distributor Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          {accounts.map((acc) => {
            const isSelected = acc.id === selectedAccount;
            const bal = acc.closing_balance ?? acc.current_balance ?? 0;
            const isNeg = bal < 0;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  setSelectedAccount(acc.id);
                  setAddAccountId(acc.id);
                  if (activeTab === "grand-total") setActiveTab("ledger");
                  if (clientBankDistripCache?.recordsByAccount[acc.id]) {
                    setRecords(clientBankDistripCache.recordsByAccount[acc.id]);
                  }
                }}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer border ${
                  isSelected
                    ? "bg-[#0F766E] text-white border-[#0F766E] shadow-sm font-bold"
                    : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{acc.account_code || acc.account_name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono flex items-center justify-center ${
                    isSelected
                      ? "bg-teal-800/80 text-teal-100"
                      : isNeg
                      ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                      : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {loading ? (
                    <div className={`h-4 w-12 rounded animate-pulse ${isSelected ? 'bg-teal-700' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  ) : (
                    formatINR(bal)
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      </FadeIn>

      {/* GRAND TOTAL MATRIX SECTION */}
      {activeTab === "grand-total" ? (
        <FadeIn delay={0.2}>
        <div className="space-y-6">
          {/* Grand Total KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>GRAND ORDER</span>
                <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              {loading ? (
                <div className="h-7 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mt-2" />
              ) : (
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2">
                  {formatINR(grandTotals?.grand_order || 0)}
                </div>
              )}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Sum of all parties' order amounts
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>GRAND COM</span>
                <TrendingUp className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              </div>
              {loading ? (
                <div className="h-7 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mt-2" />
              ) : (
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2">
                  {formatINR(grandTotals?.grand_commission || 0)}
                </div>
              )}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Sum of all parties' commission
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>GRAND PAID</span>
                <TrendingDown className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              {loading ? (
                <div className="h-7 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mt-2" />
              ) : (
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2">
                  {formatINR(grandTotals?.grand_paid || 0)}
                </div>
              )}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Sum of all payments made to parties
              </div>
            </div>

            <div className="bg-gradient-to-br from-teal-900 to-slate-900 text-white p-4 rounded-xl border border-teal-800 shadow-md">
              <div className="flex items-center justify-between text-xs text-teal-200 font-medium">
                <span>GRAND CLOSING BAL</span>
                <Landmark className="w-4 h-4 text-teal-300" />
              </div>
              {loading ? (
                <div className="h-7 w-32 rounded bg-teal-800 animate-pulse mt-2" />
              ) : (
                <div className="text-xl font-bold font-mono text-white mt-2">
                  {formatINR(grandTotals?.grand_balance || 0)}
                </div>
              )}
              <div className="text-[11px] text-teal-200/90 mt-1">
                Sum of party closing balances (Excel Rule #9)
              </div>
            </div>
          </div>

          {/* Grand Total Comparison Matrix Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Distributors Grand Total Summary Matrix
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Comparison across MK, SALA, SARABU / USAIN, ISMAIL, NNG, and all configured distributors
                </p>
              </div>
              <span className="text-xs text-teal-700 dark:text-teal-300 font-semibold bg-teal-50 dark:bg-teal-950 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
                {grandTotals?.distributor_summaries.length || accounts.length} Parties Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Party / Distributor</th>
                    <th className="py-2.5 px-3 text-right">Total Order (INR)</th>
                    <th className="py-2.5 px-3 text-right">Total COM (INR)</th>
                    <th className="py-2.5 px-3 text-right">Total Paid (INR)</th>
                    <th className="py-2.5 px-3 text-right">Closing Balance (INR)</th>
                    <th className="py-2.5 px-3 text-center">Records</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {(grandTotals?.distributor_summaries || accounts.map(a => ({
                    account_id: a.id,
                    account_code: a.account_code,
                    account_name: a.account_name,
                    total_order: a.total_order || 0,
                    total_commission: a.total_commission || 0,
                    total_paid: a.total_paid || 0,
                    closing_balance: a.closing_balance || 0,
                    record_count: a.record_count || 0,
                  }))).map((item) => (
                    <tr
                      key={item.account_id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0"></span>
                          <span>{item.account_code}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({item.account_name})
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatINR(item.total_order)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatINR(item.total_commission)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatINR(item.total_paid)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            item.closing_balance < 0
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                          }`}
                        >
                          {formatINR(item.closing_balance)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 font-mono">
                        {item.record_count}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAccount(item.account_id);
                            setActiveTab("ledger");
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors"
                        >
                          <span>View Ledger</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                    <td className="py-2.5 px-3 text-xs tracking-wider uppercase">
                      GRAND TOTAL
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap">
                      {formatINR(grandTotals?.grand_order || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap">
                      {formatINR(grandTotals?.grand_commission || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap">
                      {formatINR(grandTotals?.grand_paid || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-teal-700 dark:text-teal-300 whitespace-nowrap">
                      {formatINR(grandTotals?.grand_balance || 0)}
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-right text-[11px] text-slate-500 font-normal italic">
                      * Grand BAL = Sum of party closing balances
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
        </FadeIn>
      ) : (
        /* DISTRIBUTOR LEDGER SECTION */
        <FadeIn delay={0.2}>
        <div className="space-y-6">
          {/* Today's Live Status Section */}
          <div className="bg-gradient-to-r from-teal-500/10 via-teal-500/5 to-transparent dark:from-teal-950/40 dark:via-teal-950/20 p-4 rounded-xl border border-teal-200 dark:border-teal-800 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-100 dark:border-teal-900/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse"></span>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Today's Live Orders & Settlement ({formatDateReadable(todayStr)}) — {activeAccount?.account_code || "Party"}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {todayRecord ? (
                  <button
                    type="button"
                    onClick={() => openEditModal(todayRecord)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] transition shadow-xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Enter Today's COM & PAID</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddAccountId(selectedAccount || (accounts[0]?.id || ""));
                      setAddDate(todayStr);
                      setAddCom("");
                      setAddPaid("");
                      setAddNotes("");
                      setAddError(null);
                      setShowAddModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] transition shadow-xs cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Record Today's Settlement</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-teal-100 dark:border-teal-900/60 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Today's Total Order</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </div>
                <div className="text-lg font-bold font-mono text-teal-800 dark:text-teal-200 mt-1">
                  {loading ? <div className="h-6 w-20 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /> : formatINR(todayOrder)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Sum of all customer remittance splits today
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-teal-100 dark:border-teal-900/60 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Today's Commission</span>
                  <span className="text-[9px] px-1 rounded bg-teal-50 dark:bg-teal-950 text-teal-600 font-mono">Manual</span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200 mt-1">
                  {loading ? <div className="h-6 w-20 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /> : formatINR(todayCom)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Commission entered for today
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-teal-100 dark:border-teal-900/60 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Today's Paid</span>
                  <span className="text-[9px] px-1 rounded bg-teal-50 dark:bg-teal-950 text-teal-600 font-mono">Manual</span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200 mt-1">
                  {loading ? <div className="h-6 w-20 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /> : formatINR(todayPaid)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Payment amount transferred today
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50/50 dark:from-teal-950/50 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-teal-800 dark:text-teal-300 flex items-center justify-between">
                  <span>Today's Running Bal</span>
                  <Calculator className="w-3 h-3 text-teal-600" />
                </div>
                <div className="text-lg font-bold font-mono text-teal-700 dark:text-teal-300 mt-1">
                  {loading ? <div className="h-6 w-24 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /> : formatINR(todayBalance)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Prev Bal + Order + COM - Paid
                </div>
              </div>
            </div>
          </div>

          {/* All-Time Historical Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Order (Auto) */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <span>ALL-TIME ORDERS</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                    Auto
                  </span>
                </span>
                <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              {loading ? (
                <div className="h-7 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mt-2" />
              ) : (
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2">
                  {formatINR(totalOrders)}
                </div>
              )}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Total across all history</span>
              </div>
            </div>

            {/* Total Commission */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <span>ALL-TIME COM</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-mono">
                    Manual
                  </span>
                </span>
                <TrendingUp className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              </div>
              {loading ? (
                <div className="h-7 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mt-2" />
              ) : (
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2">
                  {formatINR(totalCommission)}
                </div>
              )}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Total commission entered
              </div>
            </div>

            {/* Total Paid */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <span>ALL-TIME PAID</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-mono">
                    Manual
                  </span>
                </span>
                <TrendingDown className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              {loading ? (
                <div className="h-7 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mt-2" />
              ) : (
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2">
                  {formatINR(totalPaid)}
                </div>
              )}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Net paid amounts across all history
              </div>
            </div>

            {/* Closing Balance */}
            <div className="bg-gradient-to-br from-teal-900 to-slate-900 text-white p-4 rounded-xl border border-teal-800 shadow-md">
              <div className="flex items-center justify-between text-xs text-teal-200 font-medium">
                <span className="tracking-wide">FINAL CLOSING BAL</span>
                <Landmark className="w-4 h-4 text-teal-300" />
              </div>
              {loading ? (
                <div className="h-7 w-32 rounded bg-teal-800 animate-pulse mt-2" />
              ) : (
                <div className="text-xl font-bold font-mono text-white mt-2">
                  {formatINR(closingBalance)}
                </div>
              )}
              <div className="text-[11px] text-teal-200/90 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-teal-400" />
                <span>Current authoritative ledger balance</span>
              </div>
            </div>
          </div>

          {/* Filter & Controls Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter records by date or notes..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Date Filters & Sort */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 text-[11px]">From:</span>
                  <input
                    ref={fromDateRef}
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-transparent text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => openDatePicker(fromDateRef)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
                  >
                    <Calendar className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 text-[11px]">To:</span>
                  <input
                    ref={toDateRef}
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-transparent text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => openDatePicker(toDateRef)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
                  >
                    <Calendar className="w-3 h-3" />
                  </button>
                </div>

                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="px-2 py-1 text-[11px] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded"
                  >
                    Clear Dates
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Toggle Chronological / Reverse Sort"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{sortOrder === "asc" ? "Oldest First (Ledger)" : "Newest First"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fetchBankData()}
                  disabled={loading}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Date-wise Ledger Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{activeAccount?.account_code || "Selected Party"} Date-wise Settlement Ledger</span>
                  <span className="text-xs text-slate-400 font-normal">
                    ({activeAccount?.account_name || ""})
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Formula: Current Balance = Previous Balance + Order + COM - Paid
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {filteredRecords.length} records found
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span>ORDER (INR)</span>
                        <span title="Read Only: From System Allocations & Splits">
                          <Lock className="w-3 h-3 text-slate-400" />
                        </span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right">COM (INR)</th>
                    <th className="py-2.5 px-3 text-right">PAID (INR)</th>
                    <th className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span>RUNNING BAL (INR)</span>
                        <Calculator className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600" />
                        <span>Loading settlement records...</span>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Landmark className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No settlement records found</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your filters or record a new settlement</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAddAccountId(selectedAccount || (accounts[0]?.id || ""));
                              setAddDate(getTodayDateString());
                              setAddCom("");
                              setAddPaid("");
                              setAddNotes("");
                              setAddError(null);
                              setShowAddModal(true);
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Record Settlement
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r, idx) => {
                      const isPaidNeg = r.paid_inr < 0;
                      const isBalNeg = r.balance_inr < 0;
                      const isTodayRow = r.record_date === todayStr;
                      return (
                        <tr
                          key={r.id || idx}
                          className={`transition-colors group ${
                            isTodayRow
                              ? "bg-teal-50/50 dark:bg-teal-950/30 border-l-4 border-l-[#0F766E]"
                              : "hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          {/* Date */}
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{formatDateReadable(r.record_date)}</span>
                              {isTodayRow && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0F766E] text-white shadow-2xs">
                                  TODAY
                                </span>
                              )}
                            </div>
                          </td>

                          {/* ORDER (INR) - Read-only badge */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {r.order_inr > 0 ? (
                                <span className="font-semibold text-teal-950 dark:text-teal-100">{formatINR(r.order_inr)}</span>
                              ) : (
                                <span className="text-slate-400">₹ 0.00</span>
                              )}
                              <span className="text-[10px] text-slate-400 font-sans" title="Auto-fetched">🔒</span>
                            </div>
                          </td>

                          {/* COM (INR) */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {r.commission_inr !== 0 ? (
                              <span className="text-teal-700 dark:text-teal-400 font-medium">
                                {formatINR(r.commission_inr)}
                              </span>
                            ) : (
                              <span className="text-slate-400">₹ 0.00</span>
                            )}
                          </td>

                          {/* PAID (INR) - Handles negative values */}
                          <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                            {r.paid_inr !== 0 ? (
                              <span
                                className={`font-medium ${
                                  isPaidNeg
                                    ? "text-rose-600 dark:text-rose-400 font-bold"
                                    : "text-slate-800 dark:text-slate-200"
                                }`}
                              >
                                {formatINR(r.paid_inr)}
                              </span>
                            ) : (
                              <span className="text-slate-400">₹ 0.00</span>
                            )}
                          </td>

                          {/* RUNNING BAL (INR) */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                isBalNeg
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                              }`}
                            >
                              {formatINR(r.balance_inr)}
                            </span>
                          </td>

                          {/* Notes */}
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                            {r.notes || "-"}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isTodayRow && r.commission_inr === 0 && r.paid_inr === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(r)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] shadow-xs cursor-pointer transition-colors"
                                  title="Enter Commission or Payment for Today"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>+ Enter COM / PAID</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(r)}
                                  className="p-1 text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                  title="Edit Commission or Paid"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(r)}
                                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                title="Delete Record"
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
                {filteredRecords.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                      <td className="py-3.5 px-4 text-xs tracking-wider uppercase">
                        TOTAL ({activeAccount?.account_code || "PARTY"})
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs">
                        {formatINR(totalOrders)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs">
                        {formatINR(totalCommission)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs">
                        {formatINR(totalPaid)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs">
                        <div className="flex flex-col items-end">
                          <span className="text-teal-700 dark:text-teal-300 text-sm font-bold">
                            {formatINR(closingBalance)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            (Final Closing Balance)
                          </span>
                        </div>
                      </td>
                      <td colSpan={2} className="py-3.5 px-4 text-right text-[11px] text-slate-500 font-normal italic">
                        * BAL represents the closing balance, not sum of daily balances
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
        </FadeIn>
      )}

      {/* ADD SETTLEMENT ENTRY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-teal-600" />
                  <span>Record Settlement Entry</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter Commission and Payment for India Distributor
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddTransaction} className="space-y-4 text-xs">
              {/* Distributor selection */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Distributor / India Party *
                </label>
                <select
                  value={addAccountId}
                  onChange={(e) => setAddAccountId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} - {a.account_name} (Closing: {formatINR(a.closing_balance || a.current_balance || 0)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date selection (default today) */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Record Date *
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={addDateRef}
                    type="date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => openDatePicker(addDateRef)}
                    className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ORDER (INR) - AUTOMATIC & READ ONLY */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Auto-Linked Order (INR)</span>
                  </span>
                  <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                    READ ONLY
                  </span>
                </div>
                <div className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                  {loadingAddOrder ? (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Fetching order for date...
                    </span>
                  ) : (
                    formatINR(addOrder)
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Automatically populated from remittance splits & distributor allocations. Never entered manually.
                </p>
              </div>

              {/* COMMISSION & PAID INPUTS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Commission / COM (INR)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={addCom}
                    onChange={(e) => setAddCom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Default 0 if no commission
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Paid / PAID (INR) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 1800000 or -56530"
                    value={addPaid}
                    onChange={(e) => setAddPaid(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Supports negative (e.g. -56,530)
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank transfer ref, settlement slip..."
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* LIVE BALANCE PREVIEW */}
              <div className="p-3 bg-teal-50/70 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800 space-y-1.5 text-[11px]">
                <div className="font-bold text-teal-900 dark:text-teal-200 flex items-center justify-between">
                  <span>Balance Calculation Preview:</span>
                  <span className="font-mono text-xs">{formatINR(addCalculatedBalance)}</span>
                </div>
                <div className="text-slate-600 dark:text-slate-400 font-mono space-y-0.5">
                  <div>Prev Bal: {formatINR(prevBalForAdd)}</div>
                  <div>+ Order: {formatINR(addOrder)}</div>
                  <div>+ Commission: {formatINR(addComNum)}</div>
                  <div>- Paid: {formatINR(addPaidNum)}</div>
                  <div className="border-t border-teal-200 dark:border-teal-800 pt-0.5 font-bold text-teal-800 dark:text-teal-300">
                    = Resulting Bal: {formatINR(addCalculatedBalance)}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {addSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  <span>Save Settlement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SETTLEMENT ENTRY MODAL */}
      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-teal-600" />
                  <span>Edit Settlement Entry</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Update Commission & Paid for {editRecord.account_code || "Distributor"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateTransaction} className="space-y-4 text-xs">
              {/* Date */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Record Date
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={editDateRef}
                    type="date"
                    value={editDateVal}
                    onChange={(e) => setEditDateVal(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => openDatePicker(editDateRef)}
                    className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ORDER (INR) - READ ONLY */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Auto-Linked Order (INR)</span>
                  </span>
                  <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                    READ ONLY
                  </span>
                </div>
                <div className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                  {formatINR(editOrder)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Order amount cannot be manually edited here. It reflects the distributor's split & allocation totals.
                </p>
              </div>

              {/* Commission & Paid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Commission / COM (INR)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editCom}
                    onChange={(e) => setEditCom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Paid / PAID (INR) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editPaid}
                    onChange={(e) => setEditPaid(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Supports negative (e.g. -56,530)
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* LIVE BALANCE PREVIEW */}
              <div className="p-3 bg-teal-50/70 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800 space-y-1.5 text-[11px]">
                <div className="font-bold text-teal-900 dark:text-teal-200 flex items-center justify-between">
                  <span>Excel Balance Formula:</span>
                  <span className="font-mono text-xs font-bold text-teal-800 dark:text-teal-300">{formatINR(editCalculatedBalance)}</span>
                </div>
                <div className="text-slate-600 dark:text-slate-400 font-mono space-y-0.5">
                  <div>Prev Bal: {formatINR(editPrevBal)}</div>
                  <div>+ Order: {formatINR(editOrder)}</div>
                  <div>+ Commission: {formatINR(editComNum)}</div>
                  <div>- Paid: {formatINR(editPaidNum)}</div>
                  <div className="border-t border-teal-200 dark:border-teal-800 pt-0.5 font-bold text-teal-800 dark:text-teal-300">
                    = (Prev Bal + Order + COM - Paid) = {formatINR(editCalculatedBalance)}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Modifying COM or PAID will immediately recalculate the balance for this date and all subsequent running balances for this distributor.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {editSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Update Settlement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete Settlement Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Date: {formatDateReadable(deleteTarget.record_date)} | Paid: {formatINR(deleteTarget.paid_inr)}
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {deleteError}
              </div>
            )}

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to remove this settlement entry? All subsequent running balances for this distributor will automatically recalculate.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTransaction}
                disabled={deleteSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold bg-rose-600 hover:bg-rose-700 text-white text-xs shadow-sm cursor-pointer disabled:opacity-50"
              >
                {deleteSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW ACCOUNT MODAL */}
      {showNewAccModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-teal-600" />
                  <span>Register Distributor Account</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Create a new bank or India distributor settlement ledger
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewAccModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {newAccError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{newAccError}</span>
              </div>
            )}

            <form onSubmit={handleCreateNewAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Code (Short ID) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. MK, SALA, SARABU, NNG"
                  value={newAccCode}
                  onChange={(e) => setNewAccCode(e.target.value.toUpperCase())}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Distributor Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. MK India Distribution"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, ICICI..."
                  value={newAccBank}
                  onChange={(e) => setNewAccBank(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50100234891"
                  value={newAccNumber}
                  onChange={(e) => setNewAccNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewAccModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newAccSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {newAccSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                  <span>Register Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
