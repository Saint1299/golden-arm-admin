"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  formatAssetCode,
  nextAssetCodeSequence,
  UNIQUE_VIOLATION_PG_CODE,
} from "@/lib/inventory";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  INVENTORY_STATUS_LABEL,
  INVENTORY_STATUS_VALUES,
  type InventoryItem,
  type InventoryStatus,
  type ItemCategory,
  type ItemType,
} from "@/types/database";

const STATUS_OPTIONS = INVENTORY_STATUS_VALUES.map((s) => ({
  value: s,
  label: INVENTORY_STATUS_LABEL[s],
}));

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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
  const { showToast } = useToast();

  // Vocabulary — loaded on mount. The add path needs both lists to render
  // the cascading selects; edit uses them to label the read-only chips.
  const [categories, setCategories] = useState<ItemCategory[] | null>(null);
  const [types, setTypes] = useState<ItemType[] | null>(null);

  const [categoryId, setCategoryId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");
  const [name, setName] = useState(initialItem?.name ?? "");
  const [serialNo, setSerialNo] = useState(initialItem?.serial_no ?? "");
  const [dateAcquired, setDateAcquired] = useState(
    initialItem?.date_acquired ?? (isEditing ? "" : todayIso()),
  );
  const [status, setStatus] = useState<InventoryStatus>(
    initialItem?.status ?? "available",
  );
  const [notes, setNotes] = useState(initialItem?.notes ?? "");

  // Track whether the user has manually touched the name field. When they
  // pick a type for the first time and Name is untouched, we auto-fill it
  // from the type's name. Once they edit Name themselves, we never auto-fill
  // again.
  const nameTouchedRef = useRef(isEditing);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Warn-only banner: this row has past ledger entries and the user is
  // editing its serial number.
  const [hasHistory, setHasHistory] = useState(false);
  const initialSerial = initialItem?.serial_no ?? "";
  const serialChanged = isEditing && serialNo !== initialSerial;

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createSupabaseClient();
      const [catRes, typeRes] = await Promise.all([
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
      if (!active) return;
      const cats = (catRes.data ?? []) as ItemCategory[];
      const ts = (typeRes.data ?? []) as ItemType[];
      setCategories(cats);
      setTypes(ts);

      // For edits, seed the cascade from the doc's existing type → its
      // category. Skip for legacy rows without an item_type_id.
      if (initialItem?.item_type_id) {
        const t = ts.find((x) => x.id === initialItem.item_type_id);
        if (t) {
          setCategoryId(t.category_id);
          setTypeId(t.id);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [initialItem]);

  // Probe assignment history once per opened modal (only edit mode).
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

  const typesForSelectedCategory = useMemo(() => {
    if (!types || !categoryId) return [];
    return types.filter((t) => t.category_id === categoryId);
  }, [types, categoryId]);

  const selectedCategory = useMemo(
    () => categories?.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const selectedType = useMemo(
    () => types?.find((t) => t.id === typeId) ?? null,
    [types, typeId],
  );

  // Asset-code preview for the add flow. We compute the next sequence
  // whenever a (category, type) pair is fully chosen. The value shown is
  // best-effort — the actual save re-derives it (and retries on a 23505).
  // setState lives inside the async closure so the effect's body never sets
  // state synchronously (satisfies react-hooks/set-state-in-effect).
  const [previewSeq, setPreviewSeq] = useState<number | null>(null);
  useEffect(() => {
    if (isEditing) return;
    let active = true;
    (async () => {
      if (!typeId) {
        if (active) setPreviewSeq(null);
        return;
      }
      const supabase = createSupabaseClient();
      const n = await nextAssetCodeSequence(supabase, typeId);
      if (active) setPreviewSeq(n);
    })();
    return () => {
      active = false;
    };
  }, [isEditing, typeId]);

  function handleCategoryChange(next: string) {
    setCategoryId(next);
    setTypeId("");
    setPreviewSeq(null);
  }

  function handleTypeChange(next: string) {
    setTypeId(next);
    // If the user hasn't manually edited Name yet, prefill it from the
    // type's name on selection. Empty type clears the autofill source but
    // leaves any value the user already chose in place.
    if (!nameTouchedRef.current && next && types) {
      const t = types.find((x) => x.id === next);
      if (t) setName(t.name);
    }
  }

  function handleNameChange(v: string) {
    nameTouchedRef.current = true;
    setName(v);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isEditing) {
      if (!selectedCategory) {
        setErrorMessage("Pick a category.");
        return;
      }
      if (!selectedType) {
        setErrorMessage("Pick an item type.");
        return;
      }
    }
    if (!name.trim()) {
      setErrorMessage("Name is required.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const supabase = createSupabaseClient();
    const basePayload = {
      name: name.trim(),
      serial_no: serialNo.trim() ? serialNo.trim() : null,
      status,
      date_acquired: dateAcquired || null,
      notes: notes.trim() ? notes.trim() : null,
    };

    if (initialItem) {
      // Edits never touch asset_code or item_type_id. Keeping the legacy
      // `category` enum out of the payload means it stays at whatever value
      // the row currently has (default "other" for new rows).
      const { error } = await supabase
        .from("inventory_items")
        .update(basePayload)
        .eq("id", initialItem.id);
      if (error) {
        setErrorMessage(error.message);
        showToast(error.message, "error");
        setSaving(false);
        return;
      }
      showToast("Item updated", "success");
      onSaved();
      return;
    }

    // Add path: compute asset code from the next sequence and retry once
    // if the UNIQUE partial index fires (a real race between two adders).
    if (!selectedCategory || !selectedType) return; // appeases TS
    let seq = await nextAssetCodeSequence(supabase, selectedType.id);
    for (let attempt = 0; attempt < 2; attempt++) {
      const assetCode = formatAssetCode(
        selectedCategory.code,
        selectedType.code,
        seq,
      );
      const { error } = await supabase.from("inventory_items").insert({
        ...basePayload,
        item_type_id: selectedType.id,
        asset_code: assetCode,
      });
      if (!error) {
        showToast(`Item added · ${assetCode}`, "success");
        onSaved();
        return;
      }
      if (error.code === UNIQUE_VIOLATION_PG_CODE && attempt === 0) {
        // Refetch the max and bump past whoever beat us to it.
        seq = await nextAssetCodeSequence(supabase, selectedType.id);
        continue;
      }
      setErrorMessage(error.message);
      showToast(error.message, "error");
      setSaving(false);
      return;
    }
    // Two unique violations in a row — surface to the user.
    setErrorMessage(
      "Couldn’t assign a unique asset code after retry. Please try again.",
    );
    showToast(
      "Asset code conflict — please try again.",
      "error",
    );
    setSaving(false);
  }

  const previewCode =
    !isEditing && selectedCategory && selectedType && previewSeq !== null
      ? formatAssetCode(selectedCategory.code, selectedType.code, previewSeq)
      : null;

  const categoryOptions = useMemo(
    () =>
      categories
        ? categories.map((c) => ({
            value: c.id,
            label: `${c.code} — ${c.name}`,
          }))
        : [],
    [categories],
  );

  const typeOptions = useMemo(
    () =>
      typesForSelectedCategory.map((t) => ({
        value: t.id,
        label: `${t.code} — ${t.name}`,
      })),
    [typesForSelectedCategory],
  );

  const loadingVocab = categories === null || types === null;

  return (
    <Modal title={isEditing ? "Edit item" : "Add item"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {/* Asset code chip — read-only display in both modes. Add shows a
            preview once cascade is complete; edit shows the locked code. */}
        {isEditing && initialItem?.asset_code ? (
          <Field label="Asset code">
            <AssetCodeChip code={initialItem.asset_code} />
          </Field>
        ) : null}
        {!isEditing ? (
          <Field
            label="Asset code"
            helper="Generated on save once a category and item type are chosen."
          >
            {previewCode ? (
              <AssetCodeChip code={`Will be assigned: ${previewCode}`} />
            ) : (
              <AssetCodeChip code="—" muted />
            )}
          </Field>
        ) : null}

        {/* Cascade selects */}
        {!isEditing ? (
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="Category" htmlFor="item-category">
                <SelectInput
                  id="item-category"
                  value={categoryId}
                  onChange={handleCategoryChange}
                  options={[
                    { value: "", label: loadingVocab ? "Loading…" : "Pick a category" },
                    ...categoryOptions,
                  ]}
                  disabled={saving || loadingVocab}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Item type" htmlFor="item-type">
                <SelectInput
                  id="item-type"
                  value={typeId}
                  onChange={handleTypeChange}
                  options={[
                    {
                      value: "",
                      label: !categoryId
                        ? "Pick a category first"
                        : typeOptions.length === 0
                          ? "No types under this category yet"
                          : "Pick a type",
                    },
                    ...typeOptions,
                  ]}
                  disabled={saving || !categoryId || typeOptions.length === 0}
                />
              </Field>
            </div>
          </div>
        ) : null}

        <Field
          label="Name"
          htmlFor="item-name"
          helper={
            !isEditing
              ? "Defaults to the item type's name — override for a location-specific label."
              : undefined
          }
        >
          <TextInput
            id="item-name"
            value={name}
            onChange={handleNameChange}
            placeholder="e.g. Lobby Walkthrough"
            required
            disabled={saving}
            autoFocus={isEditing}
          />
        </Field>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Manufacturer serial" htmlFor="item-serial">
              <TextInput
                id="item-serial"
                value={serialNo}
                onChange={setSerialNo}
                placeholder="From the vendor / firearm LTOPF"
                disabled={saving}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Date acquired" htmlFor="item-date">
              <TextInput
                id="item-date"
                type="date"
                value={dateAcquired}
                onChange={setDateAcquired}
                disabled={saving}
              />
            </Field>
          </div>
        </div>

        <Field label="Status" htmlFor="item-status">
          <SelectInput
            id="item-status"
            value={status}
            onChange={(v) => setStatus(v as InventoryStatus)}
            options={STATUS_OPTIONS}
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
              color: "#fbbf24",
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

function AssetCodeChip({
  code,
  muted,
}: {
  code: string;
  muted?: boolean;
}) {
  return (
    <span
      className="tabular"
      style={{
        display: "inline-block",
        padding: "8px 12px",
        backgroundColor: muted
          ? "rgba(255, 255, 255, 0.03)"
          : "rgba(201, 169, 97, 0.10)",
        border: `1px solid ${muted ? "rgba(255, 255, 255, 0.08)" : "rgba(201, 169, 97, 0.30)"}`,
        borderRadius: 8,
        color: muted ? "rgba(245, 245, 247, 0.45)" : "#d4b670",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      {code}
    </span>
  );
}
