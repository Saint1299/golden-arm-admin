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
import { ClientTypeBadge, GuardStatusBadge } from "./badges";
import { ClientFormModal } from "./ClientFormModal";
import { GuardFormModal } from "./GuardFormModal";
import { SubjectCompliancePanel } from "@/components/compliance/SubjectCompliancePanel";
import { GlassCard } from "@/components/ui/GlassCard";
import { SelectInput, TextInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  GUARD_STATUS_LABEL,
  type Client,
  type Guard,
  type GuardStatus,
} from "@/types/database";

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

const secondaryButtonStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "rgba(245, 245, 247, 0.8)",
  borderRadius: 8,
  padding: "9px 16px",
  fontWeight: 500,
  fontSize: 14,
  fontFamily: "inherit",
  cursor: "pointer",
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

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...(["active", "reliever", "on_leave", "inactive"] as GuardStatus[]).map(
    (s) => ({ value: s, label: GUARD_STATUS_LABEL[s] }),
  ),
];

export function ClientDetailView({
  client: initialClient,
  clients,
  initialGuards,
}: {
  client: Client;
  clients: Client[];
  initialGuards: Guard[];
}) {
  const router = useRouter();
  const { showToast } = useToast();

  // The client itself can be edited — keep it in state so post-edit refetch
  // reflects in the header / info card without a full page reload.
  const [client, setClient] = useState<Client>(initialClient);

  const [guards, setGuards] = useState<Guard[]>(initialGuards);
  const [guardModalOpen, setGuardModalOpen] = useState(false);
  const [clientEditOpen, setClientEditOpen] = useState(false);

  // Guards section filters.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
    const [clientRes, guardsRes] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("id", client.id)
        .maybeSingle(),
      supabase
        .from("guards")
        .select("*")
        .eq("client_id", client.id)
        .order("full_name", { ascending: true }),
    ]);
    if (clientRes.data) {
      setClient(clientRes.data as Client);
    }
    setGuards((guardsRes.data ?? []) as Guard[]);
  }, [client.id]);

  const filteredGuards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guards
      .filter((g) => {
        if (statusFilter !== "all" && g.status !== statusFilter) return false;
        if (q) {
          const hay = `${g.full_name} ${g.employee_no ?? ""} ${g.sosia_license ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [guards, search, statusFilter]);

  async function handleDeleteClient() {
    const ok = window.confirm(
      `Delete "${client.name}"? Clients with guards can't be deleted until their guards are removed.`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", client.id);
    if (error) {
      const msg = /foreign key|violates/i.test(error.message)
        ? "Client has guards and can't be deleted. Reassign or remove them first."
        : error.message;
      showToast(msg, "error");
      return;
    }
    showToast("Client deleted", "success");
    router.push("/hierarchy/clients");
  }

  async function handleDeleteGuard(guard: Guard) {
    const ok = window.confirm(
      `Delete ${guard.full_name}? This permanently removes the guard record.`,
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

  const [editingGuard, setEditingGuard] = useState<Guard | null>(null);

  return (
    <div style={{ maxWidth: 1280 }}>
      <Breadcrumb client={client} />

      {/* Header */}
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#f5f5f7",
              margin: 0,
            }}
          >
            {client.name}
          </h1>
          <ClientTypeBadge type={client.type} />
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => setClientEditOpen(true)}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDeleteClient}
            style={{
              ...secondaryButtonStyle,
              color: "#ef4444",
              borderColor: "rgba(239, 68, 68, 0.3)",
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Info card */}
      <div style={{ height: 16 }} />
      <GlassCard>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px 28px",
          }}
        >
          <InfoItem
            label="Type"
            value={<ClientTypeBadge type={client.type} />}
          />
          <InfoItem label="Industry" value={client.industry} />
          <InfoItem label="Conglomerate" value={client.conglomerate} />
          <InfoItem
            label="Guards"
            value={String(guards.length)}
            tabular
          />
        </div>
      </GlassCard>

      {/* Guards section */}
      <div style={{ height: 28 }} />
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
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
          Guards
        </h2>
        <button
          type="button"
          style={goldButtonStyle}
          onClick={() => {
            setEditingGuard(null);
            setGuardModalOpen(true);
          }}
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
          Add guard for this client
        </button>
      </div>

      <div style={{ height: 12 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 220px)",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <FilterLabel htmlFor="gd-search">Search</FilterLabel>
          <TextInput
            id="gd-search"
            value={search}
            onChange={setSearch}
            placeholder="Name, employee no., SOSIA…"
          />
        </div>
        <div>
          <FilterLabel htmlFor="gd-status">Status</FilterLabel>
          <SelectInput
            id="gd-status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      <GlassCard style={{ padding: 0, overflow: "hidden" }}>
        {guards.length === 0 ? (
          <div
            style={{
              padding: "40px 24px",
              textAlign: "center",
              color: "rgba(245, 245, 247, 0.6)",
              fontSize: 13,
            }}
          >
            No guards deployed to this client yet.
          </div>
        ) : filteredGuards.length === 0 ? (
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
                {filteredGuards.map((g, idx) => (
                  <GuardRow
                    key={g.id}
                    guard={g}
                    striped={idx % 2 === 1}
                    onEdit={() => {
                      setEditingGuard(g);
                      setGuardModalOpen(true);
                    }}
                    onDelete={() => handleDeleteGuard(g)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Org chart — pooled only. Lives on its own DnD sub-page now. */}
      {client.type === "pooled" ? (
        <>
          <div style={{ height: 28 }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: "#c9a961",
                }}
              />
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#f5f5f7",
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                Org chart
              </h2>
            </div>
            <Link
              href={`/hierarchy/clients/${client.id}/org-chart`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(245, 245, 247, 0.85)",
                borderRadius: 8,
                padding: "9px 14px",
                fontWeight: 500,
                fontSize: 13,
                fontFamily: "inherit",
                textDecoration: "none",
              }}
            >
              View org chart →
            </Link>
          </div>
        </>
      ) : null}

      {/* Compliance section */}
      <div style={{ height: 28 }} />
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#f5f5f7",
          letterSpacing: "-0.01em",
          marginBottom: 12,
        }}
      >
        Compliance
      </h2>
      <SubjectCompliancePanel
        subjectScope="client"
        subjectId={client.id}
        subjectName={client.name}
        addButtonLabel="Add document for this client"
      />

      {guardModalOpen ? (
        <GuardFormModal
          clientId={client.id}
          initialGuard={editingGuard}
          clients={clients}
          onClose={() => {
            setGuardModalOpen(false);
            setEditingGuard(null);
          }}
          onSaved={() => {
            setGuardModalOpen(false);
            setEditingGuard(null);
            refetch();
          }}
        />
      ) : null}

      {clientEditOpen ? (
        <ClientFormModal
          initialClient={client}
          onClose={() => setClientEditOpen(false)}
          onSaved={() => {
            setClientEditOpen(false);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function Breadcrumb({ client }: { client: Client }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: "rgba(245, 245, 247, 0.45)",
        flexWrap: "wrap",
      }}
    >
      <Link
        href="/hierarchy"
        style={{ color: "rgba(245, 245, 247, 0.6)", textDecoration: "none" }}
      >
        Guard Deployment
      </Link>
      <span aria-hidden>/</span>
      <Link
        href="/hierarchy/clients"
        style={{ color: "rgba(245, 245, 247, 0.6)", textDecoration: "none" }}
      >
        Clients
      </Link>
      <span aria-hidden>/</span>
      <span style={{ color: "rgba(245, 245, 247, 0.7)" }}>{client.name}</span>
    </div>
  );
}

function InfoItem({
  label,
  value,
  tabular,
}: {
  label: string;
  value: ReactNode;
  tabular?: boolean;
}) {
  const isEmpty = value === null || value === undefined || value === "";
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
        {label}
      </div>
      <div
        className={tabular ? "tabular" : undefined}
        style={{
          fontSize: 14,
          color: isEmpty ? "rgba(245, 245, 247, 0.35)" : "#f5f5f7",
        }}
      >
        {isEmpty ? "—" : value}
      </div>
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

function GuardRow({
  guard,
  striped,
  onEdit,
  onDelete,
}: {
  guard: Guard;
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
