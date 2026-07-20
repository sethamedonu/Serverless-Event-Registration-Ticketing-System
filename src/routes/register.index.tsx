import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useEventSettings } from "@/components/logo";

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(120),
  organisation: z.string().trim().min(2, "Please enter your organisation").max(160),
  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .max(255)
    .refine((value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Enter a valid email address",
    }),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits"),
  position: z.string().trim().max(120).optional().or(z.literal("")),
});
export type RegisterInput = z.infer<typeof registerSchema>;

const STORED_REGISTRATION_KEY = "visitorlog.registration";

function getStoredRegistrationNumber(): string | null {
  try {
    const raw = localStorage.getItem(STORED_REGISTRATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { registrationNumber?: string };
    return typeof parsed.registrationNumber === "string" ? parsed.registrationNumber : null;
  } catch {
    return null;
  }
}

function storeRegistrationNumber(registrationNumber: string) {
  try {
    localStorage.setItem(STORED_REGISTRATION_KEY, JSON.stringify({ registrationNumber }));
  } catch {
    // Ignore storage failures (e.g. private browsing) — dedup is a soft UX guard, not a hard rule.
  }
}

export const Route = createFileRoute("/register/")({
  head: () => ({
    meta: [
      { title: "Register — Summit Registration" },
      { name: "description", content: "Register for the Financial Architecture Summit." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { data: settings } = useEventSettings();
  const closed = settings?.registration_open === false;
  const [checkedExisting, setCheckedExisting] = useState(false);

  useEffect(() => {
    const existing = getStoredRegistrationNumber();
    if (existing) {
      navigate({ to: "/register/success/$reg", params: { reg: existing }, replace: true });
      return;
    }
    setCheckedExisting(true);
  }, [navigate]);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: "", organisation: "", email: "", phone: "", position: "" },
  });

  const onSubmit = async (values: RegisterInput) => {
    const { data, error } = await supabase.rpc("register_participant" as never, {
      _full_name: values.full_name,
      _organisation: values.organisation,
      _email: values.email.toLowerCase(),
      _phone: values.phone || "",
      _position: values.position || "",
    } as never);

    if (error) {
      if ((error as { code?: string }).code === "23505" || /duplicate/i.test(error.message)) {
        form.setError("email", { message: "This email is already registered" });
        toast.error("This email is already registered");
        return;
      }
      if (/phone/i.test(error.message)) {
        form.setError("phone", { message: "Phone must be exactly 10 digits" });
      }
      toast.error(error.message || "Registration failed");
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as { registration_number?: string } | null | undefined;
    if (!row?.registration_number) {
      toast.error("Registration failed");
      return;
    }
    storeRegistrationNumber(row.registration_number);
    navigate({ to: "/register/success/$reg", params: { reg: row.registration_number } });
  };

  if (!checkedExisting) return null;

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

            {closed ? (
              <div className="mt-8 rounded-lg border border-accent/50 bg-accent/15 p-4 text-sm">
                Registration is currently closed. Please check back later or contact the organisers.
              </div>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Full name" required error={form.formState.errors.full_name?.message}>
                  <Input autoComplete="name" placeholder="e.g. Ama Owusu" {...form.register("full_name")} />
                </Field>
                <Field label="Organisation" required error={form.formState.errors.organisation?.message}>
                  <Input autoComplete="organization" placeholder="Company / Institution" {...form.register("organisation")} />
                </Field>
                <Field label="Email address" required error={form.formState.errors.email?.message}>
                  <Input type="email" autoComplete="email" placeholder="you@company.com" {...form.register("email")} />
                </Field>
                <Field label="Phone number" error={form.formState.errors.phone?.message}>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    placeholder="10-digit phone number (optional)"
                    {...form.register("phone")}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Position / Job title" error={form.formState.errors.position?.message}>
                    <Input placeholder="Optional" {...form.register("position")} />
                  </Field>
                </div>
                <div className="md:col-span-2 mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    By registering you agree to receive summit-related communications.
                  </p>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={form.formState.isSubmitting}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
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

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
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
