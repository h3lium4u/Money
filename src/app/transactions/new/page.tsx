"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Coins,
  RefreshCw,
  PlusCircle,
  Trash2,
  Split,
  Layers,
} from "lucide-react";

interface CustomerOption {
  id: string;
  code: string;
  name: string;
  default_rate?: number;
  outstanding_balance?: number;
}

interface DistributorOption {
  id: string;
  code: string;
  name: string;
  partner_type: string;
}

interface CalculationPreview {
  inrAmount: number;
  customerRate: number;
  aedAmount: number;
  baseRate: number;
  costAed: number;
  grossProfitAed: number;
  deliveryChargePct: number;
  deliveryChargeAed: number;
  netProfitAed: number;
  warning?: string | null;
}

interface SplitItem {
  id: string;
  distributor_id: string;
  inr_amount: string;
  notes?: string;
}

export default function NewTransactionPage() {
  const router = useRouter();

  // Inputs
  const [date, setDate] = useState("2026-09-26");
  const [customerId, setCustomerId] = useState("");
  const [inrAmount, setInrAmount] = useState<string>("1000000");
  const [customerRate, setCustomerRate] = useState<string>("38.25");
  const [baseRate, setBaseRate] = useState<string>("26.20");
  const [deliveryPct, setDeliveryPct] = useState<string>("20");
  const [notes, setNotes] = useState("");

  // Distribution Splits (Optional at order entry)
  const [splits, setSplits] = useState<SplitItem[]>([]);

  // Options
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [distributors, setDistributors] = useState<DistributorOption[]>([]);

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
        const filteredDists = (dJson || []).filter((d: any) =>
          ["INDIA_DISTRIBUTOR", "HYBRID", "BANK_ACCOUNT"].includes(d.partner_type)
        );
        setDistributors(filteredDists);
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
    }, 150);

    return () => clearTimeout(timer);
  }, [inrAmount, customerRate, baseRate, deliveryPct]);

  // Splits Calculation
  const totalOrderInr = parseFloat(inrAmount) || 0;
  const totalAllocatedInr = splits.reduce((sum, s) => sum + (parseFloat(s.inr_amount) || 0), 0);
  const remainingInr = Math.max(0, totalOrderInr - totalAllocatedInr);

  function addSplit() {
    if (distributors.length === 0) return;
    setSplits([
      ...splits,
      {
        id: Math.random().toString(),
        distributor_id: distributors[0].id,
        inr_amount: remainingInr > 0 ? String(remainingInr) : "",
        notes: "",
      },
    ]);
  }

  function updateSplit(id: string, field: keyof SplitItem, value: string) {
    setSplits(splits.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function removeSplit(id: string) {
    setSplits(splits.filter((s) => s.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError("Please select a customer");
      return;
    }

    if (totalAllocatedInr > totalOrderInr) {
      setError(`Total distributed (₹${totalAllocatedInr.toLocaleString()}) cannot exceed customer order (₹${totalOrderInr.toLocaleString()})`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payloadSplits = splits
        .filter((s) => parseFloat(s.inr_amount) > 0)
        .map((s) => ({
          distributor_id: s.distributor_id,
          inr_amount: parseFloat(s.inr_amount),
          notes: s.notes || undefined,
        }));

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
          notes: notes || undefined,
          splits: payloadSplits.length > 0 ? payloadSplits : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessTxn(data);
      setSplits([]);
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
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">New Money Transfer (Dubai ➔ India)</h2>
        <p className="text-xs text-slate-500">
          Enter only basic transfer parameters. AED amounts, gross margin, delivery cut, and net profit are calculated by the backend.
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
                <span className="font-bold text-slate-900">{successTxn.aed_amount.toFixed(2)} AED</span> •{" "}
                <span className="font-bold text-emerald-700">Profit: {successTxn.net_profit_aed.toFixed(2)} AED</span>
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
              onClick={() => router.push(`/distributors`)}
              className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50"
            >
              View India Splits
            </button>
            <button
              onClick={() => router.push(`/customers/${customerId}`)}
              className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50"
            >
              Customer Statement
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Entry Form & Authoritative Calculation Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section: Customer & Date */}
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
                <span>Dubai Customer</span>
                {selectedCustomer && (
                  <span className="text-[10px] text-slate-500 font-semibold">
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

          {/* Section: INR Order Amount */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              INR Order Amount (₹ Delivered in India)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                step="any"
                required
                placeholder="1000000"
                value={inrAmount}
                onChange={(e) => setInrAmount(e.target.value)}
                className="w-full text-base font-bold pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Section: Rates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Daily Rate (Customer)</span>
                <span className="text-[10px] text-emerald-700 font-bold">AED / 1000 INR</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="38.25"
                value={customerRate}
                onChange={(e) => setCustomerRate(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>My Rate (Base Cost)</span>
                <span className="text-[10px] text-blue-700 font-bold">INR / 1 AED</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="26.20"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Section: Delivery Cut & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Delivery Charge Cut (%)
              </label>
              <input
                type="number"
                step="any"
                placeholder="20"
                value={deliveryPct}
                onChange={(e) => setDeliveryPct(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Transfer Notes
              </label>
              <input
                type="text"
                placeholder="Reference or instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* SEPARATE SECTION: India Distribution Splits (Decoupled & Optional) */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Split className="w-3.5 h-3.5 text-emerald-600" />
                  <span>India Distribution Split (Optional)</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Split this order among India parties (MK, ISMAIL, SARABU, etc.) now or allocate later.
                </p>
              </div>

              <button
                type="button"
                onClick={addSplit}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Split Order</span>
              </button>
            </div>

            {/* Allocation Status Indicator */}
            {splits.length > 0 && (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                <span>
                  Allocated: <strong>₹{totalAllocatedInr.toLocaleString()}</strong> / ₹{totalOrderInr.toLocaleString()}
                </span>
                <span>
                  Remaining to Distribute:{" "}
                  <strong className={remainingInr === 0 ? "text-emerald-600" : "text-amber-600"}>
                    ₹{remainingInr.toLocaleString()}
                  </strong>
                </span>
              </div>
            )}

            {/* Split Rows */}
            {splits.map((s, idx) => (
              <div key={s.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Split #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeSplit(s.id)}
                    className="text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">
                      India Party
                    </label>
                    <select
                      value={s.distributor_id}
                      onChange={(e) => updateSplit(s.id, "distributor_id", e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded p-1.5 text-slate-900"
                    >
                      {distributors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.code} • {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">
                      INR Amount
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Amount"
                      value={s.inr_amount}
                      onChange={(e) => updateSplit(s.id, "inr_amount", e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded p-1.5 text-slate-900"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving || calculating}
            className="w-full py-3 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm"
          >
            {saving ? "Saving to Neon Database..." : "Confirm & Save Transfer"}
          </button>
        </form>

        {/* Right Column: Authoritative Server Calculations Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 text-slate-100 p-6 rounded-xl shadow-sm border border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Backend Calculation Preview
              </span>
              {calculating && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
            </div>

            {preview ? (
              <div className="space-y-4">
                {/* AED Charged */}
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">AED Amount Charged to Customer</span>
                  <div className="text-3xl font-mono font-bold text-white mt-1">
                    {preview.aedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} AED
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    = (₹{preview.inrAmount.toLocaleString()} / 1000) × {preview.customerRate.toFixed(4)}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Wholesale Cost (AED):</span>
                    <span className="font-mono font-bold">
                      {preview.costAed.toFixed(2)} AED
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Gross Margin:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      +{preview.grossProfitAed.toFixed(2)} AED
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Delivery Fee (20%):</span>
                    <span className="font-mono font-bold text-slate-400">
                      -{preview.deliveryChargeAed.toFixed(2)} AED
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-100 pt-2 border-t border-slate-800 text-sm">
                    <span className="font-bold text-emerald-400">Net Business Profit:</span>
                    <span className="font-mono font-bold text-emerald-400 text-base">
                      {preview.netProfitAed.toFixed(2)} AED
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                Enter transfer amounts and rates to view authoritative calculations.
              </div>
            )}
          </div>

          {/* Architecture Reminder Card */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2 shadow-sm">
            <span className="font-bold text-slate-900 block">Core Architecture Principles</span>
            <ul className="list-disc pl-4 space-y-1 text-slate-500 text-[11px]">
              <li><strong>Zero Frontend Trust</strong>: All values are verified and re-computed on the server.</li>
              <li><strong>Decoupled Accounting</strong>: Customer payments (Receivables) and India distributions (Wholesale/Splits) are managed independently.</li>
              <li><strong>Audited</strong>: Every transaction creation and void is recorded in the audit trail.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
