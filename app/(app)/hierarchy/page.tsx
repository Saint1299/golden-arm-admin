import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClientCardsView } from "@/components/hierarchy/ClientCardsView";
import { buildCards } from "@/lib/client-cards";
import { createClient } from "@/lib/supabase/server";
import type { Client, Guard } from "@/types/database";

export const metadata: Metadata = {
  title: "Clients · Golden Arm Admin",
};

export default async function HierarchyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [clientsRes, detsRes, guardsRes] = await Promise.all([
    supabase.from("clients").select("*").order("name", { ascending: true }),
    supabase.from("detachments").select("id, client_id"),
    supabase.from("guards").select("*"),
  ]);

  const cards = buildCards(
    (clientsRes.data ?? []) as Client[],
    (detsRes.data ?? []) as Array<{ id: string; client_id: string }>,
    (guardsRes.data ?? []) as Guard[],
  );

  return <ClientCardsView initialCards={cards} />;
}
