import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GuardDetailView } from "@/components/hierarchy/GuardDetailView";
import { createClient } from "@/lib/supabase/server";
import type { Client, Guard, Region } from "@/types/database";

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

  const { data: guard, error: guardErr } = await supabase
    .from("guards")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (guardErr || !guard) notFound();

  const typedGuard = guard as Guard;

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", typedGuard.client_id)
    .maybeSingle();

  const typedClient = (client as Client | null) ?? null;

  const { data: region } = typedClient
    ? await supabase
        .from("regions")
        .select("*")
        .eq("id", typedClient.region_id)
        .maybeSingle()
    : { data: null };

  return (
    <GuardDetailView
      guard={typedGuard}
      client={typedClient}
      region={(region as Region | null) ?? null}
    />
  );
}
