"use client";

import { useMemo, useState, type ReactNode } from "react";
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
  deriveFullName,
  type Client,
  type Guard,
  type GuardStatus,
} from "@/types/database";

const STATUS_OPTIONS: Array<{ value: GuardStatus; label: string }> = (
  ["active", "reliever", "on_leave", "inactive"] as GuardStatus[]
).map((s) => ({ value: s, label: GUARD_STATUS_LABEL[s] }));

const FORM_ID = "guard-form";

export function GuardFormModal({
  clientId: presetClientId,
  initialGuard,
  clients,
  onClose,
  onSaved,
}: {
  // null = the form must collect a client choice (no calling-page context),
  // but the choice is now optional (a guard can be left Unassigned).
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

  // Personal info
  const [firstName, setFirstName] = useState(initialGuard?.first_name ?? "");
  const [middleName, setMiddleName] = useState(initialGuard?.middle_name ?? "");
  const [lastName, setLastName] = useState(initialGuard?.last_name ?? "");
  const [birthdate, setBirthdate] = useState(initialGuard?.birthdate ?? "");
  const [birthPlace, setBirthPlace] = useState(initialGuard?.birth_place ?? "");
  const [address, setAddress] = useState(initialGuard?.address ?? "");
  const [educationalAttainment, setEducationalAttainment] = useState(
    initialGuard?.educational_attainment ?? "",
  );

  // Government IDs
  const [sss, setSss] = useState(initialGuard?.sss ?? "");
  const [philhealth, setPhilhealth] = useState(initialGuard?.philhealth ?? "");
  const [pagibig, setPagibig] = useState(initialGuard?.pagibig ?? "");
  const [tin, setTin] = useState(initialGuard?.tin ?? "");

  // Employment
  const [clientId, setClientId] = useState<string>(
    initialGuard?.client_id ?? presetClientId ?? "",
  );
  const [idNumber, setIdNumber] = useState(initialGuard?.id_number ?? "");
  const [deploymentLocation, setDeploymentLocation] = useState(
    initialGuard?.deployment_location ?? "",
  );
  const [dateDeployed, setDateDeployed] = useState(
    initialGuard?.date_deployed ?? "",
  );
  const [status, setStatus] = useState<GuardStatus>(
    initialGuard?.status ?? "active",
  );

  // License
  const [licenseCategory, setLicenseCategory] = useState(
    initialGuard?.license_category ?? "SG",
  );
  const [licenseNo, setLicenseNo] = useState(initialGuard?.license_no ?? "");
  const [licenseExpiry, setLicenseExpiry] = useState(
    initialGuard?.license_expiry ?? "",
  );

  // Contact
  const [contactNo, setContactNo] = useState(initialGuard?.contact_no ?? "");
  const [emergencyContactNo, setEmergencyContactNo] = useState(
    initialGuard?.emergency_contact_no ?? "",
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
    if (!firstName.trim()) {
      setErrorMessage("First name is required.");
      return;
    }
    if (!lastName.trim()) {
      setErrorMessage("Last name is required.");
      return;
    }
    setSaving(true);
    setErrorMessage(null);

    const fullName = deriveFullName(
      firstName,
      middleName,
      lastName,
      initialGuard?.full_name,
    );

    const payload = {
      client_id: clientId ? clientId : null,
      org_node_id: initialGuard?.org_node_id ?? null,
      full_name: fullName,
      first_name: firstName.trim(),
      middle_name: middleName.trim() ? middleName.trim() : null,
      last_name: lastName.trim(),
      birthdate: birthdate ? birthdate : null,
      birth_place: trimOrNull(birthPlace),
      address: trimOrNull(address),
      educational_attainment: trimOrNull(educationalAttainment),
      id_number: trimOrNull(idNumber),
      deployment_location: trimOrNull(deploymentLocation),
      license_category: trimOrNull(licenseCategory),
      license_no: trimOrNull(licenseNo),
      license_expiry: licenseExpiry ? licenseExpiry : null,
      contact_no: trimOrNull(contactNo),
      emergency_contact_no: trimOrNull(emergencyContactNo),
      sss: trimOrNull(sss),
      philhealth: trimOrNull(philhealth),
      pagibig: trimOrNull(pagibig),
      tin: trimOrNull(tin),
      date_deployed: dateDeployed ? dateDeployed : null,
      status,
      notes: trimOrNull(notes),
    };

    const supabase = createSupabaseClient();
    const { error } = initialGuard
      ? await supabase.from("guards").update(payload).eq("id", initialGuard.id)
      : await supabase.from("guards").insert(payload);

    if (error) {
      // 23505 = unique_violation. The only unique constraint surfaced to the
      // user here is id_number — turn the raw Postgres message into something
      // readable.
      const message =
        error.code === "23505"
          ? `ID number "${idNumber.trim()}" is already used by another guard.`
          : error.message;
      setErrorMessage(message);
      showToast(message, "error");
      setSaving(false);
      return;
    }
    showToast(isEditing ? "Guard updated" : "Guard added", "success");
    onSaved();
  }

  const clientLocked = !isEditing && presetClientId !== null;
  const lockedClient = clientLocked ? clientById.get(presetClientId!) : null;

  const clientOptions = useMemo(
    () => [
      { value: "", label: "Unassigned" },
      ...clients.map((c) => ({ value: c.id, label: c.name })),
    ],
    [clients],
  );

  return (
    <Modal
      title={isEditing ? "Edit guard" : "Add guard"}
      onClose={onClose}
      maxWidth={620}
      footer={
        <>
          <FormError message={errorMessage} />
          {errorMessage ? <div style={{ height: 12 }} /> : null}
          <GoldButton type="submit" form={FORM_ID} disabled={saving}>
            {saving ? "Saving…" : isEditing ? "Save guard" : "Add guard"}
          </GoldButton>
          <div style={{ height: 12 }} />
          <div style={{ display: "flex", justifyContent: "center" }}>
            <CancelButton onClick={onClose} disabled={saving} />
          </div>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit}>
        <Section title="Personal info">
          <Field label="First name" htmlFor="guard-first-name">
            <TextInput
              id="guard-first-name"
              value={firstName}
              onChange={setFirstName}
              placeholder="e.g. Juan"
              required
              disabled={saving}
              autoFocus
            />
          </Field>
          <Row>
            <Field label="Middle name (optional)" htmlFor="guard-middle-name">
              <TextInput
                id="guard-middle-name"
                value={middleName}
                onChange={setMiddleName}
                placeholder="e.g. Santos"
                disabled={saving}
              />
            </Field>
            <Field label="Last name" htmlFor="guard-last-name">
              <TextInput
                id="guard-last-name"
                value={lastName}
                onChange={setLastName}
                placeholder="e.g. Dela Cruz"
                required
                disabled={saving}
              />
            </Field>
          </Row>
          <Row>
            <Field label="Birthdate" htmlFor="guard-birthdate">
              <TextInput
                id="guard-birthdate"
                value={birthdate}
                onChange={setBirthdate}
                type="date"
                disabled={saving}
              />
            </Field>
            <Field label="Birth place" htmlFor="guard-birth-place">
              <TextInput
                id="guard-birth-place"
                value={birthPlace}
                onChange={setBirthPlace}
                placeholder="e.g. Quezon City"
                disabled={saving}
              />
            </Field>
          </Row>
          <Field label="Address" htmlFor="guard-address">
            <TextInput
              id="guard-address"
              value={address}
              onChange={setAddress}
              placeholder="Street, barangay, city"
              disabled={saving}
            />
          </Field>
          <Field
            label="Educational attainment"
            htmlFor="guard-education"
          >
            <TextInput
              id="guard-education"
              value={educationalAttainment}
              onChange={setEducationalAttainment}
              placeholder="e.g. High school graduate"
              disabled={saving}
            />
          </Field>
        </Section>

        <Section title="Government IDs">
          <Row>
            <Field label="SSS" htmlFor="guard-sss">
              <TextInput
                id="guard-sss"
                value={sss}
                onChange={setSss}
                placeholder="SSS no."
                disabled={saving}
              />
            </Field>
            <Field label="PhilHealth" htmlFor="guard-philhealth">
              <TextInput
                id="guard-philhealth"
                value={philhealth}
                onChange={setPhilhealth}
                placeholder="PhilHealth no."
                disabled={saving}
              />
            </Field>
          </Row>
          <Row>
            <Field label="Pag-IBIG" htmlFor="guard-pagibig">
              <TextInput
                id="guard-pagibig"
                value={pagibig}
                onChange={setPagibig}
                placeholder="Pag-IBIG no."
                disabled={saving}
              />
            </Field>
            <Field label="TIN" htmlFor="guard-tin">
              <TextInput
                id="guard-tin"
                value={tin}
                onChange={setTin}
                placeholder="TIN"
                disabled={saving}
              />
            </Field>
          </Row>
        </Section>

        <Section title="Employment">
          {clientLocked ? (
            <Field label="Client">
              <ReadOnlyValue>{lockedClient?.name ?? "—"}</ReadOnlyValue>
            </Field>
          ) : (
            <Field
              label="Client (optional)"
              htmlFor="guard-client"
              helper="Leave as Unassigned for guards not yet deployed to a client."
            >
              <SelectInput
                id="guard-client"
                value={clientId}
                onChange={(v) => {
                  setClientId(v);
                  setErrorMessage(null);
                }}
                options={clientOptions}
                disabled={saving}
              />
            </Field>
          )}
          <Row>
            <Field label="ID number" htmlFor="guard-id-number">
              <TextInput
                id="guard-id-number"
                value={idNumber}
                onChange={setIdNumber}
                placeholder="e.g. GA-0142"
                disabled={saving}
              />
            </Field>
            <Field label="Deployment location" htmlFor="guard-deployment-loc">
              <TextInput
                id="guard-deployment-loc"
                value={deploymentLocation}
                onChange={setDeploymentLocation}
                placeholder="e.g. Main lobby, Tower B"
                disabled={saving}
              />
            </Field>
          </Row>
          <Row>
            <Field label="Date deployed" htmlFor="guard-date">
              <TextInput
                id="guard-date"
                value={dateDeployed}
                onChange={setDateDeployed}
                type="date"
                disabled={saving}
              />
            </Field>
            <Field label="Status" htmlFor="guard-status">
              <SelectInput
                id="guard-status"
                value={status}
                onChange={(v) => setStatus(v as GuardStatus)}
                options={STATUS_OPTIONS}
                disabled={saving}
              />
            </Field>
          </Row>
        </Section>

        <Section title="License">
          <Row>
            <Field label="License category" htmlFor="guard-license-cat">
              <TextInput
                id="guard-license-cat"
                value={licenseCategory}
                onChange={setLicenseCategory}
                placeholder="e.g. SG"
                disabled={saving}
              />
            </Field>
            <Field label="License no." htmlFor="guard-license-no">
              <TextInput
                id="guard-license-no"
                value={licenseNo}
                onChange={setLicenseNo}
                placeholder="License no."
                disabled={saving}
              />
            </Field>
          </Row>
          <Field label="License expiry" htmlFor="guard-license-expiry">
            <TextInput
              id="guard-license-expiry"
              value={licenseExpiry}
              onChange={setLicenseExpiry}
              type="date"
              disabled={saving}
            />
          </Field>
        </Section>

        <Section title="Contact">
          <Row>
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
            <Field
              label="Emergency contact no."
              htmlFor="guard-emergency-contact"
            >
              <TextInput
                id="guard-emergency-contact"
                value={emergencyContactNo}
                onChange={setEmergencyContactNo}
                type="tel"
                placeholder="e.g. 0917 000 0000"
                disabled={saving}
              />
            </Field>
          </Row>
        </Section>

        <Section title="Notes" last>
          <Field label="Notes" htmlFor="guard-notes">
            <TextArea
              id="guard-notes"
              value={notes}
              onChange={setNotes}
              placeholder="Internal notes, post assignment details, etc."
              disabled={saving}
            />
          </Field>
        </Section>
      </form>
    </Modal>
  );
}

function trimOrNull(v: string): string | null {
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {Array.isArray(children) ? (
        children.map((child, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            {child}
          </div>
        ))
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div style={{ marginBottom: last ? 0 : 8 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#c9a961",
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
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
