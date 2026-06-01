import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GuardDetailView } from "@/components/hierarchy/GuardDetailView";
import { createClient } from "@/lib/supabase/server";
import type { Client, Guard } from "@/types/database";

export const metadata: Metadata = {
  title: "Guard · Golden Arm Admin",
};

export default async function GuardDetailRoute({
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

  const [guardRes, clientsRes] = await Promise.all([
    supabase.from("guards").select("*").eq("id", id).maybeSingle(),
    supabase.from("clients").select("*").order("name", { ascending: true }),
  ]);

  if (guardRes.error || !guardRes.data) notFound();
  const typedGuard = guardRes.data as Guard;
  const clients = (clientsRes.data ?? []) as Client[];
  const client = clients.find((c) => c.id === typedGuard.client_id) ?? null;

  return (
    <GuardDetailView
      guard={typedGuard}
      client={client}
      clients={clients}
    />
  );
}
