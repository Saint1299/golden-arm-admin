"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { DocumentFormModal } from "./DocumentFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { ALERT_ACCENT, computeAlertStatus, daysRemaining } from "@/lib/compliance";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { AlertStatus, ApiDocument } from "@/types/database";

const goldButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(180deg, #D4B670 0%, #C9A961 100%)",
  color: "#080b12",
  border: "1px solid rgba(201, 169, 97, 0.4)",
  borderRadius: 8,
  padding: "9px 14px",
  fontWeight: 600,
  fontSize: 13.5,
  fontFamily: "inherit",
  letterSpacing: "-0.01em",
  cursor: "pointer",
};

type AlertDoc = ApiDocument & { computed_alert: AlertStatus };

// Focused, scoped compliance view for the client detail page: surfaces ONLY
// the client's due-soon / expired documents (most urgent first). The full
// Valid/Due/Expired board lives at /compliance; this is just the "needs
// attention" slice so the page doesn't duplicate the board.
export function ClientComplianceAlertPanel({
  clientName,
}: {
  clientName: string;
}) {
  const [docs, setDocs] = useState<AlertDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    { mode: "add" } | { mode: "edit"; doc: ApiDocument } | null
  >(null);

  const loadDocs = useCallback(async (): Promise<AlertDoc[]> => {
    const supabase = createSupabaseClient();
    // Client docs are matched by free-text name (migration 0008). ilike with
    // no wildcards = case-insensitive exact match; escape % and _ so a name
    // containing them isn't treated as a LIKE pattern.
    const escaped = clientName.replace(/[\\%_]/g, (m) => `\\${m}`);
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("scope", "client")
      .ilike("client_name_text", escaped)
      .order("expiry_date", { ascending: true, nullsFirst: false });
    return ((data ?? []) as ApiDocument[])
      .map((d) => ({ ...d, computed_alert: computeAlertStatus(d.expiry_date) }))
      .filter(
        (d): d is AlertDoc =>
          d.computed_alert === "expired" || d.computed_alert === "due_soon",
      );
  }, [clientName]);

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

  const refetch = useCallback(async () => {
    setDocs(await loadDocs());
  }, [loadDocs]);

  // Already sorted by expiry ascending from the query — expired (earliest
  // dates) naturally float to the top, then due-soon.
  const sorted = useMemo(() => docs, [docs]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#f5f5f7",
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          Documents needing attention
        </h2>
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
          Add document for this client
        </button>
      </div>

      {loading ? (
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
            Loading…
          </p>
        </GlassCard>
      ) : sorted.length === 0 ? (
        <AllCurrent />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((d) => (
            <AlertRow
              key={d.id}
              doc={d}
              onClick={() => setModal({ mode: "edit", doc: d })}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <Link
          href="/compliance"
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: "rgba(245, 245, 247, 0.6)",
            textDecoration: "none",
          }}
        >
          View all documents for this client →
        </Link>
      </div>

      {modal?.mode === "add" ? (
        <DocumentFormModal
          initialDoc={null}
          allowedScopes={["client"]}
          presetClientName={clientName}
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
          allowedScopes={["client"]}
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

function AlertRow({
  doc,
  onClick,
}: {
  doc: AlertDoc;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const accent = ALERT_ACCENT[doc.computed_alert];
  const days = daysRemaining(doc.expiry_date);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        backgroundColor: accent.bg,
        border: `1px solid ${accent.border}`,
        borderRadius: 10,
        cursor: "pointer",
        fontFamily: "inherit",
        filter: hover ? "brightness(1.12)" : "none",
        transition: "filter 150ms ease-out",
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
        </div>
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
          <span>Client document</span>
          {doc.expiry_date ? (
            <span className="tabular">Expires {doc.expiry_date}</span>
          ) : null}
          {doc.issuing_agency ? <span>Issued by {doc.issuing_agency}</span> : null}
        </div>
      </div>
      <span
        className="tabular"
        style={{
          flexShrink: 0,
          fontSize: 12.5,
          fontWeight: 600,
          color: accent.fg,
          textAlign: "right",
        }}
      >
        {days === null
          ? ""
          : days < 0
            ? `expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
            : `${days} day${days === 1 ? "" : "s"} left`}
      </span>
    </button>
  );
}

function AllCurrent() {
  return (
    <GlassCard>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "20px 4px",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#d4b670"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span style={{ fontSize: 13, color: "rgba(245, 245, 247, 0.7)" }}>
          All documents current.
        </span>
      </div>
    </GlassCard>
  );
}
