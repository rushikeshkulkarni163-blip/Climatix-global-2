import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label:     string;
  value:     string;
  sub?:      string;
  change?:   string;
  trend?:    "up" | "down" | "flat";
  upIsBad?:  boolean;
  accent?:   string;
  size?:     "sm" | "md" | "lg";
  className?: string;
}

export default function MetricCard({
  label, value, sub, change, trend,
  upIsBad = false, accent, size = "md", className = "",
}: MetricCardProps) {
  const trendColor =
    trend === "flat" ? "#62758C" :
    trend === "up"   ? (upIsBad  ? "#FF5B5B" : "#63C982") :
                        (upIsBad  ? "#63C982" : "#FF5B5B");

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const valueSz =
    size === "lg" ? "28px" :
    size === "sm" ? "16px" : "22px";

  return (
    <div
      className={className}
      style={{
        background:    "#0F1722",
        border:        "1px solid #1E2C3D",
        padding:       "12px 14px",
        transition:    "border-color 0.12s ease",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#253649"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1E2C3D"; }}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3D506A", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: valueSz, fontWeight: 700, color: accent ?? "#DDE7F2", lineHeight: 1, marginBottom: "5px" }}>
        {value}
      </div>
      {(change || sub) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {change && trend && (
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600, color: trendColor }}>
              <TrendIcon size={10} />
              {change}
            </div>
          )}
          {sub && <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#3D506A" }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}
