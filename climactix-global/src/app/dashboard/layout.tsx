import DashboardShell from "@/components/dashboard/DashboardShell";
import { ToastProvider } from "@/components/ds/Toast";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DashboardShell>{children}</DashboardShell>
    </ToastProvider>
  );
}
