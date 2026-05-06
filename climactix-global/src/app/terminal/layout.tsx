"use client";

import TerminalSidebar from "@/components/terminal/TerminalSidebar";
import TerminalTopBar from "@/components/terminal/TerminalTopBar";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Left sidebar */}
      <TerminalSidebar />

      {/* Main panel */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TerminalTopBar />
        <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
          {children}
        </main>
      </div>
    </div>
  );
}
