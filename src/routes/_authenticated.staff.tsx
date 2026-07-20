import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Ban, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCurrentStaff } from "@/lib/hooks/use-auth";
import { logAudit } from "@/lib/audit";
import {
  createStaff as createStaffFn,
  updateStaffRole as updateStaffRoleFn,
  setStaffDisabled as setStaffDisabledFn,
  resetStaffPassword as resetStaffPasswordFn,
  getSignupToken as getSignupTokenFn,
  setSignupToken as setSignupTokenFn,
} from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff — Summit Console" }] }),
  component: StaffPage,
});

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  registration_officer: "Registration Officer",
  checkin_officer: "Check-in Officer",
};

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters"),
  display_name: z.string().min(2).max(120),
  role: z.enum(["admin", "registration_officer", "checkin_officer"]),
});

function StaffPage() {
  const staff = useCurrentStaff();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newToken, setNewToken] = useState("");

  useEffect(() => {
    if (!staff.loading && !staff.isAdmin) {
      toast.error("Administrators only");
      navigate({ to: "/dashboard" });
    }
  }, [staff, navigate]);

  const list = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("staff_profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profiles.error) throw profiles.error;
      const roleMap = new Map<string, string>();
      (roles.data ?? []).forEach((r) => roleMap.set(r.user_id, r.role));
      return (profiles.data ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "—" }));
    },
  });

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: "", password: "", display_name: "", role: "registration_officer" },
  });

  const createStaff = useServerFn(createStaffFn);
  const updateStaffRole = useServerFn(updateStaffRoleFn);
  const setStaffDisabled = useServerFn(setStaffDisabledFn);
  const resetStaffPassword = useServerFn(resetStaffPasswordFn);
  const getSignupToken = useServerFn(getSignupTokenFn);
  const rotateSignupToken = useServerFn(setSignupTokenFn);

  const signupToken = useQuery({
    queryKey: ["signup-token"],
    queryFn: () => getSignupToken(),
    enabled: staff.isAdmin,
  });

  const onRotateToken = async () => {
    if (!/^\d{6}$/.test(newToken)) {
      toast.error("Code must be exactly 6 digits");
      return;
    }
    try {
      await rotateSignupToken({ data: { token: newToken } });
      await logAudit("settings.updated", { entity: "signup_settings", meta: { action: "signup_token_rotated" } });
      toast.success("Signup code updated");
      setNewToken("");
      qc.invalidateQueries({ queryKey: ["signup-token"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update code");
    }
  };

  const generateRandomToken = () => {
    setNewToken(String(Math.floor(100000 + Math.random() * 900000)));
  };

  const onCreate = async (v: z.infer<typeof createSchema>) => {
    try {
      await createStaff({ data: v });
      await logAudit("staff.created", { entity: "user", meta: { email: v.email, role: v.role } });
      toast.success("Staff member created");
      form.reset();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["staff-list"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create user");
    }
  };

  const changeRole = async (user_id: string, role: string) => {
    try {
      await updateStaffRole({ data: { user_id, role: role as never } });
      await logAudit("staff.role_changed", { entity: "user", entity_id: user_id, meta: { role } });
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["staff-list"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const toggleDisabled = async (user_id: string, disabled: boolean) => {
    try {
      await setStaffDisabled({ data: { user_id, disabled } });
      await logAudit("staff.disabled", { entity: "user", entity_id: user_id, meta: { disabled } });
      toast.success(disabled ? "Account disabled" : "Account enabled");
      qc.invalidateQueries({ queryKey: ["staff-list"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const sendReset = async (email: string) => {
    try {
      await resetStaffPassword({ data: { email, redirect_to: `${window.location.origin}/reset-password` } });
      await logAudit("staff.password_reset", { meta: { email } });
      toast.success("Password reset sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Staff</div>
          <h1 className="mt-1 text-3xl font-bold">Coordinator management</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Add staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add staff member</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-sm">Display name</Label>
                <Input {...form.register("display_name")} />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Email</Label>
                <Input type="email" {...form.register("email")} />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Temporary password</Label>
                <Input type="text" {...form.register("password")} />
                {form.formState.errors.password && (
                  <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Role</Label>
                <Select
                  defaultValue="registration_officer"
                  onValueChange={(v) => form.setValue("role", v as never)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="registration_officer">Registration Officer</SelectItem>
                    <SelectItem value="checkin_officer">Check-in Officer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create staff
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Self-signup</div>
            <h2 className="mt-1 text-lg font-bold">Signup code</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {signupToken.isLoading
                ? "Loading…"
                : signupToken.data?.token
                  ? "Share this code with new staff — they'll need it to create their own account at /auth."
                  : "Not set — self-signup is disabled until you set a code."}
            </p>
            {signupToken.data?.token && (
              <div className="mt-2 font-mono text-3xl font-black tracking-[0.3em] text-primary">
                {signupToken.data.token}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="mb-1.5 block text-sm">New code</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                className="w-32"
                placeholder="123456"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <Button type="button" variant="outline" onClick={generateRandomToken}>
              Generate
            </Button>
            <Button
              type="button"
              onClick={onRotateToken}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save code
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <tr><td colSpan={5} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>
              ) : (list.data ?? []).length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No staff yet.</td></tr>
              ) : (
                (list.data ?? []).map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{s.display_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                    <td className="px-4 py-3">
                      <Select defaultValue={s.role} onValueChange={(v) => changeRole(s.id, v)}>
                        <SelectTrigger className="h-8 w-[190px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="registration_officer">Registration Officer</SelectItem>
                          <SelectItem value="checkin_officer">Check-in Officer</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      {s.disabled ? (
                        <Badge variant="destructive">Disabled</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-success/15 text-success">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => sendReset(s.email)}>
                          <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Reset
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDisabled(s.id, !s.disabled)}
                          className={s.disabled ? "text-success" : "text-destructive"}
                        >
                          {s.disabled ? <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> : <Ban className="mr-1.5 h-3.5 w-3.5" />}
                          {s.disabled ? "Enable" : "Disable"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Roles: {Object.values(roleLabels).join(" · ")}
      </p>
    </div>
  );
}
