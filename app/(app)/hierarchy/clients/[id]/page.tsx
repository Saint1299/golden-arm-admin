import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClientDetailView } from "@/components/hierarchy/ClientDetailView";
import { createClient } from "@/lib/supabase/server";
import type { Client, Detachment, Guard } from "@/types/database";

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

  const [guardsRes, detsRes] = await Promise.all([
    supabase
      .from("guards")
      .select("*")
      .eq("client_id", id)
      .order("full_name", { ascending: true }),
    supabase
      .from("detachments")
      .select("*")
      .eq("client_id", id)
      .order("name", { ascending: true }),
  ]);

  return (
    <ClientDetailView
      client={client as Client}
      initialGuards={(guardsRes.data ?? []) as Guard[]}
      initialDetachments={(detsRes.data ?? []) as Detachment[]}
    />
  );
}
