import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ClientList,
  type ClientListRow,
} from "@/components/hierarchy/ClientList";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Clients · Golden Arm Admin",
};

type RawClientRow = {
  id: string;
  name: string;
  type: "single_post" | "pooled";
  industry: string | null;
  conglomerate: string | null;
  created_at: string;
  guards: { count: number }[];
};

export default async function HierarchyClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("clients")
    .select("*, guards(count)")
    .order("name", { ascending: true });

  const rows: ClientListRow[] = ((data ?? []) as RawClientRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    industry: c.industry,
    conglomerate: c.conglomerate,
    created_at: c.created_at,
    guard_count: c.guards?.[0]?.count ?? 0,
  }));

  return <ClientList initialRows={rows} />;
}
