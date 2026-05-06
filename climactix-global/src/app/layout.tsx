import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/components/ui/QueryProvider";
import ConditionalLayout from "@/components/layout/ConditionalLayout";

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
          <ConditionalLayout>{children}</ConditionalLayout>
        </QueryProvider>
      </body>
    </html>
  );
}
