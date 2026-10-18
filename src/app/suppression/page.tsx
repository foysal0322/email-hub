"use client";

import { useEffect, useState } from "react";
import {
  ShieldBan,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  X,
  Lock,
} from "lucide-react";

interface SuppressionEntry {
  id: string;
  email: string;
  category: string;
  reason: string;
  source: string;
  providerMessageId: string | null;
  createdAt: string;
  createdBy: string | null;
}

export default function SuppressionPage() {
  const [entries, setEntries] = useState<SuppressionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Manual Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newCategory, setNewCategory] = useState("admin_suppression");
  const [newReason, setNewReason] = useState("");

  // Unsuppress Modal
  const [unsuppressTarget, setUnsuppressTarget] = useState<SuppressionEntry | null>(null);
  const [unsuppressReason, setUnsuppressReason] = useState("");
  const [forceOverride, setForceOverride] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, [categoryFilter]);

  async function fetchEntries() {
    setLoading(true);
    try {
      const url = new URL("/api/suppression", window.location.origin);
      if (search) url.searchParams.set("search", search);
      if (categoryFilter) url.searchParams.set("category", categoryFilter);

      const res = await fetch(url.toString());
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/suppression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          category: newCategory,
          reason: newReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add suppression");

      setShowAddModal(false);
      setNewEmail("");
      setNewReason("");
      fetchEntries();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  }

  async function handleUnsuppress(e: React.FormEvent) {
    e.preventDefault();
    if (!unsuppressTarget) return;

    try {
      const url = new URL("/api/suppression", window.location.origin);
      url.searchParams.set("id", unsuppressTarget.id);
      url.searchParams.set("reason", unsuppressReason);
      if (forceOverride) url.searchParams.set("forceOverride", "true");

      const res = await fetch(url.toString(), { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to unsuppress");

      setUnsuppressTarget(null);
      setUnsuppressReason("");
      setForceOverride(false);
      fetchEntries();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Global Suppression Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centralized deliverability guard. Intercepts previously bounced, complained, or unsubscribed addresses before sending.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Suppression Entry</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search suppressed emails or reasons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchEntries()}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground"
        >
          <option value="">All Suppression Categories</option>
          <option value="hard_bounce">Hard Bounce</option>
          <option value="soft_bounce">Repeated Soft Bounce</option>
          <option value="complaint">Spam Complaint</option>
          <option value="unsubscribe">Unsubscribe</option>
          <option value="admin_suppression">Administrative Suppression</option>
          <option value="invalid_syntax">Invalid Syntax</option>
        </select>
      </div>

      {/* Suppression Registry Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border">
              <tr>
                <th className="p-4">Suppressed Email</th>
                <th className="p-4">Category</th>
                <th className="p-4">Reason / Diagnostic Detail</th>
                <th className="p-4">Source</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading suppression records...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <p className="text-base font-medium">No suppressed records found.</p>
                    <p className="text-xs mt-1">Your deliverability shield is active and clean.</p>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-mono font-medium text-foreground">{entry.email}</td>

                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider text-[10px] ${
                          entry.category === "hard_bounce"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200"
                            : entry.category === "complaint"
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200"
                            : entry.category === "unsubscribe"
                            ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {entry.category.replace("_", " ")}
                      </span>
                    </td>

                    <td className="p-4 text-xs text-muted-foreground max-w-sm truncate" title={entry.reason}>
                      {entry.reason}
                    </td>

                    <td className="p-4 text-xs text-muted-foreground font-mono">{entry.source}</td>

                    <td className="p-4 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => setUnsuppressTarget(entry)}
                        className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-all"
                        title="Unsuppress Contact"
                      >
                        Unsuppress
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Suppression Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Add to Global Suppression</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="blocked.user@example.com"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
                >
                  <option value="admin_suppression">Administrative Suppression</option>
                  <option value="hard_bounce">Hard Bounce</option>
                  <option value="complaint">Spam Complaint</option>
                  <option value="unsubscribe">Unsubscribe</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Documented Reason</label>
                <input
                  type="text"
                  required
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g. Requested removal via phone or known invalid domain"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                >
                  Suppress Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Unsuppress Confirmation Modal */}
      {unsuppressTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-base font-bold text-foreground">Confirm Administrative Unsuppression</h3>
            </div>

            <p className="text-xs text-muted-foreground">
              You are removing <span className="font-mono font-semibold text-foreground">{unsuppressTarget.email}</span> from
              the suppression registry (Category:{" "}
              <strong className="text-foreground">{unsuppressTarget.category}</strong>).
            </p>

            {(unsuppressTarget.category === "complaint" || unsuppressTarget.category === "unsubscribe") && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Regulatory Protection Notice</span>
                </div>
                <p>
                  Removing an unsubscribe or complaint without recipient consent violates anti-spam regulations (CAN-SPAM, GDPR).
                </p>
                <label className="flex items-center gap-2 cursor-pointer pt-1 font-medium">
                  <input
                    type="checkbox"
                    checked={forceOverride}
                    onChange={(e) => setForceOverride(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>I confirm verified written recipient re-opt-in</span>
                </label>
              </div>
            )}

            <form onSubmit={handleUnsuppress} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Administrative Reason (Audit Logged) <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={unsuppressReason}
                  onChange={(e) => setUnsuppressReason(e.target.value)}
                  placeholder="e.g. Mailbox issue resolved with client SRE team"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUnsuppressTarget(null)}
                  className="px-4 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !unsuppressReason ||
                    ((unsuppressTarget.category === "complaint" || unsuppressTarget.category === "unsubscribe") &&
                      !forceOverride)
                  }
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
                >
                  Confirm & Unsuppress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
