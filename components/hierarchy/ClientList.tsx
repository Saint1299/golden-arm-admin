"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ClientTypeBadge } from "./badges";
import { BulkImportModal } from "./BulkImportModal";
import { ClientFormModal } from "./ClientFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { TextInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { ClientType } from "@/types/database";

export type ClientListRow = {
  id: string;
  name: string;
  type: ClientType;
  industry: string | null;
  conglomerate: string | null;
  created_at: string;
  guard_count: number;
};

type RawClientRow = {
  id: string;
  name: string;
  type: ClientType;
  industry: string | null;
  conglomerate: string | null;
  created_at: string;
  guards: { count: number }[];
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

const headerCellStyle: CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(245, 245, 247, 0.4)",
  padding: "12px 14px",
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

export function ClientList({
  initialRows,
}: {
  initialRows: ClientListRow[];
}) {
  const [rows, setRows] = useState<ClientListRow[]>(initialRows);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{
    open: boolean;
    editing: ClientListRow | null;
  }>({ open: false, editing: null });
  const [bulkOpen, setBulkOpen] = useState(false);
  const { showToast } = useToast();

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("clients")
      .select("*, guards(count)")
      .order("name", { ascending: true });
    const next: ClientListRow[] = ((data ?? []) as RawClientRow[]).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      industry: c.industry,
      conglomerate: c.conglomerate,
      created_at: c.created_at,
      guard_count: c.guards?.[0]?.count ?? 0,
    }));
    setRows(next);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.name} ${r.industry ?? ""} ${r.conglomerate ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search]);

  async function handleDelete(client: ClientListRow) {
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
    refetch();
  }

  return (
    <div style={{ maxWidth: 1280 }}>
      <Breadcrumb />

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
            Clients
          </h1>
          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              fontSize: 14,
              color: "rgba(245, 245, 247, 0.6)",
            }}
          >
            All client accounts — single-post and pooled. Click into a client
            for its guard roster and (for pooled clients) its org chart.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            style={{
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
            }}
          >
            Bulk import
          </button>
          <button
            type="button"
            style={addButtonStyle}
            onClick={() => setModal({ open: true, editing: null })}
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
        </div>
      </div>

      <div style={{ height: 24 }} />

      <div style={{ marginBottom: 16 }}>
        <FilterLabel htmlFor="cl-search">Search</FilterLabel>
        <TextInput
          id="cl-search"
          value={search}
          onChange={setSearch}
          placeholder="Name, industry, conglomerate…"
        />
      </div>

      <GlassCard style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <Empty />
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: "40px 24px",
              textAlign: "center",
              color: "rgba(245, 245, 247, 0.6)",
              fontSize: 13,
            }}
          >
            No clients match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Name</th>
                  <th style={headerCellStyle}>Type</th>
                  <th style={headerCellStyle}>Industry</th>
                  <th style={headerCellStyle}>Conglomerate</th>
                  <th style={headerCellStyle}>Guards</th>
                  <th
                    style={{
                      ...headerCellStyle,
                      textAlign: "right",
                      width: 110,
                    }}
                  />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => (
                  <ClientRow
                    key={row.id}
                    row={row}
                    striped={idx % 2 === 1}
                    onEdit={() => setModal({ open: true, editing: row })}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {modal.open ? (
        <ClientFormModal
          initialClient={
            modal.editing
              ? {
                  id: modal.editing.id,
                  name: modal.editing.name,
                  type: modal.editing.type,
                  industry: modal.editing.industry,
                  conglomerate: modal.editing.conglomerate,
                  created_at: modal.editing.created_at,
                }
              : null
          }
          onClose={() => setModal({ open: false, editing: null })}
          onSaved={() => {
            setModal({ open: false, editing: null });
            refetch();
          }}
        />
      ) : null}

      {bulkOpen ? (
        <BulkImportModal
          mode="clients"
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

function Breadcrumb() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: "rgba(245, 245, 247, 0.45)",
      }}
    >
      <a
        href="/hierarchy"
        style={{ color: "rgba(245, 245, 247, 0.6)", textDecoration: "none" }}
      >
        Guard Deployment
      </a>
      <span aria-hidden>/</span>
      <span style={{ color: "rgba(245, 245, 247, 0.7)" }}>Clients</span>
    </div>
  );
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

function ClientRow({
  row,
  striped,
  onEdit,
  onDelete,
}: {
  row: ClientListRow;
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
      onClick={() => router.push(`/hierarchy/clients/${row.id}`)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        backgroundColor: bg,
        cursor: "pointer",
        transition: "background-color 150ms ease-out",
      }}
    >
      <td style={{ ...bodyCellStyle, color: "#f5f5f7", fontWeight: 500 }}>
        {row.name}
      </td>
      <td style={bodyCellStyle}>
        <ClientTypeBadge type={row.type} />
      </td>
      <td style={bodyCellStyle}>{row.industry ?? "—"}</td>
      <td style={bodyCellStyle}>{row.conglomerate ?? "—"}</td>
      <td style={bodyCellStyle} className="tabular">
        {row.guard_count}
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
        No clients yet
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
        Add your first client to start tracking guards and (for pooled
        clients) the org chart.
      </p>
    </div>
  );
}
