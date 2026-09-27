"use client";

import { useState, useEffect } from "react";
import {
  Landmark,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Coins,
  ShieldCheck,
  Edit3,
  Trash2,
  AlertTriangle,
} from "lucide-react";

export default function BankDistripPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [recDate, setRecDate] = useState(new Date().toISOString().slice(0, 10));
  const [recAccountId, setRecAccountId] = useState("");
  const [recOrder, setRecOrder] = useState("");
  const [recCom, setRecCom] = useState("");
  const [recPaid, setRecPaid] = useState("");
  const [recNotes, setRecNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit Bank Record Modal State
  const [editRecord, setEditRecord] = useState<any | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editOrder, setEditOrder] = useState("");
  const [editCom, setEditCom] = useState("");
  const [editPaid, setEditPaid] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Bank Record State
  const [deleteRecordTarget, setDeleteRecordTarget] = useState<any | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchBankData();
  }, [selectedAccount]);

  function openEditRecord(r: any) {
    setEditRecord(r);
    setEditDate(r.record_date);
    setEditOrder(String(r.order_inr || 0));
    setEditCom(String(r.commission_inr || 0));
    setEditPaid(String(r.paid_inr || 0));
    setEditNotes(r.notes || "");
    setEditError(null);
  }

  async function handleUpdateRecord(e: React.FormEvent) {
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
          record_date: editDate,
          order_inr: parseFloat(editOrder) || 0,
          commission_inr: parseFloat(editCom) || 0,
          paid_inr: parseFloat(editPaid) || 0,
          notes: editNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update record");

      setEditRecord(null);
      fetchBankData();
    } catch (err: any) {
      setEditError(err.message || "Failed to update record");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteRecord() {
    if (!deleteRecordTarget) return;
    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/bank-distrip?id=${deleteRecordTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete record");

      setDeleteRecordTarget(null);
      fetchBankData();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete record");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function fetchBankData() {
    setLoading(true);
    try {
      let url = "/api/bank-distrip";
      if (selectedAccount) url += `?accountId=${selectedAccount}`;
      const res = await fetch(url);
      const json = await res.json();
      const validAccounts = Array.isArray(json.accounts) ? json.accounts : [];
      const validRecords = Array.isArray(json.records) ? json.records : [];
      setAccounts(validAccounts);
      setRecords(validRecords);
      if (validAccounts.length > 0 && !recAccountId) {
        setRecAccountId(validAccounts[0].id);
      }
    } catch (err) {
      console.error(err);
      setAccounts([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!recAccountId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/bank-distrip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_date: recDate,
          account_id: recAccountId,
          order_inr: parseFloat(recOrder) || 0,
          commission_inr: parseFloat(recCom) || 0,
          paid_inr: parseFloat(recPaid) || 0,
          notes: recNotes || undefined,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setRecOrder("");
        setRecCom("");
        setRecPaid("");
        setRecNotes("");
        fetchBankData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const formatINR = (val?: number) =>
    `₹ ${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">India Bank Distribution Accounts</h2>
          <p className="text-xs text-slate-500">
            Unified bank accounts for India-side order disbursement, commissions, and funding.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add Bank Entry</span>
        </button>
      </div>

      {/* MK Account Unification Notice */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-emerald-950">Single Unified MK Account</p>
          <p className="text-emerald-800 text-[11px] leading-relaxed mt-0.5">
            As confirmed by the client, both historical MK blocks represent the exact same bank account (the second block was created due to a delayed entry). All MK orders, commissions, and payouts are unified into this single ledger.
          </p>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((acct) => {
          const bal = acct.current_balance || 0;
          return (
            <div
              key={acct.id}
              onClick={() => setSelectedAccount(selectedAccount === acct.id ? "" : acct.id)}
              className={`p-5 rounded-xl border transition-all cursor-pointer shadow-sm ${
                selectedAccount === acct.id
                  ? "bg-slate-900 text-white border-slate-900 ring-2 ring-emerald-500"
                  : "bg-white text-slate-900 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold tracking-tight">{acct.account_name}</h3>
                <Landmark className={`w-4 h-4 ${selectedAccount === acct.id ? "text-emerald-400" : "text-slate-400"}`} />
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className={`text-[10px] uppercase tracking-wider font-semibold ${selectedAccount === acct.id ? "text-slate-400" : "text-slate-500"}`}>
                  Current Balance
                </span>
                <p className={`text-base font-bold font-mono mt-0.5 ${selectedAccount === acct.id ? "text-white" : "text-slate-900"}`}>
                  {formatINR(bal)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bank Distrip Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Bank Distribution Ledger {selectedAccount ? "(Filtered)" : "(All Accounts)"}
            </h4>
            <p className="text-xs text-slate-500">
              Formula: Current Balance = Previous Balance + Order + Commission - Paid
            </p>
          </div>
          {selectedAccount && (
            <button
              onClick={() => setSelectedAccount("")}
              className="text-xs font-semibold text-emerald-600 hover:underline"
            >
              Show All Accounts
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4 text-right">Order (INR)</th>
                <th className="py-3 px-4 text-right">Commission (INR)</th>
                <th className="py-3 px-4 text-right">Paid / Funded (INR)</th>
                <th className="py-3 px-4 text-right">Running Balance (INR)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Loading bank distribution records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No distribution records found.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-medium">{r.record_date}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{r.account_name}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">{formatINR(r.order_inr)}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatINR(r.commission_inr)}</td>
                    <td className="py-3 px-4 text-right text-emerald-700 font-medium">{formatINR(r.paid_inr)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(r.balance_inr)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditRecord(r)}
                          title="Edit Record"
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteRecordTarget(r);
                            setDeleteError(null);
                          }}
                          title="Delete Record"
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded border border-rose-200"
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

      {/* Add Bank Record Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRecord}
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Bank Distribution Record</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={recDate}
                  onChange={(e) => setRecDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account</label>
                <select
                  value={recAccountId}
                  onChange={(e) => setRecAccountId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Order Amount (INR)
              </label>
              <input
                type="number"
                step="any"
                placeholder="0"
                value={recOrder}
                onChange={(e) => setRecOrder(e.target.value)}
                className="w-full text-sm font-medium border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Commission (INR)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={recCom}
                  onChange={(e) => setRecCom(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paid / Funded (INR)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={recPaid}
                  onChange={(e) => setRecPaid(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
              <input
                type="text"
                placeholder="Funding slip / reference"
                value={recNotes}
                onChange={(e) => setRecNotes(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm"
              >
                {submitting ? "Saving..." : "Save Record"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Bank Record Modal */}
      {editRecord && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateRecord}
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                <span>Edit Bank Ledger Record</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
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

            <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs flex justify-between">
              <span className="text-slate-500 font-semibold">Account:</span>
              <span className="font-bold text-slate-900">{editRecord.account_name}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Order Amount (INR)
              </label>
              <input
                type="number"
                step="any"
                value={editOrder}
                onChange={(e) => setEditOrder(e.target.value)}
                className="w-full text-sm font-medium border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Commission (INR)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editCom}
                  onChange={(e) => setEditCom(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paid / Funded (INR)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editPaid}
                  onChange={(e) => setEditPaid(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
              <input
                type="text"
                placeholder="Funding slip / reference"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditRecord(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
              >
                {editSubmitting ? "Updating..." : "Update Record"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Bank Record Confirmation Modal */}
      {deleteRecordTarget && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-rose-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Delete Bank Ledger Record</span>
              </h3>
              <button
                onClick={() => setDeleteRecordTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
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
                  Are you sure you want to delete this bank ledger entry for{" "}
                  <strong className="text-slate-900">{deleteRecordTarget.account_name}</strong> on{" "}
                  <strong className="text-slate-900">{deleteRecordTarget.record_date}</strong>?
                </p>
                <p className="text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200 text-[11px]">
                  The account's running balance will be recalculated automatically.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteRecordTarget(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRecord}
                disabled={deleteSubmitting}
                className="px-3.5 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 disabled:opacity-50 shadow-sm"
              >
                {deleteSubmitting ? "Deleting..." : "Delete Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
