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
} from "lucide-react";
import { ReceiptPrinterModal } from "@/components/animation/ReceiptPrinterModal";
import { getTodayDateString } from "@/lib/date-utils";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function CustomerDetailPage() {
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

  // Edit customer modal state
  const [showEditCustModal, setShowEditCustModal] = useState(false);
  const [editCustName, setEditCustName] = useState("");
  const [editCustCode, setEditCustCode] = useState("");
  const [editCustPhone, setEditCustPhone] = useState("");
  const [editCustRate, setEditCustRate] = useState("38.25");
  const [isSubmittingCustEdit, setIsSubmittingCustEdit] = useState(false);
  const [custEditError, setCustEditError] = useState<string | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState(false);

  useEffect(() => {
    if (id) fetchCustomerLedger();
  }, [id]);

  useEffect(() => {
    if (data?.customer) {
      setEditCustName(data.customer.name || "");
      setEditCustCode(data.customer.code || "");
      setEditCustPhone(data.customer.phone || "");
      setEditCustRate(String(data.customer.default_rate || 38.25));
    }
  }, [data]);

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
        setPayDate(getTodayDateString());
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

  async function handleDeletePayment() {
    if (!deletePaymentId) return;
    setIsDeletingPayment(true);
    try {
      const res = await fetch(`/api/customers/${id}/payments?paymentId=${deletePaymentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeletePaymentId(null);
        fetchCustomerLedger();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingPayment(false);
    }
  }

  async function handleUpdateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!editCustName.trim()) return;

    setIsSubmittingCustEdit(true);
    setCustEditError(null);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editCustName.trim(),
          code: editCustCode.trim() || undefined,
          phone: editCustPhone.trim() || undefined,
          default_rate: editCustRate ? parseFloat(editCustRate) : 38.25,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to update customer");

      setShowEditCustModal(false);
      fetchCustomerLedger();
    } catch (err: any) {
      setCustEditError(err.message || "Failed to update customer");
    } finally {
      setIsSubmittingCustEdit(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-pulse">
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-24 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-20 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800" />
          <div className="h-20 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800" />
          <div className="h-20 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800" />
          <div className="h-20 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800" />
        </div>
        <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  if (!data?.customer) {
    return <div className="p-8 text-center text-xs text-slate-500">Customer account not found.</div>;
  }

  const customer = data.customer;
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const outstanding = customer.outstanding_balance || 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto print:space-y-4">
      <Breadcrumbs items={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Customers", href: "/customers" },
        { label: customer?.name || "Statement" },
      ]} />
      {/* Top Navigation - Hidden on Print */}
      <div className="flex items-center justify-between no-print">
        <Link
          href="/customers"
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Customers Directory</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEditCustModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrinterModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer transition-all"
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-teal-700 text-white hover:bg-teal-800 shadow-sm"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Print-Only Professional Header */}
      <div className="hidden print-only border-b border-slate-300 pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">PETTI REMITTANCE (DUBAI ⇄ INDIA)</h1>
            <p className="text-xs text-slate-600">Official Customer Account Statement</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono font-bold text-slate-700">{customer.code}</p>
            <p className="text-base font-bold text-slate-900">{customer.name}</p>
          </div>
        </div>
      </div>

      {/* Customer Header Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-[11px] font-mono text-teal-700 font-semibold uppercase">{customer.code}</span>
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
            <p className="text-base font-bold text-teal-700">
              {(customer.total_paid || 0).toFixed(2)} AED
            </p>
          </div>

          <div className="text-right pl-6 border-l border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Outstanding Balance</span>
            <p
              className={`text-xl font-bold ${
                outstanding > 0.01 ? "text-rose-600" : outstanding < -0.01 ? "text-blue-600" : "text-teal-700"
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
                <th className="py-3 px-4 text-center print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
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
                            : "bg-teal-100 text-teal-800"
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
                    <td className="py-3 px-4 text-right font-medium text-teal-700">
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
                    <td className="py-3 px-4 text-center print:hidden">
                      {e.type === "PAYMENT" && e.id ? (
                        <button
                          onClick={() => setDeletePaymentId(e.id)}
                          title="Delete Payment Receipt"
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded border border-rose-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
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
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <input
                  type="text"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  placeholder="Payment Method"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
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
                className="w-full text-sm font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Voucher Reference</label>
              <input
                type="text"
                placeholder="Receipt / slip number"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                className="px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800 shadow-sm"
              >
                {isSubmittingPay ? "Saving..." : "Confirm Payment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Payment Modal */}
      {deletePaymentId && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-rose-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Delete Payment Record</span>
              </h3>
              <button
                onClick={() => setDeletePaymentId(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete this payment receipt? The customer's balance will be adjusted accordingly.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletePaymentId(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePayment}
                disabled={isDeletingPayment}
                className="px-3.5 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 disabled:opacity-50 shadow-sm"
              >
                {isDeletingPayment ? "Deleting..." : "Delete Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Profile Modal */}
      {showEditCustModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateCustomer}
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-teal-700" />
                <span>Edit Customer Profile</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditCustModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {custEditError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{custEditError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
              <input
                type="text"
                required
                value={editCustName}
                onChange={(e) => setEditCustName(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  value={editCustCode}
                  onChange={(e) => setEditCustCode(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Rate</label>
                <input
                  type="number"
                  step="any"
                  value={editCustRate}
                  onChange={(e) => setEditCustRate(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={editCustPhone}
                onChange={(e) => setEditCustPhone(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditCustModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingCustEdit}
                className="px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800 disabled:opacity-50 shadow-sm"
              >
                {isSubmittingCustEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Animated Receipt Printer Modal */}
      <ReceiptPrinterModal
        isOpen={showPrinterModal}
        reportType="customer-statement"
        customerData={{
          name: customer.name,
          code: customer.code,
          totalInr: customer.total_inr,
          totalPaid: customer.total_paid,
          outstanding: outstanding,
          entries: entries.map((e: any) => ({
            date: e.date,
            type: e.type,
            reference: e.reference || (e.type === "TRANSACTION" ? "Remittance Order" : "Payment Received"),
            amount: e.type === "TRANSACTION" ? e.inr_amount : e.aed_amount,
            currency: e.type === "TRANSACTION" ? "INR" : "AED",
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
