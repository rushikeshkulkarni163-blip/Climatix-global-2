'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  X, Play, Pause, Plus, Layers, Activity, DollarSign,
  AlertTriangle, ChevronRight, MapPin, Zap, Wind, Droplets,
  Thermometer, Globe2, BarChart2, Settings2, RefreshCw,
} from 'lucide-react';

import type { SimAsset, ScenarioId, LayerType, AssetRiskProfile } from '@/types/simulation';
import { SAMPLE_ASSETS, ASSET_ICONS } from '@/lib/simulation/sampleAssets';
import { SCENARIOS } from '@/lib/simulation/ngfsScenarios';
import {
  computeAssetRisk, computePortfolio, projectAssetTimeSeries,
  generateRiskGrid, buildAssetGeoJSON, buildLinkGeoJSON, riskColor,
} from '@/lib/simulation/riskEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMELINE_YEARS = [2024, 2027, 2030, 2033, 2036, 2040, 2045, 2050];

const LAYER_META: Record<LayerType, { label: string; desc: string; icon: React.ComponentType<{ className?: string }> }> = {
  physical:   { label: 'Physical Risk',   desc: 'Heat, flood, storm, drought exposure',    icon: Thermometer },
  transition: { label: 'Transition Risk', desc: 'Policy, carbon pricing, technology shift', icon: Zap },
  carbon:     { label: 'Carbon Exposure', desc: 'Effective regional carbon price ($/tCO2)', icon: Wind },
  composite:  { label: 'Composite Risk',  desc: 'Weighted overall climate risk score',       icon: Layers },
};

function riskBg(level: string) {
  switch (level) {
    case 'critical': return 'bg-red-900/30 border-red-700/40 text-red-400';
    case 'high':     return 'bg-orange-900/30 border-orange-700/40 text-orange-400';
    case 'medium':   return 'bg-yellow-900/20 border-yellow-700/30 text-yellow-400';
    default:         return 'bg-emerald-900/20 border-emerald-700/30 text-emerald-400';
  }
}

function fmt(n: number, dec = 1) { return n.toFixed(dec); }
function fmtM(n: number) { return n >= 1000 ? `$${fmt(n / 1000, 1)}B` : `$${fmt(n, 0)}M`; }

// ─── Mini bar (used in risk breakdowns) ───────────────────────────────────────

function RiskBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden w-full">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Scenario selector button ─────────────────────────────────────────────────

function ScenarioBtn({
  id, active, onClick,
}: {
  id: ScenarioId; active: boolean; onClick: () => void;
}) {
  const s = SCENARIOS[id];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border transition-all duration-150 ${
        active
          ? 'border-white/30 bg-white/8'
          : 'border-[#1F1F1F] hover:border-[#333] hover:bg-[#111]'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/90">
          {s.shortLabel}
        </span>
        <span
          className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5"
          style={{ color: s.color, background: s.color + '22' }}
        >
          {s.label}
        </span>
      </div>
      <p className="text-[9px] text-[#6B7280] leading-snug">{s.description}</p>
      <div className="mt-1.5 flex gap-3 text-[9px] text-[#9CA3AF]">
        <span>Carbon 2030: <span className="text-white font-mono">${s.carbonPrice2030}/t</span></span>
        <span>2050: <span className="text-white font-mono">${s.carbonPrice2050}/t</span></span>
      </div>
    </button>
  );
}

// ─── Asset detail panel ───────────────────────────────────────────────────────

