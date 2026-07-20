import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStaff } from "@/lib/hooks/use-auth";
import { logAudit } from "@/lib/audit";

type SettingsForm = {
  event_name: string;
  event_date: string;
  venue: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  registration_open: boolean;
  badge_layout: string;
  badge_font_size: number;
  show_qr: boolean;
  show_registration_number: boolean;
};

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Event settings — Summit Console" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const staff = useCurrentStaff();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!staff.loading && !staff.isAdmin) {
      toast.error("Administrators only");
      navigate({ to: "/dashboard" });
    }
  }, [staff, navigate]);

  const q = useQuery({
    queryKey: ["event-settings-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<SettingsForm>();

  useEffect(() => {
    if (q.data) {
      form.reset({
        event_name: q.data.event_name,
        event_date: q.data.event_date ?? "",
        venue: q.data.venue ?? "",
        logo_url: q.data.logo_url ?? "",
        primary_color: q.data.primary_color,
        accent_color: q.data.accent_color,
        registration_open: q.data.registration_open,
        badge_layout: q.data.badge_layout,
        badge_font_size: q.data.badge_font_size,
        show_qr: q.data.show_qr,
        show_registration_number: q.data.show_registration_number,
      });
    }
  }, [q.data, form]);

  const onSubmit = async (v: SettingsForm) => {
    const { error } = await supabase
      .from("event_settings")
      .update({
        event_name: v.event_name,
        event_date: v.event_date || null,
        venue: v.venue || null,
        logo_url: v.logo_url || null,
        primary_color: v.primary_color,
        accent_color: v.accent_color,
        registration_open: v.registration_open,
        badge_layout: v.badge_layout,
        badge_font_size: Number(v.badge_font_size),
        show_qr: v.show_qr,
        show_registration_number: v.show_registration_number,
      })
      .eq("id", 1);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("settings.updated");
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["event-settings"] });
    qc.invalidateQueries({ queryKey: ["event-settings-admin"] });
  };

  if (q.isLoading) return <Skeleton className="h-72 w-full max-w-3xl" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Settings</div>
        <h1 className="mt-1 text-3xl font-bold">Event configuration</h1>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <Section title="Event">
          <Row>
            <Field label="Event name"><Input {...form.register("event_name")} /></Field>
            <Field label="Event date"><Input type="date" {...form.register("event_date")} /></Field>
          </Row>
          <Row>
            <Field label="Venue"><Input {...form.register("venue")} /></Field>
            <Field label="Logo URL (optional)">
              <Input placeholder="https://…" {...form.register("logo_url")} />
            </Field>
          </Row>
        </Section>

        <Section title="Branding">
          <Row>
            <Field label="Primary colour"><Input type="color" {...form.register("primary_color")} /></Field>
            <Field label="Accent colour"><Input type="color" {...form.register("accent_color")} /></Field>
          </Row>
        </Section>

        <Section title="Registration">
          <Toggle
            label="Registration open"
            description="Turn off to close public registration."
            checked={form.watch("registration_open")}
            onCheckedChange={(v) => form.setValue("registration_open", v)}
          />
        </Section>

        <Section title="Badge">
          <Row>
            <Field label="Badge layout">
              <Input {...form.register("badge_layout")} placeholder="standard" />
            </Field>
            <Field label="Font size (name)">
              <Input type="number" min={12} max={28} {...form.register("badge_font_size")} />
            </Field>
          </Row>
          <Toggle
            label="Show QR code"
            checked={form.watch("show_qr")}
            onCheckedChange={(v) => form.setValue("show_qr", v)}
          />
          <Toggle
            label="Show registration number"
            checked={form.watch("show_registration_number")}
            onCheckedChange={(v) => form.setValue("show_registration_number", v)}
          />
        </Section>

        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      </form>

      <div className="rounded-2xl border border-dashed border-border p-5 text-xs text-muted-foreground">
        <strong>Printing tip:</strong> For the XPrinter XP-DT427B, open the print dialog, set paper size to
        100mm × 60mm landscape, margins to none, and disable "Headers and footers" in Chrome to print edge-to-edge.
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      {children}
    </div>
  );
}
function Toggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
