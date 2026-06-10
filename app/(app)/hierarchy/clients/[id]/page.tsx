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

  // Independent of each other (all key off the URL `id`), so run in parallel
  // and validate the client row afterward.
  const [clientRes, guardsRes, detsRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
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

  const { data: client, error: clientErr } = clientRes;
  if (clientErr || !client) notFound();

  return (
    <ClientDetailView
      client={client as Client}
      initialGuards={(guardsRes.data ?? []) as Guard[]}
      initialDetachments={(detsRes.data ?? []) as Detachment[]}
    />
  );
}
