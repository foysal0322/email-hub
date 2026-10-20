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
  AlertTriangle,
  X,
  RefreshCw,
  CheckSquare,
  Square,
  ShieldAlert,
  GraduationCap,
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

function getStudentId(customAttributes: string | null): string | null {
  if (!customAttributes) return null;
  try {
    const parsed = JSON.parse(customAttributes);
    return parsed.id ? String(parsed.id) : null;
  } catch {
    return null;
  }
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

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Permanent Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetContact, setTargetContact] = useState<Contact | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [purgeSuppression, setPurgeSuppression] = useState(true);
  const [deletionReason, setDeletionReason] = useState("Administrative Cleanup");
  const [customReason, setCustomReason] = useState("");
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Notification Toast State
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // New Contact Form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

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
    // Clear selection when changing page or filters
    setSelectedIds([]);
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

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.length === contacts.length && contacts.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map((c) => c.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Open single delete modal
  const openSingleDeleteModal = (contact: Contact) => {
    setTargetContact(contact);
    setIsBulkDelete(false);
    setPurgeSuppression(true);
    setDeletionReason("Administrative Cleanup");
    setCustomReason("");
    setConfirmationInput("");
    setDeleteModalOpen(true);
  };

  // Open bulk delete modal
  const openBulkDeleteModal = () => {
    if (selectedIds.length === 0) return;
    setTargetContact(null);
    setIsBulkDelete(true);
    setPurgeSuppression(true);
    setDeletionReason("Administrative Cleanup");
    setCustomReason("");
    setConfirmationInput("");
    setDeleteModalOpen(true);
  };

  // Execute Permanent Deletion
  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      const finalReason = deletionReason === "Other" ? customReason || "Other administrative reason" : deletionReason;
      const idsToDelete = isBulkDelete ? selectedIds : [targetContact!.id];

      const res = await fetch("/api/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: idsToDelete,
          purgeSuppression,
          reason: finalReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to permanently delete student");
      }

      setDeleteModalOpen(false);
      setSelectedIds([]);
      showNotification(
        "success",
        isBulkDelete
          ? `Successfully permanently deleted ${data.deleted} student records from the system.`
          : `Student "${targetContact?.fullName || targetContact?.email}" was permanently erased from the system.`
      );
      fetchContacts(page, limit);
    } catch (err: unknown) {
      showNotification("error", (err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCreateContact(e: React.FormEvent) {
    e.preventDefault();
    try {
      const customAttrs: Record<string, string> = {
        dept_name: newDept,
        designation: newTitle,
      };
      if (newStudentId.trim()) {
        customAttrs.id = newStudentId.trim();
      }

      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          fullName: newName,
          department: newDept,
          organization: newOrg,
          jobTitle: newTitle,
          customAttributes: customAttrs,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create student/contact");

      setShowAddModal(false);
      setNewEmail("");
      setNewName("");
      setNewStudentId("");
      setNewDept("");
      setNewOrg("");
      setNewTitle("");
      showNotification("success", "Student / contact added successfully.");
      fetchContacts(1, limit);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  }

  const allSelected = contacts.length > 0 && selectedIds.length === contacts.length;
  const isPartiallySelected = selectedIds.length > 0 && selectedIds.length < contacts.length;

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border transition-all shadow-sm ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Student &amp; Contact Directory
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
              Admin Control
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage student records, NSU student IDs, department metadata, deliverability, and permanently purge records.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
            <span>Add Student / Contact</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl shadow-xs transition-all animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 text-sm font-medium">
            <span className="flex h-2 w-2 rounded-full bg-rose-600 animate-pulse"></span>
            <span>
              <strong>{selectedIds.length}</strong> {selectedIds.length === 1 ? "student" : "students"} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-slate-900/60 rounded-lg transition-colors border border-transparent"
            >
              Clear Selection
            </button>
            <button
              onClick={openBulkDeleteModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by student ID, name, email, department, organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto shadow-xs"
        >
          <option value="">All Statuses</option>
          <option value="subscribed">Subscribed / Active</option>
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <span>Filtered by List</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="submit"
          className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-lg hover:bg-secondary/80 w-full sm:w-auto transition-colors"
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
                <th className="p-4 w-10">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-muted-foreground hover:text-foreground focus:outline-none"
                    title={allSelected ? "Deselect All" : "Select All on Page"}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : isPartiallySelected ? (
                      <div className="w-4 h-4 rounded border-2 border-primary bg-primary/20 flex items-center justify-center">
                        <div className="w-2 h-0.5 bg-primary"></div>
                      </div>
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </th>
                <th className="p-4">Student / Contact</th>
                <th className="p-4">Department &amp; Title</th>
                <th className="p-4">Organization</th>
                <th className="p-4">Status</th>
                <th className="p-4">Deliverability Health</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4 text-center sticky right-0 bg-muted/95 backdrop-blur-xs z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] min-w-[100px]">
                  Delete
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground text-sm">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <span>Loading student directory...</span>
                    </div>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground text-sm">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-muted-foreground/50" />
                      <span>No students or contacts found matching criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                contacts.map((c) => {
                  const studentId = getStudentId(c.customAttributes);
                  const isSelected = selectedIds.includes(c.id);

                  return (
                    <tr
                      key={c.id}
                      className={`group transition-colors ${
                        isSelected
                          ? "bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/60 dark:hover:bg-rose-950/30"
                          : "hover:bg-muted/20"
                      }`}
                    >
                      {/* Checkbox column */}
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(c.id)}
                          className="focus:outline-none"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          )}
                        </button>
                      </td>

                      {/* Contact & Student ID */}
                      <td className="p-4">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{c.fullName || "—"}</span>
                          {studentId && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <GraduationCap className="w-3 h-3" />
                              ID: {studentId}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {c.email}
                        </div>
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
                            c.status === "subscribed" || c.status === "active"
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
                            c.validationStatus === "valid_format" || c.validationStatus === "domain_valid" || c.validationStatus === "valid"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : c.validationStatus === "disposable" || c.validationStatus === "invalid"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {c.validationStatus}
                        </span>
                      </td>

                      <td className="p-4 text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>

                      {/* Action buttons - Sticky right so it's always visible */}
                      <td
                        className={`p-4 text-center sticky right-0 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] min-w-[100px] ${
                          isSelected
                            ? "bg-rose-50 dark:bg-rose-950"
                            : "bg-card group-hover:bg-muted/30"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openSingleDeleteModal(c)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 shadow-sm shadow-red-600/20 transition-all cursor-pointer"
                          title="Delete Student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
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

      {/* Permanent Deletion Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-800">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">
                  {isBulkDelete
                    ? `Permanently Delete ${selectedIds.length} Students?`
                    : "Permanently Delete Student from System"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Administrative Permanent Removal &amp; Data Erasure
                </p>
              </div>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
                className="text-muted-foreground hover:text-foreground p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning Callout Box */}
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>IRREVERSIBLE ACTION</span>
              </div>
              <p className="leading-relaxed">
                This action will <strong>permanently purge</strong> the student record(s) from the database. All list memberships, tags, queued campaign messages, and custom metadata will be irrevocably deleted.
              </p>
            </div>

            {/* Target Information */}
            {!isBulkDelete && targetContact && (
              <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Student Name:</span>
                  <span className="font-bold text-foreground">{targetContact.fullName || "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Email Address:</span>
                  <span className="font-mono text-foreground font-semibold">{targetContact.email}</span>
                </div>
                {getStudentId(targetContact.customAttributes) && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Student ID:</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {getStudentId(targetContact.customAttributes)}
                    </span>
                  </div>
                )}
                {targetContact.department && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="text-foreground">{targetContact.department}</span>
                  </div>
                )}
              </div>
            )}

            {isBulkDelete && (
              <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-1 text-xs">
                <div className="text-muted-foreground">
                  You are about to permanently delete <strong>{selectedIds.length}</strong> selected student records.
                </div>
                <div className="text-[11px] text-muted-foreground">
                  All memberships and campaign recipients will be cleaned up automatically.
                </div>
              </div>
            )}

            {/* Options */}
            <div className="space-y-3 pt-1">
              {/* Suppression Purge Option */}
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={purgeSuppression}
                  onChange={(e) => setPurgeSuppression(e.target.checked)}
                  className="mt-0.5 rounded border-border text-rose-600 focus:ring-rose-500"
                />
                <span className="text-foreground leading-snug">
                  <strong>Purge from Suppression Registry:</strong> Remove matching email addresses from suppression/blacklist if present.
                </span>
              </label>

              {/* Administrative Reason */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Administrative Reason for Permanent Erasure:
                </label>
                <select
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="Administrative Cleanup">Administrative Cleanup / Testing</option>
                  <option value="Student Graduated / Disenrolled">Student Graduated / Disenrolled</option>
                  <option value="Student Data Erasure Request (FERPA / GDPR)">Student Data Erasure Request (FERPA / GDPR)</option>
                  <option value="Invalid / Obsolete Student Record">Invalid / Obsolete Student Record</option>
                  <option value="Other">Other (Specify below)</option>
                </select>
              </div>

              {deletionReason === "Other" && (
                <div>
                  <input
                    type="text"
                    placeholder="Enter reason for permanent deletion..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-xl hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl shadow-md shadow-red-600/25 active:scale-95 transition-all cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Add New Student / Contact</h3>
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
                  placeholder="e.g. student.name@northsouth.edu"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Al Soumo"
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Student ID (Optional)</label>
                  <input
                    type="text"
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    placeholder="e.g. 2423216"
                    className="w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Department</label>
                  <input
                    type="text"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    placeholder="e.g. ECE / Engineering"
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Designation / Batch</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Undergraduate Student"
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Organization / Institution</label>
                <input
                  type="text"
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  placeholder="e.g. North South University"
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
                  Save Record
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
