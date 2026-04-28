"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ScatterChart, Scatter, Cell,
} from "recharts";
import {
  Search, Download, Globe, BarChart3, Database, RefreshCw,
  ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { SkeletonChart } from "@/components/ui/SkeletonCard";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

const INDICATORS = [
  { id: "EN.ATM.CO2E.KT", label: "CO₂ Emissions (kt)", source: "World Bank", unit: "kt" },
  { id: "EG.USE.ELEC.KH.PC", label: "Electric power consumption (kWh per capita)", source: "World Bank", unit: "kWh/capita" },
  { id: "EG.FEC.RNEW.ZS", label: "Renewable energy (% of total)", source: "World Bank", unit: "%" },
  { id: "ER.H2O.FWTL.ZS", label: "Freshwater withdrawal (% of resources)", source: "World Bank", unit: "%" },
  { id: "AG.LND.FRST.ZS", label: "Forest area (% of land area)", source: "World Bank", unit: "%" },
];

const COUNTRIES_QUICK = [
  { code: "US", name: "United States", lat: 37.09, lng: -95.71 },
  { code: "CN", name: "China", lat: 35.0, lng: 105.0 },
  { code: "DE", name: "Germany", lat: 51.0, lng: 9.0 },
  { code: "IN", name: "India", lat: 20.0, lng: 77.0 },
  { code: "BR", name: "Brazil", lat: -10.0, lng: -55.0 },
  { code: "AU", name: "Australia", lat: -27.0, lng: 133.0 },
  { code: "GB", name: "United Kingdom", lat: 54.0, lng: -2.0 },
  { code: "JP", name: "Japan", lat: 36.0, lng: 138.0 },
];

const CHART_COLORS = ["#0D5C63", "#F4A261", "#2D6A4F", "#C1121F", "#8B5CF6"];

interface WBDataPoint { year: number; value: number }

export default function ResearchPage() {
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["US", "DE"]);
  const [selectedIndicator, setSelectedIndicator] = useState(INDICATORS[0].id);
  const [showRaw, setShowRaw] = useState(false);
  const [rawData, setRawData] = useState<Record<string, WBDataPoint[]>>({});
  const [tab, setTab] = useState<"timeseries" | "correlation" | "anomaly">("timeseries");

  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length < 5
        ? [...prev, code]
        : prev
    );
  };

  const indicator = INDICATORS.find((i) => i.id === selectedIndicator) ?? INDICATORS[0];

  const queries = COUNTRIES_QUICK.filter((c) => selectedCountries.includes(c.code)).map((country) =>
    useQuery({
      queryKey: ["wb", country.code, selectedIndicator],
      queryFn: async () => {
        const res = await fetch(
          `/api/climate/worldbank?country=${country.code}&indicator=${selectedIndicator}`
        );
        const json = await res.json() as { data: WBDataPoint[] };
        const data = json.data ?? [];
        setRawData((prev) => ({ ...prev, [country.code]: data }));
        return { country: country.name, code: country.code, data };
      },
    })
  );

  const isLoading = queries.some((q) => q.isLoading);
  const datasets = queries.map((q) => q.data).filter(Boolean) as { country: string; code: string; data: WBDataPoint[] }[];

  // Build merged time-series for chart
  const allYears = Array.from(new Set(datasets.flatMap((d) => d.data.map((p) => p.year)))).sort();
  const chartData = allYears.map((year) => {
    const row: Record<string, number | string> = { year };
    datasets.forEach((ds) => {
      const point = ds.data.find((p) => p.year === year);
      if (point) row[ds.country] = +point.value.toFixed(2);
    });
    return row;
  });

  // Anomaly detection (vs 10-yr moving average)
  const anomalyData = datasets[0]?.data.map((point, i, arr) => {
    const window = arr.slice(Math.max(0, i - 5), i + 5);
    const avg = window.reduce((s, p) => s + p.value, 0) / window.length;
    return {
      year: point.year,
      value: +point.value.toFixed(2),
      baseline: +avg.toFixed(2),
      anomaly: +(point.value - avg).toFixed(2),
    };
  }) ?? [];

  // Correlation matrix (just two-country if selected)
  const corrData = datasets.length >= 2
    ? allYears.map((year) => ({
        x: datasets[0]?.data.find((p) => p.year === year)?.value ?? null,
        y: datasets[1]?.data.find((p) => p.year === year)?.value ?? null,
        year,
      })).filter((d) => d.x !== null && d.y !== null)
    : [];

  const exportCSV = () => {
    const headers = ["Year", ...datasets.map((d) => d.country)];
    const rows = chartData.map((row) => [row.year, ...datasets.map((d) => row[d.country] ?? "")]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `climactix_${selectedIndicator}_${selectedCountries.join("_")}.csv`;
    a.click();
  };

  const exportJSON = () => {
    const json = JSON.stringify({ indicator, datasets }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `climactix_${selectedIndicator}.json`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="section-title">Research Data Explorer</h1>
        <p className="section-subtitle">Compare climate indicators across countries · powered by World Bank Climate API</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Sidebar: Controls */}
        <div className="xl:col-span-1 space-y-4">
          {/* Country selector */}
          <div className="card">
            <h3 className="font-bold text-brand-navy mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Countries (max 5)
            </h3>
            <div className="space-y-1.5">
              {COUNTRIES_QUICK.map((c) => {
                const active = selectedCountries.includes(c.code);
                const colorIdx = selectedCountries.indexOf(c.code);
                return (
                  <button
                    key={c.code}
                    onClick={() => toggleCountry(c.code)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? "text-white"
                        : "text-gray-600 hover:bg-gray-50 border border-gray-200"
                    }`}
                    style={active ? { backgroundColor: CHART_COLORS[colorIdx] ?? "#0D5C63" } : {}}
                    aria-pressed={active}
                  >
                    <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
                      style={active ? { backgroundColor: "rgba(255,255,255,0.25)" } : { backgroundColor: "#f0f0f0" }}>
                      {c.code}
                    </span>
                    {c.name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">{selectedCountries.length}/5 selected</p>
          </div>

          {/* Indicator selector */}
          <div className="card">
            <h3 className="font-bold text-brand-navy mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Climate Indicator
            </h3>
            <div className="space-y-2">
              {INDICATORS.map((ind) => (
                <button
                  key={ind.id}
                  onClick={() => setSelectedIndicator(ind.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedIndicator === ind.id
                      ? "bg-brand-bg border-2 border-brand-teal text-brand-teal"
                      : "border border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                  aria-pressed={selectedIndicator === ind.id}
                >
                  <div className="font-semibold">{ind.label}</div>
                  <div className="text-gray-400 mt-0.5">{ind.source} · {ind.unit}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Export */}
          <div className="card">
            <h3 className="font-bold text-brand-navy mb-3 flex items-center gap-2">
              <Download className="w-4 h-4" /> Export Data
            </h3>
            <div className="space-y-2">
              <button onClick={exportCSV} className="btn-secondary w-full text-sm py-2">
                Download CSV
              </button>
              <button onClick={exportJSON} className="btn-secondary w-full text-sm py-2">
                Download JSON
              </button>
            </div>
          </div>
        </div>

        {/* Main panel */}
        <div className="xl:col-span-3 space-y-6">
          {/* Tab navigation */}
          <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
            {(["timeseries", "correlation", "anomaly"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-all ${
                  tab === t ? "bg-brand-teal text-white shadow-sm" : "text-gray-500 hover:text-brand-navy"
                }`}
              >
                {t === "timeseries" ? "Time Series" : t === "correlation" ? "Correlation" : "Anomaly Detection"}
              </button>
            ))}
          </div>

          <ErrorBoundary>
            {isLoading ? (
              <SkeletonChart />
            ) : (
              <>
                {tab === "timeseries" && (
                  <div className="card">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-brand-navy">{indicator.label}</h3>
                        <p className="text-xs text-gray-400">{indicator.source} · {indicator.unit} · {selectedCountries.length} countries</p>
                      </div>
                      <span className="text-xs bg-brand-bg text-brand-teal px-2 py-1 rounded-full font-medium">
                        {chartData.length} data points
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                        <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        {datasets.map((ds, i) => (
                          <Line
                            key={ds.code}
                            type="monotone"
                            dataKey={ds.country}
                            stroke={CHART_COLORS[i] ?? "#888"}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {tab === "correlation" && (
                  <div className="card">
                    <div className="mb-4">
                      <h3 className="font-bold text-brand-navy">Correlation Analysis</h3>
                      <p className="text-xs text-gray-400">
                        {datasets[0]?.country ?? "Country 1"} vs {datasets[1]?.country ?? "Country 2"} · {indicator.label}
                      </p>
                    </div>
                    {corrData.length < 2 ? (
                      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                        Select at least 2 countries to view correlation
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            type="number"
                            dataKey="x"
                            name={datasets[0]?.country}
                            tick={{ fontSize: 10, fill: "#6b7280" }}
                            label={{ value: datasets[0]?.country, position: "insideBottom", offset: -10, fill: "#6b7280", fontSize: 11 }}
                          />
                          <YAxis
                            type="number"
                            dataKey="y"
                            name={datasets[1]?.country}
                            tick={{ fontSize: 10, fill: "#6b7280" }}
                          />
                          <Tooltip
                            cursor={{ strokeDasharray: "3 3" }}
                            formatter={(v: number, name: string) => [v.toFixed(2), name]}
                            contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
                          />
                          <Scatter data={corrData} fill="#0D5C63" fillOpacity={0.7} name="Year" />
                        </ScatterChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}

                {tab === "anomaly" && (
                  <div className="card">
                    <div className="mb-4">
                      <h3 className="font-bold text-brand-navy">Anomaly Detection</h3>
                      <p className="text-xs text-gray-400">
                        {datasets[0]?.country ?? "Select a country"} · {indicator.label} vs 5-year rolling average
                      </p>
                    </div>
                    {anomalyData.length === 0 ? (
                      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                        Select a country to view anomalies
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={anomalyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                          <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Line type="monotone" dataKey="value" stroke="#0D5C63" strokeWidth={2} dot={false} name="Actual" />
                          <Line type="monotone" dataKey="baseline" stroke="#F4A261" strokeWidth={2} strokeDasharray="5 5" dot={false} name="5-yr Baseline" />
                          <Line type="monotone" dataKey="anomaly" stroke="#C1121F" strokeWidth={1.5} dot={false} name="Anomaly" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </>
            )}
          </ErrorBoundary>

          {/* Data summary table */}
          {datasets.length > 0 && (
            <div className="card overflow-x-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-brand-navy">Latest Values Summary</h3>
                <span className="text-xs text-gray-400">Most recent available data</span>
              </div>
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Latest Year</th>
                    <th>Latest Value</th>
                    <th>5-Year Change</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((ds) => {
                    const sorted = [...ds.data].sort((a, b) => b.year - a.year);
                    const latest = sorted[0];
                    const fiveYrAgo = sorted.find((d) => d.year <= (latest?.year ?? 0) - 5);
                    const change = latest && fiveYrAgo
                      ? (((latest.value - fiveYrAgo.value) / fiveYrAgo.value) * 100).toFixed(1)
                      : null;
                    const trending = change !== null ? (parseFloat(change) > 0 ? "↑ Increasing" : "↓ Decreasing") : "—";
                    return (
                      <tr key={ds.code}>
                        <td className="font-medium">{ds.country}</td>
                        <td>{latest?.year ?? "—"}</td>
                        <td className="font-semibold text-brand-teal">
                          {latest ? latest.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} {indicator.unit}
                        </td>
                        <td className={change ? (parseFloat(change) > 0 ? "text-red-500" : "text-green-500") : ""}>
                          {change ? `${change}%` : "—"}
                        </td>
                        <td className={change ? (parseFloat(change) > 0 ? "text-red-500" : "text-green-500") : "text-gray-400"}>
                          {trending}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Raw API response panel */}
          <div className="card">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="w-full flex items-center justify-between font-semibold text-brand-navy text-sm"
            >
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4" /> Raw API Response Transparency
              </span>
              {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showRaw && (
              <div className="mt-4">
                <div className="text-xs text-gray-400 mb-2">
                  Source: World Bank API · Endpoint: /api/climate/worldbank?indicator={selectedIndicator}
                </div>
                <pre className="bg-gray-900 text-green-400 text-xs rounded-xl p-4 overflow-auto max-h-64 font-mono">
                  {JSON.stringify(rawData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
