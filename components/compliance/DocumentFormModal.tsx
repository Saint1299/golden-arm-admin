"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
  deleteComplianceFile,
  displayNameFromFileUrl,
  isHttpUrl,
  openComplianceFile,
  uploadComplianceFile,
} from "@/lib/compliance-storage";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  DOCUMENT_SCOPE_LABEL,
  DOC_TYPE_SUGGESTIONS,
  ISSUING_AGENCY_SUGGESTIONS,
  type ApiDocument,
  type DocumentScope,
} from "@/types/database";

// Canonical display order for the scope dropdown. Company comes first so
// that when /compliance passes ['client','company'] the dropdown still
// reads Company → Client (and Company is the default on a fresh add).
const SCOPE_DISPLAY_ORDER: DocumentScope[] = ["company", "client", "guard"];

const DOC_FORM_ID = "document-form";
const DOC_TYPE_DATALIST_ID = "document-type-suggestions";
const ISSUING_AGENCY_DATALIST_ID = "document-issuing-agency-suggestions";

type GuardOption = {
  id: string;
  full_name: string;
  employee_no: string | null;
};

export function DocumentFormModal({
  initialDoc,
  allowedScopes,
  presetGuardId,
  presetGuardName,
  presetClientName,
  onClose,
  onSaved,
}: {
  initialDoc: ApiDocument | null;
  // Drives the scope control: a dropdown when length > 1, a read-only chip
  // when length === 1. Required + non-empty.
  allowedScopes: DocumentScope[];
  // Subject locks — independent of scope. When set, the subject input is
  // replaced by a read-only chip. Edits intentionally don't pass these so
  // the user can re-target the doc within the locked scope.
  presetGuardId?: string;
  presetGuardName?: string;
  // Client scope is free-text (client_name_text). When presetClientName is
  // provided (the client detail page locks docs to that client) the name
  // field is read-only and pre-filled to keep the name-match intact.
  presetClientName?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initialDoc);

  // Sort the caller's allowedScopes through the canonical display order so
  // the dropdown always reads Company → Client → Guard regardless of how
  // they were passed in.
  const displayScopes = useMemo<DocumentScope[]>(
    () => SCOPE_DISPLAY_ORDER.filter((s) => allowedScopes.includes(s)),
    [allowedScopes],
  );
  const scopeLocked = displayScopes.length === 1;

  // Initial scope: the doc's current scope if it's allowed (edit), otherwise
  // the first of the canonical-order list — which means Company wins when
  // both company + client are allowed on a fresh add.
  const initialScope: DocumentScope = (() => {
    const fromDoc = initialDoc?.scope;
    if (fromDoc && displayScopes.includes(fromDoc)) return fromDoc;
    return displayScopes[0] ?? "company";
  })();
  const [scope, setScope] = useState<DocumentScope>(initialScope);
  const [guardId, setGuardId] = useState<string | null>(
    initialDoc?.guard_id ?? presetGuardId ?? null,
  );
  // Locked to presetClientName when provided (client detail page); otherwise
  // free text seeded from the existing doc.
  const [clientNameText, setClientNameText] = useState(
    initialDoc?.client_name_text ?? presetClientName ?? "",
  );
  const [issuingAgency, setIssuingAgency] = useState(
    initialDoc?.issuing_agency ?? "",
  );
  const [docType, setDocType] = useState(initialDoc?.doc_type ?? "");
  const [docNumber, setDocNumber] = useState(initialDoc?.doc_number ?? "");
  const [issueDate, setIssueDate] = useState(initialDoc?.issue_date ?? "");
  const [expiryDate, setExpiryDate] = useState(initialDoc?.expiry_date ?? "");
  const [notes, setNotes] = useState(initialDoc?.notes ?? "");

  // File state — three exclusive signals:
  //   existingFileUrl from initialDoc (storage path OR legacy http url)
  //   stagedFile      a new File chosen — uploads on save
  //   markedForRemoval edit-mode Remove was clicked — file_url goes to null
  const existingFileUrl = initialDoc?.file_url ?? null;
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [markedForRemoval, setMarkedForRemoval] = useState(false);

  function selectFile(f: File | null) {
    setStagedFile(f);
    if (f) setMarkedForRemoval(false);
  }
  function markForRemoval(m: boolean) {
    setMarkedForRemoval(m);
    if (m) setStagedFile(null);
  }

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showToast } = useToast();

  // The guard list is loaded only when the guard picker is actually shown.
  // Client scope is free text now, so it needs no fetch.
  const [guards, setGuards] = useState<GuardOption[] | null>(null);
  const [guardSearch, setGuardSearch] = useState("");

  const needGuardPicker = displayScopes.includes("guard") && !presetGuardId;

  useEffect(() => {
    if (!needGuardPicker) return;
    let active = true;
    (async () => {
      const supabase = createSupabaseClient();
      const guardsRes = await supabase
        .from("guards")
        .select("id, full_name, employee_no")
        .eq("status", "active")
        .order("full_name", { ascending: true });
      if (!active) return;
      setGuards((guardsRes.data ?? []) as GuardOption[]);
    })();
    return () => {
      active = false;
    };
  }, [needGuardPicker]);

  function handleScopeChange(next: DocumentScope) {
    setScope(next);
    if (next !== "guard") setGuardId(null);
    if (next !== "client") setClientNameText("");
    setErrorMessage(null);
  }

  const filteredGuards = useMemo(() => {
    if (!guards) return [];
    const q = guardSearch.trim().toLowerCase();
    if (!q) return guards;
    return guards.filter((g) =>
      `${g.full_name} ${g.employee_no ?? ""}`.toLowerCase().includes(q),
    );
  }, [guards, guardSearch]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!docType.trim()) {
      setErrorMessage("Document type is required.");
      return;
    }
    if (scope === "guard" && !guardId) {
      setErrorMessage("Pick a guard for guard-scoped documents.");
      return;
    }
    if (scope === "client" && !clientNameText.trim()) {
      setErrorMessage("Client name is required for client-scoped documents.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const supabase = createSupabaseClient();

    // 1. Resolve the file_url to write into the documents row. This may
    //    involve uploading a new file and/or deleting the old one. Storage
    //    ops run BEFORE the DB write so we never have a doc row that
    //    references a non-existent storage object.
    let resolvedFileUrl: string | null = existingFileUrl;

    if (stagedFile) {
      const upload = await uploadComplianceFile(supabase, scope, stagedFile);
      if (upload.error || !upload.path) {
        setErrorMessage(upload.error ?? "Upload failed");
        showToast(upload.error ?? "Upload failed", "error");
        setSaving(false);
        return;
      }
      resolvedFileUrl = upload.path;
      // Best-effort: clean up the previous storage object so the bucket
      // doesn't accumulate orphans. Skip http URLs (they're not ours).
      if (
        existingFileUrl &&
        !isHttpUrl(existingFileUrl) &&
        existingFileUrl !== upload.path
      ) {
        const del = await deleteComplianceFile(supabase, existingFileUrl);
        if (del.error) {
          showToast(
            `New file saved, but couldn’t remove the old one (${del.error})`,
            "info",
          );
        }
      }
    } else if (markedForRemoval) {
      resolvedFileUrl = null;
      if (existingFileUrl && !isHttpUrl(existingFileUrl)) {
        const del = await deleteComplianceFile(supabase, existingFileUrl);
        if (del.error) {
          showToast(
            `Link cleared, but couldn’t delete file from storage (${del.error})`,
            "info",
          );
        }
      }
    }

    const payload = {
      scope,
      guard_id: scope === "guard" ? guardId : null,
      client_name_text: scope === "client" ? clientNameText.trim() : null,
      issuing_agency: issuingAgency.trim() ? issuingAgency.trim() : null,
      doc_type: docType.trim(),
      doc_number: docNumber.trim() ? docNumber.trim() : null,
      issue_date: issueDate || null,
      expiry_date: expiryDate || null,
      file_url: resolvedFileUrl,
      notes: notes.trim() ? notes.trim() : null,
    };

    const { error } = initialDoc
      ? await supabase.from("documents").update(payload).eq("id", initialDoc.id)
      : await supabase.from("documents").insert(payload);

    if (error) {
      setErrorMessage(error.message);
      showToast(error.message, "error");
      setSaving(false);
      return;
    }
    showToast(isEditing ? "Document updated" : "Document added", "success");
    onSaved();
  }

  const title = isEditing ? "Edit document" : "Add document";

  // The submit button lives in the Modal's footer (so it stays pinned on
  // short viewports) — link it back to the form via the form="..." HTML
  // attribute.
  const footer = (
    <>
      <FormError message={errorMessage} />
      {errorMessage ? <div style={{ height: 12 }} /> : null}
      <GoldButton type="submit" form={DOC_FORM_ID} disabled={saving}>
        {saving ? "Saving…" : isEditing ? "Save document" : "Add document"}
      </GoldButton>
      <div style={{ height: 8 }} />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <CancelButton onClick={onClose} disabled={saving} />
      </div>
    </>
  );

  return (
    <Modal title={title} onClose={onClose} maxWidth={560} footer={footer}>
      <form id={DOC_FORM_ID} onSubmit={handleSubmit}>
        {/* Scope */}
        {scopeLocked ? (
          <Field label="Scope">
            <ReadOnlyValue>{DOCUMENT_SCOPE_LABEL[scope]}</ReadOnlyValue>
          </Field>
        ) : (
          <Field label="Scope" htmlFor="doc-scope">
            <SelectInput
              id="doc-scope"
              value={scope}
              onChange={(v) => handleScopeChange(v as DocumentScope)}
              options={displayScopes.map((s) => ({
                value: s,
                label: DOCUMENT_SCOPE_LABEL[s],
              }))}
              disabled={saving}
            />
          </Field>
        )}

        {/* Subject picker — locked when preset*Id is provided. */}
        {scope === "guard" ? (
          presetGuardId ? (
            <Field label="Guard">
              <ReadOnlyValue>{presetGuardName ?? "—"}</ReadOnlyValue>
            </Field>
          ) : (
            <>
              <Field label="Search guards" htmlFor="doc-guard-search">
                <TextInput
                  id="doc-guard-search"
                  value={guardSearch}
                  onChange={setGuardSearch}
                  placeholder="Name or employee no.…"
                  disabled={saving}
                />
              </Field>
              <GuardPicker
                guards={filteredGuards}
                loading={guards === null}
                allLoaded={guards}
                selectedId={guardId}
                disabled={saving}
                onSelect={(id) => setGuardId(id)}
              />
            </>
          )
        ) : null}

        {scope === "client" ? (
          presetClientName ? (
            <Field label="Client name">
              <ReadOnlyValue>{presetClientName}</ReadOnlyValue>
            </Field>
          ) : (
            <Field label="Client name" htmlFor="doc-client-name">
              <TextInput
                id="doc-client-name"
                value={clientNameText}
                onChange={setClientNameText}
                placeholder="e.g. Acme Corporation"
                required
                disabled={saving}
              />
            </Field>
          )
        ) : null}

        {scope === "company" ? (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              fontSize: 12,
              color: "rgba(245, 245, 247, 0.55)",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 8,
            }}
          >
            Company-scoped documents apply to the agency as a whole — no guard
            or client is attached.
          </div>
        ) : null}

        {/* Doc type with datalist */}
        <Field label="Document type" htmlFor="doc-type">
          <TextInput
            id="doc-type"
            value={docType}
            onChange={setDocType}
            placeholder="e.g. SOSIA License"
            required
            disabled={saving}
            list={DOC_TYPE_DATALIST_ID}
          />
          <datalist id={DOC_TYPE_DATALIST_ID}>
            {DOC_TYPE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>

        <Field label="Document number" htmlFor="doc-number">
          <TextInput
            id="doc-number"
            value={docNumber}
            onChange={setDocNumber}
            placeholder="License / certificate / reference no."
            disabled={saving}
          />
        </Field>

        <Field
          label="Issuing agency"
          htmlFor="doc-issuing-agency"
          helper="Where this document is renewed (optional)."
        >
          <TextInput
            id="doc-issuing-agency"
            value={issuingAgency}
            onChange={setIssuingAgency}
            placeholder="e.g. SOSIA"
            disabled={saving}
            list={ISSUING_AGENCY_DATALIST_ID}
          />
          <datalist id={ISSUING_AGENCY_DATALIST_ID}>
            {ISSUING_AGENCY_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Issue date" htmlFor="doc-issue">
              <TextInput
                id="doc-issue"
                type="date"
                value={issueDate}
                onChange={setIssueDate}
                disabled={saving}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Expiry date" htmlFor="doc-expiry">
              <TextInput
                id="doc-expiry"
                type="date"
                value={expiryDate}
                onChange={setExpiryDate}
                disabled={saving}
              />
            </Field>
          </div>
        </div>

        <Field
          label="File"
          helper="Uploads go to the compliance-documents bucket; older docs may show a manually-pasted link."
        >
          <FileUploadField
            existingFileUrl={existingFileUrl}
            stagedFile={stagedFile}
            markedForRemoval={markedForRemoval}
            disabled={saving}
            onSelect={selectFile}
            onMarkForRemoval={markForRemoval}
          />
        </Field>

        <Field label="Notes" htmlFor="doc-notes">
          <TextArea
            id="doc-notes"
            value={notes}
            onChange={setNotes}
            placeholder="Anything else worth knowing about this document."
            disabled={saving}
          />
        </Field>
      </form>
    </Modal>
  );
}

