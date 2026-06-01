"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { GuardStatusBadge } from "./badges";
import { BulkImportModal } from "./BulkImportModal";
import { GuardFormModal } from "./GuardFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { MultiSelectDropdown } from "@/components/ui/MultiSelectDropdown";
import { TextInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  GUARD_STATUS_LABEL,
  type Client,
  type ClientType,
  type Guard,
  type GuardStatus,
} from "@/types/database";

export type GuardDeploymentRow = {
  id: string;
  client_id: string;
  client_name: string;
  client_type: ClientType;
  org_node_id: string | null;
  full_name: string;
  employee_no: string | null;
  sosia_license: string | null;
  contact_no: string | null;
  date_deployed: string | null;
  status: GuardStatus;
  notes: string | null;
  created_at: string;
};

type RawGuardRow = Guard & {
  client: Pick<Client, "id" | "name" | "type"> | null;
};

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

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "rgba(245, 245, 247, 0.8)",
  borderRadius: 8,
  padding: "9px 14px",
  fontWeight: 500,
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer",
  textDecoration: "none",
};

const headerCellStyle: CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(245, 245, 247, 0.4)",
  padding: "10px 14px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  whiteSpace: "nowrap",
};

const bodyCellStyle: CSSProperties = {
  fontSize: 13,
  color: "rgba(245, 245, 247, 0.65)",
  padding: "12px 14px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
  whiteSpace: "nowrap",
};

const STATUS_OPTIONS = (
  ["active", "reliever", "on_leave", "inactive"] as GuardStatus[]
).map((s) => ({ value: s, label: GUARD_STATUS_LABEL[s] }));

