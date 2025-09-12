import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  roleId: z.string().uuid(),
});

type FormData = z.infer<typeof schema>;

export default function AdminAccountManagement() {
  const { data: admins } = useQuery({
    queryKey: ["/api/admin/accounts"],
    queryFn: () => apiRequest("GET", "/api/admin/accounts").then((r) => r.json()),
  });
  const { data: roles } = useQuery({
    queryKey: ["/api/admin/roles"],
    queryFn: () => apiRequest("GET", "/api/admin/roles").then((r) => r.json()),
  });

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest("POST", "/api/admin/accounts", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      form.reset();
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Admin Accounts</h1>
      <form
        onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
        className="space-y-2"
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" {...form.register("email")} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...form.register("password")} />
        </div>
        <div>
          <Label htmlFor="roleId">Role</Label>
          <select
            id="roleId"
            {...form.register("roleId")}
            className="border p-2 rounded w-full"
          >
            <option value="">Select role</option>
            {roles?.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          Create
        </Button>
      </form>
      <ul className="space-y-1">
        {admins?.map((a: any) => (
          <li key={a.id}>
            {a.email} - {a.roleId}
          </li>
        ))}
      </ul>
    </div>
  );
}
