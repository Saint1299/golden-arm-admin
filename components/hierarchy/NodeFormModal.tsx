"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  CancelButton,
  Field,
  FormError,
  GoldButton,
  TextInput,
} from "@/components/ui/form";

export function NodeFormModal({
  title,
  initialLabel,
  submitLabel,
  saving,
  onSubmit,
  onClose,
}: {
  title: string;
  initialLabel: string;
  submitLabel: string;
  saving: boolean;
  onSubmit: (label: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!label.trim()) {
      setErrorMessage("Label is required");
      return;
    }
    setErrorMessage(null);
    onSubmit(label.trim());
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Position label" htmlFor="node-label">
          <TextInput
            id="node-label"
            value={label}
            onChange={setLabel}
            placeholder="e.g. Shift In-Charge"
            required
            disabled={saving}
            autoFocus
          />
        </Field>

        <FormError message={errorMessage} />

        <div style={{ height: 24 }} />
        <GoldButton type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </GoldButton>
        <div style={{ height: 12 }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CancelButton onClick={onClose} disabled={saving} />
        </div>
      </form>
    </Modal>
  );
}
