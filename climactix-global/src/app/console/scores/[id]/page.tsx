"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ConfidenceDetail, Findings, PillarBreakdown, ScoreHeadline } from "@/components/cxt/Score";
import { Alert, Async, PageHead, Panel, useApi } from "@/components/cxt/ui";
import type { CompanyBrief, ScoreOut } from "@/lib/cxt/api";
import { date } from "@/lib/cxt/format";

export default function ScorePage() {
  const { id } = useParams<{ id: string }>();
  const r = useApi<ScoreOut & { company: CompanyBrief }>(`/scores/${id}`);
  const rep = useApi<{ reproduced: boolean; result_hash: string; expected_hash: string; methodology_version: string; engine_version_stored: string; engine_version_running: string }>(`/scores/${id}/reproduce`);
  return (
    <Async r={r}>{(s) => (
      <>
        <PageHead eyebrow={<Link href={`/console/companies/${s.company.id}`}>{s.company.legal_name}</Link>}
          title={s.score_type === "public" ? "Public Data Score record" : "Company Assessment Score record"}
          sub={`Computed ${date(s.computed_at, true)} · ${s.is_current ? "current version" : "historical version"} · trigger: ${s.trigger ?? "—"}`} />
        <ScoreHeadline title={s.score_type === "public" ? "Public Data Score" : "Company Assessment Score"} s={s} />
        <Panel title="Reproducibility">
          <Async r={rep}>{(x) => (
            <div className="cx-stack">
              <Alert kind={x.reproduced ? "pos" : "crit"}>{x.reproduced
                ? `Recomputed just now from the stored evidence snapshot under methodology ${x.methodology_version}: the result is identical.`
                : "Recomputing from the stored evidence did not reproduce the stored result. This indicates an engine change since the score was computed."}</Alert>
              <dl className="cx-kv small">
                <dt>Methodology</dt><dd>{x.methodology_version}</dd>
                <dt>Engine</dt><dd>stored {x.engine_version_stored} · running {x.engine_version_running}</dd>
                <dt>Evidence hash</dt><dd style={{ fontFamily: "monospace" }}>{s.inputs_hash}</dd>
                <dt>Result hash</dt><dd style={{ fontFamily: "monospace" }}>{x.expected_hash}</dd>
              </dl>
            </div>)}</Async>
        </Panel>
        {s.result && <><PillarBreakdown s={s} /><Panel title="Data Confidence"><ConfidenceDetail s={s} /></Panel><Findings s={s} /></>}
      </>
    )}</Async>
  );
}
