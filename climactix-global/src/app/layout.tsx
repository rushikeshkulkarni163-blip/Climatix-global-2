import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Merriweather } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/ui/QueryProvider";
import ConditionalLayout from "@/components/layout/ConditionalLayout";

const sourceSansPro = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-sans-pro",
  display: "swap",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-merriweather",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Climactix Global — Climate Risk Intelligence Operating System",
  description:
    "Institutional-grade Climate Risk Intelligence OS for capital allocation, enterprise sustainability, and climate-linked financial decision making.",
  keywords: [
    "climate risk", "TCFD", "NGFS", "ESG", "carbon", "physical risk",
    "transition risk", "Bloomberg climate", "institutional ESG", "climate finance",
  ],
  authors: [{ name: "Climactix Global" }],
};

export const viewport: Viewport = {
  themeColor: "#070B11",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${sourceSansPro.variable} ${merriweather.variable}`}>
      <body className="bg-[#070B11] text-[#DDE7F2] min-h-screen antialiased">
        <QueryProvider>
          <ConditionalLayout>{children}</ConditionalLayout>
        </QueryProvider>
      </body>
    </html>
  );
}
