"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  Database,
  RefreshCw,
  FolderTree,
} from "lucide-react";

interface ImportSummary {
  totalRows: number;
  importedRows: number;
  failedRows: number;
  duplicateCount: number;
}

interface RowError {
  rowNumber: number;
  rawRecord: string;
  errorMessage: string;
}

export default function ContactsImportPage() {
  const [fileContent, setFileContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileType, setFileType] = useState<"csv" | "json">("csv");
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "overwrite">("skip");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errors, setErrors] = useState<RowError[]>([]);

  useEffect(() => {
    fetch("/api/contact-lists")
      .then((r) => r.json())
      .then((data) => setLists(data.lists || []));
  }, []);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileType(file.name.endsWith(".json") ? "json" : "csv");

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
    };
    reader.readAsText(file);
  }

  function loadSampleData(type: "csv" | "json") {
    if (type === "csv") {
      setFileType("csv");
      setFileName("sample_employees.csv");
      setFileContent(
        `email,name,dept_name,designation\nalice@example.com,Alice Rahman,Engineering,SQA Engineer\nbob@example.com,Bob Hasan,Marketing,Executive\ncarol@example.com,Carol Danvers,Product,Product Manager\ninvalid-email-here,David Kim,Finance,Analyst`
      );
    } else {
      setFileType("json");
      setFileName("sample_employees.json");
      setFileContent(
        JSON.stringify(
          [
            {
              email: "elena@example.com",
              name: "Elena Rostova",
              dept_name: "Operations",
              designation: "Operations Director",
            },
            {
              email: "frank@example.com",
              name: "Frank Castle",
              dept_name: "Security",
              designation: "Security Specialist",
            },
            {
              email: "bad_format_address",
              name: "Malformed User",
              dept_name: "Unknown",
              designation: "Intern",
            },
          ],
          null,
          2
        )
      );
    }
  }

  async function handleImport() {
    if (!fileContent) {
      alert("Please upload a file or paste CSV/JSON content");
      return;
    }

    setSubmitting(true);
    setSummary(null);
    setErrors([]);

    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: fileContent,
          fileType,
          filename: fileName || "manual_input",
          duplicateStrategy,
          listId: selectedListId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process import");

      setSummary(data.summary);
      setErrors(data.errors || []);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Import Contacts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ingest CSV or JSON files with automated column detection, deduplication handling, and row-level error reporting.
        </p>
      </div>

      {/* Main Upload Box */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-border pb-4">
          <span className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            <span>Select File or Choose Preset</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadSampleData("csv")}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-all"
            >
              Load Sample CSV
            </button>
            <button
              type="button"
              onClick={() => loadSampleData("json")}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-all"
            >
              Load Sample JSON
            </button>
          </div>
        </div>

        {/* Drag and Drop Area */}
        <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center transition-all">
          <input
            type="file"
            accept=".csv, .json, text/csv, application/json"
            onChange={handleFileUpload}
            className="hidden"
            id="fileInput"
          />
          <label htmlFor="fileInput" className="cursor-pointer space-y-2 block">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-semibold text-primary hover:underline">Click to upload</span> or drag and drop
            </div>
            <p className="text-xs text-muted-foreground">Supported formats: CSV or JSON (up to 25MB)</p>
            {fileName && (
              <span className="inline-block mt-2 px-3 py-1 bg-muted rounded-full text-xs font-mono font-medium text-foreground">
                Selected: {fileName}
              </span>
            )}
          </label>
        </div>

        {/* Configuration Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Duplicate Email Strategy</label>
            <select
              value={duplicateStrategy}
              onChange={(e) => setDuplicateStrategy(e.target.value as "skip" | "overwrite")}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="skip">Skip duplicates (Keep existing record)</option>
              <option value="overwrite">Overwrite existing contact with new data</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Add to Contact List (Optional)</label>
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Do not assign to a list</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Preview Box */}
        {fileContent && (
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Raw Data Content Preview</label>
            <textarea
              rows={6}
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              className="w-full p-3 font-mono text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        <button
          type="button"
          disabled={submitting || !fileContent}
          onClick={handleImport}
          className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:bg-primary/90 shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          <span>{submitting ? "Processing Import..." : "Execute Contact Ingestion"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Import Outcome Summary */}
      {summary && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <h3 className="text-base font-semibold">Import Ingestion Completed</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-muted/40 rounded-lg">
              <span className="text-xs text-muted-foreground">Total Rows Parsed</span>
              <div className="text-xl font-bold text-foreground mt-1">{summary.totalRows}</div>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-lg">
              <span className="text-xs text-emerald-600 font-medium">Successfully Ingested</span>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                {summary.importedRows}
              </div>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <span className="text-xs text-blue-600 font-medium">Duplicates Detected</span>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-400 mt-1">
                {summary.duplicateCount}
              </div>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-lg">
              <span className="text-xs text-rose-600 font-medium">Failed / Invalid Rows</span>
              <div className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1">
                {summary.failedRows}
              </div>
            </div>
          </div>

          {/* Row-Level Errors Table */}
          {errors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider block mb-2">
                Row-Level Issues Excluded from Ingestion:
              </span>
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Row #</th>
                      <th className="p-2">Error Reason</th>
                      <th className="p-2">Raw Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {errors.map((err, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="p-2 font-mono font-semibold">{err.rowNumber}</td>
                        <td className="p-2 text-rose-500 font-medium">{err.errorMessage}</td>
                        <td className="p-2 text-muted-foreground font-mono truncate max-w-xs">{err.rawRecord}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Link
              href="/contacts"
              className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
            >
              <span>View Contacts Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
