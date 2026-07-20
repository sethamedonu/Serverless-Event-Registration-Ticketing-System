import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStaff } from "@/lib/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit log — Summit Console" }] }),
  component: AuditPage,
});

function AuditPage() {
  const staff = useCurrentStaff();
  const navigate = useNavigate();

  useEffect(() => {
    if (!staff.loading && !staff.isAdmin) {
      toast.error("Administrators only");
      navigate({ to: "/dashboard" });
    }
  }, [staff, navigate]);

  const q = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Audit log</div>
        <h1 className="mt-1 text-3xl font-bold">System activity</h1>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Entity</th>
                <th className="px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr><td colSpan={4} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>
              ) : (q.data ?? []).length === 0 ? (
                <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">No entries yet.</td></tr>
              ) : (
                (q.data ?? []).map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
                        {a.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{a.actor_label ?? <span className="text-muted-foreground">system</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.entity ?? "—"}{a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
