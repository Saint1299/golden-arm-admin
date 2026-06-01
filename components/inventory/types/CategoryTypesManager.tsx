"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CategoryFormModal } from "./CategoryFormModal";
import { ItemTypeFormModal } from "./ItemTypeFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { ItemCategory, ItemType } from "@/types/database";

export type CategoryWithCounts = ItemCategory & { type_count: number };
export type ItemTypeWithCounts = ItemType & { item_count: number };

const addButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "linear-gradient(180deg, #D4B670 0%, #C9A961 100%)",
  color: "#080b12",
  border: "1px solid rgba(201, 169, 97, 0.4)",
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: 13,
  fontFamily: "inherit",
  letterSpacing: "-0.01em",
  cursor: "pointer",
};

type CatModal =
  | { mode: "add" }
  | { mode: "edit"; category: ItemCategory }
  | null;
type TypeModal =
  | { mode: "add"; category: ItemCategory }
  | { mode: "edit"; category: ItemCategory; type: ItemType }
  | null;

export function CategoryTypesManager({
  initialCategories,
  initialTypes,
}: {
  initialCategories: CategoryWithCounts[];
  initialTypes: ItemTypeWithCounts[];
}) {
  const [categories, setCategories] =
    useState<CategoryWithCounts[]>(initialCategories);
  const [types, setTypes] = useState<ItemTypeWithCounts[]>(initialTypes);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    initialCategories[0]?.id ?? null,
  );
  const [catModal, setCatModal] = useState<CatModal>(null);
  const [typeModal, setTypeModal] = useState<TypeModal>(null);
  const { showToast } = useToast();

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

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
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
    const nextCats = ((catRes.data ?? []) as RawCategoryRow[]).map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.description,
      sort_order: c.sort_order,
      created_at: c.created_at,
      type_count: c.item_types?.[0]?.count ?? 0,
    }));
    const nextTypes = ((typeRes.data ?? []) as RawTypeRow[]).map((t) => ({
      id: t.id,
      category_id: t.category_id,
      code: t.code,
      name: t.name,
      description: t.description,
      sort_order: t.sort_order,
      created_at: t.created_at,
      item_count: t.inventory_items?.[0]?.count ?? 0,
    }));
    setCategories(nextCats);
    setTypes(nextTypes);
    // Keep the current selection if it still exists; otherwise fall back to
    // the first available category.
    setSelectedCategoryId((prev) =>
      nextCats.some((c) => c.id === prev)
        ? prev
        : nextCats[0]?.id ?? null,
    );
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const typesForSelected = useMemo(
    () =>
      selectedCategoryId
        ? types.filter((t) => t.category_id === selectedCategoryId)
        : [],
    [types, selectedCategoryId],
  );

  async function handleDeleteCategory(category: CategoryWithCounts) {
    const ok = window.confirm(
      `Delete category "${category.code} — ${category.name}"? Categories with item types can’t be deleted until their types are removed.`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("item_categories")
      .delete()
      .eq("id", category.id);
    if (error) {
      const msg = /foreign key|violates/i.test(error.message)
        ? "Category has item types and can’t be deleted. Remove the types first."
        : error.message;
      showToast(msg, "error");
      return;
    }
    showToast("Category deleted", "success");
    refetch();
  }

  async function handleDeleteType(type: ItemTypeWithCounts) {
    const ok = window.confirm(
      `Delete type "${type.code} — ${type.name}"? Types with inventory items can’t be deleted until their items are removed.`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("item_types")
      .delete()
      .eq("id", type.id);
    if (error) {
      const msg = /foreign key|violates/i.test(error.message)
        ? "Type has inventory items and can’t be deleted. Remove the items first."
        : error.message;
      showToast(msg, "error");
      return;
    }
    showToast("Type deleted", "success");
    refetch();
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <Breadcrumb />

      <div
        style={{
          marginTop: 8,
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
            Categories & Types
          </h1>
          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              fontSize: 14,
              color: "rgba(245, 245, 247, 0.6)",
            }}
          >
            Manage the vocabulary used for asset codes. Each item type lives
            under a category; their codes combine to form the asset prefix.
          </p>
        </div>
      </div>

      <div style={{ height: 24 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 380px) 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* LEFT: categories */}
        <Pane>
          <PaneHeader
            title="Categories"
            actionLabel="Add category"
            onAction={() => setCatModal({ mode: "add" })}
          />
          <RowsContainer>
            {categories.length === 0 ? (
              <EmptyMessage message="No categories yet." />
            ) : (
              categories.map((c) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  selected={c.id === selectedCategoryId}
                  onSelect={() => setSelectedCategoryId(c.id)}
                  onEdit={() => setCatModal({ mode: "edit", category: c })}
                  onDelete={() => handleDeleteCategory(c)}
                />
              ))
            )}
          </RowsContainer>
        </Pane>

        {/* RIGHT: types for selected category */}
        <Pane>
          <PaneHeader
            title={
              selectedCategory
                ? `Types · ${selectedCategory.code} ${selectedCategory.name}`
                : "Types"
            }
            actionLabel="Add item type"
            actionDisabled={!selectedCategory}
            onAction={() =>
              selectedCategory &&
              setTypeModal({ mode: "add", category: selectedCategory })
            }
          />
          <RowsContainer>
            {!selectedCategory ? (
              <EmptyMessage message="Pick a category on the left to see its item types." />
            ) : typesForSelected.length === 0 ? (
              <EmptyMessage
                message={`No item types yet under ${selectedCategory.code}. Add one to start coding items.`}
              />
            ) : (
              typesForSelected.map((t) => (
                <TypeRow
                  key={t.id}
                  type={t}
                  categoryCode={selectedCategory.code}
                  onEdit={() =>
                    setTypeModal({
                      mode: "edit",
                      category: selectedCategory,
                      type: t,
                    })
                  }
                  onDelete={() => handleDeleteType(t)}
                />
              ))
            )}
          </RowsContainer>
        </Pane>
      </div>

      {catModal?.mode === "add" ? (
        <CategoryFormModal
          initialCategory={null}
          onClose={() => setCatModal(null)}
          onSaved={() => {
            setCatModal(null);
            refetch();
          }}
        />
      ) : null}
      {catModal?.mode === "edit" ? (
        <CategoryFormModal
          initialCategory={catModal.category}
          onClose={() => setCatModal(null)}
          onSaved={() => {
            setCatModal(null);
            refetch();
          }}
        />
      ) : null}
      {typeModal?.mode === "add" ? (
        <ItemTypeFormModal
          category={typeModal.category}
          initialType={null}
          onClose={() => setTypeModal(null)}
          onSaved={() => {
            setTypeModal(null);
            refetch();
          }}
        />
      ) : null}
      {typeModal?.mode === "edit" ? (
        <ItemTypeFormModal
          category={typeModal.category}
          initialType={typeModal.type}
          onClose={() => setTypeModal(null)}
          onSaved={() => {
            setTypeModal(null);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function Breadcrumb() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: "rgba(245, 245, 247, 0.45)",
      }}
    >
      <Link
        href="/inventory"
        style={{ color: "rgba(245, 245, 247, 0.6)", textDecoration: "none" }}
      >
        Inventory Management
      </Link>
      <span aria-hidden>/</span>
      <span style={{ color: "rgba(245, 245, 247, 0.7)" }}>
        Categories & Types
      </span>
    </div>
  );
}

function Pane({ children }: { children: ReactNode }) {
  return <GlassCard style={{ padding: 0 }}>{children}</GlassCard>;
}

function PaneHeader({
  title,
  actionLabel,
  actionDisabled,
  onAction,
}: {
  title: string;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "16px 18px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: "#f5f5f7",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        style={{
          ...addButtonStyle,
          cursor: actionDisabled ? "not-allowed" : "pointer",
          opacity: actionDisabled ? 0.5 : 1,
        }}
      >
        + {actionLabel}
      </button>
    </div>
  );
}

