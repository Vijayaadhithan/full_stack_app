import { ReactNode } from "react";
import { MainNav } from "@/components/navigation/main-nav";
import { motion } from "framer-motion";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <MainNav />
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