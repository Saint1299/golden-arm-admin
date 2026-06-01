import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OrgChartCanvas } from "@/components/hierarchy/OrgChartCanvas";
import { createClient } from "@/lib/supabase/server";
import type { Client, Guard, OrgNode } from "@/types/database";

export const metadata: Metadata = {
  title: "Org chart · Golden Arm Admin",
};

export default async function OrgChartRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (clientErr || !client) notFound();
  const typedClient = client as Client;

  // Single round trip for everything the chart needs.
  const [nodesRes, guardsRes] = await Promise.all([
    supabase
      .from("org_nodes")
      .select("*")
      .eq("client_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("guards")
      .select("*")
      .eq("client_id", id)
      .order("full_name", { ascending: true }),
  ]);

  return (
    <OrgChartCanvas
      client={typedClient}
      initialNodes={(nodesRes.data ?? []) as OrgNode[]}
      initialGuards={(guardsRes.data ?? []) as Guard[]}
    />
  );
}
