import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function AdminHealth() {
  const { data } = useQuery({
    queryKey: ["/api/admin/health-status"],
    queryFn: () => apiRequest("GET", "/api/admin/health-status").then((r) => r.json()),
  });
  return (
    <div>
      <h1 className="text-2xl mb-4">System Health</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
