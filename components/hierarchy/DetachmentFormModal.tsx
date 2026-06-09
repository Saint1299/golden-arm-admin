"use client";

import { useState } from "react";
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
import type { Detachment } from "@/types/database";

const TYPE_OPTIONS = [
  { value: "false", label: "Multi-guard (org chart)" },
  { value: "true", label: "Single post (one guard)" },
];

export function DetachmentFormModal({
  clientId,
  initialDetachment,
  onClose,
  onSaved,
}: {
  clientId: string;
  initialDetachment: Detachment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initialDetachment);
  const { showToast } = useToast();
  const [name, setName] = useState(initialDetachment?.name ?? "");
  const [address, setAddress] = useState(initialDetachment?.address ?? "");
  const [isSinglePost, setIsSinglePost] = useState(
    initialDetachment?.is_single_post ? "true" : "false",
  );
  const [notes, setNotes] = useState(initialDetachment?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Name is required.");
      return;
    }
    setSaving(true);
    setErrorMessage(null);

    const payload = {
      client_id: clientId,
      name: name.trim(),
      address: address.trim() ? address.trim() : null,
      is_single_post: isSinglePost === "true",
      notes: notes.trim() ? notes.trim() : null,
    };

    const supabase = createSupabaseClient();
    const { error } = initialDetachment
      ? await supabase
          .from("detachments")
          .update(payload)
          .eq("id", initialDetachment.id)
      : await supabase.from("detachments").insert(payload);

    if (error) {
      const message =
        error.code === "23505"
          ? `This client already has a detachment named "${name.trim()}".`
          : error.message;
      setErrorMessage(message);
      showToast(message, "error");
      setSaving(false);
      return;
    }
    showToast(isEditing ? "Detachment updated" : "Detachment added", "success");
    onSaved();
  }

  return (
    <Modal
      title={isEditing ? "Edit detachment" : "Add detachment"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <Field label="Name" htmlFor="det-name">
          <TextInput
            id="det-name"
            value={name}
            onChange={setName}
            placeholder="e.g. Tower B Lobby"
            required
            disabled={saving}
            autoFocus
          />
        </Field>

        <Field
          label="Type"
          htmlFor="det-type"
          helper="Single post has one focused guard; multi-guard uses an org chart."
        >
          <SelectInput
            id="det-type"
            value={isSinglePost}
            onChange={setIsSinglePost}
            options={TYPE_OPTIONS}
            disabled={saving}
          />
        </Field>

        <Field label="Address" htmlFor="det-address" helper="Optional.">
          <TextInput
            id="det-address"
            value={address}
            onChange={setAddress}
            placeholder="Site address"
            disabled={saving}
          />
        </Field>

        <Field label="Notes" htmlFor="det-notes">
          <TextArea
            id="det-notes"
            value={notes}
            onChange={setNotes}
            placeholder="Internal notes about this detachment."
            disabled={saving}
          />
        </Field>

        <FormError message={errorMessage} />

        <div style={{ height: 24 }} />
        <GoldButton type="submit" disabled={saving}>
          {saving
            ? "Saving…"
            : isEditing
              ? "Save detachment"
              : "Add detachment"}
        </GoldButton>
        <div style={{ height: 12 }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CancelButton onClick={onClose} disabled={saving} />
        </div>
      </form>
    </Modal>
  );
}
