import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo, useEventSettings } from "@/components/logo";
import { logAudit } from "@/lib/audit";
import { signUpStaff as signUpStaffFn } from "@/lib/staff.functions";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Minimum 6 characters"),
});
const signUpSchema = signInSchema.extend({
  display_name: z.string().trim().min(2, "Enter your name").max(120),
  token: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit signup code"),
});

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Staff sign in — Summit" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { data: settings } = useEventSettings();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");

  // If already signed in, jump to dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  type FormValues = z.infer<typeof signUpSchema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(mode === "sign_in" ? signInSchema : signUpSchema) as never,
    defaultValues: { email: "", password: "", display_name: "", token: "" },
  });
  const signUpStaff = useServerFn(signUpStaffFn);

  const onSubmit = async (values: FormValues) => {
    if (mode === "sign_in") {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      await logAudit("user.login");
      toast.success("Welcome back");
      navigate({ to: "/dashboard", replace: true });
    } else {
      try {
        await signUpStaff({
          data: {
            email: values.email,
            password: values.password,
            display_name: values.display_name,
            token: values.token,
          },
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create account");
        return;
      }
      toast.success("Account created. You can sign in now.");
      setMode("sign_in");
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-hero-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs backdrop-blur">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to public site
        </Link>
        <div>
          <Logo className="h-20 w-20 rounded-full bg-white/95 p-1" />
          <h1 className="mt-6 text-4xl font-black leading-tight">
            {settings?.event_name ?? "Financial Architecture Summit"}
          </h1>
          <p className="mt-4 max-w-md text-white/85">
            Coordinator console — register walk-ins, check delegates in, and print badges on arrival.
          </p>
        </div>
        <div className="text-xs text-white/70">Integrity and Excellence</div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant md:p-10"
        >
          <div className="mb-2 flex items-center gap-3 lg:hidden">
            <Logo className="h-10 w-10 rounded-full" />
            <div className="text-sm font-semibold">{settings?.event_name ?? "National Banking College"}</div>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            {mode === "sign_in" ? "Staff sign in" : "Create staff account"}
          </div>
          <h2 className="mt-2 text-2xl font-bold">
            {mode === "sign_in" ? "Welcome back" : "Set up your account"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "sign_in"
              ? "Sign in to access the coordinator console."
              : "The first account created becomes the administrator automatically."}
          </p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {mode === "sign_up" && (
              <div>
                <Label className="mb-1.5 block text-sm">Display name</Label>
                <Input placeholder="Your name" {...form.register("display_name")} />
                {form.formState.errors.display_name && (
                  <p className="mt-1 text-xs text-destructive">{form.formState.errors.display_name.message}</p>
                )}
              </div>
            )}
            <div>
              <Label className="mb-1.5 block text-sm">Email</Label>
              <Input type="email" autoComplete="email" placeholder="you@work.com" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Password</Label>
              <Input
                type="password"
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                placeholder="••••••••"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>
            {mode === "sign_up" && (
              <div>
                <Label className="mb-1.5 block text-sm">Signup code</Label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code from your administrator"
                  {...form.register("token")}
                />
                {form.formState.errors.token && (
                  <p className="mt-1 text-xs text-destructive">{form.formState.errors.token.message}</p>
                )}
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              size="lg"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "sign_in" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
            className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "sign_in" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
