import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Store, MapPin, Star } from "lucide-react";
import { useState } from "react";
import { User, ShopProfile } from "@shared/schema";
import { motion } from "framer-motion";

// Helper function to format address
const formatAddress = (user: User): string => {
  const parts = [
    user.addressStreet,
    user.addressCity,
    user.addressState,
    user.addressPostalCode,
    user.addressCountry,
  ].filter(Boolean); // Filter out null/undefined/empty strings
  return parts.length > 0 ? parts.join(', ') : "Location not specified";
};

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

export default function BrowseShops() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: shops, isLoading } = useQuery<User[]>({
    queryKey: ["/api/shops"],
  });

  const filteredShops = shops?.filter(shop => 
    shop.role === "shop" &&
    (shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     shop.shopProfile?.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 p-6"
      >
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <h1 className="text-2xl font-bold">Browse Shops</h1>
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Input
              placeholder="Search shops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !filteredShops?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No shops found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredShops.map((shop) => (
              <motion.div key={shop.id} variants={item}>
                <Link href={`/customer/shop/${shop.id}`}>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            {shop.profilePicture ? (
                              <img
                                src={shop.profilePicture}
                                alt={shop.name}
                                className="h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              <Store className="h-6 w-6 text-primary" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{shop.shopProfile?.shopName || shop.name}</h3>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3 mr-1" />
                              <span>{formatAddress(shop)}</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {shop.shopProfile?.description || "No description available"}
                        </p>
                        <div className="mt-auto pt-2">
                          <Button variant="outline" className="w-full">
                            View Shop
                          </Button>
                        </div>
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