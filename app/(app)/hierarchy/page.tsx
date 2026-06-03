import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  GuardDeploymentTable,
  type GuardDeploymentRow,
} from "@/components/hierarchy/GuardDeploymentTable";
import { createClient } from "@/lib/supabase/server";
import type { Client, Guard } from "@/types/database";

export const metadata: Metadata = {
  title: "Guard Deployment · Golden Arm Admin",
};

type RawGuardRow = Guard & {
  client: Pick<Client, "id" | "name" | "type"> | null;
};

export default async function HierarchyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Single fetch joins each guard with its client; the page groups by client
  // client-side. Clients are fetched in parallel for the filter chips and
  // the modal pickers.
  const [guardsRes, clientsRes] = await Promise.all([
    supabase
      .from("guards")
      .select("*, client:clients(id, name, type)")
      .order("full_name", { ascending: true }),
    supabase
      .from("clients")
      .select("*")
      .order("name", { ascending: true }),
  ]);

  const rows: GuardDeploymentRow[] = (
    (guardsRes.data ?? []) as RawGuardRow[]
  ).map((g) => {
    const { client, ...guard } = g;
    return {
      ...guard,
      client_name: client?.name ?? null,
      client_type: client?.type ?? null,
    };
  });

  return (
    <GuardDeploymentTable
      initialRows={rows}
      clients={(clientsRes.data ?? []) as Client[]}
    />
  );
}
