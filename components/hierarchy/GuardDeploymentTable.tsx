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
import { ClientFormModal } from "./ClientFormModal";
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

// A full Guard plus the joined client display fields. Carrying the whole
// Guard means the edit modal prefills every field without a refetch, and
// client_name/client_type are null for unassigned guards (client_id null).
export type GuardDeploymentRow = Guard & {
  client_name: string | null;
  client_type: ClientType | null;
};

type RawGuardRow = Guard & {
  client: Pick<Client, "id" | "name" | "type"> | null;
};

const UNASSIGNED_ID = "__unassigned__";

function toRow(g: RawGuardRow): GuardDeploymentRow {
  const { client, ...guard } = g;
  return {
    ...guard,
    client_name: client?.name ?? null,
    client_type: client?.type ?? null,
  };
}

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
  clients: initialClients,
}: {
  initialRows: GuardDeploymentRow[];
  clients: Client[];
}) {
  const [rows, setRows] = useState<GuardDeploymentRow[]>(initialRows);
  // clients is mutable state — adding/editing/deleting a client from this
  // page needs to flow back into the dropdown filter + the modal pickers
  // without a full page reload.
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [clientFilter, setClientFilter] = useState<Set<string>>(new Set());
  const [locationFilter, setLocationFilter] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [guardModal, setGuardModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; guard: Guard }
    | null
  >(null);
  const [clientModal, setClientModal] = useState<{
    open: boolean;
    editing: Client | null;
  }>({ open: false, editing: null });
  const [bulkMode, setBulkMode] = useState<"clients" | "guards" | null>(null);
  const { showToast } = useToast();

  // Fast lookup of client by id for the section-header edit handler.
  const clientById = useMemo(() => {
    const m = new Map<string, Client>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
    const [guardsRes, clientsRes] = await Promise.all([
      supabase
        .from("guards")
        .select("*, client:clients(id, name, type)")
        .order("full_name", { ascending: true }),
      supabase.from("clients").select("*").order("name", { ascending: true }),
    ]);
    setClients((clientsRes.data ?? []) as Client[]);
    setRows(((guardsRes.data ?? []) as RawGuardRow[]).map(toRow));
  }, []);

  // Distinct deployment locations across all rows, for the location filter.
  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.deployment_location) set.add(r.deployment_location);
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false;
      if (
        clientFilter.size > 0 &&
        (r.client_id === null || !clientFilter.has(r.client_id))
      )
        return false;
      if (
        locationFilter.size > 0 &&
        (r.deployment_location === null ||
          !locationFilter.has(r.deployment_location))
      )
        return false;
      if (q) {
        const hay = `${r.full_name} ${r.id_number ?? ""} ${r.license_no ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, clientFilter, locationFilter, search]);

  // Group filtered guards by client. Sections with zero matching guards
  // after filters are skipped entirely (spec). Unassigned guards (client_id
  // null) collect into a single section pinned to the bottom.
  const sections = useMemo(() => {
    const byClient = new Map<
      string,
      {
        id: string;
        name: string;
        guards: GuardDeploymentRow[];
        unassigned?: boolean;
      }
    >();
    const unassigned: GuardDeploymentRow[] = [];
    for (const g of filtered) {
      if (g.client_id === null) {
        unassigned.push(g);
        continue;
      }
      const existing = byClient.get(g.client_id);
      if (existing) {
        existing.guards.push(g);
      } else {
        byClient.set(g.client_id, {
          id: g.client_id,
          name: g.client_name ?? "Unknown client",
          guards: [g],
        });
      }
    }
    const arr = Array.from(byClient.values());
    arr.sort((a, b) => a.name.localeCompare(b.name));
    for (const s of arr)
      s.guards.sort((a, b) => a.full_name.localeCompare(b.full_name));
    if (unassigned.length > 0) {
      unassigned.sort((a, b) => a.full_name.localeCompare(b.full_name));
      arr.push({
        id: UNASSIGNED_ID,
        name: "Unassigned",
        guards: unassigned,
        unassigned: true,
      });
    }
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

  function handleEditClient(clientId: string) {
    const c = clientById.get(clientId);
    if (!c) return;
    setClientModal({ open: true, editing: c });
  }

  async function handleDeleteClient(clientId: string) {
    const c = clientById.get(clientId);
    if (!c) return;
    const ok = window.confirm(
      `Delete "${c.name}"? Clients with guards can't be deleted until their guards are removed.`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId);
    if (error) {
      const msg = /foreign key|violates/i.test(error.message)
        ? "Client has guards and can't be deleted. Reassign or remove them first."
        : error.message;
      showToast(msg, "error");
      return;
    }
    showToast("Client deleted", "success");
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
          {/* Client actions are always enabled — they don't depend on
              existing data and they're the unblocker for the guard
              actions, which we visibly disable when there are zero
              clients (see comment below the client buttons). */}
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => setBulkMode("clients")}
            title="Import clients from a CSV"
          >
            Bulk import clients
          </button>
          <button
            type="button"
            style={addButtonStyle}
            onClick={() =>
              setClientModal({ open: true, editing: null })
            }
            title="Add a new client"
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
            Add client
          </button>
          {/* Guard actions need at least one client (the guard CSV
              resolves by client_name, and a single Add Guard requires a
              client_id FK). When there are no clients we leave the
              buttons rendered so the title-tooltip still surfaces on
              hover — but we drop the disabled attribute and visibly grey
              them out, since native `disabled` suppresses pointer events
              (and the tooltip) on most browsers. onClick is a no-op when
              gated, so there's no functional click. */}
          {(() => {
            const guardActionsGated = clients.length === 0;
            return (
              <>
                <button
                  type="button"
                  style={{
                    ...secondaryButtonStyle,
                    opacity: guardActionsGated ? 0.45 : 1,
                    cursor: guardActionsGated ? "not-allowed" : "pointer",
                  }}
                  aria-disabled={guardActionsGated}
                  onClick={
                    guardActionsGated ? undefined : () => setBulkMode("guards")
                  }
                  title={
                    guardActionsGated
                      ? "Add a client first — guards need a client to be assigned to."
                      : "Import guards from a CSV"
                  }
                >
                  Bulk import guards
                </button>
                <button
                  type="button"
                  style={{
                    ...addButtonStyle,
                    opacity: guardActionsGated ? 0.45 : 1,
                    cursor: guardActionsGated ? "not-allowed" : "pointer",
                    filter: guardActionsGated ? "saturate(0.55)" : "none",
                  }}
                  aria-disabled={guardActionsGated}
                  onClick={
                    guardActionsGated
                      ? undefined
                      : () => setGuardModal({ mode: "add" })
                  }
                  title={
                    guardActionsGated
                      ? "Add a client first — guards need a client to be assigned to."
                      : "Add a new guard"
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
              </>
            );
          })()}
        </div>
      </div>

      <div style={{ height: 24 }} />

      {/* Filter row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(200px, 1fr) minmax(150px, 200px) minmax(150px, 200px) minmax(150px, 200px)",
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
            placeholder="Name, ID number, license…"
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
        <div>
          <FilterLabel>Deployment location</FilterLabel>
          <MultiSelectDropdown
            label="Location"
            options={locationOptions}
            selected={locationFilter}
            onChange={setLocationFilter}
            emptyText="All locations"
          />
        </div>
      </div>

      <GlassCard style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <Empty
            hasClients={clients.length > 0}
            onAddClient={() =>
              setClientModal({ open: true, editing: null })
            }
            onBulkImportClients={() => setBulkMode("clients")}
          />
        ) : sections.length === 0 ? (
          <FilteredEmpty />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Name</th>
                  <th style={headerCellStyle}>ID Number</th>
                  <th style={headerCellStyle}>License No</th>
                  <th style={headerCellStyle}>Status</th>
                  <th style={headerCellStyle}>Contact</th>
                  <th style={headerCellStyle}>Deployment Location</th>
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
                      unassigned={section.unassigned ?? false}
                      onToggle={() => toggleCollapsed(section.id)}
                      onEditClient={() => handleEditClient(section.id)}
                      onDeleteClient={() => handleDeleteClient(section.id)}
                    >
                      {!isCollapsed
                        ? section.guards.map((g, idx) => (
                            <GuardRow
                              key={g.id}
                              guard={g}
                              striped={idx % 2 === 1}
                              onEdit={() =>
                                setGuardModal({
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

      {guardModal?.mode === "add" ? (
        <GuardFormModal
          clientId={null}
          initialGuard={null}
          clients={clients}
          onClose={() => setGuardModal(null)}
          onSaved={() => {
            setGuardModal(null);
            refetch();
          }}
        />
      ) : null}

      {guardModal?.mode === "edit" ? (
        <GuardFormModal
          clientId={guardModal.guard.client_id}
          initialGuard={guardModal.guard}
          clients={clients}
          onClose={() => setGuardModal(null)}
          onSaved={() => {
            setGuardModal(null);
            refetch();
          }}
        />
      ) : null}

      {bulkMode ? (
        <BulkImportModal
          mode={bulkMode}
          onClose={() => setBulkMode(null)}
          onCompleted={() => {
            setBulkMode(null);
            refetch();
          }}
        />
      ) : null}

      {clientModal.open ? (
        <ClientFormModal
          initialClient={clientModal.editing}
          onClose={() => setClientModal({ open: false, editing: null })}
          onSaved={() => {
            setClientModal({ open: false, editing: null });
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function rowToGuard(row: GuardDeploymentRow): Guard {
  // The row IS a Guard plus two joined display fields; strip those.
  const { client_name: _name, client_type: _type, ...guard } = row;
  void _name;
  void _type;
  return guard;
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
  unassigned,
  onToggle,
  onEditClient,
  onDeleteClient,
  children,
}: {
  sectionId: string;
  name: string;
  count: number;
  collapsed: boolean;
  unassigned: boolean;
  onToggle: () => void;
  onEditClient: () => void;
  onDeleteClient: () => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  // The Unassigned section is deliberately quieter than client sections:
  // no client link, no edit/delete actions, a muted header tint and a
  // grey count chip — it reads as a holding bucket, not a real client.
  const baseBg = unassigned
    ? "rgba(255, 255, 255, 0.012)"
    : "rgba(255, 255, 255, 0.025)";
  return (
    <>
      <tr
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          cursor: "pointer",
          backgroundColor: hover
            ? unassigned
              ? "rgba(255, 255, 255, 0.04)"
              : "rgba(201, 169, 97, 0.06)"
            : baseBg,
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
              stroke="rgba(245, 245, 247, 0.4)"
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
            {unassigned ? (
              <span
                style={{
                  color: "rgba(245, 245, 247, 0.55)",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  fontStyle: "italic",
                }}
              >
                {name}
              </span>
            ) : (
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
            )}
            <span
              className="tabular"
              style={{
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: unassigned
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(201, 169, 97, 0.14)",
                color: unassigned ? "rgba(245, 245, 247, 0.5)" : "#d4b670",
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              {count}
            </span>
            <span style={{ flex: 1 }} />
            {unassigned ? (
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(245, 245, 247, 0.35)",
                  flexShrink: 0,
                }}
              >
                Needs client assignment
              </span>
            ) : (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "inline-flex",
                  gap: 14,
                  flexShrink: 0,
                }}
              >
                <SectionAction label="Edit" onClick={onEditClient} />
                <SectionAction
                  label="Delete"
                  onClick={onDeleteClient}
                  danger
                />
              </div>
            )}
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}

function SectionAction({
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
        {guard.id_number ?? "—"}
      </td>
      <td style={bodyCellStyle} className="tabular">
        {guard.license_no ?? "—"}
      </td>
      <td style={bodyCellStyle}>
        <GuardStatusBadge status={guard.status} />
      </td>
      <td style={bodyCellStyle} className="tabular">
        {guard.contact_no ?? "—"}
      </td>
      <td style={bodyCellStyle}>{guard.deployment_location ?? "—"}</td>
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

function Empty({
  hasClients,
  onAddClient,
  onBulkImportClients,
}: {
  hasClients: boolean;
  onAddClient: () => void;
  onBulkImportClients: () => void;
}) {
  // Two distinct empty states. Without clients, the user can't deploy any
  // guard yet — make the dependency obvious and point them at the action
  // that unblocks them.
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#f5f5f7",
          letterSpacing: "-0.01em",
          margin: 0,
        }}
      >
        {hasClients ? "No guards yet" : "No clients yet"}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "rgba(245, 245, 247, 0.6)",
          maxWidth: 380,
          lineHeight: 1.5,
        }}
      >
        {hasClients
          ? "Use the Add guard button above to deploy your first guard under an existing client."
          : "Add a client before you can deploy guards. Guards are always assigned to a client."}
      </p>
      {!hasClients ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 2,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={onAddClient}
            style={{
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
            }}
          >
            Add client
          </button>
          <span
            style={{
              fontSize: 12,
              color: "rgba(245, 245, 247, 0.45)",
            }}
          >
            or{" "}
            <button
              type="button"
              onClick={onBulkImportClients}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: 12,
                color: "rgba(245, 245, 247, 0.75)",
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "underline",
                textDecorationColor: "rgba(245, 245, 247, 0.3)",
              }}
            >
              bulk import clients
            </button>
          </span>
        </div>
      ) : null}
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
