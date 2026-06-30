"use client";

import { Fragment, useState } from "react";
import Card from "@/components/ds/Card";
import Dialog from "@/components/ds/Dialog";
import { formatCurrency } from "@/lib/utils";
import { getRiskMatrixCell } from "@/lib/dashboard/mockData";

const IMPACT_LABELS = ["Minimal", "Minor", "Moderate", "Major", "Severe"];
const PROBABILITY_LABELS = ["Rare", "Unlikely", "Possible", "Likely", "Near-certain"];

function severityColor(severity: number) {
  if (severity >= 20) return "bg-ds-critical text-white";
  if (severity >= 12) return "bg-ds-warning text-white";
  if (severity >= 6) return "bg-ds-accent-bg text-ds-accent";
  return "bg-ds-success-bg text-ds-success";
}

export default function RiskMatrix() {
  const [selected, setSelected] = useState<{ probability: number; impact: number } | null>(null);

  const detail = selected ? getRiskMatrixCell(selected.probability, selected.impact) : null;

  return (
    <Card
      id="risk-matrix"
      title="Risk Matrix"
      description="Probability × impact — click a cell for exposure detail"
      padding="md"
    >
      <div className="overflow-x-auto">
        <div className="grid min-w-[480px] grid-cols-[80px_repeat(5,1fr)] gap-1">
          <div />
          {IMPACT_LABELS.map((label) => (
            <div key={label} className="text-center font-ds-body text-[11px] font-medium text-ds-muted">
              {label}
            </div>
          ))}

          {[5, 4, 3, 2, 1].map((probability) => (
            <Fragment key={`row-${probability}`}>
              <div className="flex items-center justify-end pr-2 font-ds-body text-[11px] font-medium text-ds-muted">
                {PROBABILITY_LABELS[probability - 1]}
              </div>
              {[1, 2, 3, 4, 5].map((impact) => {
                const severity = probability * impact;
                return (
                  <button
                    key={`${probability}-${impact}`}
                    onClick={() => setSelected({ probability, impact })}
                    aria-label={`Probability ${PROBABILITY_LABELS[probability - 1]}, impact ${IMPACT_LABELS[impact - 1]}, severity ${severity}`}
                    className={`flex aspect-square items-center justify-center rounded-md font-ds-number text-[13px] font-bold transition-transform duration-150 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent ${severityColor(
                      severity
                    )}`}
                  >
                    {severity}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected ? `Risk Cell — ${PROBABILITY_LABELS[selected.probability - 1]} × ${IMPACT_LABELS[selected.impact - 1]}` : ""}
        description={detail ? `Estimated financial loss: ${formatCurrency(detail.financialLossUSD, "USD", true)}` : undefined}
      >
        {detail && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-ds-body text-[12px] font-semibold uppercase tracking-wide text-ds-muted">
                Affected companies
              </p>
              <p className="mt-1 font-ds-body text-[14px] text-ds-text">
                {detail.companies.length ? detail.companies.join(", ") : "None at this severity level"}
              </p>
            </div>
            <div>
              <p className="font-ds-body text-[12px] font-semibold uppercase tracking-wide text-ds-muted">
                Affected assets
              </p>
              <p className="mt-1 font-ds-body text-[14px] text-ds-text">
                {detail.assets.length ? detail.assets.join(", ") : "None at this severity level"}
              </p>
            </div>
            <div>
              <p className="font-ds-body text-[12px] font-semibold uppercase tracking-wide text-ds-muted">
                Recommended mitigation
              </p>
              <p className="mt-1 font-ds-body text-[14px] text-ds-text">{detail.mitigation}</p>
            </div>
            <div>
              <p className="font-ds-body text-[12px] font-semibold uppercase tracking-wide text-ds-muted">Evidence</p>
              <p className="mt-1 font-ds-body text-[13px] text-ds-muted">{detail.evidence}</p>
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}
