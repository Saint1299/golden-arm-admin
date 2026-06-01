"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  CancelButton,
  Field,
  FormError,
  GoldButton,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  INVENTORY_CATEGORY_LABEL,
  INVENTORY_CATEGORY_VALUES,
  INVENTORY_STATUS_LABEL,
  INVENTORY_STATUS_VALUES,
  type InventoryCategory,
  type InventoryItem,
  type InventoryStatus,
} from "@/types/database";

const CATEGORY_OPTIONS = INVENTORY_CATEGORY_VALUES.map((c) => ({
  value: c,
  label: INVENTORY_CATEGORY_LABEL[c],
}));

const STATUS_OPTIONS = INVENTORY_STATUS_VALUES.map((s) => ({
  value: s,
  label: INVENTORY_STATUS_LABEL[s],
}));

export function ItemFormModal({
  initialItem,
  onClose,
  onSaved,
}: {
  initialItem: InventoryItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initialItem);
  const [name, setName] = useState(initialItem?.name ?? "");
  const [category, setCategory] = useState<InventoryCategory>(
    initialItem?.category ?? "other",
  );
  const [serialNo, setSerialNo] = useState(initialItem?.serial_no ?? "");
  const [status, setStatus] = useState<InventoryStatus>(
    initialItem?.status ?? "available",
  );
  const [notes, setNotes] = useState(initialItem?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Warn-only banner for serial_no edits on items that have any history.
  // Probed in an effect so the form opens immediately without a network wait.
  const [hasHistory, setHasHistory] = useState(false);
  const initialSerial = initialItem?.serial_no ?? "";
  const serialChanged = isEditing && serialNo !== initialSerial;
  const { showToast } = useToast();

  useEffect(() => {
    if (!initialItem) return;
    let active = true;
    (async () => {
      const supabase = createSupabaseClient();
      const { count } = await supabase
        .from("guard_inventory")
        .select("id", { count: "exact", head: true })
        .eq("item_id", initialItem.id);
      if (active) setHasHistory((count ?? 0) > 0);
    })();
    return () => {
      active = false;
    };
  }, [initialItem]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Name is required");
      return;
    }
    setSaving(true);
    setErrorMessage(null);

    const payload = {
      name: name.trim(),
      category,
      serial_no: serialNo.trim() ? serialNo.trim() : null,
      status,
      notes: notes.trim() ? notes.trim() : null,
    };

    const supabase = createSupabaseClient();
    const { error } = initialItem
      ? await supabase
          .from("inventory_items")
          .update(payload)
          .eq("id", initialItem.id)
      : await supabase.from("inventory_items").insert(payload);

    if (error) {
      setErrorMessage(error.message);
      showToast(error.message, "error");
      setSaving(false);
      return;
    }
    showToast(isEditing ? "Item updated" : "Item added", "success");
    onSaved();
  }

  return (
    <Modal title={isEditing ? "Edit item" : "Add item"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Name" htmlFor="item-name">
          <TextInput
            id="item-name"
            value={name}
            onChange={setName}
            placeholder="e.g. Glock 19"
            required
            disabled={saving}
            autoFocus
          />
        </Field>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Category" htmlFor="item-category">
              <SelectInput
                id="item-category"
                value={category}
                onChange={(v) => setCategory(v as InventoryCategory)}
                options={CATEGORY_OPTIONS}
                disabled={saving}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Status" htmlFor="item-status">
              <SelectInput
                id="item-status"
                value={status}
                onChange={(v) => setStatus(v as InventoryStatus)}
                options={STATUS_OPTIONS}
                disabled={saving}
              />
            </Field>
          </div>
        </div>

        <Field label="Serial no." htmlFor="item-serial">
          <TextInput
            id="item-serial"
            value={serialNo}
            onChange={setSerialNo}
            placeholder="Serial / asset tag"
            disabled={saving}
          />
        </Field>

        {hasHistory && serialChanged ? (
          <div
            role="status"
            style={{
              marginTop: -4,
              marginBottom: 16,
              fontSize: 12,
              color: "#f59e0b",
              backgroundColor: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            Heads up — this item has assignment history. Changing the serial
            number will also change it in every past ledger entry that
            references this row.
          </div>
        ) : null}

        <Field label="Notes" htmlFor="item-notes">
          <TextArea
            id="item-notes"
            value={notes}
            onChange={setNotes}
            placeholder="Specs, condition, maintenance reminders…"
            disabled={saving}
          />
        </Field>

        <FormError message={errorMessage} />

        <div style={{ height: 24 }} />
        <GoldButton type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save item" : "Add item"}
        </GoldButton>
        <div style={{ height: 12 }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CancelButton onClick={onClose} disabled={saving} />
        </div>
      </form>
    </Modal>
  );
}
