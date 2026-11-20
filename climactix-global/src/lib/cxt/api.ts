/**
 * Climactix Terminal API client.
 *
 * Calls go to /cxt-api/* on the same origin; next.config.mjs rewrites them to
 * the Terminal service (TERMINAL_API_URL). The session lives in an httpOnly
 * cookie set by the API, so no token is ever stored in browser JavaScript.
 * Every state-changing request carries X-Requested-With, which the API
 * requires for cookie-authenticated writes (CSRF defence).
 */

export const API_BASE = "/cxt-api";

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function qs(q?: Query): string {
  if (!q) return "";
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Requested-With": "cxt" };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${qs(opts.query)}`, { method, headers, body, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError(0, "The Terminal service could not be reached. Check that it is running.");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = (data as { error?: Record<string, unknown> } | null)?.error ?? {};
    const msg = typeof err.message === "string" ? err.message : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, err);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown, query?: Query) => request<T>("POST", path, { body, query }),
  put: <T>(path: string, body?: unknown, query?: Query) => request<T>("PUT", path, { body, query }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, { form }),
  url: (path: string) => `${API_BASE}${path}`,
};

/* ── Shared shapes (subset of the API's responses) ───────────────────── */

export interface Me {
  user: { id: string; email: string; full_name: string; role: Role };
  organisation: { id: string; name: string; type: OrgType; company_id: string | null };
  permissions: string[];
  entitlements: string[];
  subscription: { plan: string; status: string; starts_at: string; ends_at: string | null; days_remaining: number | null } | null;
}

export type Role = "super_admin" | "data_analyst" | "assessment_reviewer" | "company_admin" | "bank_user" | "insurance_user" | "investor_user" | "government_user";
export type OrgType = "climactix" | "company" | "bank" | "insurance" | "investor" | "government";

export interface CompanyBrief {
  id: string; cx_id: string; legal_name: string; common_name: string | null; country: string;
  sector: string | null; sector_code: string | null; industry: string | null; is_synthetic: boolean;
}

export interface EvidenceRef { kind: string; id: string; metric: string; fy: number | null; value: unknown; unit: string | null; verified: boolean; conf: number | null; src: string }
export interface Indicator {
  id: string; name: string; weight: number; rule: string; status: string; score: number | null;
  explanation: string; evidence: EvidenceRef[]; classification: string; band: string | null; evidence_basis: string | null;
  detail: Record<string, unknown>;
}
export interface Deduction { id: string; points: number; count: number; reason: string; pillar?: string }
export interface Pillar {
  id: string; name: string; weight: number; description: string; status: string; score: number | null;
  score_before_deductions: number | null; indicator_coverage: number; deductions: Deduction[]; indicators: Indicator[];
}
export interface ScoreResult {
  overall: number | null; overall_status: string; pillar_coverage_pct: number; pillars: Pillar[];
  confidence: { score: number; band: string; components: Record<string, number>; weights: Record<string, number>; evidence_items: number; latest_evidence_fy: number | null };
  evidence_coverage_pct: number;
  strengths: { pillar: string; indicator: string; score: number; explanation: string; evidence_basis: string | null }[];
  improvements: { pillar: string; indicator: string; score: number; explanation: string }[];
  gaps: { pillar: string; indicator: string; status: string; classification: string; explanation: string }[];
  deductions: Deduction[];
  unverified_claims: { metric: string; label: string; reason: string }[];
  summary: string; engine_version: string;
}
export interface ScoreOut {
  id: string; score_type: "public" | "company"; overall: number | null; confidence: number; confidence_band: string;
  evidence_coverage: number; pillars: Record<string, number | null>; fiscal_year: number | null; fy_label: string | null;
  computed_at: string; is_current: boolean; methodology_version: string | null; engine_version: string;
  trigger: string | null; inputs_hash: string; result_hash: string; assessment_id: string; result?: ScoreResult;
}
export interface DocumentOut {
  id: string; company_id: string | null; title: string; filename: string; category: string; category_label: string;
  fiscal_year: number | null; fy_label: string | null; file_format: string; size_bytes: number; version_no: number;
  status: string; stage: string; source_type: string; source_url: string | null; retrieved_at: string | null;
  visibility: string; page_count: number | null; ocr_pages: number; extraction_confidence: number | null;
  created_at: string; processed_at: string | null; error: string | null; sha256: string; supersedes_id: string | null;
  superseded?: boolean; duplicate?: boolean; message?: string;
}
export interface DataPointOut {
  id: string; metric_key: string; metric: string; category: string; kind: string; fiscal_year: number | null; fy_label: string | null;
  value: number | null; value_text: string | null; unit: string | null; normalized_value: number | null; normalized_unit: string | null;
  boundary: string | null; channel: string; confidence: number; confidence_factors: { factor: string; effect: number; detail: string }[];
  verification_status: string; review_note: string | null; reviewed_at: string | null;
  provenance: { document_id: string | null; document_title: string | null; source_type: string | null; source_url: string | null; page_no: number | null; source_location: string | null; quote: string | null; reporting_period: string | null; extracted_at: string; extraction_method: string };
}
export interface MetricSeries {
  metric_key: string; name: string; category: string; group: string | null; unit: string | null;
  values: Record<string, { value: number; unit: string; as_reported: number; as_reported_unit: string; verification_status: string; confidence: number; data_point_id: string; channel: string; document_id: string | null; page_no: number | null }>;
}
