import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, ShoppingBag, Users, Wallet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAdmin } from "@/hooks/use-admin";
import type { MonitoringSnapshot } from "@shared/monitoring";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  formatDuration,
  formatNumber,
  formatPercent,
  formatRupees,
  toNumber,
} from "./admin-utils";

type DashboardStats = {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: string;
  totalBookings: number;
  pendingOrders: number;
  todaysBookings: number;
};

type HealthStatus = {
  database: string;
  api: string;
  jobs: {
    bookingExpiration: string | null;
    paymentReminder: string | null;
  };
};

type Transaction = {
  id: number;
  status: string;
  paymentStatus: string | null;
  total: string;
  orderDate: string | null;
  paymentReference: string | null;
  customer: { id: number; name: string | null; email: string | null } | null;
  shop: { id: number; name: string | null; email: string | null } | null;
};

type TransactionsResponse = {
  transactions: Transaction[];
};

type ShopTransactionStat = {
  shopId: number;
  shopName: string | null;
  transactionCount: number;
};

type AuditLog = {
  id: number;
  adminId: string;
  action: string;
  resource: string;
  createdAt: string;
};

type LogEntry = {
  timestamp: string;
  level: string;
  message: string;
  category: string;
};

type LogResponse = {
  logs: LogEntry[];
};

const metricCards = [
  { key: "totalUsers", label: "Total users", icon: Users },
  { key: "totalOrders", label: "Total orders", icon: ShoppingBag },
  { key: "totalRevenue", label: "Paid revenue", icon: Wallet },
  { key: "totalBookings", label: "Total bookings", icon: CalendarCheck },
];

