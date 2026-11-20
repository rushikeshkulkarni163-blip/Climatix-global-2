import "./console.css";
import type { Metadata } from "next";
import ConsoleShell from "@/components/cxt/Shell";

export const metadata: Metadata = {
  title: "Climactix Terminal",
  description: "Corporate sustainability and climate intelligence.",
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
