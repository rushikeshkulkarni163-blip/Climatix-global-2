"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import Card from "@/components/ds/Card";
import Button from "@/components/ds/Button";
import Input from "@/components/ds/Input";
import Select from "@/components/ds/Select";
import Dialog from "@/components/ds/Dialog";
import Badge from "@/components/ds/Badge";
import Table, { type DataTableColumn } from "@/components/ds/Table";
import EmptyState from "@/components/ds/EmptyState";
import PageHeader from "@/components/scenario-studio/PageHeader";
import { useScenarioStudioStore } from "@/store";
import { fetchCompanies, fetchAssets, createAsset } from "@/lib/api/scenarioStudio";
import type { ScenarioCompany, ScenarioAsset } from "@/types/scenario-studio";

const CATEGORY_OPTIONS = [
  "factory",
  "office",
  "warehouse",
  "port",
  "data-center",
  "supply-node",
  "mine",
  "farm",
].map((v) => ({ value: v, label: v }));

const CRITICALITY_OPTIONS = ["low", "medium", "high", "critical"].map((v) => ({ value: v, label: v }));
const ENERGY_OPTIONS = ["grid-fossil", "grid-mixed", "grid-renewable", "on-site-renewable", "diesel-backup"].map((v) => ({
  value: v,
  label: v,
}));
const WATER_OPTIONS = ["low", "medium", "high"].map((v) => ({ value: v, label: v }));

const EMPTY_FORM = {
  name: "",
  category: "factory",
  lat: "",
  lng: "",
  country: "",
  sector: "",
  revenue: "",
  capex: "",
  replacementValueUsdM: "",
  insuranceValueUsdM: "",
  businessCriticality: "medium",
  energySource: "grid-mixed",
  waterDependency: "medium",
};

export default function AssetExplorerPage() {
  const [companies, setCompanies] = useState<ScenarioCompany[]>([]);
  const [assets, setAssets] = useState<ScenarioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const selectedCompanyId = useScenarioStudioStore((s) => s.selectedCompanyId);
  const setSelectedCompanyId = useScenarioStudioStore((s) => s.setSelectedCompanyId);

  const load = useCallback(async () => {
    setLoading(true);
    const c = await fetchCompanies();
    setCompanies(c);
    const companyId = selectedCompanyId ?? c[0]?.id;
    if (companyId) {
      if (!selectedCompanyId) setSelectedCompanyId(companyId);
      setAssets(await fetchAssets(companyId));
    }
    setLoading(false);
  }, [selectedCompanyId, setSelectedCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!selectedCompanyId || !form.name || !form.lat || !form.lng) return;
    setSaving(true);
    try {
      await createAsset({
        companyId: selectedCompanyId,
        name: form.name,
        category: form.category as ScenarioAsset["category"],
        lat: Number(form.lat),
        lng: Number(form.lng),
        country: form.country,
        region: form.country,
        sector: form.sector || "Manufacturing",
        revenue: Number(form.revenue) || 0,
        employees: 0,
        capex: Number(form.capex) || 0,
        scope1: 0,
        scope2: 0,
        replacementValueUsdM: Number(form.replacementValueUsdM) || Number(form.capex) || 0,
        insuranceValueUsdM: Number(form.insuranceValueUsdM) || Number(form.capex) || 0,
        businessCriticality: form.businessCriticality as ScenarioAsset["businessCriticality"],
        energySource: form.energySource as ScenarioAsset["energySource"],
        waterDependency: form.waterDependency as ScenarioAsset["waterDependency"],
      });
      setForm(EMPTY_FORM);
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  const columns: DataTableColumn<ScenarioAsset>[] = [
    { key: "name", header: "Asset", accessor: (a) => a.name, sortValue: (a) => a.name },
    { key: "category", header: "Category", accessor: (a) => a.category },
    { key: "country", header: "Country", accessor: (a) => a.country },
    { key: "sector", header: "Sector", accessor: (a) => a.sector },
    { key: "revenue", header: "Revenue ($M)", align: "right", accessor: (a) => a.revenue.toLocaleString(), sortValue: (a) => a.revenue },
    {
      key: "replacementValue",
      header: "Replacement value ($M)",
      align: "right",
      accessor: (a) => (a.replacementValueUsdM ?? 0).toLocaleString(),
      sortValue: (a) => a.replacementValueUsdM ?? 0,
    },
    {
      key: "criticality",
      header: "Business criticality",
      accessor: (a) => (
        <Badge
          status={a.businessCriticality === "critical" ? "critical" : a.businessCriticality === "high" ? "warning" : "neutral"}
          label={a.businessCriticality ?? "medium"}
          size="sm"
        />
      ),
    },
    { key: "energy", header: "Energy source", accessor: (a) => a.energySource ?? "—" },
  ];

  return (
    <div>
      <PageHeader
        title="Asset Explorer"
        description="Import or add physical assets — factories, ports, mines, data centers — with financial and operational profiles."
        action={
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!selectedCompanyId}>
            <Plus size={14} /> Add asset
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <Select
          label="Company"
          value={selectedCompanyId ?? undefined}
          onValueChange={setSelectedCompanyId}
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Select company"
        />
      </div>

      <Card padding="md">
        {loading ? (
          <p className="font-ds-body text-[13px] text-ds-muted">Loading…</p>
        ) : assets.length === 0 ? (
          <EmptyState title="No assets yet" description="Add the first physical asset for this company to enable simulation." />
        ) : (
          <Table columns={columns} data={assets} getRowId={(a) => a.id} exportFilename="scenario-studio-assets" />
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Add asset" size="lg">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Asset name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select label="Category" value={form.category} onValueChange={(v) => setForm({ ...form, category: v })} options={CATEGORY_OPTIONS} />
          <Input label="Latitude" type="number" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} required />
          <Input label="Longitude" type="number" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} required />
          <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <Input label="Sector" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
          <Input label="Annual revenue ($M)" type="number" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} />
          <Input label="Replacement capex ($M)" type="number" value={form.capex} onChange={(e) => setForm({ ...form, capex: e.target.value })} />
          <Input
            label="Insurance value ($M)"
            type="number"
            value={form.insuranceValueUsdM}
            onChange={(e) => setForm({ ...form, insuranceValueUsdM: e.target.value })}
          />
          <Select
            label="Business criticality"
            value={form.businessCriticality}
            onValueChange={(v) => setForm({ ...form, businessCriticality: v })}
            options={CRITICALITY_OPTIONS}
          />
          <Select label="Energy source" value={form.energySource} onValueChange={(v) => setForm({ ...form, energySource: v })} options={ENERGY_OPTIONS} />
          <Select
            label="Water dependency"
            value={form.waterDependency}
            onValueChange={(v) => setForm({ ...form, waterDependency: v })}
            options={WATER_OPTIONS}
          />
        </div>
        <Button className="mt-4 w-full" onClick={handleCreate} disabled={saving}>
          {saving ? "Adding…" : "Add asset"}
        </Button>
      </Dialog>
    </div>
  );
}
