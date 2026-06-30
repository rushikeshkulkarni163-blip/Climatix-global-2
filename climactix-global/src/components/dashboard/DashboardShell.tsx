"use client";

import { useState } from "react";
import Sidebar, { SidebarNav } from "./Sidebar";
import TopNav from "./TopNav";
import RightInsightsPanel from "./RightInsightsPanel";
import CommandPalette from "./CommandPalette";
import Drawer from "@/components/ds/Drawer";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileInsightsOpen, setMobileInsightsOpen] = useState(false);

  return (
    <div className="flex h-screen w-full flex-col bg-ds-bg font-ds-body text-ds-text antialiased">
      <TopNav
        onOpenMobileNav={() => setMobileNavOpen(true)}
        onOpenMobileInsights={() => setMobileInsightsOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex-1 overflow-y-auto">
          <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          <footer className="border-t border-ds-border px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 font-ds-body text-[12px] text-ds-muted sm:flex-row">
              <span>© {new Date().getFullYear()} Climactix Global — Climate Risk Intelligence OS</span>
              <span>Design System v4.0</span>
            </div>
          </footer>
        </div>

        <aside className="hidden w-[320px] flex-shrink-0 border-l border-ds-border bg-white xl:block">
          <RightInsightsPanel />
        </aside>
      </div>

      <Drawer
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        title="Navigation"
        side="left"
        width="sm"
      >
        <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>

      <Drawer
        open={mobileInsightsOpen}
        onOpenChange={setMobileInsightsOpen}
        title="Intelligence Feed"
        side="right"
        width="md"
      >
        <RightInsightsPanel />
      </Drawer>

      <CommandPalette />
    </div>
  );
}
