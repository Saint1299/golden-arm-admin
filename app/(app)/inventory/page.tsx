import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  InventoryList,
  type InventoryListRow,
} from "@/components/inventory/InventoryList";
import { createClient } from "@/lib/supabase/server";
import type { InventoryItem } from "@/types/database";

export const metadata: Metadata = {
  title: "Inventory · Golden Arm Admin",
};

type RawItem = InventoryItem & {
  guard_inventory: Array<{
    issued_date: string;
    returned_date: string | null;
    guard: { id: string; full_name: string } | null;
  }>;
};

export default async function InventoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Embed only the open ledger row per item — at most one — so we can derive
  // current_holder in a single round trip. Items with no open row come back
  // with guard_inventory: [].
  const { data } = await supabase
    .from("inventory_items")
    .select(
      "*, guard_inventory(issued_date, returned_date, guard:guards(id, full_name))",
    )
    .is("guard_inventory.returned_date", null)
    .order("name", { ascending: true });

  const rows: InventoryListRow[] = ((data ?? []) as RawItem[]).map((r) => {
    const open = r.guard_inventory?.[0];
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      serial_no: r.serial_no,
      status: r.status,
      notes: r.notes,
      created_at: r.created_at,
      current_holder: open?.guard
        ? { id: open.guard.id, full_name: open.guard.full_name }
        : null,
    };
  });

  return <InventoryList initialRows={rows} />;
}
