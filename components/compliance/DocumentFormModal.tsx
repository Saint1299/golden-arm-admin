"use client";

import {
  useEffect,
  useMemo,
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
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  DOCUMENT_SCOPE_LABEL,
  DOC_TYPE_SUGGESTIONS,
  type ApiDocument,
  type DocumentScope,
} from "@/types/database";

type GuardOption = {
  id: string;
  full_name: string;
  employee_no: string | null;
};

type ClientOption = {
  id: string;
  name: string;
  region_id: string;
};

type RegionOption = { id: string; name: string };

const DOC_TYPE_DATALIST_ID = "document-type-suggestions";

export function DocumentFormModal({
  initialDoc,
  allowedScopes,
  presetGuardId,
  presetClientId,
  presetGuardName,
  presetClientName,
  onClose,
  onSaved,
}: {
  initialDoc: ApiDocument | null;
  // Drives the scope control: a dropdown when length > 1, a read-only chip
  // when length === 1 (the scope is locked). Required + non-empty.
  //   /compliance add or edit (company/client only): ['client', 'company']
  //   guard detail (add or edit):                    ['guard']
  //   client detail (add or edit):                   ['client']
  allowedScopes: DocumentScope[];
  // Subject locks — independent of the scope lock. Set on the "Add doc for
  // this X" paths so the picker is replaced by a read-only name chip. Edits
  // intentionally don't set these so the user can re-target the doc.
  presetGuardId?: string;
  presetClientId?: string;
  presetGuardName?: string;
  presetClientName?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initialDoc);
  const scopeLocked = allowedScopes.length === 1;

  // Initial scope: prefer the doc's current scope (edit), else the first
  // allowed. Snap back to allowed[0] if a caller hands us an out-of-set scope.
  const initialScope: DocumentScope = (() => {
    const fromDoc = initialDoc?.scope;
    if (fromDoc && allowedScopes.includes(fromDoc)) return fromDoc;
    return allowedScopes[0] ?? "company";
  })();
  const [scope, setScope] = useState<DocumentScope>(initialScope);
  const [guardId, setGuardId] = useState<string | null>(
    initialDoc?.guard_id ?? presetGuardId ?? null,
  );
  const [clientId, setClientId] = useState<string | null>(
    initialDoc?.client_id ?? presetClientId ?? null,
  );
  const [docType, setDocType] = useState(initialDoc?.doc_type ?? "");
  const [docNumber, setDocNumber] = useState(initialDoc?.doc_number ?? "");
  const [issueDate, setIssueDate] = useState(initialDoc?.issue_date ?? "");
  const [expiryDate, setExpiryDate] = useState(initialDoc?.expiry_date ?? "");
  const [fileUrl, setFileUrl] = useState(initialDoc?.file_url ?? "");
  const [notes, setNotes] = useState(initialDoc?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showToast } = useToast();

  // Loaded only when at least one picker can actually be shown — i.e. an
  // allowed scope has no preset subject lock. Skipping the fetch when every
  // possible subject is pre-locked keeps "Add doc for this X" snappy.
  const [guards, setGuards] = useState<GuardOption[] | null>(null);
  const [clients, setClients] = useState<ClientOption[] | null>(null);
  const [regions, setRegions] = useState<RegionOption[] | null>(null);
  const [guardSearch, setGuardSearch] = useState("");

  const needGuardPicker = allowedScopes.includes("guard") && !presetGuardId;
  const needClientPicker = allowedScopes.includes("client") && !presetClientId;
  const needPickers = needGuardPicker || needClientPicker;

  useEffect(() => {
    if (!needPickers) return;
    let active = true;
    (async () => {
      const supabase = createSupabaseClient();
      const [guardsRes, clientsRes, regionsRes] = await Promise.all([
        supabase
          .from("guards")
          .select("id, full_name, employee_no")
          .eq("status", "active")
          .order("full_name", { ascending: true }),
        supabase
          .from("clients")
          .select("id, name, region_id")
          .order("name", { ascending: true }),
        supabase.from("regions").select("id, name").order("name", { ascending: true }),
      ]);
      if (!active) return;
      setGuards((guardsRes.data ?? []) as GuardOption[]);
      setClients((clientsRes.data ?? []) as ClientOption[]);
      setRegions((regionsRes.data ?? []) as RegionOption[]);
    })();
    return () => {
      active = false;
    };
  }, [needPickers]);

  // When scope changes mid-edit, clear the other subject id so we never
  // submit an invalid combination (the DB CHECK would reject it anyway).
  function handleScopeChange(next: DocumentScope) {
    setScope(next);
    if (next !== "guard") setGuardId(null);
    if (next !== "client") setClientId(null);
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

  // Group clients by region for the optgroup select.
  const clientGroups = useMemo(() => {
    if (!clients || !regions) return [];
    const byRegion = new Map<string, ClientOption[]>();
    for (const c of clients) {
      const arr = byRegion.get(c.region_id) ?? [];
      arr.push(c);
      byRegion.set(c.region_id, arr);
    }
    return regions
      .map((r) => ({
        regionName: r.name,
        items: byRegion.get(r.id) ?? [],
      }))
      .filter((g) => g.items.length > 0);
  }, [clients, regions]);

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
    if (scope === "client" && !clientId) {
      setErrorMessage("Pick a client for client-scoped documents.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const payload = {
      scope,
      guard_id: scope === "guard" ? guardId : null,
      client_id: scope === "client" ? clientId : null,
      doc_type: docType.trim(),
      doc_number: docNumber.trim() ? docNumber.trim() : null,
      issue_date: issueDate || null,
      expiry_date: expiryDate || null,
      file_url: fileUrl.trim() ? fileUrl.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
    };

    const supabase = createSupabaseClient();
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

  return (
    <Modal title={title} onClose={onClose} maxWidth={560}>
      <form onSubmit={handleSubmit}>
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
              options={allowedScopes.map((s) => ({
                value: s,
                label: DOCUMENT_SCOPE_LABEL[s],
              }))}
              disabled={saving}
            />
          </Field>
        )}

        {/* Subject picker — locked when preset*Id is provided (Add for this X),
            picker otherwise (full add + all edits). */}
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
          presetClientId ? (
            <Field label="Client">
              <ReadOnlyValue>{presetClientName ?? "—"}</ReadOnlyValue>
            </Field>
          ) : (
            <Field label="Client" htmlFor="doc-client">
              <ClientPickerSelect
                id="doc-client"
                groups={clientGroups}
                loading={clients === null || regions === null}
                value={clientId ?? ""}
                onChange={(v) => setClientId(v || null)}
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
          label="File URL"
          htmlFor="doc-url"
          helper="Paste a link to the scan/PDF (uploads not supported in this milestone)."
        >
          <TextInput
            id="doc-url"
            type="url"
            value={fileUrl}
            onChange={setFileUrl}
            placeholder="https://…"
            disabled={saving}
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

        <FormError message={errorMessage} />

        <div style={{ height: 24 }} />
        <GoldButton type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save document" : "Add document"}
        </GoldButton>
        <div style={{ height: 12 }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CancelButton onClick={onClose} disabled={saving} />
        </div>
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

function ClientPickerSelect({
  id,
  groups,
  loading,
  value,
  onChange,
  disabled,
}: {
  id: string;
  groups: Array<{ regionName: string; items: ClientOption[] }>;
  loading: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const [focused, setFocused] = useState(false);
  if (loading) {
    return <ReadOnlyValue>Loading clients…</ReadOnlyValue>;
  }
  return (
    <div style={{ position: "relative" }}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        style={{
          width: "100%",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${focused ? "rgba(201, 169, 97, 0.5)" : "rgba(255, 255, 255, 0.08)"}`,
          borderRadius: 8,
          padding: "10px 40px 10px 14px",
          color: "#f5f5f7",
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <option value="" style={{ background: "#080b12" }}>
          — Pick a client —
        </option>
        {groups.map((g) => (
          <optgroup key={g.regionName} label={g.regionName}>
            {g.items.map((c) => (
              <option key={c.id} value={c.id} style={{ background: "#080b12" }}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(245, 245, 247, 0.6)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
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
