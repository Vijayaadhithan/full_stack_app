import { ReactNode } from "react";
import { motion } from "framer-motion";

import { MainNav } from "@/components/navigation/main-nav";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { LanguageSelector } from "@/components/language-selector";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <MainNav rightSlot={<LanguageSelector />} />
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "mx-auto flex-1 w-full px-4 pt-5 pb-24 sm:px-6 sm:pt-6 sm:pb-24 md:px-8 md:pb-8 md:pt-6 lg:px-10 lg:py-8",
          "max-w-[min(100vw-1.5rem,1200px)]",
        )}
      >
        {children}
      </motion.main>
      <BottomNav />
    </div>
  );
}
