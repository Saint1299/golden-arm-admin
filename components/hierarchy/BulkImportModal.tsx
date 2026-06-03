"use client";

import Papa from "papaparse";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "@/components/ui/Modal";
import { CancelButton, FormError, GoldButton } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  deriveFullName,
  type Client,
  type ClientType,
  type GuardStatus,
} from "@/types/database";

type BulkMode = "clients" | "guards";

type ClientInsert = {
  name: string;
  type: ClientType;
  industry: string | null;
  conglomerate: string | null;
};

type GuardInsert = {
  client_id: string | null;
  full_name: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  birthdate: string | null;
  birth_place: string | null;
  address: string | null;
  educational_attainment: string | null;
  id_number: string;
  license_category: string | null;
  license_no: string | null;
  license_expiry: string | null;
  contact_no: string | null;
  emergency_contact_no: string | null;
  date_deployed: string | null;
  sss: string | null;
  philhealth: string | null;
  pagibig: string | null;
  tin: string | null;
  deployment_location: string | null;
  status: GuardStatus;
  notes: string | null;
};

type ParsedClientRow =
  | { index: number; ok: true; payload: ClientInsert }
  | { index: number; ok: false; reason: string; raw: Record<string, string> };

type ParsedGuardRow =
  | {
      index: number;
      ok: true;
      payload: GuardInsert;
      // Display label for the preview: the matched client name, or
      // "Unassigned" when the row has no client_name.
      client_name: string;
    }
  | {
      index: number;
      ok: false;
      reason: string;
      raw: Record<string, string>;
    };

type ParsedRow = ParsedClientRow | ParsedGuardRow;

// Template content — header row + a single sample row so the file
// downloads with a worked example the user can crib from.
const CLIENT_TEMPLATE_CSV =
  "name,type,industry,conglomerate,notes\nSM Megamall,single_post,Retail / Mall,SM Investments,Main lobby + parking\n";

// Header order is contractual — it must match the order the user sees in the
// downloaded template (spec). full_name is included for round-tripping but is
// recomputed from the name parts on import (see parseGuardRow).
const GUARD_CSV_COLUMNS = [
  "client_name",
  "id_number",
  "full_name",
  "first_name",
  "middle_name",
  "last_name",
  "birthdate",
  "birth_place",
  "address",
  "educational_attainment",
  "license_category",
  "license_no",
  "license_expiry",
  "contact_no",
  "emergency_contact_no",
  "date_deployed",
  "sss",
  "philhealth",
  "pagibig",
  "tin",
  "deployment_location",
  "status",
  "notes",
] as const;

const GUARD_TEMPLATE_CSV = `${GUARD_CSV_COLUMNS.join(",")}\nSM Megamall,GA-0142,,Juan,Santos,Dela Cruz,1990-01-15,Quezon City,123 Rizal St Brgy Maligaya,High school graduate,SG,SOSIA-12345,2027-03-01,0917-000-0000,0918-111-2222,2026-01-15,34-1234567-8,12-345678901-2,1234-5678-9012,123-456-789-000,Main lobby,active,Prefers night shift\n`;

