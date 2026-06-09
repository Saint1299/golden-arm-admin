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
import {
  ClientTypeBadge,
  DetachmentTypeBadge,
  GuardStatusBadge,
} from "./badges";
import { ClientFormModal } from "./ClientFormModal";
import { DetachmentFormModal } from "./DetachmentFormModal";
import { ExpiringLicensesBanner, type ExpiringRow } from "./ExpiringLicensesBanner";
import { ClientComplianceAlertPanel } from "@/components/compliance/ClientComplianceAlertPanel";
import { BackButton } from "@/components/ui/BackButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { Modal } from "@/components/ui/Modal";
import {
  CancelButton,
  Field,
  FormError,
  GoldButton,
  SelectInput,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { expiringGuards } from "@/lib/license";
import type { Client, Detachment, Guard } from "@/types/database";

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

export function ClientDetailView({
  client: initialClient,
  initialGuards,
  initialDetachments,
}: {
  client: Client;
  initialGuards: Guard[];
  initialDetachments: Detachment[];
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [client, setClient] = useState<Client>(initialClient);
  const [guards, setGuards] = useState<Guard[]>(initialGuards);
  const [detachments, setDetachments] =
    useState<Detachment[]>(initialDetachments);
  const [clientEditOpen, setClientEditOpen] = useState(false);
  const [detModal, setDetModal] = useState<{
    open: boolean;
    editing: Detachment | null;
  }>({ open: false, editing: null });
  const [moveGuard, setMoveGuard] = useState<Guard | null>(null);

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
    const [clientRes, guardsRes, detsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", client.id).maybeSingle(),
      supabase
        .from("guards")
        .select("*")
        .eq("client_id", client.id)
        .order("full_name", { ascending: true }),
      supabase
        .from("detachments")
        .select("*")
        .eq("client_id", client.id)
        .order("name", { ascending: true }),
    ]);
    if (clientRes.data) setClient(clientRes.data as Client);
    setGuards((guardsRes.data ?? []) as Guard[]);
    setDetachments((detsRes.data ?? []) as Detachment[]);
  }, [client.id]);

  const detachmentNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of detachments) m.set(d.id, d.name);
    return m;
  }, [detachments]);

  const guardCountByDetachment = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of guards) {
      if (!g.detachment_id) continue;
      m.set(g.detachment_id, (m.get(g.detachment_id) ?? 0) + 1);
    }
    return m;
  }, [guards]);

  const unassignedGuards = useMemo(
    () => guards.filter((g) => !g.detachment_id),
    [guards],
  );

  const expiringRows: ExpiringRow[] = useMemo(
    () =>
      expiringGuards(guards).map(({ guard, days }) => ({
        guardId: guard.id,
        guardName: guard.full_name,
        detachmentName: guard.detachment_id
          ? detachmentNameById.get(guard.detachment_id) ?? "Unknown detachment"
          : null,
        expiry: guard.license_expiry,
        days,
      })),
    [guards, detachmentNameById],
  );

  async function handleDeleteClient() {
    const ok = window.confirm(
      `Delete "${client.name}"? This also deletes its detachments. Guards under them will be unassigned (not deleted).`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", client.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Client deleted", "success");
    router.push("/hierarchy");
  }

  async function handleDeleteDetachment(d: Detachment) {
    const count = guardCountByDetachment.get(d.id) ?? 0;
    const ok = window.confirm(
      count > 0
        ? `Delete "${d.name}"? Its ${count} guard${count === 1 ? "" : "s"} will be unassigned from the detachment (not deleted), and its org chart will be removed.`
        : `Delete "${d.name}"? Its org chart will be removed.`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase.from("detachments").delete().eq("id", d.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Detachment deleted", "success");
    refetch();
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <BackButton href="/hierarchy" label="Back to clients" />
      <Breadcrumb clientName={client.name} />

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
        <div style={{ minWidth: 0 }}>
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
          <InfoChips
            client={client}
            detachmentCount={detachments.length}
            guardCount={guards.length}
          />
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

      <div style={{ height: 24 }} />

      <ExpiringLicensesBanner rows={expiringRows} />

      {/* Detachments */}
      <SectionHeader
        title="Detachments"
        action={
          <button
            type="button"
            style={goldButtonStyle}
            onClick={() => setDetModal({ open: true, editing: null })}
          >
            <PlusIcon />
            Add detachment
          </button>
        }
      />
      <div style={{ height: 12 }} />
      {detachments.length === 0 ? (
        <GlassCard>
          <div
            style={{
              padding: "32px 24px",
              textAlign: "center",
              color: "rgba(245, 245, 247, 0.6)",
              fontSize: 13,
            }}
          >
            No detachments yet. Add one to start deploying guards.
          </div>
        </GlassCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {detachments.map((d) => (
            <DetachmentRow
              key={d.id}
              clientId={client.id}
              detachment={d}
              guardCount={guardCountByDetachment.get(d.id) ?? 0}
              onEdit={() => setDetModal({ open: true, editing: d })}
              onDelete={() => handleDeleteDetachment(d)}
            />
          ))}
        </div>
      )}

      {/* Guards not yet assigned to a detachment */}
      {unassignedGuards.length > 0 ? (
        <>
          <div style={{ height: 32 }} />
          <SectionHeader title="Guards not yet assigned to a detachment" />
          <div style={{ height: 12 }} />
          <GlassCard style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={headerCellStyle}>Name</th>
                    <th style={headerCellStyle}>ID Number</th>
                    <th style={headerCellStyle}>License No</th>
                    <th style={headerCellStyle}>Status</th>
                    <th style={{ ...headerCellStyle, textAlign: "right" }} />
                  </tr>
                </thead>
                <tbody>
                  {unassignedGuards.map((g, idx) => (
                    <UnassignedGuardRow
                      key={g.id}
                      guard={g}
                      striped={idx % 2 === 1}
                      canMove={detachments.length > 0}
                      onMove={() => setMoveGuard(g)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      ) : null}

      {/* Compliance — focused "needs attention" slice; full board at /compliance */}
      <div style={{ height: 32 }} />
      <ClientComplianceAlertPanel clientName={client.name} />

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

      {detModal.open ? (
        <DetachmentFormModal
          clientId={client.id}
          initialDetachment={detModal.editing}
          onClose={() => setDetModal({ open: false, editing: null })}
          onSaved={() => {
            setDetModal({ open: false, editing: null });
            refetch();
          }}
        />
      ) : null}

      {moveGuard ? (
        <MoveToDetachmentModal
          guard={moveGuard}
          detachments={detachments}
          onClose={() => setMoveGuard(null)}
          onSaved={() => {
            setMoveGuard(null);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function Breadcrumb({ clientName }: { clientName: string }) {
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
        Clients
      </Link>
      <span aria-hidden>/</span>
      <span style={{ color: "rgba(245, 245, 247, 0.7)" }}>{clientName}</span>
    </div>
  );
}

function InfoChips({
  client,
  detachmentCount,
  guardCount,
}: {
  client: Client;
  detachmentCount: number;
  guardCount: number;
}) {
  const chips: Array<{ label: string; value: string }> = [
    { label: "Detachments", value: String(detachmentCount) },
    { label: "Guards", value: String(guardCount) },
  ];
  if (client.industry) chips.push({ label: "Industry", value: client.industry });
  if (client.conglomerate)
    chips.push({ label: "Conglomerate", value: client.conglomerate });
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        marginTop: 10,
        fontSize: 12,
      }}
    >
      {chips.map((c, i) => (
        <div
          key={i}
          style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}
        >
          <span
            style={{
              color: "rgba(245, 245, 247, 0.4)",
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {c.label}
          </span>
          <span style={{ color: "rgba(245, 245, 247, 0.85)", fontWeight: 500 }}>
            {c.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
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
        {title}
      </h2>
      {action}
    </div>
  );
}

function DetachmentRow({
  clientId,
  detachment,
  guardCount,
  onEdit,
  onDelete,
}: {
  clientId: string;
  detachment: Detachment;
  guardCount: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <GlassCard
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 0,
        border: hover
          ? "1px solid rgba(201, 169, 97, 0.35)"
          : "1px solid rgba(255, 255, 255, 0.08)",
        transition: "border-color 150ms ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 16 }}>
        <Link
          href={`/hierarchy/clients/${clientId}/detachments/${detachment.id}`}
          style={{ flex: 1, minWidth: 0, textDecoration: "none" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#f5f5f7",
                letterSpacing: "-0.01em",
              }}
            >
              {detachment.name}
            </span>
            <DetachmentTypeBadge isSinglePost={detachment.is_single_post} />
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
              {guardCount} guard{guardCount === 1 ? "" : "s"}
            </span>
          </div>
          {detachment.address ? (
            <div
              style={{
                marginTop: 6,
                fontSize: 12.5,
                color: "rgba(245, 245, 247, 0.55)",
              }}
            >
              {detachment.address}
            </div>
          ) : null}
        </Link>
        <div style={{ display: "inline-flex", gap: 14, flexShrink: 0 }}>
          <RowAction label="Edit" onClick={onEdit} />
          <RowAction label="Delete" onClick={onDelete} danger />
        </div>
      </div>
    </GlassCard>
  );
}

function UnassignedGuardRow({
  guard,
  striped,
  canMove,
  onMove,
}: {
  guard: Guard;
  striped: boolean;
  canMove: boolean;
  onMove: () => void;
}) {
  const router = useRouter();
  const [hover, setHover] = useState(false);
  const baseBg = striped ? "rgba(255, 255, 255, 0.015)" : "transparent";
  return (
    <tr
      onClick={() => router.push(`/hierarchy/guards/${guard.id}`)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        backgroundColor: hover ? "rgba(255, 255, 255, 0.035)" : baseBg,
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
      <td
        style={{ ...bodyCellStyle, textAlign: "right" }}
        onClick={(e) => e.stopPropagation()}
      >
        <RowAction
          label="Move to detachment"
          onClick={onMove}
          disabled={!canMove}
        />
      </td>
    </tr>
  );
}

function MoveToDetachmentModal({
  guard,
  detachments,
  onClose,
  onSaved,
}: {
  guard: Guard;
  detachments: Detachment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [detachmentId, setDetachmentId] = useState(detachments[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!detachmentId) {
      setError("Pick a detachment.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createSupabaseClient();
    const { error: err } = await supabase
      .from("guards")
      .update({ detachment_id: detachmentId })
      .eq("id", guard.id);
    if (err) {
      setError(err.message);
      showToast(err.message, "error");
      setSaving(false);
      return;
    }
    showToast(`${guard.full_name} moved`, "success");
    onSaved();
  }

  return (
    <Modal title={`Move ${guard.full_name}`} onClose={onClose}>
      <Field
        label="Detachment"
        htmlFor="move-detachment"
        helper="The guard will be assigned to this detachment."
      >
        <SelectInput
          id="move-detachment"
          value={detachmentId}
          onChange={setDetachmentId}
          options={detachments.map((d) => ({ value: d.id, label: d.name }))}
          disabled={saving}
        />
      </Field>
      <FormError message={error} />
      <div style={{ height: 24 }} />
      <GoldButton type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Moving…" : "Move guard"}
      </GoldButton>
      <div style={{ height: 12 }} />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <CancelButton onClick={onClose} disabled={saving} />
      </div>
    </Modal>
  );
}

function RowAction({
  label,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const color = disabled
    ? "rgba(245, 245, 247, 0.25)"
    : danger
      ? hover
        ? "#ef4444"
        : "rgba(239, 68, 68, 0.7)"
      : hover
        ? "#f5f5f7"
        : "rgba(245, 245, 247, 0.55)";
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        color,
        transition: "color 150ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

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

function PlusIcon() {
  return (
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
  );
}
