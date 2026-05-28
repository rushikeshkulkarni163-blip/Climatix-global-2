import TerminalSidebar from "@/components/terminal/TerminalSidebar";
import TerminalTopBar  from "@/components/terminal/TerminalTopBar";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <TerminalSidebar />
      <div className="app-main">
        <TerminalTopBar />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
