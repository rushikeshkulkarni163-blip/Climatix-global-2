"use client";

import { useState, useRef } from "react";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Clock,
  Download, Layers, Shield, Zap, XCircle
} from "lucide-react";
import DataPanel from "@/components/terminal/DataPanel";
import RiskBadgeT from "@/components/terminal/RiskBadgeT";

// ── Types & data ──────────────────────────────────────────────────────────────

const FRAMEWORKS = [
  { id: "tcfd", label: "TCFD", full: "Task Force on Climate-related Financial Disclosures", status: "ready" },
  { id: "issb", label: "IFRS S2", full: "ISSB Climate-related Disclosures Standard", status: "ready" },
  { id: "csrd", label: "CSRD", full: "Corporate Sustainability Reporting Directive", status: "ready" },
  { id: "brsr", label: "BRSR", full: "Business Responsibility & Sustainability Report", status: "beta" },
  { id: "gri", label: "GRI 305", full: "GRI Standards — Emissions Disclosure", status: "ready" },
  { id: "cdp", label: "CDP", full: "Carbon Disclosure Project", status: "ready" },
  { id: "sbti", label: "SBTi", full: "Science Based Targets Initiative", status: "beta" },
  { id: "sasb", label: "SASB", full: "Sustainability Accounting Standards Board", status: "ready" },
];

const DISCLOSURE_SECTIONS = [
  { id: "gov", label: "Governance", desc: "Board oversight, management roles, climate committees", score: 72, status: "complete" },
  { id: "strat", label: "Strategy", desc: "Climate risks & opportunities, scenario analysis, resilience", score: 58, status: "partial" },
  { id: "risk", label: "Risk Management", desc: "Identification, assessment, integration into ERM", score: 81, status: "complete" },
  { id: "metrics", label: "Metrics & Targets", desc: "GHG emissions, climate targets, performance tracking", score: 64, status: "partial" },
  { id: "physical", label: "Physical Risk", desc: "Acute & chronic physical risk exposure quantification", score: 44, status: "gap" },
  { id: "transition", label: "Transition Risk", desc: "Policy, technology, market, reputation risk assessment", score: 68, status: "partial" },
  { id: "scenario", label: "Scenario Analysis", desc: "1.5°C / 2°C / 4°C pathways, financial impact", score: 52, status: "gap" },
  { id: "supplychain", label: "Value Chain", desc: "Scope 3 disclosure, upstream/downstream emissions", score: 31, status: "gap" },
];

const GREENWASHING_FLAGS = [
  { severity: "HIGH" as const, claim: "Net Zero by 2040", issue: "No credible interim targets or reduction pathway provided. No reference to verified offset methodology.", confidence: 87 },
  { severity: "MEDIUM" as const, claim: "100% Renewable Energy", issue: "Claim limited to purchased RECs, not on-site generation. Scope 2 market-based vs location-based discrepancy not disclosed.", confidence: 74 },
  { severity: "HIGH" as const, claim: "Carbon Neutral Operations", issue: "Offset methodology not specified. No third-party verification cited. Operational boundary definition missing.", confidence: 91 },
  { severity: "MEDIUM" as const, claim: "Science-Based Targets", issue: "SBTi validation pending — not yet formally approved. Claims pre-emptive of actual certification.", confidence: 68 },
];

const REPORT_TYPES = [
  { id: "tcfd-full", label: "TCFD Full Disclosure", pages: "18–24 pp", framework: "TCFD", icon: FileText },
  { id: "issb-s2", label: "IFRS S2 Climate Report", pages: "22–30 pp", framework: "IFRS S2", icon: Layers },
  { id: "csrd-esrs", label: "CSRD ESRS E1 Report", pages: "28–40 pp", framework: "CSRD", icon: Shield },
  { id: "investor-brief", label: "Investor Climate Brief", pages: "6–8 pp", framework: "Custom", icon: Zap },
  { id: "exec-summary", label: "Executive Summary", pages: "2–4 pp", framework: "Custom", icon: FileText },
  { id: "board-pack", label: "Board Climate Pack", pages: "10–14 pp", framework: "Custom", icon: Layers },
];

