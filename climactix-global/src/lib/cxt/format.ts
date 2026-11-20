export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Administrator", data_analyst: "Data Analyst", assessment_reviewer: "Assessment Reviewer",
  company_admin: "Company Administrator", bank_user: "Bank User", insurance_user: "Insurance User",
  investor_user: "Investor User", government_user: "Government User",
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", processing: "Processing", completed: "Completed", failed: "Failed", requires_review: "Requires review",
  extracted: "Extracted", needs_review: "Needs review", verified: "Verified", rejected: "Rejected",
  company_declared: "Company declared", evidence_accepted: "Evidence accepted",
  draft: "Draft", submitted: "Submitted", under_review: "Under review", returned: "Returned", validated: "Validated", scored: "Scored",
  not_provided: "No source", declared_source: "Source declared", accepted: "Accepted", open: "Open", resolved: "Resolved", dismissed: "Dismissed",
  scored_ind: "Scored", missing_disclosure: "Missing disclosure", insufficient_evidence: "Insufficient evidence",
  conflicting_data: "Conflicting data", unverified_claim: "Unverified claim",
  operational: "Operational", pending_configuration: "Pending configuration", registered: "Registered", discovered: "Discovered",
  retrieval_queued: "Retrieval queued", retrieved: "Retrieved", error: "Error", active: "Active", expired: "Expired", cancelled: "Cancelled",
  invited: "Invited", disabled: "Disabled", suspended: "Suspended", approved: "Approved", retired: "Retired",
};

export function label(s: string | null | undefined): string {
  if (!s) return "—";
  return STATUS_LABEL[s] ?? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  // International grouping, matching how the figures appear in the reports themselves.
  // Whole numbers are never padded with decimals ("182,400", not "182,400.00").
  const d = Number.isInteger(v) ? 0 : digits;
  return v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function compact(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)} bn`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)} mn`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(1)} k`;
  return num(v, a < 10 ? 2 : a < 100 ? 1 : 0);
}

export function date(s: string | null | undefined, withTime = false): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

export function bytes(n: number): string {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** Score tone: strong ≥ 70, moderate 40–69, weak < 40 (methodology bands). */
export function tone(score: number | null | undefined): "pos" | "warn" | "crit" | "none" {
  if (score === null || score === undefined) return "none";
  return score >= 70 ? "pos" : score >= 40 ? "warn" : "crit";
}

export function statusTone(s: string): "pos" | "warn" | "crit" | "accent" | "none" {
  if (["completed", "verified", "evidence_accepted", "accepted", "scored", "validated", "active", "approved", "operational", "retrieved", "resolved"].includes(s)) return "pos";
  if (["requires_review", "needs_review", "returned", "pending_configuration", "unverified_claim", "conflicting_data", "invited", "declared_source", "company_declared", "expired"].includes(s)) return "warn";
  if (["failed", "rejected", "error", "disabled", "suspended", "cancelled"].includes(s)) return "crit";
  if (["processing", "submitted", "under_review", "pending", "retrieval_queued", "discovered"].includes(s)) return "accent";
  return "none";
}
