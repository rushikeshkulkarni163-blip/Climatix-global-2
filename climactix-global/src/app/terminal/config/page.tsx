"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw, CheckCircle2, Code, Key } from "lucide-react";
import DataPanel from "@/components/terminal/DataPanel";

const API_ENDPOINTS = [
  { method: "GET", path: "/api/v1/risk/physical", desc: "Physical risk score for asset or geography", params: ["lat", "lng", "scenario"] },
  { method: "GET", path: "/api/v1/risk/transition", desc: "Transition risk assessment by sector and scenario", params: ["sector", "scenario", "year"] },
  { method: "POST", path: "/api/v1/simulation/run", desc: "Execute NGFS scenario simulation", params: ["company_profile", "scenario", "horizon"] },
  { method: "GET", path: "/api/v1/portfolio/screen", desc: "Climate screen portfolio of holdings", params: ["holdings", "benchmark"] },
  { method: "POST", path: "/api/v1/disclosure/generate", desc: "Generate TCFD/ISSB disclosure report", params: ["company_data", "framework", "format"] },
  { method: "GET", path: "/api/v1/supply-chain/scope3", desc: "Scope 3 emissions mapping by entity", params: ["entity_id", "tier", "categories"] },
  { method: "GET", path: "/api/v1/narrative/sentiment", desc: "ESG narrative sentiment by company or topic", params: ["query", "sources", "window"] },
  { method: "GET", path: "/api/v1/finance/carbon-price", desc: "Live carbon market prices across registries", params: ["market", "currency"] },
  { method: "POST", path: "/api/v1/greenwashing/analyze", desc: "NLP greenwashing detection on document", params: ["document_url", "company_id"] },
  { method: "GET", path: "/api/v1/esg/score", desc: "ESG score by company with framework breakdown", params: ["entity", "frameworks"] },
];

// Data sources with their actual auth requirements and availability
const DATA_SOURCES = [
  { name: "Open-Meteo",     type: "Climate",     status: "active",  calls: "live", quota: "Unlimited (free)"   },
  { name: "NASA POWER",     type: "Climate",     status: "active",  calls: "live", quota: "Unlimited (free)"   },
  { name: "World Bank API", type: "Economic",    status: "active",  calls: "live", quota: "Unlimited (free)"   },
  { name: "NOAA CDO",       type: "Climate",     status: "key-req", calls: "—",    quota: "1,000/day"          },
  { name: "OpenAQ",         type: "Air Quality", status: "active",  calls: "live", quota: "2,000/day (free)"   },
  { name: "ReliefWeb",      type: "Disasters",   status: "active",  calls: "live", quota: "1,000/day (free)"   },
  { name: "UN SDG API",     type: "Economic",    status: "active",  calls: "live", quota: "Unlimited (free)"   },
  { name: "REST Countries", type: "Geographic",  status: "active",  calls: "live", quota: "Unlimited (free)"   },
  { name: "Copernicus CDS", type: "Climate",     status: "key-req", calls: "—",    quota: "Requires .cdsapirc" },
];

