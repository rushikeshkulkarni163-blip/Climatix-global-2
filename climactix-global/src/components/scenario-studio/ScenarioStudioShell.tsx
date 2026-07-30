"use client";

import { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";
import Drawer from "@/components/ds/Drawer";
import { ToastProvider } from "@/components/ds/Toast";
import ScenarioStudioSidebar, { SCENARIO_STUDIO_NAV } from "./ScenarioStudioSidebar";

export default function ScenarioStudioShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex h-screen w-full flex-col bg-ds-bg font-ds-body text-ds-text antialiased">
        <TopNav onOpenMobileNav={() => setMobileNavOpen(true)} onOpenMobileInsights={() => {}} />

        <div className="flex flex-1 overflow-hidden">
          <ScenarioStudioSidebar />

          <div className="flex-1 overflow-y-auto">
            <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            <footer className="border-t border-ds-border px-4 py-4 sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 font-ds-body text-[12px] text-ds-muted sm:flex-row">
                <span>© {new Date().getFullYear()} Climactix Global — Scenario Studio</span>
                <span>Design System v4.0</span>
              </div>
            </footer>
          </div>
        </div>

        <Drawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} title="Navigation" side="left" width="sm">
          <nav className="flex flex-col gap-0.5">
            {SCENARIO_STUDIO_NAV.map(({ icon: Icon, label, href }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-ds-body text-[14px] font-medium text-ds-text2 hover:bg-ds-surface hover:text-ds-text"
              >
                <Icon size={17} />
                {label}
              </a>
            ))}
          </nav>
        </Drawer>
      </div>
    </ToastProvider>
  );
}
