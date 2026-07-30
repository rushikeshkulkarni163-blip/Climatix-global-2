import ScenarioStudioShell from "@/components/scenario-studio/ScenarioStudioShell";

export default function ScenarioStudioLayout({ children }: { children: React.ReactNode }) {
  return <ScenarioStudioShell>{children}</ScenarioStudioShell>;
}
