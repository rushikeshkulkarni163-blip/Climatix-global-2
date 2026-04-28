import Link from "next/link";

const FOOTER_COLS = [
  {
    title: "Solutions",
    links: [
      { label: "Risk Assessment", href: "/risk-analysis" },
      { label: "Portfolio Screener", href: "/portfolio" },
      { label: "Research Tools", href: "/research" },
      { label: "Report Generator", href: "/report" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Industries",
    links: [
      { label: "Energy & Utilities", href: "/portfolio" },
      { label: "Financial Services", href: "/portfolio" },
      { label: "Manufacturing", href: "/portfolio" },
      { label: "Agriculture & Food", href: "/portfolio" },
      { label: "Real Estate", href: "/portfolio" },
    ],
  },
  {
    title: "Insights",
    links: [
      { label: "Climate Data Explorer", href: "/research" },
      { label: "TCFD Framework", href: "/risk-analysis" },
      { label: "Scenario Analysis", href: "/dashboard" },
      { label: "ESG Scoring", href: "/dashboard" },
    ],
  },
  {
    title: "Data Sources",
    links: [
      { label: "Open-Meteo API", href: "#" },
      { label: "NASA POWER API", href: "#" },
      { label: "World Bank Climate", href: "#" },
      { label: "OpenAQ Air Quality", href: "#" },
      { label: "UN SDG Indicators", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-brand-blue text-white mt-auto">
      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand col */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-white flex items-center justify-center flex-shrink-0">
                <span className="text-brand-blue font-black text-xs">CG</span>
              </div>
              <div>
                <div className="font-bold text-white text-sm tracking-tight leading-none">CLIMACTIX</div>
                <div className="text-blue-300 text-2xs uppercase tracking-widest leading-none">GLOBAL</div>
              </div>
            </div>
            <p className="text-blue-200 text-xs leading-relaxed mb-4">
              Measure the Risk.<br />Navigate the Future.
            </p>
            <p className="text-blue-300 text-2xs leading-relaxed">
              TCFD-aligned climate risk intelligence for industries, investors, and researchers.
            </p>
          </div>

          {/* Nav cols */}
          {FOOTER_COLS.map(({ title, links }) => (
            <div key={title}>
              <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-5 pb-2 border-b border-white/20">
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-blue-200 text-xs hover:text-white transition-colors hover:underline underline-offset-2">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-blue-300 text-2xs">
            © 2024 Climactix Global. TCFD-aligned climate risk analysis platform.
          </p>
          <p className="text-blue-400 text-2xs">
            Confidential · climactix.global · Data updated periodically
          </p>
        </div>
      </div>
    </footer>
  );
}
