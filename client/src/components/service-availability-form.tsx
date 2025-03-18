import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useLanguage } from "@/contexts/language-context";
import { Clock, Plus, Trash } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { WorkingHours, BreakTime } from "@shared/schema";

interface ServiceAvailabilityFormProps {
  form: UseFormReturn<any>;
}

export function ServiceAvailabilityForm({ form }: ServiceAvailabilityFormProps) {
  const { t } = useLanguage();

  const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

  // Initialize working hours if not set
  if (!form.getValues('workingHours')) {
    const defaultWorkingHours = weekDays.reduce((acc, day) => ({
      ...acc,
      [day]: {
        isAvailable: day !== 'sunday',
        start: '09:00',
        end: '17:00'
      }
    }), {});
    form.setValue('workingHours', defaultWorkingHours);
  }

  // Initialize break time if not set
  if (!form.getValues('breakTime')) {
    form.setValue('breakTime', []);
  }

  const handleAddBreakTime = () => {
    const currentBreakTime = form.getValues('breakTime') || [];
    form.setValue('breakTime', [...currentBreakTime, { start: '13:00', end: '14:00' }]);
  };

  const handleRemoveBreakTime = (index: number) => {
    const currentBreakTime = form.getValues('breakTime');
    form.setValue('breakTime', currentBreakTime.filter((_: any, i: number) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('working_hours')}</h3>
        {weekDays.map((day) => (
          <div key={day} className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <FormLabel>{t(`day.${day}`)}</FormLabel>
              <FormField
                control={form.control}
                name={`workingHours.${day}.isAvailable`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {form.watch(`workingHours.${day}.isAvailable`) && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={`workingHours.${day}.start`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('start_time')}</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`workingHours.${day}.end`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('end_time')}</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{t('break_time')}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddBreakTime}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('add_break')}
          </Button>
        </div>

        <div className="space-y-4">
          {form.watch('breakTime')?.map((breakTime: BreakTime, index: number) => (
            <div key={index} className="flex items-end gap-4">
              <FormField
                control={form.control}
                name={`breakTime.${index}.start`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>{t('start_time')}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`breakTime.${index}.end`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>{t('end_time')}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveBreakTime(index)}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('scheduling_settings')}</h3>
        <FormField
          control={form.control}
          name="maxDailyBookings"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('max_daily_bookings')}</FormLabel>
              <FormControl>
                <Input type="number" min="1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bufferTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('buffer_time')} ({t('minutes')})</FormLabel>
              <FormControl>
                <Input type="number" min="0" step="5" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}