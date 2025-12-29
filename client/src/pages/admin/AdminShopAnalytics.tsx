import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdmin } from "@/hooks/use-admin";
import { Badge } from "@/components/ui/badge";
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
import { formatDateTime, formatNumber, formatRupees, toNumber } from "./admin-utils";

type ShopTransactionStat = {
  shopId: number;
  shopName: string | null;
  transactionCount: number;
};

type Order = {
  shopId: number | null;
  total: string;
  paymentStatus: string | null;
  orderDate: string | null;
};

export default function AdminShopAnalytics() {
  const { admin } = useAdmin();
  const permissions = new Set(admin?.permissions || []);
  const canViewOrders = permissions.has("view_all_orders");

  const { data: shopStats } = useQuery<ShopTransactionStat[]>({
    queryKey: ["/api/admin/shops/transactions"],
    queryFn: () => apiRequest("GET", "/api/admin/shops/transactions").then((res) => res.json()),
    enabled: canViewOrders,
  });

  const { data: orders } = useQuery<Order[]>({
    queryKey: ["/api/admin/all-orders"],
    queryFn: () => apiRequest("GET", "/api/admin/all-orders").then((r) => r.json()),
    enabled: canViewOrders,
  });

  const shopRevenue = useMemo(() => {
    const map = new Map<number, { paidTotal: number; paidCount: number; lastOrder: string | null }>();
    (orders ?? []).forEach((order) => {
      if (!order.shopId) return;
      const current = map.get(order.shopId) ?? {
        paidTotal: 0,
        paidCount: 0,
        lastOrder: null,
      };
      if (order.paymentStatus === "paid") {
        current.paidTotal += toNumber(order.total);
        current.paidCount += 1;
      }
      if (order.orderDate && (!current.lastOrder || order.orderDate > current.lastOrder)) {
        current.lastOrder = order.orderDate;
      }
      map.set(order.shopId, current);
    });
    return map;
  }, [orders]);

  if (!canViewOrders) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shop Analytics</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You do not have permission to view shop analytics.
        </CardContent>
      </Card>
    );
  }

  const rows =
    shopStats?.map((shop) => {
      const revenue = shopRevenue.get(shop.shopId);
      return {
        ...shop,
        paidTotal: revenue?.paidTotal ?? 0,
        paidCount: revenue?.paidCount ?? 0,
        lastOrder: revenue?.lastOrder ?? null,
      };
    }) ?? [];

  const totalRevenue = rows.reduce((sum, row) => sum + row.paidTotal, 0);
  const totalPaidOrders = rows.reduce((sum, row) => sum + row.paidCount, 0);
  const avgRevenue = totalRevenue / Math.max(rows.length, 1);
  const maxTransactions = Math.max(1, ...rows.map((row) => row.transactionCount));
  const singleShop = rows.length === 1 ? rows[0] : null;
  const singleShopAvgOrder = singleShop
    ? singleShop.paidTotal / Math.max(singleShop.paidCount, 1)
    : 0;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Shop Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Compare shop performance, revenue, and order volume at a glance.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active shops</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(rows.length)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Paid orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(totalPaidOrders)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Paid revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatRupees(totalRevenue, { compact: true })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avg revenue/shop</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatRupees(avgRevenue, { compact: true })}
          </CardContent>
        </Card>
      </section>

      {singleShop && (
        <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Single shop overview</CardTitle>
              <Badge variant="secondary">Only shop profile</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Shop</div>
                <div className="text-lg font-semibold">{singleShop.shopName ?? "Unnamed shop"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Last order</div>
                <div className="text-sm">{formatDateTime(singleShop.lastOrder)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Transactions</div>
                <div className="text-lg font-semibold">{formatNumber(singleShop.transactionCount)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Paid orders</div>
                <div className="text-lg font-semibold">{formatNumber(singleShop.paidCount)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Paid revenue</div>
                <div className="text-lg font-semibold">{formatRupees(singleShop.paidTotal)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Avg order value</div>
                <div className="text-lg font-semibold">{formatRupees(singleShopAvgOrder)}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue concentration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Revenue share</span>
                  <span>
                    {totalRevenue
                      ? `${Math.round((singleShop.paidTotal / totalRevenue) * 100)}%`
                      : "—"}
                  </span>
                </div>
                <Progress
                  value={totalRevenue ? (singleShop.paidTotal / totalRevenue) * 100 : 0}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Paid order share</span>
                  <span>
                    {totalPaidOrders
                      ? `${Math.round((singleShop.paidCount / totalPaidOrders) * 100)}%`
                      : "—"}
                  </span>
                </div>
                <Progress
                  value={totalPaidOrders ? (singleShop.paidCount / totalPaidOrders) * 100 : 0}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Add more shop profiles to compare performance distribution.
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Paid revenue</TableHead>
                  <TableHead>Paid orders</TableHead>
                  <TableHead>Last order</TableHead>
                  <TableHead>Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No transactions recorded yet.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((shop) => (
                  <TableRow key={shop.shopId}>
                    <TableCell className="font-medium">
                      {shop.shopName ?? "Unnamed shop"}
                    </TableCell>
                    <TableCell>{formatNumber(shop.transactionCount)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatRupees(shop.paidTotal)}
                    </TableCell>
                    <TableCell>{formatNumber(shop.paidCount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(shop.lastOrder)}
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <Progress value={(shop.transactionCount / maxTransactions) * 100} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
