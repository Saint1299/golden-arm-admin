import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClientDetailView } from "@/components/hierarchy/ClientDetailView";
import { createClient } from "@/lib/supabase/server";
import type { Client, Guard, OrgNode } from "@/types/database";

export const metadata: Metadata = {
  title: "Client · Golden Arm Admin",
};

export default async function ClientDetailRoute({
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
  const isPooled = typedClient.type === "pooled";

  // All clients are fetched so the guard form modal can show its client
  // picker when the user wants to re-target a guard during edit. Org nodes
  // are fetched only for pooled clients (the chart is the page body there).
  const [allClientsRes, guardsRes, nodesRes] = await Promise.all([
    supabase.from("clients").select("*").order("name", { ascending: true }),
    supabase
      .from("guards")
      .select("*")
      .eq("client_id", id)
      .order("full_name", { ascending: true }),
    isPooled
      ? supabase
          .from("org_nodes")
          .select("*")
          .eq("client_id", id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <ClientDetailView
      client={typedClient}
      clients={(allClientsRes.data ?? []) as Client[]}
      initialGuards={(guardsRes.data ?? []) as Guard[]}
      initialNodes={(nodesRes.data ?? []) as OrgNode[]}
    />
  );
}
