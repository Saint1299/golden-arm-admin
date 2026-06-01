"use client";

import { useState } from "react";
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
import type { ItemCategory, ItemType } from "@/types/database";

// Type codes: 2–4 alphanumeric chars/digits. Stored upper-case to keep asset
// codes predictable.
const CODE_RE = /^[A-Z0-9]{2,4}$/;

export function ItemTypeFormModal({
  category,
  initialType,
  onClose,
  onSaved,
}: {
  category: ItemCategory;
  initialType: ItemType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initialType);
  const [code, setCode] = useState(initialType?.code ?? "");
  const [name, setName] = useState(initialType?.name ?? "");
  const [description, setDescription] = useState(
    initialType?.description ?? "",
  );
  const [sortOrder, setSortOrder] = useState(
    String(initialType?.sort_order ?? 0),
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const codeNorm = code.trim().toUpperCase();
    if (!CODE_RE.test(codeNorm)) {
      setErrorMessage("Code must be 2–4 uppercase letters or digits.");
      return;
    }
    if (!name.trim()) {
      setErrorMessage("Name is required.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const parsed = Number.parseInt(sortOrder, 10);
    const payload = {
      category_id: category.id,
      code: codeNorm,
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      sort_order: Number.isFinite(parsed) ? parsed : 0,
    };

    const supabase = createSupabaseClient();
    const { error } = initialType
      ? await supabase
          .from("item_types")
          .update(payload)
          .eq("id", initialType.id)
      : await supabase.from("item_types").insert(payload);

    if (error) {
      const msg =
        error.code === "23505"
          ? `Type code "${codeNorm}" already exists under ${category.code}.`
          : error.message;
      setErrorMessage(msg);
      showToast(msg, "error");
      setSaving(false);
      return;
    }
    showToast(isEditing ? "Type updated" : "Type added", "success");
    onSaved();
  }

  return (
    <Modal
      title={
        isEditing ? `Edit type · ${category.code}` : `Add type · ${category.code}`
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <Field
          label="Code"
          htmlFor="type-code"
          helper={`2–4 uppercase letters or digits — unique within ${category.code}.`}
        >
          <TextInput
            id="type-code"
            value={code}
            onChange={(v) => setCode(v.toUpperCase())}
            placeholder="01"
            required
            disabled={saving}
            autoFocus
          />
        </Field>

        <Field label="Name" htmlFor="type-name">
          <TextInput
            id="type-name"
            value={name}
            onChange={setName}
            placeholder="e.g. ZK-D1065 Walkthrough Detector"
            required
            disabled={saving}
          />
        </Field>

        <Field label="Description" htmlFor="type-desc">
          <TextArea
            id="type-desc"
            value={description}
            onChange={setDescription}
            placeholder="Optional specs, model, vendor."
            disabled={saving}
          />
        </Field>

        <Field
          label="Sort order"
          htmlFor="type-sort"
          helper="Lower numbers appear first."
        >
          <TextInput
            id="type-sort"
            type="number"
            value={sortOrder}
            onChange={setSortOrder}
            disabled={saving}
          />
        </Field>

        <FormError message={errorMessage} />

        <div style={{ height: 24 }} />
        <GoldButton type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save type" : "Add type"}
        </GoldButton>
        <div style={{ height: 12 }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CancelButton onClick={onClose} disabled={saving} />
        </div>
      </form>
    </Modal>
  );
}
