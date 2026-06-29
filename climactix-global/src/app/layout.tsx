import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/ui/QueryProvider";
import ConditionalLayout from "@/components/layout/ConditionalLayout";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
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
    <html lang="en" className={`dark ${roboto.variable}`}>
      <body className="bg-[#070B11] text-[#DDE7F2] min-h-screen antialiased">
        <QueryProvider>
          <ConditionalLayout>{children}</ConditionalLayout>
        </QueryProvider>
      </body>
    </html>
  );
}
