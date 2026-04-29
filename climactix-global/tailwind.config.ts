import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Bloomberg Terminal Dark Palette ──────────────────
        terminal: {
          black:   "#000000",
          dark:    "#0A0A0A",
          panel:   "#0D0D0D",
          card:    "#111111",
          raised:  "#161616",
          border:  "#1F1F1F",
          "border-mid": "#2A2A2A",
          navy:    "#0A1F44",
          "navy-mid": "#0F2D5E",
          "navy-light": "#1A3A6E",
          blue:    "#1D4ED8",
          "blue-bright": "#3B82F6",
          text:    "#FFFFFF",
          secondary: "#9CA3AF",
          muted:   "#6B7280",
          dim:     "#4B5563",
          green:   "#10B981",
          red:     "#EF4444",
          orange:  "#F97316",
          amber:   "#F59E0B",
        },
        // ── Legacy brand palette (kept for inner app pages) ──
        brand: {
          blue:          "#00338D",
          "blue-mid":    "#005EB8",
          "blue-light":  "#4472C4",
          "blue-dark":   "#002060",
          "blue-tint":   "#E8EEF8",
          teal:          "#005EB8",
          "teal-light":  "#4472C4",
          "teal-dark":   "#002060",
          amber:         "#F4A261",
          "amber-dark":  "#E07B3A",
          danger:        "#C1121F",
          success:       "#107C10",
          navy:          "#00338D",
          "navy-light":  "#005EB8",
          bg:            "#F5F7FA",
          "bg-dark":     "#E8EEF8",
          gray:          "#4A4A4A",
          "gray-light":  "#767676",
          "gray-border": "#D1D5DB",
        },
      },
      fontFamily: {
        sans:  ["Inter", "Arial", "Helvetica Neue", "system-ui", "sans-serif"],
        serif: ["Georgia", "serif"],
        mono:  ["Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.65rem", "0.9rem"],
      },
      maxWidth: {
        "8xl": "90rem",
      },
      boxShadow: {
        card:           "0 1px 4px rgba(0, 51, 141, 0.08)",
        "card-hover":   "0 4px 16px rgba(0, 51, 141, 0.14)",
        nav:            "0 1px 0 #1F1F1F",
        terminal:       "0 0 0 1px #1F1F1F",
        "terminal-glow":"0 0 24px rgba(29, 78, 216, 0.12)",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
