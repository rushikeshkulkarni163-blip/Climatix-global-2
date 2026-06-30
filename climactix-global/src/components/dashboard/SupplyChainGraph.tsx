"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ds/Card";
import Drawer from "@/components/ds/Drawer";
import { RatingBadge } from "@/components/ds/Badge";
import { SUPPLY_CHAIN_NODES, type SupplyChainNode } from "@/lib/dashboard/mockData";

const VIEW_W = 560;
const VIEW_H = 360;
const CENTER = { x: VIEW_W / 2, y: VIEW_H / 2 };
const TIER_RADIUS = { 1: 90, 2: 150, 3: 205 };

interface PositionedNode extends SupplyChainNode {
  x: number;
  y: number;
}

function riskColor(score: number) {
  if (score >= 65) return "#DC2626";
  if (score >= 40) return "#B45309";
  return "#1E8E3E";
}

function scoreToRating(score: number) {
  if (score >= 80) return "CCC" as const;
  if (score >= 65) return "B" as const;
  if (score >= 50) return "BB" as const;
  if (score >= 35) return "BBB" as const;
  if (score >= 20) return "A" as const;
  return "AA" as const;
}

function layout(nodes: SupplyChainNode[]): PositionedNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const angleOf = new Map<string, number>();
  const positioned: PositionedNode[] = [];

  const root = nodes.find((n) => n.tier === 0)!;
  positioned.push({ ...root, x: CENTER.x, y: CENTER.y });
  angleOf.set(root.id, 0);

  const tier1 = nodes.filter((n) => n.tier === 1);
  tier1.forEach((node, i) => {
    const angle = -90 + (360 / tier1.length) * i;
    angleOf.set(node.id, angle);
    const rad = (angle * Math.PI) / 180;
    positioned.push({
      ...node,
      x: CENTER.x + TIER_RADIUS[1] * Math.cos(rad),
      y: CENTER.y + TIER_RADIUS[1] * Math.sin(rad),
    });
  });

  const tier2 = nodes.filter((n) => n.tier === 2);
  const byParent2 = new Map<string, SupplyChainNode[]>();
  tier2.forEach((n) => {
    const list = byParent2.get(n.parentId!) ?? [];
    list.push(n);
    byParent2.set(n.parentId!, list);
  });
  byParent2.forEach((children, parentId) => {
    const parentAngle = angleOf.get(parentId) ?? 0;
    const span = 36;
    children.forEach((node, i) => {
      const offset = children.length === 1 ? 0 : -span / 2 + (span / (children.length - 1)) * i;
      const angle = parentAngle + offset;
      angleOf.set(node.id, angle);
      const rad = (angle * Math.PI) / 180;
      positioned.push({
        ...node,
        x: CENTER.x + TIER_RADIUS[2] * Math.cos(rad),
        y: CENTER.y + TIER_RADIUS[2] * Math.sin(rad),
      });
    });
  });

  const tier3 = nodes.filter((n) => n.tier === 3);
  tier3.forEach((node) => {
    const parentAngle = angleOf.get(node.parentId!) ?? 0;
    const rad = (parentAngle * Math.PI) / 180;
    positioned.push({
      ...node,
      x: CENTER.x + TIER_RADIUS[3] * Math.cos(rad),
      y: CENTER.y + TIER_RADIUS[3] * Math.sin(rad),
    });
  });

  return positioned.filter((n) => byId.has(n.id));
}

export default function SupplyChainGraph() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const positioned = useMemo(() => layout(SUPPLY_CHAIN_NODES), []);
  const byId = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  const ancestry = useMemo(() => {
    if (!selected) return [];
    const chain: PositionedNode[] = [];
    let current: PositionedNode | undefined = selected;
    while (current) {
      chain.unshift(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return chain;
  }, [selected, byId]);

  const nodeRadius = (tier: number) => (tier === 0 ? 10 : tier === 1 ? 8 : tier === 2 ? 6 : 5);

  return (
    <Card id="supply-chain" title="Supply Chain Intelligence" description="Tier 1 / 2 / 3 network — colored by climate risk score" padding="md">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-[340px] w-full" role="img" aria-label="Supply chain network graph">
        {positioned
          .filter((n) => n.parentId)
          .map((n) => {
            const parent = byId.get(n.parentId!);
            if (!parent) return null;
            return (
              <line
                key={`edge-${n.id}`}
                x1={parent.x}
                y1={parent.y}
                x2={n.x}
                y2={n.y}
                stroke="#D9D9D9"
                strokeWidth={1}
              />
            );
          })}
        {positioned.map((n) => (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={nodeRadius(n.tier)}
              fill={n.tier === 0 ? "#0B3D91" : riskColor(n.riskScore)}
              stroke="#FFFFFF"
              strokeWidth={1.5}
              tabIndex={0}
              role="button"
              aria-label={`${n.label}, tier ${n.tier}${n.tier > 0 ? `, risk score ${n.riskScore}` : ""}`}
              className="cursor-pointer transition-transform duration-150 hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-accent"
              onClick={() => setSelectedId(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSelectedId(n.id);
              }}
            />
            {n.tier <= 1 && (
              <text x={n.x} y={n.y + nodeRadius(n.tier) + 12} textAnchor="middle" className="font-ds-body" fontSize={9.5} fill="#4F4F4F">
                {n.label.length > 18 ? `${n.label.slice(0, 16)}…` : n.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="mt-2 flex items-center gap-4 font-ds-body text-[11px] text-ds-muted">
        <LegendDot color="#0B3D91" label="Portfolio" />
        <LegendDot color="#1E8E3E" label="Low risk" />
        <LegendDot color="#B45309" label="Medium risk" />
        <LegendDot color="#DC2626" label="High risk" />
      </div>

      <Drawer
        open={!!selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selected?.label ?? ""}
        description={selected ? `${selected.country} · Tier ${selected.tier}` : undefined}
      >
        {selected && selected.tier > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="font-ds-body text-[12px] text-ds-muted">Climate risk rating</span>
              <RatingBadge rating={scoreToRating(selected.riskScore)} size="sm" />
            </div>
            <div>
              <p className="font-ds-body text-[12px] font-semibold uppercase tracking-wide text-ds-muted">
                Supply chain path
              </p>
              <p className="mt-1 font-ds-body text-[14px] text-ds-text">
                {ancestry.map((n) => n.label).join(" → ")}
              </p>
            </div>
          </div>
        )}
      </Drawer>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
