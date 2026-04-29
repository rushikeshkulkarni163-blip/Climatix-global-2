import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import QueryProvider from "@/components/ui/QueryProvider";

export const metadata: Metadata = {
  title: "Climactix Global — Climate Risk Intelligence Platform",
  description:
    "TCFD-aligned climate risk analysis for industries, investors, and researchers. Physical risk, transition risk, ESG scoring, and PDF report generation.",
  keywords: ["climate risk", "TCFD", "ESG", "carbon", "sustainability", "climate analysis"],
  authors: [{ name: "Climactix Global" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-black">
        <QueryProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </QueryProvider>
      </body>
    </html>
  );
}
