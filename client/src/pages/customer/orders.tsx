import React from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Order } from "@shared/schema";
import { motion } from "framer-motion";
import { Package, ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { formatIndianDisplay } from "@shared/date-utils";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Orders() {
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/customer"],
  });

  return (
    <DashboardLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-6 p-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Orders</h1>
          <Link href="/customer">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !orders || orders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">You have no orders yet</p>
              <Link href="/customer/browse-shops">
                <Button className="mt-4">Browse Shops</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <motion.div key={order.id} variants={itemVariants}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">Order #{order.id}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Order ID: {order.id} <span className="mx-1">•</span>{" "}
                          Placed{" "}
                          {order.orderDate
                            ? formatIndianDisplay(order.orderDate, "datetime")
                            : "recently"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <p className="font-semibold">₹{order.total}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {order.status}
                        </p>
                        <Link href={`/customer/order/${order.id}`}>
                          <Button size="sm" variant="outline" className="mt-2">
                            View Details{" "}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
