import type { Metadata, Viewport } from "next";
import "./globals.css";
import QueryProvider from "@/components/ui/QueryProvider";
import ConditionalLayout from "@/components/layout/ConditionalLayout";

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
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-[#070B11] text-[#DDE7F2] min-h-screen antialiased">
        <QueryProvider>
          <ConditionalLayout>{children}</ConditionalLayout>
        </QueryProvider>
      </body>
    </html>
  );
}
