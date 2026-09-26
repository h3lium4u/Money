"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  User,
  Percent,
  Banknote,
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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
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

  // Update customer rate when customer changes
  function handleCustomerChange(cId: string) {
    setCustomerId(cId);
    const selected = customers.find((c) => c.id === cId);
    if (selected?.default_rate) {
      setCustomerRate(String(selected.default_rate));
    }
  }

  // Live Authoritative Backend Calculation (Debounced)
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
    }, 250);

    return () => clearTimeout(timer);
  }, [inrAmount, customerRate, baseRate, deliveryPct]);

  // Submit confirmed transaction
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
      setError(err.message || "Failed to save transaction");
    } finally {
      setSaving(false);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Create Remittance Transaction</h2>
          <p className="text-xs text-slate-500">
            Authoritative calculations are computed exclusively on the backend server.
          </p>
        </div>
      </div>

      {/* Success Modal / Banner */}
      {successTxn && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Transaction Confirmed</span>
              <h3 className="text-xl font-mono font-bold text-slate-900">{successTxn.transaction_number}</h3>
              <p className="text-xs text-slate-600 mt-1">
                Processed ₹ {successTxn.inr_amount.toLocaleString()} for {selectedCustomer?.name} •{" "}
                <span className="font-semibold text-slate-900">{successTxn.aed_amount.toFixed(2)} AED Billed</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSuccessTxn(null);
                setInrAmount("");
                setNotes("");
              }}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm"
            >
              + Create Another
            </button>
            <button
              onClick={() => router.push(`/customers/${customerId}`)}
              className="px-4 py-2 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50"
            >
              View Customer Ledger
            </button>
          </div>
        </div>
      )}

      {/* Two Column Layout: Entry Form on Left, Live Authoritative Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Date & Customer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Transaction Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Customer</span>
                {selectedCustomer && (
                  <span className="text-[11px] text-slate-400 font-normal">
                    Bal: {selectedCustomer.outstanding_balance?.toFixed(2)} AED
                  </span>
                )}
              </label>
              <select
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bank Order INR Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Bank Order Amount (INR Needed in India)
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

          {/* Rates Section: Dual Format Customer Rate & Base Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
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
                className="w-full text-sm font-semibold border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Equiv: {preview ? `${preview.customerRateInrPerAed} INR/AED` : "..."}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Base Cost Rate (My Rate)</span>
                <span className="text-[10px] text-slate-500 font-medium">INR / AED</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="26.82"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                className="w-full text-sm font-semibold border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Equiv: {preview ? `${preview.baseRateAedPer1000} AED/1000` : "..."}
              </p>
            </div>
          </div>

          {/* Delivery Charge % and Optional Distributor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Delivery Charge Cut (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={deliveryPct}
                  onChange={(e) => setDeliveryPct(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3.5 top-2 text-slate-400 text-xs font-semibold">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                India Distribution Route (Optional)
              </label>
              <select
                value={distributorId}
                onChange={(e) => setDistributorId(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Direct / Unassigned --</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Internal Notes / Remittance Reference
            </label>
            <input
              type="text"
              placeholder="e.g. Beneficiary IFSC / Branch instructions"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving || !preview}
            className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm ${
              saving || !preview
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Authorizing & Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Record Transaction</span>
              </>
            )}
          </button>
        </form>

        {/* Live Authoritative Server Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm border border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-sm text-slate-200">Live Calculation Preview</h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                Server-Authoritative
              </span>
            </div>

            {calculating ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Evaluating financial formulas...</span>
              </div>
            ) : preview ? (
              <div className="space-y-4">
                {/* Warning box if suspicious rate */}
                {preview.warning && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{preview.warning}</span>
                  </div>
                )}

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Customer</span>
                    <span className="font-semibold text-slate-200">{selectedCustomer?.name || "..."}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">INR Order</span>
                    <span className="font-semibold text-slate-200">₹ {preview.inrAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Customer Rate</span>
                    <span className="font-mono text-slate-200">{preview.customerRate} AED/1000</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800 text-sm">
                    <span className="font-bold text-emerald-400">AED Charged</span>
                    <span className="font-bold text-emerald-400">{preview.aedAmount.toFixed(2)} AED</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                    <span>Base Wholesale Cost</span>
                    <span>{preview.costAed.toFixed(2)} AED</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                    <span>Gross Margin</span>
                    <span className={preview.grossProfitAed >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {preview.grossProfitAed.toFixed(2)} AED
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                    <span>Delivery Charge ({preview.deliveryChargePct * 100}%)</span>
                    <span>- {preview.deliveryChargeAed.toFixed(2)} AED</span>
                  </div>
                  <div className="flex justify-between py-2 text-base font-bold">
                    <span className="text-white">Net Business Profit</span>
                    <span className={preview.netProfitAed >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {preview.netProfitAed.toFixed(2)} AED
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Enter an amount and rate to preview real-time calculations.
              </div>
            )}
          </div>

          {/* Quick info note */}
          <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Accounting Integrity Rule</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              When confirmed, this transaction automatically updates the customer's balance ledger and becomes part of the permanent immutable audit registry.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