function RowsContainer({ children }: { children: ReactNode }) {
  return <div style={{ padding: "6px 6px 10px" }}>{children}</div>;
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "24px 18px",
        textAlign: "center",
        fontSize: 13,
        color: "rgba(245, 245, 247, 0.5)",
      }}
    >
      {message}
    </div>
  );
}

function CategoryRow({
  category,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  category: CategoryWithCounts;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  const bg = selected
    ? "rgba(201, 169, 97, 0.12)"
    : hover
      ? "rgba(255, 255, 255, 0.03)"
      : "transparent";
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        margin: "2px 4px",
        borderRadius: 8,
        cursor: "pointer",
        backgroundColor: bg,
        transition: "background-color 150ms ease-out",
      }}
    >
      {selected ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 2,
            backgroundColor: "#c9a961",
            borderRadius: "0 2px 2px 0",
          }}
        />
      ) : null}
      <CodeChip code={category.code} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: "#f5f5f7",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {category.name}
        </div>
        <div
          className="tabular"
          style={{
            fontSize: 11,
            color: "rgba(245, 245, 247, 0.45)",
            marginTop: 2,
          }}
        >
          {category.type_count}{" "}
          {category.type_count === 1 ? "type" : "types"}
        </div>
      </div>
      <RowActions
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

function TypeRow({
  type,
  categoryCode,
  onEdit,
  onDelete,
}: {
  type: ItemTypeWithCounts;
  categoryCode: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        margin: "2px 4px",
        borderRadius: 8,
        backgroundColor: hover ? "rgba(255, 255, 255, 0.03)" : "transparent",
        transition: "background-color 150ms ease-out",
      }}
    >
      <CodeChip code={`${categoryCode}-${type.code}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: "#f5f5f7",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={type.name}
        >
          {type.name}
        </div>
        <div
          className="tabular"
          style={{
            fontSize: 11,
            color: "rgba(245, 245, 247, 0.45)",
            marginTop: 2,
          }}
        >
          {type.item_count} {type.item_count === 1 ? "item" : "items"}
        </div>
      </div>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function CodeChip({ code }: { code: string }) {
  return (
    <span
      className="tabular"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3px 8px",
        backgroundColor: "rgba(201, 169, 97, 0.10)",
        border: "1px solid rgba(201, 169, 97, 0.30)",
        borderRadius: 6,
        color: "#d4b670",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        flexShrink: 0,
      }}
    >
      {code}
    </span>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ display: "inline-flex", gap: 10, flexShrink: 0 }}
    >
      <RowActionButton label="Edit" onClick={onEdit} />
      <RowActionButton label="Delete" onClick={onDelete} danger />
    </div>
  );
}

function RowActionButton({
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
