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
import type { ItemCategory } from "@/types/database";

const CODE_RE = /^[A-Z0-9]{1,4}$/;

export function CategoryFormModal({
  initialCategory,
  onClose,
  onSaved,
}: {
  initialCategory: ItemCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initialCategory);
  const [code, setCode] = useState(initialCategory?.code ?? "");
  const [name, setName] = useState(initialCategory?.name ?? "");
  const [description, setDescription] = useState(
    initialCategory?.description ?? "",
  );
  const [sortOrder, setSortOrder] = useState(
    String(initialCategory?.sort_order ?? 0),
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const codeNorm = code.trim().toUpperCase();
    if (!CODE_RE.test(codeNorm)) {
      setErrorMessage("Code must be 1–4 uppercase letters or digits.");
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
      code: codeNorm,
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      sort_order: Number.isFinite(parsed) ? parsed : 0,
    };

    const supabase = createSupabaseClient();
    const { error } = initialCategory
      ? await supabase
          .from("item_categories")
          .update(payload)
          .eq("id", initialCategory.id)
      : await supabase.from("item_categories").insert(payload);

    if (error) {
      const msg =
        error.code === "23505"
          ? `Category code "${codeNorm}" already exists.`
          : error.message;
      setErrorMessage(msg);
      showToast(msg, "error");
      setSaving(false);
      return;
    }
    showToast(isEditing ? "Category updated" : "Category added", "success");
    onSaved();
  }

  return (
    <Modal title={isEditing ? "Edit category" : "Add category"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field
          label="Code"
          htmlFor="cat-code"
          helper="1–4 uppercase letters or digits — e.g. DE, FA, OT."
        >
          <TextInput
            id="cat-code"
            value={code}
            onChange={(v) => setCode(v.toUpperCase())}
            placeholder="DE"
            required
            disabled={saving}
            autoFocus
          />
        </Field>

        <Field label="Name" htmlFor="cat-name">
          <TextInput
            id="cat-name"
            value={name}
            onChange={setName}
            placeholder="e.g. Detector"
            required
            disabled={saving}
          />
        </Field>

        <Field label="Description" htmlFor="cat-desc">
          <TextArea
            id="cat-desc"
            value={description}
            onChange={setDescription}
            placeholder="Optional context for what fits in this category."
            disabled={saving}
          />
        </Field>

        <Field
          label="Sort order"
          htmlFor="cat-sort"
          helper="Lower numbers appear first."
        >
          <TextInput
            id="cat-sort"
            type="number"
            value={sortOrder}
            onChange={setSortOrder}
            disabled={saving}
          />
        </Field>

        <FormError message={errorMessage} />

        <div style={{ height: 24 }} />
        <GoldButton type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save category" : "Add category"}
        </GoldButton>
        <div style={{ height: 12 }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CancelButton onClick={onClose} disabled={saving} />
        </div>
      </form>
    </Modal>
  );
}
