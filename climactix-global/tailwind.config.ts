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
        // ── NASA × Bloomberg Intelligence Palette ────────────────
        intel: {
          // Backgrounds — deep space hierarchy
          void:      "#070B11",   // outermost app shell
          base:      "#0C1220",   // page background
          panel:     "#0F1722",   // primary panels / cards
          surface:   "#111C2B",   // secondary surfaces
          elevated:  "#152235",   // tertiary / hover surfaces
          float:     "#1A2A40",   // floating menus / tooltips

          // Borders — spatial depth
          border:    "#1E2C3D",   // default border
          "border-mid": "#253649",// mid emphasis
          "border-hi":  "#2D4460",// high emphasis / selected

          // Typography — information hierarchy
          text:      "#DDE7F2",   // primary text
          "text-2":  "#8CA3BA",   // secondary text
          "text-3":  "#62758C",   // muted / labels
          "text-4":  "#3D506A",   // dim / placeholders

          // Primary Intelligence Blue
          blue:      "#4DA3FF",   // primary accent
          "blue-dim":"#2E7AD9",   // pressed / dark variant
          "blue-hi": "#7BBEFF",   // hover / emphasis
          "blue-bg": "#0D2040",   // tinted blue background

          // NASA Cyan — live data / satellite feeds
          cyan:      "#70D8FF",
          "cyan-dim":"#45B8E0",
          "cyan-bg": "#082030",

          // Status / Signal Colors
          critical:  "#FF5B5B",   // critical alerts
          "crit-bg": "#2A0F0F",
          warning:   "#D8913F",   // warnings
          "warn-bg": "#2A1A08",
          success:   "#63C982",   // positive / operational
          "succ-bg": "#0A2015",
          neutral:   "#8CA3BA",

          // Risk Level Scale — institutional rating
          aaa:       "#4DA3FF",   // AAA — premium
          aa:        "#70D8FF",   // AA
          a:         "#63C982",   // A
          bbb:       "#D8913F",   // BBB — watch
          bb:        "#E87040",   // BB
          b:         "#FF5B5B",   // B
          ccc:       "#CC2222",   // CCC — distressed

          // Accent — gold / amber (only for financial highlights)
          gold:      "#C9A227",
          "gold-bg": "#1F1800",
        },

        // ── Legacy surface classes kept for internal pages ───────
        surface: {
          1: "#0F1722",
          2: "#111C2B",
          3: "#152235",
        },
      },

      fontFamily: {
        sans:  ['"IBM Plex Sans"', "Inter", "Arial", "Helvetica Neue", "system-ui", "sans-serif"],
        mono:  ['"IBM Plex Mono"', "Consolas", "monospace"],
        data:  ['"IBM Plex Mono"', "Consolas", "monospace"],
      },

      fontSize: {
        "2xs": ["0.60rem", { lineHeight: "0.85rem" }],
        "3xs": ["0.55rem", { lineHeight: "0.75rem" }],
      },

      letterSpacing: {
        widest2: "0.18em",
        widest3: "0.22em",
      },

      maxWidth: {
        "8xl": "90rem",
        "9xl": "100rem",
      },

      boxShadow: {
        panel:     "0 0 0 1px #1E2C3D",
        "panel-hi":"0 0 0 1px #253649",
        "blue-rim":"0 0 0 1px #4DA3FF22",
        intel:     "inset 0 1px 0 rgba(77,163,255,0.06)",
      },

      backgroundImage: {
        "grid-intel":
          "linear-gradient(rgba(77,163,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(77,163,255,0.03) 1px, transparent 1px)",
        "grid-fine":
          "linear-gradient(rgba(77,163,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(77,163,255,0.015) 1px, transparent 1px)",
      },

      backgroundSize: {
        "grid-40": "40px 40px",
        "grid-20": "20px 20px",
      },

      spacing: {
        "13": "3.25rem",
        "18": "4.5rem",
        "22": "5.5rem",
        "sidebar": "220px",
      },

      keyframes: {
        "ticker-scroll": {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.3" },
        },
        "slide-in-left": {
          "0%":   { transform: "translateX(-8px)", opacity: "0" },
          "100%": { transform: "translateX(0)",    opacity: "1" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scan-line": {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },

      animation: {
        ticker:       "ticker-scroll 60s linear infinite",
        "ticker-slow":"ticker-scroll 120s linear infinite",
        "pulse-dot":  "pulse-dot 2s ease-in-out infinite",
        "slide-in":   "slide-in-left 0.15s ease forwards",
        "fade-in":    "fade-in 0.2s ease forwards",
        "scan":       "scan-line 3s ease-in-out infinite",
      },

      transitionDuration: {
        "80":  "80ms",
        "120": "120ms",
        "200": "200ms",
      },
    },
  },
  plugins: [],
};
export default config;
