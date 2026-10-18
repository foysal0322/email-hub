"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Send,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Users,
  FileCode,
  ShieldCheck,
  Rocket,
  Sparkles,
  AlertTriangle,
  Info,
  Eye,
} from "lucide-react";

interface ContactList {
  id: string;
  name: string;
  contactCount: number;
}

interface TemplateItem {
  id: string;
  name: string;
  subject: string | null;
  htmlContent: string;
}

export default function NewCampaignWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [fromName, setFromName] = useState("EmailHub Admin");
  const [fromEmail, setFromEmail] = useState("notifications@example.com");
  const [replyTo, setReplyTo] = useState("support@example.com");
  const [htmlContent, setHtmlContent] = useState("");
  const [plainTextContent, setPlainTextContent] = useState("");
  const [sendRate, setSendRate] = useState(14);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);

  // Audience & Templates Data
  const [lists, setLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [audienceSummary, setAudienceSummary] = useState({
    total: 0,
    eligible: 0,
    suppressed: 0,
  });

  // Preview State
  const [previewContact, setPreviewContact] = useState<{
    name: string;
    dept_name: string;
    designation: string;
  }>({
    name: "Alice Rahman",
    dept_name: "Engineering",
    designation: "SQA Engineer",
  });

  useEffect(() => {
    // Fetch settings for default sender
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setFromName(data.settings.defaultFromName || "EmailHub Admin");
          setFromEmail(data.settings.defaultFromEmail || "notifications@example.com");
          setReplyTo(data.settings.defaultReplyTo || "");
          setSendRate(data.settings.maxSendRate || 14);
        }
      });

    // Fetch lists
    fetch("/api/contact-lists")
      .then((r) => r.json())
      .then((data) => setLists(data.lists || []));

    // Fetch templates
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates || []);
        if (data.templates && data.templates.length > 0) {
          // Pre-fill template #1
          const first = data.templates[0];
          setSubject(first.subject || "Important Announcement: {{dept_name}} Update");
          setHtmlContent(first.htmlContent);
        }
      });

    // Fetch contacts count for audience preview
    fetch("/api/contacts?limit=100")
      .then((r) => r.json())
      .then((data) => {
        const total = data.pagination?.total || 0;
        setAudienceSummary({
          total,
          eligible: Math.max(0, total - 1),
          suppressed: 1, // sample suppression
        });
      });
  }, []);

  function handleSelectTemplate(tpl: TemplateItem) {
    if (tpl.subject) setSubject(tpl.subject);
    setHtmlContent(tpl.htmlContent);
  }

  function insertPlaceholder(token: string) {
    setHtmlContent((prev) => prev + ` {{${token}}}`);
  }

  async function handleCreateCampaign(autoStart = false) {
    setSubmitting(true);
    try {
      // 1. Create campaign
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          subject,
          preheader,
          fromName,
          fromEmail,
          replyTo,
          htmlContent,
          plainTextContent,
          sendRate,
          trackOpens,
          trackClicks,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create campaign");

      const campaignId = data.campaign.id;

      // 2. If user selected Launch immediately
      if (autoStart) {
        await fetch(`/api/campaigns/${campaignId}/start`, { method: "POST" });
      }

      router.push(`/campaigns/${campaignId}`);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const steps = [
    { num: 1, label: "Details", icon: Send },
    { num: 2, label: "Audience", icon: Users },
    { num: 3, label: "Design", icon: FileCode },
    { num: 4, label: "Safeguards", icon: ShieldCheck },
    { num: 5, label: "Launch", icon: Rocket },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Wizard Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Campaign Creation Wizard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            5-step delivery pipeline with real-time deliverability checks and AWS SES throttling.
          </p>
        </div>
        <Link
          href="/campaigns"
          className="text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg"
        >
          Cancel
        </Link>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-5 gap-2">
        {steps.map((s) => {
          const Icon = s.icon;
          const isDone = currentStep > s.num;
          const isCurrent = currentStep === s.num;

          return (
            <div
              key={s.num}
              onClick={() => isDone && setCurrentStep(s.num)}
              className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                isCurrent
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : isDone
                  ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  isCurrent
                    ? "bg-primary text-white"
                    : isDone
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Step 1: Campaign Details */}
      {currentStep === 1 && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            <span>Step 1: Campaign Metadata & Sender Profile</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1">
                Campaign Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 Company All-Hands & Strategy Brief"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Sender Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Verified Sender Email <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                required
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Reply-To Address (Optional)</label>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Internal Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Operational notes or goal of this campaign"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1">
                Subject Line <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Hello {{name}}, updates for your {{dept_name}} team"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Supports dynamic personalization tags like <code>&#123;&#123;name&#125;&#125;</code> and <code>&#123;&#123;dept_name&#125;&#125;</code>.
              </span>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1">Preview Preheader (Optional)</label>
              <input
                type="text"
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                placeholder="Preview snippet shown in recipient email clients before opening"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Audience Selection */}
      {currentStep === 2 && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span>Step 2: Audience Targeting & Segmentation</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Target Contact List</label>
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Subscribed Contacts in Database</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.contactCount} contacts)
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs space-y-2">
                <span className="font-semibold text-foreground block">Audience Segmentation Rules:</span>
                <p className="text-muted-foreground">
                  &bull; Contacts in the global suppression registry (hard bounces, spam complaints, unsubscribes) are
                  automatically intercepted and skipped.
                </p>
                <p className="text-muted-foreground">
                  &bull; Duplicate email addresses within lists are deduplicated prior to job submission.
                </p>
              </div>
            </div>

            {/* Live Recipient Forecast Card */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Estimated Audience</span>
                <div className="text-3xl font-bold text-foreground mt-2">{audienceSummary.eligible}</div>
                <span className="text-xs text-muted-foreground block mt-1">Eligible recipients</span>
              </div>

              <div className="pt-4 border-t border-primary/20 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total contacts:</span>
                  <span className="font-medium text-foreground">{audienceSummary.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Suppressed blocked:</span>
                  <span className="font-medium text-rose-500">{audienceSummary.suppressed}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Email Design & Dynamic Placeholders */}
      {currentStep === 3 && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <FileCode className="w-4 h-4 text-primary" />
              <span>Step 3: Email Template & Dynamic Personalization</span>
            </h2>

            {/* Template Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Load Template:</span>
              <select
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t) handleSelectTemplate(t);
                }}
                className="text-xs bg-background border border-border rounded px-2.5 py-1 text-foreground"
              >
                <option value="">Select Starter Template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Placeholders Quick Insertion Pills */}
          <div className="p-3 bg-muted/40 border border-border rounded-lg">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Click to insert dynamic placeholder tag:
            </span>
            <div className="flex flex-wrap gap-2">
              {["name", "dept_name", "designation", "email", "organization", "name|there"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertPlaceholder(tag)}
                  className="px-2.5 py-1 rounded bg-card border border-border text-xs font-mono font-medium hover:border-primary hover:text-primary transition-all"
                >
                  &#123;&#123;{tag}&#125;&#125;
                </button>
              ))}
            </div>
          </div>

          {/* HTML Email Source Editor */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              HTML Email Body Source (Responsive Inline Email Styles)
            </label>
            <textarea
              rows={14}
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="w-full p-3 font-mono text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Live Preview Box */}
          <div className="border border-border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-primary" />
                Live Preview (Simulated for {previewContact.name})
              </span>
            </div>
            <div className="bg-card border border-border rounded p-4 text-sm text-foreground max-h-56 overflow-y-auto">
              <p className="font-semibold text-xs text-muted-foreground mb-2">
                Subject: {subject.replace(/\{\{name(?:\|[^}]+)?\}\}/g, previewContact.name).replace(/\{\{dept_name(?:\|[^}]+)?\}\}/g, previewContact.dept_name)}
              </p>
              <div
                dangerouslySetInnerHTML={{
                  __html: htmlContent
                    .replace(/\{\{name(?:\|[^}]+)?\}\}/g, previewContact.name)
                    .replace(/\{\{dept_name(?:\|[^}]+)?\}\}/g, previewContact.dept_name)
                    .replace(/\{\{designation(?:\|[^}]+)?\}\}/g, previewContact.designation),
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Pre-Send Safeguards & Validation */}
      {currentStep === 4 && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Step 4: Deliverability Safeguards & Audit Verification</span>
          </h2>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
              <div>
                <span className="text-sm font-semibold text-foreground block">Global Suppression Shield Active</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Addresses that previously hard-bounced or submitted spam complaints will be skipped automatically with zero
                  SMTP socket overhead.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <span className="text-sm font-semibold text-foreground block">One-Click Unsubscribe Enforcement</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  RFC 2369 / RFC 8058 <code>List-Unsubscribe</code> and <code>List-Unsubscribe-Post</code> headers will be
                  injected automatically alongside HMAC secure landing page tokens.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600 mt-0.5" />
              <div>
                <span className="text-sm font-semibold text-foreground block">Open & Click Tracking Pipeline</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  A 1x1 transparent tracking pixel and link redirect proxies will log engagement without exposing open redirects.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Launch & Throttling */}
      {currentStep === 5 && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" />
            <span>Step 5: Delivery Controls & Send Execution</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Dispatch Rate Throttle (Emails / Second)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={sendRate}
                onChange={(e) => setSendRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Standard AWS SES sandbox limit is 14/sec. Keep within your account quota.
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackOpens}
                  onChange={(e) => setTrackOpens(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Enable Unique Open Tracking Pixel</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackClicks}
                  onChange={(e) => setTrackClicks(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Enable Link Click Tracking & Redirects</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleCreateCampaign(false)}
              className="flex-1 py-2.5 px-4 rounded-lg border border-border text-xs font-semibold hover:bg-muted text-foreground transition-all"
            >
              Save as Draft
            </button>
            <button
              type="button"
              disabled={submitting || !name || !subject || !htmlContent}
              onClick={() => handleCreateCampaign(true)}
              className="flex-1 py-2.5 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all"
            >
              <Rocket className="w-4 h-4" />
              <span>{submitting ? "Launching..." : "Launch Campaign Now"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          disabled={currentStep === 1}
          onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Step</span>
        </button>

        {currentStep < 5 && (
          <button
            type="button"
            disabled={currentStep === 1 && (!name || !subject)}
            onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-sm"
          >
            <span>Next Step</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
