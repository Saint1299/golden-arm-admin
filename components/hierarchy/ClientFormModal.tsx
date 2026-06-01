"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  CancelButton,
  Field,
  FormError,
  GoldButton,
  SelectInput,
  TextInput,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { CLIENT_TYPE_LABEL, type ClientType } from "@/types/database";
import type { Client } from "@/types/database";

const TYPE_OPTIONS: Array<{ value: ClientType; label: string }> = [
  { value: "single_post", label: CLIENT_TYPE_LABEL.single_post },
  { value: "pooled", label: CLIENT_TYPE_LABEL.pooled },
];

export function ClientFormModal({
  initialClient,
  onClose,
  onSaved,
}: {
  initialClient: Client | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initialClient);
  const [name, setName] = useState(initialClient?.name ?? "");
  const [type, setType] = useState<ClientType>(
    initialClient?.type ?? "single_post",
  );
  const [industry, setIndustry] = useState(initialClient?.industry ?? "");
  const [conglomerate, setConglomerate] = useState(
    initialClient?.conglomerate ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showToast } = useToast();

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
      type,
      industry: industry.trim() ? industry.trim() : null,
      conglomerate: conglomerate.trim() ? conglomerate.trim() : null,
    };

    const supabase = createSupabaseClient();
    const { error } = initialClient
      ? await supabase.from("clients").update(payload).eq("id", initialClient.id)
      : await supabase.from("clients").insert(payload);

    if (error) {
      setErrorMessage(error.message);
      showToast(error.message, "error");
      setSaving(false);
      return;
    }
    showToast(isEditing ? "Client updated" : "Client added", "success");
    onSaved();
  }

  return (
    <Modal title={isEditing ? "Edit client" : "Add client"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Name" htmlFor="client-name">
          <TextInput
            id="client-name"
            value={name}
            onChange={setName}
            placeholder="e.g. SM Megamall"
            required
            disabled={saving}
            autoFocus
          />
        </Field>

        <Field label="Type" htmlFor="client-type">
          <SelectInput
            id="client-type"
            value={type}
            onChange={(v) => setType(v as ClientType)}
            options={TYPE_OPTIONS}
            disabled={saving}
          />
        </Field>

        <Field
          label="Conglomerate"
          htmlFor="client-conglomerate"
          helper="Optional — parent group this client belongs to."
        >
          <TextInput
            id="client-conglomerate"
            value={conglomerate}
            onChange={setConglomerate}
            placeholder="e.g. SM Investments"
            disabled={saving}
          />
        </Field>

        <Field label="Industry" htmlFor="client-industry" helper="Optional.">
          <TextInput
            id="client-industry"
            value={industry}
            onChange={setIndustry}
            placeholder="e.g. Retail / Mall"
            disabled={saving}
          />
        </Field>

        <FormError message={errorMessage} />

        <div style={{ height: 24 }} />
        <GoldButton type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save client" : "Add client"}
        </GoldButton>
        <div style={{ height: 12 }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CancelButton onClick={onClose} disabled={saving} />
        </div>
      </form>
    </Modal>
  );
}
