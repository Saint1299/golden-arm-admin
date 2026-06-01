import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HierarchyBrowser } from "@/components/hierarchy/HierarchyBrowser";
import type { ClientWithCount } from "@/components/hierarchy/HierarchyBrowser";
import { createClient } from "@/lib/supabase/server";
import type { Region } from "@/types/database";

export const metadata: Metadata = {
  title: "Hierarchy · Golden Arm Admin",
};

type ClientRow = {
  id: string;
  region_id: string;
  name: string;
  type: ClientWithCount["type"];
  industry: string | null;
  conglomerate: string | null;
  created_at: string;
  guards: { count: number }[];
};

export default async function HierarchyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [regionsRes, clientsRes] = await Promise.all([
    supabase.from("regions").select("*").order("name", { ascending: true }),
    supabase
      .from("clients")
      .select("*, guards(count)")
      .order("name", { ascending: true }),
  ]);

  const regions = (regionsRes.data ?? []) as Region[];
  const clients: ClientWithCount[] = ((clientsRes.data ?? []) as ClientRow[]).map(
    (c) => ({
      id: c.id,
      region_id: c.region_id,
      name: c.name,
      type: c.type,
      industry: c.industry,
      conglomerate: c.conglomerate,
      created_at: c.created_at,
      guard_count: c.guards?.[0]?.count ?? 0,
    }),
  );

  return <HierarchyBrowser initialRegions={regions} initialClients={clients} />;
}
