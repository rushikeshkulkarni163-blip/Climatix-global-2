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
        brand: {
          // KPMG-style corporate blue palette
          blue: "#00338D",
          "blue-mid": "#005EB8",
          "blue-light": "#4472C4",
          "blue-dark": "#002060",
          "blue-tint": "#E8EEF8",
          // Legacy teal (kept for chart compatibility)
          teal: "#005EB8",
          "teal-light": "#4472C4",
          "teal-dark": "#002060",
          // Accents
          amber: "#F4A261",
          "amber-dark": "#E07B3A",
          danger: "#C1121F",
          success: "#107C10",
          navy: "#00338D",
          "navy-light": "#005EB8",
          bg: "#F5F7FA",
          "bg-dark": "#E8EEF8",
          // Neutrals
          gray: "#4A4A4A",
          "gray-light": "#767676",
          "gray-border": "#D1D5DB",
        },
      },
      fontFamily: {
        sans: ["Arial", "Inter", "system-ui", "sans-serif"],
        serif: ["Georgia", "serif"],
        mono: ["Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.65rem", "0.9rem"],
      },
      maxWidth: {
        "8xl": "90rem",
      },
      boxShadow: {
        card: "0 1px 4px rgba(0, 51, 141, 0.08)",
        "card-hover": "0 4px 16px rgba(0, 51, 141, 0.14)",
        nav: "0 2px 8px rgba(0, 0, 0, 0.08)",
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
