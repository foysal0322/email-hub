"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Send,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  Inbox,
  Check,
} from "lucide-react";
import Pagination from "@/components/Pagination";

interface CampaignDetails {
  id: string;
  name: string;
  description: string | null;
  subject: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  htmlContent: string;
  status: string;
  sendRate: number;
  trackOpens: boolean;
  trackClicks: boolean;
  totalRecipients: number;
  eligibleRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  skippedCount: number;
  bouncedCount: number;
  pendingCount?: number;
  uniqueOpensCount: number;
  totalOpensCount: number;
  uniqueClicksCount: number;
  totalClicksCount: number;
  countsByStatus?: Record<string, number>;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface RecipientLog {
  id: string;
  email: string;
  name: string | null;
  status: string;
  skipReason: string | null;
  lastError: string | null;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  providerMessageId: string | null;
}

export default function CampaignInspectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [recipients, setRecipients] = useState<RecipientLog[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRelaunching, setIsRelaunching] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"recipients" | "preview">("recipients");

  // Pagination State for Recipients
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Keep ref of status to avoid stale closure in auto-refresh interval
  const campaignStatusRef = useRef<string>("draft");
  const pageRef = useRef(page);
  const limitRef = useRef(limit);
  const filterRef = useRef(recipientFilter);
  const searchRef = useRef(recipientSearch);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);

  useEffect(() => {
    filterRef.current = recipientFilter;
  }, [recipientFilter]);

  useEffect(() => {
    searchRef.current = recipientSearch;
  }, [recipientSearch]);

  const fetchCampaign = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.campaign) {
        setCampaign(data.campaign);
        campaignStatusRef.current = data.campaign.status;
        if (data.campaign.countsByStatus) {
          setStatusCounts(data.campaign.countsByStatus);
        }
      }
    } catch (e) {
      console.error("fetchCampaign error:", e);
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [id]);

  const fetchRecipients = useCallback(
    async (p = pageRef.current, lim = limitRef.current, silent = false) => {
      try {
        const url = new URL(`/api/campaigns/${id}/recipients`, window.location.origin);
        url.searchParams.set("page", String(p));
        url.searchParams.set("limit", String(lim));
        if (filterRef.current) url.searchParams.set("status", filterRef.current);
        if (searchRef.current) url.searchParams.set("search", searchRef.current);

        const res = await fetch(url.toString());
        if (!res.ok) return;
        const data = await res.json();
        setRecipients(data.recipients || []);
        if (data.statusCounts) {
          setStatusCounts(data.statusCounts);
        }
        if (data.pagination) {
          setFilteredTotal(data.pagination.total);
          setTotalPages(data.pagination.totalPages);
        }
      } catch (e) {
        console.error("fetchRecipients error:", e);
      }
    },
    [id]
  );

  // Initial Load
  useEffect(() => {
    fetchCampaign(false);
    fetchRecipients(1, limit);
  }, [id, fetchCampaign, fetchRecipients, limit]);

  // Handle Search & Filter Changes
  useEffect(() => {
    setPage(1);
    fetchRecipients(1, limit);
  }, [recipientFilter, limit, fetchRecipients]);

  // Auto-pulse status and SENT ACCEPTED COUNT every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCampaign(true);

      // If campaign is actively sending or queued, also refresh the recipient table live
      if (campaignStatusRef.current === "sending" || campaignStatusRef.current === "queued") {
        fetchRecipients(pageRef.current, limitRef.current, true);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchCampaign, fetchRecipients]);

  async function handleStart() {
    try {
      await fetch(`/api/campaigns/${id}/start`, { method: "POST" });
      await fetchCampaign();
      await fetchRecipients(1, limit);
    } catch (e) {
      console.error(e);
    }
  }

  async function handlePause() {
    try {
      await fetch(`/api/campaigns/${id}/pause`, { method: "POST" });
      await fetchCampaign();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleResume() {
    try {
      await fetch(`/api/campaigns/${id}/resume`, { method: "POST" });
      await fetchCampaign();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRelaunch() {
    if (!campaign) return;
    if (
      !confirm(
        `Re-launch "${campaign.name}"?\n\nThis will clone this campaign into a new instance, refresh the audience from the list, and start sending immediately.`
      )
    ) {
      return;
    }

    try {
      setIsRelaunching(true);
      const res = await fetch(`/api/campaigns/${id}/relaunch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoStart: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to re-launch campaign");
        setIsRelaunching(false);
        return;
      }
      router.push(`/campaigns/${data.campaign.id}`);
    } catch (e) {
      console.error(e);
      alert("Error re-launching campaign");
      setIsRelaunching(false);
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchRecipients(newPage, limit);
  };

  const handlePageSizeChange = (newSize: number) => {
    setLimit(newSize);
    setPage(1);
    fetchRecipients(1, newSize);
  };

  if (loading || !campaign) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Loading campaign details...
      </div>
    );
  }

  // Live Accurate Metrics
  const totalAudience = campaign.totalRecipients || statusCounts.all || 0;
  const sentAccepted = campaign.sentCount;
  const skippedCount = campaign.skippedCount;
  const failedBounced = (campaign.failedCount || 0) + (campaign.bouncedCount || 0);
  const pendingInQueue =
    campaign.pendingCount !== undefined
      ? campaign.pendingCount
      : Math.max(0, totalAudience - sentAccepted - skippedCount - failedBounced);

  const deliveryRate = totalAudience > 0 ? (sentAccepted / totalAudience) * 100 : 0;
  const openRate = sentAccepted > 0 ? (campaign.uniqueOpensCount / sentAccepted) * 100 : 0;
  const clickRate = sentAccepted > 0 ? (campaign.uniqueClicksCount / sentAccepted) * 100 : 0;
  const isActivelySending = campaign.status === "sending" || campaign.status === "queued";

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Campaigns</span>
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{campaign.name}</h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize ${
                campaign.status === "completed"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                  : campaign.status === "sending"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200"
                  : campaign.status === "paused"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {campaign.status}
            </span>

            {/* Live Auto-Update Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                isActivelySending
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-muted/60 text-muted-foreground border-border"
              }`}
              title="Automatically polling counts every 2 seconds"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isActivelySending ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"
                }`}
              />
              Live auto-sync (2s)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Subject: <span className="text-foreground font-medium">{campaign.subject}</span> &bull; Sender:{" "}
            {campaign.fromName} &lt;{campaign.fromEmail}&gt;
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchCampaign();
              fetchRecipients(page, limit);
            }}
            disabled={refreshing}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh All Counts Now"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </button>

          {campaign.status === "draft" && (
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Launch Campaign</span>
            </button>
          )}

          {campaign.status === "sending" && (
            <button
              onClick={handlePause}
              className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-amber-600 shadow-sm"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Sending</span>
            </button>
          )}

          {campaign.status === "paused" && (
            <button
              onClick={handleResume}
              className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume Sending</span>
            </button>
          )}

          {(campaign.status === "completed" || campaign.status === "cancelled" || campaign.status === "failed") && (
            <button
              onClick={handleRelaunch}
              disabled={isRelaunching}
              className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50"
              title="Duplicate campaign into a new instance and start sending immediately"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRelaunching ? "animate-spin" : ""}`} />
              <span>{isRelaunching ? "Re-launching..." : "Re-launch Campaign"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Aggregate KPI Cards - ALL 7 COUNTS VERIFIED */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* 1. Audience Size */}
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Audience Size</span>
          <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">
            {totalAudience.toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Snapshot freeze</span>
        </div>

        {/* 2. Sent Accepted */}
        <div className="bg-card border border-emerald-500/30 rounded-xl p-3 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Sent Accepted
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" title="Live Counter" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {sentAccepted.toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">
            SES 250 OK &bull; Live
          </span>
        </div>

        {/* 3. Pending In Queue */}
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Pending Queue</span>
          <div
            className={`text-2xl font-bold mt-1 tabular-nums ${
              pendingInQueue > 0 ? "text-amber-500" : "text-muted-foreground"
            }`}
          >
            {pendingInQueue.toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {pendingInQueue > 0 ? "Awaiting dispatch" : "Queue exhausted"}
          </span>
        </div>

        {/* 4. Suppressed Skipped */}
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Suppressed</span>
          <div className="text-2xl font-bold text-rose-500 mt-1 tabular-nums">
            {skippedCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Pre-send protection</span>
        </div>

        {/* 5. Unique Opens */}
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Unique Opens</span>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
            {campaign.uniqueOpensCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">{openRate.toFixed(1)}% open rate</span>
        </div>

        {/* 6. Unique Clicks */}
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Unique Clicks</span>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
            {campaign.uniqueClicksCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">{clickRate.toFixed(1)}% click rate</span>
        </div>

        {/* 7. Failed / Bounced */}
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Failed / Bounced</span>
          <div className="text-2xl font-bold text-destructive mt-1 tabular-nums">
            {failedBounced.toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Hard/transient rejects</span>
        </div>
      </div>

      {/* Progress Bar & Queue Status */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
          <span className="font-semibold text-foreground">
            Progress: {sentAccepted.toLocaleString()} sent ({Math.round(deliveryRate)}%) &bull;{" "}
            {pendingInQueue.toLocaleString()} pending &bull; {skippedCount.toLocaleString()} skipped &bull;{" "}
            {failedBounced.toLocaleString()} failed
          </span>
          <span className="text-muted-foreground font-medium">
            {totalAudience > 0
              ? `${Math.round(((sentAccepted + skippedCount + failedBounced) / totalAudience) * 100)}% complete`
              : "0% complete"}
          </span>
        </div>
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{
              width: `${totalAudience > 0 ? (sentAccepted / totalAudience) * 100 : 0}%`,
            }}
            title={`Sent: ${sentAccepted}`}
          />
          <div
            className="h-full bg-rose-400 transition-all duration-500"
            style={{
              width: `${totalAudience > 0 ? (skippedCount / totalAudience) * 100 : 0}%`,
            }}
            title={`Skipped: ${skippedCount}`}
          />
          <div
            className="h-full bg-destructive transition-all duration-500"
            style={{
              width: `${totalAudience > 0 ? (failedBounced / totalAudience) * 100 : 0}%`,
            }}
            title={`Failed: ${failedBounced}`}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("recipients")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "recipients"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Recipient Dispatch Log ({totalAudience.toLocaleString()})
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "preview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Email Content Preview
        </button>
      </div>

      {/* Tab 1: Recipients List with Search, Filter & Pagination */}
      {activeTab === "recipients" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search recipients by email or name..."
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchRecipients(1, limit)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {recipientFilter && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Showing {filteredTotal.toLocaleString()} matching
                </span>
              )}
              <select
                value={recipientFilter}
                onChange={(e) => setRecipientFilter(e.target.value)}
                className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
              >
                <option value="">All Outcomes ({totalAudience.toLocaleString()})</option>
                <option value="pending">
                  Pending ({statusCounts.pending ? statusCounts.pending.toLocaleString() : pendingInQueue.toLocaleString()})
                </option>
                <option value="accepted">
                  Accepted ({statusCounts.accepted ? statusCounts.accepted.toLocaleString() : sentAccepted.toLocaleString()})
                </option>
                <option value="skipped">
                  Skipped ({statusCounts.skipped ? statusCounts.skipped.toLocaleString() : skippedCount.toLocaleString()})
                </option>
                <option value="delivered">
                  Delivered ({statusCounts.delivered ? statusCounts.delivered.toLocaleString() : (campaign.deliveredCount || 0).toLocaleString()})
                </option>
                <option value="failed">
                  Failed ({statusCounts.failed ? statusCounts.failed.toLocaleString() : (campaign.failedCount || 0).toLocaleString()})
                </option>
              </select>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                  <tr>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Sent At</th>
                    <th className="p-3">Engagement</th>
                    <th className="p-3">Provider Message ID / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recipients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">
                        No recipient records found for this filter.
                      </td>
                    </tr>
                  ) : (
                    recipients.map((rec) => (
                      <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <span className="font-semibold text-foreground block">{rec.email}</span>
                          <span className="text-[11px] text-muted-foreground">{rec.name || "—"}</span>
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              rec.status === "accepted" || rec.status === "delivered"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : rec.status === "skipped"
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                : rec.status === "processing"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 animate-pulse"
                                : rec.status === "pending"
                                ? "bg-muted text-muted-foreground"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>

                        <td className="p-3 text-muted-foreground">
                          {rec.sentAt ? new Date(rec.sentAt).toLocaleTimeString() : "—"}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {rec.openedAt ? (
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium">Opened</span>
                            ) : (
                              <span className="text-muted-foreground">Unopened</span>
                            )}
                            {rec.clickedAt && (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">&bull; Clicked</span>
                            )}
                          </div>
                        </td>

                        <td
                          className="p-3 text-muted-foreground max-w-sm truncate"
                          title={rec.skipReason || rec.lastError || rec.providerMessageId || ""}
                        >
                          {rec.skipReason ? (
                            <span className="text-rose-500 font-medium">{rec.skipReason}</span>
                          ) : rec.lastError ? (
                            <span className="text-destructive font-medium">{rec.lastError}</span>
                          ) : rec.providerMessageId ? (
                            rec.providerMessageId
                          ) : rec.status === "pending" ? (
                            <span className="text-muted-foreground">Queued in background</span>
                          ) : (
                            "—"
                          )}
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
              totalItems={filteredTotal}
              pageSize={limit}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={[15, 25, 50, 100]}
              itemName="recipients"
            />
          </div>
        </div>
      )}

      {/* Tab 2: Content Preview */}
      {activeTab === "preview" && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div
            className="prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: campaign.htmlContent }}
          />
        </div>
      )}
    </div>
  );
}