const VALID_STATUSES: ReadonlySet<GuardStatus> = new Set<GuardStatus>([
  "active",
  "reliever",
  "on_leave",
  "inactive",
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function downloadAsCsv(filename: string, content: string) {
  const url = `data:text/csv;charset=utf-8,${encodeURIComponent(content)}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function BulkImportModal({
  mode,
  onClose,
  onCompleted,
}: {
  mode: BulkMode;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"pick" | "preview" | "committing">("pick");
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guard mode needs the clients list to resolve client_name → client_id, and
  // the set of id_numbers already in the DB to reject duplicates up front.
  const [clients, setClients] = useState<Client[] | null>(null);
  const [existingIdNumbers, setExistingIdNumbers] = useState<Set<string>>(
    new Set(),
  );
  const { showToast } = useToast();

  useEffect(() => {
    if (mode !== "guards") return;
    let active = true;
    (async () => {
      const supabase = createSupabaseClient();
      const [clientsRes, guardsRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name")
          .order("name", { ascending: true }),
        supabase.from("guards").select("id_number"),
      ]);
      if (!active) return;
      const ids = new Set<string>();
      for (const g of (guardsRes.data ?? []) as Array<{
        id_number: string | null;
      }>) {
        if (g.id_number) ids.add(g.id_number.trim().toLowerCase());
      }
      setExistingIdNumbers(ids);
      setClients((clientsRes.data ?? []) as Client[]);
    })();
    return () => {
      active = false;
    };
  }, [mode]);

  const title =
    mode === "clients" ? "Bulk import clients" : "Bulk import guards";
  const templateName =
    mode === "clients" ? "clients-template.csv" : "guards-template.csv";
  const templateContent =
    mode === "clients" ? CLIENT_TEMPLATE_CSV : GUARD_TEMPLATE_CSV;

  function handleDownloadTemplate() {
    downloadAsCsv(templateName, templateContent);
  }

  function resetToIdle() {
    setParsed(null);
    setErrorMessage(null);
    setPhase("pick");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handlePickFile(file: File | null) {
    if (!file) return;
    setErrorMessage(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      // Trim header whitespace so "name " still matches "name".
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const rows = result.data;
        // Tracks id_numbers seen earlier in this same file so a duplicate
        // within the CSV flags the *second* (and later) occurrences.
        const seenIdNumbers = new Set<string>();
        const parsedRows: ParsedRow[] =
          mode === "clients"
            ? rows.map((r, i) => parseClientRow(r, i + 2)) // header is row 1
            : rows.map((r, i) =>
                parseGuardRow(
                  r,
                  i + 2,
                  clients ?? [],
                  existingIdNumbers,
                  seenIdNumbers,
                ),
              );
        if (parsedRows.length === 0) {
          setErrorMessage(
            "The file appears to be empty (no rows below the header).",
          );
          return;
        }
        setParsed(parsedRows);
        setPhase("preview");
      },
      error: (err) => {
        setErrorMessage(`Couldn’t parse the file: ${err.message}`);
      },
    });
  }

  const validRows = useMemo(
    () => (parsed ?? []).filter((r): r is Extract<ParsedRow, { ok: true }> => r.ok),
    [parsed],
  );
  const invalidRows = useMemo(
    () => (parsed ?? []).filter((r): r is Extract<ParsedRow, { ok: false }> => !r.ok),
    [parsed],
  );

  async function handleCommit() {
    if (!parsed || validRows.length === 0) return;
    setPhase("committing");
    const supabase = createSupabaseClient();
    let inserted = 0;
    const failures: Array<{ index: number; reason: string }> = [];

    // Single batch insert; if it fails (RLS/constraint), report and bail.
    if (mode === "clients") {
      const payloads = validRows.map((r) => (r as ParsedClientRow & { ok: true }).payload);
      const { error } = await supabase.from("clients").insert(payloads);
      if (error) {
        failures.push({ index: 0, reason: error.message });
      } else {
        inserted = payloads.length;
      }
    } else {
      const payloads = validRows.map((r) => (r as ParsedGuardRow & { ok: true }).payload);
      const { error } = await supabase.from("guards").insert(payloads);
      if (error) {
        failures.push({ index: 0, reason: error.message });
      } else {
        inserted = payloads.length;
      }
    }

    if (failures.length > 0) {
      showToast(`Import failed: ${failures[0].reason}`, "error");
      setPhase("preview");
      return;
    }

    const skipped = invalidRows.length;
    showToast(
      skipped > 0
        ? `Imported ${inserted} ${mode === "clients" ? "client" : "guard"}${inserted === 1 ? "" : "s"} · skipped ${skipped} with errors`
        : `Imported ${inserted} ${mode === "clients" ? "client" : "guard"}${inserted === 1 ? "" : "s"}`,
      "success",
    );
    onCompleted();
  }

  const footer = (
    <>
      <FormError message={errorMessage} />
      {errorMessage ? <div style={{ height: 12 }} /> : null}
      {phase === "preview" ? (
        <GoldButton
          type="button"
          onClick={handleCommit}
          disabled={validRows.length === 0}
        >
          {validRows.length === 0
            ? "Nothing valid to import"
            : invalidRows.length > 0
              ? `Import ${validRows.length}, skip ${invalidRows.length} with errors`
              : `Import ${validRows.length} ${mode === "clients" ? "client" : "guard"}${validRows.length === 1 ? "" : "s"}`}
        </GoldButton>
      ) : phase === "committing" ? (
        <GoldButton type="button" disabled>
          Importing…
        </GoldButton>
      ) : null}
      <div style={{ height: 8 }} />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <CancelButton onClick={onClose} disabled={phase === "committing"} />
      </div>
    </>
  );

  return (
    <Modal title={title} onClose={onClose} maxWidth={620} footer={footer}>
      {phase === "pick" ? (
        <PickPanel
          mode={mode}
          onPickFile={handlePickFile}
          onDownloadTemplate={handleDownloadTemplate}
          fileInputRef={fileInputRef}
          loadingClients={mode === "guards" && clients === null}
        />
      ) : null}

      {phase === "preview" && parsed ? (
        <PreviewPanel
          mode={mode}
          valid={validRows}
          invalid={invalidRows}
          onPickAnother={resetToIdle}
        />
      ) : null}

      {phase === "committing" ? (
        <div
          style={{
            padding: "32px 12px",
            textAlign: "center",
            color: "rgba(245, 245, 247, 0.7)",
            fontSize: 13,
          }}
        >
          Importing rows…
        </div>
      ) : null}
    </Modal>
  );
}

function PickPanel({
  mode,
  onPickFile,
  onDownloadTemplate,
  fileInputRef,
  loadingClients,
}: {
  mode: BulkMode;
  onPickFile: (file: File | null) => void;
  onDownloadTemplate: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  loadingClients: boolean;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: 13,
          color: "rgba(245, 245, 247, 0.7)",
          margin: 0,
        }}
      >
        Upload a <strong>.csv</strong> with the same column headers as the
        template. Every row is validated before any rows are written.
      </p>

      <div style={{ height: 16 }} />

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        style={{ display: "none" }}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loadingClients}
        style={{
          width: "100%",
          padding: "16px 14px",
          backgroundColor: "rgba(255, 255, 255, 0.03)",
          border: "1px dashed rgba(255, 255, 255, 0.18)",
          color: loadingClients
            ? "rgba(245, 245, 247, 0.4)"
            : "rgba(245, 245, 247, 0.75)",
          fontSize: 13,
          fontFamily: "inherit",
          borderRadius: 10,
          cursor: loadingClients ? "wait" : "pointer",
          textAlign: "center",
        }}
      >
        {loadingClients ? "Loading clients…" : "+ Choose CSV file…"}
      </button>

      <div style={{ height: 16 }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px",
          backgroundColor: "rgba(255, 255, 255, 0.025)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{ fontSize: 13, fontWeight: 500, color: "#f5f5f7" }}
          >
            CSV template
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(245, 245, 247, 0.5)",
              marginTop: 2,
            }}
          >
            {mode === "clients"
              ? "Columns: name, type, industry, conglomerate, notes"
              : `Columns: ${GUARD_CSV_COLUMNS.join(", ")}`}
          </div>
        </div>
        <button
          type="button"
          onClick={onDownloadTemplate}
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "rgba(245, 245, 247, 0.8)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Download
        </button>
      </div>

      <div style={{ height: 16 }} />
      <BulkRules mode={mode} />
    </div>
  );
}

function BulkRules({ mode }: { mode: BulkMode }) {
  const bullets =
    mode === "clients"
      ? [
          "name is required.",
          "type accepts single_post or pooled; anything else (including blank) defaults to single_post.",
          "industry, conglomerate, notes are optional.",
        ]
      : [
          "id_number, first_name, last_name are required.",
          "id_number must be unique — both within the file and against existing guards.",
          "client_name is optional: leave it blank to import the guard as Unassigned. If filled, it's matched case-insensitively to an existing client; unmatched rows go to the error list.",
          "full_name is recomputed from first_name + middle_name + last_name; the CSV's full_name column is ignored on import.",
          "status accepts active / reliever / on_leave / inactive; blank defaults to active; any other value is an error.",
          "birthdate, license_expiry, date_deployed must be YYYY-MM-DD or blank.",
          "All other columns are optional free text.",
        ];
  return (
    <div
      style={{
        fontSize: 12,
        color: "rgba(245, 245, 247, 0.55)",
        lineHeight: 1.55,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(245, 245, 247, 0.4)",
          marginBottom: 6,
        }}
      >
        Validation rules
      </div>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

function PreviewPanel({
  mode,
  valid,
  invalid,
  onPickAnother,
}: {
  mode: BulkMode;
  valid: Array<Extract<ParsedRow, { ok: true }>>;
  invalid: Array<Extract<ParsedRow, { ok: false }>>;
  onPickAnother: () => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 16 }}>
          <SummaryPill
            label={mode === "clients" ? "Valid clients" : "Valid guards"}
            count={valid.length}
            accent="ok"
          />
          {invalid.length > 0 ? (
            <SummaryPill
              label="Errors"
              count={invalid.length}
              accent="error"
            />
          ) : null}
        </div>
        <button
          type="button"
          onClick={onPickAnother}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(245, 245, 247, 0.55)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Pick another file
        </button>
      </div>

      <div style={{ height: 14 }} />

      {invalid.length > 0 ? (
        <Section title="Rows that will be skipped">
          <RowList rows={invalid.map((r) => ({ index: r.index, primary: r.reason, secondary: rawDescription(mode, r.raw) }))} tone="error" />
        </Section>
      ) : null}

      {invalid.length > 0 && valid.length > 0 ? (
        <div style={{ height: 14 }} />
      ) : null}

      {valid.length > 0 ? (
        <Section title="Rows that will be imported">
          <RowList
            rows={valid.map((r) => ({
              index: r.index,
              primary: validPrimary(mode, r),
              secondary: validSecondary(mode, r),
            }))}
            tone="ok"
          />
        </Section>
      ) : null}
    </div>
  );
}

function validPrimary(
  mode: BulkMode,
  row: Extract<ParsedRow, { ok: true }>,
): string {
  if (mode === "clients") {
    const p = (row as Extract<ParsedClientRow, { ok: true }>).payload;
    return p.name;
  }
  const r = row as Extract<ParsedGuardRow, { ok: true }>;
  return `${r.payload.full_name}  ·  ${r.client_name}`;
}
function validSecondary(
  mode: BulkMode,
  row: Extract<ParsedRow, { ok: true }>,
): string {
  if (mode === "clients") {
    const p = (row as Extract<ParsedClientRow, { ok: true }>).payload;
    const parts = [
      p.type,
      p.industry ?? "",
      p.conglomerate ?? "",
    ].filter(Boolean);
    return parts.join("  ·  ");
  }
  const r = row as Extract<ParsedGuardRow, { ok: true }>;
  const parts = [
    r.payload.status,
    r.payload.id_number,
    r.payload.license_no ?? "",
    r.payload.deployment_location ?? "",
  ].filter(Boolean);
  return parts.join("  ·  ");
}

function rawDescription(
  mode: BulkMode,
  raw: Record<string, string>,
): string {
  if (mode === "clients") {
    return raw.name ? `name: ${raw.name}` : "row missing name";
  }
  const name = [raw.first_name ?? "", raw.last_name ?? ""]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");
  return [name, raw.id_number ?? "", raw.client_name ?? ""]
    .filter(Boolean)
    .join("  ·  ");
}

function SummaryPill({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent: "ok" | "error";
}) {
  const fg = accent === "ok" ? "#34d399" : "#fb7185";
  const bg =
    accent === "ok" ? "rgba(16, 185, 129, 0.10)" : "rgba(244, 63, 94, 0.10)";
  const border =
    accent === "ok" ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 8,
        padding: "8px 12px",
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
      }}
    >
      <span
        className="tabular"
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: fg,
        }}
      >
        {count}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(245, 245, 247, 0.55)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(245, 245, 247, 0.4)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function RowList({
  rows,
  tone,
}: {
  rows: Array<{ index: number; primary: string; secondary?: string }>;
  tone: "ok" | "error";
}) {
  const accent =
    tone === "ok"
      ? { border: "rgba(255, 255, 255, 0.06)", fg: "#f5f5f7" }
      : { border: "rgba(244, 63, 94, 0.25)", fg: "#fb7185" };
  return (
    <div
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.025)",
        border: `1px solid ${accent.border}`,
        borderRadius: 8,
        maxHeight: 220,
        overflowY: "auto",
      }}
    >
      {rows.map((r, i) => (
        <div
          key={`${r.index}-${i}`}
          style={{
            display: "flex",
            gap: 10,
            padding: "8px 10px",
            borderBottom:
              i === rows.length - 1
                ? "none"
                : "1px solid rgba(255, 255, 255, 0.04)",
            fontSize: 12,
          }}
        >
          <span
            className="tabular"
            style={{
              flexShrink: 0,
              width: 40,
              color: "rgba(245, 245, 247, 0.45)",
            }}
          >
            Row {r.index}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: accent.fg, fontWeight: 500 }}>{r.primary}</div>
            {r.secondary ? (
              <div
                style={{
                  marginTop: 2,
                  color: "rgba(245, 245, 247, 0.45)",
                  fontSize: 11,
                }}
              >
                {r.secondary}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// -- Per-row validation ------------------------------------------------------

function parseClientRow(
  raw: Record<string, string>,
  rowIndex: number,
): ParsedClientRow {
  const name = trimOrNull(raw.name);
  if (!name) {
    return { index: rowIndex, ok: false, reason: "name is required", raw };
  }
  const rawType = (raw.type ?? "").trim().toLowerCase();
  const type: ClientType =
    rawType === "single_post" || rawType === "pooled"
      ? (rawType as ClientType)
      : "single_post";
  return {
    index: rowIndex,
    ok: true,
    payload: {
      name,
      type,
      industry: trimOrNull(raw.industry),
      conglomerate: trimOrNull(raw.conglomerate),
    },
  };
}

function parseGuardRow(
  raw: Record<string, string>,
  rowIndex: number,
  clients: Client[],
  existingIdNumbers: Set<string>,
  seenIdNumbers: Set<string>,
): ParsedGuardRow {
  const firstName = trimOrNull(raw.first_name);
  const lastName = trimOrNull(raw.last_name);
  const idNumber = trimOrNull(raw.id_number);

  if (!idNumber) {
    return { index: rowIndex, ok: false, reason: "id_number is required", raw };
  }
  if (!firstName) {
    return { index: rowIndex, ok: false, reason: "first_name is required", raw };
  }
  if (!lastName) {
    return { index: rowIndex, ok: false, reason: "last_name is required", raw };
  }

  // id_number uniqueness — against the DB and against earlier CSV rows.
  const idKey = idNumber.toLowerCase();
  if (existingIdNumbers.has(idKey)) {
    return {
      index: rowIndex,
      ok: false,
      reason: `id_number "${idNumber}" already exists in the system`,
      raw,
    };
  }
  if (seenIdNumbers.has(idKey)) {
    return {
      index: rowIndex,
      ok: false,
      reason: `id_number "${idNumber}" is duplicated earlier in this file`,
      raw,
    };
  }

  // client_name is optional: blank → unassigned; non-blank must match.
  const clientName = trimOrNull(raw.client_name);
  let clientId: string | null = null;
  let clientLabel = "Unassigned";
  if (clientName) {
    const lowered = clientName.toLowerCase();
    const match = clients.find((c) => c.name.toLowerCase() === lowered);
    if (!match) {
      return {
        index: rowIndex,
        ok: false,
        reason: `client_name "${clientName}" doesn't match any existing client`,
        raw,
      };
    }
    clientId = match.id;
    clientLabel = match.name;
  }

  // status: blank → active; non-blank must match the guard_status enum.
  const rawStatus = (raw.status ?? "").trim().toLowerCase();
  if (rawStatus && !VALID_STATUSES.has(rawStatus as GuardStatus)) {
    return {
      index: rowIndex,
      ok: false,
      reason: `status "${raw.status.trim()}" must be one of active, reliever, on_leave, inactive`,
      raw,
    };
  }
  const status: GuardStatus = rawStatus ? (rawStatus as GuardStatus) : "active";

  // Optional date fields must parse as YYYY-MM-DD when present.
  const dateChecks: Array<[string, string | null]> = [
    ["birthdate", trimOrNull(raw.birthdate)],
    ["license_expiry", trimOrNull(raw.license_expiry)],
    ["date_deployed", trimOrNull(raw.date_deployed)],
  ];
  for (const [field, val] of dateChecks) {
    if (val && !ISO_DATE_RE.test(val)) {
      return {
        index: rowIndex,
        ok: false,
        reason: `${field} "${val}" must be in YYYY-MM-DD format`,
        raw,
      };
    }
  }

  seenIdNumbers.add(idKey);

  return {
    index: rowIndex,
    ok: true,
    client_name: clientLabel,
    payload: {
      client_id: clientId,
      full_name: deriveFullName(
        firstName,
        trimOrNull(raw.middle_name),
        lastName,
        trimOrNull(raw.full_name),
      ),
      first_name: firstName,
      middle_name: trimOrNull(raw.middle_name),
      last_name: lastName,
      birthdate: trimOrNull(raw.birthdate),
      birth_place: trimOrNull(raw.birth_place),
      address: trimOrNull(raw.address),
      educational_attainment: trimOrNull(raw.educational_attainment),
      id_number: idNumber,
      license_category: trimOrNull(raw.license_category),
      license_no: trimOrNull(raw.license_no),
      license_expiry: trimOrNull(raw.license_expiry),
      contact_no: trimOrNull(raw.contact_no),
      emergency_contact_no: trimOrNull(raw.emergency_contact_no),
      date_deployed: trimOrNull(raw.date_deployed),
      sss: trimOrNull(raw.sss),
      philhealth: trimOrNull(raw.philhealth),
      pagibig: trimOrNull(raw.pagibig),
      tin: trimOrNull(raw.tin),
      deployment_location: trimOrNull(raw.deployment_location),
      status,
      notes: trimOrNull(raw.notes),
    },
  };
}

