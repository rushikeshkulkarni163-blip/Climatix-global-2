import Link from "next/link";

const FOOTER_COLS = [
  {
    title: "Solutions",
    links: [
      { label: "Risk Assessment",  href: "/risk-analysis" },
      { label: "Portfolio Screener", href: "/portfolio" },
      { label: "Research Tools",   href: "/research" },
      { label: "Report Generator", href: "/report" },
      { label: "Dashboard",        href: "/dashboard" },
    ],
  },
  {
    title: "Industries",
    links: [
      { label: "Energy & Utilities",   href: "/portfolio" },
      { label: "Financial Services",   href: "/portfolio" },
      { label: "Manufacturing",        href: "/portfolio" },
      { label: "Agriculture & Food",   href: "/portfolio" },
      { label: "Real Estate",          href: "/portfolio" },
    ],
  },
  {
    title: "Insights",
    links: [
      { label: "Climate Data Explorer", href: "/research" },
      { label: "TCFD Framework",        href: "/risk-analysis" },
      { label: "Scenario Analysis",     href: "/dashboard" },
      { label: "ESG Scoring",           href: "/dashboard" },
    ],
  },
  {
    title: "Data Sources",
    links: [
      { label: "Open-Meteo API",     href: "#" },
      { label: "NASA POWER API",     href: "#" },
      { label: "World Bank Climate", href: "#" },
      { label: "OpenAQ Air Quality", href: "#" },
      { label: "UN SDG Indicators",  href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-black border-t border-[#1F1F1F] mt-auto">

      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">

          {/* Brand column */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-5">
              <svg width="24" height="24" viewBox="0 0 36 36" fill="none" className="flex-shrink-0">
                <rect width="36" height="36" fill="#0A1F44" />
                <circle cx="18" cy="18" r="10" fill="none" stroke="white" strokeWidth="1.5" />
                <circle cx="18" cy="18" r="5" fill="none" stroke="#4472C4" strokeWidth="1.5" />
                <path d="M8 18 Q14 14 18 18 Q22 22 28 18" stroke="white" strokeWidth="1" fill="none" />
                <path d="M18 8 Q14 14 18 18 Q22 22 18 28" stroke="white" strokeWidth="1" fill="none" />
                <path d="M10 27 Q14 22 18 18 Q22 14 26 10" stroke="#F97316" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
              <div className="leading-none">
                <div className="font-bold text-white text-xs tracking-tight">CLIMACTIX</div>
                <div className="text-[#4B5563] text-[9px] font-bold tracking-[0.16em] uppercase">GLOBAL</div>
              </div>
            </div>
            <p className="text-gray-500 text-xs leading-relaxed mb-3">
              Measure the Risk.<br />Navigate the Future.
            </p>
            <p className="text-[#4B5563] text-[10px] leading-relaxed">
              TCFD-aligned climate risk intelligence for industries, investors, and researchers.
            </p>
          </div>

          {/* Nav columns */}
          {FOOTER_COLS.map(({ title, links }) => (
            <div key={title}>
              <h4 className="text-white text-[10px] font-bold uppercase tracking-[0.16em] mb-4 pb-2 border-b border-[#1F1F1F]">
                {title}
              </h4>
              <ul className="space-y-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[#6B7280] text-xs hover:text-white transition-colors"
                    >
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
      <div className="border-t border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-[#4B5563] text-[10px] tracking-wider">
            © 2024 Climactix Global. TCFD-aligned climate risk analysis platform.
          </p>
          <p className="text-[#4B5563] text-[10px] tracking-wider">
            Confidential · climactix.global · Data updated periodically
          </p>
        </div>
      </div>

    </footer>
  );
}
