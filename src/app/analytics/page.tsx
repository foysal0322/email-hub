"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Eye,
  MousePointerClick,
  ShieldAlert,
  Percent,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const k = stats?.kpis;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Advanced Analytics & Deliverability</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Historical engagement ratios, ISP acceptance rates, CTOR benchmarks, and link CTR analytics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs font-semibold bg-card border border-border rounded-lg px-3 py-2 text-foreground"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Deliverability Benchmark Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Deliverability Efficiency
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold">
              Target: &gt;98%
            </span>
          </div>
          <div className="text-3xl font-bold text-foreground">{k?.deliveryRate ?? 0}%</div>
          <p className="text-xs text-muted-foreground">
            {k?.totalDelivered ?? 0} confirmed delivered out of {k?.totalAttempted ?? 0} attempted transmissions.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              AWS SES Bounce Threshold
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-bold ${
                (k?.bounceRate ?? 0) > 5
                  ? "bg-rose-500/10 text-rose-600"
                  : "bg-blue-500/10 text-blue-600"
              }`}
            >
              Safety: &lt;5%
            </span>
          </div>
          <div className="text-3xl font-bold text-foreground">{k?.bounceRate ?? 0}%</div>
          <p className="text-xs text-muted-foreground">
            {k?.totalBounces ?? 0} total bounces ({k?.hardBounces ?? 0} permanent hard bounces automatically suppressed).
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Click-To-Open (CTOR)
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 font-bold">
              Benchmark: &gt;10%
            </span>
          </div>
          <div className="text-3xl font-bold text-foreground">{k?.ctor ?? 0}%</div>
          <p className="text-xs text-muted-foreground">
            Measures content resonance: {k?.uniqueClicks ?? 0} unique clicks from {k?.uniqueOpens ?? 0} unique readers.
          </p>
        </div>
      </div>

      {/* Engagement Volume Chart */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-foreground">Outbound Deliveries & Opens Breakdown</h3>
        <div className="h-80 w-full">
          {stats?.timeline && stats.timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.timeline}>
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
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="sent" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Attempted Sends" />
                <Bar dataKey="opens" fill="#6366f1" radius={[4, 4, 0, 0]} name="Unique Opens" />
                <Bar dataKey="clicks" fill="#10b981" radius={[4, 4, 0, 0]} name="Link Clicks" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No sending activity in this window.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
