"use client";

import { useEffect, useState } from "react";
import type { AssessmentFormData, Country } from "@/types";
import { SECTOR_CONFIGS } from "@/lib/scoring/sectorConfig";

interface Step1Props {
  data: AssessmentFormData["companyProfile"];
  onChange: (d: AssessmentFormData["companyProfile"]) => void;
}

const REVENUE_RANGES = [
  { value: "under-1m", label: "Under $1M" },
  { value: "1m-10m", label: "$1M – $10M" },
  { value: "10m-100m", label: "$10M – $100M" },
  { value: "100m-1b", label: "$100M – $1B" },
  { value: "over-1b", label: "Over $1B" },
];

const EMPLOYEE_RANGES = [
  { value: "1-50", label: "1 – 50" },
  { value: "51-250", label: "51 – 250" },
  { value: "251-1000", label: "251 – 1,000" },
  { value: "1001-10000", label: "1,001 – 10,000" },
  { value: "over-10000", label: "Over 10,000" },
];

export default function Step1Profile({ data, onChange }: Step1Props) {
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    fetch("/api/country")
      .then((r) => r.json())
      .then((res: { data: Country[] }) => setCountries(res.data ?? []))
      .catch(() => {});
  }, []);

  const set = <K extends keyof typeof data>(key: K, val: typeof data[K]) =>
    onChange({ ...data, [key]: val });

  const selectedSector = SECTOR_CONFIGS[data.industry];

  return (
    <div className="space-y-6">
      <div>
        <label className="label" htmlFor="orgName">Organization Name *</label>
        <input
          id="orgName"
          type="text"
          className="input-field"
          placeholder="e.g. Acme Corporation"
          value={data.organizationName}
          onChange={(e) => set("organizationName", e.target.value)}
          aria-required="true"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="industry">Industry Sector *</label>
          <select
            id="industry"
            className="input-field"
            value={data.industry}
            onChange={(e) => {
              const ind = e.target.value as typeof data.industry;
              set("industry", ind);
              set("subSector", "");
            }}
          >
            {Object.values(SECTOR_CONFIGS).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="subSector">Sub-Sector</label>
          <select
            id="subSector"
            className="input-field"
            value={data.subSector}
            onChange={(e) => set("subSector", e.target.value)}
          >
            <option value="">Select sub-sector</option>
            {selectedSector?.subSectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="country">Country / Region *</label>
        <select
          id="country"
          className="input-field"
          value={data.countryCode}
          onChange={(e) => {
            const country = countries.find((c) => c.cca3 === e.target.value);
            if (country) {
              set("country", country.name.common);
              set("countryCode", country.cca3);
              set("latitude", country.latlng[0]);
              set("longitude", country.latlng[1]);
            }
          }}
        >
          <option value="">Select country...</option>
          {countries.map((c) => (
            <option key={c.cca3} value={c.cca3}>{c.name.common}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Annual Revenue Range *</label>
          <div className="space-y-2">
            {REVENUE_RANGES.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="revenue"
                  value={value}
                  checked={data.revenueRange === value}
                  onChange={() => set("revenueRange", value as typeof data.revenueRange)}
                  className="w-4 h-4 text-brand-teal"
                />
                <span className="text-sm text-gray-700 group-hover:text-brand-teal">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Employee Count</label>
          <div className="space-y-2">
            {EMPLOYEE_RANGES.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="employees"
                  value={value}
                  checked={data.employeeCount === value}
                  onChange={() => set("employeeCount", value as typeof data.employeeCount)}
                  className="w-4 h-4 text-brand-teal"
                />
                <span className="text-sm text-gray-700 group-hover:text-brand-teal">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="lat">Primary Location Latitude</label>
          <input
            id="lat"
            type="number"
            className="input-field"
            placeholder="e.g. 40.71"
            value={data.latitude || ""}
            onChange={(e) => set("latitude", parseFloat(e.target.value) || 0)}
            min={-90}
            max={90}
            step={0.01}
          />
        </div>
        <div>
          <label className="label" htmlFor="lng">Primary Location Longitude</label>
          <input
            id="lng"
            type="number"
            className="input-field"
            placeholder="e.g. -74.01"
            value={data.longitude || ""}
            onChange={(e) => set("longitude", parseFloat(e.target.value) || 0)}
            min={-180}
            max={180}
            step={0.01}
          />
        </div>
      </div>
    </div>
  );
}
