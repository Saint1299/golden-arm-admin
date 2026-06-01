import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ComplianceBoard } from "@/components/compliance/ComplianceBoard";
import { createClient } from "@/lib/supabase/server";
import type { ComplianceBoardRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Compliance · Golden Arm Admin",
};

export default async function CompliancePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Read from the view (per spec). The view computes alert_status / days
  // remaining with the same 30-day threshold our helper uses. This page is
  // strictly the company + client board — guard-scoped docs are managed via
  // the guard detail page's Compliance tab.
  //
  // The view doesn't carry file_url, so we fetch it from documents in
  // parallel and merge into each row.
  const [boardRes, docsRes] = await Promise.all([
    supabase
      .from("compliance_board")
      .select("*")
      .in("scope", ["company", "client"])
      .order("expiry_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("documents")
      .select("id, file_url")
      .in("scope", ["company", "client"]),
  ]);

  const fileUrlById = new Map<string, string | null>();
  for (const d of (docsRes.data ?? []) as Array<{
    id: string;
    file_url: string | null;
  }>) {
    fileUrlById.set(d.id, d.file_url);
  }

  const rows: ComplianceBoardRow[] = (
    (boardRes.data ?? []) as Omit<ComplianceBoardRow, "file_url">[]
  ).map((r) => ({ ...r, file_url: fileUrlById.get(r.id) ?? null }));

  return <ComplianceBoard initialRows={rows} />;
}
