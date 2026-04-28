"use client";

import { useState, useCallback } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import { Plus, Trash2, Globe, TrendingUp, AlertTriangle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { calculateRiskScore } from "@/lib/scoring/riskEngine";
import { SECTOR_CONFIGS } from "@/lib/scoring/sectorConfig";
import type { PortfolioHolding, AssessmentFormData, Industry } from "@/types";
import RiskBadge from "@/components/ui/RiskBadge";
import { getRiskColor, formatCurrency } from "@/lib/utils";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

const SAMPLE_HOLDINGS: PortfolioHolding[] = [
  { id: "1", company: "ExxonMobil Corp", sector: "energy-oil-gas", weight: 8.5, country: "United States" },
  { id: "2", company: "NextEra Energy", sector: "energy-renewables", weight: 6.2, country: "United States" },
  { id: "3", company: "BASF SE", sector: "manufacturing-chemicals", weight: 5.4, country: "Germany" },
  { id: "4", company: "Rio Tinto plc", sector: "mining-metals", weight: 4.8, country: "Australia" },
  { id: "5", company: "JPMorgan Chase", sector: "financial-services", weight: 9.1, country: "United States" },
  { id: "6", company: "Microsoft Corp", sector: "technology", weight: 11.3, country: "United States" },
  { id: "7", company: "Nestlé SA", sector: "agriculture-food", weight: 5.7, country: "Switzerland" },
  { id: "8", company: "Prologis Inc", sector: "real-estate", weight: 4.2, country: "United States" },
];

function buildFormForHolding(h: PortfolioHolding): AssessmentFormData {
  const sector = SECTOR_CONFIGS[h.sector];
  return {
    companyProfile: {
      organizationName: h.company,
      industry: h.sector,
      subSector: sector.subSectors[0] ?? "",
      country: h.country ?? "United States",
      countryCode: "USA",
      revenueRange: "100m-1b",
      employeeCount: "1001-10000",
      latitude: 40.71,
      longitude: -74.01,
    },
    emissions: {
      scope1: Math.round(sector.carbonIntensityBenchmark * 50),
      scope2: Math.round(sector.carbonIntensityBenchmark * 30),
      scope3: Math.round(sector.carbonIntensityBenchmark * 80),
      useEstimate: true,
      fossilFuelPercent: Math.round(sector.physicalAssetRisk * 80),
      renewablePercent: Math.round((1 - sector.physicalAssetRisk) * 80),
      energyIntensity: 300,
      emissionsTrend: "stable",
    },
    physicalAssets: {
      assetTypes: ["manufacturing"],
      floodZone: false,
      coastalProximity: false,
      wildfireZone: false,
      waterStressRegion: sector.waterStressSensitivity > 0.7,
      heatStressDays: Math.round(sector.physicalAssetRisk * 25),
      waterStressIndex: sector.waterStressSensitivity,
    },
    esgGovernance: {
      climatePolicy: "developing",
      netZeroYear: 2050,
      boardOversight: false,
      tcfdDisclosure: false,
      cdpDisclosure: false,
      carbonOffsets: false,
      supplyChainEsg: false,
    },
    scenario: {
      timeHorizon: 2050,
      warmingScenario: "2.0",
      reportType: "investor",
      units: "metric",
    },
  };
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(SAMPLE_HOLDINGS);
  const [scored, setScored] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newSector, setNewSector] = useState<Industry>("technology");
  const [newWeight, setNewWeight] = useState("");

  const addHolding = () => {
    if (!newCompany || !newWeight) return;
    setHoldings((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        company: newCompany,
        sector: newSector,
        weight: parseFloat(newWeight),
        country: "United States",
      },
    ]);
    setNewCompany("");
    setNewWeight("");
  };

  const removeHolding = (id: string) => setHoldings((h) => h.filter((x) => x.id !== id));

  const runScreening = useCallback(async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const result = holdings.map((h) => ({
      ...h,
      riskScore: calculateRiskScore(buildFormForHolding(h)),
      carbonIntensity: SECTOR_CONFIGS[h.sector].carbonIntensityBenchmark,
    }));
    setScored(result);
    setLoading(false);
  }, [holdings]);

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  const weightedScore =
    scored.length > 0
      ? scored.reduce((s, h) => s + (h.riskScore?.overall ?? 0) * (h.weight / totalWeight), 0)
      : null;

  const parisAligned = scored.filter((h) => (h.riskScore?.overall ?? 100) <= 40).length;
  const redFlags = scored.filter((h) => (h.riskScore?.overall ?? 0) >= 65);

  const scatterData = scored.map((h) => ({
    x: h.riskScore?.physicalRisk.score ?? 0,
    y: h.riskScore?.transitionRisk.score ?? 0,
    name: h.company,
    overall: h.riskScore?.overall ?? 0,
    rating: h.riskScore?.riskRating ?? "MEDIUM",
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="section-title">Portfolio Climate Screener</h1>
        <p className="section-subtitle">Investor-grade climate risk due diligence across your holdings</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Holdings manager */}
        <div className="xl:col-span-1 space-y-4">
          <div className="card">
            <h2 className="font-bold text-brand-navy mb-4">Portfolio Holdings</h2>

            {/* Add holding */}
            <div className="space-y-3 mb-4 p-3 bg-brand-bg rounded-xl">
              <div>
                <label className="label text-xs">Company Name</label>
                <input
                  type="text"
                  className="input-field text-sm py-2"
                  placeholder="e.g. Apple Inc"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addHolding()}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label text-xs">Sector</label>
                  <select
                    className="input-field text-sm py-2"
                    value={newSector}
                    onChange={(e) => setNewSector(e.target.value as Industry)}
                  >
                    {Object.values(SECTOR_CONFIGS).map((s) => (
                      <option key={s.id} value={s.id}>{s.label.split("—")[1]?.trim() ?? s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Weight (%)</label>
                  <input
                    type="number"
                    className="input-field text-sm py-2"
                    placeholder="e.g. 5.0"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    min={0.1}
                    max={100}
                    step={0.1}
                  />
                </div>
              </div>
              <button onClick={addHolding} className="btn-secondary w-full py-2 text-sm flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Holding
              </button>
            </div>

            {/* Holdings list */}
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {holdings.map((h) => {
                const scored_ = scored.find((s) => s.id === h.id);
                return (
                  <div key={h.id} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${
                    scored_?.riskScore?.riskRating === "CRITICAL" || scored_?.riskScore?.riskRating === "HIGH"
                      ? "border-red-200 bg-red-50"
                      : "border-gray-100 hover:bg-gray-50"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-brand-navy truncate">{h.company}</div>
                      <div className="text-xs text-gray-400">{SECTOR_CONFIGS[h.sector].label.split("—")[1]?.trim() ?? h.sector} · {h.weight}%</div>
                    </div>
                    {scored_?.riskScore && (
                      <span className="text-xs font-bold" style={{ color: getRiskColor(scored_.riskScore.riskRating) }}>
                        {scored_.riskScore.overall}
                      </span>
                    )}
                    <button onClick={() => removeHolding(h.id)} className="text-gray-400 hover:text-red-500 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
              <span>{holdings.length} holdings</span>
              <span>Total weight: {totalWeight.toFixed(1)}%</span>
            </div>

            <button
              onClick={runScreening}
              disabled={loading || holdings.length === 0}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Screening…</>
              ) : (
                <><TrendingUp className="w-4 h-4" /> Run Climate Screen</>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="xl:col-span-2 space-y-6">
          {scored.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <Globe className="w-14 h-14 text-gray-200 mb-4" />
              <h3 className="font-semibold text-gray-400 mb-2">No screening results yet</h3>
              <p className="text-sm text-gray-300 max-w-xs">Add holdings and click "Run Climate Screen" to see portfolio-weighted risk scores</p>
            </div>
          ) : (
            <>
              {/* Portfolio KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Portfolio Risk Score",
                    value: weightedScore !== null ? `${weightedScore.toFixed(0)}/100` : "—",
                    color: weightedScore && weightedScore >= 60 ? "text-red-500" : "text-brand-teal",
                    icon: TrendingUp,
                  },
                  {
                    label: "Holdings Screened",
                    value: `${scored.length}`,
                    color: "text-brand-navy",
                    icon: Globe,
                  },
                  {
                    label: "1.5°C Aligned",
                    value: `${parisAligned}/${scored.length}`,
                    color: "text-green-600",
                    icon: CheckCircle2,
                  },
                  {
                    label: "Red-Flag Holdings",
                    value: `${redFlags.length}`,
                    color: redFlags.length > 0 ? "text-red-500" : "text-green-600",
                    icon: AlertTriangle,
                  },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="card card-hover">
                    <Icon className={`w-4 h-4 ${color} mb-2`} />
                    <div className={`text-xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Paris Alignment bar */}
              <div className="card">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-brand-navy">Paris Alignment Score</h3>
                  <span className="text-sm text-gray-500">
                    {((parisAligned / scored.length) * 100).toFixed(0)}% of portfolio on 1.5°C pathway
                  </span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-green-500 rounded-l-full transition-all duration-700"
                    style={{ width: `${(parisAligned / scored.length) * 100}%` }}
                    title="1.5°C aligned"
                  />
                  <div
                    className="h-full bg-amber-400 transition-all duration-700"
                    style={{ width: `${((scored.filter(h => h.riskScore && h.riskScore.overall > 40 && h.riskScore.overall < 65).length) / scored.length) * 100}%` }}
                    title="2°C pathway"
                  />
                  <div
                    className="h-full bg-red-500 rounded-r-full transition-all duration-700"
                    style={{ width: `${(redFlags.length / scored.length) * 100}%` }}
                    title="High risk / off-track"
                  />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />1.5°C aligned</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />2°C pathway</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />High risk</span>
                </div>
              </div>

              {/* Physical vs Transition scatter */}
              <ErrorBoundary>
                <div className="card">
                  <h3 className="font-bold text-brand-navy mb-2">Risk Positioning Map</h3>
                  <p className="text-xs text-gray-400 mb-4">Holdings plotted by Physical Risk vs. Transition Risk (bubble = overall score)</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="Physical Risk"
                        domain={[0, 100]}
                        label={{ value: "Physical Risk →", position: "insideBottom", offset: -10, fill: "#6b7280", fontSize: 11 }}
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name="Transition Risk"
                        domain={[0, 100]}
                        label={{ value: "Transition Risk →", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 11 }}
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={({ payload }) => {
                          const d = payload?.[0]?.payload as typeof scatterData[0] | undefined;
                          if (!d) return null;
                          return (
                            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-sm">
                              <div className="font-bold text-brand-navy">{d.name}</div>
                              <div className="text-gray-500">Physical: {d.x} | Transition: {d.y}</div>
                              <div className="font-semibold mt-1" style={{ color: getRiskColor(d.rating) }}>
                                Overall: {d.overall} ({d.rating})
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={scatterData} name="Holdings">
                        {scatterData.map((entry, i) => (
                          <Cell key={i} fill={getRiskColor(entry.rating)} fillOpacity={0.8} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </ErrorBoundary>

              {/* Holdings table */}
              <div className="card overflow-x-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-brand-navy">Detailed Holdings Analysis</h3>
                  <button
                    onClick={() => {
                      const csv = [
                        ["Company", "Sector", "Weight%", "Overall", "Physical", "Transition", "ESG", "Rating", "Carbon Intensity"].join(","),
                        ...scored.map((h) =>
                          [h.company, h.sector, h.weight, h.riskScore?.overall, h.riskScore?.physicalRisk.score,
                            h.riskScore?.transitionRisk.score, h.riskScore?.esgScore.score, h.riskScore?.riskRating,
                            h.carbonIntensity].join(",")
                        ),
                      ].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "portfolio_climate_screen.csv";
                      a.click();
                    }}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                </div>
                <table className="w-full data-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Sector</th>
                      <th>Weight</th>
                      <th>Overall</th>
                      <th>Physical</th>
                      <th>Transition</th>
                      <th>ESG</th>
                      <th>Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scored
                      .sort((a, b) => (b.riskScore?.overall ?? 0) - (a.riskScore?.overall ?? 0))
                      .map((h) => (
                        <tr key={h.id}>
                          <td className="font-medium">{h.company}</td>
                          <td className="text-xs text-gray-500">{SECTOR_CONFIGS[h.sector].label.split("—")[1]?.trim() ?? h.sector}</td>
                          <td>{h.weight}%</td>
                          <td>
                            <span className="font-bold" style={{ color: getRiskColor(h.riskScore?.riskRating ?? "MEDIUM") }}>
                              {h.riskScore?.overall}
                            </span>
                          </td>
                          <td>{h.riskScore?.physicalRisk.score}</td>
                          <td>{h.riskScore?.transitionRisk.score}</td>
                          <td>{h.riskScore?.esgScore.score}</td>
                          <td>
                            {h.riskScore && <RiskBadge rating={h.riskScore.riskRating} size="sm" />}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Red flags */}
              {redFlags.length > 0 && (
                <div className="card border-2 border-red-200 bg-red-50">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h3 className="font-bold text-red-800">Red-Flag Holdings ({redFlags.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {redFlags.map((h) => (
                      <div key={h.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-red-100">
                        <div>
                          <div className="font-semibold text-brand-navy text-sm">{h.company}</div>
                          <div className="text-xs text-gray-500">Carbon intensity: {h.carbonIntensity} tCO₂e/$M · Weight: {h.weight}%</div>
                        </div>
                        <RiskBadge rating={h.riskScore!.riskRating} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
