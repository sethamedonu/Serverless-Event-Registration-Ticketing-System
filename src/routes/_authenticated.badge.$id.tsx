import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ParticipantBadge } from "@/components/participant-badge";
import { logAudit } from "@/lib/audit";
import { useEventSettings } from "@/components/logo";

const searchSchema = z.object({ auto: z.string().optional() });

export const Route = createFileRoute("/_authenticated/badge/$id")({
  head: () => ({ meta: [{ title: "Print badge — Summit Console" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: BadgePage,
});

function BadgePage() {
  const { id } = Route.useParams();
  const search = useSearch({ from: "/_authenticated/badge/$id" });
  const badgeRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const participant = useQuery({
    queryKey: ["participant-badge", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, full_name, organisation, registration_number, registration_type")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const settings = useEventSettings();

  const doPrint = useReactToPrint({
    contentRef: badgeRef,
    documentTitle: participant.data ? `Badge-${participant.data.registration_number}` : "Badge",
    onAfterPrint: async () => {
      await supabase
        .from("participants")
        .update({
          badge_printed_at: new Date().toISOString(),
          badge_print_count: (await getCount(id)) + 1,
        })
        .eq("id", id);
      await logAudit("badge.printed", { entity: "participant", entity_id: id });
      qc.invalidateQueries({ queryKey: ["participants"] });
    },
  });

  // Auto print if ?auto=1
  useEffect(() => {
    if (search.auto === "1" && participant.data && settings.data) {
      const t = setTimeout(() => doPrint(), 300);
      return () => clearTimeout(t);
    }
  }, [search.auto, participant.data, settings.data, doPrint]);

  if (participant.isLoading || settings.isLoading) {
    return <Skeleton className="h-64 w-full max-w-2xl" />;
  }
  if (!participant.data || !settings.data) {
    return <p>Participant not found.</p>;
  }

  const badgeSettings = {
    event_name: settings.data.event_name,
    logo_url: settings.data.logo_url,
    show_qr: settings.data.show_qr,
    show_registration_number: settings.data.show_registration_number,
    badge_font_size: settings.data.badge_font_size,
    primary_color: settings.data.primary_color,
    accent_color: settings.data.accent_color,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to="/participants" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Button onClick={() => doPrint()} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Printer className="mr-2 h-4 w-4" /> Print badge
        </Button>
      </div>

      <div className="no-print rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Badge preview · 100mm × 60mm</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Tip: in the print dialog, disable "Headers and footers" and set margins to "None" for a clean edge-to-edge badge.
        </p>
      </div>

      <div className="mx-auto flex justify-center">
        <div ref={badgeRef} className="print-area rounded-lg border border-border bg-white p-4 shadow-elegant">
          <ParticipantBadge participant={participant.data} settings={badgeSettings} />
        </div>
      </div>
    </div>
  );
}

async function getCount(id: string) {
  const { data } = await supabase.from("participants").select("badge_print_count").eq("id", id).maybeSingle();
  return data?.badge_print_count ?? 0;
}
