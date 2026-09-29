"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Handshake,
  Search,
  PlusCircle,
  Coins,
  CheckCircle,
  AlertCircle,
  CreditCard,
  UserPlus,
  AlertTriangle,
  Edit3,
  Trash2,
  Zap,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import { getTodayDateString } from "@/lib/date-utils";

export default function PartiesPage() {
  const router = useRouter();
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");

  // Create Party Modal State
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRate, setNewRate] = useState("38.25");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Party Modal State
  const [editParty, setEditParty] = useState<any | null>(null);
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

  // Quick Payment Modal State
  const [payingParty, setPayingParty] = useState<any | null>(null);
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNotes, setPayNotes] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    fetchParties();
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create party");

      setShowModal(false);
      setNewName("");
      setNewCode("");
      setNewPhone("");
      setNewRate("38.25");
      fetchParties();
    } catch (err: any) {
      setModalError(err.message || "Failed to create party");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(party: any) {
    setEditParty(party);
    setEditName(party.name || "");
    setEditCode(party.code || "");
    setEditPhone(party.phone || "");
    setEditRate(party.default_rate ? String(party.default_rate) : "38.25");
    setEditError(null);
  }

  async function handleUpdateParty(e: React.FormEvent) {
    e.preventDefault();
    if (!editParty) return;

    if (!editName.trim()) {
      setEditError("Party name is required");
      return;
    }

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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update party");

      setEditParty(null);
      fetchParties();
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

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete party");

      setDeletePartyTarget(null);
      fetchParties();
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
    } catch (err: any) {
      setPayError(err.message || "Failed to record payment");
    } finally {
      setPaySubmitting(false);
    }
  }

  const filtered = parties.filter((p) => {
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
  const totalInr = parties.reduce((sum, p) => sum + (p.total_inr || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Registered Parties & Ledger
            </h2>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              Direct Transfer Accounts
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Separate accounts for primary parties (AWAFI, BASID, HAJA, NF2, SARABU) and custom added parties.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/transactions/direct"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs cursor-pointer"
          >
            <Zap className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Direct Transfer</span>
          </Link>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add New Party</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Parties</span>
            <Handshake className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100 mt-1">
            {parties.length}
          </p>
          <span className="text-[11px] text-slate-400">AWAFI, BASID, HAJA, NF2, SARABU + custom</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Party Orders (INR)</span>
            <Layers className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-mono font-bold text-teal-700 dark:text-teal-400 mt-1">
            ₹{totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400">Total remittance volume processed</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
              Total Outstanding Due
            </span>
            <Coins className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-mono font-bold text-rose-700 dark:text-rose-400 mt-1">
            {totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })} AED
          </p>
          <span className="text-[11px] text-rose-600/70">Unsettled receivable balance</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {[
            { id: "all", label: "All Parties" },
            { id: "owing", label: "Has Balance" },
            { id: "cleared", label: "Settled / Cleared" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setBalanceFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
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

      {/* Parties Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading parties...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            {search ? "No parties match your search query." : "No parties found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Party Name</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Default Rate</th>
                  <th className="py-3 px-4">Total Orders (INR)</th>
                  <th className="py-3 px-4">Total Orders (AED)</th>
                  <th className="py-3 px-4">Paid (AED)</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filtered.map((party) => {
                  const hasDue = (party.outstanding_balance || 0) > 0.01;
                  return (
                    <tr
                      key={party.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/parties/${party.id}`}
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1.5"
                        >
                          <Handshake className="w-3.5 h-3.5 text-teal-600" />
                          <span>{party.name}</span>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-500">
                        {party.code || "-"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold">
                        {party.default_rate ? Number(party.default_rate).toFixed(2) : "38.25"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        ₹{Number(party.total_inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {Number(party.total_aed || 0).toFixed(2)} AED
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        {Number(party.total_paid || 0).toFixed(2)} AED
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold">
                        {hasDue ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            {Number(party.outstanding_balance).toFixed(2)} AED
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            0.00 AED
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/transactions/direct?partyId=${party.id}`}
                            className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            title="New Direct Transfer for this party"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </Link>

                          {hasDue && (
                            <button
                              onClick={() => handleOpenPayModal(party)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
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
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Party Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWAFI, BASID, etc."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AWAFI"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Default Rate
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="38.25"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+971 50 ..."
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
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
                  {submitting ? "Saving..." : "Create Party"}
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
                <span>Edit Party: {editParty.name}</span>
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

            <form onSubmit={handleUpdateParty} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Party Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Default Rate
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
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
                  {editSubmitting ? "Updating..." : "Update Party"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletePartyTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete Party</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to delete <strong>{deletePartyTarget.name}</strong>? All associated ledger records will be unlinked.
            </p>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletePartyTarget(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteParty}
                disabled={deleteSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleteSubmitting ? "Deleting..." : "Delete Party"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK SETTLEMENT / PAYMENT MODAL */}
      {payingParty && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>Record Settlement: {payingParty.name}</span>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="CASH">CASH (Physical)</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="CHEQUE">CHEQUE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Settlement Amount (AED) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full text-sm font-mono font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Current Balance Due: {(payingParty.outstanding_balance || 0).toFixed(2)} AED
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Reference or notes..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
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
