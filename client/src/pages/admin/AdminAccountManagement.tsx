import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/hooks/use-admin";
import { formatDateTime, formatNumber } from "./admin-utils";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  roleId: z.string().uuid(),
});

type FormData = z.infer<typeof schema>;

type AdminAccount = {
  id: string;
  email: string;
  roleId: string | null;
  createdAt: string;
};

type AdminRole = {
  id: string;
  name: string;
  description?: string | null;
};

type AuditLog = {
  id: number;
  adminId: string;
  action: string;
  resource: string;
  createdAt: string;
};

export default function AdminAccountManagement() {
  const { admin } = useAdmin();
  const permissions = new Set(admin?.permissions || []);
  const canManageAdmins = permissions.has("manage_admins");

  const { data: admins } = useQuery<AdminAccount[]>({
    queryKey: ["/api/admin/accounts"],
    queryFn: () => apiRequest("GET", "/api/admin/accounts").then((r) => r.json()),
    enabled: canManageAdmins,
  });
  const { data: roles } = useQuery<AdminRole[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: () => apiRequest("GET", "/api/admin/roles").then((r) => r.json()),
    enabled: canManageAdmins,
  });
  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    queryFn: () => apiRequest("GET", "/api/admin/audit-logs").then((r) => r.json()),
    enabled: canManageAdmins,
  });

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const roleById = useMemo(() => {
    const map = new Map<string, AdminRole>();
    roles?.forEach((role) => map.set(role.id, role));
    return map;
  }, [roles]);

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest("POST", "/api/admin/accounts", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      form.reset();
    },
  });

  if (!canManageAdmins) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin Accounts</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You do not have permission to manage admins.
        </CardContent>
      </Card>
    );
  }

  const adminCount = admins?.length ?? 0;
  const roleCount = roles?.length ?? 0;
  const auditCount = auditLogs?.length ?? 0;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Admin Security</h2>
        <p className="text-sm text-muted-foreground">
          Create admin accounts, assign roles, and audit privileged actions.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Admins</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(adminCount)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Roles</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(roleCount)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Audit entries</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatNumber(auditCount)}
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <div className="grid gap-6 lg:grid-cols-[1fr,2fr]">
            <Card>
              <CardHeader>
                <CardTitle>Create admin</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
                  className="space-y-3"
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
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    >
                      <option value="">Select role</option>
                      {roles?.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create admin"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Admin accounts</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(admins ?? []).map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {account.roleId ? roleById.get(account.roleId)?.name ?? "Assigned" : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(account.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {adminCount === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                          No admins found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Roles catalog</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(roles ?? []).map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {role.description ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{role.id}</TableCell>
                    </TableRow>
                  ))}
                  {roleCount === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                        No roles configured.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit logs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Admin ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditLogs ?? []).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{log.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.resource}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.adminId}</TableCell>
                    </TableRow>
                  ))}
                  {auditCount === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        No audit events recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
