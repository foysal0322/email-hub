"use client";

import { useEffect, useState } from "react";
import {
  Send,
  Mail,
  Users,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldAlert,
  ArrowRight,
  Eye,
} from "lucide-react";

interface SingleMessageHistory {
  id: string;
  recipientEmail: string;
  subject: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
}

interface ContactOption {
  id: string;
  email: string;
  fullName: string | null;
  department: string | null;
  jobTitle: string | null;
  status: string;
}

export default function SingleEmailPage() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Operational Notice: Updates for your department");
  const [fromName, setFromName] = useState("EmailHub Admin");
  const [fromEmail, setFromEmail] = useState("notifications@example.com");
  const [replyTo, setReplyTo] = useState("support@example.com");
  const [htmlContent, setHtmlContent] = useState(
    `<p>Hello {{name|there}},</p>\n<p>This is a direct operational notice regarding your department.</p>\n<p>Please review our latest updates: <a href="https://example.com/status">System Status</a></p>`
  );
  const [isTestSend, setIsTestSend] = useState(false);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);

  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "suppressed";
    message: string;
    details?: string;
  } | null>(null);

  const [history, setHistory] = useState<SingleMessageHistory[]>([]);

  useEffect(() => {
    // Load contacts for recipient selection
    fetch("/api/contacts?limit=50")
      .then((r) => r.json())
      .then((data) => setContacts(data.contacts || []));

    // Load settings for default from email
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setFromName(data.settings.defaultFromName || "EmailHub Admin");
          setFromEmail(data.settings.defaultFromEmail || "notifications@example.com");
          setReplyTo(data.settings.defaultReplyTo || "");
        }
      });

    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const res = await fetch("/api/single-email");
      const data = await res.json();
      setHistory(data.history || []);
    } catch (e) {
      console.error(e);
    }
  }

  function handleSelectContact(contactId: string) {
    setSelectedContactId(contactId);
    const found = contacts.find((c) => c.id === contactId);
    if (found) {
      setTo(found.email);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/single-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          htmlContent,
          fromName,
          fromEmail,
          replyTo,
          contactId: selectedContactId || undefined,
          isTestSend,
          trackOpens,
          trackClicks,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.suppressed) {
          setFeedback({
            type: "suppressed",
            message: data.error,
            details: `Category: ${data.category}`,
          });
        } else {
          setFeedback({
            type: "error",
            message: data.error || "Failed to dispatch email",
            details: data.code,
          });
        }
        return;
      }

      setFeedback({
        type: "success",
        message: `Message accepted by AWS SES SMTP (Message ID: ${data.messageId || "250 OK"})`,
      });

      fetchHistory();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: (err as Error).message || "Network error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Single Email Dispatch</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Transmit individual emails with full deliverability protection, pre-send suppression check, and engagement tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          {feedback && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  : feedback.type === "suppressed"
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : feedback.type === "suppressed" ? (
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-semibold block">{feedback.message}</span>
                {feedback.details && <span className="text-[11px] opacity-80 mt-0.5 block">{feedback.details}</span>}
              </div>
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-4">
            {/* Quick Contact Lookup */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Select Existing Contact (Optional Autocomplete)
              </label>
              <select
                value={selectedContactId}
                onChange={(e) => handleSelectContact(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
              >
                <option value="">Or enter custom email below...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName || c.email} ({c.email}) {c.department ? `— ${c.department}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Email */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Recipient Email Address <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Sender Name</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Sender Email</label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Subject Line <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Email HTML Body <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={8}
                required
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Tracking & Options */}
            <div className="flex flex-wrap gap-4 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackOpens}
                  onChange={(e) => setTrackOpens(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Open Tracking Pixel</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackClicks}
                  onChange={(e) => setTrackClicks(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Click Tracking Redirect</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isTestSend}
                  onChange={(e) => setIsTestSend(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Bypass Suppression (Test Send Only)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting || !to || !subject || !htmlContent}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:bg-primary/90 shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? "Transmitting via AWS SES..." : "Dispatch Single Email"}</span>
            </button>
          </form>
        </div>

        {/* Sidebar History Column */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Recent Single Sends</h3>
          </div>

          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {history.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No single email transmissions recorded yet.
              </div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground truncate max-w-[160px]">{h.recipientEmail}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold capitalize ${
                        h.status === "accepted" || h.status === "delivered"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {h.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate">{h.subject}</p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                    <span>{h.openedAt ? "Opened" : "Unopened"}</span>
                    <span>&bull;</span>
                    <span>{h.clickCount} clicks</span>
                    <span>&bull;</span>
                    <span>{h.sentAt ? new Date(h.sentAt).toLocaleTimeString() : "—"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
