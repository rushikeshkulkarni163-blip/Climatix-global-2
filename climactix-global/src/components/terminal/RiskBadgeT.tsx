type Level = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MINIMAL";

const STYLE: Record<Level, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: "#FF5B5B", bg: "rgba(255,91,91,0.1)",   border: "rgba(255,91,91,0.25)"   },
  HIGH:     { color: "#D8913F", bg: "rgba(216,145,63,0.1)",  border: "rgba(216,145,63,0.25)"  },
  MEDIUM:   { color: "#C9A227", bg: "rgba(201,162,39,0.1)",  border: "rgba(201,162,39,0.25)"  },
  LOW:      { color: "#4DA3FF", bg: "rgba(77,163,255,0.1)",  border: "rgba(77,163,255,0.25)"  },
  MINIMAL:  { color: "#63C982", bg: "rgba(99,201,130,0.1)",  border: "rgba(99,201,130,0.25)"  },
};

export default function RiskBadgeT({ level }: { level: Level }) {
  const s = STYLE[level];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 7px",
        fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
      {level}
    </span>
  );
}
