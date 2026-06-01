"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { InventoryStatusBadge } from "./badges";
import { ItemFormModal } from "./ItemFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { SelectInput, TextInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  INVENTORY_CATEGORY_LABEL,
  INVENTORY_STATUS_LABEL,
  INVENTORY_STATUS_VALUES,
  type InventoryCategory,
  type InventoryItem,
  type InventoryStatus,
  type ItemCategory,
  type ItemType,
} from "@/types/database";

// Row shape returned by the server page (and the client refetch). Keeps
// nullable category/type fields for backward compat with legacy rows that
// predate the item_types table.
export type InventoryListRow = {
  id: string;
  name: string;
  legacy_category: InventoryCategory;
  serial_no: string | null;
  status: InventoryStatus;
  notes: string | null;
  created_at: string;
  item_type_id: string | null;
  asset_code: string | null;
  date_acquired: string | null;
  type_code: string | null;
  type_name: string | null;
  category_id: string | null;
  category_code: string | null;
  category_name: string | null;
  current_holder: { id: string; full_name: string } | null;
};

type RawItemRow = InventoryItem & {
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

const addButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(180deg, #D4B670 0%, #C9A961 100%)",
  color: "#080b12",
  border: "1px solid rgba(201, 169, 97, 0.4)",
  borderRadius: 8,
  padding: "10px 16px",
  fontWeight: 600,
  fontSize: 14,
  fontFamily: "inherit",
  letterSpacing: "-0.01em",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "rgba(245, 245, 247, 0.8)",
  borderRadius: 8,
  padding: "9px 14px",
  fontWeight: 500,
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer",
  textDecoration: "none",
};

const headerCellStyle: CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(245, 245, 247, 0.4)",
  padding: "12px 14px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  whiteSpace: "nowrap",
};

const bodyCellStyle: CSSProperties = {
  fontSize: 13,
  color: "rgba(245, 245, 247, 0.65)",
  padding: "12px 14px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
  whiteSpace: "nowrap",
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...INVENTORY_STATUS_VALUES.map((s) => ({
    value: s,
    label: INVENTORY_STATUS_LABEL[s],
  })),
];

type SortDir = "asc" | "desc";

