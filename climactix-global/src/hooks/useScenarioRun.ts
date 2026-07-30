"use client";

import { useEffect, useState, useCallback } from "react";
import { useScenarioStudioStore } from "@/store";
import { fetchCompanies, fetchAssets, runSimulation } from "@/lib/api/scenarioStudio";
import type { ScenarioCompany, ScenarioAsset, ScenarioRunResult } from "@/types/scenario-studio";

interface UseScenarioRunResult {
  company: ScenarioCompany | null;
  assets: ScenarioAsset[];
  run: ScenarioRunResult | null;
  compareRun: ScenarioRunResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Shared data-loading hook for every Scenario Studio module page — resolves
 *  the selected company/scenario/horizon from the shared store, fetches its
 *  assets, and runs (or re-runs) the simulation whenever the selection changes. */
export function useScenarioRun(): UseScenarioRunResult {
  const selectedCompanyId = useScenarioStudioStore((s) => s.selectedCompanyId);
  const setSelectedCompanyId = useScenarioStudioStore((s) => s.setSelectedCompanyId);
  const scenario = useScenarioStudioStore((s) => s.scenario);
  const compareScenario = useScenarioStudioStore((s) => s.compareScenario);
  const horizon = useScenarioStudioStore((s) => s.horizon);

  const [company, setCompany] = useState<ScenarioCompany | null>(null);
  const [assets, setAssets] = useState<ScenarioAsset[]>([]);
  const [run, setRun] = useState<ScenarioRunResult | null>(null);
  const [compareRun, setCompareRun] = useState<ScenarioRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        let companyId = selectedCompanyId;
        if (!companyId) {
          const companies = await fetchCompanies();
          if (cancelled) return;
          if (companies.length === 0) {
            setError("No companies yet — create one in Company Workspace.");
            setLoading(false);
            return;
          }
          companyId = companies[0].id;
          setSelectedCompanyId(companyId);
        }

        const companies = await fetchCompanies();
        const foundCompany = companies.find((c) => c.id === companyId) ?? null;
        const assetList = await fetchAssets(companyId);
        if (cancelled) return;
        setCompany(foundCompany);
        setAssets(assetList);

        if (assetList.length === 0) {
          setRun(null);
          setCompareRun(null);
          setError("This company has no assets yet — add assets in Asset Explorer.");
          setLoading(false);
          return;
        }

        const [primary, comparison] = await Promise.all([
          runSimulation(companyId, scenario, horizon),
          compareScenario ? runSimulation(companyId, compareScenario, horizon) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setRun(primary);
        setCompareRun(comparison);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load simulation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, scenario, compareScenario, horizon, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { company, assets, run, compareRun, loading, error, refetch };
}
