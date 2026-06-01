"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { InventoryCategoryBadge, InventoryStatusBadge } from "./badges";
import { ItemFormModal } from "./ItemFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { SelectInput, TextInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  INVENTORY_CATEGORY_LABEL,
  INVENTORY_CATEGORY_VALUES,
  INVENTORY_STATUS_LABEL,
  INVENTORY_STATUS_VALUES,
  type InventoryItem,
} from "@/types/database";

export type InventoryListRow = InventoryItem & {
  current_holder: { id: string; full_name: string } | null;
};

type RawItem = InventoryItem & {
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

const headerCellStyle: CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(245, 245, 247, 0.4)",
  padding: "12px 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
};

const bodyCellStyle: CSSProperties = {
  fontSize: 14,
  color: "rgba(245, 245, 247, 0.6)",
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
};

const CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All categories" },
  ...INVENTORY_CATEGORY_VALUES.map((c) => ({
    value: c,
    label: INVENTORY_CATEGORY_LABEL[c],
  })),
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...INVENTORY_STATUS_VALUES.map((s) => ({
    value: s,
    label: INVENTORY_STATUS_LABEL[s],
  })),
];

export function InventoryList({
  initialRows,
}: {
  initialRows: InventoryListRow[];
}) {
  const [rows, setRows] = useState<InventoryListRow[]>(initialRows);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
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
        "*, guard_inventory(issued_date, returned_date, guard:guards(id, full_name))",
      )
      .is("guard_inventory.returned_date", null)
      .order("name", { ascending: true });
    const next: InventoryListRow[] = ((data ?? []) as RawItem[]).map((r) => {
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
    setRows(next);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter)
        return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q) {
        const haystack = `${r.name} ${r.serial_no ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, categoryFilter, statusFilter, search]);

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
      // FK RESTRICT from guard_inventory.item_id surfaces here.
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
    categoryFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  return (
    <div style={{ maxWidth: 1180 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
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
            Inventory
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

      <div style={{ height: 24 }} />

      {/* Filter row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(220px, 1fr) minmax(180px, 240px) minmax(180px, 240px)",
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
            placeholder="Search name or serial number…"
          />
        </div>
        <div>
          <FilterLabel htmlFor="inv-category">Category</FilterLabel>
          <SelectInput
            id="inv-category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={CATEGORY_FILTER_OPTIONS}
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
        ) : filtered.length === 0 ? (
          <FilteredEmpty showReset={filtersActive} />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headerCellStyle}>Name</th>
                <th style={headerCellStyle}>Category</th>
                <th style={headerCellStyle}>Serial no.</th>
                <th style={headerCellStyle}>Status</th>
                <th style={headerCellStyle}>Current holder</th>
                <th
                  style={{ ...headerCellStyle, textAlign: "right", width: 120 }}
                />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <ItemRow
                  key={row.id}
                  row={row}
                  onEdit={() =>
                    setModal({ open: true, editing: rowToItem(row) })
                  }
                  onDelete={() => handleDelete(rowToItem(row))}
                />
              ))}
            </tbody>
          </table>
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
    category: row.category,
    serial_no: row.serial_no,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
  };
}

function FilterLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
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
  onEdit,
  onDelete,
}: {
  row: InventoryListRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [hover, setHover] = useState(false);
  return (
    <tr
      onClick={() => router.push(`/inventory/items/${row.id}`)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        backgroundColor: hover ? "rgba(255, 255, 255, 0.02)" : "transparent",
        cursor: "pointer",
        transition: "background-color 150ms ease-out",
      }}
    >
      <td style={{ ...bodyCellStyle, color: "#f5f5f7", fontWeight: 500 }}>
        {row.name}
      </td>
      <td style={bodyCellStyle}>
        <InventoryCategoryBadge category={row.category} />
      </td>
      <td style={bodyCellStyle} className="tabular">
        {row.serial_no ?? "—"}
      </td>
      <td style={bodyCellStyle}>
        <InventoryStatusBadge status={row.status} />
      </td>
      <td style={bodyCellStyle}>
        {row.current_holder ? row.current_holder.full_name : "—"}
      </td>
      <td
        style={{ ...bodyCellStyle, textAlign: "right" }}
        onClick={(e) => e.stopPropagation()}
      >
        <RowAction label="Edit" onClick={onEdit} />
        <span style={{ display: "inline-block", width: 12 }} />
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
