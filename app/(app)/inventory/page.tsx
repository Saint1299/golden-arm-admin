import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  InventoryList,
  type InventoryListRow,
} from "@/components/inventory/InventoryList";
import { createClient } from "@/lib/supabase/server";
import type {
  InventoryItem,
  ItemCategory,
  ItemType,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Inventory Management · Golden Arm Admin",
};

type RawItem = InventoryItem & {
  item_type:
    | (ItemType & {
        category: ItemCategory | null;
      })
    | null;
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

  // One round trip joins each item with its type + category and embeds the
  // open guard_inventory row to derive current_holder. Item types and
  // categories also come back as a separate query for the filter dropdowns.
  const [itemsRes, catsRes, typesRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(
        "*, item_type:item_types(*, category:item_categories(*)), guard_inventory(issued_date, returned_date, guard:guards(id, full_name))",
      )
      .is("guard_inventory.returned_date", null)
      .order("asset_code", { ascending: true }),
    supabase
      .from("item_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
    supabase
      .from("item_types")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
  ]);

  const rows: InventoryListRow[] = ((itemsRes.data ?? []) as RawItem[]).map(
    (r) => {
      const open = r.guard_inventory?.[0];
      return {
        id: r.id,
        name: r.name,
        legacy_category: r.category,
        serial_no: r.serial_no,
        status: r.status,
        notes: r.notes,
        created_at: r.created_at,
        item_type_id: r.item_type_id,
        asset_code: r.asset_code,
        date_acquired: r.date_acquired,
        type_code: r.item_type?.code ?? null,
        type_name: r.item_type?.name ?? null,
        category_id: r.item_type?.category?.id ?? null,
        category_code: r.item_type?.category?.code ?? null,
        category_name: r.item_type?.category?.name ?? null,
        current_holder: open?.guard
          ? { id: open.guard.id, full_name: open.guard.full_name }
          : null,
      };
    },
  );

  return (
    <InventoryList
      initialRows={rows}
      categories={(catsRes.data ?? []) as ItemCategory[]}
      types={(typesRes.data ?? []) as ItemType[]}
    />
  );
}
