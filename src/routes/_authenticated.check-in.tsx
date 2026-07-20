import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, CheckCircle2, Clock, Printer, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/check-in")({
  head: () => ({ meta: [{ title: "Check-in — Summit Console" }] }),
  component: CheckInPage,
});

type P = {
  id: string;
  registration_number: string;
  full_name: string;
  organisation: string;
  email: string;
  checked_in_at: string | null;
};

function CheckInPage() {
  const [query, setQuery] = useState("");
  const qc = useQueryClient();

  const debounced = useDebounced(query, 150);

  const results = useQuery({
    queryKey: ["checkin-search", debounced],
    enabled: debounced.trim().length > 0,
    queryFn: async () => {
      const t = debounced.trim().replace(/[%_]/g, "");
      const { data, error } = await supabase
        .from("participants")
        .select("id, registration_number, full_name, organisation, email, checked_in_at")
        .or(
          `full_name.ilike.%${t}%,organisation.ilike.%${t}%,email.ilike.%${t}%,registration_number.ilike.%${t}%`,
        )
        .order("full_name", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data as P[];
    },
  });

  const checkInAndPrint = async (p: P, printAfter: boolean) => {
    if (p.checked_in_at) {
      if (printAfter) window.open(`/badge/${p.id}?auto=1`, "_blank");
      return;
    }
    const { error } = await supabase
      .from("participants")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("participant.checked_in", { entity: "participant", entity_id: p.id, meta: { name: p.full_name } });
    toast.success(`${p.full_name} checked in`);
    qc.invalidateQueries({ queryKey: ["checkin-search"] });
    qc.invalidateQueries({ queryKey: ["participants"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    if (printAfter) window.open(`/badge/${p.id}?auto=1`, "_blank");
  };

  const rows = useMemo(() => results.data ?? [], [results.data]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Reception mode</div>
        <h1 className="mt-2 text-4xl font-bold">Check in a delegate</h1>
        <p className="mt-1 text-muted-foreground">Type any name, organisation, email or registration number.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="h-16 rounded-2xl border-2 pl-14 text-xl shadow-elegant"
        />
      </div>

      <div className="space-y-3">
        {query.trim() === "" ? (
          <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Start typing to find a delegate.
          </p>
        ) : results.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No matches. Ask the delegate to check the spelling of their name or email.
          </p>
        ) : (
          rows.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.15) }}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">{p.full_name}</div>
                  {p.checked_in_at ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3 w-3" /> Checked in
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-sm text-muted-foreground">
                  {p.organisation} · <span className="font-mono">{p.registration_number}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/participants/$id" params={{ id: p.id }}>
                  <Button variant="ghost">Open <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                </Link>
                {!p.checked_in_at && (
                  <Button
                    onClick={() => checkInAndPrint(p, false)}
                    className="bg-success text-success-foreground hover:bg-success/90"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Check in
                  </Button>
                )}
                <Button
                  onClick={() => checkInAndPrint(p, true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Printer className="mr-2 h-4 w-4" /> {p.checked_in_at ? "Print badge" : "Check in & print"}
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useMemo(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
