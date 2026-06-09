"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GuardAvatar } from "./GuardCard";
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
  deleteGuardPhoto,
  getGuardPhotoSignedUrl,
  uploadGuardPhoto,
} from "@/lib/guard-photo-storage";
import {
  GUARD_STATUS_LABEL,
  deriveFullName,
  type Client,
  type Detachment,
  type Guard,
  type GuardStatus,
} from "@/types/database";

const STATUS_OPTIONS: Array<{ value: GuardStatus; label: string }> = (
  ["active", "reliever", "on_leave", "inactive"] as GuardStatus[]
).map((s) => ({ value: s, label: GUARD_STATUS_LABEL[s] }));

const FORM_ID = "guard-form";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function GuardFormModal({
  clientId: presetClientId,
  detachmentId: presetDetachmentId = null,
  orgNodeId: presetOrgNodeId = null,
  lockAssignment = false,
  presetReliever = false,
  initialGuard,
  clients,
  onClose,
  onSaved,
}: {
  // Preset/locked client. null = the form collects a client choice.
  clientId: string | null;
  // Preset detachment (e.g. opened from a detachment page).
  detachmentId?: string | null;
  // Preset org-chart node — when adding a NEW guard directly onto a position
  // (from the org chart tile), the new guard is assigned to this node.
  orgNodeId?: string | null;
  // When true, client + detachment are fixed (opened from a detachment page).
  lockAssignment?: boolean;
  // Opens with the reliever checkbox pre-checked (the "Add reliever" button).
  presetReliever?: boolean;
  initialGuard: Guard | null;
  clients: Client[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initialGuard);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Employment / assignment
  const [clientId, setClientId] = useState<string>(
    initialGuard?.client_id ?? presetClientId ?? "",
  );
  const [detachmentId, setDetachmentId] = useState<string>(
    initialGuard?.detachment_id ?? presetDetachmentId ?? "",
  );
  const [detachments, setDetachments] = useState<Detachment[]>([]);
  const [idNumber, setIdNumber] = useState(initialGuard?.id_number ?? "");
  const [deploymentLocation, setDeploymentLocation] = useState(
    initialGuard?.deployment_location ?? "",
  );
  const [dateDeployed, setDateDeployed] = useState(
    initialGuard?.date_deployed ?? "",
  );
  const [isReliever, setIsReliever] = useState(
    initialGuard?.is_reliever ?? presetReliever,
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

  // Photo — 5 states: no file / staged / existing / replace / remove.
  const existingPhotoPath = initialGuard?.photo_url ?? null;
  const [existingSignedUrl, setExistingSignedUrl] = useState<string | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load detachments for the selected client so the detachment dropdown can
  // filter to that client. Re-runs whenever the client changes.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!clientId) {
        if (active) setDetachments([]);
        return;
      }
      const supabase = createSupabaseClient();
      const { data } = await supabase
        .from("detachments")
        .select("*")
        .eq("client_id", clientId)
        .order("name", { ascending: true });
      if (!active) return;
      setDetachments((data ?? []) as Detachment[]);
    })();
    return () => {
      active = false;
    };
  }, [clientId]);

  // Resolve the existing photo to a signed URL for preview.
  useEffect(() => {
    if (!existingPhotoPath) return;
    let active = true;
    (async () => {
      const supabase = createSupabaseClient();
      const url = await getGuardPhotoSignedUrl(supabase, existingPhotoPath);
      if (active) setExistingSignedUrl(url);
    })();
    return () => {
      active = false;
    };
  }, [existingPhotoPath]);

  // Object URL for the staged file preview — derived (no setState-in-effect),
  // with a cleanup effect to revoke it when the file changes/unmounts.
  const stagedPreview = useMemo(
    () => (stagedFile ? URL.createObjectURL(stagedFile) : null),
    [stagedFile],
  );
  useEffect(() => {
    return () => {
      if (stagedPreview) URL.revokeObjectURL(stagedPreview);
    };
  }, [stagedPreview]);

  const previewName = useMemo(
    () => deriveFullName(firstName, middleName, lastName, initialGuard?.full_name),
    [firstName, middleName, lastName, initialGuard?.full_name],
  );

  // Which photo to show in the avatar preview.
  const previewUrl =
    stagedPreview ?? (photoRemoved ? null : existingSignedUrl);

  function handlePickPhoto(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Photo must be an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrorMessage("Photo must be 5 MB or smaller.");
      return;
    }
    setErrorMessage(null);
    setStagedFile(file);
    setPhotoRemoved(false);
  }

  function clearStaged() {
    setStagedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeExisting() {
    clearStaged();
    setPhotoRemoved(true);
  }

  function undoRemove() {
    setPhotoRemoved(false);
  }

  const clientLocked = lockAssignment || (!isEditing && presetClientId !== null);
  const lockedClientName =
    clients.find((c) => c.id === clientId)?.name ?? "Unassigned";
  const lockedDetachmentName =
    detachments.find((d) => d.id === detachmentId)?.name ?? "None";

  const clientOptions = useMemo(
    () => [
      { value: "", label: "Unassigned" },
      ...clients.map((c) => ({ value: c.id, label: c.name })),
    ],
    [clients],
  );
  const detachmentOptions = useMemo(
    () => [
      { value: "", label: "No detachment" },
      ...detachments.map((d) => ({ value: d.id, label: d.name })),
    ],
    [detachments],
  );

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

    const supabase = createSupabaseClient();
    const guardId = initialGuard?.id ?? crypto.randomUUID();

    // Resolve the photo path. Upload happens before the row write; on a failed
    // write we clean up the freshly-uploaded orphan.
    let finalPhoto: string | null = existingPhotoPath;
    let uploadedNow: string | null = null;
    if (stagedFile) {
      const { path, error } = await uploadGuardPhoto(supabase, guardId, stagedFile);
      if (error || !path) {
        setErrorMessage(`Photo upload failed: ${error ?? "unknown error"}`);
        showToast("Photo upload failed", "error");
        setSaving(false);
        return;
      }
      uploadedNow = path;
      finalPhoto = path;
    } else if (photoRemoved) {
      finalPhoto = null;
    }

    const fullName = deriveFullName(
      firstName,
      middleName,
      lastName,
      initialGuard?.full_name,
    );

    // A chosen detachment implies its client; keep them in sync.
    const resolvedClientId = detachmentId
      ? detachments.find((d) => d.id === detachmentId)?.client_id ??
        (clientId || null)
      : clientId || null;

    const payload = {
      client_id: resolvedClientId,
      detachment_id: detachmentId ? detachmentId : null,
      // Editing preserves the guard's existing node; a new guard added from a
      // chart tile is assigned to the preset node.
      // Relievers never hold a tree position; clear org_node_id when reliever.
      org_node_id: isReliever
        ? null
        : initialGuard
          ? initialGuard.org_node_id ?? null
          : presetOrgNodeId ?? null,
      is_reliever: isReliever,
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
      photo_url: finalPhoto,
    };

    const { error } = initialGuard
      ? await supabase.from("guards").update(payload).eq("id", initialGuard.id)
      : await supabase.from("guards").insert({ ...payload, id: guardId });

    if (error) {
      // Clean up the orphaned upload so we don't leave a dangling object.
      if (uploadedNow) await deleteGuardPhoto(supabase, uploadedNow);
      const message =
        error.code === "23505"
          ? `ID number "${idNumber.trim()}" is already used by another guard.`
          : error.message;
      setErrorMessage(message);
      showToast(message, "error");
      setSaving(false);
      return;
    }

    // Best-effort cleanup of a replaced/removed previous photo.
    if (
      (uploadedNow || photoRemoved) &&
      existingPhotoPath &&
      existingPhotoPath !== finalPhoto
    ) {
      await deleteGuardPhoto(supabase, existingPhotoPath);
    }

    showToast(isEditing ? "Guard updated" : "Guard added", "success");
    onSaved();
  }

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
        <Section title="Photo">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <GuardAvatar
              name={previewName || "Guard"}
              photoUrl={previewUrl}
              size={72}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handlePickPhoto(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <PhotoButton
                label={previewUrl ? "Replace photo" : "Add photo"}
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              />
              {stagedFile ? (
                <PhotoButton
                  label="Cancel new photo"
                  onClick={clearStaged}
                  disabled={saving}
                />
              ) : existingSignedUrl && !photoRemoved ? (
                <PhotoButton
                  label="Remove photo"
                  onClick={removeExisting}
                  disabled={saving}
                  danger
                />
              ) : photoRemoved && existingPhotoPath ? (
                <PhotoButton
                  label="Undo remove"
                  onClick={undoRemove}
                  disabled={saving}
                />
              ) : null}
            </div>
          </div>
          {photoRemoved && existingPhotoPath && !stagedFile ? (
            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                fontSize: 11,
                color: "rgba(245, 158, 11, 0.85)",
              }}
            >
              Photo will be removed when you save.
            </p>
          ) : null}
        </Section>

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
          <Field label="Educational attainment" htmlFor="guard-education">
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
              <TextInput id="guard-sss" value={sss} onChange={setSss} placeholder="SSS no." disabled={saving} />
            </Field>
            <Field label="PhilHealth" htmlFor="guard-philhealth">
              <TextInput id="guard-philhealth" value={philhealth} onChange={setPhilhealth} placeholder="PhilHealth no." disabled={saving} />
            </Field>
          </Row>
          <Row>
            <Field label="Pag-IBIG" htmlFor="guard-pagibig">
              <TextInput id="guard-pagibig" value={pagibig} onChange={setPagibig} placeholder="Pag-IBIG no." disabled={saving} />
            </Field>
            <Field label="TIN" htmlFor="guard-tin">
              <TextInput id="guard-tin" value={tin} onChange={setTin} placeholder="TIN" disabled={saving} />
            </Field>
          </Row>
        </Section>

        <Section title="Assignment">
          <button
            type="button"
            onClick={() => setIsReliever((v) => !v)}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: "none",
              padding: 0,
              marginBottom: 16,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            <span
              aria-hidden
              style={{
                marginTop: 1,
                flexShrink: 0,
                width: 18,
                height: 18,
                borderRadius: 5,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isReliever
                  ? "rgba(201, 169, 97, 0.2)"
                  : "rgba(255, 255, 255, 0.04)",
                border: `1px solid ${isReliever ? "rgba(201, 169, 97, 0.6)" : "rgba(255, 255, 255, 0.18)"}`,
              }}
            >
              {isReliever ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d4b670" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : null}
            </span>
            <span>
              <span style={{ fontSize: 14, color: "#f5f5f7", fontWeight: 500 }}>
                Mark as reliever (standby, not in org chart)
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 2,
                  fontSize: 11,
                  color: "rgba(245, 245, 247, 0.45)",
                }}
              >
                Relievers live in the detachment’s Relievers strip and aren’t
                placed in the org tree.
              </span>
            </span>
          </button>

          {clientLocked ? (
            <Row>
              <Field label="Client">
                <ReadOnlyValue>{lockedClientName}</ReadOnlyValue>
              </Field>
              <Field label="Detachment">
                <ReadOnlyValue>
                  {presetDetachmentId || detachmentId
                    ? lockedDetachmentName
                    : "None"}
                </ReadOnlyValue>
              </Field>
            </Row>
          ) : (
            <Row>
              <Field
                label="Client (optional)"
                htmlFor="guard-client"
                helper="Leave Unassigned for guards not yet deployed."
              >
                <SelectInput
                  id="guard-client"
                  value={clientId}
                  onChange={(v) => {
                    setClientId(v);
                    setDetachmentId("");
                    setErrorMessage(null);
                  }}
                  options={clientOptions}
                  disabled={saving}
                />
              </Field>
              <Field
                label="Detachment (optional)"
                htmlFor="guard-detachment"
                helper={
                  clientId
                    ? "Filtered to the selected client."
                    : "Pick a client first."
                }
              >
                <SelectInput
                  id="guard-detachment"
                  value={detachmentId}
                  onChange={setDetachmentId}
                  options={detachmentOptions}
                  disabled={saving || !clientId || detachments.length === 0}
                />
              </Field>
            </Row>
          )}
          <Row>
            <Field label="ID number" htmlFor="guard-id-number">
              <TextInput id="guard-id-number" value={idNumber} onChange={setIdNumber} placeholder="e.g. GA-0142" disabled={saving} />
            </Field>
            <Field label="Deployment location" htmlFor="guard-deployment-loc">
              <TextInput id="guard-deployment-loc" value={deploymentLocation} onChange={setDeploymentLocation} placeholder="e.g. Main lobby" disabled={saving} />
            </Field>
          </Row>
          <Row>
            <Field label="Date deployed" htmlFor="guard-date">
              <TextInput id="guard-date" value={dateDeployed} onChange={setDateDeployed} type="date" disabled={saving} />
            </Field>
            <Field label="Status" htmlFor="guard-status">
              <SelectInput id="guard-status" value={status} onChange={(v) => setStatus(v as GuardStatus)} options={STATUS_OPTIONS} disabled={saving} />
            </Field>
          </Row>
        </Section>

        <Section title="License">
          <Row>
            <Field label="License category" htmlFor="guard-license-cat">
              <TextInput id="guard-license-cat" value={licenseCategory} onChange={setLicenseCategory} placeholder="e.g. SG" disabled={saving} />
            </Field>
            <Field label="License no." htmlFor="guard-license-no">
              <TextInput id="guard-license-no" value={licenseNo} onChange={setLicenseNo} placeholder="License no." disabled={saving} />
            </Field>
          </Row>
          <Field label="License expiry" htmlFor="guard-license-expiry">
            <TextInput id="guard-license-expiry" value={licenseExpiry} onChange={setLicenseExpiry} type="date" disabled={saving} />
          </Field>
        </Section>

        <Section title="Contact">
          <Row>
            <Field label="Contact no." htmlFor="guard-contact">
              <TextInput id="guard-contact" value={contactNo} onChange={setContactNo} type="tel" placeholder="e.g. 0917 000 0000" disabled={saving} />
            </Field>
            <Field label="Emergency contact no." htmlFor="guard-emergency-contact">
              <TextInput id="guard-emergency-contact" value={emergencyContactNo} onChange={setEmergencyContactNo} type="tel" placeholder="e.g. 0917 000 0000" disabled={saving} />
            </Field>
          </Row>
        </Section>

        <Section title="Notes" last>
          <Field label="Notes" htmlFor="guard-notes">
            <TextArea id="guard-notes" value={notes} onChange={setNotes} placeholder="Internal notes, post assignment details, etc." disabled={saving} />
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

function PhotoButton({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        border: `1px solid ${danger ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.12)"}`,
        color: danger ? "#ef4444" : "rgba(245, 245, 247, 0.8)",
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
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
