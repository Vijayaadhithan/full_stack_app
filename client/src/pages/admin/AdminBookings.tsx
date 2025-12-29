import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatNumber } from "./admin-utils";

type Booking = {
  id: number;
  customerId: number | null;
  serviceId: number | null;
  bookingDate: string | null;
  status: string;
  paymentStatus: string | null;
  disputeReason?: string | null;
  timeSlotLabel?: string | null;
  createdAt?: string | null;
};

const BOOKING_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "rescheduled",
  "completed",
  "cancelled",
  "expired",
  "rescheduled_pending_provider_approval",
  "rescheduled_by_provider",
  "awaiting_payment",
  "en_route",
  "disputed",
];

const PAYMENT_STATUSES = ["pending", "verifying", "paid", "failed"];

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  accepted: "border-blue-200 bg-blue-50 text-blue-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  rescheduled: "border-indigo-200 bg-indigo-50 text-indigo-700",
  rescheduled_pending_provider_approval: "border-indigo-200 bg-indigo-50 text-indigo-700",
  rescheduled_by_provider: "border-indigo-200 bg-indigo-50 text-indigo-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  expired: "border-orange-200 bg-orange-50 text-orange-700",
  awaiting_payment: "border-amber-200 bg-amber-50 text-amber-700",
  en_route: "border-sky-200 bg-sky-50 text-sky-700",
  disputed: "border-purple-200 bg-purple-50 text-purple-700",
};

const PAYMENT_STYLES: Record<string, string> = {
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  verifying: "border-sky-200 bg-sky-50 text-sky-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
};

const getBookingPaymentStatus = (booking: Booking) => {
  if (
    booking.status === "completed" &&
    (booking.paymentStatus === "pending" || booking.paymentStatus == null)
  ) {
    return "paid";
  }
  return booking.paymentStatus ?? "pending";
};

export default function AdminBookings() {
  const { admin } = useAdmin();
  const permissions = new Set(admin?.permissions || []);
  const canViewBookings = permissions.has("view_all_bookings");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const { data: bookings } = useQuery<Booking[]>({
    queryKey: ["/api/admin/all-bookings"],
    queryFn: () => apiRequest("GET", "/api/admin/all-bookings").then((r) => r.json()),
    enabled: canViewBookings,
  });

  const resolveMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number;
      status: "completed" | "cancelled";
    }) =>
      apiRequest("PATCH", `/api/admin/bookings/${id}/resolve`, {
        resolutionStatus: status,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/all-bookings"] }),
  });

  const filteredBookings = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return (bookings ?? []).filter((booking) => {
      if (statusFilter && booking.status !== statusFilter) return false;
      if (paymentFilter && getBookingPaymentStatus(booking) !== paymentFilter) return false;
      if (searchTerm) {
        const haystack = [
          booking.id,
          booking.customerId,
          booking.serviceId,
          booking.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });
  }, [bookings, paymentFilter, search, statusFilter]);

  if (!canViewBookings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bookings Ops</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You do not have permission to view bookings.
        </CardContent>
      </Card>
    );
  }

  const disputedBookings = filteredBookings.filter((booking) => booking.status === "disputed");
  const completedBookings = filteredBookings.filter((booking) => booking.status === "completed");
  const cancelledBookings = filteredBookings.filter((booking) =>
    ["cancelled", "rejected", "expired"].includes(booking.status),
  );
  const activeBookings = filteredBookings.filter((booking) =>
    ["pending", "accepted", "rescheduled", "awaiting_payment", "en_route"].includes(
      booking.status,
    ),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Bookings Ops</h2>
        <p className="text-sm text-muted-foreground">
          Track service bookings, dispute status, and payment visibility.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total bookings</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(filteredBookings.length)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(activeBookings.length)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Disputed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(disputedBookings.length)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(completedBookings.length)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cancelled/Rejected</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(cancelledBookings.length)}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Booking filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input
              placeholder="Search by booking or customer ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {BOOKING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
            >
              <option value="">All payment states</option>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispute queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {disputedBookings.length === 0 && (
              <div className="text-muted-foreground">No disputes awaiting action.</div>
            )}
            {disputedBookings.slice(0, 3).map((booking) => (
              <div key={booking.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Booking #{booking.id}</span>
                  <Badge variant="outline" className="uppercase">
                    disputed
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Reason: {booking.disputeReason ?? "—"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => resolveMutation.mutate({ id: booking.id, status: "completed" })}
                    disabled={resolveMutation.isPending}
                  >
                    Mark completed
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => resolveMutation.mutate({ id: booking.id, status: "cancelled" })}
                    disabled={resolveMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
            {disputedBookings.length > 3 && (
              <div className="text-xs text-muted-foreground">
                {formatNumber(disputedBookings.length - 3)} more disputes in the list.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                      No bookings found.
                    </TableCell>
                  </TableRow>
                )}
                {filteredBookings.map((booking) => {
                  const paymentStatus = getBookingPaymentStatus(booking);
                  return (
                    <TableRow key={booking.id}>
                      <TableCell className="font-mono text-xs">#{booking.id}</TableCell>
                      <TableCell className="text-sm">
                        {booking.customerId ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{booking.serviceId ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`uppercase ${STATUS_STYLES[booking.status] ?? ""}`}
                        >
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`uppercase ${
                            paymentStatus ? PAYMENT_STYLES[paymentStatus] ?? "" : ""
                          }`}
                        >
                          {paymentStatus ?? "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(booking.bookingDate)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(booking.createdAt)}
                      </TableCell>
                      <TableCell>
                        {booking.status === "disputed" ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                resolveMutation.mutate({
                                  id: booking.id,
                                  status: "completed",
                                })
                              }
                              disabled={resolveMutation.isPending}
                            >
                              Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                resolveMutation.mutate({ id: booking.id, status: "cancelled" })
                              }
                              disabled={resolveMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
