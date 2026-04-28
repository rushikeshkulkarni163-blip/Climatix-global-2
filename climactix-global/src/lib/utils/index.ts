import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  value: number,
  currency = "USD",
  compact = false
): string {
  if (compact) {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(
  value: number,
  decimals = 1,
  unit = ""
): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function getRiskColor(rating: string): string {
  const colors: Record<string, string> = {
    CRITICAL: "#C1121F",
    HIGH: "#E07B3A",
    MEDIUM: "#F4A261",
    LOW: "#2D6A4F",
    MINIMAL: "#0D5C63",
  };
  return colors[rating] ?? "#6b7280";
}

export function getRiskBgClass(rating: string): string {
  const classes: Record<string, string> = {
    CRITICAL: "bg-red-50 text-red-700 border-red-400",
    HIGH: "bg-orange-50 text-orange-700 border-orange-400",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-400",
    LOW: "bg-green-50 text-green-700 border-green-500",
    MINIMAL: "bg-blue-50 text-blue-700 border-blue-400",
  };
  return classes[rating] ?? "bg-gray-50 text-gray-700 border-gray-300";
}

export function getScoreGradientColor(score: number): string {
  if (score >= 80) return "#C1121F";
  if (score >= 60) return "#E07B3A";
  if (score >= 40) return "#F4A261";
  if (score >= 20) return "#2D6A4F";
  return "#0D5C63";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function generateReportId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CG-${timestamp}-${random}`;
}

export function formatDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}
