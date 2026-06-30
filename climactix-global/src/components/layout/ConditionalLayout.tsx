"use client";

import { usePathname } from "next/navigation";
import TerminalSidebar from "@/components/terminal/TerminalSidebar";
import TerminalTopBar  from "@/components/terminal/TerminalTopBar";

// Routes that use the full Intelligence OS shell
// NOTE: "/dashboard" intentionally excluded — it has its own v4.0 shell
// (see src/app/dashboard/layout.tsx) and must not pick up this dark shell.
const INTEL_SHELL_PREFIXES = [
  "/terminal",
  "/climate-identity",
  "/risk-propagation",
  "/infrastructure",
  "/report",
  "/portfolio",
  "/risk-analysis",
  "/simulation",
  "/research",
  "/admin",
];

function useIntelShell(pathname: string) {
  return INTEL_SHELL_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const useShell  = useIntelShell(pathname);

  if (useShell) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: "#070B11",
        }}
      >
        <TerminalSidebar />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "#0C1220",
          }}
        >
          <TerminalTopBar />
          <main
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Public pages — no shell; full width
  return <main className="flex-1">{children}</main>;
}
