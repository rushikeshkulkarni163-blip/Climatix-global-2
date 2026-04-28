"use client";

import type { AssessmentFormData } from "@/types";

interface Step4Props {
  data: AssessmentFormData["esgGovernance"];
  onChange: (d: AssessmentFormData["esgGovernance"]) => void;
}

const POLICY_LEVELS = [
  { value: "none", label: "None", desc: "No formal climate policy", color: "border-red-400 bg-red-50 text-red-700" },
  { value: "developing", label: "Developing", desc: "Policy in development", color: "border-amber-400 bg-amber-50 text-amber-700" },
  { value: "established", label: "Established", desc: "Formal policy in place", color: "border-blue-400 bg-blue-50 text-blue-700" },
  { value: "leading", label: "Leading", desc: "Industry-leading governance", color: "border-green-400 bg-green-50 text-green-700" },
] as const;

export default function Step4ESG({ data, onChange }: Step4Props) {
  const set = <K extends keyof typeof data>(key: K, val: typeof data[K]) =>
    onChange({ ...data, [key]: val });

  const toggles = [
    { key: "boardOversight", label: "Board-Level Climate Oversight", desc: "Dedicated board committee for climate" },
    { key: "tcfdDisclosure", label: "TCFD Disclosure", desc: "Publishing TCFD-aligned report" },
    { key: "cdpDisclosure", label: "CDP Disclosure", desc: "Annual CDP questionnaire submission" },
    { key: "carbonOffsets", label: "Carbon Offset Program", desc: "Purchasing verified carbon credits" },
    { key: "supplyChainEsg", label: "Supply Chain ESG Assessment", desc: "Supplier ESG due diligence done" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <label className="label">Climate Policy Maturity *</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {POLICY_LEVELS.map(({ value, label, desc, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => set("climatePolicy", value)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                data.climatePolicy === value ? color : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
              aria-pressed={data.climatePolicy === value}
            >
              <div className="font-semibold text-sm">{label}</div>
              <div className="text-xs mt-1 opacity-80">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="netZero">Net Zero Commitment Year</label>
        <div className="flex gap-3">
          <select
            id="netZero"
            className="input-field"
            value={data.netZeroYear ?? ""}
            onChange={(e) =>
              set("netZeroYear", e.target.value ? parseInt(e.target.value) : null)
            }
          >
            <option value="">No commitment yet</option>
            {[2030, 2035, 2040, 2045, 2050, 2060].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {data.netZeroYear && (
            <div className="flex items-center gap-2 px-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold whitespace-nowrap">
              {data.netZeroYear - new Date().getFullYear()} years away
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="label">Governance Disclosures &amp; Programs</label>
        <div className="space-y-3">
          {toggles.map(({ key, label, desc }) => {
            const val = data[key] as boolean;
            return (
              <div
                key={key}
                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  val ? "border-brand-teal bg-brand-bg" : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => set(key, !val as never)}
                role="checkbox"
                aria-checked={val}
                tabIndex={0}
                onKeyDown={(e) => e.key === " " && set(key, !val as never)}
              >
                <div>
                  <div className="text-sm font-semibold text-brand-navy">{label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
                </div>
                <div
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                    val ? "bg-brand-teal" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      val ? "translate-x-4" : ""
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
