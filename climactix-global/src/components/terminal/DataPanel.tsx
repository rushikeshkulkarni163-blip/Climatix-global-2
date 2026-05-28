import { ReactNode } from "react";

interface DataPanelProps {
  title?:     string;
  label?:     string;
  children:   ReactNode;
  action?:    ReactNode;
  className?: string;
  noPad?:     boolean;
  accent?:    string;
}

export default function DataPanel({
  title, label, children, action, className = "", noPad, accent = "#4DA3FF",
}: DataPanelProps) {
  return (
    <div
      className={className}
      style={{ background: "#0F1722", border: "1px solid #1E2C3D" }}
    >
      {(title || label || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: "1px solid #1E2C3D",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 2, height: 10, background: accent, flexShrink: 0 }} />
            {label && (
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700,
                letterSpacing: "0.18em", textTransform: "uppercase", color: "#3D506A",
              }}>
                {label}
              </span>
            )}
            {title && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600, color: "#8CA3BA" }}>
                {title}
              </span>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={noPad ? {} : { padding: "12px" }}>{children}</div>
    </div>
  );
}
