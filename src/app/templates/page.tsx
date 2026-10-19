"use client";

import { useEffect, useState } from "react";
import {
  FileCode,
  Plus,
  Trash2,
  Copy,
  Eye,
  X,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import Pagination from "@/components/Pagination";

interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  subject: string | null;
  preheader: string | null;
  htmlContent: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(6);
  const [categoryFilter, setCategoryFilter] = useState("");

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("newsletter");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [htmlContent, setHtmlContent] = useState(
    `<div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; margin: auto;">\n  <h2>Hello {{name|there}},</h2>\n  <p>Update for {{dept_name}}.</p>\n</div>`
  );

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          subject,
          preheader,
          htmlContent,
        }),
      });

      if (!res.ok) throw new Error("Failed to create template");
      setShowAddModal(false);
      setName("");
      setSubject("");
      fetchTemplates();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this email template?")) return;
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      fetchTemplates();
    } catch (e) {
      console.error(e);
    }
  }

  const filteredTemplates = categoryFilter
    ? templates.filter((t) => t.category.toLowerCase() === categoryFilter.toLowerCase())
    : templates;

  const total = filteredTemplates.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginatedTemplates = filteredTemplates.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reusable responsive layouts for announcements, newsletters, transactional notifications, and marketing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTemplates}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh Templates"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Template</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="text-xs font-semibold bg-card border border-border rounded-lg px-3 py-2 text-foreground"
        >
          <option value="">All Categories ({templates.length})</option>
          <option value="newsletter">Newsletter</option>
          <option value="transactional">Transactional</option>
          <option value="marketing">Marketing</option>
          <option value="announcement">Announcement</option>
        </select>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            Loading templates...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No email templates found. Create one now.
          </div>
        ) : (
          paginatedTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {tpl.category}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(tpl.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground">{tpl.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  Subject: <span className="text-foreground">{tpl.subject || "No default subject"}</span>
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                <button
                  onClick={() => setPreviewTemplate(tpl)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleDelete(tpl.id)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-all"
                  title="Delete Template"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {total > 0 && (
        <div className="rounded-xl overflow-hidden border border-border">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setLimit(newSize);
              setPage(1);
            }}
            pageSizeOptions={[3, 6, 9, 18]}
            itemName="templates"
          />
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-3xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">{previewTemplate.name}</h3>
                <span className="text-xs text-muted-foreground capitalize">
                  {previewTemplate.category} Template
                </span>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-background border border-border rounded-lg p-4 max-h-[60vh] overflow-y-auto">
              <div
                className="prose dark:prose-invert max-w-none text-xs"
                dangerouslySetInnerHTML={{ __html: previewTemplate.htmlContent }}
              />
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 text-xs font-semibold bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Template Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Create New Email Template</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Template Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Monthly Product Digest"
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
                  >
                    <option value="newsletter">Newsletter</option>
                    <option value="transactional">Transactional</option>
                    <option value="marketing">Marketing</option>
                    <option value="announcement">Announcement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Default Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Important updates for {{name}}"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">HTML Content Template</label>
                <textarea
                  rows={8}
                  required
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
