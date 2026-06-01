import type { createClient } from "@/lib/supabase/client";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

// Asset-code regex: {CATEGORY}-{TYPE}-{NNNN}. The first two groups are 1-4
// chars/digits each (validated on save by the form), the suffix is exactly
// 4 zero-padded digits. We only use the suffix during sequence parsing.
const ASSET_CODE_SUFFIX_RE = /-(\d{4})$/;

export function formatAssetCode(
  categoryCode: string,
  typeCode: string,
  seq: number,
): string {
  return `${categoryCode}-${typeCode}-${String(seq).padStart(4, "0")}`;
}

// Pull the highest existing sequence for a given item_type_id and return
// the NEXT one. Lexical DESC order is safe here because all codes are
// zero-padded to 4 digits — DE-01-0010 sorts after DE-01-0009. If the type
// has never been used, this returns 1.
export async function nextAssetCodeSequence(
  supabase: SupabaseBrowserClient,
  itemTypeId: string,
): Promise<number> {
  const { data } = await supabase
    .from("inventory_items")
    .select("asset_code")
    .eq("item_type_id", itemTypeId)
    .not("asset_code", "is", null)
    .order("asset_code", { ascending: false })
    .limit(1);
  const top = (data ?? [])[0]?.asset_code as string | undefined;
  if (!top) return 1;
  const m = top.match(ASSET_CODE_SUFFIX_RE);
  if (!m) return 1;
  return Number.parseInt(m[1], 10) + 1;
}

// Postgres' unique_violation. supabase-js surfaces it via error.code on
// inserts/updates. Used by the asset-code retry path.
export const UNIQUE_VIOLATION_PG_CODE = "23505";
