"use client";

import { useEffect, useState, useCallback } from "react";
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
  RefreshCw,
} from "lucide-react";
import Pagination from "@/components/Pagination";

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

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Manual Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newCategory, setNewCategory] = useState("admin_suppression");
  const [newReason, setNewReason] = useState("");

  // Unsuppress Modal
  const [unsuppressTarget, setUnsuppressTarget] = useState<SuppressionEntry | null>(null);
  const [unsuppressReason, setUnsuppressReason] = useState("");
  const [forceOverride, setForceOverride] = useState(false);

  const fetchEntries = useCallback(
    async (p = page, lim = limit) => {
      setLoading(true);
      try {
        const url = new URL("/api/suppression", window.location.origin);
        url.searchParams.set("page", String(p));
        url.searchParams.set("limit", String(lim));
        if (search) url.searchParams.set("search", search);
        if (categoryFilter) url.searchParams.set("category", categoryFilter);

        const res = await fetch(url.toString());
        const data = await res.json();
        setEntries(data.entries || []);
        if (data.pagination) {
          setTotal(data.pagination.total);
          setTotalPages(data.pagination.totalPages);
        }
      } catch (e) {
        console.error("fetchEntries error:", e);
      } finally {
        setLoading(false);
      }
    },
    [search, categoryFilter, page, limit]
  );

  useEffect(() => {
    fetchEntries(page, limit);
  }, [page, limit, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEntries(1, limit);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setLimit(newSize);
    setPage(1);
  };

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
      fetchEntries(1, limit);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  }

  async function handleUnsuppress(e: React.FormEvent) {
    e.preventDefault();
    if (!unsuppressTarget) return;

    try {
      const res = await fetch("/api/suppression/unsuppress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: unsuppressTarget.email,
          reason: unsuppressReason,
          forceOverride,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unsuppress contact");

      setUnsuppressTarget(null);
      setUnsuppressReason("");
      setForceOverride(false);
      fetchEntries(page, limit);
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
            RFC-compliant quarantine list. Suppressed contacts are guaranteed never to receive emails.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchEntries(page, limit)}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 bg-rose-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-rose-700 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manually Suppress Email</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by suppressed email or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
        >
          <option value="">All Categories</option>
          <option value="hard_bounce">Hard Bounces</option>
          <option value="complaint">Spam Complaints</option>
          <option value="unsubscribe">Unsubscribes</option>
          <option value="admin_suppression">Admin Suppression</option>
        </select>

        <button
          type="submit"
          className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-lg hover:bg-secondary/80 w-full sm:w-auto"
        >
          Search
        </button>
      </form>

      {/* Suppression Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border">
              <tr>
                <th className="p-4">Blocked Email</th>
                <th className="p-4">Category</th>
                <th className="p-4">Documented Reason</th>
                <th className="p-4">Source</th>
                <th className="p-4">Suppressed Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">
                    Loading suppression records...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">
                    No suppression entries found.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-semibold text-foreground font-mono text-xs">
                      {entry.email}
                    </td>

                    <td className="p-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize ${
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

        {/* Pagination Controls */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[15, 25, 50, 100]}
          itemName="suppressed entries"
        />
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

            {unsuppressTarget.category === "complaint" && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200 space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>High Deliverability Risk</span>
                </div>
                <p>
                  This address generated a spam complaint. Unsuppressing without subscriber consent can lead to domain blacklisting by mailbox providers.
                </p>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={forceOverride}
                    onChange={(e) => setForceOverride(e.target.checked)}
                    className="rounded border-border text-rose-600"
                  />
                  <span className="font-semibold">I understand the ISP reputation risks</span>
                </label>
              </div>
            )}

            <form onSubmit={handleUnsuppress} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Compliance Audit Justification <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={unsuppressReason}
                  onChange={(e) => setUnsuppressReason(e.target.value)}
                  placeholder="e.g. Subscriber provided written opt-in confirmation on ticket #4819"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setUnsuppressTarget(null)}
                  className="px-4 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unsuppressTarget.category === "complaint" && !forceOverride}
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Unsuppress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
