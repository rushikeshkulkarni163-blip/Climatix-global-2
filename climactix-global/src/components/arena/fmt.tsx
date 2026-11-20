import type { Provenance } from "@/lib/arena/science";

export const fmt = {
  mt: (v: number) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)),
  pct: (v: number, d = 0) => `${(v * 100).toFixed(d)}%`,
  usdM: (v: number) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)} tn` : Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)} bn` : `$${v.toFixed(0)} m`),
  t: (v: number, d = 1) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}`,
  int: (v: number) => Math.round(v).toLocaleString("en-US"),
};

export const PROV_LABEL: Record<Provenance, string> = {
  observed: "Observed", projection: "Projection", interpolated: "Interpolated", estimate: "Climactix estimate",
  illustrative: "Illustrative", demo: "Demo data",
};

export function Prov({ p }: { p: Provenance }) {
  return <span className={`ax-prov ax-prov-${p}`}>{PROV_LABEL[p]}</span>;
}
