"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  Coins,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Banknote,
} from "lucide-react";

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDistributors();
  }, []);

  async function fetchDistributors() {
    setLoading(true);
    try {
      const res = await fetch("/api/distributors");
      const data = await res.json();
      setDistributors(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const wholesalePartners = distributors.filter((d) => d.partner_type === "WHOLESALE_PARTNER");
  const bankDistributors = distributors.filter((d) => d.partner_type === "BANK_DISTRIBUTOR");

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Wholesale Liquidity Partners & Distributors</h2>
        <p className="text-xs text-slate-500">
          Cross-border India liquidity routing, wholesale currency conversions, and Dubai AED settlements.
        </p>
      </div>

      {/* Confirmation Notice Banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Business Role Classification Notice</p>
          <p className="text-amber-700 leading-relaxed">
            The workbook establishes two distinct party categories: <strong>Wholesale Liquidity Providers</strong> (AWAFI, NF2, HAJA, SARABU, BASID) who convert bulk INR orders to Dirhams via wholesale exchange rates, and <strong>Direct Bank Distributors</strong> (MK, SALA, USAIN, NNG, BLACK GRP) who execute specific customer bank payouts.
          </p>
        </div>
      </div>

      {/* Wholesale Partners Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Wholesale Liquidity Partners (Settled in AED)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {wholesalePartners.map((p) => (
            <div key={p.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {p.code}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mt-1">{p.name}</h4>
                </div>
                <Building2 className="w-5 h-5 text-slate-400" />
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Settlement Model:</span>
                  <span className="font-semibold text-slate-800">INR ➔ AED (Wholesale)</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Settlement Currency:</span>
                  <span className="font-semibold text-slate-800">{p.default_settlement_currency}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Account Status:</span>
                  <span className="font-semibold text-emerald-600">{p.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Direct Bank Distributors Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Direct Bank Payout Channels (Settled in INR)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bankDistributors.map((d) => (
            <div key={d.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {d.code}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mt-1">{d.name}</h4>
                </div>
                <Banknote className="w-5 h-5 text-slate-400" />
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Execution Channel:</span>
                  <span className="font-semibold text-slate-800">Direct India Bank</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Order Currency:</span>
                  <span className="font-semibold text-slate-800">Indian Rupee (INR)</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Ledger Module:</span>
                  <span className="font-semibold text-indigo-600">Bank Distrip</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
