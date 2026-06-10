import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DetachmentDetailView } from "@/components/hierarchy/DetachmentDetailView";
import { getGuardPhotoSignedUrlMap } from "@/lib/guard-photo-storage";
import { createClient } from "@/lib/supabase/server";
import type { Client, Detachment, Guard, OrgNode } from "@/types/database";

export const metadata: Metadata = {
  title: "Detachment · Golden Arm Admin",
};

export default async function DetachmentDetailRoute({
  params,
}: {
  params: Promise<{ id: string; did: string }>;
}) {
  const { id, did } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // All five queries key off the URL params (id / did), none depends on
  // another's result, so run them in parallel and validate afterward.
  const [detRes, clientRes, allClientsRes, guardsRes, nodesRes] =
    await Promise.all([
      supabase.from("detachments").select("*").eq("id", did).maybeSingle(),
      supabase.from("clients").select("*").eq("id", id).maybeSingle(),
      supabase.from("clients").select("*").order("name", { ascending: true }),
      supabase
        .from("guards")
        .select("*")
        .eq("detachment_id", did)
        .order("full_name", { ascending: true }),
      supabase
        .from("org_nodes")
        .select("*")
        .eq("detachment_id", did)
        .order("sort_order", { ascending: true }),
    ]);

  const detachment = detRes.data;
  // Guard against a detachment id that doesn't belong to the client in the URL.
  if (detRes.error || !detachment || (detachment as Detachment).client_id !== id) {
    notFound();
  }
  if (!clientRes.data) notFound();

  const guards = (guardsRes.data ?? []) as Guard[];

  // Batch-sign photo URLs once on the server to avoid an N+1 of client-side
  // createSignedUrl calls in the chart / cards.
  const pathToUrl = await getGuardPhotoSignedUrlMap(
    supabase,
    guards.map((g) => g.photo_url),
  );
  const photoUrlByGuardId: Record<string, string> = {};
  for (const g of guards) {
    if (g.photo_url && pathToUrl[g.photo_url]) {
      photoUrlByGuardId[g.id] = pathToUrl[g.photo_url];
    }
  }

  return (
    <DetachmentDetailView
      client={clientRes.data as Client}
      clients={(allClientsRes.data ?? []) as Client[]}
      detachment={detachment as Detachment}
      initialGuards={guards}
      initialNodes={(nodesRes.data ?? []) as OrgNode[]}
      photoUrlByGuardId={photoUrlByGuardId}
    />
  );
}
