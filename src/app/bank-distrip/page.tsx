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

  useEffect(() => {
    fetchBankData();
  }, [selectedAccount]);

  async function fetchBankData() {
    setLoading(true);
    try {
      let url = "/api/bank-distrip";
      if (selectedAccount) url += `?accountId=${selectedAccount}`;
      const res = await fetch(url);
      const json = await res.json();
      setAccounts(json.accounts || []);
      setRecords(json.records || []);
      if (json.accounts?.length > 0 && !recAccountId) {
        setRecAccountId(json.accounts[0].id);
      }
    } catch (err) {
      console.error(err);
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
                <span className={`text-[11px] font-mono font-bold ${selectedAccount === acct.id ? "text-emerald-400" : "text-emerald-700"}`}>
                  {acct.account_code}
                </span>
                <Landmark className={`w-4 h-4 ${selectedAccount === acct.id ? "text-slate-400" : "text-slate-400"}`} />
              </div>
              <h3 className="text-sm font-bold mt-2">{acct.account_name}</h3>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    Loading bank distribution records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
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
                      {a.account_name} ({a.account_code})
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
    </div>
  );
}
