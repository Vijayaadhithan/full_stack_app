import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
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
  formatRupees,
  getInitials,
  toNumber,
} from "./admin-utils";

type PlatformUser = {
  id: number;
  name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  isSuspended: boolean;
  isPhoneVerified?: boolean | null;
  emailVerified?: boolean | null;
  verificationStatus?: string | null;
  profileCompleteness?: number | null;
  averageRating?: string | number | null;
  totalReviews?: number | null;
  createdAt?: string | null;
};

type Order = {
  id: number;
  customerId: number | null;
  shopId: number | null;
  total: string;
  paymentStatus: string | null;
  orderDate: string | null;
};

type DashboardStats = {
  totalUsers: number;
};

const ROLE_OPTIONS = ["all", "customer", "provider", "shop", "worker", "admin"];
const STATUS_OPTIONS = ["all", "active", "suspended"];
const VERIFICATION_OPTIONS = ["all", "verified", "pending", "unverified"];

export default function AdminPlatformUserManagement() {
  const { admin } = useAdmin();
  const permissions = new Set(admin?.permissions || []);
  const canManageUsers = permissions.has("manage_users");
  const canViewOrders = permissions.has("view_all_orders");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [includeOrderInsights, setIncludeOrderInsights] = useState(true);

  const { data: users } = useQuery<PlatformUser[]>({
    queryKey: ["/api/admin/platform-users", { page, limit, search }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      const trimmed = search.trim();
      if (trimmed.length > 0) params.set("search", trimmed);
      const qs = params.toString();
      return apiRequest("GET", `/api/admin/platform-users?${qs}`).then((r) => r.json());
    },
    enabled: canManageUsers,
  });

  const { data: orders } = useQuery<Order[]>({
    queryKey: ["/api/admin/all-orders"],
    queryFn: () => apiRequest("GET", "/api/admin/all-orders").then((r) => r.json()),
    enabled: canViewOrders && includeOrderInsights,
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard-stats"],
    queryFn: () => apiRequest("GET", "/api/admin/dashboard-stats").then((r) => r.json()),
  });

  const usersCount = (users ?? []).length;
  const hasNextPage = usersCount >= limit;

  const filteredUsers = useMemo(() => {
    return (users ?? []).filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (statusFilter === "active" && user.isSuspended) return false;
      if (statusFilter === "suspended" && !user.isSuspended) return false;
      if (verificationFilter !== "all") {
        const status = user.verificationStatus ?? "unverified";
        if (status !== verificationFilter) return false;
      }
      return true;
    });
  }, [roleFilter, statusFilter, users, verificationFilter]);

  const orderInsights = useMemo(() => {
    const customerStats = new Map<number, { count: number; paidTotal: number; lastOrder: string | null }>();
    const shopStats = new Map<number, { count: number; paidTotal: number; lastOrder: string | null }>();

    (orders ?? []).forEach((order) => {
      const total = toNumber(order.total);
      const isPaid = order.paymentStatus === "paid";
      if (order.customerId) {
        const current = customerStats.get(order.customerId) ?? {
          count: 0,
          paidTotal: 0,
          lastOrder: null,
        };
        current.count += 1;
        if (isPaid) current.paidTotal += total;
        if (order.orderDate && (!current.lastOrder || order.orderDate > current.lastOrder)) {
          current.lastOrder = order.orderDate;
        }
        customerStats.set(order.customerId, current);
      }
      if (order.shopId) {
        const current = shopStats.get(order.shopId) ?? {
          count: 0,
          paidTotal: 0,
          lastOrder: null,
        };
        current.count += 1;
        if (isPaid) current.paidTotal += total;
        if (order.orderDate && (!current.lastOrder || order.orderDate > current.lastOrder)) {
          current.lastOrder = order.orderDate;
        }
        shopStats.set(order.shopId, current);
      }
    });

    return { customerStats, shopStats };
  }, [orders]);

  const suspendMutation = useMutation({
    mutationFn: ({ id, isSuspended }: { id: number; isSuspended: boolean }) =>
      apiRequest("PATCH", `/api/admin/platform-users/${id}/suspend`, { isSuspended }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-users"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/platform-users/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-users"] }),
  });

  if (!canManageUsers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Platform Users</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You do not have permission to manage users.
        </CardContent>
      </Card>
    );
  }

  const suspendedCount = filteredUsers.filter((user) => user.isSuspended).length;
  const verifiedCount = filteredUsers.filter(
    (user) => (user.verificationStatus ?? "unverified") === "verified",
  ).length;
  const avgProfileCompleteness =
    filteredUsers.reduce((sum, user) => sum + (user.profileCompleteness ?? 0), 0) /
    Math.max(filteredUsers.length, 1);

  const showOrderInsights = includeOrderInsights && canViewOrders;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Platform Users</h2>
        <p className="text-sm text-muted-foreground">
          Manage identities, review engagement signals, and enforce platform safety.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total users</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(stats?.totalUsers ?? 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Loaded users</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(filteredUsers.length)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Suspended</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(suspendedCount)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Verified profiles</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(verifiedCount)}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>User filters</CardTitle>
              <div className="text-sm text-muted-foreground">
                Search by name, username, email, or phone.
              </div>
            </div>
            {canViewOrders && (
              <div className="flex items-center gap-2 text-sm">
                <Switch
                  checked={includeOrderInsights}
                  onCheckedChange={setIncludeOrderInsights}
                />
                <span>Order insights</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setPage(1);
              }}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role === "all" ? "All roles" : role}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All statuses" : option}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={verificationFilter}
              onChange={(event) => {
                setVerificationFilter(event.target.value);
                setPage(1);
              }}
            >
              {VERIFICATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All verification states" : option}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
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
            <CardTitle>Profile completeness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Average completeness</span>
              <span>{Math.round(avgProfileCompleteness)}%</span>
            </div>
            <Progress value={avgProfileCompleteness} />
            <div className="text-xs text-muted-foreground">
              Encourage users to add missing details for higher trust scores.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Showing {formatNumber(filteredUsers.length)} users on page {page}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!hasNextPage}
              onClick={() => setPage((p) => p + 1)}
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
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
                {filteredUsers.map((user) => {
                  const customerStats = orderInsights.customerStats.get(user.id);
                  const shopStats = orderInsights.shopStats.get(user.id);
                  const orderCount = customerStats?.count ?? shopStats?.count ?? 0;
                  const paidTotal = customerStats?.paidTotal ?? shopStats?.paidTotal ?? 0;
                  const lastOrder = customerStats?.lastOrder ?? shopStats?.lastOrder ?? null;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {user.email ?? user.phone ?? user.username ?? "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Joined {formatDateTime(user.createdAt)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase">
                          {user.role ?? "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <Badge
                            variant={user.verificationStatus === "verified" ? "secondary" : "outline"}
                            className="uppercase"
                          >
                            {user.verificationStatus ?? "unverified"}
                          </Badge>
                          <div className="text-muted-foreground">
                            Phone {user.isPhoneVerified ? "verified" : "unverified"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={user.profileCompleteness ?? 0} />
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(user.profileCompleteness ?? 0)}% complete
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {showOrderInsights ? (
                          <div className="space-y-1 text-sm">
                            <div className="font-semibold">{formatNumber(orderCount)}</div>
                            <div className="text-xs text-muted-foreground">
                              {lastOrder ? `Last: ${formatDateTime(lastOrder)}` : "No orders"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Insights off</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {showOrderInsights ? formatRupees(paidTotal) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isSuspended ? "destructive" : "secondary"}>
                          {user.isSuspended ? "Suspended" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              suspendMutation.mutate({
                                id: user.id,
                                isSuspended: !user.isSuspended,
                              })
                            }
                            disabled={suspendMutation.isPending}
                          >
                            {user.isSuspended ? "Unsuspend" : "Suspend"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={removeMutation.isPending}
                            onClick={() => {
                              const confirmed = window.confirm(
                                "This will permanently remove the user and all related data. Continue?",
                              );
                              if (confirmed) {
                                removeMutation.mutate(user.id);
                              }
                            }}
                          >
                            Remove
                          </Button>
                        </div>
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
