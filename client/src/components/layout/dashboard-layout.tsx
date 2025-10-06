import { ReactNode } from "react";
import { motion } from "framer-motion";

import { MainNav } from "@/components/navigation/main-nav";
import { LanguageSelector } from "@/components/language-selector";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MainNav rightSlot={<LanguageSelector />} />
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="mx-auto w-full flex-1 px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:max-w-7xl"
      >
        {children}
      </motion.main>
    </div>
  );
}
