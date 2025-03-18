import { ReactNode } from "react";
import { MainNav } from "@/components/navigation/main-nav";
import { NotificationsCenter } from "@/components/notifications-center";
import { LanguageSelector } from "@/components/language-selector";
import { useLanguage } from "@/contexts/language-context";
import { motion } from "framer-motion";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-4 border-b">
        <MainNav />
        <div className="flex items-center gap-4">
          <LanguageSelector />
          <NotificationsCenter />
        </div>
      </div>
      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="container mx-auto p-4 md:p-8 max-w-7xl"
      >
        {children}
      </motion.main>
    </div>
  );
}