import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function AdminOrders() {
  const { data } = useQuery({
    queryKey: ["/api/admin/all-orders"],
    queryFn: () => apiRequest("GET", "/api/admin/all-orders").then((r) => r.json()),
  });
  return (
    <div>
      <h1 className="text-2xl mb-4">All Orders</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
