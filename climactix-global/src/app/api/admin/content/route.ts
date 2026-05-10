import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import {
  findAll,
  findById,
  insert,
  upsert,
  remove,
  type BaseRecord,
} from "@/lib/db/file-store";

const COLLECTION = "content";

interface ContentItem extends BaseRecord {
  type: "insight" | "case_study" | "ticker_item" | "report" | "alert";
  title: string;
  body: string;
  category: string;
  tags: string[];
  published: boolean;
  author?: string;
  metadata?: Record<string, unknown>;
}

// ── Seed default content ──────────────────────────────────────────────────────

function seedContent() {
  if (findAll<ContentItem>(COLLECTION).length > 0) return;
  const now = new Date().toISOString();
  const defaults = [
    {
      type: "insight" as const,
      title: "Rising Temperatures Reshape Industrial Asset Valuation",
      body: "Heat stress days above 35°C are projected to double by 2040, materially affecting productivity and insurance costs across manufacturing and energy sectors.",
      category: "Physical Risk",
      tags: ["heat-stress", "physical-risk", "manufacturing"],
      published: true,
      createdAt: now,
    },
    {
      type: "insight" as const,
      title: "Carbon Pricing at $200/tCO₂ by 2050: Who Bears the Burden?",
      body: "Our scenario analysis maps the financial exposure of 12 sectors under four IPCC-aligned carbon price trajectories from $50 to $200 per tonne.",
      category: "Transition Risk",
      tags: ["carbon-pricing", "transition-risk", "scenario-analysis"],
      published: true,
      createdAt: now,
    },
    {
      type: "case_study" as const,
      title: "TCFD-Aligned Physical Risk Assessment for a European Utility",
      body: "Comprehensive heat stress and flood exposure analysis across 47 generation assets in 12 countries using Open-Meteo and NASA POWER data.",
      category: "Energy Sector",
      tags: ["tcfd", "physical-risk", "utilities"],
      published: true,
      createdAt: now,
    },
  ];
  for (const d of defaults) insert<ContentItem>(COLLECTION, d);
}

let _seeded = false;
function ensureSeeded() {
  if (_seeded) return;
  _seeded = true;
  seedContent();
}

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin(req: NextRequest): Promise<{ error: NextResponse } | { ok: true }> {
  const token =
    req.cookies.get("climactix_token")?.value ??
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("error" in guard) return guard.error;
  ensureSeeded();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const published = searchParams.get("published");

  let items = findAll<ContentItem>(COLLECTION);
  if (type) items = items.filter((i) => i.type === type);
  if (published !== null) items = items.filter((i) => i.published === (published === "true"));
  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return NextResponse.json({ items, total: items.length });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("error" in guard) return guard.error;
  ensureSeeded();

  const body = await req.json();
  const { type, title, body: content, category, tags = [], published = false, metadata } = body;
  if (!type || !title) {
    return NextResponse.json({ error: "type and title are required" }, { status: 400 });
  }

  const item = insert<ContentItem>(COLLECTION, {
    type,
    title,
    body: content ?? "",
    category: category ?? "",
    tags,
    published,
    metadata,
  });

  return NextResponse.json({ success: true, item }, { status: 201 });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updated = upsert<ContentItem>(COLLECTION, id, updates);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, item: updated });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("error" in guard) return guard.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ success: remove(COLLECTION, id) });
}
