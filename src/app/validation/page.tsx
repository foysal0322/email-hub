"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Search,
  Server,
  ShieldCheck,
  RefreshCw,
  Mail,
  Zap,
} from "lucide-react";

interface ValidationResult {
  email: string;
  normalizedEmail: string;
  syntaxValid: boolean;
  domainExists: boolean;
  hasMxRecords: boolean;
  isDisposable: boolean;
  isRoleBased: boolean;
  mxHost?: string;
  status: string;
  details: string;
}

export default function ValidationPage() {
  const [testEmail, setTestEmail] = useState("");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  // Batch Validation State
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProcessed, setBatchProcessed] = useState<number | null>(null);

  async function handleSingleValidate(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail) return;

    setValidating(true);
    setResult(null);

    try {
      const res = await fetch("/api/contacts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      });

      const data = await res.json();
      setResult(data.result);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setValidating(false);
    }
  }

  async function handleBatchValidate() {
    setBatchRunning(true);
    setBatchProcessed(null);

    try {
      const res = await fetch("/api/contacts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validateAll: true }),
      });

      const data = await res.json();
      setBatchProcessed(data.processed || 0);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setBatchRunning(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Validation Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Perform multi-layer deliverability checks: syntax validation, DNS MX resolution, disposable domain detection, and role-based filtering.
        </p>
      </div>

      {/* Interactive Single Email Tester */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <span>Interactive Address Diagnostics</span>
        </h2>

        <form onSubmit={handleSingleValidate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="e.g. user@gmail.com, admin@tempmail.com"
            className="flex-1 px-4 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={validating || !testEmail}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-lg hover:bg-primary/90 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${validating ? "animate-spin" : ""}`} />
            <span>{validating ? "Resolving DNS..." : "Validate Address"}</span>
          </button>
        </form>

        {/* Results Card */}
        {result && (
          <div className="mt-4 pt-4 border-t border-border space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Validation Outcome</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  result.status === "domain_valid"
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : result.status === "disposable"
                    ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                    : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                }`}
              >
                {result.status.replace("_", " ")}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">{result.details}</p>

            {/* Check Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-[11px] text-muted-foreground block">RFC 5322 Syntax</span>
                <span className="text-sm font-bold text-foreground">
                  {result.syntaxValid ? "Valid Format" : "Malformed"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-[11px] text-muted-foreground block">MX DNS Records</span>
                <span className="text-sm font-bold text-foreground">
                  {result.hasMxRecords ? "Found (Active)" : "None"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-[11px] text-muted-foreground block">Disposable Blocklist</span>
                <span className="text-sm font-bold text-foreground">
                  {result.isDisposable ? "Disposable (High Risk)" : "Clean"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-[11px] text-muted-foreground block">Role-Based Alias</span>
                <span className="text-sm font-bold text-foreground">
                  {result.isRoleBased ? "Role Prefix (admin/support)" : "Personal Mailbox"}
                </span>
              </div>
            </div>

            {result.mxHost && (
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-500/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Server className="w-4 h-4 flex-shrink-0" />
                <span>Primary Mail Exchange Exchange: <strong>{result.mxHost}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Batch Database Validation Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <span>Batch Directory Validation</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scan through existing contacts in your database with unknown validation status and query their MX records.
            </p>
          </div>
          <button
            type="button"
            disabled={batchRunning}
            onClick={handleBatchValidate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white font-semibold text-xs rounded-lg hover:bg-amber-700 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${batchRunning ? "animate-spin" : ""}`} />
            <span>{batchRunning ? "Validating Batch..." : "Run Batch Check"}</span>
          </button>
        </div>

        {batchProcessed !== null && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Successfully updated validation status for <strong>{batchProcessed}</strong> contacts in your database.</span>
          </div>
        )}
      </div>
    </div>
  );
}