// ── Page ──────────────────────────────────────────────────────────────────────

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  status: "uploading" | "received" | "error";
  pages?: number;
  error?: string;
}

export default function DisclosureStudioPage() {
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(["tcfd", "issb"]);
  const [uploadedFiles, setUploadedFiles]           = useState<UploadedFile[]>([]);
  const [generating, setGenerating]                 = useState<string | null>(null);
  const [generated, setGenerated]                   = useState<string[]>([]);
  const [activeTab, setActiveTab]                   = useState<"builder" | "scanner" | "quality">("builder");
  const [dragging, setDragging]                     = useState(false);
  const fileInputRef                                = useRef<HTMLInputElement>(null);

  const toggleFramework = (id: string) =>
    setSelectedFrameworks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleGenerate = (reportId: string) => {
    setGenerating(reportId);
    setTimeout(() => {
      setGenerating(null);
      setGenerated((prev) => [...prev, reportId]);
    }, 2500);
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;

    // Optimistically show uploading state
    const pending: UploadedFile[] = files.map(f => ({
      name: f.name, size: Math.round(f.size / 1024), type: f.type, status: "uploading" as const,
    }));
    setUploadedFiles(prev => [...prev, ...pending]);

    try {
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json() as {
        success: boolean;
        files?: UploadedFile[];
        error?: string;
      };

      setUploadedFiles(prev => {
        const copy = [...prev];
        // Replace the pending entries with the server response
        const pendingNames = new Set(files.map(f => f.name));
        const rest = copy.filter(f => !pendingNames.has(f.name));
        if (json.success && json.files) {
          return [...rest, ...json.files.map(f => ({ ...f, status: "received" as const }))];
        }
        return [...rest, ...files.map(f => ({ name: f.name, size: Math.round(f.size / 1024), type: f.type, status: "error" as const, error: json.error ?? "Upload failed" }))];
      });
    } catch {
      setUploadedFiles(prev => prev.map(f =>
        files.map(x => x.name).includes(f.name) && f.status === "uploading"
          ? { ...f, status: "error" as const, error: "Network error" }
          : f
      ));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    void uploadFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    void uploadFiles(files);
    // Reset so same file can be selected again
    e.target.value = "";
  };

  const removeFile = (name: string) =>
    setUploadedFiles(prev => prev.filter(f => f.name !== name));

  const avgScore = Math.round(DISCLOSURE_SECTIONS.reduce((s, d) => s + d.score, 0) / DISCLOSURE_SECTIONS.length);

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-1">
            DISCLOSURE STUDIO / REPORTING ENGINE
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Climate Disclosure & Report Generation
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            TCFD · IFRS S2 · CSRD · GRI · CDP · Greenwashing Detection · Audit-Ready Outputs
          </p>
        </div>
        <div className="flex gap-1">
          {(["builder", "scanner", "quality"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                activeTab === tab
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {tab === "builder" ? "Report Builder" : tab === "scanner" ? "Greenwash Scanner" : "Quality Score"}
            </button>
          ))}
        </div>
      </div>

      {/* ── BUILDER TAB ── */}
      {activeTab === "builder" && (
        <div className="grid grid-cols-12 gap-4">

          {/* Upload + framework selection */}
          <div className="col-span-12 lg:col-span-4 space-y-4">

            {/* File upload */}
            <DataPanel label="DATA INGESTION" title="Upload ESG Documents">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.docx,.csv,.txt"
                className="hidden"
                onChange={handleFileInput}
              />
              <div
                className={`border-2 border-dashed rounded-none transition-colors cursor-pointer p-6 text-center ${
                  dragging ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-400"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <div className="text-xs font-bold text-gray-700 mb-1">Drop ESG reports here or click to browse</div>
                <div className="text-[10px] text-gray-400">PDF, XLSX, DOCX, CSV · up to 50 MB per file</div>
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((f) => (
                    <div key={f.name} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-100">
                      {f.status === "uploading" && <Clock className="w-3 h-3 text-amber-400 animate-spin flex-shrink-0" />}
                      {f.status === "received"  && <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
                      {f.status === "error"     && <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                      <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-[10px] text-gray-600 flex-1 truncate">{f.name}</span>
                      <span className="text-[9px] text-gray-400">{f.size} KB</span>
                      {f.pages && <span className="text-[9px] text-gray-400">~{f.pages}pp</span>}
                      <button onClick={() => removeFile(f.name)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {uploadedFiles.some(f => f.status === "error") && (
                    <div className="text-[9px] text-red-500 mt-1">Some files failed. Check network and file types.</div>
                  )}
                </div>
              )}
            </DataPanel>

            {/* Framework selection */}
            <DataPanel label="FRAMEWORK SELECTION" title="Disclosure Standards">
              <div className="space-y-1.5">
                {FRAMEWORKS.map((fw) => (
                  <button
                    key={fw.id}
                    onClick={() => toggleFramework(fw.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 border text-left transition-all ${
                      selectedFrameworks.includes(fw.id)
                        ? "border-gray-900 bg-gray-900"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <div className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center ${
                      selectedFrameworks.includes(fw.id) ? "bg-white border-white" : "border-gray-300"
                    }`}>
                      {selectedFrameworks.includes(fw.id) && (
                        <CheckCircle2 className="w-3 h-3 text-gray-900" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-bold flex items-center gap-2 ${
                        selectedFrameworks.includes(fw.id) ? "text-white" : "text-gray-700"
                      }`}>
                        {fw.label}
                        {fw.status === "beta" && (
                          <span className="text-[7px] bg-amber-100 text-amber-700 border border-amber-200 px-1">BETA</span>
                        )}
                      </div>
                      <div className={`text-[9px] truncate ${selectedFrameworks.includes(fw.id) ? "text-gray-400" : "text-gray-400"}`}>
                        {fw.full}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </DataPanel>
          </div>

          {/* Report types */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <DataPanel label="REPORT GENERATION" title="Available Report Types" noPad>
              <div className="divide-y divide-gray-50">
                {REPORT_TYPES.map(({ id, label, pages, framework, icon: Icon }) => {
                  const isGenerating = generating === id;
                  const isDone = generated.includes(id);
                  return (
                    <div key={id} className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-800">{label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {framework} · {pages} · PDF + Machine-readable XML
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDone && (
                          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors uppercase tracking-widest">
                            <Download className="w-3 h-3" /> Download
                          </button>
                        )}
                        <button
                          onClick={() => handleGenerate(id)}
                          disabled={isGenerating}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                            isGenerating
                              ? "bg-gray-100 text-gray-400 border-gray-200"
                              : isDone
                              ? "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
                              : "bg-gray-900 text-white border-gray-900 hover:bg-gray-800"
                          }`}
                        >
                          {isGenerating ? (
                            <><Clock className="w-3 h-3 animate-spin" /> Generating...</>
                          ) : isDone ? (
                            "Regenerate"
                          ) : (
                            <><Zap className="w-3 h-3" /> Generate</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DataPanel>
          </div>
        </div>
      )}

      {/* ── GREENWASH SCANNER TAB ── */}
      {activeTab === "scanner" && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <DataPanel label="GREENWASHING DETECTION ENGINE" title="Narrative Analysis — Unverified Claims" noPad>
              <div className="divide-y divide-gray-100">
                {GREENWASHING_FLAGS.map((flag, i) => (
                  <div key={i} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className={`w-4 h-4 flex-shrink-0 ${flag.severity === "HIGH" ? "text-red-500" : "text-amber-500"}`} />
                        <span className="text-sm font-bold text-gray-800">&ldquo;{flag.claim}&rdquo;</span>
                      </div>
                      <RiskBadgeT level={flag.severity} />
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed ml-6 mb-2">{flag.issue}</p>
                    <div className="ml-6 flex items-center gap-3">
                      <div className="flex-1 max-w-[200px] h-1.5 bg-gray-100">
                        <div
                          className={`h-1.5 ${flag.confidence >= 80 ? "bg-red-500" : "bg-amber-400"}`}
                          style={{ width: `${flag.confidence}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                        {flag.confidence}% confidence
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-white border border-gray-200 p-5">
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-3">INTEGRITY SCORE</div>
              <div className="text-6xl font-bold text-gray-900 mb-1">34</div>
              <div className="text-xs text-gray-500 mb-4">/100 — Greenwashing Risk: <span className="text-red-600 font-bold">HIGH</span></div>
              <div className="space-y-2">
                {[
                  { label: "Claim Specificity", score: 28 },
                  { label: "Evidence Quality", score: 31 },
                  { label: "Third-Party Verification", score: 22 },
                  { label: "Pathway Credibility", score: 41 },
                  { label: "Scope Coverage", score: 48 },
                ].map(({ label, score }) => (
                  <div key={label}>
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-bold text-gray-700">{score}/100</span>
                    </div>
                    <div className="h-1 bg-gray-100">
                      <div className="h-1 bg-red-400" style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DataPanel label="DETECTION COVERAGE" title="NLP Analysis Scope">
              <div className="space-y-2">
                {["Scope 1, 2, 3 claims", "Net Zero pledges", "Carbon neutrality statements", "Renewable energy claims", "SBTi/CDP references", "SDG alignment claims"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-[10px] text-gray-600">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>
        </div>
      )}

      {/* ── QUALITY SCORE TAB ── */}
      {activeTab === "quality" && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <DataPanel label="DISCLOSURE QUALITY ENGINE" title="TCFD Coverage Assessment by Section" noPad>
              <div className="divide-y divide-gray-100">
                {DISCLOSURE_SECTIONS.map((section) => (
                  <div key={section.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {section.status === "complete" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {section.status === "partial" && <AlertCircle className="w-4 h-4 text-amber-500" />}
                      {section.status === "gap" && <AlertCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-800 mb-0.5">{section.label}</div>
                      <div className="text-[10px] text-gray-400">{section.desc}</div>
                    </div>
                    <div className="w-32">
                      <div className="flex justify-between text-[9px] mb-1">
                        <span className="text-gray-400">Coverage</span>
                        <span className="font-bold text-gray-700">{section.score}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100">
                        <div
                          className={`h-1.5 ${section.score >= 75 ? "bg-emerald-500" : section.score >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${section.score}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${
                        section.status === "complete" ? "text-emerald-700 bg-emerald-50 border border-emerald-200" :
                        section.status === "partial" ? "text-amber-700 bg-amber-50 border border-amber-200" :
                        "text-red-700 bg-red-50 border border-red-200"
                      }`}>
                        {section.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-white border border-gray-200 p-5 mb-4">
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-3">OVERALL DISCLOSURE QUALITY</div>
              <div className="text-6xl font-bold text-gray-900 mb-1">{avgScore}</div>
              <div className="text-xs text-gray-500 mb-1">/100 Disclosure Score</div>
              <div className="text-[10px] text-amber-600 font-bold mb-4">PARTIAL — Action Required</div>
              <div className="h-2 bg-gray-100 mb-4">
                <div className="h-2 bg-amber-400" style={{ width: `${avgScore}%` }} />
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Complete sections</span>
                  <span className="font-bold text-gray-800">2 / 8</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Partial sections</span>
                  <span className="font-bold text-amber-600">3 / 8</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Critical gaps</span>
                  <span className="font-bold text-red-600">3 / 8</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Peer benchmark</span>
                  <span className="font-bold text-gray-800">Top 42%</span>
                </div>
              </div>
            </div>
            <DataPanel label="PRIORITY ACTIONS" title="Top 3 Gaps to Close">
              <div className="space-y-3">
                {DISCLOSURE_SECTIONS.filter(s => s.status === "gap").map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-4 h-4 bg-red-100 border border-red-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[8px] font-bold text-red-600">{i + 1}</span>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-800">{s.label}</div>
                      <div className="text-[9px] text-gray-400 mt-0.5">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>
        </div>
      )}

    </div>
  );
}
