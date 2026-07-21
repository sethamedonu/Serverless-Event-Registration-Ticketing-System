import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signIn, getSession, forgotPassword } from "@/lib/auth/cognito-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo, useEventSettings } from "@/components/logo";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Minimum 6 characters"),
});

const forgotSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Staff sign in — Summit" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { data: settings } = useEventSettings();
  const [mode, setMode] = useState<"sign_in" | "forgot">("sign_in");

  useEffect(() => {
    getSession().then((s) => {
      if (s) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(mode === "sign_in" ? signInSchema : forgotSchema) as never,
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: z.infer<typeof signInSchema>) => {
    if (mode === "sign_in") {
      try {
        await signIn(values.email, values.password);
        toast.success("Welcome back");
        navigate({ to: "/dashboard", replace: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Sign in failed");
      }
    } else {
      try {
        await forgotPassword(values.email);
        toast.success("Password reset code sent to your email");
        navigate({ to: "/reset-password", replace: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to send reset code");
      }
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
            {settings?.name ?? "Event Registration System"}
          </h1>
          <p className="mt-4 max-w-md text-white/85">
            Coordinator console — register walk-ins, check delegates in, and print badges on arrival.
          </p>
        </div>
        <div className="text-xs text-white/70">Powered by AWS</div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant md:p-10"
        >
          <div className="mb-2 flex items-center gap-3 lg:hidden">
            <Logo className="h-10 w-10 rounded-full" />
            <div className="text-sm font-semibold">{settings?.name ?? "Event System"}</div>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            {mode === "sign_in" ? "Staff sign in" : "Reset password"}
          </div>
          <h2 className="mt-2 text-2xl font-bold">
            {mode === "sign_in" ? "Welcome back" : "Forgot your password?"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "sign_in"
              ? "Sign in to access the coordinator console."
              : "Enter your email and we'll send a reset code."}
          </p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm">Email</Label>
              <Input type="email" autoComplete="email" placeholder="you@work.com" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            {mode === "sign_in" && (
              <div>
                <Label className="mb-1.5 block text-sm">Password</Label>
                <Input type="password" autoComplete="current-password" placeholder="••••••••" {...form.register("password")} />
                {form.formState.errors.password && (
                  <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>
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
              {mode === "sign_in" ? "Sign in" : "Send reset code"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "sign_in" ? "forgot" : "sign_in")}
            className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "sign_in" ? "Forgot your password?" : "Back to sign in"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
