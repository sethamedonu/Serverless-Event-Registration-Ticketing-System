import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Sheet as SheetIcon, FileType2 } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCurrentStaff } from "@/lib/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Summit Console" }] }),
  component: ReportsPage,
});

type ReportKind = "attendance" | "registration" | "walk_in";

function ReportsPage() {
  const staff = useCurrentStaff();
  const navigate = useNavigate();

  useEffect(() => {
    if (!staff.loading && !staff.isAdmin) {
      toast.error("Reports are administrator-only");
      navigate({ to: "/dashboard" });
    }
  }, [staff, navigate]);

  const [kind, setKind] = useState<ReportKind>("attendance");

  const query = useQuery({
    queryKey: ["report", kind],
    queryFn: async () => {
      let q = supabase.from("participants").select("*").order("created_at", { ascending: false });
      if (kind === "attendance") q = q.not("checked_in_at", "is", null);
      if (kind === "walk_in") q = q.eq("registration_type", "walk_in");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const rows = query.data ?? [];

  const columns = [
    { key: "registration_number", label: "Reg No." },
    { key: "full_name", label: "Full name" },
    { key: "organisation", label: "Organisation" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "position", label: "Position" },
    { key: "registration_type", label: "Type" },
    { key: "checked_in_at", label: "Checked in" },
    { key: "created_at", label: "Registered" },
  ] as const;

  const exportCSV = () => {
    const csv = Papa.unparse(rows.map(pretty));
    download(new Blob([csv], { type: "text/csv" }), `${kind}-report.csv`);
  };
  const exportXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map(pretty));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${kind}-report.xlsx`);
  };
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`${labelFor(kind)} · Summit Report`, 14, 15);
    autoTable(doc, {
      startY: 22,
      head: [columns.map((c) => c.label)],
      body: rows.map((r) => columns.map((c) => (pretty(r) as Record<string, string>)[c.key] ?? "")),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 101, 91] },
    });
    doc.save(`${kind}-report.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Reports</div>
        <h1 className="mt-1 text-3xl font-bold">Export summit data</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        {(["attendance", "registration", "walk_in"] as ReportKind[]).map((k) => (
          <Button
            key={k}
            variant={kind === k ? "default" : "outline"}
            onClick={() => setKind(k)}
            className={kind === k ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
          >
            {labelFor(k)}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={exportCSV} variant="outline"><FileText className="mr-2 h-4 w-4" /> Export CSV</Button>
        <Button onClick={exportXLSX} variant="outline"><SheetIcon className="mr-2 h-4 w-4" /> Export Excel</Button>
        <Button onClick={exportPDF} variant="outline"><FileType2 className="mr-2 h-4 w-4" /> Export PDF</Button>
        <div className="ml-auto text-sm text-muted-foreground self-center">
          {query.isLoading ? "Loading…" : `${rows.length} record${rows.length === 1 ? "" : "s"}`}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-semibold">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={columns.length} className="p-3"><Skeleton className="h-6 w-full" /></td></tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="p-10 text-center text-muted-foreground">No data.</td></tr>
              ) : (
                rows.slice(0, 200).map((r) => {
                  const p = pretty(r);
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      {columns.map((c) => (
                        <td key={c.key} className="px-4 py-2">{(p as Record<string, string>)[c.key]}</td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 200 && (
          <div className="border-t border-border p-3 text-xs text-muted-foreground">
            Showing first 200 rows in preview. Export to see the full dataset.
          </div>
        )}
      </div>
    </div>
  );
}

function labelFor(k: ReportKind) {
  return k === "attendance" ? "Attendance" : k === "walk_in" ? "Walk-ins" : "Registrations";
}

function pretty(r: Record<string, unknown>) {
  return {
    registration_number: r.registration_number as string,
    full_name: r.full_name as string,
    organisation: r.organisation as string,
    email: r.email as string,
    phone: (r.phone as string) ?? "",
    position: (r.position as string) ?? "",
    registration_type: (r.registration_type as string) === "walk_in" ? "Walk-in" : "Online",
    checked_in_at: r.checked_in_at ? new Date(r.checked_in_at as string).toLocaleString() : "",
    created_at: new Date(r.created_at as string).toLocaleString(),
  };
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// unused re-export placeholder to appease linter
export const _icon = Download;
