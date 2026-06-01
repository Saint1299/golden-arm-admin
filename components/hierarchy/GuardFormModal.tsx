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
import {
  GUARD_STATUS_LABEL,
  type Guard,
  type GuardStatus,
} from "@/types/database";

const STATUS_OPTIONS: Array<{ value: GuardStatus; label: string }> = (
  ["active", "reliever", "on_leave", "inactive"] as GuardStatus[]
).map((s) => ({ value: s, label: GUARD_STATUS_LABEL[s] }));

export function GuardFormModal({
  clientId,
  initialGuard,
  onClose,
  onSaved,
}: {
  clientId: string;
  initialGuard: Guard | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initialGuard);
  const [fullName, setFullName] = useState(initialGuard?.full_name ?? "");
  const [employeeNo, setEmployeeNo] = useState(initialGuard?.employee_no ?? "");
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
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage("Full name is required");
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

  return (
    <Modal title={isEditing ? "Edit guard" : "Add guard"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Full name" htmlFor="guard-name">
          <TextInput
            id="guard-name"
            value={fullName}
            onChange={setFullName}
            placeholder="e.g. Juan Dela Cruz"
            required
            disabled={saving}
            autoFocus
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
