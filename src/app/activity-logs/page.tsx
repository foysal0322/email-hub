"use client";

import { useEffect, useState, useCallback } from "react";
import { History, Shield, Send, RefreshCw, Terminal } from "lucide-react";
import Pagination from "@/components/Pagination";

export default function ActivityLogsPage() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [emailEvents, setEmailEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"events" | "audit">("events");

  // Pagination for Events
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsLimit, setEventsLimit] = useState(25);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalEventsPages, setTotalEventsPages] = useState(1);

  // Pagination for Audit
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit, setAuditLimit] = useState(25);
  const [totalAudit, setTotalAudit] = useState(0);
  const [totalAuditPages, setTotalAuditPages] = useState(1);

  const fetchLogs = useCallback(
    async (tab = activeTab) => {
      setLoading(true);
      try {
        const page = tab === "events" ? eventsPage : auditPage;
        const limit = tab === "events" ? eventsLimit : auditLimit;
        const res = await fetch(`/api/activity-logs?tab=${tab}&page=${page}&limit=${limit}`);
        const data = await res.json();
        if (data.emailEvents) setEmailEvents(data.emailEvents);
        if (data.auditLogs) setAuditLogs(data.auditLogs);
        if (data.pagination) {
          if (data.pagination.totalEvents !== undefined) {
            setTotalEvents(data.pagination.totalEvents);
            setTotalEventsPages(data.pagination.totalEventsPages);
          }
          if (data.pagination.totalAudit !== undefined) {
            setTotalAudit(data.pagination.totalAudit);
            setTotalAuditPages(data.pagination.totalAuditPages);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, eventsPage, eventsLimit, auditPage, auditLimit]
  );

  useEffect(() => {
    fetchLogs(activeTab);
  }, [activeTab, eventsPage, eventsLimit, auditPage, auditLimit, fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Activity &amp; Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time telemetry of AWS SES events, open/click activity, and administrative compliance audit trails.
          </p>
        </div>
        <button
          onClick={() => fetchLogs(activeTab)}
          disabled={loading}
          className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Refresh Logs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
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
          Email Delivery &amp; Engagement Events ({totalEvents.toLocaleString()})
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "audit"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Administrative Audit Logs ({totalAudit.toLocaleString()})
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
                {loading && emailEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Loading event logs...
                    </td>
                  </tr>
                ) : emailEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No email events logged yet.
                    </td>
                  </tr>
                ) : (
                  emailEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-muted/20 transition-colors">
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

                      <td
                        className="p-3 text-muted-foreground font-mono max-w-xs truncate"
                        title={evt.providerMessageId || evt.payload || ""}
                      >
                        {evt.providerMessageId || evt.payload || "—"}
                      </td>

                      <td className="p-3 text-muted-foreground">{new Date(evt.timestamp).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={eventsPage}
            totalPages={totalEventsPages}
            totalItems={totalEvents}
            pageSize={eventsLimit}
            onPageChange={setEventsPage}
            onPageSizeChange={(newSize) => {
              setEventsLimit(newSize);
              setEventsPage(1);
            }}
            pageSizeOptions={[15, 25, 50, 100]}
            itemName="events"
          />
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
                {loading && auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No administrative audit entries logged yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-semibold text-foreground">{log.action}</td>
                      <td className="p-3 text-muted-foreground">{log.user?.email || "System"}</td>
                      <td className="p-3 text-muted-foreground capitalize">{log.resourceType}</td>
                      <td
                        className="p-3 text-muted-foreground font-mono max-w-md truncate"
                        title={log.details || ""}
                      >
                        {log.details || "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={auditPage}
            totalPages={totalAuditPages}
            totalItems={totalAudit}
            pageSize={auditLimit}
            onPageChange={setAuditPage}
            onPageSizeChange={(newSize) => {
              setAuditLimit(newSize);
              setAuditPage(1);
            }}
            pageSizeOptions={[15, 25, 50, 100]}
            itemName="audit entries"
          />
        </div>
      )}
    </div>
  );
}
