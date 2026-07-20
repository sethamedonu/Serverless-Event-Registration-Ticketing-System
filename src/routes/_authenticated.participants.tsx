import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, CheckCircle2, Clock, Printer, Pencil, Trash2, Filter, Radio } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCurrentStaff } from "@/lib/hooks/use-auth";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/participants")({
  head: () => ({ meta: [{ title: "Participants — Summit Console" }] }),
  component: ParticipantsPage,
});

type Row = {
  id: string;
  registration_number: string;
  full_name: string;
  organisation: string;
  email: string;
  registration_type: "online" | "walk_in";
  checked_in_at: string | null;
  created_at: string;
  badge_printed_at: string | null;
  badge_print_count: number;
};

function ParticipantsPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "online" | "walk_in">("all");
  const [status, setStatus] = useState<"all" | "checked" | "pending">("all");
  const [badge, setBadge] = useState<"all" | "pending" | "printed">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "alpha">("newest");
  const [live, setLive] = useState(false);
  const staff = useCurrentStaff();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["participants", search, type, status, badge, sort],
    queryFn: async () => {
      let q = supabase
        .from("participants")
        .select("id, registration_number, full_name, organisation, email, registration_type, checked_in_at, created_at, badge_printed_at, badge_print_count")
        .limit(500);
      if (search.trim()) {
        const t = search.trim().replace(/[%_]/g, "");
        q = q.or(
          `full_name.ilike.%${t}%,organisation.ilike.%${t}%,email.ilike.%${t}%,registration_number.ilike.%${t}%`,
        );
      }
      if (type !== "all") q = q.eq("registration_type", type);
      if (status === "checked") q = q.not("checked_in_at", "is", null);
      if (status === "pending") q = q.is("checked_in_at", null);
      if (badge === "printed") q = q.not("badge_printed_at", "is", null);
      if (badge === "pending") q = q.is("badge_printed_at", null);
      if (sort === "newest") q = q.order("created_at", { ascending: false });
      if (sort === "oldest") q = q.order("created_at", { ascending: true });
      if (sort === "alpha") q = q.order("full_name", { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return data as Row[];
    },
  });

  // Realtime: new registrations and updates appear instantly.
  useEffect(() => {
    const channel = supabase
      .channel("participants-desk")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        (payload) => {
          setLive(true);
          qc.invalidateQueries({ queryKey: ["participants"] });
          qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
          if (payload.eventType === "INSERT") {
            const row = payload.new as { full_name?: string; registration_number?: string };
            toast.success(`New registration: ${row.full_name ?? "participant"} (${row.registration_number ?? ""})`);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const rows = useMemo(() => query.data ?? [], [query.data]);

  const deleteParticipant = async (row: Row) => {
    const { error } = await supabase.from("participants").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("participant.deleted", { entity: "participant", entity_id: row.id, meta: { name: row.full_name } });
    toast.success("Participant deleted");
    qc.invalidateQueries({ queryKey: ["participants"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Registration Desk
            <span
              title={live ? "Live updates active" : "Waiting for updates"}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${live ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
            >
              <Radio className={`h-3 w-3 ${live ? "animate-pulse" : ""}`} /> Live
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-bold">All registrations</h1>
        </div>
        <Link to="/walk-in">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">+ Register walk-in</Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, organisation, email or reg number…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="walk_in">Walk-in</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="checked">Checked in</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={badge} onValueChange={(v) => setBadge(v as typeof badge)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All badges</SelectItem>
                <SelectItem value="pending">Badge pending</SelectItem>
                <SelectItem value="printed">Badge printed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="alpha">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Reg No.</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Organisation</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Email</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Check-in</th>
                <th className="px-4 py-3 font-semibold">Badge</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Registered</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td colSpan={9} className="p-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-16 text-center text-sm text-muted-foreground">
                    No participants match your filters.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.15) }}
                    className="border-b border-border last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.registration_number}</td>
                    <td className="px-4 py-3 font-medium">{r.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.organisation}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={r.registration_type === "walk_in" ? "secondary" : "outline"}>
                        {r.registration_type === "walk_in" ? "Walk-in" : "Online"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.checked_in_at ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3 w-3" /> Checked in
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.badge_printed_at ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary" title={`Printed ${r.badge_print_count}×`}>
                          <Printer className="h-3 w-3" /> Printed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link to="/badge/$id" params={{ id: r.id }}>
                          <Button variant="ghost" size="icon" title="Print badge"><Printer className="h-4 w-4" /></Button>
                        </Link>
                        <Link to="/participants/$id" params={{ id: r.id }}>
                          <Button variant="ghost" size="icon" title="Edit"><Pencil className="h-4 w-4" /></Button>
                        </Link>
                        {staff.isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Delete" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete participant?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove <span className="font-semibold">{r.full_name}</span> ({r.registration_number}).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteParticipant(r)} className="bg-destructive text-destructive-foreground">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing up to 500 rows. Refine with search or filters to see more specific results.
      </p>
    </div>
  );
}
