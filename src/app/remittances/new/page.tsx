"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Coins,
  RefreshCw,
  PlusCircle,
  Trash2,
  UserPlus,
  Calendar,
  ShieldCheck,
  X,
  CreditCard,
  Users,
} from "lucide-react";
import { numberToIndianWords } from "@/lib/number-to-words";
import { getTodayDateString } from "@/lib/date-utils";
import Breadcrumbs from "@/components/Breadcrumbs";
import { toast } from "sonner";

interface CustomerOption {
  id: string;
  code: string;
  name: string;
  default_rate?: number;
  outstanding_balance?: number;
}

export default function NewCustomerRemittancePage() {
  const router = useRouter();

  const [date, setDate] = useState(getTodayDateString());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [customerId, setCustomerId] = useState("");
  
  const [inrAmounts, setInrAmounts] = useState<string[]>([""]);
  const [customerRate, setCustomerRate] = useState<string>("");
  const [baseRate, setBaseRate] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  const [preview, setPreview] = useState<any | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Customer Modal
  const [showNewCustModal, setShowNewCustModal] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustCode, setNewCustCode] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustRate, setNewCustRate] = useState("38.25");
  const [savingNewCust, setSavingNewCust] = useState(false);
  const [newCustError, setNewCustError] = useState<string | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoadingCustomers(true);
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setCustomers(list);
      if (list.length > 0 && !customerId) {
        setCustomerId(list[0].id);
        if (list[0].default_rate) {
          setCustomerRate(String(list[0].default_rate));
        }
      }
    } catch (err) {
      console.error(err);
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  }

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

  async function handleCreateNewCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustName.trim()) {
      setNewCustError("Customer name is required");
      return;
    }

    setSavingNewCust(true);
    setNewCustError(null);
    try {
      const res = await fetch("/api/customers", {
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
      if (!res.ok) throw new Error(created.error || "Failed to create customer");

      setCustomers((prev) => [created, ...prev]);
      setCustomerId(created.id);
      if (created.default_rate) {
        setCustomerRate(String(created.default_rate));
      }

      setShowNewCustModal(false);
      setNewCustName("");
      setNewCustCode("");
      setNewCustPhone("");
      setNewCustRate("38.25");
      toast.success("Retail customer created successfully");
    } catch (err: any) {
      setNewCustError(err.message || "Failed to create customer");
      toast.error(err.message || "Failed to create customer");
    } finally {
      setSavingNewCust(false);
    }
  }

  const validAmounts = inrAmounts
    .map((val) => parseFloat(val))
    .filter((num) => !isNaN(num) && num > 0);
  const totalOrderInr = validAmounts.reduce((sum, num) => sum + num, 0);

  // Live calculation
  useEffect(() => {
    const total = totalOrderInr;
    const cRate = parseFloat(customerRate);
    const pAmt = paidAmount ? parseFloat(paidAmount) : 0;

    if (!total || total <= 0 || !cRate || cRate <= 0) {
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
            total,
            manualRate: cRate,
            paidAmount: isNaN(pAmt) ? 0 : pAmt,
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
  }, [inrAmounts, customerRate, paidAmount, totalOrderInr]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError("Please select a retail customer");
      return;
    }
    if (!totalOrderInr || totalOrderInr <= 0) {
      setError("Please enter a valid order amount");
      return;
    }
    if (!customerRate || parseFloat(customerRate) <= 0) {
      setError("Please enter a valid rate");
      return;
    }

    setError(null);
    setShowConfirmModal(true);
  }

  async function handleFinalSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: date,
          customer_id: customerId,
          total: totalOrderInr,
          manual_rate: parseFloat(customerRate),
          paid_amount: paidAmount ? parseFloat(paidAmount) : 0,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create remittance");

      setShowConfirmModal(false);
      toast.success("Customer remittance saved successfully");
      router.push("/remittances");
    } catch (err: any) {
      setError(err.message || "Failed to create remittance");
      toast.error(err.message || "Failed to create remittance");
      setShowConfirmModal(false);
    } finally {
      setSaving(false);
    }
  }

  const selectedCust = customers.find((c) => c.id === customerId);
  const inrWords = totalOrderInr > 0 ? numberToIndianWords(totalOrderInr) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Customer Remittances", href: "/remittances" },
          { label: "New Remittance" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-700" />
            <span>New Customer Remittance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Record retail customer remittance transfer (strictly separated from parties).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewCustModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold rounded-lg hover:bg-teal-100 transition shadow-2xs"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ New Retail Customer</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-700" />
                <span>Date</span>
              </label>
              <input
                ref={dateInputRef}
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-700" />
                  <span>Retail Customer</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(true)}
                  className="text-[11px] font-bold text-teal-700 hover:underline"
                >
                  + Add Customer
                </button>
              </div>
              <select
                required
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  const selected = customers.find((c) => c.id === e.target.value);
                  if (selected?.default_rate) setCustomerRate(String(selected.default_rate));
                }}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900"
              >
                <option value="">-- Choose Retail Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                INR Order Amount
              </label>
              <button
                type="button"
                onClick={handleAddAmount}
                className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded border border-teal-200"
              >
                + Add Line
              </button>
            </div>

            <div className="space-y-2">
              {inrAmounts.map((amt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 50000"
                      value={amt}
                      onChange={(e) => handleAmountChange(idx, e.target.value)}
                      className="w-full text-sm font-bold pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  {inrAmounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAmount(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {totalOrderInr > 0 && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-teal-900">Total Order:</span>
                  <span className="text-base font-extrabold text-teal-800 font-mono">
                    ₹ {totalOrderInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {inrWords && (
                  <p className="text-xs text-teal-800 font-semibold pt-1 border-t border-teal-200/50">
                    In Words: {inrWords}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Exchange Rate (AED / 1000 INR)
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 38.25"
                value={customerRate}
                onChange={(e) => setCustomerRate(e.target.value)}
                className="w-full text-sm font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Paid Amount (AED)
              </label>
              <input
                type="number"
                step="any"
                placeholder="0 if unpaid"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full text-sm font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Reference, branch transfer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900"
            />
          </div>
        </div>

        {preview && (
          <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-4 space-y-2">
            <h3 className="text-xs font-bold text-teal-900 uppercase tracking-wider">
              Calculated Financial Projection
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">AED Charged</span>
                <span className="text-sm font-black text-slate-900 font-mono">
                  AED {preview.inDhirams.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Paid Amount</span>
                <span className="text-sm font-black text-emerald-700 font-mono">
                  AED {preview.paidAmount.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Pending Due</span>
                <span className="text-sm font-black text-amber-700 font-mono">
                  AED {preview.balanceToPaid.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/remittances")}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !preview}
            className="px-6 py-2.5 text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm & Save Remittance</span>
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-700" />
              <span>Confirm Retail Customer Remittance</span>
            </h3>

            <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Customer:</span>
                <span className="font-bold text-slate-900">{selectedCust?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Order:</span>
                <span className="font-mono font-bold text-slate-900">₹ {totalOrderInr.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Rate:</span>
                <span className="font-mono font-bold text-slate-900">{customerRate} AED/1000</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-200 text-teal-800">
                <span>AED Charged:</span>
                <span className="font-mono">AED {preview?.inDhirams.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Paid:</span>
                <span className="font-mono">AED {(preview?.paidAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-amber-800">
                <span>Due:</span>
                <span className="font-mono">AED {(preview?.balanceToPaid || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Back & Edit
              </button>
              <button
                type="button"
                onClick={handleFinalSave}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg shadow-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showNewCustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-700" />
                <span>Create Retail Customer</span>
              </h3>
              <button onClick={() => setShowNewCustModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Code</label>
                  <input
                    type="text"
                    placeholder="e.g. RAM-101"
                    value={newCustCode}
                    onChange={(e) => setNewCustCode(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Default Rate</label>
                  <input
                    type="number"
                    step="any"
                    value={newCustRate}
                    onChange={(e) => setNewCustRate(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="+971 50 123 4567"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900"
                />
              </div>

              {newCustError && <p className="text-xs text-rose-600">{newCustError}</p>}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNewCust}
                  className="px-4 py-2 text-xs font-bold bg-[#0F766E] text-white rounded-lg disabled:opacity-50"
                >
                  {savingNewCust ? "Creating..." : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
