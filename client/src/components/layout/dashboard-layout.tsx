import { ReactNode, Suspense, lazy } from "react";

import { MainNav } from "@/components/navigation/main-nav";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

const LazyLanguageSelector = lazy(() =>
  import("@/components/language-selector").then((module) => ({
    default: module.LanguageSelector,
  })),
);

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <MainNav
        rightSlot={(
          <Suspense fallback={<div className="h-9 w-9" aria-hidden="true" />}>
            <LazyLanguageSelector />
          </Suspense>
        )}
      />
      <main
        className={cn(
          "mx-auto flex-1 w-full px-4 pt-5 pb-24 sm:px-6 sm:pt-6 sm:pb-24 md:px-8 md:pb-8 md:pt-6 lg:px-10 lg:py-8",
          "max-w-[min(100vw-1.5rem,1200px)]",
        )}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
