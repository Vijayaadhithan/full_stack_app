import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Order, ReturnRequest } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import {
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { z } from "zod";

const returnRequestSchema = z.object({
  reason: z.string().min(10, "Please provide a detailed reason"),
  items: z.array(z.object({
    productId: z.number(),
    quantity: z.number().min(1),
  })),
});

type ReturnRequestForm = z.infer<typeof returnRequestSchema>;

export default function OrderDetails() {
  const { id } = useParams();
  const { toast } = useToast();

  const { data: order, isLoading: orderLoading } = useQuery<Order>({
    queryKey: [`/api/orders/${id}`],
  });

  const { data: timeline } = useQuery({
    queryKey: [`/api/orders/${id}/timeline`],
    enabled: !!order,
  });

  const form = useForm<ReturnRequestForm>({
    resolver: zodResolver(returnRequestSchema),
    defaultValues: {
      reason: "",
      items: [],
    },
  });

  const returnMutation = useMutation({
    mutationFn: async (data: ReturnRequestForm) => {
      const res = await apiRequest("POST", `/api/orders/${id}/return`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      toast({
        title: "Return request submitted",
        description: "We'll process your request and get back to you soon.",
      });
    },
  });

  if (orderLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const statusIcon = {
    pending: <AlertCircle className="h-5 w-5 text-yellow-500" />,
    confirmed: <CheckCircle className="h-5 w-5 text-green-500" />,
    shipped: <Truck className="h-5 w-5 text-blue-500" />,
    delivered: <Package className="h-5 w-5 text-green-500" />,
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
          <h1 className="text-2xl font-bold">Order #{order?.id}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timeline?.map((update, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 border-l-2 border-border pl-4 pb-4 last:pb-0"
                >
                  {statusIcon[update.status]}
                  <div>
                    <p className="font-medium">Order {update.status}</p>
                    {update.trackingInfo && (
                      <p className="text-sm text-muted-foreground">
                        {update.trackingInfo}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {new Date(update.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {order?.status === "delivered" && !order.returnRequested && (
          <Card>
            <CardHeader>
              <CardTitle>Return Request</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => returnMutation.mutate(data))}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason for Return</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Please explain why you want to return this order..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={returnMutation.isPending}
                    className="w-full"
                  >
                    {returnMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Submit Return Request
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
