import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const roleEnum = z.enum(["admin", "registration_officer", "checkin_officer"]);

async function assertAdmin(supabase: {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: administrators only");
}

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        display_name: z.string().min(2).max(120),
        role: roleEnum,
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    await supabaseAdmin.from("staff_profiles").upsert({
      id: created.user.id,
      display_name: data.display_name,
      email: data.email,
    });
    return { id: created.user.id };
  });

export const updateStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ user_id: z.string().uuid(), role: roleEnum }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStaffDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ user_id: z.string().uuid(), disabled: z.boolean() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("staff_profiles").update({ disabled: data.disabled }).eq("id", data.user_id);
    await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.disabled ? "8760h" : "none",
    });
    return { ok: true };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ email: z.string().email(), redirect_to: z.string().url() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, { redirectTo: data.redirect_to });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const signupTokenSchema = z.string().regex(/^\d{6}$/, "Code must be exactly 6 digits");

export const getSignupToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("signup_settings" as never)
      .select("token, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as { token: string | null; updated_at: string } | null;
    return { token: row?.token ?? null, updated_at: row?.updated_at ?? null };
  });

export const setSignupToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ token: signupTokenSchema }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("signup_settings" as never).upsert({
      id: 1,
      token: data.token,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const signUpStaff = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        display_name: z.string().trim().min(2).max(120),
        token: signupTokenSchema,
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bootstrap exception: if no staff account exists yet at all, allow the very first
    // signup through regardless of the token — it becomes admin automatically (see
    // handle_new_staff_user trigger) and can set a signup code for everyone after it.
    const { count: roleCount, error: roleCountError } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true });
    if (roleCountError) throw new Error("Signup is currently unavailable");

    if ((roleCount ?? 0) > 0) {
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from("signup_settings" as never)
        .select("token")
        .eq("id", 1)
        .maybeSingle();
      if (settingsError) throw new Error("Signup is currently unavailable");
      const currentToken = (settings as { token: string | null } | null)?.token;
      if (!currentToken || currentToken !== data.token) {
        throw new Error("Invalid signup code");
      }
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create account");

    await supabaseAdmin.from("audit_logs").insert({
      action: "staff.self_signup",
      entity: "user",
      entity_id: created.user.id,
      actor_id: created.user.id,
      actor_label: data.display_name,
      meta: { email: data.email },
    });

    return { ok: true };
  });
