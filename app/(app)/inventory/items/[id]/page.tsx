import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  InventoryItemDetailView,
  type HistoryEntry,
} from "@/components/inventory/InventoryItemDetailView";
import { createClient } from "@/lib/supabase/server";
import type { InventoryItem } from "@/types/database";

export const metadata: Metadata = {
  title: "Item · Golden Arm Admin",
};

type RawHistoryRow = {
  id: string;
  guard_id: string;
  item_id: string;
  issued_date: string;
  returned_date: string | null;
  notes: string | null;
  created_at: string;
  guard: { id: string; full_name: string } | null;
};

export default async function ItemDetailRoute({
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

  const { data: item, error: itemErr } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (itemErr || !item) notFound();

  const { data: history } = await supabase
    .from("guard_inventory")
    .select("*, guard:guards(id, full_name)")
    .eq("item_id", id)
    .order("issued_date", { ascending: false })
    .order("created_at", { ascending: false });

  const historyEntries: HistoryEntry[] = ((history ?? []) as RawHistoryRow[]).map(
    (h) => ({
      id: h.id,
      guard_id: h.guard_id,
      guard_name: h.guard?.full_name ?? "Unknown",
      issued_date: h.issued_date,
      returned_date: h.returned_date,
      notes: h.notes,
    }),
  );

  return (
    <InventoryItemDetailView
      item={item as InventoryItem}
      initialHistory={historyEntries}
    />
  );
}
