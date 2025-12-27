import React, { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useQuery } from "@tanstack/react-query";
import { Booking, Service, User } from "@shared/schema";
import { formatIndianDisplay, formatInIndianTime } from "@shared/date-utils";
import { IndianRupee, Loader2, Search, Users } from "lucide-react";

type ProviderBookingService =
  | Service
  | {
      price?: string | number | null;
    };

type ProviderBookingCustomer = Pick<User, "id" | "name" | "phone">;

type ProviderBooking = Booking & {
  service?: ProviderBookingService | null;
  customer?: ProviderBookingCustomer | null;
};

type CustomerEarningsRow = {
  name: string;
  phone?: string | null;
  total: number;
  count: number;
  lastJobDate: string | null;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const readServicePrice = (
  service?: ProviderBookingService | null,
): number | null => {
  if (!service || !("price" in service)) return null;
  const raw = service.price;
  const value =
    typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  return Number.isFinite(value) ? value : null;
};

const formatRupees = (amount?: number | null): string => {
  const safeAmount = Number.isFinite(amount) ? Number(amount) : 0;
  return `₹${currencyFormatter.format(safeAmount)}`;
};

const INDIAN_DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const getIndianDayKey = (date: Date | string | null | undefined) => {
  if (!date) return null;
  const key = formatInIndianTime(date, "yyyy-MM-dd");
  return INDIAN_DAY_KEY_REGEX.test(key) ? key : null;
};
const getIndianMonthKey = (date: Date | string | null | undefined) => {
  if (!date) return null;
  return formatInIndianTime(date, "yyyy-MM");
};

export default function ProviderEarnings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: bookings, isLoading } = useQuery<ProviderBooking[]>({
    queryKey: ["/api/bookings/provider"],
    enabled: !!user?.id,
  });

  const todayKey = getIndianDayKey(new Date());
  const monthKey = getIndianMonthKey(new Date());
  const customerFallbackLabel = t("customer");

  const earningsSummary = useMemo(() => {
    const summary = {
      todayTotal: 0,
      monthTotal: 0,
      allTimeTotal: 0,
      customers: [] as CustomerEarningsRow[],
    };

    if (!bookings || !todayKey || !monthKey) return summary;

    const earningsStatuses = new Set<Booking["status"]>([
      "completed",
      "awaiting_payment",
    ]);
    const totalsByCustomer = new Map<string, CustomerEarningsRow>();

    bookings.forEach((booking) => {
      if (!earningsStatuses.has(booking.status)) return;
      const amount = readServicePrice(booking.service);
      if (amount == null) return;

      summary.allTimeTotal += amount;

      const bookingDayKey = getIndianDayKey(booking.bookingDate);
      if (bookingDayKey === todayKey) {
        summary.todayTotal += amount;
      }

      const bookingMonthKey = getIndianMonthKey(booking.bookingDate);
      if (bookingMonthKey === monthKey) {
        summary.monthTotal += amount;
      }

      const customerName =
        booking.customer?.name?.trim() || customerFallbackLabel;
      const key = booking.customer?.id
        ? `customer-${booking.customer.id}`
        : `booking-${booking.id}`;
      const entry = totalsByCustomer.get(key) ?? {
        name: customerName,
        phone: booking.customer?.phone ?? null,
        total: 0,
        count: 0,
        lastJobDate: null,
      };

      entry.total += amount;
      entry.count += 1;

      if (booking.bookingDate) {
        const currentLast = entry.lastJobDate
          ? new Date(entry.lastJobDate).getTime()
          : 0;
        const nextTime = new Date(booking.bookingDate).getTime();
        if (Number.isFinite(nextTime) && nextTime > currentLast) {
          entry.lastJobDate =
            booking.bookingDate instanceof Date
              ? booking.bookingDate.toISOString()
              : String(booking.bookingDate);
        }
      }

      totalsByCustomer.set(key, entry);
    });

    summary.customers = Array.from(totalsByCustomer.values()).sort(
      (a, b) => b.total - a.total,
    );

    return summary;
  }, [bookings, customerFallbackLabel, monthKey, todayKey]);

  const filteredCustomers = useMemo(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!trimmed) return earningsSummary.customers;
    return earningsSummary.customers.filter((customer) => {
      const nameMatch = customer.name.toLowerCase().includes(trimmed);
      const phoneMatch = customer.phone?.includes(trimmed);
      return nameMatch || phoneMatch;
    });
  }, [earningsSummary.customers, searchTerm]);

  const showingCountLabel = t("showing_customers_count").replace(
    "{count}",
    String(filteredCustomers.length),
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("provider_earnings_title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("provider_earnings_subtitle")}
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            {showingCountLabel}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-emerald-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("earnings_today")}
              </CardTitle>
              <IndianRupee className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatRupees(earningsSummary.todayTotal)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-sky-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("earnings_month")}
              </CardTitle>
              <IndianRupee className="h-4 w-4 text-sky-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatRupees(earningsSummary.monthTotal)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("earnings_total")}
              </CardTitle>
              <Users className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatRupees(earningsSummary.allTimeTotal)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{t("earnings_customers_title")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("earnings_customers_subtitle")}
              </p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("earnings_search_placeholder")}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {earningsSummary.customers.length === 0
                  ? t("earnings_empty_state")
                  : t("earnings_no_results")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("customer")}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("earnings_jobs")}
                    </TableHead>
                    <TableHead>{t("earnings_total")}</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("earnings_last_job")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer, index) => (
                    <TableRow key={`${customer.name}-${index}`}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{customer.name}</p>
                          {customer.phone ? (
                            <p className="text-xs text-muted-foreground">
                              {customer.phone}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {customer.count}{" "}
                        {customer.count === 1
                          ? t("job_single")
                          : t("job_plural")}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatRupees(customer.total)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {customer.lastJobDate
                          ? formatIndianDisplay(customer.lastJobDate, "date")
                          : t("not_available")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
