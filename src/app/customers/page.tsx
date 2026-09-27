"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  PlusCircle,
  Coins,
  CheckCircle,
  AlertCircle,
  CreditCard,
  UserPlus,
  AlertTriangle,
  Edit3,
  Trash2,
} from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");

  // Create Customer Modal State
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRate, setNewRate] = useState("38.25");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Customer Modal State
  const [editCustomer, setEditCustomer] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRate, setEditRate] = useState("38.25");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Customer Modal State
  const [deleteCustomerTarget, setDeleteCustomerTarget] = useState<any | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setModalError("Customer name is required");
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          code: newCode.trim() || undefined,
          phone: newPhone.trim() || undefined,
          default_rate: newRate ? parseFloat(newRate) : 38.25,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowModal(false);
      setNewName("");
      setNewCode("");
      setNewPhone("");
      setNewRate("38.25");
      fetchCustomers();
    } catch (err: any) {
      setModalError(err.message || "Failed to create customer");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(c: any) {
    setEditCustomer(c);
    setEditName(c.name || "");
    setEditCode(c.code || "");
    setEditPhone(c.phone || "");
    setEditRate(String(c.default_rate || 38.25));
    setEditError(null);
  }

  async function handleUpdateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!editCustomer || !editName.trim()) return;

    setEditSubmitting(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/customers/${editCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim() || undefined,
          phone: editPhone.trim() || undefined,
          default_rate: editRate ? parseFloat(editRate) : 38.25,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update customer");

      setEditCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      setEditError(err.message || "Failed to update customer");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteCustomer() {
    if (!deleteCustomerTarget) return;

    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/customers/${deleteCustomerTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete customer");

      setDeleteCustomerTarget(null);
      fetchCustomers();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete customer");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const filtered = customers.filter((c) => {
    if (
      search &&
      !c.name.toLowerCase().includes(search.toLowerCase()) &&
      !c.code.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    if (balanceFilter === "owing" && (c.outstanding_balance || 0) <= 0.01) return false;
    if (balanceFilter === "cleared" && Math.abs(c.outstanding_balance || 0) > 0.01) return false;
    return true;
  });

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Dubai Customers Master</h2>
          <p className="text-xs text-slate-500">
            {customers.length === 0
              ? "No customers yet. Click '+ Add Customer' to register a new client."
              : `${customers.length} registered Dubai customer accounts.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Customer</span>
          </button>

          {customers.length > 0 && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                  Total Outstanding Due
                </span>
                <p className="text-sm font-bold text-rose-950">
                  {totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })} AED
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">Filter:</span>
          {[
            { id: "all", label: "All Customers" },
            { id: "owing", label: "Has Balance Due" },
            { id: "cleared", label: "Settled / Zero" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setBalanceFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                balanceFilter === item.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Grid / Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4 text-right">Default Rate</th>
                <th className="py-3 px-4 text-right">Total Processed (INR)</th>
                <th className="py-3 px-4 text-right">Total AED Billed</th>
                <th className="py-3 px-4 text-right">Total AED Paid</th>
                <th className="py-3 px-4 text-right">Outstanding (AED)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    Loading customers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-800">No Customers Found</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      All default names have been cleared. Click "+ Add Customer" above to create your clients.
                    </p>
                    <button
                      onClick={() => setShowModal(true)}
                      className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm"
                    >
                      + Add First Customer
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const bal = c.outstanding_balance || 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <Link href={`/customers/${c.id}`} className="hover:underline text-emerald-800">
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{c.code}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                        {c.default_rate || 38.25}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                        ₹ {(c.total_inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-700">
                        {(c.total_aed || 0).toFixed(2)} AED
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-700 font-medium">
                        {(c.total_paid || 0).toFixed(2)} AED
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs ${
                            bal > 0.01
                              ? "bg-rose-100 text-rose-800 font-bold"
                              : bal < -0.01
                              ? "bg-blue-100 text-blue-800 font-bold"
                              : "bg-emerald-100 text-emerald-800 font-medium"
                          }`}
                        >
                          {bal.toFixed(2)} AED
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/customers/${c.id}`}
                            className="px-2 py-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded border border-emerald-200"
                            title="View Statement"
                          >
                            Statement
                          </Link>
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200"
                            title="Edit Customer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteCustomerTarget(c);
                              setDeleteError(null);
                            }}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded border border-rose-200"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE CUSTOMER MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <span>Add New Dubai Customer</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DIVAN or SAMI"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Default Rate
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="38.25"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
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
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                >
                  {submitting ? "Saving..." : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {editCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-600" />
                <span>Edit Customer: {editCustomer.name}</span>
              </h3>
              <button
                onClick={() => setEditCustomer(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Default Rate
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditCustomer(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                >
                  {editSubmitting ? "Updating..." : "Update Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CUSTOMER CONFIRMATION MODAL */}
      {deleteCustomerTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-rose-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <span>Delete Customer Account</span>
              </h3>
              <button
                onClick={() => setDeleteCustomerTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {deleteError ? (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{deleteError}</span>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-600">
                <p>
                  Are you sure you want to permanently delete the customer{" "}
                  <strong className="text-slate-900">{deleteCustomerTarget.name}</strong> ({deleteCustomerTarget.code})?
                </p>
                <p className="text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                  Note: A customer with active transactions cannot be deleted. You must delete or reassign their transactions first.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteCustomerTarget(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={deleteSubmitting}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50 shadow-sm"
              >
                {deleteSubmitting ? "Deleting..." : "Yes, Delete Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
