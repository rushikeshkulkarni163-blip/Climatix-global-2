import type {
  ScenarioCompany,
  ScenarioAsset,
  ScenarioFamilyConfig,
  ScenarioFamilyId,
  ProjectionYear,
  ScenarioRunResult,
  SupplyChainNode,
  SupplyChainEdge,
  ScenarioStudioReport,
} from '@/types/scenario-studio';

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!json.success || json.data === undefined) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json.data;
}

export async function fetchCompanies(): Promise<ScenarioCompany[]> {
  const res = await fetch('/api/scenario-studio/companies');
  return unwrap<ScenarioCompany[]>(res);
}

export async function createCompany(
  input: Pick<ScenarioCompany, 'name' | 'industry' | 'country'> & Partial<ScenarioCompany>
): Promise<ScenarioCompany> {
  const res = await fetch('/api/scenario-studio/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<ScenarioCompany>(res);
}

export async function fetchAssets(companyId: string): Promise<ScenarioAsset[]> {
  const res = await fetch(`/api/scenario-studio/assets?companyId=${encodeURIComponent(companyId)}`);
  return unwrap<ScenarioAsset[]>(res);
}

export async function createAsset(input: Partial<ScenarioAsset> & { companyId: string }): Promise<ScenarioAsset> {
  const res = await fetch('/api/scenario-studio/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<ScenarioAsset>(res);
}

export async function fetchScenarioFamilies(): Promise<ScenarioFamilyConfig[]> {
  const res = await fetch('/api/scenario-studio/scenarios');
  return unwrap<ScenarioFamilyConfig[]>(res);
}

export async function runSimulation(
  companyId: string,
  scenario: ScenarioFamilyId,
  year: ProjectionYear
): Promise<ScenarioRunResult> {
  const res = await fetch('/api/scenario-studio/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, scenario, year }),
  });
  return unwrap<ScenarioRunResult>(res);
}

export async function fetchSupplyChain(
  companyId: string,
  scenario: ScenarioFamilyId,
  year: ProjectionYear
): Promise<{ nodes: SupplyChainNode[]; edges: SupplyChainEdge[] }> {
  const res = await fetch(
    `/api/scenario-studio/supply-chain?companyId=${encodeURIComponent(companyId)}&scenario=${scenario}&year=${year}`
  );
  return unwrap<{ nodes: SupplyChainNode[]; edges: SupplyChainEdge[] }>(res);
}

export async function fetchReports(): Promise<ScenarioStudioReport[]> {
  const res = await fetch('/api/scenario-studio/reports');
  return unwrap<ScenarioStudioReport[]>(res);
}

export async function logReport(
  input: Pick<ScenarioStudioReport, 'companyId' | 'companyName' | 'scenario' | 'year'>
): Promise<ScenarioStudioReport> {
  const res = await fetch('/api/scenario-studio/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<ScenarioStudioReport>(res);
}

export async function askAnalyst(question: string, context: unknown): Promise<string> {
  const res = await fetch('/api/scenario-studio/analyst', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context }),
  });
  const data = await unwrap<{ answer: string }>(res);
  return data.answer;
}
