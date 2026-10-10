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
  Split,
  Layers,
  UserPlus,
  Calendar,
  ShieldCheck,
  Receipt,
  X,
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

interface DistributorOption {
  id: string;
  code: string;
  name: string;
  partner_type: string;
  group_type?: string;
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
  channel?: string;
  notes?: string;
  deduct_prior?: boolean;
}

export default function NewRemittancePage() {
  const router = useRouter();

  // Inputs
  const [date, setDate] = useState(getTodayDateString());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [customerId, setCustomerId] = useState("");
  const [inrAmounts, setInrAmounts] = useState<string[]>(["", "", ""]);
  const [customerRate, setCustomerRate] = useState<string>("");
  const [baseRate, setBaseRate] = useState<string>("");
  const [deliveryMode, setDeliveryMode] = useState<"AED" | "PCT">("PCT");
  const [deliveryValue, setDeliveryValue] = useState<string>("20");
  const [notes, setNotes] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
    const clean = value.replace(/,/g, "");
    if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
      const next = [...inrAmounts];
      next[index] = clean;
      setInrAmounts(next);
    }
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

  // Distribution Splits (Optional at order entry)
  const [splits, setSplits] = useState<SplitItem[]>([]);

  // Options
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [distributors, setDistributors] = useState<DistributorOption[]>([]);
  const [priorTransfersMap, setPriorTransfersMap] = useState<Record<string, any>>({});

  // Calculation state
  const [preview, setPreview] = useState<CalculationPreview | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTxn, setSuccessTxn] = useState<any | null>(null);

  // New Customer Modal State
  const [showNewCustModal, setShowNewCustModal] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustCode, setNewCustCode] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustRate, setNewCustRate] = useState("");
  const [savingNewCust, setSavingNewCust] = useState(false);
  const [newCustError, setNewCustError] = useState<string | null>(null);

  // Load customers, distributors, and prior party transfers
  useEffect(() => {
    loadOptions();
  }, []);

  async function loadOptions() {
    try {
      const [cRes, dRes, pRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/distributors"),
        fetch("/api/parties/prior-transfers"),
      ]);
      const cJson = await cRes.json();
      const dJson = await dRes.json();
      const pJson = await pRes.json().catch(() => ({}));
      const validCustomers = Array.isArray(cJson) ? cJson : [];
      const validDists = Array.isArray(dJson) ? dJson : [];
      if (pJson && pJson.summaries) {
        setPriorTransfersMap(pJson.summaries);
      }
      setCustomers(validCustomers);
      const filteredDists = validDists.filter((d: any) =>
        d.group_type === "IND" || ["INDIA_DISTRIBUTOR", "HYBRID", "BANK_ACCOUNT"].includes(d.partner_type)
      );
      const resolvedDists = filteredDists.length > 0 ? filteredDists : validDists;
      setDistributors(resolvedDists);
      if (resolvedDists.length > 0) {
        setSplits((prev) => {
          if (prev.length === 0) {
            return [
              {
                id: Math.random().toString(),
                distributor_id: resolvedDists[0].id,
                inr_amount: "",
                channel: "BANK",
                notes: "",
              },
            ];
          }
          return prev;
        });
      }
    } catch (err) {
      console.error(err);
      setCustomers([]);
      setDistributors([]);
    }
  }

  function handleCustomerChange(cId: string) {
    setCustomerId(cId);
    const selected = customers.find((c) => c.id === cId);
    // Never auto-overwrite customer rate if user already entered one
    if (selected?.default_rate && !customerRate.trim()) {
      setCustomerRate(String(selected.default_rate));
    }
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

      // Add to list and immediately select
      setCustomers((prev) => [...prev, created]);
      setCustomerId(created.id);
      if (created.default_rate && !customerRate.trim()) {
        setCustomerRate(String(created.default_rate));
      }

      setShowNewCustModal(false);
      setNewCustName("");
      setNewCustCode("");
      setNewCustPhone("");
      setNewCustRate("");
      toast.success("Customer created successfully");
    } catch (err: any) {
      setNewCustError(err.message || "Failed to create customer");
    } finally {
      setSavingNewCust(false);
    }
  }

  // New India Party Modal State
  const [showNewPartyModal, setShowNewPartyModal] = useState(false);
  const [targetSplitId, setTargetSplitId] = useState<string | null>(null);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyCode, setNewPartyCode] = useState("");
  const [savingNewParty, setSavingNewParty] = useState(false);
  const [newPartyError, setNewPartyError] = useState<string | null>(null);

  async function handleCreateNewParty(e: React.FormEvent) {
    e.preventDefault();
    if (!newPartyName.trim()) {
      setNewPartyError("Party name is required");
      return;
    }

    setSavingNewParty(true);
    setNewPartyError(null);
    try {
      const res = await fetch("/api/distributors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPartyName.trim(),
          code: newPartyCode.trim() || undefined,
          group_type: "IND",
          partner_type: "INDIA_DISTRIBUTOR",
          default_settlement_currency: "INR",
        }),
      });

      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "Failed to create party");

      // Add to distributors list
      setDistributors((prev) => [...prev, created]);

      // If a specific split line triggered this, select it immediately
      if (targetSplitId) {
        updateSplit(targetSplitId, "distributor_id", created.id);
      } else if (splits.length > 0) {
        updateSplit(splits[splits.length - 1].id, "distributor_id", created.id);
      }

      setShowNewPartyModal(false);
      setNewPartyName("");
      setNewPartyCode("");
      setTargetSplitId(null);
      toast.success(`India Party ${created.name} created successfully`);
    } catch (err: any) {
      setNewPartyError(err.message || "Failed to create India party");
    } finally {
      setSavingNewParty(false);
    }
  }

  // Non-empty, valid amounts (blank fields are completely ignored and not reflected in calculations or Excel)
  const validAmounts = inrAmounts
    .map((val) => parseFloat(val))
    .filter((num) => !isNaN(num) && num > 0);
  const totalOrderInr = Math.round((validAmounts.reduce((sum, num) => sum + num, 0) + Number.EPSILON) * 1000) / 1000;



  // Live Server Calculation
  useEffect(() => {
    const inr = totalOrderInr;
    const cRate = parseFloat(customerRate);
    const bRate = parseFloat(baseRate);
    const dVal = parseFloat(deliveryValue);

    if (!inr || inr <= 0 || !cRate || cRate <= 0 || !bRate || bRate <= 0) {
      setPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCalculating(true);
      setError(null);
      try {
        const bodyPayload: any = {
          inrAmount: inr,
          customerRate: cRate,
          baseRate: bRate,
        };

        if (deliveryMode === "AED") {
          bodyPayload.deliveryChargeAed = !isNaN(dVal) && dVal >= 0 ? dVal : 0;
        } else {
          bodyPayload.deliveryChargePct = !isNaN(dVal) && dVal >= 0 ? dVal / 100 : 0;
        }

        const res = await fetch("/api/transactions/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
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
  }, [inrAmounts, customerRate, baseRate, deliveryMode, deliveryValue, totalOrderInr]);

  // Splits Calculation (3 decimal precision)
  const totalAllocatedInr = Math.round((splits.reduce((sum, s) => sum + (parseFloat(s.inr_amount) || 0), 0) + Number.EPSILON) * 1000) / 1000;
  const remainingInr = Math.max(0, Math.round((totalOrderInr - totalAllocatedInr + Number.EPSILON) * 1000) / 1000);

  function addSplit() {
    if (distributors.length === 0) return;
    setSplits([
      ...splits,
      {
        id: Math.random().toString(),
        distributor_id: distributors[0].id,
        inr_amount: "",
        channel: "BANK",
        notes: "",
      },
    ]);
  }

  function updateSplit(id: string, field: keyof SplitItem, value: any) {
    setSplits(splits.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function removeSplit(id: string) {
    if (splits.length <= 1) {
      toast.error("At least one India party split is required");
      return;
    }
    setSplits(splits.filter((s) => s.id !== id));
  }

  // Intercept form submit and ask for confirmation
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError("Please select a customer or click '+ New Customer' to create one");
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

    // Mandatory India Party Distribution Validation
    if (splits.length === 0) {
      setError("India Distribution Split is mandatory. Please allocate this order to at least one India party.");
      return;
    }

    const hasEmptyParty = splits.some((s) => !s.distributor_id);
    if (hasEmptyParty) {
      setError("Please select an India Party for all split rows");
      return;
    }

    const hasInvalidAmount = splits.some((s) => !parseFloat(s.inr_amount) || parseFloat(s.inr_amount) <= 0);
    if (hasInvalidAmount) {
      setError("Please enter a valid INR split amount for all split rows");
      return;
    }

    const diff = Math.round((totalOrderInr - totalAllocatedInr + Number.EPSILON) * 1000) / 1000;
    if (Math.abs(diff) > 1.00) {
      if (diff > 0) {
        setError(
          `India Distribution Split is mandatory: Full order amount must be distributed. Remaining unallocated: ₹${diff.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`
        );
      } else {
        setError(
          `Total distributed (₹${totalAllocatedInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}) exceeds customer order by ₹${Math.abs(diff).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`
        );
      }
      return;
    }

    // Auto-absorb minor fractional discrepancy <= 1.00 INR (e.g. 0.20 INR from floating-point or rounded splits) into the last split row
    if (Math.abs(diff) > 0 && Math.abs(diff) <= 1.00 && splits.length > 0) {
      const lastIdx = splits.length - 1;
      const curAmt = parseFloat(splits[lastIdx].inr_amount) || 0;
      const adjustedAmt = Math.round((curAmt + diff + Number.EPSILON) * 1000) / 1000;
      splits[lastIdx].inr_amount = String(adjustedAmt);
    }

    setError(null);
    setShowConfirmModal(true);
  }

  // Save after user confirms details
  async function handleFinalSave() {
    const inr = totalOrderInr;
    const cRate = parseFloat(customerRate);
    const bRate = parseFloat(baseRate);

    setSaving(true);
    setError(null);
    try {
      // Track consumed prior balances across split lines
      const remainingPriorTracker: Record<string, number> = {};

      const payloadSplits = splits
        .filter((s) => parseFloat(s.inr_amount) > 0)
        .map((s) => {
          const splitAmt = parseFloat(s.inr_amount);
          const pInfo = priorTransfersMap[s.distributor_id];
          const shouldDeduct = s.deduct_prior === true;

          let noteText = s.notes?.trim() || "";
          if (s.channel && s.channel !== "DEFAULT") {
            const chanTag = `[${s.channel}]`;
            noteText = noteText ? `${chanTag} ${noteText}` : chanTag;
          }

          if (!pInfo || !pInfo.hasPriorTransfers || !shouldDeduct) {
            if (pInfo && pInfo.hasPriorTransfers && !shouldDeduct) {
              const keepNote = `[Prior advance of ₹${pInfo.availablePriorBalanceInr.toLocaleString("en-IN")} kept as-is (untouched); Full ₹${splitAmt.toLocaleString("en-IN")} payable separately]`;
              noteText = noteText ? `${noteText} • ${keepNote}` : keepNote;
            }
            return {
              distributor_id: s.distributor_id,
              inr_amount: splitAmt,
              paid_amount_inr: 0,
              balance_inr: splitAmt,
              notes: noteText || undefined,
            };
          }

          const partyKey = pInfo.partyCode || s.distributor_id;
          const currentPriorAvail = remainingPriorTracker[partyKey] !== undefined
            ? remainingPriorTracker[partyKey]
            : pInfo.availablePriorBalanceInr;

          const paidInr = Math.min(splitAmt, currentPriorAvail);
          const balanceInr = Math.max(0, splitAmt - paidInr);
          remainingPriorTracker[partyKey] = Math.max(0, currentPriorAvail - paidInr);

          if (paidInr > 0) {
            const offsetNote = `[Offset ₹${paidInr.toLocaleString("en-IN")} from prior transfer; Remaining to pay: ₹${balanceInr.toLocaleString("en-IN")}]`;
            noteText = noteText ? `${noteText} • ${offsetNote}` : offsetNote;
          }

          return {
            distributor_id: s.distributor_id,
            inr_amount: splitAmt,
            paid_amount_inr: paidInr,
            balance_inr: balanceInr,
            notes: noteText || undefined,
          };
        });

      // Breakdown of only entered amounts (empty fields omitted)
      const breakdownText =
        validAmounts.length > 1
          ? `Breakdown: ${validAmounts.map((a) => "₹" + a.toLocaleString("en-IN")).join(" + ")}`
          : "";
      const finalNotes = [notes.trim(), breakdownText].filter(Boolean).join(" | ") || undefined;

      const dVal = parseFloat(deliveryValue);
      const submitPayload: any = {
        transaction_date: date,
        customer_id: customerId,
        inr_amount: inr,
        customer_rate: cRate,
        base_rate: bRate,
        notes: finalNotes,
        splits: payloadSplits.length > 0 ? payloadSplits : undefined,
      };

      if (deliveryMode === "AED") {
        submitPayload.delivery_charge_aed = !isNaN(dVal) && dVal >= 0 ? dVal : 0;
      } else {
        submitPayload.delivery_charge_pct = !isNaN(dVal) && dVal >= 0 ? dVal / 100 : 0;
      }

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitPayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessTxn(data);
      setShowConfirmModal(false);
      setSplits([]);
      setInrAmounts(["", "", ""]);
      setDeliveryMode("PCT");
      setDeliveryValue("20");
      setNotes("");
      toast.success("Remittance transfer saved successfully");
    } catch (err: any) {
      setError(err.message || "Failed to save transfer");
      setShowConfirmModal(false);
      toast.error(err.message || "Failed to save transfer");
    } finally {
      setSaving(false);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const inrWords = totalOrderInr > 0 ? numberToIndianWords(totalOrderInr) : "";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Breadcrumbs items={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Customer Remittances", href: "/remittances" },
        { label: "New Remittance" },
      ]} />

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Receipt className="w-5 h-5 text-teal-700" />
          <span>New Money Transfer (Dubai ➔ India)</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Enter transfer parameters. AED amounts, gross margin, delivery cut, and net profit are calculated by the backend.
        </p>
      </div>

      {/* Success Banner */}
      {successTxn && (
        <div className="bg-teal-50 border-2 border-teal-500 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                Transfer Saved Successfully
              </span>
              <h3 className="text-base font-mono font-bold text-slate-900">{successTxn.transaction_number}</h3>
              <p className="text-xs text-slate-600">
                ₹ {Number(successTxn.inr_amount || successTxn.total).toLocaleString()} for {selectedCustomer?.name} •{" "}
                <span className="font-bold text-slate-900">{Number(successTxn.aed_amount || successTxn.in_dhirams).toFixed(3)} AED</span> •{" "}
                <span className="font-bold text-emerald-700">Profit: {Number(successTxn.net_profit_aed || 0).toFixed(3)} AED</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSuccessTxn(null);
                setInrAmounts(["", "", ""]);
                setDeliveryMode("PCT");
                setDeliveryValue("20");
                setNotes("");
                setDate(getTodayDateString());
              }}
              className="px-3.5 py-1.5 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800 shadow-sm cursor-pointer"
            >
              + Another Transfer
            </button>
            <button
              onClick={() => router.push(`/remittances`)}
              className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              View Remittances
            </button>
            <button
              onClick={() => router.push(`/customers/${customerId}`)}
              className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
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
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 pr-10 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={openDatePicker}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 p-1 cursor-pointer transition-colors"
                  title="Choose from calendar"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Customer
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(true)}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ New Customer</span>
                </button>
              </div>

              <select
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">
                  {customers.length === 0 ? "Select Customer" : `Select Customer (${customers.length})`}
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>

              {selectedCustomer && (
                <div className="text-[10px] text-slate-500 font-semibold mt-1">
                  Balance Due: {(selectedCustomer.outstanding_balance || 0).toFixed(3)} AED
                </div>
              )}
            </div>
          </div>

          {/* Section: INR Order Amounts (3 Default Fields) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  INR Order Amount
                </label>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">
                  {validAmounts.length} of {inrAmounts.length} entered
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddAmount}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded border border-teal-200 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Add Amount</span>
              </button>
            </div>

            <div className="space-y-2">
              {inrAmounts.map((amount, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 font-bold text-xs select-none">
                      <span className="font-mono">#{idx + 1}</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-500 font-bold text-sm">₹</span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={idx === 0 ? "e.g. 500000" : idx === 1 ? "e.g. 300000" : "e.g. 200000"}
                      value={amount}
                      onChange={(e) => handleAmountChange(idx, e.target.value)}
                      className="w-full text-sm font-bold pl-16 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs font-mono"
                    />
                  </div>
                  {inrAmounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAmount(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer shrink-0"
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
              <div className="mt-2 p-3 bg-teal-50/90 border border-teal-200/90 rounded-lg space-y-1.5 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                    Total Order INR:
                  </span>
                  <span className="text-base font-extrabold text-teal-800 font-mono">
                    ₹ {totalOrderInr.toLocaleString("en-IN")}
                  </span>
                </div>
                {inrWords && (
                  <div className="flex items-center gap-2 text-xs text-teal-900 border-t border-teal-200/50 pt-1.5">
                    <span className="font-bold text-[10px] tracking-wider uppercase bg-teal-200 text-teal-950 px-1.5 py-0.5 rounded font-mono shrink-0">
                      In Words:
                    </span>
                    <span className="font-semibold">{inrWords}</span>
                  </div>
                )}
                <div className="text-[10px] text-teal-700 italic">
                  * Empty fields are automatically excluded from calculations and Excel reports.
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic px-1">
                Enter at least one amount. Use &quot;+ Add Amount&quot; to add more fields if needed; empty fields are not included in Excel.
              </div>
            )}
          </div>

          {/* Section: Rates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Daily Rate (Customer)</span>
                <span className="text-[10px] text-teal-700 font-bold">AED / 1000 INR</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="e.g. 38.25"
                value={customerRate}
                onChange={(e) => {
                  const clean = e.target.value.replace(/,/g, "");
                  if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
                    setCustomerRate(clean);
                  }
                }}
                className="w-full text-xs font-bold font-mono border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>My Rate (Base Cost)</span>
                <span className="text-[10px] text-blue-700 font-bold">INR / 1 AED</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="e.g. 26.20"
                value={baseRate}
                onChange={(e) => {
                  const clean = e.target.value.replace(/,/g, "");
                  if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
                    setBaseRate(clean);
                  }
                }}
                className="w-full text-xs font-bold font-mono border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Section: Delivery Cut & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Delivery Charge ({deliveryMode === "PCT" ? "%" : "AED"})
                </label>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("AED")}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      deliveryMode === "AED" ? "bg-teal-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    AED
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("PCT")}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      deliveryMode === "PCT" ? "bg-teal-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>
              <input
                type="text"
                inputMode="decimal"
                placeholder={deliveryMode === "AED" ? "e.g. 20.000 AED" : "e.g. 20 %"}
                value={deliveryValue}
                onChange={(e) => {
                  const clean = e.target.value.replace(/,/g, "");
                  if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
                    setDeliveryValue(clean);
                  }
                }}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Transfer Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Bill #123, Reference or instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* SEPARATE SECTION: India Distribution Splits (Mandatory) */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Split className="w-3.5 h-3.5 text-teal-600" />
                  <span>India Distribution Split</span>
                  <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded uppercase">
                    Mandatory
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Allocate 100% of this order among India parties (MK, SALA, etc.). All INR must be distributed.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetSplitId(null);
                    setShowNewPartyModal(true);
                  }}
                  className="text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded border border-teal-200 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ New Party</span>
                </button>
                <button
                  type="button"
                  onClick={addSplit}
                  className="text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 px-2.5 py-1 rounded border border-teal-200 flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Split Order</span>
                </button>
              </div>
            </div>

            {/* Allocation Status Indicator */}
            {(() => {
              const diff = Math.round((totalOrderInr - totalAllocatedInr + Number.EPSILON) * 1000) / 1000;
              const isExact = totalOrderInr > 0 && Math.abs(diff) < 0.001;
              const isFractional = totalOrderInr > 0 && Math.abs(diff) <= 1.00 && !isExact;

              return (
                <div
                  className={`p-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 transition-colors ${
                    totalOrderInr === 0
                      ? "bg-slate-50 border-slate-200 text-slate-600"
                      : isExact
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : isFractional
                      ? "bg-teal-50 border-teal-200 text-teal-900"
                      : diff > 0
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-mono">
                    <span>Allocated:</span>
                    <strong>₹{totalAllocatedInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</strong>
                    <span>/</span>
                    <span>₹{totalOrderInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {totalOrderInr === 0 ? (
                      <span className="text-slate-400">Enter order amount above</span>
                    ) : isExact ? (
                      <strong className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 100% Allocated
                      </strong>
                    ) : isFractional ? (
                      <div className="flex items-center gap-2">
                        <span className="text-teal-800 font-semibold text-[11px]">
                          ⚡ Fraction diff: {diff > 0 ? `+₹${diff.toFixed(2)}` : `-₹${Math.abs(diff).toFixed(2)}`} (Auto-absorbed on submit)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (splits.length > 0) {
                              const last = splits[splits.length - 1];
                              const cur = parseFloat(last.inr_amount) || 0;
                              const nextVal = Math.round((cur + diff + Number.EPSILON) * 1000) / 1000;
                              updateSplit(last.id, "inr_amount", String(nextVal));
                            }
                          }}
                          className="px-2 py-0.5 text-[11px] font-bold bg-teal-200 hover:bg-teal-300 text-teal-900 rounded border border-teal-300 transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                          title="Auto-balance fraction to last split"
                        >
                          Auto-balance Fraction
                        </button>
                      </div>
                    ) : diff > 0 ? (
                      <span className="text-amber-800 font-semibold">
                        Remaining: <strong>₹{diff.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</strong>
                      </span>
                    ) : (
                      <span className="text-rose-700 font-semibold">
                        Over-allocated by <strong>₹{Math.abs(diff).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Split Rows */}
            {splits.map((s, idx) => (
              <div key={s.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Party Split #{idx + 1}</span>
                  <div className="flex items-center gap-2">
                    {remainingInr > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseFloat(s.inr_amount) || 0;
                          const nextVal = Math.round((cur + remainingInr + Number.EPSILON) * 1000) / 1000;
                          updateSplit(s.id, "inr_amount", String(nextVal));
                        }}
                        className="text-teal-700 hover:underline cursor-pointer text-[10px]"
                      >
                        Fill Remaining (+₹{remainingInr.toLocaleString("en-IN")})
                      </button>
                    )}
                    {splits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSplit(s.id)}
                        className="text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-5">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-[10px] uppercase font-bold text-slate-600">
                        India Party *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetSplitId(s.id);
                          setShowNewPartyModal(true);
                        }}
                        className="text-[10px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-1.5 py-0.5 rounded border border-teal-200 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-2.5 h-2.5" />
                        <span>+ New Party</span>
                      </button>
                    </div>
                    <select
                      required
                      value={s.distributor_id}
                      onChange={(e) => {
                        if (e.target.value === "__NEW__") {
                          setTargetSplitId(s.id);
                          setShowNewPartyModal(true);
                          return;
                        }
                        updateSplit(s.id, "distributor_id", e.target.value);
                      }}
                      className="w-full text-xs font-bold border border-slate-300 rounded p-2 bg-white text-slate-900"
                    >
                      <option value="">-- Choose India Party --</option>
                      {distributors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.code ? `(${d.code})` : ""}
                        </option>
                      ))}
                      <option value="__NEW__" className="font-bold text-teal-700">
                        + Create New India Party...
                      </option>
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">
                      INR Amount *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="Amount"
                      value={s.inr_amount}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/,/g, "");
                        if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
                          updateSplit(s.id, "inr_amount", clean);
                        }
                      }}
                      className="w-full text-xs font-bold border border-slate-300 rounded p-2 bg-white text-slate-900 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">
                      Channel / Mode
                    </label>
                    <select
                      value={s.channel || "BANK"}
                      onChange={(e) => updateSplit(s.id, "channel", e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded p-2 bg-white text-slate-900"
                    >
                      <option value="BANK">BANK</option>
                      <option value="GPAY">GPAY</option>
                      <option value="CASH">CASH</option>
                      <option value="HAWALA">HAWALA</option>
                      <option value="DEFAULT">DEFAULT</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>
                </div>

                {/* Optional Split Notes / Reference */}
                <div>
                  <input
                    type="text"
                    placeholder="Optional reference / split notes (e.g. UPI Ref, Branch, Account)..."
                    value={s.notes || ""}
                    onChange={(e) => updateSplit(s.id, "notes", e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 bg-white text-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* Prior Transfer Offset & Decision Card — Only appears if party has prior advance */}
                {(() => {
                  const partyInfo = priorTransfersMap[s.distributor_id];
                  if (!partyInfo || !partyInfo.hasPriorTransfers || partyInfo.availablePriorBalanceInr <= 0) {
                    return null;
                  }

                  const splitInr = parseFloat(s.inr_amount) || 0;
                  const priorAvailable = partyInfo.availablePriorBalanceInr;
                  const isSplitEntered = splitInr > 0;
                  const isDeducting = s.deduct_prior === true;
                  const remainingToGive = Math.max(0, splitInr - priorAvailable);
                  const remainingPriorBalance = Math.max(0, priorAvailable - splitInr);
                  const isExactMatch = isSplitEntered && Math.abs(splitInr - priorAvailable) < 0.01;

                  return (
                    <div className="mt-2.5 p-3 rounded-lg border bg-gradient-to-r from-amber-50/90 to-teal-50/60 border-amber-300/80 text-xs space-y-2.5 shadow-xs">
                      {/* Top banner: Prior advance details */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-amber-200/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span className="font-bold text-amber-900">
                            Prior Transfer Available: ₹{priorAvailable.toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                            Pre-paid to {partyInfo.partyName}
                          </span>
                        </div>

                        {partyInfo.transfers && partyInfo.transfers.length > 0 && (
                          <div className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
                            <span>When: {partyInfo.transfers[partyInfo.transfers.length - 1].transaction_date}</span>
                            <span>•</span>
                            <span>Ref: {partyInfo.transfers[partyInfo.transfers.length - 1].transaction_number}</span>
                          </div>
                        )}
                      </div>

                      {/* Choice Buttons: Proceed with Reduced Amount vs Keep Prior Amount As It Is */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] font-bold text-slate-700">Choose Advance Treatment:</span>
                        <div className="inline-flex rounded-lg p-0.5 bg-white border border-slate-300 shadow-xs">
                          <button
                            type="button"
                            onClick={() => updateSplit(s.id, "deduct_prior", true)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isDeducting
                                ? "bg-[#0F766E] text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          >
                            <span>⚡</span> Proceed with Reduced Amount {isDeducting && "✓"}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSplit(s.id, "deduct_prior", false)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              !isDeducting
                                ? "bg-slate-800 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          >
                            <span>🛡️</span> Keep Prior Amount As It Is {!isDeducting && "✓"}
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Calculation based on selected mode */}
                      {isSplitEntered ? (
                        <div className="space-y-1.5">
                          {isDeducting ? (
                            <>
                              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-700">
                                <span>New Order Split: <strong>₹{splitInr.toLocaleString("en-IN")}</strong></span>
                                <span>Prior Advance Deducted: <strong className="text-amber-800">-₹{Math.min(splitInr, priorAvailable).toLocaleString("en-IN")}</strong></span>
                              </div>

                              {remainingToGive > 0 ? (
                                <div className="p-2 bg-amber-100/90 rounded border border-amber-300 flex items-center justify-between">
                                  <span className="font-bold text-amber-900">
                                    👉 Remaining to pay {partyInfo.partyName}:
                                  </span>
                                  <span className="text-sm font-mono font-black text-amber-950">
                                    ₹{remainingToGive.toLocaleString("en-IN")}
                                  </span>
                                </div>
                              ) : isExactMatch ? (
                                <div className="p-2 bg-emerald-100/90 rounded border border-emerald-300 flex items-center justify-between text-emerald-900">
                                  <span className="font-bold">✓ Exactly settled against prior transfer:</span>
                                  <span className="font-mono font-black">₹0 to pay</span>
                                </div>
                              ) : (
                                <div className="p-2 bg-emerald-50 rounded border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-emerald-900">
                                  <span className="font-bold">
                                    ✓ 100% covered by prior transfer (₹0 to pay now)
                                  </span>
                                  <span className="text-[11px] font-semibold text-emerald-800">
                                    Party retains ₹{remainingPriorBalance.toLocaleString("en-IN")} excess advance for future orders
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-700">
                                <span>New Order Split: <strong>₹{splitInr.toLocaleString("en-IN")}</strong></span>
                                <span>Prior Advance Deducted: <strong className="text-slate-500">₹0 (Untouched)</strong></span>
                              </div>
                              <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-slate-900">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-base">🛡️</span>
                                  <div>
                                    <p className="font-bold text-slate-900">Prior advance kept intact (₹{priorAvailable.toLocaleString("en-IN")} untouched)</p>
                                    <p className="text-[11px] text-slate-600">Full order amount will be paid separately to {partyInfo.partyName}.</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-[10px] uppercase font-bold text-slate-500 block">To Pay For This Order</span>
                                  <span className="text-sm font-mono font-black text-slate-900">
                                    ₹{splitInr.toLocaleString("en-IN")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">
                          Enter split INR amount above to calculate the net remaining payment or party due.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
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
          <div className="bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Backend Calculation Preview
              </span>
              {calculating && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
            </div>

            {preview ? (
              <div className="space-y-4">
                {/* AED Charged */}
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">AED Amount Charged to Customer</span>
                  <div className="text-3xl font-mono font-bold text-slate-900 mt-1">
                    {preview.aedAmount.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} AED
                  </div>
                  <span className="text-[10px] text-teal-700 font-mono">
                    = (₹{preview.inrAmount.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} / 1000) × {preview.customerRate.toFixed(3)}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-500">Wholesale Cost (AED):</span>
                    <span className="font-mono font-bold text-slate-800">
                      {preview.costAed.toFixed(3)} AED
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-500">Gross Margin:</span>
                    <span className="font-mono font-bold text-teal-700">
                      +{preview.grossProfitAed.toFixed(3)} AED
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-500">
                      Delivery Fee {deliveryMode === "PCT" && preview.deliveryChargePct > 0 ? `(${(preview.deliveryChargePct * 100).toFixed(0)}%)` : "(AED)"}:
                    </span>
                    <span className="font-mono font-bold text-slate-500">
                      -{preview.deliveryChargeAed.toFixed(3)} AED
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-lg bg-teal-50 border border-teal-200/80 mt-3">
                    <span className="font-bold text-teal-900">Net Business Profit:</span>
                    <span className="font-mono font-bold text-teal-700 text-lg">
                      {preview.netProfitAed.toFixed(3)} AED
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                Enter transfer amounts and rates to view authoritative calculations.
              </div>
            )}
          </div>

          {/* Quick Guidance Box */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2 shadow-sm">
            <span className="font-bold text-slate-900 block">Customer Workflow</span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              If the customer is new, click <strong className="text-teal-700">"+ New Customer"</strong> to create them on the spot. Once created, they will be saved to your database and ready for selection on all future transfers.
            </p>
          </div>
        </div>
      </div>

      {/* QUICK INLINE NEW CUSTOMER MODAL */}
      {showNewCustModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-700" />
                <span>Create New Customer</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCustModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DIVAN or AHMAD"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CUST-001"
                    value={newCustCode}
                    onChange={(e) => setNewCustCode(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Default Rate
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="38.25"
                    value={newCustRate}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/,/g, "");
                      if (clean === "" || /^[0-9]*\.?[0-9]*$/.test(clean)) {
                        setNewCustRate(clean);
                      }
                    }}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+971 50 ..."
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
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

      {/* QUICK INLINE NEW INDIA PARTY MODAL */}
      {showNewPartyModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-700" />
                <span>Create New India Party</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowNewPartyModal(false);
                  setTargetSplitId(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {newPartyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{newPartyError}</span>
              </div>
            )}

            <form onSubmit={handleCreateNewParty} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Party Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MK, SALA, or RAJA"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Party Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. RAJA-IND"
                  value={newPartyCode}
                  onChange={(e) => setNewPartyCode(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  If left blank, a code will be automatically generated.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPartyModal(false);
                    setTargetSplitId(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNewParty}
                  className="px-4 py-2 bg-[#0F766E] hover:bg-[#0D9488] text-white rounded-lg text-xs font-bold disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {savingNewParty ? "Saving..." : "Create & Select"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRE-SAVE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150 my-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-800 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-6 h-6 text-teal-200 shrink-0" />
                <div>
                  <h3 className="text-base font-bold">Confirm Remittance Details</h3>
                  <p className="text-[11px] text-teal-100">Please review all entered values before saving</p>
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
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer</span>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedCustomer?.name || "-"}
                  </p>
                  {selectedCustomer?.code && (
                    <span className="text-[10px] text-teal-700 font-mono">
                      Code: {selectedCustomer.code}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</span>
                  <p className="text-sm font-bold text-slate-900 font-mono">
                    {date}
                  </p>
                </div>
              </div>

              {/* INR Amounts breakdown */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    INR Order Amounts ({validAmounts.length} entered)
                  </span>
                  <span className="text-[10px] text-teal-700 font-medium">
                    Empty fields excluded
                  </span>
                </div>

                <div className="space-y-1">
                  {validAmounts.map((amt, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-700">
                      <span className="text-slate-500 font-medium">Amount #{idx + 1}:</span>
                      <span className="font-mono font-bold">₹ {amt.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-900">Total INR Order:</span>
                  <span className="text-base font-extrabold text-teal-700 font-mono">
                    ₹ {totalOrderInr.toLocaleString("en-IN")}
                  </span>
                </div>
                {inrWords && (
                  <p className="text-[11px] text-teal-800 italic font-medium">
                    ({inrWords})
                  </p>
                )}
              </div>

              {/* Rates & Financial Summary */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-slate-700 pb-2 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Customer Rate</span>
                    <p className="font-mono font-bold text-slate-900">{customerRate} AED / 1000</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Base Rate</span>
                    <p className="font-mono font-bold text-slate-900">{baseRate}</p>
                  </div>
                </div>

                {preview && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-sm font-bold p-2 bg-teal-50 rounded-lg border border-teal-200/70">
                      <span className="text-teal-900">Customer Pays:</span>
                      <span className="text-base font-mono text-teal-800">
                        {preview.aedAmount.toFixed(3)} AED
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span>Wholesale Cost (AED):</span>
                      <span className="font-mono font-semibold">{preview.costAed.toFixed(3)} AED</span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span>Gross Margin:</span>
                      <span className="font-mono font-semibold text-teal-700">
                        +{preview.grossProfitAed.toFixed(3)} AED
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span>Delivery Fee {deliveryMode === "PCT" && preview.deliveryChargePct > 0 ? `(${(preview.deliveryChargePct * 100).toFixed(0)}%)` : "(AED)"}:</span>
                      <span className="font-mono font-semibold text-rose-600">
                        -{preview.deliveryChargeAed.toFixed(3)} AED
                      </span>
                    </div>

                    <div className="flex justify-between font-bold text-teal-700 pt-1.5 border-t border-slate-200">
                      <span>Net Business Profit:</span>
                      <span className="font-mono text-sm">{preview.netProfitAed.toFixed(3)} AED</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mandatory Distribution Splits */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>India Distribution Splits ({splits.length})</span>
                  <span className="text-teal-700 font-mono font-bold">✓ 100% Allocated</span>
                </div>
                {splits.map((s, idx) => {
                  const d = distributors.find((dist) => dist.id === s.distributor_id);
                  const pInfo = priorTransfersMap[s.distributor_id];
                  const splitAmt = parseFloat(s.inr_amount || "0");
                  const hasPrior = pInfo && pInfo.hasPriorTransfers && pInfo.availablePriorBalanceInr > 0;
                  const priorAvail = hasPrior ? pInfo.availablePriorBalanceInr : 0;
                  const isDeducting = s.deduct_prior !== false;
                  const remainingToPay = Math.max(0, splitAmt - priorAvail);

                  return (
                    <div key={idx} className="p-2 rounded bg-white border border-slate-200/80 space-y-1">
                      <div className="flex justify-between items-center text-slate-800 font-medium">
                        <span>{d?.name || "Distributor"} {d?.code ? `(${d?.code})` : ""}</span>
                        <span className="font-mono font-bold text-slate-900">
                          ₹ {splitAmt.toLocaleString("en-IN")}
                        </span>
                      </div>
                      {hasPrior && (
                        <div className="flex flex-wrap items-center justify-between text-[10px] pt-1 border-t border-slate-100 text-slate-600">
                          {isDeducting ? (
                            <>
                              <span className="text-amber-800 font-semibold flex items-center gap-1">
                                <span>⚡</span> Offset from Prior Advance: -₹{Math.min(splitAmt, priorAvail).toLocaleString("en-IN")}
                              </span>
                              <span className={remainingToPay > 0 ? "font-bold text-amber-900" : "font-bold text-emerald-700"}>
                                {remainingToPay > 0 ? `Net To Pay: ₹${remainingToPay.toLocaleString("en-IN")}` : "✓ Fully Covered by Advance"}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-slate-700 font-semibold flex items-center gap-1">
                                <span>🛡️</span> Prior Advance: ₹{priorAvail.toLocaleString("en-IN")} kept intact
                              </span>
                              <span className="font-bold text-slate-900">
                                Full Net To Pay: ₹{splitAmt.toLocaleString("en-IN")} (Pay separately)
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Optional Notes */}
              {notes && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Transfer Notes
                  </span>
                  <p className="text-slate-700">{notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100/80 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
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