export default function AdminDashboard() {
  const { admin } = useAdmin();
  const permissions = new Set(admin?.permissions || []);
  const canViewOrders = permissions.has("view_all_orders");
  const canViewHealth = permissions.has("view_health");
  const canManageAdmins = permissions.has("manage_admins");

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard-stats"],
    queryFn: () => apiRequest("GET", "/api/admin/dashboard-stats").then((r) => r.json()),
  });

  const { data: health } = useQuery<HealthStatus>({
    queryKey: ["/api/admin/health-status"],
    queryFn: () => apiRequest("GET", "/api/admin/health-status").then((r) => r.json()),
    enabled: canViewHealth,
  });

  const { data: monitoring } = useQuery<MonitoringSnapshot>({
    queryKey: ["/api/admin/monitoring/summary"],
    queryFn: () => apiRequest("GET", "/api/admin/monitoring/summary").then((r) => r.json()),
    enabled: canViewHealth,
  });

  const { data: transactions } = useQuery<TransactionsResponse>({
    queryKey: ["/api/admin/transactions", "dashboard"],
    queryFn: () => apiRequest("GET", "/api/admin/transactions?page=1&pageSize=6").then((r) => r.json()),
    enabled: canViewOrders,
  });

  const { data: shopStats } = useQuery<ShopTransactionStat[]>({
    queryKey: ["/api/admin/shops/transactions"],
    queryFn: () => apiRequest("GET", "/api/admin/shops/transactions").then((r) => r.json()),
    enabled: canViewOrders,
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    queryFn: () => apiRequest("GET", "/api/admin/audit-logs").then((r) => r.json()),
    enabled: canManageAdmins,
  });

  const { data: errorLogs } = useQuery<LogResponse>({
    queryKey: ["/api/admin/logs", "error"],
    queryFn: () =>
      apiRequest("GET", "/api/admin/logs?limit=6&level=error").then((r) => r.json()),
    enabled: canViewHealth,
  });

  const performanceSummary = useMemo(() => {
    if (!monitoring) return null;
    const requests = monitoring.requests;
    const errors = monitoring.errors;
    const errorCount =
      requests.statusBuckets.clientError + requests.statusBuckets.serverError;
    const errorRate = requests.total ? errorCount / requests.total : 0;
    return {
      rpm: requests.rpm,
      p95: requests.p95DurationMs,
      errorRate,
      errorPerMinute: errors.perMinute,
      cpu: monitoring.resources.cpu.percent,
      inFlight: requests.inFlight,
    };
  }, [monitoring]);

  const revenueValue = toNumber(stats?.totalRevenue);
  const avgOrderValue =
    stats?.totalOrders && revenueValue
      ? revenueValue / Math.max(stats.totalOrders, 1)
      : 0;

  const topShops = (shopStats ?? []).slice(0, 5);
  const maxShopTransactions = Math.max(
    1,
    ...topShops.map((shop) => shop.transactionCount),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Dashboard Snapshot</h2>
        <p className="text-sm text-muted-foreground">
          High-level KPIs across users, orders, revenue, and operational health.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          const value =
            metric.key === "totalRevenue"
              ? formatRupees(stats?.totalRevenue ?? 0, { compact: true })
              : formatNumber(stats?.[metric.key as keyof DashboardStats] ?? 0, {
                  compact: true,
                });
          return (
            <Card key={metric.key}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{metric.label}</CardDescription>
                <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold">{value}</div>
                {metric.key === "totalRevenue" && (
                  <div className="text-xs text-muted-foreground">
                    Avg order {formatRupees(avgOrderValue, { compact: true })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending orders</CardDescription>
            <CardTitle className="text-2xl">
              {formatNumber(stats?.pendingOrders ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Fulfillment queue requiring attention.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Today&apos;s bookings</CardDescription>
            <CardTitle className="text-2xl">
              {formatNumber(stats?.todaysBookings ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Scheduled services for today.
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle>System Health</CardTitle>
              {canViewHealth ? (
                <Badge variant="secondary">Live</Badge>
              ) : (
                <Badge variant="outline">Restricted</Badge>
              )}
            </div>
            <CardDescription>Core dependencies and background jobs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!canViewHealth ? (
              <div className="rounded-lg border border-dashed p-4 text-muted-foreground">
                You do not have permission to view system health.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span>Database</span>
                  <Badge variant={health?.database === "ok" ? "secondary" : "destructive"}>
                    {health?.database ?? "checking"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>API</span>
                  <Badge variant={health?.api === "ok" ? "secondary" : "destructive"}>
                    {health?.api ?? "checking"}
                  </Badge>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                  <div className="font-semibold text-muted-foreground">Job activity</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Booking expiry sweep</span>
                      <span>{formatDateTime(health?.jobs?.bookingExpiration ?? null)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Payment reminders</span>
                      <span>{formatDateTime(health?.jobs?.paymentReminder ?? null)}</span>
                    </div>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/health">Open health panel</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle>Performance Pulse</CardTitle>
              {canViewHealth ? (
                <Badge variant="secondary">Live</Badge>
              ) : (
                <Badge variant="outline">Restricted</Badge>
              )}
            </div>
            <CardDescription>API latency, errors, and throughput.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!canViewHealth || !performanceSummary ? (
              <div className="rounded-lg border border-dashed p-4 text-muted-foreground">
                Performance metrics require view_health permission.
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Requests / min</div>
                    <div className="text-lg font-semibold">
                      {formatNumber(performanceSummary.rpm)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">P95 latency</div>
                    <div className="text-lg font-semibold">
                      {formatDuration(performanceSummary.p95)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Error rate</div>
                    <div className="text-lg font-semibold">
                      {formatPercent(performanceSummary.errorRate, { alreadyRatio: true })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Errors / min</div>
                    <div className="text-lg font-semibold">
                      {formatNumber(performanceSummary.errorPerMinute)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>CPU usage</span>
                    <span>{formatPercent(performanceSummary.cpu)}</span>
                  </div>
                  <Progress value={performanceSummary.cpu} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>In-flight requests</span>
                  <span>{formatNumber(performanceSummary.inFlight)}</span>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/monitoring">Open monitoring</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest transactions that need oversight.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/orders">View orders</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!canViewOrders ? (
              <div className="rounded-lg border border-dashed p-4 text-muted-foreground">
                You do not have permission to view orders.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transactions?.transactions ?? []).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.id}</TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {order.customer?.name ?? "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {order.customer?.email ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase">
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatRupees(order.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(transactions?.transactions?.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No recent orders yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Top Shops</CardTitle>
              <CardDescription>Transaction volume by shop.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/shop-analytics">View analytics</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canViewOrders ? (
              <div className="rounded-lg border border-dashed p-4 text-muted-foreground">
                You do not have permission to view shop analytics.
              </div>
            ) : topShops.length === 0 ? (
              <div className="text-sm text-muted-foreground">No shop activity yet.</div>
            ) : (
              topShops.map((shop) => (
                <div key={shop.shopId} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{shop.shopName ?? "Unnamed shop"}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(shop.transactionCount)} orders
                    </span>
                  </div>
                  <Progress value={(shop.transactionCount / maxShopTransactions) * 100} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {canManageAdmins && (
        <section>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Admin Activity</CardTitle>
                <CardDescription>Latest admin actions and audit trail.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/admins">Manage admins</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditLogs ?? []).slice(0, 6).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{log.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.resource}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(auditLogs ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No audit events recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      {canViewHealth && (
        <section>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Error Logs</CardTitle>
                <CardDescription>Latest error-level events from the platform.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/monitoring">View logs</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(errorLogs?.logs ?? []).length === 0 && (
                <div className="text-muted-foreground">No error logs captured.</div>
              )}
              {(errorLogs?.logs ?? []).map((log, index) => (
                <div key={`${log.timestamp}-${index}`} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDateTime(log.timestamp)}</span>
                    <Badge variant="destructive" className="uppercase">
                      {log.level}
                    </Badge>
                  </div>
                  <div className="mt-2 font-medium">{log.message}</div>
                  <div className="text-xs text-muted-foreground">Category: {log.category}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
