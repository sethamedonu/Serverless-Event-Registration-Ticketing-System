import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, KeyRound, Ban, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCurrentStaff } from "@/lib/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff — Summit Console" }] }),
  component: StaffPage,
});

const createSchema = z.object({
  email: z.string().email(),
  temporaryPassword: z.string().min(8, "At least 8 characters"),
  displayName: z.string().min(2).max(120),
  group: z.enum(["Admin", "RegistrationOfficer", "CheckinOfficer"]),
});

const groupLabels: Record<string, string> = {
  Admin: "Administrator",
  RegistrationOfficer: "Registration Officer",
  CheckinOfficer: "Check-in Officer",
};

function StaffPage() {
  const staff = useCurrentStaff();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!staff.loading && !staff.isAdmin) {
      toast.error("Administrators only");
      navigate({ to: "/dashboard" });
    }
  }, [staff, navigate]);

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: "", temporaryPassword: "", displayName: "", group: "RegistrationOfficer" },
  });

  const onCreate = async (v: z.infer<typeof createSchema>) => {
    // Staff creation is done via Cognito Admin API — requires a backend Lambda endpoint.
    // For now, show instructions to create via AWS Console or CLI.
    toast.info(
      `To add staff: go to AWS Cognito → User Pool → Create user. Email: ${v.email}, then add to group: ${v.group}`,
      { duration: 8000 }
    );
    setOpen(false);
    form.reset();
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
                <Input {...form.register("displayName")} />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Email</Label>
                <Input type="email" {...form.register("email")} />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Temporary password</Label>
                <Input type="text" {...form.register("temporaryPassword")} />
                {form.formState.errors.temporaryPassword && (
                  <p className="mt-1 text-xs text-destructive">{form.formState.errors.temporaryPassword.message}</p>
                )}
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Role</Label>
                <Select defaultValue="RegistrationOfficer" onValueChange={(v) => form.setValue("group", v as never)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Administrator</SelectItem>
                    <SelectItem value="RegistrationOfficer">Registration Officer</SelectItem>
                    <SelectItem value="CheckinOfficer">Check-in Officer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={form.formState.isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Get instructions
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-3">
        <div className="text-sm font-semibold">Managing staff with AWS Cognito</div>
        <p className="text-sm text-muted-foreground">
          Staff accounts are managed directly in the <strong>AWS Cognito User Pool</strong>. To add, disable, or reset a staff member:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          <li>Open the <strong>AWS Console → Cognito → User Pools → event-with-me-prod</strong></li>
          <li>Click <strong>Create user</strong> and enter their email + temporary password</li>
          <li>Go to <strong>Groups</strong> and add the user to <code>Admin</code>, <code>RegistrationOfficer</code>, or <code>CheckinOfficer</code></li>
          <li>To disable: select the user → <strong>Disable user</strong></li>
          <li>To reset password: select the user → <strong>Reset password</strong></li>
        </ol>
        <div className="flex flex-wrap gap-2 pt-2">
          {Object.entries(groupLabels).map(([key, label]) => (
            <Badge key={key} variant="outline">{key} — {label}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
