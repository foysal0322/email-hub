"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";

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
  uniqueOpensCount: number;
  totalOpensCount: number;
  uniqueClicksCount: number;
  totalClicksCount: number;
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
  const [loading, setLoading] = useState(true);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"recipients" | "preview">("recipients");

  useEffect(() => {
    fetchCampaign();
    fetchRecipients();

    // Auto-pulse status every 5 seconds if campaign is actively sending
    const interval = setInterval(() => {
      if (campaign?.status === "sending") {
        fetchCampaign();
        fetchRecipients();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [id, recipientFilter]);

  async function fetchCampaign() {
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      const data = await res.json();
      setCampaign(data.campaign);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecipients() {
    try {
      const url = new URL(`/api/campaigns/${id}/recipients`, window.location.origin);
      if (recipientFilter) url.searchParams.set("status", recipientFilter);
      if (recipientSearch) url.searchParams.set("search", recipientSearch);

      const res = await fetch(url.toString());
      const data = await res.json();
      setRecipients(data.recipients || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleStart() {
    try {
      await fetch(`/api/campaigns/${id}/start`, { method: "POST" });
      fetchCampaign();
      fetchRecipients();
    } catch (e) {
      console.error(e);
    }
  }

  async function handlePause() {
    try {
      await fetch(`/api/campaigns/${id}/pause`, { method: "POST" });
      fetchCampaign();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleResume() {
    try {
      await fetch(`/api/campaigns/${id}/resume`, { method: "POST" });
      fetchCampaign();
    } catch (e) {
      console.error(e);
    }
  }

  if (loading || !campaign) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Loading campaign details...
      </div>
    );
  }

  const deliveryRate =
    campaign.sentCount > 0 ? ((campaign.deliveredCount || campaign.sentCount) / campaign.sentCount) * 100 : 0;
  const openRate = campaign.sentCount > 0 ? (campaign.uniqueOpensCount / campaign.sentCount) * 100 : 0;
  const clickRate = campaign.sentCount > 0 ? (campaign.uniqueClicksCount / campaign.sentCount) * 100 : 0;

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{campaign.name}</h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize ${
                campaign.status === "completed"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                  : campaign.status === "sending"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {campaign.status}
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
              fetchRecipients();
            }}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
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
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Audience Size</span>
          <div className="text-2xl font-bold text-foreground mt-1">{campaign.totalRecipients}</div>
          <span className="text-[10px] text-muted-foreground">Snapshot freeze</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Sent Accepted</span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {campaign.sentCount}
          </div>
          <span className="text-[10px] text-muted-foreground">SES 250 OK</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Suppressed Skipped</span>
          <div className="text-2xl font-bold text-rose-500 mt-1">{campaign.skippedCount}</div>
          <span className="text-[10px] text-muted-foreground">Pre-send protection</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Unique Opens</span>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {campaign.uniqueOpensCount}
          </div>
          <span className="text-[10px] text-muted-foreground">{openRate.toFixed(1)}% open rate</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Unique Clicks</span>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {campaign.uniqueClicksCount}
          </div>
          <span className="text-[10px] text-muted-foreground">{clickRate.toFixed(1)}% click rate</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Bounces</span>
          <div className="text-2xl font-bold text-foreground mt-1">{campaign.bouncedCount}</div>
          <span className="text-[10px] text-muted-foreground">SES telemetry</span>
        </div>
      </div>

      {/* Tabs: Recipient Logs vs Content Preview */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("recipients")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "recipients"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Recipient-Level Logs ({recipients.length})
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "preview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Email Body Preview
        </button>
      </div>

      {/* Tab 1: Recipient Level Logs Table */}
      {activeTab === "recipients" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search recipients by email or name..."
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchRecipients()}
                className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground"
              />
            </div>
            <select
              value={recipientFilter}
              onChange={(e) => setRecipientFilter(e.target.value)}
              className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground"
            >
              <option value="">All Outcomes</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="skipped">Skipped (Suppressed)</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
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
                      <tr key={rec.id} className="hover:bg-muted/20">
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
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-muted text-muted-foreground"
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
                              <span className="text-indigo-600 font-medium">Opened</span>
                            ) : (
                              <span className="text-muted-foreground">Unopened</span>
                            )}
                            {rec.clickedAt && <span className="text-blue-600 font-medium">&bull; Clicked</span>}
                          </div>
                        </td>

                        <td className="p-3 text-muted-foreground max-w-sm truncate" title={rec.skipReason || rec.lastError || rec.providerMessageId || ""}>
                          {rec.skipReason ? (
                            <span className="text-rose-500 font-medium">{rec.skipReason}</span>
                          ) : rec.lastError ? (
                            <span className="text-destructive font-medium">{rec.lastError}</span>
                          ) : (
                            rec.providerMessageId || "Queued in background"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
