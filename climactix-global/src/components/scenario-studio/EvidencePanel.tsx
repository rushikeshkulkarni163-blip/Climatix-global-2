"use client";

import { FileCheck2 } from "lucide-react";
import Card from "@/components/ds/Card";
import type { EvidenceMeta } from "@/types/scenario-studio";

const CONFIDENCE_LABEL: Record<EvidenceMeta["confidence"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

interface EvidencePanelProps {
  evidence: EvidenceMeta;
  className?: string;
}

export default function EvidencePanel({ evidence, className }: EvidencePanelProps) {
  return (
    <Card
      className={className}
      padding="sm"
      title="Evidence"
      action={
        <span className="inline-flex items-center gap-1.5 font-ds-body text-[11px] font-medium text-ds-muted">
          <FileCheck2 size={13} />
          {CONFIDENCE_LABEL[evidence.confidence]}
        </span>
      }
    >
      <dl className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
        <div>
          <dt className="font-ds-body text-[11px] font-medium uppercase tracking-wide text-ds-muted">
            Source datasets
          </dt>
          <dd className="mt-0.5 font-ds-body text-[13px] text-ds-text">
            <ul className="list-inside list-disc space-y-0.5">
              {evidence.sourceDatasets.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="font-ds-body text-[11px] font-medium uppercase tracking-wide text-ds-muted">
            Calculation method
          </dt>
          <dd className="mt-0.5 font-ds-body text-[13px] text-ds-text">{evidence.calculationMethod}</dd>
        </div>
        <div>
          <dt className="font-ds-body text-[11px] font-medium uppercase tracking-wide text-ds-muted">
            Last updated
          </dt>
          <dd className="mt-0.5 font-ds-body text-[13px] text-ds-text">{evidence.lastUpdated}</dd>
        </div>
        <div>
          <dt className="font-ds-body text-[11px] font-medium uppercase tracking-wide text-ds-muted">
            Full methodology
          </dt>
          <dd className="mt-0.5">
            <a
              href={evidence.methodologyHref}
              className="font-ds-body text-[13px] font-medium text-ds-accent hover:text-ds-accent-hi"
            >
              View Risk Engine methodology &rarr;
            </a>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
