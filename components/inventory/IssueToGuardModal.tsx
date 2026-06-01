"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { InventoryCategoryBadge } from "./badges";
import { Modal } from "@/components/ui/Modal";
import {
  CancelButton,
  Field,
  FormError,
  GoldButton,
  TextArea,
  TextInput,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { InventoryItem } from "@/types/database";

const todayIso = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export function IssueToGuardModal({
  guardId,
  guardName,
  onClose,
  onSaved,
}: {
  guardId: string;
  guardName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [heldItemIds, setHeldItemIds] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [issuedDate, setIssuedDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createSupabaseClient();
      // status=available items AND the set of currently-held item ids
      // (anything in an open ledger row), then exclude held in JS.
      const [availableRes, heldRes] = await Promise.all([
        supabase
          .from("inventory_items")
          .select("*")
          .eq("status", "available")
          .order("name", { ascending: true }),
        supabase
          .from("guard_inventory")
          .select("item_id")
          .is("returned_date", null),
      ]);
      if (!active) return;
      setItems((availableRes.data ?? []) as InventoryItem[]);
      setHeldItemIds(
        new Set(
          ((heldRes.data ?? []) as Array<{ item_id: string }>).map(
            (r) => r.item_id,
          ),
        ),
      );
      setLoadingItems(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const available = useMemo(
    () => items.filter((i) => !heldItemIds.has(i.id)),
    [items, heldItemIds],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter((i) =>
      `${i.name} ${i.serial_no ?? ""}`.toLowerCase().includes(q),
    );
  }, [available, search]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedItemId) {
      setErrorMessage("Pick an item to issue.");
      return;
    }
    if (!issuedDate) {
      setErrorMessage("Issued date is required.");
      return;
    }
    setSaving(true);
    setErrorMessage(null);

    const supabase = createSupabaseClient();
    const { error } = await supabase.from("guard_inventory").insert({
      guard_id: guardId,
      item_id: selectedItemId,
      issued_date: issuedDate,
      notes: notes.trim() ? notes.trim() : null,
    });

    if (error) {
      setErrorMessage(error.message);
      showToast(error.message, "error");
      setSaving(false);
      return;
    }
    showToast("Item issued", "success");
    onSaved();
  }

  return (
    <Modal title={`Issue item to ${guardName}`} onClose={onClose} maxWidth={520}>
      <form onSubmit={handleSubmit}>
        <Field
          label="Search available items"
          htmlFor="issue-g-search"
          helper="Only items with status “Available” and no open assignment appear here."
        >
          <TextInput
            id="issue-g-search"
            value={search}
            onChange={setSearch}
            placeholder="Name or serial number…"
            disabled={saving}
            autoFocus
          />
        </Field>

        <div
          style={{
            marginTop: -4,
            marginBottom: 16,
            maxHeight: 240,
            overflowY: "auto",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 8,
          }}
        >
          {loadingItems ? (
            <ListMessage message="Loading available items…" />
          ) : filtered.length === 0 ? (
            <ListMessage
              message={
                available.length === 0
                  ? "No available items to issue."
                  : "No items match your search."
              }
            />
          ) : (
            filtered.map((item, idx) => (
              <ItemOptionRow
                key={item.id}
                item={item}
                selected={selectedItemId === item.id}
                isLast={idx === filtered.length - 1}
                onSelect={() => setSelectedItemId(item.id)}
                disabled={saving}
              />
            ))
          )}
        </div>

        <Field label="Issued date" htmlFor="issue-g-date">
          <TextInput
            id="issue-g-date"
            type="date"
            value={issuedDate}
            onChange={setIssuedDate}
            disabled={saving}
          />
        </Field>

        <Field label="Notes" htmlFor="issue-g-notes">
          <TextArea
            id="issue-g-notes"
            value={notes}
            onChange={setNotes}
            placeholder="Optional notes for this assignment."
            disabled={saving}
          />
        </Field>

        <FormError message={errorMessage} />

        <div style={{ height: 24 }} />
        <GoldButton type="submit" disabled={saving || !selectedItemId}>
          {saving ? "Issuing…" : "Issue item"}
        </GoldButton>
        <div style={{ height: 12 }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CancelButton onClick={onClose} disabled={saving} />
        </div>
      </form>
    </Modal>
  );
}

const optionRowBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  cursor: "pointer",
  fontSize: 13,
  color: "#f5f5f7",
  transition: "background-color 150ms ease-out",
};

function ItemOptionRow({
  item,
  selected,
  isLast,
  onSelect,
  disabled,
}: {
  item: InventoryItem;
  selected: boolean;
  isLast: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const [hover, setHover] = useState(false);
  const bg = selected
    ? "rgba(201, 169, 97, 0.14)"
    : hover
      ? "rgba(255, 255, 255, 0.04)"
      : "transparent";
  return (
    <div
      role="button"
      aria-pressed={selected}
      onClick={() => !disabled && onSelect()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...optionRowBase,
        backgroundColor: bg,
        borderBottom: isLast ? "none" : "1px solid rgba(255, 255, 255, 0.04)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}
      >
        <span style={{ fontWeight: 500 }}>{item.name}</span>
        <InventoryCategoryBadge category={item.category} />
      </span>
      <span
        className="tabular"
        style={{
          fontSize: 11,
          color: "rgba(245, 245, 247, 0.5)",
          whiteSpace: "nowrap",
        }}
      >
        {item.serial_no ?? ""}
      </span>
    </div>
  );
}

function ListMessage({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "16px 12px",
        fontSize: 12,
        color: "rgba(245, 245, 247, 0.5)",
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}
