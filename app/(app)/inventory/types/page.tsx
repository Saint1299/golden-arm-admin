import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CategoryTypesManager,
  type CategoryWithCounts,
  type ItemTypeWithCounts,
} from "@/components/inventory/types/CategoryTypesManager";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Categories & Types · Golden Arm Admin",
};

type RawCategoryRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  item_types: { count: number }[];
};

type RawTypeRow = {
  id: string;
  category_id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  inventory_items: { count: number }[];
};

export default async function InventoryTypesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch categories with type counts and types with item counts in
  // parallel. PostgREST embed-count is one round trip per relation.
  const [catRes, typeRes] = await Promise.all([
    supabase
      .from("item_categories")
      .select("*, item_types(count)")
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
    supabase
      .from("item_types")
      .select("*, inventory_items(count)")
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
  ]);

  const categories: CategoryWithCounts[] = (
    (catRes.data ?? []) as RawCategoryRow[]
  ).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    sort_order: c.sort_order,
    created_at: c.created_at,
    type_count: c.item_types?.[0]?.count ?? 0,
  }));

  const types: ItemTypeWithCounts[] = (
    (typeRes.data ?? []) as RawTypeRow[]
  ).map((t) => ({
    id: t.id,
    category_id: t.category_id,
    code: t.code,
    name: t.name,
    description: t.description,
    sort_order: t.sort_order,
    created_at: t.created_at,
    item_count: t.inventory_items?.[0]?.count ?? 0,
  }));

  return (
    <CategoryTypesManager
      initialCategories={categories}
      initialTypes={types}
    />
  );
}
