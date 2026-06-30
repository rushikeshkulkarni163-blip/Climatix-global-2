"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/store";
import { DASHBOARD_NAV_ITEMS } from "./Sidebar";

export default function CommandPalette() {
  const open = useDashboardStore((s) => s.commandPaletteOpen);
  const setOpen = useDashboardStore((s) => s.setCommandPaletteOpen);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DASHBOARD_NAV_ITEMS;
    return DASHBOARD_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      navigate(results[activeIndex].href);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh]">
          <motion.div
            className="absolute inset-0 bg-ds-text/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-lg overflow-hidden rounded-lg border border-ds-border bg-white"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-2.5 border-b border-ds-border px-4 py-3">
              <Search size={16} className="text-ds-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a module…"
                aria-label="Search modules"
                className="flex-1 bg-transparent font-ds-body text-[14px] text-ds-text outline-none placeholder:text-ds-muted"
              />
              <kbd className="rounded border border-ds-border px-1.5 py-0.5 font-ds-body text-[10px] text-ds-muted">
                Esc
              </kbd>
            </div>
            <ul role="listbox" className="max-h-80 overflow-y-auto p-1.5">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center font-ds-body text-[13px] text-ds-muted">
                  No modules match &ldquo;{query}&rdquo;.
                </li>
              )}
              {results.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <button
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => navigate(item.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left font-ds-body text-[14px]",
                        i === activeIndex ? "bg-ds-accent-bg text-ds-accent" : "text-ds-text"
                      )}
                    >
                      <Icon size={15} />
                      <span className="flex-1">{item.label}</span>
                      {i === activeIndex && <CornerDownLeft size={13} className="text-ds-muted" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
