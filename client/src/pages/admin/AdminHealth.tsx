import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "./admin-utils";

type HealthStatus = {
  database: string;
  api: string;
  jobs: {
    bookingExpiration: string | null;
    paymentReminder: string | null;
  };
};

export default function AdminHealth() {
  const { admin } = useAdmin();
  const permissions = new Set(admin?.permissions || []);
  const canViewHealth = permissions.has("view_health");

  const { data, isFetching, refetch } = useQuery<HealthStatus>({
    queryKey: ["/api/admin/health-status"],
    queryFn: () => apiRequest("GET", "/api/admin/health-status").then((r) => r.json()),
    enabled: canViewHealth,
  });

  if (!canViewHealth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You do not have permission to view system health.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">System Health</h2>
        <p className="text-sm text-muted-foreground">
          Validate database connectivity, API readiness, and job scheduler uptime.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Database</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Connectivity</span>
            <Badge variant={data?.database === "ok" ? "secondary" : "destructive"}>
              {data?.database ?? "checking"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">API</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Gateway</span>
            <Badge variant={data?.api === "ok" ? "secondary" : "destructive"}>
              {data?.api ?? "checking"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Booking expiry</span>
              <span className="text-muted-foreground">
                {formatDateTime(data?.jobs?.bookingExpiration ?? null)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Payment reminders</span>
              <span className="text-muted-foreground">
                {formatDateTime(data?.jobs?.paymentReminder ?? null)}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Health payload</CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-4 text-xs text-muted-foreground">
              {data ? JSON.stringify(data, null, 2) : "No health data yet."}
            </pre>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
