// Server-safe (no "use client", no hooks, no browser APIs): pure transform of
// clients + detachments + guards into the aggregate card data the hierarchy
// landing renders. Lives in lib/ so the server component can call it directly
// and the client component can reuse it on refetch.
import { countExpiring } from "@/lib/license";
import type { Client, Guard } from "@/types/database";

export type ClientCard = {
  id: string;
  name: string;
  industry: string | null;
  conglomerate: string | null;
  detachmentCount: number;
  guardCount: number;
  expiringCount: number;
};

export function buildCards(
  clients: Client[],
  detachments: Array<{ id: string; client_id: string }>,
  guards: Guard[],
): ClientCard[] {
  const detCount = new Map<string, number>();
  for (const d of detachments) {
    detCount.set(d.client_id, (detCount.get(d.client_id) ?? 0) + 1);
  }
  const guardsByClient = new Map<string, Guard[]>();
  for (const g of guards) {
    if (!g.client_id) continue;
    const arr = guardsByClient.get(g.client_id) ?? [];
    arr.push(g);
    guardsByClient.set(g.client_id, arr);
  }
  return clients
    .map((c) => {
      const cg = guardsByClient.get(c.id) ?? [];
      return {
        id: c.id,
        name: c.name,
        industry: c.industry,
        conglomerate: c.conglomerate,
        detachmentCount: detCount.get(c.id) ?? 0,
        guardCount: cg.length,
        expiringCount: countExpiring(cg),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
