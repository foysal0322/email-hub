"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Send,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Copy,
  ExternalLink,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import Pagination from "@/components/Pagination";

interface CampaignItem {
  id: string;
  name: string;
  subject: string;
  fromEmail: string;
  status: string;
  totalRecipients: number;
  eligibleRecipients: number;
  sentCount: number;
  deliveredCount: number;
  uniqueOpensCount: number;
  uniqueClicksCount: number;
  bouncedCount: number;
  skippedCount: number;
  createdAt: string;
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [relaunchingId, setRelaunchingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const pageRef = useRef(page);
  const limitRef = useRef(limit);
  const searchRef = useRef(search);
  const statusRef = useRef(statusFilter);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);
  useEffect(() => {
    statusRef.current = statusFilter;
  }, [statusFilter]);

  const fetchCampaigns = useCallback(
    async (p = pageRef.current, lim = limitRef.current, silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const url = new URL("/api/campaigns", window.location.origin);
        url.searchParams.set("page", String(p));
        url.searchParams.set("limit", String(lim));
        if (statusRef.current) url.searchParams.set("status", statusRef.current);
        if (searchRef.current) url.searchParams.set("search", searchRef.current);

        const res = await fetch(url.toString());
        if (!res.ok) return;
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        if (data.pagination) {
          setTotal(data.pagination.total);
          setTotalPages(data.pagination.totalPages);
        }
      } catch (err) {
        console.error("Fetch campaigns error:", err);
      } finally {
        if (!silent) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchCampaigns(1, limit);
  }, [statusFilter, limit, fetchCampaigns]);

  // Auto-pulse SENT counts and statuses every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCampaigns(pageRef.current, limitRef.current, true);
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchCampaigns]);

  async function handleStart(id: string) {
    if (!confirm("Start sending this campaign to its audience?")) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Failed to start campaign");
      fetchCampaigns(page, limit);
    } catch (e) {
      alert("Error starting campaign");
    }
  }

  async function handlePause(id: string) {
    try {
      await fetch(`/api/campaigns/${id}/pause`, { method: "POST" });
      fetchCampaigns(page, limit);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleResume(id: string) {
    try {
      await fetch(`/api/campaigns/${id}/resume`, { method: "POST" });
      fetchCampaigns(page, limit);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this campaign? This cannot be undone.")) return;
    try {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      fetchCampaigns(page, limit);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRelaunch(id: string, name: string) {
    if (
      !confirm(
        `Re-launch "${name}"?\n\nThis will clone the campaign into a new instance, refresh the audience, and start sending immediately.`
      )
    ) {
      return;
    }

    try {
      setRelaunchingId(id);
      const res = await fetch(`/api/campaigns/${id}/relaunch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoStart: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to re-launch campaign");
        setRelaunchingId(null);
        return;
      }
      router.push(`/campaigns/${data.campaign.id}`);
    } catch {
      alert("Error re-launching campaign");
      setRelaunchingId(null);
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchCampaigns(newPage, limit);
  };

  const handlePageSizeChange = (newSize: number) => {
    setLimit(newSize);
    setPage(1);
    fetchCampaigns(1, newSize);
  };

  const hasActiveCampaign = campaigns.some(
    (c) => c.status === "sending" || c.status === "queued"
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Campaigns</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                hasActiveCampaign
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-muted/60 text-muted-foreground border-border"
              }`}
              title="Automatically polling progress counts every 2 seconds"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasActiveCampaign ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"
                }`}
              />
              Auto-updating (2s)
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Dispatch high-volume broadcast emails across your audience segments via AWS SES SMTP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCampaigns(page, limit)}
            disabled={refreshing}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </button>

          <Link
            href="/campaigns/create"
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Campaign</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                fetchCampaigns(1, limit);
              }
            }}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="queued">Queued</option>
          <option value="sending">Sending</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Campaigns Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border">
              <tr>
                <th className="p-4">Campaign Name</th>
                <th className="p-4">Status</th>
                <th className="p-4">Sent Accepted Progress</th>
                <th className="p-4">Engagement (Opens/Clicks)</th>
                <th className="p-4">Created Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">
                    Loading campaigns...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">
                    No campaigns found. Click &quot;Create Campaign&quot; to begin.
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => {
                  const deliveryRate =
                    camp.totalRecipients > 0 ? (camp.sentCount / camp.totalRecipients) * 100 : 0;
                  const openRate = camp.sentCount > 0 ? (camp.uniqueOpensCount / camp.sentCount) * 100 : 0;
                  const clickRate = camp.sentCount > 0 ? (camp.uniqueClicksCount / camp.sentCount) * 100 : 0;

                  return (
                    <tr key={camp.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <Link
                          href={`/campaigns/${camp.id}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors block"
                        >
                          {camp.name}
                        </Link>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {camp.subject}
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize inline-flex items-center gap-1.5 ${
                            camp.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                              : camp.status === "sending"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200"
                              : camp.status === "paused"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {camp.status === "sending" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          )}
                          {camp.status}
                        </span>
                      </td>

                      <td className="p-4 min-w-[200px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {camp.sentCount.toLocaleString()}
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              of {camp.totalRecipients.toLocaleString()} ({Math.round(deliveryRate)}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${Math.min(100, deliveryRate)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="text-xs">
                          <span className="font-semibold text-foreground">
                            {camp.uniqueOpensCount.toLocaleString()}
                          </span>
                          <span className="text-muted-foreground"> ({openRate.toFixed(1)}% opens)</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {camp.uniqueClicksCount.toLocaleString()}
                          </span>{" "}
                          clicks ({clickRate.toFixed(1)}%)
                        </div>
                      </td>

                      <td className="p-4 text-xs text-muted-foreground">
                        {new Date(camp.createdAt).toLocaleDateString()}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {camp.status === "draft" && (
                            <button
                              onClick={() => handleStart(camp.id)}
                              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                              title="Start Campaign"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {camp.status === "sending" && (
                            <button
                              onClick={() => handlePause(camp.id)}
                              className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white transition-all"
                              title="Pause Sending"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}

                          {camp.status === "paused" && (
                            <button
                              onClick={() => handleResume(camp.id)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all"
                              title="Resume Sending"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {(camp.status === "completed" || camp.status === "cancelled" || camp.status === "failed") && (
                            <button
                              onClick={() => handleRelaunch(camp.id, camp.name)}
                              disabled={relaunchingId === camp.id}
                              className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-50"
                              title="Re-launch Campaign"
                            >
                              <RotateCcw className={`w-4 h-4 ${relaunchingId === camp.id ? "animate-spin" : ""}`} />
                            </button>
                          )}

                          <Link
                            href={`/campaigns/${camp.id}`}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                            title="Inspect Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleDelete(camp.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            title="Delete Campaign"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[5, 10, 20, 50]}
          itemName="campaigns"
        />
      </div>
    </div>
  );
}
