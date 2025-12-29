import React, { useMemo, useState } from 'react';
import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, Shield, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Worker = {
  id: number;
  workerNumber: string;
  name: string;
  email: string;
  phone: string;
  responsibilities: string[];
  active: boolean;
  createdAt: string;
};

type RespResponse = {
  all: string[];
  presets: Record<string, string[]>;
};

const RESPONSIBILITY_HINTS: Record<string, string> = {
  "products:read": "View product list and details",
  "products:write": "Create and edit products",
  "inventory:adjust": "Adjust stock counts",
  "orders:read": "View orders and details",
  "orders:update": "Update order status and confirm payments",
  "returns:manage": "Approve and manage returns",
  "promotions:manage": "Create and manage promotions",
  "customers:message": "Send messages to customers",
  "bookings:manage": "Manage service bookings",
  "analytics:view": "View shop dashboard and analytics",
};

export default function ShopWorkers() {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    workerNumber: "",
    name: "",
    email: "",
    phone: "",
    pin: "",
    responsibilities: [] as string[],
    preset: "",
  });

  const { data: respData } = useQuery<RespResponse>({
    queryKey: ["/api/shops/workers/responsibilities"],
    queryFn: () => apiRequest("GET", "/api/shops/workers/responsibilities").then(r => r.json()),
  });

  // Inline availability check for Worker Number (10 digits)
  const workerNumberInput = createForm.workerNumber.replace(/\D/g, "");
  const { data: workerNumberCheck, isFetching: checkingWorkerNumber } = useQuery<{ workerNumber: string; available: boolean } | null>({
    queryKey: ["/api/shops/workers/check-number", workerNumberInput],
    enabled: workerNumberInput.length === 10,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/shops/workers/check-number?workerNumber=${encodeURIComponent(workerNumberInput)}`);
      if (!res.ok) return null;
      return res.json();
    },
  });
  const workerNumberAvailable = workerNumberInput.length !== 10 ? undefined : workerNumberCheck?.available;

  const { data: workers, isLoading } = useQuery<Worker[]>({
    queryKey: ["/api/shops/workers"],
    queryFn: () => apiRequest("GET", "/api/shops/workers").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        workerNumber: workerNumberInput,
        name: createForm.name,
        email: createForm.email || undefined,
        phone: createForm.phone || undefined,
        pin: createForm.pin,
        responsibilities: createForm.responsibilities,
      };
      const res = await apiRequest("POST", "/api/shops/workers", body);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create worker");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shops/workers"] });
      setCreating(false);
      setCreateForm({ workerNumber: "", name: "", email: "", phone: "", pin: "", responsibilities: [], preset: "" });
      toast({ title: "Worker created", description: "The worker can now log in with their 10-digit number and 4-digit PIN." });
    },
    onError: async (err: any) => {
      toast({ title: "Failed to create worker", description: err?.message || "Please check inputs and try again.", variant: "destructive" });
    }
  });

  const toggleActive = useMutation({
    mutationFn: async ({ workerUserId, active }: { workerUserId: number; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/shops/workers/${workerUserId}`, { active });
      if (!res.ok) throw new Error("Failed to update worker");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/shops/workers"] }),
    onError: () => toast({ title: "Failed to update worker", variant: "destructive" }),
  });

  const updateResponsibilities = useMutation({
    mutationFn: async ({ workerUserId, responsibilities }: { workerUserId: number; responsibilities: string[] }) => {
      const res = await apiRequest("PATCH", `/api/shops/workers/${workerUserId}`, { responsibilities });
      if (!res.ok) throw new Error("Failed to update responsibilities");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/shops/workers"] }),
    onError: () => toast({ title: "Failed to update responsibilities", variant: "destructive" }),
  });

  const updateProfile = useMutation({
    mutationFn: async ({ workerUserId, name, email, phone }: { workerUserId: number; name?: string; email?: string; phone?: string }) => {
      const res = await apiRequest("PATCH", `/api/shops/workers/${workerUserId}`, { name, email, phone });
      if (!res.ok) throw new Error("Failed to update worker profile");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/shops/workers"] }),
    onError: () => toast({ title: "Failed to update worker", variant: "destructive" }),
  });

  const resetPin = useMutation({
    mutationFn: async ({ workerUserId, pin }: { workerUserId: number; pin: string }) => {
      const res = await apiRequest("PATCH", `/api/shops/workers/${workerUserId}`, { pin });
      if (!res.ok) throw new Error("Failed to set PIN");
    },
    onSuccess: () => toast({ title: "PIN reset", description: "The new PIN is set." }),
    onError: () => toast({ title: "Failed to reset PIN", variant: "destructive" })
  });

  const deleteWorker = useMutation({
    mutationFn: async (workerUserId: number) => {
      const res = await apiRequest("DELETE", `/api/shops/workers/${workerUserId}`);
      if (!res.ok) throw new Error("Failed to delete worker");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shops/workers"] });
      toast({ title: "Worker removed" });
    },
    onError: () => toast({ title: "Failed to delete worker", variant: "destructive" }),
  });

  const presetKeys = useMemo(() => Object.keys(respData?.presets || {}), [respData]);

  const applyPreset = (key: string) => {
    const list = respData?.presets?.[key] || [];
    setCreateForm((f) => ({ ...f, preset: key, responsibilities: list }));
  };

  return (
    <ShopLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5" /> Workers
          </h1>
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" /> Add Worker
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-w-[95vw] w-[95vw] max-h-[88vh] md:max-h-[85vh] overflow-y-auto p-4">
              <DialogHeader>
                <DialogTitle>Create Worker</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">10-Digit Worker Number</Label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={createForm.workerNumber}
                    onChange={(e) => setCreateForm({ ...createForm, workerNumber: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                    placeholder="e.g., 9876543210"
                    maxLength={10}
                    className="font-mono tracking-wider"
                  />
                  <p className="text-xs text-muted-foreground">{workerNumberInput.length}/10 digits</p>
                  {workerNumberInput.length === 10 && (
                    <div className="flex items-center gap-2 text-xs mt-1 min-h-[1rem]">
                      {checkingWorkerNumber ? (
                        <span className="text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking…</span>
                      ) : workerNumberAvailable === true ? (
                        <span className="text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Available</span>
                      ) : workerNumberAvailable === false ? (
                        <span className="text-red-600 flex items-center gap-1"><X className="h-3 w-3" /> Already taken</span>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Full Name</Label>
                  <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Email (optional)</Label>
                  <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Phone (optional)</Label>
                  <Input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm">4-Digit PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={createForm.pin}
                    onChange={(e) => setCreateForm({ ...createForm, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    placeholder="••••"
                    maxLength={4}
                    className="font-mono tracking-[0.5em] text-center w-32"
                  />
                  <p className="text-xs text-muted-foreground">{createForm.pin.length}/4 digits</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm">Preset</Label>
                  <Select value={createForm.preset} onValueChange={applyPreset}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a preset (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {presetKeys.map((k) => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Responsibilities</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    {(respData?.all || []).map((r) => {
                      const selected = createForm.responsibilities.includes(r);
                      return (
                        <label key={r} className={`flex items-start gap-2 p-3 rounded-md border ${selected ? 'border-primary' : 'border-border'}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setCreateForm((f) => ({
                                ...f,
                                responsibilities: checked
                                  ? Array.from(new Set([...(f.responsibilities || []), r]))
                                  : (f.responsibilities || []).filter((x) => x !== r),
                              }));
                            }}
                          />
                          <div>
                            <div className="font-medium">{r}</div>
                            <div className="text-xs text-muted-foreground">{RESPONSIBILITY_HINTS[r]}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="md:col-span-2 flex justify-end sticky bottom-0 bg-background pt-2">
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={
                      createMutation.isPending ||
                      workerNumberInput.length !== 10 ||
                      workerNumberAvailable === false ||
                      !createForm.name ||
                      createForm.pin.length !== 4
                    }
                  >
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Worker'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
            ) : (
              <div className="space-y-4">
                {(workers || []).map((w) => (
                  <WorkerRow
                    key={w.id}
                    worker={w}
                    onToggleActive={(active) => toggleActive.mutate({ workerUserId: w.id, active })}
                    onSaveResponsibilities={(list) => updateResponsibilities.mutate({ workerUserId: w.id, responsibilities: list })}
                    onSaveProfile={(profile) => updateProfile.mutate({ workerUserId: w.id, ...profile })}
                    onResetPin={(pin) => resetPin.mutate({ workerUserId: w.id, pin })}
                    onDelete={() => deleteWorker.mutate(w.id)}
                    all={respData?.all || []}
                  />
                ))}
                {workers && workers.length === 0 && <div className="text-sm text-muted-foreground">No workers yet. Create your first team member.</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ShopLayout>
  );
}

function WorkerRow({ worker, all, onToggleActive, onSaveResponsibilities, onSaveProfile, onResetPin, onDelete }: {
  worker: Worker;
  all: string[];
  onToggleActive: (active: boolean) => void;
  onSaveResponsibilities: (list: string[]) => void;
  onSaveProfile: (profile: { name?: string; email?: string; phone?: string }) => void;
  onResetPin: (pin: string) => void;
  onDelete: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [resp, setResp] = useState<string[]>(worker.responsibilities || []);
  const [name, setName] = useState(worker.name);
  const [email, setEmail] = useState(worker.email);
  const [phone, setPhone] = useState(worker.phone);
  const [newPin, setNewPin] = useState("");

  return (
    <div className="border rounded p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Worker Number</div>
          <div className="font-mono text-lg tracking-wider">{worker.workerNumber || '-'}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Name</div>
          <div>{worker.name}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Email</div>
          <div>{worker.email || '-'}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Phone</div>
          <div>{worker.phone || '-'}</div>
        </div>
        <div className="space-y-1 flex items-center gap-2">
          <div className="text-sm text-muted-foreground">Active</div>
          <Switch checked={worker.active} onCheckedChange={onToggleActive} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(worker.responsibilities || []).map((r) => (
          <Badge key={r} variant="secondary">{r}</Badge>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Edit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Worker</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              <div className="md:col-span-2">
                <Label>Responsibilities</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  {all.map((r) => {
                    const selected = resp.includes(r);
                    return (
                      <label key={r} className={`flex items-start gap-2 p-2 rounded border ${selected ? 'border-primary' : 'border-border'}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setResp((list) => checked ? Array.from(new Set([...list, r])) : list.filter((x) => x !== r));
                          }}
                        />
                        <div>
                          <div className="font-medium">{r}</div>
                          <div className="text-xs text-muted-foreground">{RESPONSIBILITY_HINTS[r]}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Reset PIN</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="New 4-digit PIN"
                    maxLength={4}
                    className="font-mono tracking-[0.5em] text-center w-32"
                  />
                  <Button variant="secondary" disabled={newPin.length !== 4} onClick={() => { if (newPin.length === 4) onResetPin(newPin); setNewPin(""); }}>Set PIN</Button>
                </div>
              </div>

              <div className="md:col-span-2 flex gap-2">
                <Button onClick={() => { onSaveProfile({ name, email, phone }); onSaveResponsibilities(resp); setEditOpen(false); }}>Save</Button>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove worker?</AlertDialogTitle>
              <AlertDialogDescription>
                This will revoke access for this worker and delete their account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