export function GuardDeploymentTable({
  initialRows,
  clients,
}: {
  initialRows: GuardDeploymentRow[];
  clients: Client[];
}) {
  const [rows, setRows] = useState<GuardDeploymentRow[]>(initialRows);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [clientFilter, setClientFilter] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; guard: Guard }
    | null
  >(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { showToast } = useToast();

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("guards")
      .select("*, client:clients(id, name, type)")
      .order("full_name", { ascending: true });
    const next: GuardDeploymentRow[] = ((data ?? []) as RawGuardRow[]).map(
      (g) => ({
        id: g.id,
        client_id: g.client_id,
        client_name: g.client?.name ?? "Unknown client",
        client_type: g.client?.type ?? "single_post",
        org_node_id: g.org_node_id,
        full_name: g.full_name,
        employee_no: g.employee_no,
        sosia_license: g.sosia_license,
        contact_no: g.contact_no,
        date_deployed: g.date_deployed,
        status: g.status,
        notes: g.notes,
        created_at: g.created_at,
      }),
    );
    setRows(next);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false;
      if (clientFilter.size > 0 && !clientFilter.has(r.client_id))
        return false;
      if (q) {
        const hay = `${r.full_name} ${r.employee_no ?? ""} ${r.sosia_license ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, clientFilter, search]);

  // Group filtered guards by client. Sections with zero matching guards
  // after filters are skipped entirely (spec).
  const sections = useMemo(() => {
    const byClient = new Map<
      string,
      { id: string; name: string; guards: GuardDeploymentRow[] }
    >();
    for (const g of filtered) {
      const existing = byClient.get(g.client_id);
      if (existing) {
        existing.guards.push(g);
      } else {
        byClient.set(g.client_id, {
          id: g.client_id,
          name: g.client_name,
          guards: [g],
        });
      }
    }
    const arr = Array.from(byClient.values());
    arr.sort((a, b) => a.name.localeCompare(b.name));
    for (const s of arr) s.guards.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return arr;
  }, [filtered]);

  function toggleCollapsed(clientId: string) {
    const next = new Set(collapsed);
    if (next.has(clientId)) next.delete(clientId);
    else next.add(clientId);
    setCollapsed(next);
  }

  async function handleDelete(guard: Guard) {
    const ok = window.confirm(
      `Delete ${guard.full_name}? This permanently removes the guard record and cannot be undone.`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("guards")
      .delete()
      .eq("id", guard.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Guard deleted", "success");
    refetch();
  }

  const clientOptions = useMemo(
    () => clients.map((c) => ({ value: c.id, label: c.name })),
    [clients],
  );

  return (
    <div style={{ maxWidth: 1320 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
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
            Guard Deployment
          </h1>
          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              fontSize: 14,
              color: "rgba(245, 245, 247, 0.6)",
            }}
          >
            All deployed guards, grouped by client. Filter by status or
            client to narrow the view.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/hierarchy/clients" style={secondaryButtonStyle}>
            Manage clients
          </Link>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => setBulkOpen(true)}
            disabled={clients.length === 0}
            title={
              clients.length === 0
                ? "Add a client first"
                : "Import guards from a CSV"
            }
          >
            Bulk import
          </button>
          <button
            type="button"
            style={addButtonStyle}
            onClick={() => setModal({ mode: "add" })}
            disabled={clients.length === 0}
            title={
              clients.length === 0 ? "Add a client first" : "Add a new guard"
            }
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
            Add guard
          </button>
        </div>
      </div>

      <div style={{ height: 24 }} />

      {/* Filter row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(220px, 1fr) minmax(160px, 220px) minmax(160px, 220px)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <FilterLabel htmlFor="gp-search">Search</FilterLabel>
          <TextInput
            id="gp-search"
            value={search}
            onChange={setSearch}
            placeholder="Name, employee no., SOSIA…"
          />
        </div>
        <div>
          <FilterLabel>Status</FilterLabel>
          <MultiSelectDropdown
            label="Status"
            options={STATUS_OPTIONS}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
        <div>
          <FilterLabel>Client</FilterLabel>
          <MultiSelectDropdown
            label="Client"
            options={clientOptions}
            selected={clientFilter}
            onChange={setClientFilter}
          />
        </div>
      </div>

      <GlassCard style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <Empty />
        ) : sections.length === 0 ? (
          <FilteredEmpty />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Name</th>
                  <th style={headerCellStyle}>Employee #</th>
                  <th style={headerCellStyle}>SOSIA License</th>
                  <th style={headerCellStyle}>Contact</th>
                  <th style={headerCellStyle}>Date deployed</th>
                  <th style={headerCellStyle}>Status</th>
                  <th
                    style={{
                      ...headerCellStyle,
                      textAlign: "right",
                      width: 100,
                    }}
                  />
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => {
                  const isCollapsed = collapsed.has(section.id);
                  return (
                    <ClientSection
                      key={section.id}
                      sectionId={section.id}
                      name={section.name}
                      count={section.guards.length}
                      collapsed={isCollapsed}
                      onToggle={() => toggleCollapsed(section.id)}
                    >
                      {!isCollapsed
                        ? section.guards.map((g, idx) => (
                            <GuardRow
                              key={g.id}
                              guard={g}
                              striped={idx % 2 === 1}
                              onEdit={() =>
                                setModal({
                                  mode: "edit",
                                  guard: rowToGuard(g),
                                })
                              }
                              onDelete={() => handleDelete(rowToGuard(g))}
                            />
                          ))
                        : null}
                    </ClientSection>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {modal?.mode === "add" ? (
        <GuardFormModal
          clientId={null}
          initialGuard={null}
          clients={clients}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refetch();
          }}
        />
      ) : null}

      {modal?.mode === "edit" ? (
        <GuardFormModal
          clientId={modal.guard.client_id}
          initialGuard={modal.guard}
          clients={clients}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refetch();
          }}
        />
      ) : null}

      {bulkOpen ? (
        <BulkImportModal
          mode="guards"
          onClose={() => setBulkOpen(false)}
          onCompleted={() => {
            setBulkOpen(false);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function rowToGuard(row: GuardDeploymentRow): Guard {
  return {
    id: row.id,
    client_id: row.client_id,
    org_node_id: row.org_node_id,
    full_name: row.full_name,
    employee_no: row.employee_no,
    sosia_license: row.sosia_license,
    contact_no: row.contact_no,
    date_deployed: row.date_deployed,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
  };
}

function FilterLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
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

function ClientSection({
  sectionId,
  name,
  count,
  collapsed,
  onToggle,
  children,
}: {
  sectionId: string;
  name: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <>
      <tr
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          cursor: "pointer",
          backgroundColor: hover
            ? "rgba(201, 169, 97, 0.06)"
            : "rgba(255, 255, 255, 0.025)",
          transition: "background-color 150ms ease-out",
        }}
        aria-expanded={!collapsed}
      >
        <td
          colSpan={7}
          style={{
            padding: "10px 14px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <svg
              aria-hidden
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(245, 245, 247, 0.55)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
                transition: "transform 150ms ease-out",
                flexShrink: 0,
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <Link
              href={`/hierarchy/clients/${sectionId}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                color: "#f5f5f7",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              {name}
            </Link>
            <span
              className="tabular"
              style={{
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: "rgba(201, 169, 97, 0.14)",
                color: "#d4b670",
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              {count}
            </span>
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}

function GuardRow({
  guard,
  striped,
  onEdit,
  onDelete,
}: {
  guard: GuardDeploymentRow;
  striped: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [hover, setHover] = useState(false);
  const baseBg = striped ? "rgba(255, 255, 255, 0.015)" : "transparent";
  const bg = hover ? "rgba(255, 255, 255, 0.035)" : baseBg;
  return (
    <tr
      onClick={() => router.push(`/hierarchy/guards/${guard.id}`)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        backgroundColor: bg,
        cursor: "pointer",
        transition: "background-color 150ms ease-out",
      }}
    >
      <td style={{ ...bodyCellStyle, color: "#f5f5f7", fontWeight: 500 }}>
        {guard.full_name}
      </td>
      <td style={bodyCellStyle} className="tabular">
        {guard.employee_no ?? "—"}
      </td>
      <td style={bodyCellStyle} className="tabular">
        {guard.sosia_license ?? "—"}
      </td>
      <td style={bodyCellStyle} className="tabular">
        {guard.contact_no ?? "—"}
      </td>
      <td style={bodyCellStyle} className="tabular">
        {guard.date_deployed ?? "—"}
      </td>
      <td style={bodyCellStyle}>
        <GuardStatusBadge status={guard.status} />
      </td>
      <td
        style={{ ...bodyCellStyle, textAlign: "right" }}
        onClick={(e) => e.stopPropagation()}
      >
        <RowAction label="Edit" onClick={onEdit} />
        <span style={{ display: "inline-block", width: 10 }} />
        <RowAction label="Delete" onClick={onDelete} danger />
      </td>
    </tr>
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
      : "rgba(245, 245, 247, 0.5)";
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

function Empty() {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#f5f5f7",
          letterSpacing: "-0.01em",
          margin: 0,
        }}
      >
        No guards yet
      </h3>
      <p
        style={{
          marginTop: 8,
          marginBottom: 0,
          fontSize: 13,
          color: "rgba(245, 245, 247, 0.6)",
          maxWidth: 360,
          marginInline: "auto",
        }}
      >
        Add your first client (Manage clients), then start adding guards
        under them.
      </p>
    </div>
  );
}

function FilteredEmpty() {
  return (
    <div
      style={{
        padding: "40px 24px",
        textAlign: "center",
        color: "rgba(245, 245, 247, 0.6)",
        fontSize: 13,
      }}
    >
      No guards match the current filters.
    </div>
  );
}
