"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Search,
  ChevronRight,
  Bell,
  CheckSquare,
  MessageSquare,
  Moon,
  Command,
  PanelRightOpen,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/store";
import { useToast } from "@/components/ds/Toast";

function useBreadcrumb() {
  const pathname = usePathname();
  return pathname
    .split("/")
    .filter(Boolean)
    .map((seg) => seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
}

interface TopNavProps {
  onOpenMobileNav: () => void;
  onOpenMobileInsights: () => void;
}

export default function TopNav({ onOpenMobileNav, onOpenMobileInsights }: TopNavProps) {
  const crumbs = useBreadcrumb();
  const setCommandPaletteOpen = useDashboardStore((s) => s.setCommandPaletteOpen);
  const { toast } = useToast();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setCommandPaletteOpen]);

  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-ds-border bg-white px-4">
      <button
        onClick={onOpenMobileNav}
        aria-label="Open navigation menu"
        className="rounded-md p-1.5 text-ds-text2 hover:bg-ds-surface xl:hidden"
      >
        <Menu size={18} />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Climactix Global" className="hidden h-6 w-auto xl:block" />

      <button
        onClick={() => setCommandPaletteOpen(true)}
        className={cn(
          "ml-1 flex h-8 w-44 items-center gap-2 rounded-lg border border-ds-border bg-ds-surface px-2.5",
          "font-ds-body text-[13px] text-ds-muted transition-colors duration-150 hover:border-ds-accent",
          "sm:w-56"
        )}
        aria-label="Open search and command palette"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden items-center gap-0.5 text-[10px] text-ds-muted sm:flex">
          <Command size={10} />K
        </kbd>
      </button>

      <nav aria-label="Breadcrumb" className="hidden flex-1 items-center gap-1.5 px-2 font-ds-body text-[13px] text-ds-muted md:flex">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} />}
            <span className={i === crumbs.length - 1 ? "font-medium text-ds-text" : ""}>{crumb}</span>
          </span>
        ))}
      </nav>
      <span className="flex-1 md:hidden" />

      <div className="flex items-center gap-1">
        <button
          onClick={() => toast({ title: "Dark mode", description: "Coming soon — visual preview only.", variant: "info" })}
          aria-label="Toggle dark mode"
          className="rounded-md p-2 text-ds-text2 hover:bg-ds-surface"
        >
          <Moon size={17} />
        </button>
        <button aria-label="Notifications" className="relative rounded-md p-2 text-ds-text2 hover:bg-ds-surface">
          <Bell size={17} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-ds-critical" />
        </button>
        <button aria-label="Tasks" className="rounded-md p-2 text-ds-text2 hover:bg-ds-surface">
          <CheckSquare size={17} />
        </button>
        <button aria-label="Messages" className="rounded-md p-2 text-ds-text2 hover:bg-ds-surface">
          <MessageSquare size={17} />
        </button>
        <button
          onClick={onOpenMobileInsights}
          aria-label="Open intelligence panel"
          className="rounded-md p-2 text-ds-text2 hover:bg-ds-surface xl:hidden"
        >
          <PanelRightOpen size={17} />
        </button>

        <div className="relative ml-1">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            className="flex items-center gap-1.5 rounded-md py-1 pl-1 pr-2 hover:bg-ds-surface"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ds-accent font-ds-heading text-[12px] font-bold text-white">
              RK
            </span>
            <ChevronDown size={13} className="text-ds-muted" />
          </button>
          {userMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-10 z-30 w-44 rounded-lg border border-ds-border bg-white py-1"
            >
              <Link
                href="/dashboard/settings"
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
                className="block px-3 py-2 font-ds-body text-[13px] text-ds-text hover:bg-ds-surface"
              >
                Account settings
              </Link>
              <button
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
                className="block w-full px-3 py-2 text-left font-ds-body text-[13px] text-ds-text hover:bg-ds-surface"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
