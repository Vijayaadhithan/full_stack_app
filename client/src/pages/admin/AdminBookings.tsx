import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function AdminBookings() {
  const { data } = useQuery({
    queryKey: ["/api/admin/all-bookings"],
    queryFn: () => apiRequest("GET", "/api/admin/all-bookings").then((r) => r.json()),
  });
  return (
    <div>
      <h1 className="text-2xl mb-4">All Bookings</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
