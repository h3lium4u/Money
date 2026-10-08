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
  ArrowRight,
  Receipt,
  X,
  CreditCard,
  Building2,
  Users,
} from "lucide-react";
import { numberToIndianWords } from "@/lib/number-to-words";
import { getTodayDateString } from "@/lib/date-utils";
import Breadcrumbs from "@/components/Breadcrumbs";
import { toast } from "sonner";

interface ClientOption {
  id: string;
  code: string;
  name: string;
  default_rate?: number;
  outstanding_balance?: number;
  party_type?: string;
}

interface DubaiCalculationPreview {
  total: number;
  manualRate: number;
  wholesaleRate: number;
  inDhirams: number;
  paidAmount: number;
  balanceToPaid: number;
  warning?: string | null;
}

export default function NewDubaiClientTransactionPage() {
  const router = useRouter();

  // Inputs
  const [date, setDate] = useState(getTodayDateString());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [customerId, setCustomerId] = useState("");
  
  // Total entry
  const [inrAmounts, setInrAmounts] = useState<string[]>([""]);
  const [manualRate, setManualRate] = useState<string>("");
  const [paidAmounts, setPaidAmounts] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Options
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Calculation state
  const [preview, setPreview] = useState<DubaiCalculationPreview | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Client Modal State
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientCode, setNewClientCode] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientRate, setNewClientRate] = useState("");
  const [savingNewClient, setSavingNewClient] = useState(false);
  const [newClientError, setNewClientError] = useState<string | null>(null);

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

  function handlePaidAmountChange(index: number, value: string) {
    const next = [...paidAmounts];
    next[index] = value;
    setPaidAmounts(next);
  }

  function handleAddPaidAmount() {
    setPaidAmounts((prev) => [...prev, ""]);
  }

  function handleRemovePaidAmount(index: number) {
    if (paidAmounts.length <= 1) {
      setPaidAmounts([""]);
      return;
    }
    setPaidAmounts((prev) => prev.filter((_, i) => i !== index));
  }

  // Load Dubai clients and parties
  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoadingClients(true);
    try {
      const res = await fetch("/api/parties?type=DUBAI");
      const pJson = await res.json();
      const list: ClientOption[] = Array.isArray(pJson) ? pJson : [];

      setClients(list);
    } catch (err) {
      console.error(err);
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }

  function handleClientChange(cId: string) {
    setCustomerId(cId);
    const selected = clients.find((c) => c.id === cId);
    if (selected?.default_rate && !manualRate) {
      setManualRate(String(selected.default_rate));
    }
  }

  async function handleCreateNewClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim()) {
      setNewClientError("Client name is required");
      return;
    }

    setSavingNewClient(true);
    setNewClientError(null);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientName.trim(),
          code: newClientCode.trim() || undefined,
          phone: newClientPhone.trim() || undefined,
          default_rate: newClientRate ? parseFloat(newClientRate) : 38.25,
          party_type: "DUBAI",
        }),
      });

      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "Failed to create client");

      // Add to list and immediately select
      setClients((prev) => [created, ...prev]);
      setCustomerId(created.id);
      if (created.default_rate) {
        setManualRate(String(created.default_rate));
      }

      setShowNewClientModal(false);
      setNewClientName("");
      setNewClientCode("");
      setNewClientPhone("");
      setNewClientRate("");
      toast.success("Dubai Client created successfully");
    } catch (err: any) {
      setNewClientError(err.message || "Failed to create client");
      toast.error(err.message || "Failed to create client");
    } finally {
      setSavingNewClient(false);
    }
  }

  // Calculate total order INR with exact 2-decimal rounding
  const validAmounts = inrAmounts
    .map((val) => parseFloat(val))
    .filter((num) => !isNaN(num) && num > 0);
  const totalOrderInr = Math.round((validAmounts.reduce((sum, num) => sum + num, 0) + Number.EPSILON) * 100) / 100;

  // Calculate total paid AED from multiple fields
  const validPaidAmounts = paidAmounts
    .map((val) => parseFloat(val))
    .filter((num) => !isNaN(num) && num > 0);
  const totalPaidAed = Math.round((validPaidAmounts.reduce((sum, num) => sum + num, 0) + Number.EPSILON) * 100) / 100;

  // Live Server Backend Calculation
  useEffect(() => {
    const total = totalOrderInr;
    const mRate = parseFloat(manualRate);

    if (!total || total <= 0 || !mRate || mRate <= 0) {
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
            manualRate: mRate,
            paidAmount: totalPaidAed,
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
  }, [inrAmounts, manualRate, paidAmounts, totalOrderInr, totalPaidAed]);

  // Form submit handler - open confirmation
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError("Please select a Dubai client or create a new one");
      return;
    }

    const total = totalOrderInr;
    const mRate = parseFloat(manualRate);

    if (!total || total <= 0) {
      setError("Please enter a valid Total Order Amount");
      return;
    }
    if (!mRate || mRate <= 0) {
      setError("Please enter a valid Exchange Rate value");
      return;
    }

    setError(null);
    setShowConfirmModal(true);
  }

  // Final authoritative save
  async function handleFinalSave() {
    setSaving(true);
    setError(null);

    const total = totalOrderInr;
    const mRate = parseFloat(manualRate);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: date,
          customer_id: customerId,
          total,
          manual_rate: mRate,
          paid_amount: totalPaidAed,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create transfer");

      setShowConfirmModal(false);
      toast.success("Dubai Client transfer recorded successfully");
      router.push("/transactions");
    } catch (err: any) {
      setError(err.message || "Failed to record transaction");
      toast.error(err.message || "Failed to record transaction");
      setShowConfirmModal(false);
    } finally {
      setSaving(false);
    }
  }

  const selectedClient = clients.find((c) => c.id === customerId);
  const inrWords = totalOrderInr > 0 ? numberToIndianWords(totalOrderInr) : null;


  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Dubai Client", href: "/transactions" },
          { label: "New Transfer" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
            <Coins className="w-6 h-6 text-teal-700 dark:text-teal-400" />
            <span>New Dubai Client Transfer</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authoritative Dubai retail and wholesale settlement calculation. All operations run server-side.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewClientModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-bold rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors shadow-2xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ New Dubai Client</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Responsive Grid: Form on Left (7 cols), Calculation Preview on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Input Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Date & Dubai Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Choose Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                <span>Choose Date</span>
              </label>
              <div className="relative flex items-center">
                <input
                  ref={dateInputRef}
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-10 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={openDatePicker}
                  className="absolute right-2 p-1.5 text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 rounded-md transition-colors cursor-pointer"
                  title="Choose Date"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Choose Dubai Client */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>Choose Dubai Client</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(true)}
                  className="text-[11px] font-bold text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  + Add Client
                </button>
              </div>
              <select
                required
                value={customerId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="">-- Choose Dubai Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>
              {selectedClient && selectedClient.outstanding_balance !== undefined && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-1">
                  Outstanding Balance: AED {Number(selectedClient.outstanding_balance).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Total Order Amount (INR) Entry */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Total Order Amount (INR)
              </label>
              <button
                type="button"
                onClick={handleAddAmount}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 dark:text-teal-300 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 px-2.5 py-1 rounded border border-teal-200 dark:border-teal-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Split INR Line</span>
              </button>
            </div>

            <div className="space-y-2">
              {inrAmounts.map((amount, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 dark:text-slate-500 font-bold text-xs select-none">
                      <span className="font-mono">₹</span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      placeholder="Enter Total INR Amount (e.g. 500000)"
                      value={amount}
                      onChange={(e) => handleAmountChange(idx, e.target.value)}
                      className="w-full text-sm font-bold pl-8 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                    />
                  </div>
                  {inrAmounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAmount(idx)}
                      className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
                      title="Remove line"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {totalOrderInr > 0 && (
              <div className="p-3 bg-teal-50/90 dark:bg-teal-950/40 border border-teal-200/90 dark:border-teal-800 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wider">
                    Total Order:
                  </span>
                  <span className="text-base font-extrabold text-teal-800 dark:text-teal-300 font-mono">
                    ₹ {totalOrderInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {inrWords && (
                  <div className="text-xs text-teal-800 dark:text-teal-300 font-semibold border-t border-teal-200/50 dark:border-teal-800/50 pt-1">
                    <span className="uppercase text-[10px] font-bold tracking-wider mr-1 text-teal-600 dark:text-teal-400">In Words:</span>
                    {inrWords}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Client Exchange Rate & Paid Amount (Multi-field) */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Client Exchange Rate */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Client Exchange Rate (Rate per 1000)</span>
                <span className="text-[10px] text-teal-700 dark:text-teal-400 font-bold">AED / 1000 INR</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 38.25"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
                className="w-full text-sm font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Wholesale rate is computed as <strong>1000 / Exchange Rate</strong>.
              </p>
            </div>

            {/* Paid Amount (AED) - Multi-field additive */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Paid Amount (AED)
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Add multiple payment entries if paid in installments; all entries are summed automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPaidAmount}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Add Paid Amount Field</span>
                </button>
              </div>

              <div className="space-y-2">
                {paidAmounts.map((amt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400 dark:text-slate-500 font-bold text-xs select-none">
                        <span>AED</span>
                      </div>
                      <input
                        type="number"
                        step="any"
                        placeholder={idx === 0 ? "Enter paid amount in AED (e.g. 5000)" : "Additional paid amount (AED)"}
                        value={amt}
                        onChange={(e) => handlePaidAmountChange(idx, e.target.value)}
                        className="w-full text-sm font-bold pl-12 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs font-mono"
                      />
                    </div>
                    {paidAmounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePaidAmount(idx)}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
                        title="Remove paid amount line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {totalPaidAed > 0 && (
                <div className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
                    Total Paid Sum ({validPaidAmounts.length} {validPaidAmounts.length === 1 ? "entry" : "entries"}):
                  </span>
                  <span className="font-mono font-extrabold text-emerald-800 dark:text-emerald-300 text-sm">
                    AED {totalPaidAed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Reference, settlement remarks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => router.push("/transactions")}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !preview}
              className="px-6 py-2.5 text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Proceed & Confirm Transfer</span>
            </button>
          </div>
        </form>

        {/* Right Column (5 cols): Calculation Preview & Dubai Rules Guide */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
          {/* Live Backend Calculation Preview Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-teal-200 dark:border-teal-800/70 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200">
                  Backend Calculation Preview
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                Authoritative Server Output
              </span>
            </div>

            {preview ? (
              <div className="space-y-4">
                {/* Prominent IN DHIRAMS Hero Card */}
                <div className="p-4 bg-teal-50/90 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 block">
                    In Dhirams (AED Amount)
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-teal-900 dark:text-teal-100 font-mono tracking-tight">
                    {preview.inDhirams.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                  </p>
                  <span className="text-[11px] text-teal-700 dark:text-teal-300 block font-mono">
                    = Total (₹{preview.total.toLocaleString("en-IN")}) / Whole Sale Rate ({preview.wholesaleRate.toFixed(4)})
                  </span>
                </div>

                {/* Metric Breakdown Rows */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">Whole Sale Rate</span>
                      <span className="text-[10px] text-slate-400 font-mono">= 1000 / {manualRate || preview.manualRate}</span>
                    </div>
                    <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                      {preview.wholesaleRate.toFixed(4)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">Total Order (INR)</span>
                      <span className="text-[10px] text-slate-400">Manual Entry</span>
                    </div>
                    <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                      ₹ {preview.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">Paid Amount (AED)</span>
                      <span className="text-[10px] text-slate-400">Manual Entry</span>
                    </div>
                    <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                      AED {preview.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Balance to Paid Highlight Box */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    preview.balanceToPaid > 0
                      ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                      : "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                  }`}>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block">Balance to Paid</span>
                      <span className="text-[10px] opacity-80 font-mono block">= In Dhirams - Paid amount</span>
                    </div>
                    <span className="font-mono font-black text-base sm:text-lg">
                      AED {preview.balanceToPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            ) : calculating ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin text-teal-700" />
                <span>Computing authoritative server values...</span>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <Coins className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-600 dark:text-slate-300">No Calculation Yet</p>
                <p className="text-[11px] text-slate-400">
                  Enter Total INR and Manual Rate value to see the authoritative wholesale and Dhirams calculation live.
                </p>
              </div>
            )}
          </div>

          {/* Dubai Client Calculation Rules Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              <span>Dubai Client Calculation Rules</span>
            </h4>
            <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-1.5">
                <span className="text-teal-700 font-bold">•</span>
                <span><strong>Wholesale Rate</strong> = 1000 / Client Exchange Rate (e.g. 1000 / 38.25 = 26.1438)</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-teal-700 font-bold">•</span>
                <span><strong>In Dhirams (AED)</strong> = Total Order Amount (INR) / Wholesale Rate</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-teal-700 font-bold">•</span>
                <span><strong>Balance to Paid (Due Payment)</strong> = In Dhirams - Paid Amount (AED)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-teal-800 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base tracking-tight">Confirm Dubai Client Transfer</h3>
                  <p className="text-xs text-teal-100">Please review before saving to database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{date}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dubai Client</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedClient?.name} {selectedClient?.code ? `(${selectedClient.code})` : ""}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200/80 dark:border-slate-700">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-600 dark:text-slate-400">Total Order Amount (INR):</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    ₹ {totalOrderInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Client Exchange Rate:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{manualRate} AED/1000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Wholesale Rate (1000 / Rate):</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-400">{preview?.wholesaleRate.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-teal-900 dark:text-teal-200">In Dhirams (AED):</span>
                  <span className="font-mono text-teal-800 dark:text-teal-300">
                    AED {preview?.inDhirams.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block">Paid Amount (AED):</span>
                    {validPaidAmounts.length > 1 && (
                      <span className="text-[10px] text-slate-400 block font-mono">
                        Sum of {validPaidAmounts.length} fields: {validPaidAmounts.map(a => Number(a).toFixed(2)).join(" + ")}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    AED {(preview?.paidAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center font-bold text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-800 dark:text-slate-200">Balance to Paid (Due Payment):</span>
                  <span className={`font-mono ${
                    (preview?.balanceToPaid || 0) > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                  }`}>
                    AED {(preview?.balanceToPaid || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {notes && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                  <span className="font-bold text-[10px] text-slate-400 uppercase block mb-0.5">Notes</span>
                  <p>{notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Back & Edit
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
                    <span>Saving...</span>
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

      {/* Quick New Dubai Client Modal */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>Create New Dubai Client</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewClientModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewClient} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AL-SARA REMITTANCE"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Client Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SARA-DXB"
                    value={newClientCode}
                    onChange={(e) => setNewClientCode(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Default Rate
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 38.25"
                    value={newClientRate}
                    onChange={(e) => setNewClientRate(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+971 50 123 4567"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {newClientError && (
                <p className="text-rose-600 text-[11px] font-medium">{newClientError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNewClient}
                  className="px-4 py-2 text-xs font-bold bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg shadow-sm disabled:opacity-50"
                >
                  {savingNewClient ? "Creating..." : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
