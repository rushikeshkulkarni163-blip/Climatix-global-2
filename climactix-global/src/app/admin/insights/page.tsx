"use client";

import { useEffect, useState } from "react";

interface ContentItem {
  id: string;
  type: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function InsightsAdminPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch("/api/admin/content?type=insight", { credentials: "include" });
      const d = await r.json();
      setItems(d.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveEdit() {
    if (!editing) return;
    const r = await fetch("/api/admin/content", {
      method: editing.id.startsWith("new_") ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(editing.id.startsWith("new_") ? editing : { ...editing }),
    });
    if (r.ok) {
      setEditing(null);
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function togglePublish(item: ContentItem) {
    await fetch("/api/admin/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: item.id, published: !item.published }),
    });
    await load();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this insight?")) return;
    await fetch(`/api/admin/content?id=${id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  function addNew() {
    setEditing({
      id: `new_${Date.now()}`,
      type: "insight",
      title: "",
      body: "",
      category: "",
      tags: [],
      published: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">CONTENT MANAGEMENT</p>
          <h1 className="text-2xl font-bold text-white">Insights Editor</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage featured insights — persisted to <code className="text-[#3B82F6]">data/content.json</code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-[#10B981] text-xs font-bold uppercase tracking-wider">✓ Saved</span>}
          <button onClick={addNew} className="bg-white text-black px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors">
            + New Insight
          </button>
        </div>
      </div>

      <div className="space-y-px">
        {loading ? (
          <div className="text-gray-500 text-xs py-8 text-center">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-gray-500 text-xs py-8 text-center">No insights yet — click + New Insight</div>
        ) : items.map((item) => (
          <div key={item.id} className="border border-[#1F1F1F] bg-[#0A0A0A] hover:bg-[#0D0D0D] transition-colors p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{item.category}</span>
                  <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 ${item.published ? "bg-[#10B981]/10 text-[#10B981]" : "bg-gray-800 text-gray-500"}`}>
                    {item.published ? "PUBLISHED" : "DRAFT"}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1 truncate">{item.title || "Untitled"}</h3>
                <p className="text-[10px] text-gray-500 line-clamp-2">{item.body}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => togglePublish(item)} className="text-[9px] font-bold uppercase tracking-wider text-gray-500 hover:text-white transition-colors">
                  {item.published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => setEditing({ ...item })} className="text-[9px] font-bold uppercase tracking-wider text-[#3B82F6] hover:text-white transition-colors">
                  Edit
                </button>
                <button onClick={() => deleteItem(item.id)} className="text-[9px] font-bold uppercase tracking-wider text-[#EF4444] hover:text-white transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-[#0A0A0A] border border-[#2A2A2A] w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-white">{editing.id.startsWith("new_") ? "New Insight" : "Edit Insight"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-5">
              <Field label="Title">
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full bg-black border border-[#2A2A2A] text-white text-sm px-3 py-2.5 focus:outline-none focus:border-[#3B82F6]" />
              </Field>
              <Field label="Category">
                <input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Physical Risk / Transition Risk / ESG Governance…" className="w-full bg-black border border-[#2A2A2A] text-white text-sm px-3 py-2.5 focus:outline-none focus:border-[#3B82F6]" />
              </Field>
              <Field label="Body">
                <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={5} className="w-full bg-black border border-[#2A2A2A] text-white text-sm px-3 py-2.5 focus:outline-none focus:border-[#3B82F6] resize-none" />
              </Field>
              <Field label="Tags (comma-separated)">
                <input value={editing.tags.join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} className="w-full bg-black border border-[#2A2A2A] text-white text-sm px-3 py-2.5 focus:outline-none focus:border-[#3B82F6]" />
              </Field>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} className="w-4 h-4" />
                <span className="text-xs text-gray-300">Published (visible on site)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveEdit} className="flex-1 bg-white text-black text-xs font-bold uppercase tracking-widest py-2.5 hover:bg-gray-100 transition-colors">
                Save
              </button>
              <button onClick={() => setEditing(null)} className="px-6 border border-[#2A2A2A] text-gray-400 text-xs font-bold uppercase tracking-widest py-2.5 hover:border-[#444] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
