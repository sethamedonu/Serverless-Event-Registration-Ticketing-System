import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { registrationsApi } from "@/lib/api-client";
import { useEvents } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(120),
  organisation: z.string().trim().min(2, "Please enter your organisation").max(160),
  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .max(255)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Enter a valid email address" }),
  phone: z.string().trim().regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits").optional().or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
});
type RegisterInput = z.infer<typeof registerSchema>;

const STORED_KEY = "visitorlog.registration";

function getStoredReg(): string | null {
  try {
    const raw = localStorage.getItem(STORED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { registrationNumber?: string };
    return typeof parsed.registrationNumber === "string" ? parsed.registrationNumber : null;
  } catch { return null; }
}

function storeReg(registrationNumber: string) {
  try { localStorage.setItem(STORED_KEY, JSON.stringify({ registrationNumber })); } catch { /* ignore */ }
}

export const Route = createFileRoute("/register/")({
  head: () => ({
    meta: [
      { title: "Register — Summit Registration" },
      { name: "description", content: "Register for the event." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [checkedExisting, setCheckedExisting] = useState(false);

  const activeEvent = events.find((e) => e.eventId === selectedEventId) ?? events.find((e) => e.registrationOpen) ?? events[0];

  useEffect(() => {
    const existing = getStoredReg();
    if (existing) {
      navigate({ to: "/register/success/$reg", params: { reg: existing }, replace: true });
      return;
    }
    setCheckedExisting(true);
  }, [navigate]);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", organisation: "", email: "", phone: "", position: "" },
  });

  const onSubmit = async (values: RegisterInput) => {
    if (!activeEvent) { toast.error("No event available for registration"); return; }
    try {
      const data = await registrationsApi.register(activeEvent.eventId, {
        fullName: values.fullName,
        organisation: values.organisation,
        email: values.email.toLowerCase(),
        phone: values.phone || undefined,
        position: values.position || undefined,
      });
      storeReg(data.registrationNumber);
      navigate({ to: "/register/success/$reg", params: { reg: data.registrationNumber } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      if (msg.toLowerCase().includes("email")) {
        form.setError("email", { message: "This email is already registered" });
        toast.error("This email is already registered");
        return;
      }
      toast.error(msg);
    }
  };

  if (!checkedExisting || eventsLoading) return null;

  const closed = !activeEvent || !activeEvent.registrationOpen;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border border-border bg-card shadow-elegant"
        >
          <div className="p-8 md:p-10">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Registration</div>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">Reserve your seat</h1>
            <p className="mt-2 text-muted-foreground">
              Fill in your details below. You'll receive a unique registration number to bring on the day.
            </p>

            {events.length > 1 && (
              <div className="mt-6 flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger className="w-[260px]"><SelectValue placeholder="Select event" /></SelectTrigger>
                  <SelectContent>
                    {events.filter((e) => e.registrationOpen).map((e) => (
                      <SelectItem key={e.eventId} value={e.eventId}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {closed ? (
              <div className="mt-8 rounded-lg border border-accent/50 bg-accent/15 p-4 text-sm">
                Registration is currently closed. Please check back later or contact the organisers.
              </div>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Full name" required error={form.formState.errors.fullName?.message}>
                  <Input autoComplete="name" placeholder="e.g. Ama Owusu" {...form.register("fullName")} />
                </Field>
                <Field label="Organisation" required error={form.formState.errors.organisation?.message}>
                  <Input autoComplete="organization" placeholder="Company / Institution" {...form.register("organisation")} />
                </Field>
                <Field label="Email address" required error={form.formState.errors.email?.message}>
                  <Input type="email" autoComplete="email" placeholder="you@company.com" {...form.register("email")} />
                </Field>
                <Field label="Phone number" error={form.formState.errors.phone?.message}>
                  <Input type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} placeholder="10-digit phone (optional)" {...form.register("phone")} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Position / Job title" error={form.formState.errors.position?.message}>
                    <Input placeholder="Optional" {...form.register("position")} />
                  </Field>
                </div>
                <div className="md:col-span-2 mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    By registering you agree to receive event-related communications.
                  </p>
                  <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Complete registration
                  </Button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </section>
      <SiteFooter />
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
