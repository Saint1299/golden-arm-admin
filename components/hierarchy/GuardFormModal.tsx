"use client";

import { useMemo, useState } from "react";
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
  GUARD_STATUS_LABEL,
  type Client,
  type Guard,
  type GuardStatus,
} from "@/types/database";

const STATUS_OPTIONS: Array<{ value: GuardStatus; label: string }> = (
  ["active", "reliever", "on_leave", "inactive"] as GuardStatus[]
).map((s) => ({ value: s, label: GUARD_STATUS_LABEL[s] }));

export function GuardFormModal({
  clientId: presetClientId,
  initialGuard,
  clients,
  onClose,
  onSaved,
}: {
  // null = the form must collect a client choice (no calling-page context).
  // string = the form locks the client to this id and just adds the guard
  // under it (used from /hierarchy/clients/[id]'s "Add guard for this client").
  clientId: string | null;
  initialGuard: Guard | null;
  clients: Client[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initialGuard);
  const { showToast } = useToast();

  const [clientId, setClientId] = useState<string>(
    initialGuard?.client_id ?? presetClientId ?? "",
  );
  const [fullName, setFullName] = useState(initialGuard?.full_name ?? "");
  const [employeeNo, setEmployeeNo] = useState(
    initialGuard?.employee_no ?? "",
  );
  const [sosiaLicense, setSosiaLicense] = useState(
    initialGuard?.sosia_license ?? "",
  );
  const [contactNo, setContactNo] = useState(initialGuard?.contact_no ?? "");
  const [dateDeployed, setDateDeployed] = useState(
    initialGuard?.date_deployed ?? "",
  );
  const [status, setStatus] = useState<GuardStatus>(
    initialGuard?.status ?? "active",
  );
  const [notes, setNotes] = useState(initialGuard?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientById = useMemo(() => {
    const m = new Map<string, Client>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage("Full name is required.");
      return;
    }
    if (!clientId) {
      setErrorMessage("Pick a client.");
      return;
    }
    setSaving(true);
    setErrorMessage(null);

    const payload = {
      client_id: clientId,
      org_node_id: initialGuard?.org_node_id ?? null,
      full_name: fullName.trim(),
      employee_no: employeeNo.trim() ? employeeNo.trim() : null,
      sosia_license: sosiaLicense.trim() ? sosiaLicense.trim() : null,
      contact_no: contactNo.trim() ? contactNo.trim() : null,
      date_deployed: dateDeployed ? dateDeployed : null,
      status,
      notes: notes.trim() ? notes.trim() : null,
    };

    const supabase = createSupabaseClient();
    const { error } = initialGuard
      ? await supabase.from("guards").update(payload).eq("id", initialGuard.id)
      : await supabase.from("guards").insert(payload);

    if (error) {
      setErrorMessage(error.message);
      showToast(error.message, "error");
      setSaving(false);
      return;
    }
    showToast(isEditing ? "Guard updated" : "Guard added", "success");
    onSaved();
  }

  const clientLocked = !isEditing && presetClientId !== null;
  const lockedClient = clientLocked ? clientById.get(presetClientId!) : null;

  const clientOptions = useMemo(
    () => clients.map((c) => ({ value: c.id, label: c.name })),
    [clients],
  );

  return (
    <Modal title={isEditing ? "Edit guard" : "Add guard"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {clientLocked ? (
          <Field label="Client">
            <ReadOnlyValue>{lockedClient?.name ?? "—"}</ReadOnlyValue>
          </Field>
        ) : (
          <Field label="Client" htmlFor="guard-client">
            <SelectInput
              id="guard-client"
              value={clientId}
              onChange={(v) => {
                setClientId(v);
                setErrorMessage(null);
              }}
              options={[
                { value: "", label: "Pick a client" },
                ...clientOptions,
              ]}
              disabled={saving || clients.length === 0}
            />
          </Field>
        )}

        <Field label="Full name" htmlFor="guard-name">
          <TextInput
            id="guard-name"
            value={fullName}
            onChange={setFullName}
            placeholder="e.g. Juan Dela Cruz"
            required
            disabled={saving}
            autoFocus={isEditing}
          />
        </Field>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Employee no." htmlFor="guard-employee-no">
              <TextInput
                id="guard-employee-no"
                value={employeeNo}
                onChange={setEmployeeNo}
                placeholder="e.g. GA-0142"
                disabled={saving}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="SOSIA license" htmlFor="guard-sosia">
              <TextInput
                id="guard-sosia"
                value={sosiaLicense}
                onChange={setSosiaLicense}
                placeholder="License no."
                disabled={saving}
              />
            </Field>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Contact no." htmlFor="guard-contact">
              <TextInput
                id="guard-contact"
                value={contactNo}
                onChange={setContactNo}
                type="tel"
                placeholder="e.g. 0917 000 0000"
                disabled={saving}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Date deployed" htmlFor="guard-date">
              <TextInput
                id="guard-date"
                value={dateDeployed}
                onChange={setDateDeployed}
                type="date"
                disabled={saving}
              />
            </Field>
          </div>
        </div>

        <Field label="Status" htmlFor="guard-status">
          <SelectInput
            id="guard-status"
            value={status}
            onChange={(v) => setStatus(v as GuardStatus)}
            options={STATUS_OPTIONS}
            disabled={saving}
          />
        </Field>

        <Field label="Notes" htmlFor="guard-notes">
          <TextArea
            id="guard-notes"
            value={notes}
            onChange={setNotes}
            placeholder="Internal notes, post assignment details, etc."
            disabled={saving}
          />
        </Field>

        <FormError message={errorMessage} />

        <div style={{ height: 24 }} />
        <GoldButton type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save guard" : "Add guard"}
        </GoldButton>
        <div style={{ height: 12 }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CancelButton onClick={onClose} disabled={saving} />
        </div>
      </form>
    </Modal>
  );
}

function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: 8,
        color: "rgba(245, 245, 247, 0.85)",
        fontSize: 14,
      }}
    >
      {children}
    </div>
  );
}
