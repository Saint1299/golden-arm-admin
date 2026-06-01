"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AlertStatusBadge } from "./badges";
import { DocumentFormModal } from "./DocumentFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/components/ui/Toast";
import { ALERT_ACCENT, computeAlertStatus, daysRemaining } from "@/lib/compliance";
import { openComplianceFile } from "@/lib/compliance-storage";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  type AlertStatus,
  type ApiDocument,
  type DocumentScope,
} from "@/types/database";

type ScopedDocument = ApiDocument & { computed_alert: AlertStatus | null };

const goldButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(180deg, #D4B670 0%, #C9A961 100%)",
  color: "#080b12",
  border: "1px solid rgba(201, 169, 97, 0.4)",
  borderRadius: 8,
  padding: "10px 16px",
  fontWeight: 600,
  fontSize: 14,
  fontFamily: "inherit",
  letterSpacing: "-0.01em",
  cursor: "pointer",
};

// Used by both the guard detail Inventory-style tab content and the new
// section on the client detail page. They differ only by scope + which id
// column to filter on.
export function SubjectCompliancePanel({
  subjectScope,
  subjectId,
  subjectName,
  addButtonLabel,
}: {
  subjectScope: Extract<DocumentScope, "guard" | "client">;
  subjectId: string;
  subjectName: string;
  addButtonLabel: string;
}) {
  const [docs, setDocs] = useState<ScopedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    { mode: "add" } | { mode: "edit"; doc: ApiDocument } | null
  >(null);
  const { showToast } = useToast();

  const loadDocs = useCallback(async (): Promise<ScopedDocument[]> => {
    const supabase = createSupabaseClient();
    const filterColumn =
      subjectScope === "guard" ? "guard_id" : "client_id";
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("scope", subjectScope)
      .eq(filterColumn, subjectId)
      .order("expiry_date", { ascending: true, nullsFirst: false });
    return ((data ?? []) as ApiDocument[]).map((d) => ({
      ...d,
      computed_alert: computeAlertStatus(d.expiry_date),
    }));
  }, [subjectScope, subjectId]);

  useEffect(() => {
    let active = true;
    (async () => {
      const next = await loadDocs();
      if (!active) return;
      setDocs(next);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadDocs]);

  async function refetch() {
    const next = await loadDocs();
    setDocs(next);
  }

  const grouped = useMemo(() => {
    const expired: ScopedDocument[] = [];
    const due: ScopedDocument[] = [];
    const ok: ScopedDocument[] = [];
    for (const d of docs) {
      if (d.computed_alert === "expired") expired.push(d);
      else if (d.computed_alert === "due_soon") due.push(d);
      else ok.push(d);
    }
    return { expired, due, ok };
  }, [docs]);

  async function handleDelete(doc: ApiDocument) {
    const ok = window.confirm(
      `Delete "${doc.doc_type}"? This cannot be undone.`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Document deleted", "success");
    refetch();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          style={goldButtonStyle}
          onClick={() => setModal({ mode: "add" })}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#080b12"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {addButtonLabel}
        </button>
      </div>

      <DocSection
        title="Valid"
        status="ok"
        docs={grouped.ok}
        emptyMessage={
          loading
            ? "Loading…"
            : "No other documents on file."
        }
        onEdit={(d) => setModal({ mode: "edit", doc: d })}
        onDelete={handleDelete}
      />
      <DocSection
        title="Due Soon"
        status="due_soon"
        docs={grouped.due}
        emptyMessage={
          loading
            ? "Loading…"
            : "No documents due in the next 30 days."
        }
        onEdit={(d) => setModal({ mode: "edit", doc: d })}
        onDelete={handleDelete}
      />
      <DocSection
        title="Expired"
        status="expired"
        docs={grouped.expired}
        emptyMessage={
          loading ? "Loading…" : "No expired documents for this " + subjectScope + "."
        }
        onEdit={(d) => setModal({ mode: "edit", doc: d })}
        onDelete={handleDelete}
      />

      {modal?.mode === "add" ? (
        <DocumentFormModal
          initialDoc={null}
          allowedScopes={[subjectScope]}
          presetGuardId={subjectScope === "guard" ? subjectId : undefined}
          presetClientId={subjectScope === "client" ? subjectId : undefined}
          presetGuardName={subjectScope === "guard" ? subjectName : undefined}
          presetClientName={subjectScope === "client" ? subjectName : undefined}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refetch();
          }}
        />
      ) : null}

      {modal?.mode === "edit" ? (
        <DocumentFormModal
          initialDoc={modal.doc}
          allowedScopes={[subjectScope]}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function DocSection({
  title,
  status,
  docs,
  emptyMessage,
  onEdit,
  onDelete,
}: {
  title: string;
  status: AlertStatus;
  docs: ScopedDocument[];
  emptyMessage: string;
  onEdit: (d: ApiDocument) => void;
  onDelete: (d: ApiDocument) => void;
}) {
  const accent = ALERT_ACCENT[status];
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 9,
            height: 9,
            borderRadius: "50%",
            backgroundColor: accent.fg,
          }}
        />
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#f5f5f7",
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          {title}
        </h3>
        <span
          className="tabular"
          style={{
            fontSize: 12,
            color: "rgba(245, 245, 247, 0.5)",
            fontWeight: 500,
          }}
        >
          ({docs.length})
        </span>
      </div>

      {docs.length === 0 ? (
        <GlassCard>
          <p
            style={{
              margin: 0,
              padding: "12px 4px",
              fontSize: 12,
              color: "rgba(245, 245, 247, 0.5)",
              textAlign: "center",
            }}
          >
            {emptyMessage}
          </p>
        </GlassCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              accent={accent}
              onEdit={() => onEdit(d)}
              onDelete={() => onDelete(d)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocRow({
  doc,
  accent,
  onEdit,
  onDelete,
}: {
  doc: ScopedDocument;
  accent: { fg: string; bg: string; border: string };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const days = daysRemaining(doc.expiry_date);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        backgroundColor: accent.bg,
        border: `1px solid ${accent.border}`,
        borderRadius: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#f5f5f7",
              letterSpacing: "-0.01em",
            }}
          >
            {doc.doc_type}
          </span>
          {doc.doc_number ? (
            <span
              className="tabular"
              style={{ fontSize: 12, color: "rgba(245, 245, 247, 0.55)" }}
            >
              {doc.doc_number}
            </span>
          ) : null}
          {doc.computed_alert ? <AlertStatusBadge status={doc.computed_alert} /> : null}
        </div>
        <DocMeta doc={doc} days={days} accentColor={accent.fg} />
      </div>
      <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
        {doc.file_url ? <FileAction fileUrl={doc.file_url} /> : null}
        <RowAction label="Edit" onClick={onEdit} />
        <RowAction label="Delete" onClick={onDelete} danger />
      </div>
    </div>
  );
}

function DocMeta({
  doc,
  days,
  accentColor,
}: {
  doc: ScopedDocument;
  days: number | null;
  accentColor: string;
}) {
  const parts: ReactNode[] = [];
  if (doc.expiry_date) {
    parts.push(
      <span key="exp" className="tabular">
        Expires {doc.expiry_date}
      </span>,
    );
    if (days !== null) {
      parts.push(
        <span
          key="days"
          className="tabular"
          style={{ color: accentColor, fontWeight: 600 }}
        >
          {days < 0 ? `${Math.abs(days)}d ago` : `${days}d left`}
        </span>,
      );
    }
  } else {
    parts.push(<span key="noexp">No expiry</span>);
  }
  if (doc.issue_date) {
    parts.push(
      <span key="iss" className="tabular">
        Issued {doc.issue_date}
      </span>,
    );
  }
  return (
    <div
      style={{
        marginTop: 4,
        fontSize: 12,
        color: "rgba(245, 245, 247, 0.6)",
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {parts.map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </div>
  );
}

function FileAction({ fileUrl }: { fileUrl: string }) {
  const [hover, setHover] = useState(false);
  const { showToast } = useToast();
  async function handleClick() {
    const supabase = createSupabaseClient();
    const { error } = await openComplianceFile(supabase, fileUrl);
    if (error) showToast(error, "error");
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="View file"
      title="View file"
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        color: hover ? "#d4b670" : "rgba(245, 245, 247, 0.55)",
        transition: "color 150ms ease-out",
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
      File
    </button>
  );
}

function RowAction({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const color = danger
    ? hover
      ? "#ef4444"
      : "rgba(239, 68, 68, 0.7)"
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