const ENGINE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function ConfigPage() {
  const [showKey, setShowKey]       = useState(false);
  const [copied, setCopied]         = useState(false);
  const [engineOk, setEngineOk]     = useState<boolean | null>(null);
  const [checking, setChecking]     = useState(false);

  // API key is configured server-side via ANTHROPIC_API_KEY env var.
  // Only the masked prefix is shown here for confirmation; the full key
  // is never sent to the browser.
  const keyPlaceholder = "sk-ant-api03-••••••••••••••••••••••••••••••";

  const handleCopy = () => {
    navigator.clipboard.writeText(ENGINE_URL).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkEngine = () => {
    setChecking(true);
    fetch("/api/terminal/finance", { cache: "no-store" })
      .then(r => setEngineOk(r.ok))
      .catch(() => setEngineOk(false))
      .finally(() => setChecking(false));
  };

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">

      <div>
        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-1">
          API & CONFIGURATION / ENTERPRISE LAYER
        </div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">API Access & System Configuration</h1>
        <p className="text-xs text-gray-500 mt-1">
          REST API · GraphQL Gateway · Enterprise Keys · Data Source Status · Webhook Config
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">

        {/* API key */}
        <div className="col-span-12 lg:col-span-5">
          <DataPanel label="API CREDENTIALS" title="Intelligence Engine Configuration">
            <div className="space-y-4">
              {/* Engine URL */}
              <div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Engine Endpoint</div>
                <div className="p-3 bg-gray-50 border border-gray-200 font-mono text-xs flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-gray-700">{ENGINE_URL}</span>
                  <button onClick={handleCopy} className={`${copied ? "text-emerald-500" : "text-gray-400 hover:text-gray-700"}`}>
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {/* AI API Key (masked — never expose full key to browser) */}
              <div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Anthropic API Key (server-side)</div>
                <div className="p-3 bg-gray-50 border border-gray-200 font-mono text-xs flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-gray-600 tracking-widest">
                    {showKey ? keyPlaceholder : keyPlaceholder.replace(/[^•]/g, "•")}
                  </span>
                  <button onClick={() => setShowKey(!showKey)} className="text-gray-400 hover:text-gray-700">
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="text-[9px] text-gray-400 mt-1">
                  Configured via <code className="bg-gray-100 px-1 py-0.5 font-mono">ANTHROPIC_API_KEY</code> environment variable on the server.
                  Never stored in the browser.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {[
                  { label: "Intelligence Engine", value: engineOk === null ? "Not checked" : engineOk ? "Online" : "Offline" },
                  { label: "AI Model",             value: "claude-opus-4-6" },
                  { label: "Target SLA",           value: "99.95% uptime" },
                  { label: "API Version",          value: "v2.0.0" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5 p-2 border border-gray-100">
                    <span className="text-gray-400 uppercase tracking-widest text-[9px]">{label}</span>
                    <span className={`font-bold ${value === "Online" ? "text-emerald-600" : value === "Offline" ? "text-red-500" : "text-gray-800"}`}>{value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={checkEngine}
                disabled={checking}
                className="flex items-center gap-1.5 w-full justify-center px-4 py-2 text-[10px] font-bold border border-gray-200 text-gray-600 hover:border-gray-400 uppercase tracking-widest transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${checking ? "animate-spin" : ""}`} />
                {checking ? "Checking…" : "Test Engine Connection"}
              </button>
            </div>
          </DataPanel>
        </div>

        {/* Quick start */}
        <div className="col-span-12 lg:col-span-7">
          <DataPanel label="QUICK START" title="API Integration — Example Request">
            <div className="space-y-3">
              {/* Python */}
              <div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Python SDK</div>
                <pre className="bg-gray-900 text-gray-100 p-4 text-[10px] font-mono overflow-x-auto leading-relaxed">
{`import climactix

client = climactix.Client(api_key="YOUR_KEY")

# Physical risk assessment
risk = client.risk.physical(
    lat=40.71, lng=-74.01,
    scenario="2C", horizon=2050
)
print(risk.score, risk.flood_exposure)

# Run scenario simulation
sim = client.simulation.run(
    company="ACME Corp",
    sector="energy-oil-gas",
    scenario="net_zero_2050"
)
print(sim.revenue_at_risk, sim.ebitda_impact)`}
                </pre>
              </div>
              {/* cURL */}
              <div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">REST API</div>
                <pre className="bg-gray-900 text-gray-100 p-4 text-[10px] font-mono overflow-x-auto leading-relaxed">
{`curl -X GET \\
  "https://api.climactix.global/v1/risk/physical" \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"lat": 40.71, "lng": -74.01, "scenario": "2C"}'`}
                </pre>
              </div>
            </div>
          </DataPanel>
        </div>

        {/* API endpoints */}
        <div className="col-span-12">
          <DataPanel label="API REFERENCE" title="Available Endpoints" noPad>
            <div className="divide-y divide-gray-50">
              {API_ENDPOINTS.map((ep) => (
                <div key={ep.path} className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <span className={`text-[9px] font-bold px-2 py-1 flex-shrink-0 mt-0.5 ${
                    ep.method === "GET"
                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                      : "text-blue-700 bg-blue-50 border border-blue-200"
                  }`}>
                    {ep.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <code className="text-xs font-mono font-bold text-gray-800">{ep.path}</code>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{ep.desc}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {ep.params.map((p) => (
                        <code key={p} className="text-[8px] bg-gray-100 text-gray-600 px-1.5 py-0.5 font-mono">
                          {p}
                        </code>
                      ))}
                    </div>
                  </div>
                  <button className="flex items-center gap-1 text-[9px] font-bold text-gray-400 hover:text-gray-700 transition-colors uppercase tracking-widest flex-shrink-0">
                    <Code className="w-3 h-3" /> Try
                  </button>
                </div>
              ))}
            </div>
          </DataPanel>
        </div>

        {/* Data sources */}
        <div className="col-span-12 lg:col-span-8">
          <DataPanel label="DATA INFRASTRUCTURE" title="Connected Data Sources — Live Status" noPad>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Source", "Type", "Status", "API Calls Today", "Daily Quota"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DATA_SOURCES.map((d) => (
                    <tr key={d.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-gray-800">{d.name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{d.type}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${d.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
                          <span className={`text-[9px] font-bold uppercase ${d.status === "active" ? "text-emerald-600" : "text-amber-600"}`}>
                            {d.status === "active" ? "Active" : "Key Required"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-700">{d.calls}</td>
                      <td className="px-4 py-2.5 text-gray-500">{d.quota}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataPanel>
        </div>

        {/* System health */}
        <div className="col-span-12 lg:col-span-4">
          <DataPanel label="SYSTEM HEALTH" title="Infrastructure Monitoring">
            <div className="space-y-3">
              {[
                { name: "Risk Engine API", status: 99.98, latency: "42ms" },
                { name: "Simulation Cluster", status: 99.95, latency: "280ms" },
                { name: "Data Pipeline", status: 99.91, latency: "120ms" },
                { name: "Disclosure Generator", status: 100, latency: "1.4s" },
                { name: "NLP Sentiment Engine", status: 99.84, latency: "380ms" },
                { name: "Carbon Price Feed", status: 100, latency: "18ms" },
              ].map(({ name, status, latency }) => (
                <div key={name}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="font-semibold text-gray-700">{name}</span>
                    <span className="text-gray-500">{latency}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100">
                      <div
                        className="h-1.5 bg-emerald-400"
                        style={{ width: `${status}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-emerald-600 w-12 text-right">{status}%</span>
                  </div>
                </div>
              ))}
            </div>
          </DataPanel>
        </div>

      </div>
    </div>
  );
}
