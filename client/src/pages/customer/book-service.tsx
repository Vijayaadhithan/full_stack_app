import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Service, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Clock, Calendar as CalendarIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { addDays, format, parse, isAfter, isBefore, addMinutes } from "date-fns";

type TimeSlot = {
  start: Date;
  end: Date;
  available: boolean;
};

export default function BookService() {
  const { id } = useParams();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>();
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<"weekly" | "monthly">();
  const [joinWaitlist, setJoinWaitlist] = useState(false);

  const { data: service, isLoading: serviceLoading } = useQuery<Service>({
    queryKey: [`/api/services/${id}`],
  });

  const { data: provider } = useQuery<User>({
    queryKey: [`/api/users/${service?.providerId}`],
    enabled: !!service?.providerId,
  });

  const { data: availability } = useQuery<TimeSlot[]>({
    queryKey: [`/api/services/${id}/availability`, selectedDate.toISOString()],
    enabled: !!service,
  });

  const bookingMutation = useMutation({
    mutationFn: async (data: {
      serviceId: number;
      date: string;
      time: string;
      isRecurring: boolean;
      recurringPattern?: string;
    }) => {
      const res = await apiRequest("POST", "/api/bookings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Booking successful",
        description: "Your service has been booked successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const waitlistMutation = useMutation({
    mutationFn: async (data: { serviceId: number; preferredDate: string }) => {
      const res = await apiRequest("POST", "/api/waitlist", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to waitlist",
        description: "You'll be notified when a slot becomes available.",
      });
    },
  });

  const handleBooking = () => {
    if (!selectedTime || !service) return;

    const dateTime = parse(selectedTime, "HH:mm", selectedDate);
    
    if (joinWaitlist) {
      waitlistMutation.mutate({
        serviceId: service.id,
        preferredDate: dateTime.toISOString(),
      });
      return;
    }

    bookingMutation.mutate({
      serviceId: service.id,
      date: selectedDate.toISOString(),
      time: selectedTime,
      isRecurring,
      recurringPattern,
    });
  };

  if (serviceLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="loading loading-spinner" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Book {service?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label>Select Date</Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) =>
                    isBefore(date, new Date()) ||
                    isAfter(date, addDays(new Date(), 30))
                  }
                />
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Available Time Slots</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {availability?.map((slot) => (
                      <Button
                        key={slot.start.toISOString()}
                        variant={
                          selectedTime ===
                          format(slot.start, "HH:mm")
                            ? "default"
                            : "outline"
                        }
                        disabled={!slot.available}
                        onClick={() =>
                          setSelectedTime(format(slot.start, "HH:mm"))
                        }
                        className="w-full"
                      >
                        {format(slot.start, "HH:mm")}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={isRecurring}
                      onCheckedChange={setIsRecurring}
                    />
                    <Label>Make this a recurring booking</Label>
                  </div>

                  {isRecurring && (
                    <Select
                      value={recurringPattern}
                      onValueChange={(value: "weekly" | "monthly") =>
                        setRecurringPattern(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select recurring pattern" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {!availability?.some((slot) => slot.available) && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={joinWaitlist}
                      onCheckedChange={setJoinWaitlist}
                    />
                    <Label>Join waitlist for this date</Label>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleBooking}
                  disabled={(!selectedTime && !joinWaitlist) || bookingMutation.isPending}
                >
                  {bookingMutation.isPending ? (
                    <span className="loading loading-spinner" />
                  ) : joinWaitlist ? (
                    "Join Waitlist"
                  ) : (
                    "Book Service"
                  )}
                </Button>
              </div>
            </div>

            {service && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Service Details</h3>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Duration: {service.duration} minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span>Buffer time: {service.bufferTime} minutes</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
