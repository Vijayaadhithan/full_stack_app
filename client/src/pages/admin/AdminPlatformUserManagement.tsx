import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminPlatformUserManagement() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");

  const { data: users } = useQuery({
    queryKey: ["/api/admin/platform-users", { page, limit, search }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      const trimmed = search.trim();
      if (trimmed.length > 0) params.set("search", trimmed);
      const qs = params.toString();
      return apiRequest("GET", `/api/admin/platform-users?${qs}`).then((r) => r.json());
    },
  });

  const usersCount = (users ?? []).length;
  const hasNextPage = usersCount >= limit;

  const suspendMutation = useMutation({
    mutationFn: ({ id, isSuspended }: { id: number; isSuspended: boolean }) =>
      apiRequest("PATCH", `/api/admin/platform-users/${id}/suspend`, { isSuspended }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-users"] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl">Platform Users</h1>
        <div className="text-sm text-muted-foreground">{usersCount} {usersCount === 1 ? "user" : "users"}</div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <Input
          placeholder="Search username, email, name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <select
          className="border p-2 rounded"
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>
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
          {usersCount === 0 && (
            <tr>
              <td className="p-4 text-center text-muted-foreground" colSpan={4}>
                No users found
              </td>
            </tr>
          )}
          {(users ?? []).map((u: any) => (
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
      <div className="flex items-center gap-2 mt-4">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </Button>
        <span>Page {page}</span>
        <Button
          variant="outline"
          disabled={!hasNextPage}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
