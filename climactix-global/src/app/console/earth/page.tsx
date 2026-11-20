"use client";

import dynamic from "next/dynamic";

// The Climate Arena is WebGL-only; it never renders on the server.
const ArenaApp = dynamic(() => import("@/components/arena/ArenaApp"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "fixed", inset: 0, background: "#07090C", color: "#C9CED6", display: "grid", placeItems: "center", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 13 }}>
      Loading Climate Arena…
    </div>
  ),
});

export default function ClimateArenaPage() {
  return <ArenaApp />;
}
