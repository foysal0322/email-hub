"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Users,
  Plus,
  Upload,
  Download,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Filter,
  X,
  RefreshCw,
} from "lucide-react";
import Pagination from "@/components/Pagination";

interface Contact {
  id: string;
  email: string;
  fullName: string | null;
  department: string | null;
  organization: string | null;
  jobTitle: string | null;
  status: string;
  validationStatus: string;
  bounceCount: number;
  customAttributes: string | null;
  createdAt: string;
}

function ContactsContent() {
  const searchParams = useSearchParams();
  const listIdParam = searchParams.get("listId") || "";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [listId, setListId] = useState(listIdParam);
  const [showAddModal, setShowAddModal] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // New Contact Form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const fetchContacts = useCallback(
    async (p = page, lim = limit) => {
      setLoading(true);
      try {
        const url = new URL("/api/contacts", window.location.origin);
        url.searchParams.set("page", String(p));
        url.searchParams.set("limit", String(lim));
        if (search) url.searchParams.set("search", search);
        if (statusFilter) url.searchParams.set("status", statusFilter);
        if (departmentFilter) url.searchParams.set("department", departmentFilter);
        if (listId) url.searchParams.set("listId", listId);

        const res = await fetch(url.toString());
        const data = await res.json();
        setContacts(data.contacts || []);
        if (data.pagination) {
          setTotal(data.pagination.total);
          setTotalPages(data.pagination.totalPages);
        }
      } catch (e) {
        console.error("fetchContacts error:", e);
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, departmentFilter, listId, page, limit]
  );

  useEffect(() => {
    setListId(listIdParam);
  }, [listIdParam]);

  useEffect(() => {
    fetchContacts(page, limit);
  }, [page, limit, statusFilter, departmentFilter, listId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchContacts(1, limit);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setLimit(newSize);
    setPage(1);
  };

  async function handleCreateContact(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          fullName: newName,
          department: newDept,
          organization: newOrg,
          jobTitle: newTitle,
          customAttributes: { dept_name: newDept, designation: newTitle },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create contact");

      setShowAddModal(false);
      setNewEmail("");
      setNewName("");
      setNewDept("");
      setNewOrg("");
      setNewTitle("");
      fetchContacts(1, limit);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      await fetch(`/api/contacts?id=${id}`, { method: "DELETE" });
      fetchContacts(page, limit);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contact Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage subscriber records, custom metadata fields, and email deliverability health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchContacts(page, limit)}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <a
            href="/api/contacts/export"
            download
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
          <Link
            href="/contacts/import"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted shadow-sm transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Contacts</span>
          </Link>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by email, name, organization, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="bounced">Bounced</option>
          <option value="complained">Complained</option>
        </select>

        {listId && (
          <button
            type="button"
            onClick={() => {
              setListId("");
              setPage(1);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
          >
            <span>Filtered by List</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="submit"
          className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-lg hover:bg-secondary/80 w-full sm:w-auto"
        >
          Search
        </button>
      </form>

      {/* Contacts Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border">
              <tr>
                <th className="p-4">Contact</th>
                <th className="p-4">Department &amp; Title</th>
                <th className="p-4">Organization</th>
                <th className="p-4">Status</th>
                <th className="p-4">Deliverability Health</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground text-sm">
                    Loading contacts directory...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground text-sm">
                    No contacts found matching criteria.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-foreground">{c.fullName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    </td>

                    <td className="p-4">
                      <div className="text-xs font-medium text-foreground">{c.department || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{c.jobTitle || "—"}</div>
                    </td>

                    <td className="p-4 text-xs text-foreground font-medium">
                      {c.organization || "—"}
                    </td>

                    <td className="p-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize ${
                          c.status === "active"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                            : c.status === "unsubscribed"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize ${
                          c.validationStatus === "valid"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : c.validationStatus === "risky"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.validationStatus}
                      </span>
                    </td>

                    <td className="p-4 text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Delete Contact"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[25, 50, 100, 200]}
          itemName="contacts"
        />
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Add New Contact</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Email Address <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Alice Rahman"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Department</label>
                  <input
                    type="text"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    placeholder="Engineering"
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Designation / Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="SQA Engineer"
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Organization / Company</label>
                <input
                  type="text"
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  placeholder="TechCorp Global"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading contacts...</div>}>
      <ContactsContent />
    </Suspense>
  );
}