function AssetPanel({
  asset, risk, scenario, onClose,
}: {
  asset: SimAsset;
  risk: AssetRiskProfile;
  scenario: ScenarioId;
  onClose: () => void;
}) {
  const series = projectAssetTimeSeries(asset, scenario);
  const scnCfg = SCENARIOS[scenario];

  const physBreakdown = [
    { label: 'Heat Stress',  value: risk.heatStress,  color: '#F97316' },
    { label: 'Flood Risk',   value: risk.floodRisk,   color: '#3B82F6' },
    { label: 'Storm Risk',   value: risk.stormRisk,   color: '#8B5CF6' },
    { label: 'Drought Risk', value: risk.droughtRisk, color: '#F59E0B' },
  ];

  return (
    <div className="w-[300px] border-l border-[#1F1F1F] bg-[#080808] flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1F1F1F] flex items-start justify-between flex-shrink-0">
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280] mb-0.5">Asset Detail</div>
          <div className="font-bold text-white text-sm leading-tight truncate">{asset.name}</div>
          <div className="text-[10px] text-[#6B7280] mt-0.5 flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" />
            {asset.country} · {asset.sector}
          </div>
        </div>
        <button onClick={onClose} className="text-[#6B7280] hover:text-white ml-2 mt-0.5 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Overall risk badge */}
      <div className="px-4 pt-3 pb-3 border-b border-[#1A1A1A] flex-shrink-0">
        <div className={`border px-3 py-2.5 flex items-center justify-between ${riskBg(risk.riskLevel)}`}>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest opacity-70 mb-0.5">Overall Risk Score</div>
            <div className="text-2xl font-bold font-mono leading-none">{fmt(risk.overallRisk)}</div>
            <div className="text-[9px] uppercase tracking-widest opacity-80 mt-0.5">{risk.riskLevel}</div>
          </div>
          <div className="text-right">
            {risk.strandedRisk && (
              <div className="flex items-center gap-1 text-red-400 text-[9px] font-bold uppercase tracking-widest">
                <AlertTriangle className="w-3 h-3" />
                Stranded Risk
              </div>
            )}
            <div className="text-[9px] text-[#6B7280] mt-1">
              Scenario: <span style={{ color: scnCfg.color }}>{scnCfg.shortLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk breakdown */}
      <div className="px-4 py-3 border-b border-[#1A1A1A] flex-shrink-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280] mb-2.5">Risk Breakdown</div>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#9CA3AF]">Physical Risk</span>
              <span className="font-mono text-orange-400">{fmt(risk.physicalRisk)}</span>
            </div>
            <RiskBar value={risk.physicalRisk} color="#F97316" />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#9CA3AF]">Transition Risk</span>
              <span className="font-mono text-blue-400">{fmt(risk.transitionRisk)}</span>
            </div>
            <RiskBar value={risk.transitionRisk} color="#3B82F6" />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#9CA3AF]">Supply Chain Risk</span>
              <span className="font-mono text-purple-400">{fmt(risk.supplyChainRisk)}</span>
            </div>
            <RiskBar value={risk.supplyChainRisk} color="#8B5CF6" />
          </div>
        </div>
      </div>

      {/* Physical sub-scores */}
      <div className="px-4 py-3 border-b border-[#1A1A1A] flex-shrink-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280] mb-2.5">Physical Hazards</div>
        <div className="space-y-1.5">
          {physBreakdown.map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-20 text-[9px] text-[#6B7280] flex-shrink-0">{label}</div>
              <div className="flex-1">
                <RiskBar value={value} color={color} />
              </div>
              <div className="text-[10px] font-mono w-8 text-right" style={{ color }}>{fmt(value, 0)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial impact */}
      <div className="px-4 py-3 border-b border-[#1A1A1A] flex-shrink-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280] mb-2.5">Financial Impact</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Revenue at Risk', value: `${fmt(risk.revenueAtRisk)}%`, sub: fmtM((risk.revenueAtRisk / 100) * asset.revenue), color: '#EF4444' },
            { label: 'EBITDA Impact',   value: `${fmt(risk.ebitdaImpact)}%`,  sub: 'of EBITDA',                                      color: '#F97316' },
            { label: 'Carbon Cost',     value: fmtM(risk.complianceCostM),    sub: `$${fmt(risk.carbonPriceExposure, 0)}/tCO₂`,      color: '#8B5CF6' },
            { label: 'Supply Disruption', value: `${fmt(risk.supplyChainRisk, 0)}`,  sub: 'probability score',                       color: '#3B82F6' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-[#0D0D0D] border border-[#1A1A1A] px-2.5 py-2">
              <div className="text-[8px] uppercase tracking-widest text-[#6B7280] mb-0.5">{label}</div>
              <div className="text-sm font-bold font-mono leading-none" style={{ color }}>{value}</div>
              <div className="text-[9px] text-[#4B5563] mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Asset metadata */}
      <div className="px-4 py-3 border-b border-[#1A1A1A] flex-shrink-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280] mb-2.5">Asset Metadata</div>
        <div className="space-y-1">
          {[
            ['Revenue', fmtM(asset.revenue)],
            ['Capex', fmtM(asset.capex)],
            ['Employees', asset.employees.toLocaleString()],
            ['Scope 1', `${(asset.scope1 / 1000).toFixed(0)}k tCO₂e`],
            ['Scope 2', `${(asset.scope2 / 1000).toFixed(0)}k tCO₂e`],
            ['Coordinates', `${asset.lat.toFixed(2)}°, ${asset.lng.toFixed(2)}°`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-[10px]">
              <span className="text-[#6B7280]">{k}</span>
              <span className="font-mono text-[#9CA3AF]">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Time-series projection chart */}
      <div className="px-4 py-3 flex-shrink-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280] mb-3">Risk Projection 2024–2050</div>
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart data={series} margin={{ top: 2, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1A1A1A" />
            <XAxis dataKey="year" tick={{ fontSize: 8, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 8, fill: '#6B7280' }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: '#0D0D0D', border: '1px solid #1F1F1F', fontSize: 9, color: '#fff' }}
              formatter={(v: number) => [fmt(v), '']}
            />
            <Area
              type="monotone" dataKey="physicalRisk"
              stroke="#F97316" fill="#F97316" fillOpacity={0.12}
              strokeWidth={1.5} name="Physical"
            />
            <Area
              type="monotone" dataKey="transitionRisk"
              stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.10}
              strokeWidth={1.5} name="Transition"
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex gap-3 mt-1.5">
          <div className="flex items-center gap-1 text-[9px] text-[#9CA3AF]">
            <div className="w-3 h-0.5 bg-orange-500 rounded" />Physical
          </div>
          <div className="flex items-center gap-1 text-[9px] text-[#9CA3AF]">
            <div className="w-3 h-0.5 bg-blue-500 rounded" />Transition
          </div>
        </div>
      </div>

      {/* Revenue at risk mini chart */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Revenue at Risk % (Projected)</div>
        <ResponsiveContainer width="100%" height={70}>
          <LineChart data={series} margin={{ top: 2, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1A1A1A" />
            <XAxis dataKey="year" tick={{ fontSize: 8, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 8, fill: '#6B7280' }} />
            <Tooltip
              contentStyle={{ background: '#0D0D0D', border: '1px solid #1F1F1F', fontSize: 9 }}
              formatter={(v: number) => [`${fmt(v)}%`, 'Revenue at Risk']}
            />
            <Line type="monotone" dataKey="revenueAtRisk" stroke="#EF4444" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Portfolio stats bar ──────────────────────────────────────────────────────

function PortfolioBar({
  stats, scenario, year,
}: {
  stats: ReturnType<typeof computePortfolio>;
  scenario: ScenarioId;
  year: number;
}) {
  const scn = SCENARIOS[scenario];
  return (
    <div className="h-10 bg-black border-b border-[#1F1F1F] flex items-center px-4 gap-0 flex-shrink-0 overflow-x-auto">
      {/* Scenario tag */}
      <div
        className="flex items-center gap-1.5 px-3 h-full border-r border-[#1F1F1F] flex-shrink-0"
        style={{ background: scn.color + '18' }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: scn.color }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: scn.color }}>
          {scn.shortLabel} / {scn.label}
        </span>
      </div>

      {[
        { label: 'ASSETS', value: String(stats.assetCount) },
        { label: 'PORTFOLIO REV', value: fmtM(stats.totalRevenueM) },
        { label: 'REV AT RISK', value: fmtM(stats.totalRevenueAtRiskM), color: '#EF4444' },
        { label: 'COMPLIANCE COST', value: fmtM(stats.totalComplianceCostM), color: '#F97316' },
        { label: 'AVG PHYSICAL RISK', value: `${fmt(stats.avgPhysicalRisk)}/100`, color: '#F59E0B' },
        { label: 'AVG TRANSITION RISK', value: `${fmt(stats.avgTransitionRisk)}/100`, color: '#3B82F6' },
        { label: 'HIGH RISK', value: String(stats.highRiskAssets), color: '#F97316' },
        { label: 'CRITICAL', value: String(stats.criticalRiskAssets), color: '#EF4444' },
      ].map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-2 px-3 h-full border-r border-[#1F1F1F] flex-shrink-0">
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#4B5563]">{label}</span>
          <span className="text-[11px] font-bold font-mono" style={{ color: color ?? '#9CA3AF' }}>{value}</span>
        </div>
      ))}

      <div className="ml-auto flex items-center gap-2 px-3 flex-shrink-0">
        <span className="text-[8px] text-[#4B5563] uppercase tracking-widest">Year</span>
        <span className="text-[11px] font-bold font-mono text-white">{year}</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClimateRiskMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  const [scenario, setScenario] = useState<ScenarioId>('2.0');
  const [year, setYear] = useState(2030);
  const [activeLayer, setActiveLayer] = useState<LayerType>('physical');
  const [selectedAsset, setSelectedAsset] = useState<SimAsset | null>(null);
  const [assets, setAssets] = useState<SimAsset[]>(SAMPLE_ASSETS);
  const [addMode, setAddMode] = useState(false);
  const [addForm, setAddForm] = useState<{ lat: number; lng: number } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showLinks, setShowLinks] = useState(true);
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetSector, setNewAssetSector] = useState('Manufacturing');
  const [newAssetRevenue, setNewAssetRevenue] = useState('500');

  const addModeRef = useRef(false);
  const assetsRef = useRef(assets);
  const setSelectedAssetRef = useRef(setSelectedAsset);

  useEffect(() => { addModeRef.current = addMode; }, [addMode]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);

  const portfolio = computePortfolio(assets, scenario, year);
  const selectedRisk = selectedAsset
    ? computeAssetRisk(selectedAsset, scenario, year)
    : null;

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let destroyed = false;

    const initMap = async () => {
      // Load MapLibre CSS
      if (!document.querySelector('#mlgl-css')) {
        const link = document.createElement('link');
        link.id = 'mlgl-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
        document.head.appendChild(link);
      }

      const mlgl = (await import('maplibre-gl')).default;
      if (destroyed || !mapContainer.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = new (mlgl as any).Map({
        container: mapContainer.current,
        style: {
          version: 8 as const,
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
          sources: {
            'carto-dark': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors © CARTO',
              maxzoom: 19,
            },
          },
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: { 'background-color': '#060606' },
            },
            {
              id: 'carto-tiles',
              type: 'raster',
              source: 'carto-dark',
              paint: { 'raster-opacity': 0.82 },
            },
          ],
        },
        center: [20, 22],
        zoom: 2.1,
        minZoom: 1.2,
        maxZoom: 14,
        attributionControl: false,
      });

      // Attribution (compact)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.addControl(new (mlgl as any).AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        if (destroyed) return;
        mapRef.current = map;

        const riskData = generateRiskGrid('2.0', 2030, 'physical');
        const assetData = buildAssetGeoJSON(SAMPLE_ASSETS, '2.0', 2030);
        const linkData = buildLinkGeoJSON(SAMPLE_ASSETS);

        // ── Risk heatmap ──
        map.addSource('risk-grid', { type: 'geojson', data: riskData as object });
        map.addLayer({
          id: 'risk-heatmap',
          type: 'heatmap',
          source: 'risk-grid',
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0, 1, 1],
            'heatmap-intensity': 1.8,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,   'rgba(0,0,0,0)',
              0.15,'rgba(16,185,129,0.18)',
              0.35,'rgba(245,158,11,0.28)',
              0.55,'rgba(249,115,22,0.40)',
              0.75,'rgba(239,68,68,0.52)',
              1.0, 'rgba(220,38,38,0.72)',
            ],
            'heatmap-radius': 55,
            'heatmap-opacity': 0.78,
          },
        });

        // ── Supply-chain links ──
        map.addSource('links', { type: 'geojson', data: linkData as object });
        map.addLayer({
          id: 'supply-links',
          type: 'line',
          source: 'links',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#4B5563',
            'line-width': 1.2,
            'line-dasharray': [3, 4],
            'line-opacity': 0.65,
          },
        });

        // ── Asset circles ──
        map.addSource('assets', { type: 'geojson', data: assetData as object });
        map.addLayer({
          id: 'asset-shadow',
          type: 'circle',
          source: 'assets',
          paint: {
            'circle-radius': 16,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.12,
            'circle-blur': 1.2,
          },
        });
        map.addLayer({
          id: 'asset-circles',
          type: 'circle',
          source: 'assets',
          paint: {
            'circle-radius': 8,
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(255,255,255,0.75)',
            'circle-opacity': 0.95,
          },
        });

        // ── Asset click ──
        map.on('click', 'asset-circles', (e: { features: { properties: { id: string } }[] }) => {
          if (!e.features?.length) return;
          const assetId = e.features[0].properties?.id;
          const asset = assetsRef.current.find(a => a.id === assetId);
          if (asset) setSelectedAssetRef.current(asset);
        });

        // ── Map click (add mode) ──
        map.on('click', (e: { lngLat: { lat: number; lng: number }; defaultPrevented: boolean }) => {
          if (e.defaultPrevented) return;
          if (!addModeRef.current) return;
          setAddForm({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        });

        map.on('mouseenter', 'asset-circles', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'asset-circles', () => {
          map.getCanvas().style.cursor = '';
        });

        setMapLoaded(true);
      });
    };

    initMap();

    return () => {
      destroyed = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, []); // intentionally empty — runs once

  // ── Update layers on state changes ─────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current as {
      getSource: (id: string) => { setData: (d: unknown) => void } | undefined;
      getCanvas: () => HTMLCanvasElement;
    };

    const riskSrc = map.getSource('risk-grid');
    if (riskSrc) riskSrc.setData(generateRiskGrid(scenario, year, activeLayer) as object);

    const assetSrc = map.getSource('assets');
    if (assetSrc) assetSrc.setData(buildAssetGeoJSON(assets, scenario, year) as object);

    const linkSrc = map.getSource('links');
    if (linkSrc) linkSrc.setData(buildLinkGeoJSON(assets) as object);

    // Cursor for add mode
    map.getCanvas().style.cursor = addMode ? 'crosshair' : '';
  }, [scenario, year, activeLayer, assets, mapLoaded, addMode, showLinks]);

  // ── Toggle link visibility ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current as {
      setLayoutProperty: (id: string, prop: string, val: string) => void;
    };
    map.setLayoutProperty('supply-links', 'visibility', showLinks ? 'visible' : 'none');
  }, [showLinks, mapLoaded]);

  // ── Timeline animation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return;
    const idx = TIMELINE_YEARS.indexOf(year);
    if (idx === TIMELINE_YEARS.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setYear(TIMELINE_YEARS[idx + 1]), 1400);
    return () => clearTimeout(t);
  }, [playing, year]);

  // ── Add new asset ───────────────────────────────────────────────────────────
  const commitAddAsset = useCallback(() => {
    if (!addForm || !newAssetName.trim()) return;
    const newAsset: SimAsset = {
      id: `user_${Date.now()}`,
      name: newAssetName.trim(),
      category: 'factory',
      lat: addForm.lat,
      lng: addForm.lng,
      revenue: parseFloat(newAssetRevenue) || 500,
      employees: 500,
      country: 'Unknown',
      region: 'User-defined',
      sector: newAssetSector,
      capex: parseFloat(newAssetRevenue) * 1.5,
      scope1: 100_000,
      scope2: 60_000,
    };
    setAssets(prev => [...prev, newAsset]);
    setAddForm(null);
    setAddMode(false);
    setNewAssetName('');
    setNewAssetRevenue('500');
  }, [addForm, newAssetName, newAssetRevenue, newAssetSector]);

  const SECTORS = ['Energy', 'Manufacturing', 'Mining', 'Agriculture', 'Real Estate', 'Finance', 'Technology', 'Logistics', 'Shipping'];

  return (
    <div className="flex flex-col bg-black" style={{ height: 'calc(100vh - 44px)' }}>

      {/* ── Portfolio stats bar ── */}
      <PortfolioBar stats={portfolio} scenario={scenario} year={year} />

      {/* ── Main area ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left panel ── */}
        <div className="w-[262px] border-r border-[#1F1F1F] bg-[#060606] flex flex-col overflow-y-auto flex-shrink-0">

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-[#1A1A1A]">
            <div className="flex items-center gap-2">
              <Globe2 className="w-3.5 h-3.5 text-[#4B5563]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280]">Climate Scenario</span>
            </div>
          </div>

          {/* Scenario selection */}
          <div className="p-3 space-y-1.5 border-b border-[#1A1A1A]">
            {(['1.5', '2.0', '3.0'] as ScenarioId[]).map(id => (
              <ScenarioBtn key={id} id={id} active={scenario === id} onClick={() => setScenario(id)} />
            ))}
          </div>

          {/* Layer controls */}
          <div className="px-4 py-3 border-b border-[#1A1A1A]">
            <div className="flex items-center gap-2 mb-2.5">
              <Layers className="w-3 h-3 text-[#4B5563]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280]">Risk Layer</span>
            </div>
            <div className="space-y-1">
              {(Object.entries(LAYER_META) as [LayerType, typeof LAYER_META[LayerType]][]).map(([id, meta]) => {
                const Icon = meta.icon;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveLayer(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left border transition-colors ${
                      activeLayer === id
                        ? 'border-white/20 bg-white/6 text-white'
                        : 'border-transparent text-[#6B7280] hover:border-[#1F1F1F] hover:text-[#9CA3AF]'
                    }`}
                  >
                    <Icon className="w-3 h-3 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold truncate">{meta.label}</div>
                      <div className="text-[8px] opacity-60 truncate">{meta.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Overlay options */}
          <div className="px-4 py-3 border-b border-[#1A1A1A]">
            <div className="flex items-center gap-2 mb-2.5">
              <Settings2 className="w-3 h-3 text-[#4B5563]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280]">Overlays</span>
            </div>
            <button
              onClick={() => setShowLinks(v => !v)}
              className={`w-full flex items-center gap-2 px-3 py-2 border text-left text-[10px] transition-colors ${
                showLinks
                  ? 'border-white/15 bg-white/5 text-[#9CA3AF]'
                  : 'border-[#1A1A1A] text-[#4B5563] hover:border-[#2A2A2A]'
              }`}
            >
              <ChevronRight className="w-3 h-3" />
              Supply Chain Links
              <span className={`ml-auto text-[8px] uppercase tracking-widest ${showLinks ? 'text-emerald-500' : 'text-[#4B5563]'}`}>
                {showLinks ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Asset list */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="sticky top-0 bg-[#060606] px-4 py-2.5 border-b border-[#1A1A1A] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-[#4B5563]" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280]">
                    Assets ({assets.length})
                  </span>
                </div>
                <button
                  onClick={() => { setAddMode(v => !v); setAddForm(null); }}
                  className={`flex items-center gap-1 text-[9px] px-2 py-1 border transition-colors ${
                    addMode
                      ? 'border-white/30 text-white bg-white/8'
                      : 'border-[#2A2A2A] text-[#6B7280] hover:border-[#444] hover:text-white'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  {addMode ? 'Click Map' : 'Add'}
                </button>
              </div>
              {addMode && (
                <div className="mt-2 text-[9px] text-yellow-400 bg-yellow-900/20 border border-yellow-800/30 px-2 py-1.5">
                  Click any location on the map to place an asset
                </div>
              )}
            </div>

            <div className="py-1">
              {assets.map(asset => {
                const risk = computeAssetRisk(asset, scenario, year);
                const isSelected = selectedAsset?.id === asset.id;
                return (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedAsset(isSelected ? null : asset)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left border-b border-[#0F0F0F] transition-colors hover:bg-[#0D0D0D] ${
                      isSelected ? 'bg-[#0F0F0F] border-l-2 border-l-white/20' : ''
                    }`}
                  >
                    <div
                      className="w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 border"
                      style={{ borderColor: riskColor(risk.riskLevel) + '60', background: riskColor(risk.riskLevel) + '18' }}
                    >
                      {ASSET_ICONS[asset.category]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold text-white/90 truncate leading-tight">{asset.name}</div>
                      <div className="text-[8px] text-[#4B5563] truncate mt-0.5">{asset.country} · {asset.sector}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div
                        className="text-[11px] font-bold font-mono"
                        style={{ color: riskColor(risk.riskLevel) }}
                      >
                        {Math.round(risk.overallRisk)}
                      </div>
                      <div className="text-[8px] uppercase tracking-widest" style={{ color: riskColor(risk.riskLevel) + 'CC' }}>
                        {risk.riskLevel}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-[#1A1A1A] flex-shrink-0">
            <div className="text-[8px] font-bold uppercase tracking-widest text-[#4B5563] mb-2">Risk Legend</div>
            <div className="flex gap-2">
              {[
                { label: 'Low',      color: '#10B981' },
                { label: 'Medium',   color: '#F59E0B' },
                { label: 'High',     color: '#F97316' },
                { label: 'Critical', color: '#EF4444' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-[8px] text-[#6B7280]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Map container ── */}
        <div className="flex-1 relative overflow-hidden">
          <div ref={mapContainer} className="absolute inset-0" />

          {/* Loading overlay */}
          {!mapLoaded && (
            <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-3 animate-pulse">
                  Initializing Climate Intelligence Layer…
                </div>
                <div className="w-48 h-0.5 bg-[#1A1A1A] rounded overflow-hidden mx-auto">
                  <div className="h-full bg-white/20 animate-pulse rounded" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          )}

          {/* Add asset form (appears after clicking map) */}
          {addForm && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-[#0A0A0A] border border-[#2A2A2A] w-72 shadow-2xl">
              <div className="px-4 py-3 border-b border-[#1A1A1A] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">Add Project</span>
                <button onClick={() => { setAddForm(null); setAddMode(false); }}>
                  <X className="w-3.5 h-3.5 text-[#6B7280] hover:text-white" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-widest text-[#6B7280] mb-1.5">Asset Name</div>
                  <input
                    autoFocus
                    value={newAssetName}
                    onChange={e => setNewAssetName(e.target.value)}
                    className="w-full bg-[#111] border border-[#2A2A2A] text-white text-xs px-3 py-2 focus:outline-none focus:border-white/30"
                    placeholder="e.g. Bangkok Production Hub"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[8px] font-bold uppercase tracking-widest text-[#6B7280] mb-1.5">Sector</div>
                    <select
                      value={newAssetSector}
                      onChange={e => setNewAssetSector(e.target.value)}
                      className="w-full bg-[#111] border border-[#2A2A2A] text-white text-xs px-2 py-2 focus:outline-none focus:border-white/30"
                    >
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-[8px] font-bold uppercase tracking-widest text-[#6B7280] mb-1.5">Revenue ($M)</div>
                    <input
                      type="number"
                      value={newAssetRevenue}
                      onChange={e => setNewAssetRevenue(e.target.value)}
                      className="w-full bg-[#111] border border-[#2A2A2A] text-white text-xs px-3 py-2 focus:outline-none focus:border-white/30"
                      placeholder="500"
                    />
                  </div>
                </div>
                <div className="text-[9px] text-[#4B5563] font-mono">
                  {addForm.lat.toFixed(3)}°, {addForm.lng.toFixed(3)}°
                </div>
                <button
                  onClick={commitAddAsset}
                  disabled={!newAssetName.trim()}
                  className="w-full bg-white text-black text-[10px] font-bold uppercase tracking-widest py-2 disabled:opacity-30 hover:bg-gray-100 transition-colors"
                >
                  Analyse Risk + Add
                </button>
              </div>
            </div>
          )}

          {/* Map attribution / branding */}
          <div className="absolute bottom-[68px] left-4 z-10 pointer-events-none">
            <div className="text-[8px] font-bold uppercase tracking-widest text-white/30">
              CLIMACTIX CLIMATE INTELLIGENCE LAYER
            </div>
            <div className="text-[7px] text-white/15 mt-0.5">
              Scenario: NGFS Phase IV · Data: NGFS Scenario Explorer
            </div>
          </div>
        </div>

        {/* ── Right panel (asset detail) ── */}
        {selectedAsset && selectedRisk && (
          <AssetPanel
            asset={selectedAsset}
            risk={selectedRisk}
            scenario={scenario}
            onClose={() => setSelectedAsset(null)}
          />
        )}
      </div>

      {/* ── Timeline bar ── */}
      <div className="h-[58px] border-t border-[#1F1F1F] bg-black flex items-center px-5 gap-4 flex-shrink-0">
        <button
          onClick={() => {
            if (year === TIMELINE_YEARS[TIMELINE_YEARS.length - 1]) setYear(TIMELINE_YEARS[0]);
            setPlaying(v => !v);
          }}
          className="flex items-center gap-1.5 border border-[#2A2A2A] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] hover:text-white hover:border-[#444] transition-colors flex-shrink-0"
        >
          {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {playing ? 'Pause' : 'Play'}
        </button>

        <button
          onClick={() => { setYear(2024); setPlaying(false); }}
          className="p-1.5 text-[#4B5563] hover:text-white transition-colors flex-shrink-0"
          title="Reset to 2024"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1 flex items-center gap-1 min-w-0">
          {TIMELINE_YEARS.map((y, i) => {
            const isActive = y === year;
            const isPast = y < year;
            return (
              <button
                key={y}
                onClick={() => { setYear(y); setPlaying(false); }}
                className="flex-1 relative flex flex-col items-center group"
              >
                {/* Track line */}
                <div
                  className="w-full h-0.5 mb-1.5 transition-colors"
                  style={{
                    background: isPast || isActive
                      ? SCENARIOS[scenario].color
                      : '#1F1F1F',
                  }}
                />
                {/* Tick dot */}
                <div
                  className={`w-2 h-2 rounded-full border transition-all absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 ${
                    isActive ? 'scale-150 border-white' : 'border-[#2A2A2A] group-hover:border-[#555]'
                  }`}
                  style={{
                    background: isActive
                      ? SCENARIOS[scenario].color
                      : isPast ? SCENARIOS[scenario].color + '80' : '#1A1A1A',
                  }}
                />
                {/* Label */}
                <span
                  className={`text-[9px] font-mono transition-colors ${
                    isActive ? 'text-white font-bold' : isPast ? 'text-[#6B7280]' : 'text-[#3A3A3A] group-hover:text-[#6B7280]'
                  }`}
                >
                  {y}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-l border-[#1A1A1A] pl-4 flex-shrink-0">
          <BarChart2 className="w-3.5 h-3.5 text-[#4B5563]" />
          <div>
            <div className="text-[8px] text-[#4B5563] uppercase tracking-widest">Simulation Year</div>
            <div className="text-lg font-bold font-mono text-white leading-none">{year}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
