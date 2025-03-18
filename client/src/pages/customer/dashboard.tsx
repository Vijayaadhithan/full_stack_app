import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Tutorial } from "@/components/onboarding/tutorial";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, ShoppingBag, ClipboardList } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    // Check if this is the user's first visit
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  const handleTutorialComplete = () => {
    localStorage.setItem('hasSeenTutorial', 'true');
    setShowTutorial(false);
  };

  return (
    <DashboardLayout>
      {showTutorial && (
        <Tutorial 
          language={user?.language as "en" | "hi" | "ta"} 
          onComplete={handleTutorialComplete} 
        />
      )}

      <motion.div 
        className="grid gap-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <motion.div variants={item}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Book Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>Find and book services from our providers</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Shop Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>Browse and purchase products from our shops</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  My Bookings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>View and manage your service bookings</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}