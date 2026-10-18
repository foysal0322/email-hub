"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Server,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Lock,
  Database,
  Terminal,
} from "lucide-react";

interface SmtpTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  details?: Record<string, unknown>;
}

export default function SettingsPage() {
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpRegion, setSmtpRegion] = useState("us-east-1");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [appBaseUrl, setAppBaseUrl] = useState("http://localhost:3000");
  const [maxSendRate, setMaxSendRate] = useState(14);
  const [maxSoftBounces, setMaxSoftBounces] = useState(3);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SmtpTestResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          const s = data.settings;
          setSmtpHost(s.smtpHost || "");
          setSmtpPort(s.smtpPort || 587);
          setSmtpUsername(s.smtpUsername || "");
          setSmtpPassword(s.smtpPassword || "");
          setSmtpRegion(s.smtpRegion || "us-east-1");
          setFromName(s.defaultFromName || "");
          setFromEmail(s.defaultFromEmail || "");
          setReplyTo(s.defaultReplyTo || "");
          setAppBaseUrl(s.appBaseUrl || "http://localhost:3000");
          setMaxSendRate(s.maxSendRate || 14);
          setMaxSoftBounces(s.maxSoftBounces || 3);
          setTrackOpens(s.trackOpens ?? true);
          setTrackClicks(s.trackClicks ?? true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost,
          smtpPort,
          smtpUsername,
          smtpPassword,
          smtpRegion,
          defaultFromName: fromName,
          defaultFromEmail: fromEmail,
          defaultReplyTo: replyTo,
          appBaseUrl,
          maxSendRate,
          maxSoftBounces,
          trackOpens,
          trackClicks,
        }),
      });

      if (!res.ok) throw new Error("Failed to update settings");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSmtp() {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/settings/smtp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          username: smtpUsername,
          password: smtpPassword,
          fromName,
          fromEmail,
        }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: (err as Error).message || "Connection failed",
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">System Settings & SMTP Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure AWS SES credentials, rate limits, deliverability thresholds, and verify live SMTP socket connectivity.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* AWS SES SMTP Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">AWS SES SMTP Transport</h2>
            </div>
            <button
              type="button"
              onClick={handleTestSmtp}
              disabled={testing || !smtpHost || !smtpUsername}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
              <span>{testing ? "Testing Handshake..." : "Test SMTP Connection"}</span>
            </button>
          </div>

          {/* Test Result Alert */}
          {testResult && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-semibold block">{testResult.message}</span>
                {testResult.details && (
                  <pre className="text-[10px] font-mono opacity-80 overflow-x-auto">
                    {JSON.stringify(testResult.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1">AWS SES / Mail-Manager SMTP Host</label>
              <input
                type="text"
                required
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Port (STARTTLS)</label>
              <input
                type="number"
                required
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">SMTP Username</label>
              <input
                type="text"
                required
                value={smtpUsername}
                onChange={(e) => setSmtpUsername(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">SMTP Password</label>
              <input
                type="password"
                required
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">AWS Region</label>
              <input
                type="text"
                value={smtpRegion}
                onChange={(e) => setSmtpRegion(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Sender Defaults & Deliverability Rules */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-foreground border-b border-border pb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span>Default Sender Identity & Deliverability Policies</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Default Sender Name</label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Default From Email (Verified in SES)</label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Default Reply-To Email</label>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Application Base URL (Tracking & Unsub)</label>
              <input
                type="url"
                value={appBaseUrl}
                onChange={(e) => setAppBaseUrl(e.target.value)}
                placeholder="https://emailhub.yourdomain.com"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {appBaseUrl.includes("localhost") || appBaseUrl.includes("127.0.0.1")
                  ? "⚠️ Running on localhost: Click tracking and tracking redirects are safely bypassed so recipients receive real, unmodified links instead of broken localhost URLs. Enter a public URL (e.g. your domain or ngrok tunnel) when ready for tracking."
                  : "Links in outgoing emails will be routed through this public domain for click analytics."}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Global Max Send Rate (Emails / Sec)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxSendRate}
                onChange={(e) => setMaxSendRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Consecutive Soft Bounces Before Auto-Suppress</label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxSoftBounces}
                onChange={(e) => setMaxSoftBounces(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between">
          {saveSuccess ? (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Settings successfully persisted to database</span>
            </span>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving Changes..." : "Save Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
