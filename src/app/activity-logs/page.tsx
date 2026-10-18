"use client";

import { useEffect, useState } from "react";
import { History, Shield, Send, RefreshCw, Terminal } from "lucide-react";

export default function ActivityLogsPage() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [emailEvents, setEmailEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"events" | "audit">("events");

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/activity-logs?limit=50");
      const data = await res.json();
      setAuditLogs(data.auditLogs || []);
      setEmailEvents(data.emailEvents || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Activity & Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time telemetry of AWS SES events, open/click activity, and administrative compliance audit trails.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("events")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "events"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Email Delivery & Engagement Events ({emailEvents.length})
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "audit"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Administrative Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Events Table */}
      {activeTab === "events" && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Recipient / Subject</th>
                  <th className="p-3">Campaign</th>
                  <th className="p-3">Provider ID / Payload</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {emailEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No email events logged yet.
                    </td>
                  </tr>
                ) : (
                  emailEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            evt.eventType === "send" || evt.eventType === "delivery"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : evt.eventType === "open"
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                              : evt.eventType === "click"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {evt.eventType}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className="font-semibold text-foreground block">
                          {evt.message?.recipientEmail || "—"}
                        </span>
                        <span className="text-muted-foreground truncate block max-w-xs">
                          {evt.message?.subject || ""}
                        </span>
                      </td>

                      <td className="p-3 text-muted-foreground">{evt.campaign?.name || "Single Dispatch"}</td>

                      <td className="p-3 text-muted-foreground font-mono max-w-xs truncate" title={evt.providerMessageId || evt.payload || ""}>
                        {evt.providerMessageId || evt.payload || "—"}
                      </td>

                      <td className="p-3 text-muted-foreground">{new Date(evt.timestamp).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Logs Table */}
      {activeTab === "audit" && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Action</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Resource</th>
                  <th className="p-3">Details</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No administrative audit entries logged yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold text-foreground">{log.action}</td>
                      <td className="p-3 text-muted-foreground">{log.user?.email || "System"}</td>
                      <td className="p-3 text-muted-foreground capitalize">{log.resourceType}</td>
                      <td className="p-3 text-muted-foreground font-mono max-w-md truncate" title={log.details || ""}>
                        {log.details || "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
