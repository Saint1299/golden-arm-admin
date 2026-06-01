import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ComplianceBoard } from "@/components/compliance/ComplianceBoard";
import { createClient } from "@/lib/supabase/server";
import type { ComplianceBoardRow, Region } from "@/types/database";

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
  const [boardRes, regionsRes] = await Promise.all([
    supabase
      .from("compliance_board")
      .select("*")
      .in("scope", ["company", "client"])
      .order("expiry_date", { ascending: true, nullsFirst: false }),
    supabase.from("regions").select("*").order("name", { ascending: true }),
  ]);

  return (
    <ComplianceBoard
      initialRows={(boardRes.data ?? []) as ComplianceBoardRow[]}
      regions={(regionsRes.data ?? []) as Region[]}
    />
  );
}
