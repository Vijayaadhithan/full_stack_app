import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/dashboard-stats"],
    queryFn: () => apiRequest("GET", "/api/admin/dashboard-stats").then((r) => r.json()),
  });
  const { data: health } = useQuery({
    queryKey: ["/api/admin/health-status"],
    queryFn: () => apiRequest("GET", "/api/admin/health-status").then((r) => r.json()),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <pre>{JSON.stringify(stats, null, 2)}</pre>
      <h2 className="text-xl font-bold">System Health</h2>
      <pre>{JSON.stringify(health, null, 2)}</pre>
    </div>
  );
}
