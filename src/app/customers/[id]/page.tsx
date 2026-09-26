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
} from "lucide-react";

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  useEffect(() => {
    if (id) fetchCustomerLedger();
  }, [id]);

  async function fetchCustomerLedger() {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${id}`);
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
      const res = await fetch(`/api/customers/${id}/payments`, {
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
        setPayAmount("");
        setPayNotes("");
        fetchCustomerLedger();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingPay(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading customer account...</div>;
  }

  if (!data?.customer) {
    return <div className="p-8 text-center text-xs text-slate-500">Customer account not found.</div>;
  }

  const { customer, entries } = data;
  const outstanding = customer.outstanding_balance || 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/customers"
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Customers Directory</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Statement</span>
          </button>

          <button
            onClick={() => setShowPayModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Customer Header Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-[11px] font-mono text-emerald-700 font-semibold uppercase">{customer.code}</span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{customer.name}</h2>
          <p className="text-xs text-slate-500 mt-1">
            Default Pricing Rate: <span className="font-mono font-semibold text-slate-700">{customer.default_rate || 38.25} AED/1000</span>
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium">Total Processed</span>
            <p className="text-base font-bold text-slate-900">
              ₹ {(customer.total_inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium">Total Paid</span>
            <p className="text-base font-bold text-emerald-700">
              {(customer.total_paid || 0).toFixed(2)} AED
            </p>
          </div>

          <div className="text-right pl-6 border-l border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Outstanding Balance</span>
            <p
              className={`text-xl font-bold ${
                outstanding > 0.01 ? "text-rose-600" : outstanding < -0.01 ? "text-blue-600" : "text-emerald-600"
              }`}
            >
              {outstanding.toFixed(2)} AED
            </p>
          </div>
        </div>
      </div>

      {/* Running Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-sm">Account Ledger & Statement of Transactions</h4>
          <span className="text-xs text-slate-500">{entries.length} Ledger entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Reference ID</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Debit (AED Billed)</th>
                <th className="py-3 px-4 text-right">Credit (AED Paid)</th>
                <th className="py-3 px-4 text-right">Running Balance (AED)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No ledger history for this account yet.
                  </td>
                </tr>
              ) : (
                entries.map((e: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-medium">{e.date}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          e.type === "TRANSACTION"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {e.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{e.reference}</td>
                    <td className="py-3 px-4 text-slate-600">{e.description}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      {e.debit_aed > 0 ? `${e.debit_aed.toFixed(2)} AED` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-700">
                      {e.credit_aed > 0 ? `${e.credit_aed.toFixed(2)} AED` : "—"}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        e.running_balance_aed > 0.01
                          ? "text-rose-600"
                          : e.running_balance_aed < -0.01
                          ? "text-blue-600"
                          : "text-slate-700"
                      }`}
                    >
                      {e.running_balance_aed.toFixed(2)} AED
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordPayment}
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Record Customer Payment</h3>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer</label>
              <input
                type="text"
                disabled
                value={customer.name}
                className="w-full text-xs bg-slate-100 border border-slate-300 rounded-lg p-2 text-slate-700 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CASH">Cash (Dubai)</option>
                  <option value="BANK_TRANSFER">Bank Transfer (AED)</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OFFSET">Account Offset</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount Received (AED)
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 5000"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full text-sm font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Voucher Reference</label>
              <input
                type="text"
                placeholder="Receipt / slip number"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingPay}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm"
              >
                {isSubmittingPay ? "Saving..." : "Confirm Payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
