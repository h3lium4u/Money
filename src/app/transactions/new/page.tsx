"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Coins,
  RefreshCw,
} from "lucide-react";

interface CustomerOption {
  id: string;
  code: string;
  name: string;
  default_rate?: number;
  outstanding_balance?: number;
}

interface CalculationPreview {
  inrAmount: number;
  customerRate: number;
  customerRateInrPerAed: number;
  aedAmount: number;
  baseRate: number;
  baseRateAedPer1000: number;
  baseRateInrPerAed: number;
  costAed: number;
  grossProfitAed: number;
  deliveryChargePct: number;
  deliveryChargeAed: number;
  netProfitAed: number;
  marginPct: number;
  warning?: string | null;
}

export default function NewTransactionPage() {
  const router = useRouter();

  // Inputs
  const [date, setDate] = useState("2026-09-26");
  const [customerId, setCustomerId] = useState("");
  const [inrAmount, setInrAmount] = useState<string>("100000");
  const [customerRate, setCustomerRate] = useState<string>("38.25");
  const [baseRate, setBaseRate] = useState<string>("26.82");
  const [deliveryPct, setDeliveryPct] = useState<string>("20");
  const [distributorId, setDistributorId] = useState("");
  const [notes, setNotes] = useState("");

  // Options
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);

  // Calculation state
  const [preview, setPreview] = useState<CalculationPreview | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTxn, setSuccessTxn] = useState<any | null>(null);

  // Load customers and distributors
  useEffect(() => {
    async function loadOptions() {
      try {
        const [cRes, dRes] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/distributors"),
        ]);
        const cJson = await cRes.json();
        const dJson = await dRes.json();
        setCustomers(cJson);
        setDistributors(dJson);
        if (cJson.length > 0) {
          setCustomerId(cJson[0].id);
          if (cJson[0].default_rate) {
            setCustomerRate(String(cJson[0].default_rate));
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadOptions();
  }, []);

  function handleCustomerChange(cId: string) {
    setCustomerId(cId);
    const selected = customers.find((c) => c.id === cId);
    if (selected?.default_rate) {
      setCustomerRate(String(selected.default_rate));
    }
  }

  // Live Server Calculation
  useEffect(() => {
    const inr = parseFloat(inrAmount);
    const cRate = parseFloat(customerRate);
    const bRate = parseFloat(baseRate);
    const dPct = parseFloat(deliveryPct) / 100;

    if (!inr || inr <= 0 || !cRate || cRate <= 0 || !bRate || bRate <= 0) {
      setPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCalculating(true);
      setError(null);
      try {
        const res = await fetch("/api/transactions/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inrAmount: inr,
            customerRate: cRate,
            baseRate: bRate,
            deliveryChargePct: isNaN(dPct) ? 0.2 : dPct,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPreview(data);
      } catch (err: any) {
        setError(err.message);
        setPreview(null);
      } finally {
        setCalculating(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [inrAmount, customerRate, baseRate, deliveryPct]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError("Please select a customer");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: date,
          customer_id: customerId,
          inr_amount: parseFloat(inrAmount),
          customer_rate: parseFloat(customerRate),
          base_rate: parseFloat(baseRate),
          delivery_charge_pct: parseFloat(deliveryPct) / 100,
          distributor_id: distributorId || null,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessTxn(data);
    } catch (err: any) {
      setError(err.message || "Failed to save transfer");
    } finally {
      setSaving(false);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">New Money Transfer</h2>
        <p className="text-xs text-slate-500">
          Enter order details below. AED totals and net profit calculate automatically.
        </p>
      </div>

      {/* Success Banner */}
      {successTxn && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Transfer Saved Successfully</span>
              <h3 className="text-base font-mono font-bold text-slate-900">{successTxn.transaction_number}</h3>
              <p className="text-xs text-slate-600">
                ₹ {successTxn.inr_amount.toLocaleString()} for {selectedCustomer?.name} •{" "}
                <span className="font-bold text-slate-900">{successTxn.aed_amount.toFixed(2)} AED</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSuccessTxn(null);
                setInrAmount("");
                setNotes("");
              }}
              className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm"
            >
              + Another Transfer
            </button>
            <button
              onClick={() => router.push(`/customers/${customerId}`)}
              className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50"
            >
              View Customer Ledger
            </button>
          </div>
        </div>
      )}

      {/* Two Columns: Form & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Date & Customer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Customer</span>
                {selectedCustomer && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    Due: {(selectedCustomer.outstanding_balance || 0).toFixed(2)} AED
                  </span>
                )}
              </label>
              <select
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* INR Amount */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              INR Amount (Money to Send)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                step="any"
                required
                placeholder="100000"
                value={inrAmount}
                onChange={(e) => setInrAmount(e.target.value)}
                className="w-full text-base font-bold pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Rates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Customer Rate</span>
                <span className="text-[10px] text-emerald-600 font-bold">AED / 1000 INR</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="38.25"
                value={customerRate}
                onChange={(e) => setCustomerRate(e.target.value)}
                className="w-full text-sm font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                = {preview ? `${preview.customerRateInrPerAed} INR per AED` : "..."}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Cost Rate</span>
                <span className="text-[10px] text-slate-500 font-medium">INR per AED</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="26.82"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                className="w-full text-sm font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                = {preview ? `${preview.baseRateAedPer1000} AED per 1000` : "..."}
              </p>
            </div>
          </div>

          {/* Delivery Fee & Partner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Delivery Fee (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={deliveryPct}
                  onChange={(e) => setDeliveryPct(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2 text-slate-400 text-xs font-bold">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Bank / Partner (Optional)
              </label>
              <select
                value={distributorId}
                onChange={(e) => setDistributorId(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Direct / None --</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Beneficiary IFSC / reference"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !preview}
            className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm ${
              saving || !preview
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {saving ? "Saving..." : "Save Transfer"}
          </button>
        </form>

        {/* Live Summary Column */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-sm text-slate-200">Summary & Profit</h4>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                Auto-Calculated
              </span>
            </div>

            {calculating ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Calculating...</span>
              </div>
            ) : preview ? (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Customer</span>
                  <span className="font-bold text-slate-200">{selectedCustomer?.name || "..."}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">INR Amount</span>
                  <span className="font-bold text-slate-200">₹ {preview.inrAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Customer Rate</span>
                  <span className="font-mono text-slate-200">{preview.customerRate} AED/1000</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800 text-sm">
                  <span className="font-bold text-emerald-400">Customer Pays (AED)</span>
                  <span className="font-bold text-emerald-400">{preview.aedAmount.toFixed(2)} AED</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>Our Cost (AED)</span>
                  <span>{preview.costAed.toFixed(2)} AED</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>Gross Profit</span>
                  <span className={preview.grossProfitAed >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                    {preview.grossProfitAed.toFixed(2)} AED
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>Delivery Fee ({preview.deliveryChargePct * 100}%)</span>
                  <span>- {preview.deliveryChargeAed.toFixed(2)} AED</span>
                </div>
                <div className="flex justify-between py-2 text-base font-bold">
                  <span className="text-white">Your Net Profit</span>
                  <span className={preview.netProfitAed >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {preview.netProfitAed.toFixed(2)} AED
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Type an INR amount to preview calculations.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
