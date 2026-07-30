"use client";

import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import Drawer from "@/components/ds/Drawer";
import Button from "@/components/ds/Button";
import { useScenarioStudioStore } from "@/store";
import { askAnalyst } from "@/lib/api/scenarioStudio";
import type { ScenarioRunResult, ScenarioCompany } from "@/types/scenario-studio";

interface ChatTurn {
  role: "user" | "analyst";
  text: string;
}

const SUGGESTED_QUESTIONS = [
  "Why did physical risk increase in this scenario?",
  "Explain the Climate VaR figure.",
  "Which assets most need adaptation investment?",
  "Summarize this for a board briefing.",
];

interface AIAnalystPanelProps {
  company: ScenarioCompany | null;
  run: ScenarioRunResult | null;
}

export default function AIAnalystPanel({ company, run }: AIAnalystPanelProps) {
  const open = useScenarioStudioStore((s) => s.aiAnalystOpen);
  const setOpen = useScenarioStudioStore((s) => s.setAiAnalystOpen);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(q: string) {
    if (!q.trim() || loading) return;
    setTurns((t) => [...t, { role: "user", text: q }]);
    setQuestion("");
    setLoading(true);
    try {
      const context = {
        company: company ? { name: company.name, industry: company.industry, country: company.country } : null,
        scenario: run?.scenario,
        horizonYear: run?.year,
        portfolio: run?.portfolio,
        topAssetRisks: run?.assetProfiles
          .slice()
          .sort((a, b) => b.overallRisk - a.overallRisk)
          .slice(0, 5),
      };
      const answer = await askAnalyst(q, context);
      setTurns((t) => [...t, { role: "analyst", text: answer }]);
    } catch {
      setTurns((t) => [...t, { role: "analyst", text: "The analyst is temporarily unavailable — please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title="AI Climate Analyst"
      description="Grounded in this run's simulation output — never invents figures."
      width="md"
      footer={
        <form
          className="flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(question);
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={run ? "Ask about this simulation…" : "Run a simulation first"}
            disabled={!run || loading}
            className="h-9 flex-1 rounded-lg border border-ds-border px-3 font-ds-body text-[14px] text-ds-text outline-none focus:ring-2 focus:ring-ds-accent disabled:opacity-50"
          />
          <Button type="submit" size="sm" disabled={!run || loading}>
            <Send size={14} />
          </Button>
        </form>
      }
    >
      <div className="flex flex-col gap-3">
        {turns.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 font-ds-body text-[13px] text-ds-muted">
              <Sparkles size={14} className="text-ds-accent" />
              Try asking:
            </p>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => submit(q)}
                disabled={!run}
                className="rounded-lg border border-ds-border px-3 py-2 text-left font-ds-body text-[13px] text-ds-text2 transition-colors duration-150 hover:border-ds-accent hover:text-ds-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={
              t.role === "user"
                ? "self-end rounded-lg bg-ds-accent-bg px-3 py-2 font-ds-body text-[13px] text-ds-accent"
                : "self-start rounded-lg border border-ds-border bg-ds-surface px-3 py-2 font-ds-body text-[13px] text-ds-text"
            }
          >
            {t.text}
          </div>
        ))}
        {loading && <div className="font-ds-body text-[13px] text-ds-muted">Analyzing…</div>}
      </div>
    </Drawer>
  );
}
