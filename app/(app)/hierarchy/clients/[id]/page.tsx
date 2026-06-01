import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClientDetailView } from "@/components/hierarchy/ClientDetailView";
import { createClient } from "@/lib/supabase/server";
import type { Client, Guard, OrgNode, Region } from "@/types/database";

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

  const [regionRes, guardsRes, nodesRes] = await Promise.all([
    supabase
      .from("regions")
      .select("*")
      .eq("id", typedClient.region_id)
      .maybeSingle(),
    supabase
      .from("guards")
      .select("*")
      .eq("client_id", id)
      .order("full_name", { ascending: true }),
    supabase
      .from("org_nodes")
      .select("*")
      .eq("client_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <ClientDetailView
      client={typedClient}
      region={(regionRes.data as Region | null) ?? null}
      initialGuards={(guardsRes.data ?? []) as Guard[]}
      initialNodes={(nodesRes.data ?? []) as OrgNode[]}
    />
  );
}
