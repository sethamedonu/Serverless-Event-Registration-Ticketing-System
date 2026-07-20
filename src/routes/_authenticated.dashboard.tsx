import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, CheckCircle2, Clock, UserPlus, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Summit Console" }] }),
  component: Dashboard,
});

interface Stats {
  total: number;
  checkedIn: number;
  pending: number;
  walkIns: number;
  today: number;
}

function Dashboard() {
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<Stats> => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [total, checkedIn, walkIns, today] = await Promise.all([
        supabase.from("participants").select("*", { count: "exact", head: true }),
        supabase.from("participants").select("*", { count: "exact", head: true }).not("checked_in_at", "is", null),
        supabase.from("participants").select("*", { count: "exact", head: true }).eq("registration_type", "walk_in"),
        supabase
          .from("participants")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startOfDay.toISOString()),
      ]);
      const t = total.count ?? 0;
      const c = checkedIn.count ?? 0;
      return { total: t, checkedIn: c, pending: t - c, walkIns: walkIns.count ?? 0, today: today.count ?? 0 };
    },
    refetchInterval: 30_000,
  });

  const activity = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, actor_label, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const cards = [
    { label: "Total participants", value: stats.data?.total, icon: Users, tone: "bg-primary/10 text-primary" },
    { label: "Checked in", value: stats.data?.checkedIn, icon: CheckCircle2, tone: "bg-success/15 text-success" },
    { label: "Pending check-in", value: stats.data?.pending, icon: Clock, tone: "bg-accent/25 text-primary" },
    { label: "Walk-ins", value: stats.data?.walkIns, icon: UserPlus, tone: "bg-secondary text-primary" },
    { label: "Today", value: stats.data?.today, icon: TrendingUp, tone: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Overview</div>
        <h1 className="mt-1 text-3xl font-bold">Live event dashboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.tone}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</div>
              {stats.isLoading ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <div className="mt-1 text-3xl font-bold tabular-nums">{c.value ?? 0}</div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <div className="text-sm font-semibold">Recent activity</div>
          <div className="text-xs text-muted-foreground">Latest actions across the summit</div>
        </div>
        <div className="divide-y divide-border">
          {activity.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="mt-2 h-3 w-32" />
              </div>
            ))
          ) : activity.data && activity.data.length > 0 ? (
            activity.data.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-4 px-6 py-4">
                <div>
                  <div className="text-sm font-medium">{prettyAction(a.action)}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.actor_label ?? "System"} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">No activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function prettyAction(action: string) {
  const map: Record<string, string> = {
    "participant.registered": "New online registration",
    "participant.walk_in_registered": "Walk-in registered",
    "participant.edited": "Participant edited",
    "participant.deleted": "Participant deleted",
    "participant.checked_in": "Participant checked in",
    "badge.printed": "Badge printed",
    "user.login": "Coordinator signed in",
    "user.logout": "Coordinator signed out",
    "settings.updated": "Event settings updated",
    "staff.created": "Staff member added",
    "staff.role_changed": "Staff role updated",
    "staff.disabled": "Staff account disabled",
    "staff.password_reset": "Password reset sent",
  };
  return map[action] ?? action;
}
