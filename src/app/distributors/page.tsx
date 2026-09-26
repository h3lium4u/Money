"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";

export default function IndiaDistributionPage() {
  const [activeTab, setActiveTab] = useState<"splits" | "partners" | "unconfirmed">("splits");
  const [distributors, setDistributors] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Split Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTxnId, setModalTxnId] = useState("");
  const [modalDistId, setModalDistId] = useState("");
  const [modalDate, setModalDate] = useState("2026-09-26");
  const [modalAmount, setModalAmount] = useState("");
  const [modalRate, setModalRate] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

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

      setDistributors(distData || []);
      setSplits(splitsData || []);
      setTransactions(txnsData || []);

      if (distData.length > 0) {
        setModalDistId(distData[0].id);
      }
      if (txnsData.length > 0) {
        setModalTxnId(txnsData[0].id);
      }
    } catch (err) {
      console.error(err);
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

  // Filter parties by type
  const confirmedIndiaParties = distributors.filter(
    (d) => ["INDIA_DISTRIBUTOR", "HYBRID", "BANK_ACCOUNT"].includes(d.partner_type)
  );

  const unconfirmedParties = distributors.filter(
    (d) => d.partner_type === "UNCONFIRMED_PARTNER" || d.partner_type === "WHOLESALE_PARTNER"
  );

  // Selected Txn in modal
  const selectedModalTxn = transactions.find((t) => t.id === modalTxnId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>India Distribution & Splits</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
              Separate from Dubai Accounting
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            How received Dubai customer orders are allocated, split, and distributed across India parties.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Add Distribution Split</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("splits")}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === "splits"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          1. Distribution Splits by Order ({splits.length})
        </button>
        <button
          onClick={() => setActiveTab("partners")}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === "partners"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          2. India Parties & Balances ({confirmedIndiaParties.length})
        </button>
        <button
          onClick={() => setActiveTab("unconfirmed")}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "unconfirmed"
              ? "border-amber-600 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>3. Unconfirmed Parties</span>
          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
            Client Review
          </span>
        </button>
      </div>

      {/* TAB 1: DISTRIBUTION SPLITS BY ORDER */}
      {activeTab === "splits" && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-3">
            <Split className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">One Customer Transaction ➔ Multiple India Distributions</p>
              <p className="text-slate-500 mt-0.5">
                Each Dubai customer order can be split among multiple India parties (e.g. MK, ISMAIL, SARABU). The system ensures total distribution cannot exceed the customer’s INR order amount.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Split Date</th>
                    <th className="px-4 py-3">Remittance Txn</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">India Distributor</th>
                    <th className="px-4 py-3">INR Allocated</th>
                    <th className="px-4 py-3">Wholesale Rate</th>
                    <th className="px-4 py-3">AED Equivalent</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {splits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        No distribution splits recorded yet.
                      </td>
                    </tr>
                  ) : (
                    splits.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-slate-600">{s.split_date}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {s.transaction_number}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">{s.customer_name}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {s.distributor_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">{formatINR(s.inr_amount)}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {s.wholesale_rate ? s.wholesale_rate.toFixed(2) : "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {s.aed_equivalent ? formatAED(s.aed_equivalent) : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              s.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{s.notes || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INDIA PARTIES & BALANCES */}
      {activeTab === "partners" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {confirmedIndiaParties.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {p.code}
                    </span>
                    <h4 className="text-base font-bold text-slate-900 mt-1">{p.name}</h4>
                  </div>
                  <Building2 className="w-5 h-5 text-slate-400" />
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Role Type:</span>
                    <span className="font-semibold text-slate-800">{p.partner_type}</span>
                  </div>
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
                    <span className="font-bold text-slate-900">{formatINR(p.splits_balance_inr)}</span>
                  </div>
                </div>

                {p.client_confirmation_note && (
                  <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-100">
                    {p.client_confirmation_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: UNCONFIRMED PARTIES */}
      {activeTab === "unconfirmed" && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">REQUIRES CLIENT CONFIRMATION</p>
              <p className="text-amber-800 mt-1 leading-relaxed">
                The role and classification of <strong>AWAFI, NF2, HAJA, BASID</strong> are currently under review. They are preserved in the database with configurable types and will not be mixed into customers or active India distribution until the client gives final guidance.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unconfirmedParties.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-amber-800 uppercase bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {p.code}
                    </span>
                    <h4 className="text-base font-bold text-slate-900 mt-1">{p.name}</h4>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Pending Review
                  </span>
                </div>

                <p className="text-xs text-slate-600">
                  {p.client_confirmation_note || "Role and classification pending client confirmation."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD DISTRIBUTION SPLIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Split className="w-5 h-5 text-emerald-600" />
                <span>Add India Distribution Split</span>
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

            <form onSubmit={handleAddSplit} className="space-y-4">
              {/* Select Remittance Transaction */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Remittance Transaction
                </label>
                <select
                  value={modalTxnId}
                  onChange={(e) => setModalTxnId(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {transactions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.transaction_number} • {t.customer_name} • Total: ₹{t.inr_amount.toLocaleString()} (Pending: ₹
                      {(t.remaining_inr || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
                {selectedModalTxn && (
                  <div className="mt-1.5 p-2 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-600 flex justify-between">
                    <span>
                      Total Order: <strong>{formatINR(selectedModalTxn.inr_amount)}</strong>
                    </span>
                    <span>
                      Unallocated:{" "}
                      <strong className="text-amber-600">
                        {formatINR(selectedModalTxn.remaining_inr)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Select India Party */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  India Party / Distributor
                </label>
                <select
                  value={modalDistId}
                  onChange={(e) => setModalDistId(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {confirmedIndiaParties.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} • {d.name}
                    </option>
                  ))}
                </select>
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
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    INR Amount to Allocate
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="500000"
                    value={modalAmount}
                    onChange={(e) => setModalAmount(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>
              </div>

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
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                >
                  {submitting ? "Saving Split..." : "Confirm Split"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
