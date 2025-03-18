import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Search, MapPin, Star, Clock, Loader2 } from "lucide-react";
import { useState } from "react";
import { Service } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

const categories = [
  "All",
  "Beauty & Wellness",
  "Home Services",
  "Professional Services",
  "Health & Fitness",
  "Education & Training"
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function BrowseServices() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const filteredServices = services?.filter(service => 
    (selectedCategory === "All" || service.category === selectedCategory) &&
    (service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     service.description.toLowerCase().includes(searchQuery.toLowerCase())) &&
    service.isAvailable
  );

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search services..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !filteredServices?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No services found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service) => (
              <motion.div key={service.id} variants={item}>
                <Link href={`/customer/service-provider/${service.id}`}>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4">
                        <div>
                          <h3 className="font-semibold">{service.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {service.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>{service.duration} mins</span>
                          </div>
                          <span className="font-semibold">₹{service.price}</span>
                        </div>

                        <Button className="w-full">View Details</Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}