"use client";

import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AlertStatusBadge, ScopeBadge } from "./badges";
import { DocumentFormModal } from "./DocumentFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { SelectInput, TextInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { ALERT_ACCENT } from "@/lib/compliance";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  DOCUMENT_SCOPE_LABEL,
  type AlertStatus,
  type ApiDocument,
  type ComplianceBoardRow,
  type Region,
} from "@/types/database";

const addButtonStyle: CSSProperties = {
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

// Board is company + client only — guard-scoped docs are managed on the
// guard detail page. "All" therefore semantically means "All of company +
// client".
const BOARD_SCOPES: Array<"company" | "client"> = ["company", "client"];

const SCOPE_FILTER_OPTIONS = [
  { value: "all", label: "All scopes" },
  ...BOARD_SCOPES.map((s) => ({
    value: s,
    label: DOCUMENT_SCOPE_LABEL[s],
  })),
];

export function ComplianceBoard({
  initialRows,
  regions,
}: {
  initialRows: ComplianceBoardRow[];
  regions: Region[];
}) {
  const [rows, setRows] = useState<ComplianceBoardRow[]>(initialRows);
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; doc: ApiDocument }
    | { mode: "edit-loading"; id: string }
    | null
  >(null);
  const { showToast } = useToast();

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("compliance_board")
      .select("*")
      .in("scope", ["company", "client"])
      .order("expiry_date", { ascending: true, nullsFirst: false });
    setRows((data ?? []) as ComplianceBoardRow[]);
  }, []);

  const regionOptions = useMemo(
    () => [
      { value: "all", label: "All regions" },
      ...regions.map((r) => ({ value: r.name, label: r.name })),
    ],
    [regions],
  );

  const regionFilterApplies = scopeFilter === "guard" || scopeFilter === "client";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (scopeFilter !== "all" && r.scope !== scopeFilter) return false;
      if (regionFilterApplies && regionFilter !== "all") {
        if (r.region_name !== regionFilter) return false;
      }
      if (q) {
        if (!r.doc_type.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, scopeFilter, regionFilter, regionFilterApplies, search]);

  const grouped = useMemo(() => {
    const expired: ComplianceBoardRow[] = [];
    const due: ComplianceBoardRow[] = [];
    const ok: ComplianceBoardRow[] = [];
    for (const r of filtered) {
      if (r.alert_status === "expired") expired.push(r);
      else if (r.alert_status === "due_soon") due.push(r);
      else ok.push(r);
    }
    return { expired, due, ok };
  }, [filtered]);

  async function openEdit(id: string) {
    setModal({ mode: "edit-loading", id });
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      showToast(error?.message ?? "Couldn’t load document", "error");
      setModal(null);
      return;
    }
    setModal({ mode: "edit", doc: data as ApiDocument });
  }

  async function handleDelete(row: ComplianceBoardRow) {
    const ok = window.confirm(
      `Delete "${row.doc_type}"? This cannot be undone.`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", row.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Document deleted", "success");
    refetch();
  }

  return (
    <div style={{ maxWidth: 1280 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#f5f5f7",
              margin: 0,
            }}
          >
            Compliance Board
          </h1>
          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              fontSize: 14,
              color: "rgba(245, 245, 247, 0.6)",
            }}
          >
            Licenses, clearances, and contracts across guards, clients, and the
            company. Expired and due-soon documents surface first.
          </p>
        </div>
        <button
          type="button"
          style={addButtonStyle}
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
          Add document
        </button>
      </div>

      <div style={{ height: 24 }} />

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(220px, 1fr) minmax(180px, 240px) minmax(180px, 240px)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <FilterLabel htmlFor="cb-search">Search</FilterLabel>
          <TextInput
            id="cb-search"
            value={search}
            onChange={setSearch}
            placeholder="Search document type…"
          />
        </div>
        <div>
          <FilterLabel htmlFor="cb-scope">Scope</FilterLabel>
          <SelectInput
            id="cb-scope"
            value={scopeFilter}
            onChange={setScopeFilter}
            options={SCOPE_FILTER_OPTIONS}
          />
        </div>
        <div>
          <FilterLabel htmlFor="cb-region">Region</FilterLabel>
          <SelectInput
            id="cb-region"
            value={regionFilter}
            onChange={setRegionFilter}
            options={regionOptions}
            disabled={!regionFilterApplies}
          />
          {!regionFilterApplies ? (
            <p
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "rgba(245, 245, 247, 0.4)",
              }}
            >
              Region applies only to guard / client scope.
            </p>
          ) : null}
        </div>
      </div>

      {/* Sections */}
      <Section
        title="Valid"
        count={grouped.ok.length}
        status="ok"
        emptyMessage="No documents match the current filters."
        rows={grouped.ok}
        onEdit={(r) => openEdit(r.id)}
        onDelete={handleDelete}
      />
      <Section
        title="Due Soon"
        count={grouped.due.length}
        status="due_soon"
        emptyMessage="Nothing due in the next 30 days."
        rows={grouped.due}
        collapsible
        defaultExpanded={false}
        onEdit={(r) => openEdit(r.id)}
        onDelete={handleDelete}
      />
      <Section
        title="Expired"
        count={grouped.expired.length}
        status="expired"
        emptyMessage="Nothing expired. Keep it that way."
        rows={grouped.expired}
        collapsible
        defaultExpanded={false}
        onEdit={(r) => openEdit(r.id)}
        onDelete={handleDelete}
      />

      {modal?.mode === "edit-loading" ? (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(245, 245, 247, 0.7)",
            fontSize: 13,
          }}
        >
          Loading document…
        </div>
      ) : null}

      {modal?.mode === "add" ? (
        <DocumentFormModal
          initialDoc={null}
          allowedScopes={["client", "company"]}
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
          allowedScopes={["client", "company"]}
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

function FilterLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        color: "rgba(245, 245, 247, 0.6)",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

function Section({
  title,
  count,
  status,
  emptyMessage,
  rows,
  collapsible = false,
  defaultExpanded = true,
  onEdit,
  onDelete,
}: {
  title: string;
  count: number;
  status: AlertStatus;
  emptyMessage: string;
  rows: ComplianceBoardRow[];
  // Collapsible sections show a clickable header with a rotating chevron
  // and hide their content when collapsed. Always-expanded sections (Valid)
  // omit the chevron entirely so they read as the primary view.
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onEdit: (row: ComplianceBoardRow) => void;
  onDelete: (row: ComplianceBoardRow) => void;
}) {
  const accent = ALERT_ACCENT[status];
  const [expanded, setExpanded] = useState(defaultExpanded);
  const open = collapsible ? expanded : true;
  const contentId = `compliance-section-${status}`;

  const headerInner = (
    <>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: accent.fg,
        }}
      />
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "#f5f5f7",
          letterSpacing: "-0.01em",
          margin: 0,
        }}
      >
        {title}
      </h2>
      <span
        className="tabular"
        style={{
          fontSize: 12,
          color: "rgba(245, 245, 247, 0.5)",
          fontWeight: 500,
        }}
      >
        ({count})
      </span>
      {collapsible ? (
        <span style={{ flex: 1 }} />
      ) : null}
      {collapsible ? (
        <svg
          aria-hidden
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(245, 245, 247, 0.55)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease-out",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      ) : null}
    </>
  );

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  };

  return (
    <div style={{ marginBottom: 28 }}>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((v) => !v)}
          style={{
            ...headerStyle,
            width: "100%",
            background: "transparent",
            border: "none",
            padding: "4px 0",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
            color: "inherit",
          }}
        >
          {headerInner}
        </button>
      ) : (
        <div style={headerStyle}>{headerInner}</div>
      )}

      {open ? (
        <div id={contentId}>
          {rows.length === 0 ? (
            <GlassCard>
              <p
                style={{
                  margin: 0,
                  padding: "16px 4px",
                  fontSize: 13,
                  color: "rgba(245, 245, 247, 0.5)",
                  textAlign: "center",
                }}
              >
                {emptyMessage}
              </p>
            </GlassCard>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 14,
              }}
            >
              {rows.map((row) => (
                <DocCard
                  key={row.id}
                  row={row}
                  accent={accent}
                  onEdit={() => onEdit(row)}
                  onDelete={() => onDelete(row)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DocCard({
  row,
  accent,
  onEdit,
  onDelete,
}: {
  row: ComplianceBoardRow;
  accent: { fg: string; bg: string; border: string };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  const subject =
    row.scope === "guard"
      ? row.guard_name ?? "Unknown guard"
      : row.scope === "client"
        ? row.client_name ?? "Unknown client"
        : "Company";

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        backgroundColor: accent.bg,
        border: `1px solid ${hover ? accent.fg : accent.border}`,
        borderRadius: 12,
        boxShadow:
          "0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.04)",
        padding: 16,
        transition: "border-color 200ms ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "#f5f5f7",
            letterSpacing: "-0.01em",
            wordBreak: "break-word",
          }}
        >
          {row.doc_type}
        </h3>
        <ScopeBadge scope={row.scope} />
      </div>

      {row.doc_number ? (
        <div
          className="tabular"
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "rgba(245, 245, 247, 0.55)",
          }}
        >
          {row.doc_number}
        </div>
      ) : null}

      <div style={{ height: 10 }} />

      <div
        style={{
          fontSize: 13,
          color: "rgba(245, 245, 247, 0.8)",
          fontWeight: 500,
        }}
      >
        {subject}
      </div>
      {row.region_name ? (
        <div style={{ fontSize: 11, color: "rgba(245, 245, 247, 0.5)" }}>
          {row.region_name}
        </div>
      ) : null}

      <div style={{ height: 12 }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "rgba(245, 245, 247, 0.6)",
          }}
        >
          {row.expiry_date ? (
            <>
              Expires <span className="tabular">{row.expiry_date}</span>
              {row.days_remaining !== null ? (
                <>
                  {" · "}
                  <span
                    className="tabular"
                    style={{ color: accent.fg, fontWeight: 600 }}
                  >
                    {row.days_remaining < 0
                      ? `${Math.abs(row.days_remaining)}d ago`
                      : `${row.days_remaining}d left`}
                  </span>
                </>
              ) : null}
            </>
          ) : (
            <span style={{ color: "rgba(245, 245, 247, 0.4)" }}>
              No expiry
            </span>
          )}
        </div>
        {row.alert_status ? <AlertStatusBadge status={row.alert_status} /> : null}
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
        }}
      >
        <CardAction label="Edit" onClick={onEdit} />
        <CardAction label="Delete" onClick={onDelete} danger />
      </div>
    </div>
  );
}

function CardAction({
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
