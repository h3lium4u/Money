"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  CreditCard,
  PlusCircle,
  Printer,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  Edit3,
  Trash2,
  AlertTriangle,
  Handshake,
  Zap,
} from "lucide-react";
import { ReceiptPrinterModal } from "@/components/animation/ReceiptPrinterModal";
import { getTodayDateString } from "@/lib/date-utils";

export default function PartyDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Delete payment state
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

  // Edit party modal state
  const [showEditPartyModal, setShowEditPartyModal] = useState(false);
  const [editPartyName, setEditPartyName] = useState("");
  const [editPartyCode, setEditPartyCode] = useState("");
  const [editPartyPhone, setEditPartyPhone] = useState("");
  const [editPartyRate, setEditPartyRate] = useState("38.25");
  const [isSubmittingPartyEdit, setIsSubmittingPartyEdit] = useState(false);
  const [partyEditError, setPartyEditError] = useState<string | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState(false);

  useEffect(() => {
    if (id) fetchPartyLedger();
  }, [id]);

  useEffect(() => {
    if (data?.customer) {
      setEditPartyName(data.customer.name || "");
      setEditPartyCode(data.customer.code || "");
      setEditPartyPhone(data.customer.phone || "");
      setEditPartyRate(String(data.customer.default_rate || 38.25));
    }
  }, [data]);

  async function fetchPartyLedger() {
    setLoading(true);
    try {
      const res = await fetch(`/api/parties/${id}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;

    setIsSubmittingPay(true);
    try {
      const res = await fetch(`/api/parties/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_date: payDate,
          amount_aed: amt,
          payment_method: payMethod,
          notes: payNotes || undefined,
        }),
      });
      if (res.ok) {
        setShowPayModal(false);
        setPayDate(getTodayDateString());
        setPayAmount("");
        setPayNotes("");
        fetchPartyLedger();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingPay(false);
    }
  }

  async function handleDeletePayment() {
    if (!deletePaymentId) return;
    setIsDeletingPayment(true);
    try {
      const res = await fetch(`/api/parties/${id}/payments?paymentId=${deletePaymentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeletePaymentId(null);
        fetchPartyLedger();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingPayment(false);
    }
  }

  async function handleUpdateParty(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmittingPartyEdit(true);
    setPartyEditError(null);
    try {
      const res = await fetch(`/api/parties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editPartyName,
          code: editPartyCode || undefined,
          phone: editPartyPhone || undefined,
          default_rate: parseFloat(editPartyRate) || 38.25,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to update party");

      setShowEditPartyModal(false);
      fetchPartyLedger();
    } catch (err: any) {
      setPartyEditError(err.message || "Failed to update party");
    } finally {
      setIsSubmittingPartyEdit(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-slate-400 text-xs">
        Loading party financial statement...
      </div>
    );
  }

  if (!data || !data.customer) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center space-y-4">
        <p className="text-slate-500 text-sm">Party account not found.</p>
        <Link href="/parties" className="text-xs text-teal-600 font-bold hover:underline">
          &larr; Back to Parties
        </Link>
      </div>
    );
  }

  const party = data.customer;
  const ledger = data.ledger || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/parties"
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {party.name}
              </h2>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                {party.code}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                PARTY
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Default Rate: <span className="font-mono font-semibold">{party.default_rate || "38.25"}</span> | Phone: {party.phone || "None listed"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/transactions/direct?partyId=${party.id}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-sm cursor-pointer transition-all"
            title="Create Direct Party Transfer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>+ Direct Transfer</span>
          </Link>

          <button
            type="button"
            onClick={() => setShowEditPartyModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs cursor-pointer transition-all"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrinterModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs cursor-pointer transition-all"
            title="Preview and print thermal statement receipt"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Statement</span>
          </button>

          <button
            onClick={() => {
              setPayDate(getTodayDateString());
              setShowPayModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Record Settlement</span>
          </button>
        </div>
      </div>

      {/* KPI Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Orders (INR)
          </span>
          <p className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100 mt-1">
            ₹{Number(party.total_inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Invoiced (AED)
          </span>
          <p className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100 mt-1">
            {Number(party.total_aed || 0).toFixed(2)} AED
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Settlements Paid (AED)
          </span>
          <p className="text-xl font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {Number(party.total_paid || 0).toFixed(2)} AED
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/20 shadow-xs">
          <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider block">
            Outstanding Due (AED)
          </span>
          <p className="text-xl font-mono font-bold text-rose-700 dark:text-rose-400 mt-1">
            {Number(party.outstanding_balance || 0).toFixed(2)} AED
          </p>
        </div>
      </div>

      {/* Movement Ledger Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Financial Ledger & Transactions</h3>
          <span className="text-xs text-slate-500">{ledger.length} movement records</span>
        </div>

        {ledger.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No transactions or settlements recorded for this party yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">INR Amount</th>
                  <th className="py-3 px-4">Debit (AED)</th>
                  <th className="py-3 px-4">Credit (AED)</th>
                  <th className="py-3 px-4">Running Due (AED)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {ledger.map((e: any, idx: number) => {
                  const isTxn = e.entry_type === "TRANSACTION";
                  return (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">{e.date}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isTxn
                              ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          {isTxn ? "TRANSFER" : "SETTLEMENT"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {e.reference || "-"}
                        {e.notes && <span className="text-slate-400 font-normal ml-1">({e.notes})</span>}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold">
                        {e.inr_amount ? `₹${Number(e.inr_amount).toLocaleString("en-IN")}` : "-"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {e.debit_aed ? Number(e.debit_aed).toFixed(2) : "-"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {e.credit_aed ? Number(e.credit_aed).toFixed(2) : "-"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-700 dark:text-rose-400">
                        {Number(e.running_balance_aed).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isTxn && (
                          <button
                            onClick={() => setDeletePaymentId(e.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                            title="Delete settlement payment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD SETTLEMENT MODAL */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>Record Party Settlement</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Party</label>
                <input
                  type="text"
                  readOnly
                  value={party.name}
                  className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-700 dark:text-slate-300 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Settlement Date</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="CASH">CASH (Physical)</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="CHEQUE">CHEQUE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount (AED) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full text-sm font-mono font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Cash collected in Dubai"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingPay ? "Saving..." : "Record Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PARTY MODAL */}
      {showEditPartyModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <span>Edit Party Profile</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditPartyModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {partyEditError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{partyEditError}</span>
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
                  value={editPartyName}
                  onChange={(e) => setEditPartyName(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={editPartyCode}
                    onChange={(e) => setEditPartyCode(e.target.value)}
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
                    value={editPartyRate}
                    onChange={(e) => setEditPartyRate(e.target.value)}
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
                  value={editPartyPhone}
                  onChange={(e) => setEditPartyPhone(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditPartyModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPartyEdit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingPartyEdit ? "Saving..." : "Update Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* THERMAL STATEMENT PRINTER MODAL */}
      <ReceiptPrinterModal
        isOpen={showPrinterModal}
        reportType="customer-statement"
        customerData={{
          name: party.name,
          code: party.code,
          totalInr: party.total_inr,
          totalPaid: party.total_paid,
          outstanding: party.outstanding_balance,
          entries: ledger.map((e: any) => ({
            date: e.date,
            type: e.entry_type === "TRANSACTION" ? "TRANSFER" : "SETTLEMENT",
            reference: e.reference || (e.entry_type === "TRANSACTION" ? "Party Transfer" : "Settlement Received"),
            amount: e.entry_type === "TRANSACTION" ? e.inr_amount : e.credit_aed,
            currency: e.entry_type === "TRANSACTION" ? "INR" : "AED",
          })),
        }}
        onCompletePrint={() => {
          window.print();
        }}
        onClose={() => setShowPrinterModal(false)}
      />
    </div>
  );
}
