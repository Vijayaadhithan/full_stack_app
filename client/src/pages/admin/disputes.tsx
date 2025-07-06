import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Booking } from "@shared/schema";

export default function AdminDisputes() {
  const { data } = useQuery<Booking[]>({ queryKey: ["/api/admin/disputes"], queryFn: () => apiRequest("GET", "/api/admin/disputes").then(r=>r.json()) });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id:number; status:'completed'|'cancelled' }) => apiRequest('PATCH', `/api/admin/bookings/${id}/resolve`, { resolutionStatus: status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/disputes"] })
  });

  return (
    <DashboardLayout>
      <h1 className="text-2xl mb-4">Disputed Bookings</h1>
      <div className="space-y-4">
        {data?.map(b => (
          <Card key={b.id} className="p-4">
            <CardContent>
              <p>Booking #{b.id} - {b.disputeReason}</p>
              <div className="mt-2 space-x-2">
                <Button onClick={() => resolveMutation.mutate({ id: b.id, status: 'completed' })}>Mark as Completed</Button>
                <Button variant="destructive" onClick={() => resolveMutation.mutate({ id: b.id, status: 'cancelled' })}>Mark as Cancelled</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}