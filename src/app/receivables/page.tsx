"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wallet,
  Coins,
  CreditCard,
  PlusCircle,
  AlertCircle,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { getTodayDateString } from "@/lib/date-utils";

export default function ReceivablesPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick payment modal
  const [showModal, setShowModal] = useState(false);
  const [selectedCustId, setSelectedCustId] = useState("");
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNotes, setPayNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      const validCusts = Array.isArray(data) ? data : [];
      setCustomers(validCusts);
      if (validCusts.length > 0 && !selectedCustId) {
        setSelectedCustId(validCusts[0].id);
      }
    } catch (err) {
      console.error(err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustId) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustId}/payments`, {
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
        setShowModal(false);
        setPayDate(getTodayDateString());
        setPayAmount("");
        setPayNotes("");
        fetchCustomers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const owingCustomers = customers.filter((c) => (c.outstanding_balance || 0) > 0.01);
  const totalReceivables = owingCustomers.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Receivables & Cash Management</h2>
          <p className="text-xs text-slate-500">
            Track customer balances, payment intake, and Dubai physical cash reconciliations.
          </p>
        </div>

        <button
          onClick={() => {
            setPayDate(getTodayDateString());
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-teal-700 text-white hover:bg-teal-800 shadow-sm"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Record Customer Payment</span>
        </button>
      </div>

      {/* Client Confirmation Notice Box */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
        <div className="flex items-center gap-2 font-bold text-amber-950">
          <HelpCircle className="w-4 h-4 text-amber-600" />
          <span>Customer Receivables & Balance (REQUIRES CLIENT CONFIRMATION)</span>
        </div>
        <p className="text-amber-800 leading-relaxed text-[11px]">
          The exact business meaning and ledger direction of <code>RECVD</code> vs <code>PAID</code> in customer receivables is currently under client review.
          Currently, confirmed remittance orders debit the customer account in AED, and cash/transfer payments credit the account in AED to establish the outstanding balance.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Customer Receivables</span>
          {loading ? (
            <div className="h-8 w-32 rounded-md bg-slate-200 animate-pulse mt-2" />
          ) : (
            <h3 className="text-2xl font-bold text-rose-600 mt-2">
              {totalReceivables.toLocaleString("en-US", { minimumFractionDigits: 2 })} AED
            </h3>
          )}
          {loading ? (
            <div className="h-4 w-40 rounded bg-slate-200 animate-pulse mt-1" />
          ) : (
            <p className="text-xs text-slate-500 mt-1">Across {owingCustomers.length} active customer accounts</p>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Settled Customer Accounts</span>
          {loading ? (
            <div className="h-8 w-24 rounded-md bg-slate-200 animate-pulse mt-2" />
          ) : (
            <h3 className="text-2xl font-bold text-teal-700 mt-2">
              {customers.length - owingCustomers.length} Accounts
            </h3>
          )}
          {loading ? (
            <div className="h-4 w-32 rounded bg-slate-200 animate-pulse mt-1" />
          ) : (
            <p className="text-xs text-slate-500 mt-1">Zero balance / fully paid</p>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Accounts Tracked</span>
          {loading ? (
            <div className="h-8 w-24 rounded-md bg-slate-200 animate-pulse mt-2" />
          ) : (
            <h3 className="text-2xl font-bold text-slate-900 mt-2">
              {customers.length} Customers
            </h3>
          )}
          {loading ? (
            <div className="h-4 w-32 rounded bg-slate-200 animate-pulse mt-1" />
          ) : (
            <p className="text-xs text-slate-500 mt-1">All verified active customers</p>
          )}
        </div>
      </div>

      {/* Customer Receivables Outstanding Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-sm">Customers with Pending Receivables</h4>
          <span className="text-xs text-slate-500">{owingCustomers.length} Accounts with balance</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3 text-right">Total AED Billed</th>
                <th className="py-2.5 px-3 text-right">Total AED Paid</th>
                <th className="py-2.5 px-3 text-right">Outstanding (AED)</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    Loading receivables...
                  </td>
                </tr>
              ) : owingCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-teal-700 text-xs font-semibold">
                    ✓ All customer accounts are settled and have zero outstanding balance!
                  </td>
                </tr>
              ) : (
                owingCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{c.name}</div>
                      {c.code && (
                        <div className="text-[10px] font-mono text-slate-500">{c.code}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-900 whitespace-nowrap">
                      {(c.total_aed || 0).toFixed(2)} AED
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-teal-700 whitespace-nowrap">
                      {(c.total_paid || 0).toFixed(2)} AED
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                      {(c.outstanding_balance || 0).toFixed(2)} AED
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedCustId(c.id);
                          setShowModal(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:bg-teal-50 rounded"
                      >
                        Settle Payment ➔
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordPayment}
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Receive Customer Payment</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer</label>
              <select
                value={selectedCustId}
                onChange={(e) => setSelectedCustId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Due: {(c.outstanding_balance || 0).toFixed(2)} AED)
                  </option>
                ))}
              </select>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Voucher</label>
              <input
                type="text"
                placeholder="Deposit slip / transfer reference"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                className="px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800 shadow-sm"
              >
                {submitting ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
