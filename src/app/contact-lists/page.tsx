"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderTree, Plus, Trash2, Users, ArrowRight, X } from "lucide-react";

interface ContactList {
  id: string;
  name: string;
  description: string | null;
  contactCount: number;
  createdAt: string;
}

export default function ContactListsPage() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchLists();
  }, []);

  async function fetchLists() {
    setLoading(true);
    try {
      const res = await fetch("/api/contact-lists");
      const data = await res.json();
      setLists(data.lists || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/contact-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error("Failed to create list");
      setShowAddModal(false);
      setName("");
      setDescription("");
      fetchLists();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this contact list? Contacts inside will remain in the directory.")) return;
    try {
      await fetch(`/api/contact-lists?id=${id}`, { method: "DELETE" });
      fetchLists();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contact Lists</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Segment your contacts into targetable static groups for targeted campaigns.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create New List</span>
        </button>
      </div>

      {/* Lists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            Loading contact lists...
          </div>
        ) : lists.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No contact lists defined yet.
          </div>
        ) : (
          lists.map((l) => (
            <div
              key={l.id}
              className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <FolderTree className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">{l.name}</h3>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-muted font-semibold text-foreground">
                    {l.contactCount} contacts
                  </span>
                </div>
                <p className="text-xs text-muted-foreground min-h-[36px]">
                  {l.description || "No description provided."}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                <Link
                  href={`/contacts?listId=${l.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <span>View Members</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => handleDelete(l.id)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-all"
                  title="Delete List"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add List Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Create Contact List</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateList} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">List Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VIP Enterprise Clients"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Internal description of this audience segment"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground"
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
                  Save List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
