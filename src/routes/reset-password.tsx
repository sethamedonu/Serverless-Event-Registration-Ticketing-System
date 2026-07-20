import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Summit" }, { name: "robots", content: "noindex" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  // Supabase places a recovery access token in the URL hash and the client
  // exchanges it into a session automatically. Wait for that session before
  // allowing the password update, otherwise `updateUser` fails.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = async (v: z.infer<typeof schema>) => {
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero-gradient p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <Link to="/auth" className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10 rounded-full" />
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Reset password</div>
        </div>
        <h1 className="mt-3 text-2xl font-bold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready
            ? "Enter and confirm your new password below."
            : "Verifying your reset link…"}
        </p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <Label className="mb-1.5 block text-sm">New password</Label>
            <Input type="password" autoComplete="new-password" {...form.register("password")} disabled={!ready} />
            {form.formState.errors.password && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Confirm password</Label>
            <Input type="password" autoComplete="new-password" {...form.register("confirm")} disabled={!ready} />
            {form.formState.errors.confirm && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.confirm.message}</p>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={!ready || form.formState.isSubmitting}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