function ReadOnlyValue({ children }: { children: ReactNode }) {
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

function FileUploadField({
  existingFileUrl,
  stagedFile,
  markedForRemoval,
  disabled,
  onSelect,
  onMarkForRemoval,
}: {
  existingFileUrl: string | null;
  stagedFile: File | null;
  markedForRemoval: boolean;
  disabled: boolean;
  onSelect: (f: File | null) => void;
  onMarkForRemoval: (m: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  function openPicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function clearStaged() {
    onSelect(null);
    // Reset the input so the same file can be re-selected if the user
    // changes their mind and chooses it again.
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleOpenExisting() {
    if (!existingFileUrl) return;
    const supabase = createSupabaseClient();
    const { error } = await openComplianceFile(supabase, existingFileUrl);
    if (error) showToast(error, "error");
  }

  // State A: no existing, no staged → "Choose file"
  // State B: no existing, staged → filename + Replace + Clear
  // State C: existing, no staged, not removed → name + Open + Replace + Remove
  // State D: existing, staged → "Replacing with X" + Cancel
  // State E: existing, marked for removal → "Will remove" + Undo
  const hasExisting = Boolean(existingFileUrl);
  const existingDisplay = existingFileUrl
    ? displayNameFromFileUrl(existingFileUrl)
    : "";

  const containerStyle: CSSProperties = {
    padding: "12px 14px",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        disabled={disabled}
        style={{ display: "none" }}
      />

      {!hasExisting && !stagedFile ? (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          style={{
            ...containerStyle,
            width: "100%",
            border: "1px dashed rgba(255, 255, 255, 0.18)",
            color: "rgba(245, 245, 247, 0.7)",
            fontSize: 13,
            fontFamily: "inherit",
            cursor: disabled ? "not-allowed" : "pointer",
            textAlign: "center",
          }}
        >
          + Choose file…
        </button>
      ) : null}

      {!hasExisting && stagedFile ? (
        <div style={containerStyle}>
          <FileLine
            primary={stagedFile.name}
            secondary={fileSizeDisplay(stagedFile)}
            tone="staged"
          />
          <FileActions>
            <FileActionButton label="Replace" onClick={openPicker} />
            <FileActionButton label="Clear" onClick={clearStaged} danger />
          </FileActions>
        </div>
      ) : null}

      {hasExisting && !stagedFile && !markedForRemoval ? (
        <div style={containerStyle}>
          <FileLine
            primary={existingDisplay}
            secondary={existingFileUrl && isHttpUrl(existingFileUrl) ? "External link" : "Stored file"}
            tone="existing"
          />
          <FileActions>
            <FileActionButton label="Open" onClick={handleOpenExisting} accent />
            <FileActionButton label="Replace" onClick={openPicker} />
            <FileActionButton
              label="Remove"
              onClick={() => onMarkForRemoval(true)}
              danger
            />
          </FileActions>
        </div>
      ) : null}

      {hasExisting && stagedFile ? (
        <div style={containerStyle}>
          <FileLine
            primary={stagedFile.name}
            secondary={`Will replace ${existingDisplay} on save`}
            tone="staged"
          />
          <FileActions>
            <FileActionButton label="Cancel replace" onClick={clearStaged} />
          </FileActions>
        </div>
      ) : null}

      {hasExisting && markedForRemoval ? (
        <div style={containerStyle}>
          <FileLine
            primary={existingDisplay}
            secondary="Will be removed on save"
            tone="warning"
          />
          <FileActions>
            <FileActionButton label="Undo" onClick={() => onMarkForRemoval(false)} />
          </FileActions>
        </div>
      ) : null}
    </>
  );
}

function fileSizeDisplay(file: File): string {
  if (file.size < 1024) return `${file.size} B`;
  if (file.size < 1024 * 1024) return `${(file.size / 1024).toFixed(1)} KB`;
  return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
}

function FileLine({
  primary,
  secondary,
  tone,
}: {
  primary: string;
  secondary?: string;
  tone: "staged" | "existing" | "warning";
}) {
  const primaryColor =
    tone === "warning" ? "#fbbf24" : "#f5f5f7";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
      }}
    >
      <PaperclipIcon />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: primaryColor,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={primary}
        >
          {primary}
        </div>
        {secondary ? (
          <div
            style={{
              fontSize: 11,
              color: "rgba(245, 245, 247, 0.5)",
              marginTop: 2,
            }}
          >
            {secondary}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FileActions({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        gap: 14,
        justifyContent: "flex-end",
      }}
    >
      {children}
    </div>
  );
}

function FileActionButton({
  label,
  onClick,
  danger,
  accent,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  accent?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const color = danger
    ? hover
      ? "#ef4444"
      : "rgba(239, 68, 68, 0.7)"
    : accent
      ? hover
        ? "#d4b670"
        : "#c9a961"
      : hover
        ? "#f5f5f7"
        : "rgba(245, 245, 247, 0.55)";
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        color,
        transition: "color 150ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

function PaperclipIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(245, 245, 247, 0.55)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

const optionRowBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  cursor: "pointer",
  fontSize: 13,
  color: "#f5f5f7",
  transition: "background-color 150ms ease-out",
};

function GuardPicker({
  guards,
  loading,
  allLoaded,
  selectedId,
  disabled,
  onSelect,
}: {
  guards: GuardOption[];
  loading: boolean;
  allLoaded: GuardOption[] | null;
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      style={{
        marginTop: -4,
        marginBottom: 16,
        maxHeight: 220,
        overflowY: "auto",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 8,
      }}
    >
      {loading ? (
        <ListMessage message="Loading active guards…" />
      ) : guards.length === 0 ? (
        <ListMessage
          message={
            allLoaded && allLoaded.length === 0
              ? "No active guards available."
              : "No guards match your search."
          }
        />
      ) : (
        guards.map((g, idx) => (
          <GuardOptionRow
            key={g.id}
            guard={g}
            selected={selectedId === g.id}
            isLast={idx === guards.length - 1}
            onSelect={() => onSelect(g.id)}
            disabled={disabled}
          />
        ))
      )}
    </div>
  );
}

function GuardOptionRow({
  guard,
  selected,
  isLast,
  onSelect,
  disabled,
}: {
  guard: GuardOption;
  selected: boolean;
  isLast: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const [hover, setHover] = useState(false);
  const bg = selected
    ? "rgba(201, 169, 97, 0.14)"
    : hover
      ? "rgba(255, 255, 255, 0.04)"
      : "transparent";
  return (
    <div
      role="button"
      aria-pressed={selected}
      onClick={() => !disabled && onSelect()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...optionRowBase,
        backgroundColor: bg,
        borderBottom: isLast ? "none" : "1px solid rgba(255, 255, 255, 0.04)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span style={{ fontWeight: 500 }}>{guard.full_name}</span>
      <span
        className="tabular"
        style={{ fontSize: 11, color: "rgba(245, 245, 247, 0.5)" }}
      >
        {guard.employee_no ?? ""}
      </span>
    </div>
  );
}

function ListMessage({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "16px 12px",
        fontSize: 12,
        color: "rgba(245, 245, 247, 0.5)",
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}
