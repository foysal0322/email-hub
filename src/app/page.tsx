"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Send,
  MailCheck,
  CheckCircle,
  AlertOctagon,
  Eye,
  MousePointerClick,
  ShieldBan,
  TrendingUp,
  Percent,
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  RefreshCw,
  Plus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DashboardStats {
  kpis: {
    totalAttempted: number;
    totalAccepted: number;
    totalDelivered: number;
    totalFailed: number;
    totalSkipped: number;
    hardBounces: number;
    softBounces: number;
    totalBounces: number;
    complaints: number;
    totalSuppressed: number;
    uniqueOpens: number;
    totalOpens: number;
    uniqueClicks: number;
    totalClicks: number;
    deliveryRate: number;
    bounceRate: number;
    openRate: number;
    ctr: number;
    ctor: number;
    unsubscribeRate: number;
  };
  timeline: Array<{
    date: string;
    sent: number;
    delivered: number;
    opens: number;
    clicks: number;
    bounces: number;
  }>;
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    sentCount: number;
    deliveredCount: number;
    uniqueOpensCount: number;
    uniqueClicksCount: number;
    bouncedCount: number;
    createdAt: string;
  }>;
  recentErrors: Array<{
    id: string;
    email: string;
    status: string;
    lastError: string;
    skipReason: string;
    createdAt: string;
    campaign?: { name: string };
  }>;
  topLinks: Array<{
    id: string;
    targetUrl: string;
    clickCount: number;
    firstClickedAt: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchStats();
  }, [days]);

  async function fetchStats() {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/stats?days=${days}`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  const k = stats?.kpis;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Delivery & Campaign Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time delivery statistics, engagement metrics, and suppression enforcement powered by AWS SES.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs font-medium bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Launch Campaign</span>
          </Link>
        </div>
      </div>

      {/* Top Deliverability & Engagement Rates */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Delivery Rate</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-foreground">{k?.deliveryRate ?? 0}%</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
              &gt;98% Target
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Delivered / Attempted</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Bounce Rate</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-foreground">{k?.bounceRate ?? 0}%</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              (k?.bounceRate ?? 0) > 5 ? "bg-rose-500/10 text-rose-600" : "bg-blue-500/10 text-blue-600"
            }`}>
              SES Limit &lt;5%
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Hard & Soft Bounces</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Open Rate</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-foreground">{k?.openRate ?? 0}%</span>
            <Eye className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Unique Opens / Delivered</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">CTR (Click-Through)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-foreground">{k?.ctr ?? 0}%</span>
            <MousePointerClick className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Unique Clicks / Delivered</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">CTOR (Click-to-Open)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-foreground">{k?.ctor ?? 0}%</span>
            <Percent className="w-4 h-4 text-purple-500" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Unique Clicks / Unique Opens</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Unsubscribe Rate</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-foreground">{k?.unsubscribeRate ?? 0}%</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 font-semibold">
              &lt;0.5% Target
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Opt-outs / Delivered</span>
        </div>
      </div>

      {/* Comprehensive Raw Volume Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card/70 border border-border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Emails Attempted</div>
          <div className="text-lg font-bold text-foreground mt-1">{k?.totalAttempted ?? 0}</div>
        </div>
        <div className="bg-card/70 border border-border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Accepted by SES</div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{k?.totalAccepted ?? 0}</div>
        </div>
        <div className="bg-card/70 border border-border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Delivered Confirmed</div>
          <div className="text-lg font-bold text-foreground mt-1">{k?.totalDelivered ?? 0}</div>
        </div>
        <div className="bg-card/70 border border-border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Unique Opens (Total)</div>
          <div className="text-lg font-bold text-foreground mt-1">
            {k?.uniqueOpens ?? 0} <span className="text-xs text-muted-foreground font-normal">({k?.totalOpens ?? 0})</span>
          </div>
        </div>
        <div className="bg-card/70 border border-border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Unique Clicks (Total)</div>
          <div className="text-lg font-bold text-foreground mt-1">
            {k?.uniqueClicks ?? 0} <span className="text-xs text-muted-foreground font-normal">({k?.totalClicks ?? 0})</span>
          </div>
        </div>
        <div className="bg-card/70 border border-border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Suppressed Blocked</div>
          <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">{k?.totalSuppressed ?? 0}</div>
        </div>
      </div>

      {/* Analytics Timeline Chart */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">Delivery & Engagement Timeline</h3>
            <p className="text-xs text-muted-foreground">Sent volume, confirmed deliveries, opens, and link clicks</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>Sent</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Delivered</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              <span>Opens</span>
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          {stats?.timeline && stats.timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.timeline}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOpens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSent)" />
                <Area type="monotone" dataKey="opens" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorOpens)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No sending activity recorded in this time range.
            </div>
          )}
        </div>
      </div>

      {/* Split Section: Recent Campaigns & High-Impact Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Campaigns */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-foreground">Recent Campaigns</h3>
            <Link href="/campaigns" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-border">
            {stats?.recentCampaigns && stats.recentCampaigns.length > 0 ? (
              stats.recentCampaigns.map((camp) => (
                <div key={camp.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link href={`/campaigns/${camp.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {camp.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{camp.sentCount} sent</span>
                      <span>&bull;</span>
                      <span>{camp.uniqueOpensCount} opens</span>
                      <span>&bull;</span>
                      <span>{camp.uniqueClicksCount} clicks</span>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                      camp.status === "completed"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : camp.status === "sending"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {camp.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No campaigns executed yet.{" "}
                <Link href="/campaigns/new" className="text-primary hover:underline">
                  Create your first campaign.
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Top Tracked Links */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-foreground">Top-Performing Links</h3>
            <span className="text-xs text-muted-foreground">Click engagement</span>
          </div>

          <div className="divide-y divide-border">
            {stats?.topLinks && stats.topLinks.length > 0 ? (
              stats.topLinks.map((link) => (
                <div key={link.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate" title={link.targetUrl}>
                      {link.targetUrl}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      First clicked: {new Date(link.firstClickedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-foreground">{link.clickCount}</span>
                    <span className="text-xs text-muted-foreground block">clicks</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Tracked email links will populate here once clicks occur.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Delivery Errors & Diagnostics Log */}
      {stats?.recentErrors && stats.recentErrors.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-base font-semibold text-foreground">Recent Delivery Errors & Intercepts</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Recipient</th>
                  <th className="p-2.5">Campaign</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Reason / Error Detail</th>
                  <th className="p-2.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.recentErrors.map((err) => (
                  <tr key={err.id} className="hover:bg-muted/30">
                    <td className="p-2.5 font-medium text-foreground">{err.email}</td>
                    <td className="p-2.5 text-muted-foreground">{err.campaign?.name || "Single Send"}</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        {err.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-muted-foreground max-w-md truncate" title={err.lastError || err.skipReason}>
                      {err.lastError || err.skipReason}
                    </td>
                    <td className="p-2.5 text-muted-foreground">{new Date(err.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
