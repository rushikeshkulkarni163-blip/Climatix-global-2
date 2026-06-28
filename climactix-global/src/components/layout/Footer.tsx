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
            <div className="flex items-center mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Climactix Global" className="h-10 w-auto" />
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
