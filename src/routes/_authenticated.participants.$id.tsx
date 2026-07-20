import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Printer, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  organisation: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
});

export const Route = createFileRoute("/_authenticated/participants/$id")({
  head: () => ({ meta: [{ title: "Participant — Summit Console" }] }),
  component: ParticipantDetail,
});

function ParticipantDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["participant", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("participants").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", organisation: "", email: "", phone: "", position: "" },
  });

  useEffect(() => {
    if (q.data) {
      form.reset({
        full_name: q.data.full_name,
        organisation: q.data.organisation,
        email: q.data.email,
        phone: q.data.phone ?? "",
        position: q.data.position ?? "",
      });
    }
  }, [q.data, form]);

  const onSubmit = async (v: z.infer<typeof schema>) => {
    const { error } = await supabase
      .from("participants")
      .update({
        full_name: v.full_name,
        organisation: v.organisation,
        email: v.email.toLowerCase(),
        phone: v.phone || null,
        position: v.position || null,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("participant.edited", { entity: "participant", entity_id: id });
    toast.success("Participant updated");
    qc.invalidateQueries({ queryKey: ["participant", id] });
    qc.invalidateQueries({ queryKey: ["participants"] });
  };

  const checkIn = async () => {
    const { error } = await supabase
      .from("participants")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("participant.checked_in", { entity: "participant", entity_id: id });
    toast.success("Checked in");
    qc.invalidateQueries({ queryKey: ["participant", id] });
    qc.invalidateQueries({ queryKey: ["participants"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  if (q.isLoading) return <Skeleton className="h-72 w-full max-w-3xl" />;
  if (!q.data) {
    return (
      <div className="max-w-xl">
        <p>Participant not found.</p>
        <Button onClick={() => navigate({ to: "/participants" })} variant="outline" className="mt-4">
          Back to participants
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/participants" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to participants
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {q.data.registration_number}
            </div>
            <h1 className="mt-1 text-2xl font-bold">{q.data.full_name}</h1>
            <div className="text-sm text-muted-foreground">{q.data.organisation}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {q.data.checked_in_at ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Checked in
              </span>
            ) : (
              <Button onClick={checkIn} className="bg-success text-success-foreground hover:bg-success/90">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Check in
              </Button>
            )}
            <Link to="/badge/$id" params={{ id }}>
              <Button variant="outline"><Printer className="mr-2 h-4 w-4" /> Print badge</Button>
            </Link>
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="text-lg font-semibold">Edit details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-sm">Full name</Label>
            <Input {...form.register("full_name")} />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Organisation</Label>
            <Input {...form.register("organisation")} />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Email</Label>
            <Input type="email" {...form.register("email")} />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Phone</Label>
            <Input {...form.register("phone")} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-sm">Position</Label>
            <Input {...form.register("position")} />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
