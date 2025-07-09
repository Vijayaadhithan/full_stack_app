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
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Order, ReturnRequest } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
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
import { formatIndianDisplay } from '@shared/date-utils'; 
// Define the type for timeline updates
interface TimelineUpdate {
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered'; // Use specific statuses if known
  trackingInfo?: string;
  timestamp: string | Date;
}
interface DetailedOrder extends Order {
  shop?: {
    upiId?: string | null;
    phone?: string | null;
    name?: string | null;
    email?: string | null;
  };
}
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

  const { data: order, isLoading: orderLoading } = useQuery<DetailedOrder>({
    queryKey: [`/api/orders/${id}`],
  });

  const { data: timeline } = useQuery<TimelineUpdate[]>({
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

  const [reference, setReference] = useState("");

  const submitPaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/orders/${id}/submit-payment-reference`, { paymentReference: reference });
      if (!res.ok) throw new Error("Failed to submit reference");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      toast({ title: "Payment reference submitted" });
      setReference("");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
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

  const statusIcon: Record<TimelineUpdate['status'], React.ReactElement> = {
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

        {order?.paymentStatus === "pending" && order?.shopId && (
          <Card>
            <CardHeader>
              <CardTitle>Complete Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">Step 1: Pay ₹{order?.total} to {order?.shop?.upiId}</p>
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(order.shop!.upiId!)}>
                  Copy UPI ID
                </Button>
              </div>
              <div className="space-y-2">
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ID" />
                <Button size="sm" onClick={() => submitPaymentMutation.mutate()} disabled={submitPaymentMutation.isPending || !reference}>
                  {submitPaymentMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                  Submit Confirmation
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {order?.paymentStatus === "verifying" && (
          <Card>
            <CardContent>
              <p className="text-sm">Payment verification in progress. The shop owner has been notified and will confirm your payment shortly.</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Order Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timeline?.map((update: TimelineUpdate, index: number) => (
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
                      {formatIndianDisplay(update.timestamp, 'datetime')}
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
        {order && order.shop && (
          <Card>
            <CardContent>
              <p className="text-sm">For questions about your order, you can contact the shop owner at: {order.shop?.phone}</p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
