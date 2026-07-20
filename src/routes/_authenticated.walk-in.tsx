import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logAudit } from "@/lib/audit";
import { useCurrentStaff } from "@/lib/hooks/use-auth";
import { useEffect, useState } from "react";

const AUTO_CONTINUE_MS = 5000;

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  organisation: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
});

export const Route = createFileRoute("/_authenticated/walk-in")({
  head: () => ({ meta: [{ title: "Walk-in registration — Summit Console" }] }),
  component: WalkInPage,
});

function WalkInPage() {
  const navigate = useNavigate();
  const staff = useCurrentStaff();
  const [successInfo, setSuccessInfo] = useState<{ reg: string; name: string } | null>(null);

  useEffect(() => {
    if (!staff.loading && !(staff.isAdmin || staff.isRegOfficer || staff.isCheckinOfficer)) {
      toast.error("You don't have access to walk-in registration");
      navigate({ to: "/dashboard" });
    }
  }, [staff, navigate]);

  useEffect(() => {
    if (!successInfo) return;
    const timer = setTimeout(() => setSuccessInfo(null), AUTO_CONTINUE_MS);
    return () => clearTimeout(timer);
  }, [successInfo]);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", organisation: "", email: "", phone: "", position: "" },
  });

  const onSubmit = async (v: z.infer<typeof schema>) => {
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("participants")
      .insert({
        full_name: v.full_name,
        organisation: v.organisation,
        email: v.email.toLowerCase(),
        phone: v.phone || null,
        position: v.position || null,
        registration_type: "walk_in",
        created_by: user.user?.id,
      })
      .select("id, registration_number")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        form.setError("email", { message: "This email is already registered" });
        toast.error("This email is already registered");
        return;
      }
      toast.error(error.message);
      return;
    }
    if (!data) return;
    await logAudit("participant.walk_in_registered", {
      entity: "participant",
      entity_id: data.id,
      meta: { reg: data.registration_number, name: v.full_name },
    });

    if (staff.isCheckinOfficer && !staff.isAdmin && !staff.isRegOfficer) {
      form.reset();
      setSuccessInfo({ reg: data.registration_number, name: v.full_name });
      return;
    }

    toast.success(`Registered ${data.registration_number} — opening badge…`);
    navigate({ to: "/badge/$id", params: { id: data.id } });
  };

  if (successInfo) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant"
        >
          <div className="relative bg-hero-gradient p-10 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-accent/20 p-2">
                <CheckCircle2 className="h-6 w-6 text-accent" />
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Registration complete</div>
            </div>
            <h1 className="mt-4 text-3xl font-bold md:text-4xl">{successInfo.name} is registered</h1>
            <p className="mt-2 max-w-xl text-white/85">Share the registration number below with the participant.</p>
          </div>
          <div className="p-10">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registration number</div>
            <div className="mt-1 text-4xl font-black tracking-tight text-primary md:text-5xl">{successInfo.reg}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-secondary/30 p-6">
            <Button
              onClick={() => setSuccessInfo(null)}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              <UserPlus className="mr-2 h-4 w-4" /> Register another
            </Button>
            <p className="text-xs text-muted-foreground">Continuing automatically in a few seconds…</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Reception</div>
        <h1 className="mt-1 text-3xl font-bold">Register walk-in</h1>
        <p className="mt-1 text-muted-foreground">Fast entry — press Tab between fields and Enter to submit.</p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={form.handleSubmit(onSubmit)}
        className="rounded-2xl border border-border bg-card p-6 shadow-elegant md:p-8"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-base font-semibold">Full name *</Label>
            <Input
              autoFocus
              className="h-12 text-lg"
              placeholder="e.g. Kwame Boateng"
              {...form.register("full_name")}
            />
            {form.formState.errors.full_name && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.full_name.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Organisation *</Label>
            <Input className="h-11" {...form.register("organisation")} />
            {form.formState.errors.organisation && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.organisation.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Email *</Label>
            <Input type="email" className="h-11" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Phone</Label>
            <Input className="h-11" {...form.register("phone")} />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Position</Label>
            <Input className="h-11" {...form.register("position")} />
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => form.reset()}>Reset</Button>
          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Register & print badge
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
