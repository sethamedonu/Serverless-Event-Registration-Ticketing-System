import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "participant.registered"
  | "participant.walk_in_registered"
  | "participant.edited"
  | "participant.deleted"
  | "participant.checked_in"
  | "participant.checked_out"
  | "badge.printed"
  | "user.login"
  | "user.logout"
  | "staff.created"
  | "staff.self_signup"
  | "staff.role_changed"
  | "staff.disabled"
  | "staff.password_reset"
  | "settings.updated";

export async function logAudit(
  action: AuditAction,
  opts: { entity?: string; entity_id?: string | null; meta?: Record<string, unknown> } = {},
) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const label =
    (user?.user_metadata as { display_name?: string } | undefined)?.display_name ??
    user?.email ??
    null;
  await supabase.from("audit_logs").insert({
    action,
    entity: opts.entity ?? null,
    entity_id: opts.entity_id ?? null,
    actor_id: user?.id ?? null,
    actor_label: label,
    meta: (opts.meta ?? {}) as never,
  });
}
