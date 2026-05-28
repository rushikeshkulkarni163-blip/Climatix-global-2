import { ReactNode } from "react";

interface SectionHeaderProps {
  label:      string;
  title:      string;
  action?:    ReactNode;
  className?: string;
  accent?:    string;
}

export default function SectionHeader({
  label, title, action, className = "", accent = "#4DA3FF",
}: SectionHeaderProps) {
  return (
    <div
      className={className}
      style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "14px" }}
    >
      <div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700,
          letterSpacing: "0.18em", textTransform: "uppercase", color: "#3D506A", marginBottom: "4px",
        }}>
          {label}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 2, height: 14, background: accent, flexShrink: 0 }} />
          <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#DDE7F2", margin: 0, letterSpacing: "-0.01em" }}>
            {title}
          </h2>
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
