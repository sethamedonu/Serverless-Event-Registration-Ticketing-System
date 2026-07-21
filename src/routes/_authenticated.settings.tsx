import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { eventsApi, type ApiEvent } from "@/lib/api-client";
import { useEvents } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStaff } from "@/lib/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

type SettingsForm = {
  name: string;
  date: string;
  venue: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  registrationOpen: boolean;
  badgeFontSize: number;
  showQr: boolean;
  showRegistrationNumber: boolean;
};

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Event settings — Summit Console" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const staff = useCurrentStaff();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: events = [] } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState("");

  const activeEventId = selectedEventId || events[0]?.eventId || "";

  useEffect(() => {
    if (!staff.loading && !staff.isAdmin) {
      toast.error("Administrators only");
      navigate({ to: "/dashboard" });
    }
  }, [staff, navigate]);

  const q = useQuery({
    queryKey: ["event-settings-admin", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const all = await eventsApi.list();
      return all.find((e) => e.eventId === activeEventId) ?? null;
    },
  });

  const form = useForm<SettingsForm>();

  useEffect(() => {
    if (q.data) {
      form.reset({
        name: q.data.name,
        date: q.data.date ?? "",
        venue: q.data.venue ?? "",
        logoUrl: q.data.logoUrl ?? "",
        primaryColor: q.data.primaryColor,
        accentColor: q.data.accentColor,
        registrationOpen: q.data.registrationOpen,
        badgeFontSize: q.data.badgeFontSize,
        showQr: q.data.showQr,
        showRegistrationNumber: q.data.showRegistrationNumber,
      });
    }
  }, [q.data, form]);

  const onSubmit = async (v: SettingsForm) => {
    if (!activeEventId) return;
    try {
      await eventsApi.update(activeEventId, {
        name: v.name,
        date: v.date || null,
        venue: v.venue || null,
        logoUrl: v.logoUrl || null,
        primaryColor: v.primaryColor,
        accentColor: v.accentColor,
        registrationOpen: v.registrationOpen,
        badgeFontSize: Number(v.badgeFontSize),
        showQr: v.showQr,
        showRegistrationNumber: v.showRegistrationNumber,
      });
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event-settings"] });
      qc.invalidateQueries({ queryKey: ["event-settings-admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  };

  if (q.isLoading) return <Skeleton className="h-72 w-full max-w-3xl" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Settings</div>
        <h1 className="mt-1 text-3xl font-bold">Event configuration</h1>
      </div>

      {events.length > 1 && (
        <Select value={activeEventId} onValueChange={setSelectedEventId}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select event" /></SelectTrigger>
          <SelectContent>
            {events.map((e) => (
              <SelectItem key={e.eventId} value={e.eventId}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <Section title="Event">
          <Row>
            <Field label="Event name"><Input {...form.register("name")} /></Field>
            <Field label="Event date"><Input type="date" {...form.register("date")} /></Field>
          </Row>
          <Row>
            <Field label="Venue"><Input {...form.register("venue")} /></Field>
            <Field label="Logo URL (optional)"><Input placeholder="https://…" {...form.register("logoUrl")} /></Field>
          </Row>
        </Section>

        <Section title="Branding">
          <Row>
            <Field label="Primary colour"><Input type="color" {...form.register("primaryColor")} /></Field>
            <Field label="Accent colour"><Input type="color" {...form.register("accentColor")} /></Field>
          </Row>
        </Section>

        <Section title="Registration">
          <Toggle
            label="Registration open"
            description="Turn off to close public registration."
            checked={form.watch("registrationOpen")}
            onCheckedChange={(v) => form.setValue("registrationOpen", v)}
          />
        </Section>

        <Section title="Badge">
          <Row>
            <Field label="Font size (name)">
              <Input type="number" min={12} max={28} {...form.register("badgeFontSize")} />
            </Field>
          </Row>
          <Toggle label="Show QR code" checked={form.watch("showQr")} onCheckedChange={(v) => form.setValue("showQr", v)} />
          <Toggle label="Show registration number" checked={form.watch("showRegistrationNumber")} onCheckedChange={(v) => form.setValue("showRegistrationNumber", v)} />
        </Section>

        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-3 text-sm font-semibold">{title}</div><div className="space-y-3">{children}</div></div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-sm">{label}</Label>{children}</div>;
}
function Toggle({ label, description, checked, onCheckedChange }: { label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
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
