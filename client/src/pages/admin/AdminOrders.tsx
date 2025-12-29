import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRupees,
  toNumber,
} from "./admin-utils";

type Transaction = {
  id: number;
  status: string;
  paymentStatus: string | null;
  total: string;
  paymentReference: string | null;
  orderDate: string | null;
  customer: { id: number; name: string | null; email: string | null } | null;
  shop: { id: number; name: string | null; email: string | null } | null;
};

type TransactionsResponse = {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  transactions: Transaction[];
};

type DashboardStats = {
  totalOrders: number;
  totalRevenue: string;
  pendingOrders: number;
};

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

const PAYMENT_STATUSES = ["pending", "verifying", "paid", "failed"];

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-blue-200 bg-blue-50 text-blue-700",
  processing: "border-sky-200 bg-sky-50 text-sky-700",
  packed: "border-indigo-200 bg-indigo-50 text-indigo-700",
  dispatched: "border-indigo-200 bg-indigo-50 text-indigo-700",
  shipped: "border-purple-200 bg-purple-50 text-purple-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  returned: "border-orange-200 bg-orange-50 text-orange-700",
  awaiting_customer_agreement: "border-amber-200 bg-amber-50 text-amber-700",
};

const PAYMENT_STYLES: Record<string, string> = {
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  verifying: "border-sky-200 bg-sky-50 text-sky-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function AdminOrders() {
  const { admin } = useAdmin();
  const permissions = new Set(admin?.permissions || []);
  const canViewOrders = permissions.has("view_all_orders");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("");
  const [shop, setShop] = useState("");

  const params = useMemo(() => {
    const searchParams = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (status) searchParams.set("status", status);
    if (paymentStatus) searchParams.set("paymentStatus", paymentStatus);
    if (search) searchParams.set("search", search);
    if (customer) searchParams.set("customer", customer);
    if (shop) searchParams.set("shop", shop);
    return searchParams;
  }, [customer, page, pageSize, paymentStatus, search, shop, status]);

  const queryKey = params.toString();

  const transactionsQuery = useQuery<TransactionsResponse>({
    queryKey: ["/api/admin/transactions", queryKey],
    queryFn: () =>
      apiRequest("GET", `/api/admin/transactions?${queryKey}`).then((r) => r.json()),
    placeholderData: (previous) => previous,
    enabled: canViewOrders,
  });

  const statsQuery = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard-stats"],
    queryFn: () => apiRequest("GET", "/api/admin/dashboard-stats").then((r) => r.json()),
  });

  const data = transactionsQuery.data;
  const transactions = useMemo(() => data?.transactions ?? [], [data?.transactions]);
  const totalCount = data?.total ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd =
    totalCount === 0 ? 0 : Math.min((page - 1) * pageSize + transactions.length, totalCount);

  const summary = useMemo(() => {
    const statusCounts = new Map<string, number>();
    let totalValue = 0;
    let paidValue = 0;
    let paidCount = 0;

    transactions.forEach((transaction) => {
      statusCounts.set(
        transaction.status,
        (statusCounts.get(transaction.status) ?? 0) + 1,
      );
      const total = toNumber(transaction.total);
      totalValue += total;
      if (transaction.paymentStatus === "paid") {
        paidValue += total;
        paidCount += 1;
      }
    });

    const count = transactions.length;
    return {
      count,
      totalValue,
      paidValue,
      paidCount,
      avgValue: count ? totalValue / count : 0,
      statusCounts,
    };
  }, [transactions]);

  const resetPage = () => setPage(1);

  if (!canViewOrders) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Orders &amp; Revenue</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You do not have permission to view orders.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Orders &amp; Revenue</h2>
        <p className="text-sm text-muted-foreground">
          Monitor order flow, payment health, and customer demand signals.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All-time revenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">
              {formatRupees(statsQuery.data?.totalRevenue ?? 0, { compact: true })}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatNumber(statsQuery.data?.totalOrders ?? 0)} total orders
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pending fulfillment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">
              {formatNumber(statsQuery.data?.pendingOrders ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              Orders awaiting action across the network.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment success rate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">
              {summary.count
                ? formatPercent(summary.paidCount / summary.count, { alreadyRatio: true })
                : "—"}
            </div>
            <Progress
              value={summary.count ? (summary.paidCount / summary.count) * 100 : 0}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Filtered orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(summary.count)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gross value (page)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatRupees(summary.totalValue, { compact: true })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Paid value (page)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatRupees(summary.paidValue, { compact: true })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avg order value</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatRupees(summary.avgValue, { compact: true })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Order filters</CardTitle>
              <div className="text-sm text-muted-foreground">
                Search by customer, shop, or payment reference.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => transactionsQuery.refetch()}
              disabled={transactionsQuery.isFetching}
            >
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input
              placeholder="Search everywhere..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
            />
            <Input
              placeholder="Customer name or email"
              value={customer}
              onChange={(event) => {
                setCustomer(event.target.value);
                resetPage();
              }}
            />
            <Input
              placeholder="Shop name or email"
              value={shop}
              onChange={(event) => {
                setShop(event.target.value);
                resetPage();
              }}
            />
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                resetPage();
              }}
            >
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={paymentStatus}
              onChange={(event) => {
                setPaymentStatus(event.target.value);
                resetPage();
              }}
            >
              <option value="">All payment states</option>
              {PAYMENT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                resetPage();
              }}
            >
              <option value={10}>10 rows</option>
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {summary.count === 0 && (
              <div className="text-muted-foreground">No orders to summarize.</div>
            )}
            {summary.count > 0 &&
              Array.from(summary.statusCounts.entries()).map(([statusKey, count]) => (
                <div key={statusKey} className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="uppercase">{statusKey}</span>
                    <span>{formatNumber(count)}</span>
                  </div>
                  <Progress value={(count / summary.count) * 100} />
                </div>
              ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Order ledger</h3>
            <p className="text-sm text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {formatNumber(totalCount)} orders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || transactionsQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="text-sm">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!data?.hasMore || transactionsQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Placed</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-mono text-xs">{transaction.id}</TableCell>
                    <TableCell>
                      <div className="font-medium">{transaction.customer?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.customer?.email ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{transaction.shop?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.shop?.email ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`uppercase ${STATUS_STYLES[transaction.status] ?? ""}`}
                      >
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`uppercase ${
                          transaction.paymentStatus
                            ? PAYMENT_STYLES[transaction.paymentStatus] ?? ""
                            : ""
                        }`}
                      >
                        {transaction.paymentStatus ?? "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatRupees(transaction.total)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(transaction.orderDate)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {transaction.paymentReference ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                      {transactionsQuery.isFetching ? "Loading orders..." : "No orders found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
