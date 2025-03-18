import * as React from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { Clock, Calendar as CalendarIcon, X } from "lucide-react";
import { z } from "zod";
import { format, parse, addMinutes } from "date-fns";

const blockTimeSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  reason: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringEndDate: z.string().optional(),
});

type BlockTimeFormData = z.infer<typeof blockTimeSchema>;

interface ServiceAvailabilityCalendarProps {
  serviceId: number;
  workingHours: any;
  breakTime: Array<{ start: string; end: string }>;
}

export function ServiceAvailabilityCalendar({ serviceId, workingHours, breakTime }: ServiceAvailabilityCalendarProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [showBlockDialog, setShowBlockDialog] = React.useState(false);

  const form = useForm<BlockTimeFormData>({
    resolver: zodResolver(blockTimeSchema),
    defaultValues: {
      startTime: "",
      endTime: "",
      isRecurring: false,
    },
  });

  // Fetch blocked time slots
  const { data: blockedSlots } = useQuery({
    queryKey: ["/api/services", serviceId, "blocked-slots"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/services/${serviceId}/blocked-slots`);
      if (!res.ok) throw new Error("Failed to fetch blocked slots");
      return res.json();
    },
  });

  // Block time slot mutation
  const blockTimeMutation = useMutation({
    mutationFn: async (data: BlockTimeFormData) => {
      const res = await apiRequest("POST", `/api/services/${serviceId}/block-time`, {
        ...data,
        date: selectedDate.toISOString(),
      });
      if (!res.ok) throw new Error("Failed to block time slot");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", serviceId, "blocked-slots"] });
      toast({
        title: t("success"),
        description: t("time_slot_blocked"),
      });
      setShowBlockDialog(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unblock time slot mutation
  const unblockTimeMutation = useMutation({
    mutationFn: async (slotId: number) => {
      const res = await apiRequest("DELETE", `/api/services/${serviceId}/blocked-slots/${slotId}`);
      if (!res.ok) throw new Error("Failed to unblock time slot");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", serviceId, "blocked-slots"] });
      toast({
        title: t("success"),
        description: t("time_slot_unblocked"),
      });
    },
  });

  const dayWorkingHours = workingHours[format(selectedDate, 'EEEE').toLowerCase()];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">{t("availability_calendar")}</h3>
        <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
          <DialogTrigger asChild>
            <Button>{t("block_time_slot")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("block_time_slot")}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => blockTimeMutation.mutate(data))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("start_time")}</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("end_time")}</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reason")}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t("block_reason_placeholder")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full">
                  {t("block_time_slot")}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && setSelectedDate(date)}
        />

        <div className="space-y-4">
          <h4 className="font-medium">{format(selectedDate, 'PPP')}</h4>
          {dayWorkingHours?.isAvailable ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t("working_hours")}: {dayWorkingHours.start} - {dayWorkingHours.end}
              </p>
              {breakTime.map((break_, index) => (
                <p key={index} className="text-sm text-muted-foreground">
                  {t("break_time")}: {break_.start} - {break_.end}
                </p>
              ))}
              <div className="space-y-2 mt-4">
                <h5 className="font-medium">{t("blocked_slots")}</h5>
                {blockedSlots?.filter(slot => 
                  format(new Date(slot.date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
                ).map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">
                        {format(parse(slot.startTime, 'HH:mm', new Date()), 'p')} - 
                        {format(parse(slot.endTime, 'HH:mm', new Date()), 'p')}
                      </p>
                      {slot.reason && (
                        <p className="text-sm text-muted-foreground">{slot.reason}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => unblockTimeMutation.mutate(slot.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("not_working_day")}</p>
          )}
        </div>
      </div>
    </div>
  );
}