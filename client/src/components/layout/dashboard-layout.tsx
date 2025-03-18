import { ReactNode } from "react";
import { MainNav } from "@/components/navigation/main-nav";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="p-4 md:p-8">{children}</main>
    </div>
  );
}
