"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";

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
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchCampaigns();
  }, [statusFilter]);

  async function fetchCampaigns() {
    setLoading(true);
    try {
      const url = new URL("/api/campaigns", window.location.origin);
      if (statusFilter) url.searchParams.set("status", statusFilter);
      if (search) url.searchParams.set("search", search);

      const res = await fetch(url.toString());
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error("Fetch campaigns error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(id: string) {
    if (!confirm("Start sending this campaign to its audience?")) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Failed to start campaign");
      fetchCampaigns();
    } catch (e) {
      alert("Error starting campaign");
    }
  }

  async function handlePause(id: string) {
    try {
      await fetch(`/api/campaigns/${id}/pause`, { method: "POST" });
      fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleResume(id: string) {
    try {
      await fetch(`/api/campaigns/${id}/resume`, { method: "POST" });
      fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this campaign? This cannot be undone.")) return;
    try {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage, schedule, and inspect multi-recipient campaigns with automated delivery protection.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Campaign</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search campaigns by name or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchCampaigns()}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                <th className="p-4">Recipients</th>
                <th className="p-4">Delivery Rate</th>
                <th className="p-4">Engagement</th>
                <th className="p-4">Created</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading campaigns...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <p className="text-base font-medium">No campaigns found.</p>
                    <p className="text-xs mt-1">Get started by building your first automated email campaign.</p>
                    <Link
                      href="/campaigns/new"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create New Campaign
                    </Link>
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => {
                  const deliveryRate =
                    camp.sentCount > 0 ? ((camp.deliveredCount || camp.sentCount) / camp.sentCount) * 100 : 0;
                  const openRate =
                    camp.sentCount > 0 ? (camp.uniqueOpensCount / camp.sentCount) * 100 : 0;
                  const clickRate =
                    camp.sentCount > 0 ? (camp.uniqueClicksCount / camp.sentCount) * 100 : 0;

                  return (
                    <tr key={camp.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <Link
                          href={`/campaigns/${camp.id}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors block"
                        >
                          {camp.name}
                        </Link>
                        <span className="text-xs text-muted-foreground block truncate max-w-xs">
                          {camp.subject}
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            camp.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : camp.status === "sending"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              : camp.status === "paused"
                              ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              camp.status === "sending"
                                ? "bg-amber-500 animate-ping"
                                : camp.status === "completed"
                                ? "bg-emerald-500"
                                : "bg-slate-400"
                            }`}
                          />
                          <span className="capitalize">{camp.status}</span>
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="font-semibold text-foreground">{camp.sentCount}</span>
                        <span className="text-muted-foreground text-xs"> / {camp.totalRecipients}</span>
                        {camp.skippedCount > 0 && (
                          <span className="block text-[11px] text-rose-500">
                            {camp.skippedCount} suppressed
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{deliveryRate.toFixed(1)}%</span>
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${Math.min(100, deliveryRate)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="text-xs">
                          <span className="font-semibold text-foreground">{camp.uniqueOpensCount}</span>
                          <span className="text-muted-foreground"> ({openRate.toFixed(1)}% opens)</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">{camp.uniqueClicksCount}</span> clicks (
                          {clickRate.toFixed(1)}%)
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
      </div>
    </div>
  );
}