export function InventoryList({
  initialRows,
  categories,
  types,
}: {
  initialRows: InventoryListRow[];
  categories: ItemCategory[];
  types: ItemType[];
}) {
  const [rows, setRows] = useState<InventoryListRow[]>(initialRows);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [modal, setModal] = useState<{
    open: boolean;
    editing: InventoryItem | null;
  }>({ open: false, editing: null });
  const { showToast } = useToast();

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("inventory_items")
      .select(
        "*, item_type:item_types(*, category:item_categories(*)), guard_inventory(issued_date, returned_date, guard:guards(id, full_name))",
      )
      .is("guard_inventory.returned_date", null)
      .order("asset_code", { ascending: true });
    const next: InventoryListRow[] = ((data ?? []) as RawItemRow[]).map(
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
    setRows(next);
  }, []);

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...categories.map((c) => ({
        value: c.id,
        label: `${c.code} — ${c.name}`,
      })),
    ],
    [categories],
  );

  const typesForCategoryFilter = useMemo(() => {
    if (categoryFilter === "all") return [];
    return types.filter((t) => t.category_id === categoryFilter);
  }, [types, categoryFilter]);

  const typeOptions = useMemo(
    () => [
      { value: "all", label: "All types" },
      ...typesForCategoryFilter.map((t) => ({
        value: t.id,
        label: `${t.code} — ${t.name}`,
      })),
    ],
    [typesForCategoryFilter],
  );

  function handleCategoryChange(v: string) {
    setCategoryFilter(v);
    setTypeFilter("all");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoryFilter !== "all" && r.category_id !== categoryFilter) {
        return false;
      }
      if (typeFilter !== "all" && r.item_type_id !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q) {
        const haystack = `${r.asset_code ?? ""} ${r.serial_no ?? ""} ${r.name}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, categoryFilter, typeFilter, statusFilter, search]);

  // Asset Code is the only sortable column for now (spec). Rows without an
  // asset_code sort to the bottom either way, since legacy items have one
  // less affordance — putting them at the end keeps the focused view tidy.
  const sorted = useMemo(() => {
    const withCode = filtered.filter((r) => r.asset_code);
    const withoutCode = filtered.filter((r) => !r.asset_code);
    withCode.sort((a, b) => {
      const cmp = (a.asset_code ?? "").localeCompare(b.asset_code ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    withoutCode.sort((a, b) => a.name.localeCompare(b.name));
    return [...withCode, ...withoutCode];
  }, [filtered, sortDir]);

  async function handleDelete(item: InventoryItem) {
    const ok = window.confirm(
      `Delete "${item.name}"? Items with any assignment history cannot be deleted.`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", item.id);
    if (error) {
      const msg = /foreign key|violates/i.test(error.message)
        ? "This item has assignment history and cannot be deleted. Retire it instead."
        : error.message;
      showToast(msg, "error");
      return;
    }
    showToast("Item deleted", "success");
    refetch();
  }

  const filtersActive =
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    search.trim() !== "";

  return (
    <div style={{ maxWidth: 1280 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#f5f5f7",
              margin: 0,
            }}
          >
            Inventory Management
          </h1>
          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              fontSize: 14,
              color: "rgba(245, 245, 247, 0.6)",
            }}
          >
            Equipment, uniforms, and assets — track who has what.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/inventory/types" style={secondaryButtonStyle}>
            Manage Types
          </Link>
          <button
            type="button"
            style={addButtonStyle}
            onClick={() => setModal({ open: true, editing: null })}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#080b12"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add item
          </button>
        </div>
      </div>

      <div style={{ height: 24 }} />

      {/* Filter row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(220px, 1fr) minmax(180px, 220px) minmax(180px, 220px) minmax(160px, 200px)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <FilterLabel htmlFor="inv-search">Search</FilterLabel>
          <TextInput
            id="inv-search"
            value={search}
            onChange={setSearch}
            placeholder="Asset code, serial, or name…"
          />
        </div>
        <div>
          <FilterLabel htmlFor="inv-category">Category</FilterLabel>
          <SelectInput
            id="inv-category"
            value={categoryFilter}
            onChange={handleCategoryChange}
            options={categoryOptions}
          />
        </div>
        <div>
          <FilterLabel htmlFor="inv-type">Item type</FilterLabel>
          <SelectInput
            id="inv-type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions}
            disabled={categoryFilter === "all"}
          />
        </div>
        <div>
          <FilterLabel htmlFor="inv-status">Status</FilterLabel>
          <SelectInput
            id="inv-status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
          />
        </div>
      </div>

      <GlassCard style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <Empty />
        ) : sorted.length === 0 ? (
          <FilteredEmpty showReset={filtersActive} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <SortableHeader
                    label="Asset code"
                    dir={sortDir}
                    onToggle={() =>
                      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                    }
                  />
                  <th style={headerCellStyle}>Category</th>
                  <th style={headerCellStyle}>Type</th>
                  <th style={headerCellStyle}>Name</th>
                  <th style={headerCellStyle}>Mfr. serial</th>
                  <th style={headerCellStyle}>Status</th>
                  <th style={headerCellStyle}>Current holder</th>
                  <th style={headerCellStyle}>Date acquired</th>
                  <th
                    style={{
                      ...headerCellStyle,
                      textAlign: "right",
                      width: 110,
                    }}
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, idx) => (
                  <ItemRow
                    key={row.id}
                    row={row}
                    striped={idx % 2 === 1}
                    onEdit={() =>
                      setModal({ open: true, editing: rowToItem(row) })
                    }
                    onDelete={() => handleDelete(rowToItem(row))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {modal.open ? (
        <ItemFormModal
          initialItem={modal.editing}
          onClose={() => setModal({ open: false, editing: null })}
          onSaved={() => {
            setModal({ open: false, editing: null });
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function rowToItem(row: InventoryListRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.legacy_category,
    serial_no: row.serial_no,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
    item_type_id: row.item_type_id,
    asset_code: row.asset_code,
    date_acquired: row.date_acquired,
  };
}

function SortableHeader({
  label,
  dir,
  onToggle,
}: {
  label: string;
  dir: SortDir;
  onToggle: () => void;
}) {
  return (
    <th style={headerCellStyle}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "transparent",
          border: "none",
          padding: 0,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(245, 245, 247, 0.6)",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        {label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{
            transform: dir === "asc" ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 150ms ease-out",
          }}
        >
          <polyline points="6 15 12 9 18 15" />
        </svg>
      </button>
    </th>
  );
}

function FilterLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        color: "rgba(245, 245, 247, 0.6)",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

function ItemRow({
  row,
  striped,
  onEdit,
  onDelete,
}: {
  row: InventoryListRow;
  striped: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [hover, setHover] = useState(false);

  // Category + type display falls back to the legacy enum label when the
  // row pre-dates item_type_id.
  const categoryDisplay =
    row.category_name ??
    INVENTORY_CATEGORY_LABEL[row.legacy_category] ??
    "—";
  const typeDisplay = row.type_name ?? "—";

  const baseBg = striped ? "rgba(255, 255, 255, 0.015)" : "transparent";
  const bg = hover ? "rgba(255, 255, 255, 0.035)" : baseBg;

  return (
    <tr
      onClick={() => router.push(`/inventory/items/${row.id}`)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        backgroundColor: bg,
        cursor: "pointer",
        transition: "background-color 150ms ease-out",
      }}
    >
      <td style={{ ...bodyCellStyle, fontWeight: 500 }}>
        {row.asset_code ? (
          <span
            className="tabular"
            style={{ color: "#d4b670", letterSpacing: "0.02em" }}
          >
            {row.asset_code}
          </span>
        ) : (
          <span style={{ color: "rgba(245, 245, 247, 0.35)" }}>—</span>
        )}
      </td>
      <td style={bodyCellStyle}>{categoryDisplay}</td>
      <td style={bodyCellStyle}>{typeDisplay}</td>
      <td style={{ ...bodyCellStyle, color: "#f5f5f7", fontWeight: 500 }}>
        {row.name}
      </td>
      <td style={bodyCellStyle} className="tabular">
        {row.serial_no ?? "—"}
      </td>
      <td style={bodyCellStyle}>
        <InventoryStatusBadge status={row.status} />
      </td>
      <td style={bodyCellStyle} onClick={(e) => e.stopPropagation()}>
        {row.current_holder ? (
          <Link
            href={`/hierarchy/guards/${row.current_holder.id}`}
            style={{ color: "#f5f5f7", textDecoration: "none" }}
          >
            {row.current_holder.full_name}
          </Link>
        ) : (
          "—"
        )}
      </td>
      <td style={bodyCellStyle} className="tabular">
        {row.date_acquired ?? "—"}
      </td>
      <td
        style={{ ...bodyCellStyle, textAlign: "right" }}
        onClick={(e) => e.stopPropagation()}
      >
        <RowAction label="Edit" onClick={onEdit} />
        <span style={{ display: "inline-block", width: 10 }} />
        <RowAction label="Delete" onClick={onDelete} danger />
      </td>
    </tr>
  );
}

function RowAction({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const color = danger
    ? hover
      ? "#ef4444"
      : "rgba(239, 68, 68, 0.7)"
    : hover
      ? "#f5f5f7"
      : "rgba(245, 245, 247, 0.5)";
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        color,
        transition: "color 150ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

function Empty() {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#f5f5f7",
          letterSpacing: "-0.01em",
          margin: 0,
        }}
      >
        No items yet
      </h3>
      <p
        style={{
          marginTop: 8,
          marginBottom: 0,
          fontSize: 13,
          color: "rgba(245, 245, 247, 0.6)",
          maxWidth: 360,
          marginInline: "auto",
        }}
      >
        Add your first inventory item to start tracking equipment and
        assignments.
      </p>
    </div>
  );
}

function FilteredEmpty({ showReset }: { showReset: boolean }) {
  return (
    <div
      style={{
        padding: "40px 24px",
        textAlign: "center",
        color: "rgba(245, 245, 247, 0.6)",
        fontSize: 13,
      }}
    >
      {showReset
        ? "No items match the current filters."
        : "No items match."}
    </div>
  );
}
