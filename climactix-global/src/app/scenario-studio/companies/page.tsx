"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Card from "@/components/ds/Card";
import Button from "@/components/ds/Button";
import Input from "@/components/ds/Input";
import Badge from "@/components/ds/Badge";
import Dialog from "@/components/ds/Dialog";
import PageHeader from "@/components/scenario-studio/PageHeader";
import { useScenarioStudioStore } from "@/store";
import { fetchCompanies, createCompany } from "@/lib/api/scenarioStudio";
import type { ScenarioCompany } from "@/types/scenario-studio";

export default function CompanyWorkspacePage() {
  const [companies, setCompanies] = useState<ScenarioCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", ticker: "", industry: "", country: "", revenueUsdM: "" });

  const setSelectedCompanyId = useScenarioStudioStore((s) => s.setSelectedCompanyId);
  const selectedCompanyId = useScenarioStudioStore((s) => s.selectedCompanyId);

  function load() {
    setLoading(true);
    fetchCompanies()
      .then(setCompanies)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate() {
    if (!form.name || !form.industry || !form.country) return;
    setSaving(true);
    try {
      await createCompany({
        name: form.name,
        ticker: form.ticker || undefined,
        industry: form.industry,
        country: form.country,
        revenueUsdM: Number(form.revenueUsdM) || 0,
      });
      setForm({ name: "", ticker: "", industry: "", country: "", revenueUsdM: "" });
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Company Workspace"
        description="Manage companies and their asset portfolios for scenario simulation."
        action={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus size={14} /> New Company
          </Button>
        }
      />

      {loading ? (
        <p className="font-ds-body text-[13px] text-ds-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <Card key={c.id} padding="md" hoverable className={selectedCompanyId === c.id ? "border-ds-accent" : undefined}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-ds-heading text-[16px] font-bold text-ds-text">{c.name}</p>
                  <p className="mt-0.5 font-ds-body text-[13px] text-ds-muted">
                    {c.ticker ? `${c.ticker} · ` : ""}
                    {c.industry}
                  </p>
                  <p className="font-ds-body text-[13px] text-ds-muted">{c.country} · FY{c.reportingYear}</p>
                </div>
                {c.isSample && <Badge status="info" label="Sample" size="sm" />}
              </div>
              <p className="mt-3 font-ds-number text-[18px] font-bold text-ds-text">${c.revenueUsdM.toLocaleString()}M revenue</p>
              <p className="mt-1 font-ds-body text-[12px] text-ds-muted">{c.assetIds.length} assets</p>
              <Button
                variant={selectedCompanyId === c.id ? "primary" : "secondary"}
                size="sm"
                className="mt-3 w-full"
                onClick={() => setSelectedCompanyId(c.id)}
              >
                {selectedCompanyId === c.id ? "Active in Scenario Studio" : "Set as active"}
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="New company">
        <div className="flex flex-col gap-3">
          <Input label="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Ticker (optional)" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
          <Input label="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} required />
          <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required />
          <Input
            label="Annual revenue ($M)"
            type="number"
            value={form.revenueUsdM}
            onChange={(e) => setForm({ ...form, revenueUsdM: e.target.value })}
          />
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating…" : "Create company"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
