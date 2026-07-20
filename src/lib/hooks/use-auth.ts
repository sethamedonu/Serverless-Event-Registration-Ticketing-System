import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "registration_officer" | "checkin_officer";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function useCurrentStaff() {
  const { user, loading } = useSession();
  const roles = useRoles(user?.id);
  return {
    user: user as User | null,
    loading: loading || roles.isLoading,
    roles: roles.data ?? [],
    isAdmin: (roles.data ?? []).includes("admin"),
    isRegOfficer: (roles.data ?? []).includes("registration_officer"),
    isCheckinOfficer: (roles.data ?? []).includes("checkin_officer"),
    isStaff: (roles.data ?? []).length > 0,
  };
}
