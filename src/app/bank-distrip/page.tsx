"use client";

import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { getTodayDateString } from "@/lib/date-utils";

interface BankAccount {
  id: string;
  account_code: string;
  account_name: string;
  bank_name?: string | null;
  account_number?: string | null;
  status: string;
  current_balance?: number;
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

export default function BankDistripPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [records, setRecords] = useState<BankRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Date picker refs
  const addDateRef = useRef<HTMLInputElement>(null);
  const editDateRef = useRef<HTMLInputElement>(null);

  // Add Transaction Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDate, setAddDate] = useState(getTodayDateString());
  const [addAccountId, setAddAccountId] = useState("");
  const [addOrder, setAddOrder] = useState("");
  const [addCom, setAddCom] = useState("");
  const [addPaid, setAddPaid] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Transaction Modal State
  const [editRecord, setEditRecord] = useState<BankRecord | null>(null);
  const [editDateVal, setEditDateVal] = useState("");
  const [editOrder, setEditOrder] = useState("");
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
    fetchBankData();
  }, [selectedAccount, sortOrder]);

  async function fetchBankData() {
    setLoading(true);
    try {
      let url = `/api/bank-distrip?sort=${sortOrder}`;
      if (selectedAccount) url += `&accountId=${selectedAccount}`;
      const res = await fetch(url);
      const json = await res.json();
      const validAccounts: BankAccount[] = Array.isArray(json.accounts)
        ? json.accounts
        : [];
      const validRecords: BankRecord[] = Array.isArray(json.records)
        ? json.records
        : [];

      setAccounts(validAccounts);
      setRecords(validRecords);

      // Auto-select the first account if none is selected yet
      if (!selectedAccount && validAccounts.length > 0) {
        setSelectedAccount(validAccounts[0].id);
        setAddAccountId(validAccounts[0].id);
      } else if (selectedAccount && !addAccountId) {
        setAddAccountId(selectedAccount);
      }
    } catch (err) {
      console.error("Failed to load bank distrip data:", err);
      setAccounts([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  // Find the selected account object
  const activeAccount = accounts.find((a) => a.id === selectedAccount);

  // Records for active account in chronological order for accurate totals & sequence
  const activeRecords = records.filter(
    (r) => !selectedAccount || r.account_id === selectedAccount
  );

  // Totals calculated from records
  const totalOrders = activeRecords.reduce((sum, r) => sum + (Number(r.order_inr) || 0), 0);
  const totalCommission = activeRecords.reduce((sum, r) => sum + (Number(r.commission_inr) || 0), 0);
  const totalPaid = activeRecords.reduce((sum, r) => sum + (Number(r.paid_inr) || 0), 0);

  // The latest running balance for this account
  // In chronological order, it is the balance of the last record; mathematically: totalOrders + totalCommission - totalPaid
  const latestRunningBalance =
    activeRecords.length > 0
      ? sortOrder === "asc"
        ? activeRecords[activeRecords.length - 1].balance_inr
        : activeRecords[0].balance_inr
      : (activeAccount?.current_balance || 0);

  // Previous balance for Add Modal live preview
  const prevBalForAdd =
    activeRecords.length > 0
      ? (sortOrder === "asc"
          ? activeRecords[activeRecords.length - 1].balance_inr
          : activeRecords[0].balance_inr)
      : 0;

  const addOrderNum = parseFloat(addOrder) || 0;
  const addComNum = parseFloat(addCom) || 0;
  const addPaidNum = parseFloat(addPaid) || 0;
  const addCalculatedBalance = prevBalForAdd + addOrderNum + addComNum - addPaidNum;

  // Open Edit Modal
  function openEditModal(record: BankRecord) {
    setEditRecord(record);
    setEditDateVal(record.record_date);
    setEditOrder(String(record.order_inr || ""));
    setEditCom(String(record.commission_inr || ""));
    setEditPaid(String(record.paid_inr || ""));
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
          order_inr: parseFloat(addOrder) || 0,
          commission_inr: parseFloat(addCom) || 0,
          paid_inr: parseFloat(addPaid) || 0,
          notes: addNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create transaction");

      setShowAddModal(false);
      setAddDate(getTodayDateString());
      setAddOrder("");
      setAddCom("");
      setAddPaid("");
      setAddNotes("");
      await fetchBankData();
    } catch (err: any) {
      setAddError(err.message || "Failed to create transaction");
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
          order_inr: parseFloat(editOrder) || 0,
          commission_inr: parseFloat(editCom) || 0,
          paid_inr: parseFloat(editPaid) || 0,
          notes: editNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update transaction");

      setEditRecord(null);
      await fetchBankData();
    } catch (err: any) {
      setEditError(err.message || "Failed to update transaction");
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
      const res = await fetch(`/api/bank-distrip?id=${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete transaction");

      setDeleteTarget(null);
      await fetchBankData();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete transaction");
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
    } catch (err: any) {
      setNewAccError(err.message || "Failed to create account");
    } finally {
      setNewAccSubmitting(false);
    }
  }

  // Indian currency formatting (preserves negative values)
  function formatINR(val?: number) {
    if (val === undefined || val === null || isNaN(val)) return "₹ 0.00";
    const isNegative = val < 0;
    const abs = Math.abs(val);
    const formatted = abs.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isNegative ? `-₹ ${formatted}` : `₹ ${formatted}`;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 dark:bg-teal-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Landmark className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              BANK DISTRIP – Distributor Ledger
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Running balance ledger for bank & distributor accounts. Formula:{" "}
            <code className="text-teal-700 dark:text-teal-400 font-mono font-bold bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded">
              Current Balance = Previous Balance + Order + Commission - Paid
            </code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewAccModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>+ New Account</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAddAccountId(selectedAccount || (accounts[0]?.id || ""));
              setAddDate(getTodayDateString());
              setAddError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-sm transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Account Selector Bar (Excel-Sheet Tabs / Dropdown) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Select Account / Distributor:
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="text-xs font-semibold px-2.5 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded flex items-center gap-1 cursor-pointer transition-colors"
              title="Toggle sequence order"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortOrder === "asc" ? "Chronological (Oldest First)" : "Reverse (Newest First)"}</span>
            </button>
          </div>
        </div>

        {/* Account Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {accounts.map((acc) => {
            const isSelected = selectedAccount === acc.id;
            const bal = acc.current_balance || 0;
            const isNeg = bal < 0;

            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  setSelectedAccount(acc.id);
                  setAddAccountId(acc.id);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer ${
                  isSelected
                    ? "bg-[#0F766E] text-white border-[#0F766E] shadow-sm ring-2 ring-teal-500/30"
                    : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-400"
                }`}
              >
                <span>{acc.account_name}</span>
                <span
                  className={`text-[11px] font-mono px-1.5 py-0.2 rounded ${
                    isSelected
                      ? "bg-teal-800/80 text-teal-100"
                      : isNeg
                      ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                      : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                  }`}
                >
                  {formatINR(bal)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Account Totals & Current Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Balance */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Current Running Balance
            </span>
            {latestRunningBalance >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            )}
          </div>
          <div
            className={`text-2xl font-extrabold font-mono tracking-tight ${
              latestRunningBalance < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {formatINR(latestRunningBalance)}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {activeAccount?.account_name || "Account"} latest cumulative balance
          </p>
        </div>

        {/* Order Total */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Order Total
            </span>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded">
              SUM
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 tracking-tight">
            {formatINR(totalOrders)}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Total of all order disbursements
          </p>
        </div>

        {/* Commission Total */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Commission Total (COM)
            </span>
            <span className="text-[10px] bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold px-1.5 py-0.5 rounded">
              + ADDED
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-400 tracking-tight">
            {formatINR(totalCommission)}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Added to running balance (never deducted)
          </p>
        </div>

        {/* Paid Total */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Paid Total
            </span>
            <span className="text-[10px] bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold px-1.5 py-0.5 rounded">
              - DEDUCTED
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 tracking-tight">
            {formatINR(totalPaid)}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Total funding / settlements paid out
          </p>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <span>Ledger:</span>
              <span className="text-teal-700 dark:text-teal-400 font-extrabold">
                {activeAccount?.account_name || "All Accounts"}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cumulative balance sequence: <code className="font-mono">BAL(row) = BAL(prev) + ORDER + COM - PAID</code>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {activeRecords.length} Transactions recorded
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Order</th>
                <th className="py-3 px-4 text-right">COM</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                      <span>Loading ledger transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : activeRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs space-y-2">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                      No transactions recorded for {activeAccount?.account_name || "this account"} yet.
                    </p>
                    <p className="text-xs text-slate-400">
                      Click <strong className="text-teal-600">"+ Add Transaction"</strong> above to record your first entry.
                    </p>
                  </td>
                </tr>
              ) : (
                activeRecords.map((r, idx) => {
                  const bal = Number(r.balance_inr || 0);
                  const isNeg = bal < 0;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {r.record_date}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {r.order_inr > 0 ? formatINR(r.order_inr) : "-"}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-teal-700 dark:text-teal-400 font-semibold">
                        {r.commission_inr > 0 ? formatINR(r.commission_inr) : "-"}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-800 dark:text-slate-200 font-semibold">
                        {r.paid_inr > 0 ? formatINR(r.paid_inr) : "-"}
                      </td>

                      <td
                        className={`py-3 px-4 text-right font-mono font-bold text-sm ${
                          isNeg
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {formatINR(bal)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => openEditModal(r)}
                            title="Edit transaction"
                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/60 rounded border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            title="Delete transaction"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
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

            {/* Total Row matching Excel sheet */}
            {activeRecords.length > 0 && (
              <tfoot className="bg-slate-100/90 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-xs">
                <tr>
                  <td className="py-3.5 px-4 font-extrabold uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                    ACCOUNT TOTALS
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 dark:text-slate-100">
                    {formatINR(totalOrders)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold text-teal-700 dark:text-teal-400">
                    {formatINR(totalCommission)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 dark:text-slate-100">
                    {formatINR(totalPaid)}
                  </td>
                  <td
                    className={`py-3.5 px-4 text-right font-mono font-extrabold text-sm ${
                      latestRunningBalance < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {formatINR(latestRunningBalance)}
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-400 font-normal">
                    –
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ADD TRANSACTION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-150 my-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-800 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-teal-200" />
                <h3 className="text-base font-bold">Add Ledger Transaction</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-teal-200 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {addError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
              {/* Account Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Account / Distributor *
                </label>
                <select
                  value={addAccountId}
                  onChange={(e) => setAddAccountId(e.target.value)}
                  required
                  className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select Account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_name} ({a.account_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Date *
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono font-semibold">DD-MM-YYYY</span>
                </div>
                <div className="relative">
                  <input
                    ref={addDateRef}
                    type="date"
                    required
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 pr-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => openDatePicker(addDateRef)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 p-1 cursor-pointer transition-colors"
                    title="Choose from calendar"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Order Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Order Amount (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 384900"
                    value={addOrder}
                    onChange={(e) => setAddOrder(e.target.value)}
                    className="w-full text-sm font-bold pl-8 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Commission (COM) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Commission (COM) (INR)
                  </label>
                  <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold">
                    Added to balance
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 5000 (optional, default 0)"
                    value={addCom}
                    onChange={(e) => setAddCom(e.target.value)}
                    className="w-full text-sm font-bold pl-8 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Paid Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Paid / Funded Amount (INR)
                  </label>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                    Deducted from balance
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 600000"
                    value={addPaid}
                    onChange={(e) => setAddPaid(e.target.value)}
                    className="w-full text-sm font-bold pl-8 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Calculated Balance Preview Box (READ ONLY) */}
              <div className="p-3 bg-teal-50 dark:bg-teal-950/60 rounded-xl border border-teal-200/80 dark:border-teal-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-bold text-teal-950 dark:text-teal-200">
                  <span>Balance Calculation Preview:</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-teal-200 dark:bg-teal-800 text-teal-900 dark:text-teal-100">
                    Read-Only
                  </span>
                </div>

                <div className="space-y-0.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span>Previous Balance:</span>
                    <span>{formatINR(prevBalForAdd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Current Order:</span>
                    <span>{formatINR(addOrderNum)}</span>
                  </div>
                  <div className="flex justify-between text-teal-700 dark:text-teal-400 font-semibold">
                    <span>+ Current Commission:</span>
                    <span>{formatINR(addComNum)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 dark:text-rose-400 font-semibold">
                    <span>- Current Paid:</span>
                    <span>{formatINR(addPaidNum)}</span>
                  </div>
                </div>

                <div className="border-t border-teal-200 dark:border-teal-800 pt-1.5 flex justify-between items-center font-bold">
                  <span className="text-teal-950 dark:text-teal-200 font-sans">
                    Resulting Running Balance:
                  </span>
                  <span
                    className={`font-mono text-base ${
                      addCalculatedBalance < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {formatINR(addCalculatedBalance)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Batch ref, settlement notes..."
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={addSubmitting}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {addSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Transaction</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-150 my-8">
            <div className="bg-gradient-to-r from-teal-700 to-teal-800 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-teal-200" />
                <h3 className="text-base font-bold">
                  Edit Transaction ({editRecord.account_name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditRecord(null)}
                className="text-teal-200 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateTransaction} className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Date *
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono font-semibold">DD-MM-YYYY</span>
                </div>
                <div className="relative">
                  <input
                    ref={editDateRef}
                    type="date"
                    required
                    value={editDateVal}
                    onChange={(e) => setEditDateVal(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 pr-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => openDatePicker(editDateRef)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 p-1 cursor-pointer transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Order Amount (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="any"
                    value={editOrder}
                    onChange={(e) => setEditOrder(e.target.value)}
                    className="w-full text-sm font-bold pl-8 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Commission (COM) (INR)
                  </label>
                  <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold">
                    Added to balance
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="any"
                    value={editCom}
                    onChange={(e) => setEditCom(e.target.value)}
                    className="w-full text-sm font-bold pl-8 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Paid Amount (INR)
                  </label>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                    Deducted from balance
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="any"
                    value={editPaid}
                    onChange={(e) => setEditPaid(e.target.value)}
                    className="w-full text-sm font-bold pl-8 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Recalculation Notice */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <span>
                  <strong>Automatic Cumulative Recalculation:</strong> Saving changes will automatically update this transaction and all subsequent running balances for <strong>{editRecord.account_name}</strong>.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  disabled={editSubmitting}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recalculating...</span>
                    </>
                  ) : (
                    <span>Update & Recalculate</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE TRANSACTION CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete Ledger Entry?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {deleteTarget.record_date} • {deleteTarget.account_name}
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1.5 border border-slate-200 dark:border-slate-700 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Order:</span>
                <span>{formatINR(deleteTarget.order_inr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Commission:</span>
                <span>{formatINR(deleteTarget.commission_inr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Paid:</span>
                <span>{formatINR(deleteTarget.paid_inr)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure? Once deleted, all subsequent balances for <strong>{deleteTarget.account_name}</strong> will be automatically recalculated.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTransaction}
                disabled={deleteSubmitting}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleteSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Recalculating...</span>
                  </>
                ) : (
                  <span>Delete & Recalculate</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW ACCOUNT MODAL */}
      {showNewAccModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                <span>Create Bank / Distributor Account</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewAccModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {newAccError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{newAccError}</span>
              </div>
            )}

            <form onSubmit={handleCreateNewAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Account Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MK-2, TALLY, SALA"
                  value={newAccCode}
                  onChange={(e) => setNewAccCode(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MK (separate ledger) or USAIN"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Bank Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, SBI..."
                  value={newAccBank}
                  onChange={(e) => setNewAccBank(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Account Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50100..."
                  value={newAccNumber}
                  onChange={(e) => setNewAccNumber(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewAccModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newAccSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {newAccSubmitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
