import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

export default function AdminPlatformUserManagement() {
  const { data: users } = useQuery({
    queryKey: ["/api/admin/platform-users"],
    queryFn: () => apiRequest("GET", "/api/admin/platform-users").then((r) => r.json()),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, isSuspended }: { id: number; isSuspended: boolean }) =>
      apiRequest("PATCH", `/api/admin/platform-users/${id}/suspend`, { isSuspended }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-users"] }),
  });

  return (
    <div>
      <h1 className="text-2xl mb-4">Platform Users</h1>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Suspended</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u: any) => (
            <tr key={u.id} className="border-t">
              <td className="p-2">{u.id}</td>
              <td className="p-2">{u.username}</td>
              <td className="p-2">{String(u.isSuspended)}</td>
              <td className="p-2">
                <Button
                  onClick={() =>
                    suspendMutation.mutate({ id: u.id, isSuspended: !u.isSuspended })
                  }
                >
                  {u.isSuspended ? "Unsuspend" : "Suspend"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
