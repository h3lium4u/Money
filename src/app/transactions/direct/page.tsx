"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  Trash2,
  UserPlus,
  Calendar,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { numberToIndianWords } from "@/lib/number-to-words";
import { getTodayDateString } from "@/lib/date-utils";

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
  aedAmount: number;
  baseRate: number;
  costAed: number;
  grossProfitAed: number;
  deliveryChargePct: number;
  deliveryChargeAed: number;
  netProfitAed: number;
  warning?: string | null;
}

const DEFAULT_PARTY_NAMES = ["AWAFI", "BASID", "HAJA", "NF2", "SARABU"];

export default function DirectTransferPage() {
  const router = useRouter();

  // Inputs
  const [date, setDate] = useState(getTodayDateString());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [customerId, setCustomerId] = useState("");
  const [inrAmounts, setInrAmounts] = useState<string[]>(["", "", ""]);
  const [customerRate, setCustomerRate] = useState<string>("");
  const [baseRate, setBaseRate] = useState<string>("");

  // Customers
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  // Calculation state
  const [preview, setPreview] = useState<CalculationPreview | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTxn, setSuccessTxn] = useState<any | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // New Customer Modal State
  const [showNewCustModal, setShowNewCustModal] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustCode, setNewCustCode] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustRate, setNewCustRate] = useState("38.25");
  const [savingNewCust, setSavingNewCust] = useState(false);
  const [newCustError, setNewCustError] = useState<string | null>(null);

  // Load allowed parties on mount
  useEffect(() => {
    loadParties();
  }, []);

  async function loadParties() {
    try {
      const res = await fetch("/api/parties");
      const allParties: CustomerOption[] = await res.json();
      if (!Array.isArray(allParties)) {
        setCustomers([]);
        return;
      }

      // Sort with the 5 default parties first in order, then extra ones
      allParties.sort((a, b) => {
        const aIndex = DEFAULT_PARTY_NAMES.indexOf(a.name?.toUpperCase()?.trim());
        const bIndex = DEFAULT_PARTY_NAMES.indexOf(b.name?.toUpperCase()?.trim());
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.name.localeCompare(b.name);
      });

      setCustomers(allParties);
    } catch (err) {
      console.error("Failed to load parties:", err);
      setCustomers([]);
    }
  }

  function handleCustomerChange(cId: string) {
    setCustomerId(cId);
    const selected = customers.find((c) => c.id === cId);
    if (selected?.default_rate) {
      setCustomerRate(String(selected.default_rate));
    }
  }

  const openDatePicker = () => {
    if (dateInputRef.current) {
      try {
        if (typeof dateInputRef.current.showPicker === "function") {
          dateInputRef.current.showPicker();
        } else {
          dateInputRef.current.focus();
        }
      } catch {
        dateInputRef.current.focus();
      }
    }
  };

  function handleAmountChange(index: number, value: string) {
    const next = [...inrAmounts];
    next[index] = value;
    setInrAmounts(next);
  }

  function handleAddAmount() {
    setInrAmounts((prev) => [...prev, ""]);
  }

  function handleRemoveAmount(index: number) {
    if (inrAmounts.length <= 1) {
      setInrAmounts([""]);
      return;
    }
    setInrAmounts((prev) => prev.filter((_, i) => i !== index));
  }

  // Only non-empty, positive amounts are evaluated
  const validAmounts = inrAmounts
    .map((val) => parseFloat(val))
    .filter((num) => !isNaN(num) && num > 0);
  const totalOrderInr = validAmounts.reduce((sum, num) => sum + num, 0);

  // Live Server Calculation with deliveryChargePct = 0 (No delivery fee)
  useEffect(() => {
    const inr = totalOrderInr;
    const cRate = parseFloat(customerRate);
    const bRate = parseFloat(baseRate);

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
            deliveryChargePct: 0, // No delivery charge
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
  }, [inrAmounts, customerRate, baseRate, totalOrderInr]);

  async function handleCreateNewCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustName.trim()) {
      setNewCustError("Customer name is required");
      return;
    }

    setSavingNewCust(true);
    setNewCustError(null);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustName.trim(),
          code: newCustCode.trim() || undefined,
          phone: newCustPhone.trim() || undefined,
          default_rate: newCustRate ? parseFloat(newCustRate) : 38.25,
        }),
      });

      const created = await res.json();
      if (!res.ok) throw new Error(created.error);

      setCustomers((prev) => [...prev, created]);
      setCustomerId(created.id);
      if (created.default_rate) {
        setCustomerRate(String(created.default_rate));
      }

      setShowNewCustModal(false);
      setNewCustName("");
      setNewCustCode("");
      setNewCustPhone("");
      setNewCustRate("38.25");
    } catch (err: any) {
      setNewCustError(err.message || "Failed to create party");
    } finally {
      setSavingNewCust(false);
    }
  }

  // Pre-save validation: Prompt confirmation modal
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError("Please select a customer or click '+ New Customer' to add one");
      return;
    }

    const inr = totalOrderInr;
    const cRate = parseFloat(customerRate);
    const bRate = parseFloat(baseRate);

    if (!inr || inr <= 0) {
      setError("Please enter at least one valid INR order amount");
      return;
    }
    if (!cRate || cRate <= 0) {
      setError("Please enter a valid customer rate");
      return;
    }
    if (!bRate || bRate <= 0) {
      setError("Please enter a valid base rate");
      return;
    }

    setError(null);
    setShowConfirmModal(true);
  }

  // Final database submission after confirmation
  async function handleFinalSave() {
    const inr = totalOrderInr;
    const cRate = parseFloat(customerRate);
    const bRate = parseFloat(baseRate);

    setSaving(true);
    setError(null);
    try {
      // Record breakdown of entered amounts only (empty fields are omitted from notes & Excel)
      const breakdownText =
        validAmounts.length > 1
          ? `Breakdown: ${validAmounts
              .map((a) => "₹" + a.toLocaleString("en-IN"))
              .join(" + ")}`
          : undefined;

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: date,
          customer_id: customerId,
          inr_amount: inr,
          customer_rate: cRate,
          base_rate: bRate,
          delivery_charge_pct: 0, // No delivery charge
          notes: breakdownText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessTxn(data);
      setShowConfirmModal(false);
      setInrAmounts(["", "", ""]);
    } catch (err: any) {
      setError(err.message || "Failed to save transfer");
      setShowConfirmModal(false);
    } finally {
      setSaving(false);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const inrWords = totalOrderInr > 0 ? numberToIndianWords(totalOrderInr) : "";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Direct Transfer (Wholesale / Party)
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              0% Delivery Fee
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Streamlined transfer for primary parties (AWAFI, BASID, HAJA, NF2, SARABU). No delivery cuts, no distribution split.
          </p>
        </div>
      </div>

      {/* Success Banner */}
      {successTxn && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Direct Transfer Saved Successfully
              </span>
              <h3 className="text-base font-mono font-bold text-slate-900 dark:text-slate-100">
                {successTxn.transaction_number}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                ₹ {successTxn.inr_amount.toLocaleString()} for {selectedCustomer?.name} •{" "}
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {successTxn.aed_amount.toFixed(2)} AED
                </span>{" "}
                •{" "}
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  Net Profit: {successTxn.net_profit_aed.toFixed(2)} AED
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSuccessTxn(null);
                setInrAmounts(["", "", ""]);
                setDate(getTodayDateString());
              }}
              className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm cursor-pointer"
            >
              + Another Transfer
            </button>
            <button
              onClick={() => router.push(`/parties/${customerId}`)}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              Party Statement
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Form & Calculation Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
        >
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section: Customer & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Date
                </label>
                <span className="text-[10px] text-slate-400 font-mono font-semibold">DD-MM-YYYY</span>
              </div>
              <div className="relative">
                <input
                  ref={dateInputRef}
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 pr-10 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={openDatePicker}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 p-1 cursor-pointer transition-colors"
                  title="Choose from calendar"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Party
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(true)}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ New Party</span>
                </button>
              </div>

              <select
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">
                  {customers.length === 0 ? "Select Party" : `Select Party (${customers.length} available)`}
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>

              {selectedCustomer && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-1">
                  Balance Due: {(selectedCustomer.outstanding_balance || 0).toFixed(2)} AED
                </div>
              )}
            </div>
          </div>

          {/* Section: INR Order Amounts (3 Default Fields) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  INR Order Amount
                </label>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono font-semibold">
                  {validAmounts.length} of {inrAmounts.length} entered
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddAmount}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 dark:text-teal-300 hover:dark:text-teal-200 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/50 px-2.5 py-1 rounded border border-teal-200 dark:border-teal-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Add Amount</span>
              </button>
            </div>

            <div className="space-y-2">
              {inrAmounts.map((amount, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 dark:text-slate-500 font-bold text-xs select-none">
                      <span className="font-mono">#{idx + 1}</span>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <span className="text-slate-500 dark:text-slate-400 font-bold text-sm">₹</span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      placeholder={idx === 0 ? "e.g. 500000" : idx === 1 ? "e.g. 300000" : "e.g. 200000"}
                      value={amount}
                      onChange={(e) => handleAmountChange(idx, e.target.value)}
                      className="w-full text-sm font-bold pl-16 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                    />
                  </div>
                  {inrAmounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAmount(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800 transition-colors cursor-pointer shrink-0"
                      title="Delete this amount field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Total and Words Summary */}
            {totalOrderInr > 0 ? (
              <div className="mt-2 p-3 bg-teal-50/90 dark:bg-teal-950/40 border border-teal-200/90 dark:border-teal-800 rounded-lg space-y-1.5 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wider">
                    Total Order INR:
                  </span>
                  <span className="text-base font-extrabold text-teal-800 dark:text-teal-300 font-mono">
                    ₹ {totalOrderInr.toLocaleString("en-IN")}
                  </span>
                </div>
                {inrWords && (
                  <div className="flex items-center gap-2 text-xs text-teal-900 dark:text-teal-200 border-t border-teal-200/50 dark:border-teal-800/50 pt-1.5">
                    <span className="font-bold text-[10px] tracking-wider uppercase bg-teal-200 dark:bg-teal-800 text-teal-950 dark:text-teal-100 px-1.5 py-0.5 rounded font-mono shrink-0">
                      In Words:
                    </span>
                    <span className="font-semibold">{inrWords}</span>
                  </div>
                )}
                <div className="text-[10px] text-teal-700 dark:text-teal-400 italic">
                  * Empty fields are automatically excluded from calculations and Excel reports.
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 dark:text-slate-500 italic px-1">
                Enter at least one amount. 3 fields provided by default; empty fields are not included in Excel.
              </div>
            )}
          </div>

          {/* Section: Rates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Daily Rate (Customer)</span>
                <span className="text-[10px] text-teal-700 dark:text-teal-400 font-bold">AED / 1000 INR</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 38.25"
                value={customerRate}
                onChange={(e) => setCustomerRate(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>My Rate (Base Cost)</span>
                <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold">INR / 1 AED</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 26.20"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Notice: No Delivery Fee & No Splits */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <Zap className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>
              <strong>Direct Transfer Mode:</strong> Delivery fee is set to 0%. Net profit equals gross margin. Transfer notes and distribution splits are excluded.
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving || calculating}
            className="w-full py-3 bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            Review & Confirm Transfer
          </button>
        </form>

        {/* Right Column: Authoritative Server Calculations Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Direct Transfer Calculations
              </span>
              {calculating && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
            </div>

            {preview ? (
              <div className="space-y-4">
                {/* AED Charged */}
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                    AED Amount Charged to Customer
                  </span>
                  <div className="text-3xl font-mono font-bold text-slate-900 dark:text-white mt-1">
                    {preview.aedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} AED
                  </div>
                  <span className="text-[10px] text-teal-700 dark:text-emerald-400 font-mono">
                    = (₹{preview.inrAmount.toLocaleString()} / 1000) × {preview.customerRate.toFixed(4)}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Wholesale Cost (AED):</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {preview.costAed.toFixed(2)} AED
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Gross Margin:</span>
                    <span className="font-mono font-bold text-teal-700 dark:text-emerald-400">
                      +{preview.grossProfitAed.toFixed(2)} AED
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Delivery Fee (0%):</span>
                    <span className="font-mono font-bold text-slate-400">
                      0.00 AED
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-900/60 mt-3">
                    <span className="font-bold text-teal-900 dark:text-teal-200">Net Business Profit:</span>
                    <span className="font-mono font-bold text-teal-700 dark:text-teal-300 text-lg">
                      {preview.netProfitAed.toFixed(2)} AED
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                Enter transfer amounts and rates to view authoritative calculations.
              </div>
            )}
          </div>

          {/* Quick Guidance Box */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2 shadow-sm">
            <span className="font-bold text-slate-900 dark:text-slate-100 block">Registered Parties</span>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Default registered parties: <strong>AWAFI, BASID, HAJA, NF2, SARABU</strong>. You can click <strong className="text-teal-700 dark:text-teal-400">"+ New Party"</strong> to add any additional party anytime.
            </p>
          </div>
        </div>
      </div>

      {/* QUICK INLINE NEW PARTY MODAL */}
      {showNewCustModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-600" />
                <span>Add New Party</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCustModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {newCustError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{newCustError}</span>
              </div>
            )}

            <form onSubmit={handleCreateNewCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Party Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWAFI or NEW PARTY"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
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
                    placeholder="e.g. PARTY-01"
                    value={newCustCode}
                    onChange={(e) => setNewCustCode(e.target.value)}
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
                    value={newCustRate}
                    onChange={(e) => setNewCustRate(e.target.value)}
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
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNewCust}
                  className="px-4 py-2 bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg text-xs font-bold disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {savingNewCust ? "Saving..." : "Create & Select"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRE-SAVE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-150 my-8">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-800 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-6 h-6 text-teal-200 shrink-0" />
                <div>
                  <h3 className="text-base font-bold">Confirm Direct Transfer</h3>
                  <p className="text-[11px] text-teal-100">Review all details before saving to database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-teal-200 hover:text-white text-lg font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Customer & Date */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Party / Customer</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {selectedCustomer?.name || "-"}
                  </p>
                  {selectedCustomer?.code && (
                    <span className="text-[10px] text-teal-700 dark:text-teal-400 font-mono">
                      Code: {selectedCustomer.code}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {date}
                  </p>
                </div>
              </div>

              {/* INR Amounts breakdown */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    INR Order Amounts ({validAmounts.length} entered)
                  </span>
                  <span className="text-[10px] text-teal-700 dark:text-teal-400 font-medium">
                    Empty fields excluded
                  </span>
                </div>

                <div className="space-y-1">
                  {validAmounts.map((amt, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Amount #{idx + 1}:</span>
                      <span className="font-mono font-bold">₹ {amt.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Total INR Order:</span>
                  <span className="text-base font-extrabold text-teal-700 dark:text-teal-400 font-mono">
                    ₹ {totalOrderInr.toLocaleString("en-IN")}
                  </span>
                </div>
                {inrWords && (
                  <p className="text-[11px] text-teal-800 dark:text-teal-300 italic font-medium">
                    ({inrWords})
                  </p>
                )}
              </div>

              {/* Rates & Financial Summary */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Customer Rate</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{customerRate} AED / 1000</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Base Rate</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{baseRate}</p>
                  </div>
                </div>

                {preview && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-sm font-bold p-2 bg-teal-50 dark:bg-teal-950/60 rounded-lg border border-teal-200/70 dark:border-teal-800">
                      <span className="text-teal-900 dark:text-teal-200">Customer Pays:</span>
                      <span className="text-base font-mono text-teal-800 dark:text-teal-300">
                        {preview.aedAmount.toFixed(2)} AED
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Wholesale Cost (AED):</span>
                      <span className="font-mono font-semibold">{preview.costAed.toFixed(2)} AED</span>
                    </div>

                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Gross Margin:</span>
                      <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                        +{preview.grossProfitAed.toFixed(2)} AED
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Delivery Fee:</span>
                      <span className="font-mono font-semibold text-slate-400">
                        0.00 AED (0% cut)
                      </span>
                    </div>

                    <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                      <span>Net Business Profit:</span>
                      <span className="font-mono text-sm">{preview.netProfitAed.toFixed(2)} AED</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100/80 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Edit Details
              </button>
              <button
                type="button"
                onClick={handleFinalSave}
                disabled={saving}
                className="px-5 py-2 text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Transfer...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
