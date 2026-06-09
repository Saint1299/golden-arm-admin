"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { DetachmentTypeBadge, GuardStatusBadge } from "./badges";
import { BulkImportModal } from "./BulkImportModal";
import { DetachmentFormModal } from "./DetachmentFormModal";
import { ExpiringLicensesBanner, type ExpiringRow } from "./ExpiringLicensesBanner";
import { GuardAvatar } from "./GuardCard";
import { GuardFormModal } from "./GuardFormModal";
import { OrgChartCanvas } from "./OrgChartCanvas";
import { BackButton } from "@/components/ui/BackButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { expiringGuards } from "@/lib/license";
import type {
  Client,
  Detachment,
  Guard,
  OrgNode,
} from "@/types/database";

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

export function DetachmentDetailView({
  client,
  clients,
  detachment: initialDetachment,
  initialGuards,
  initialNodes,
  photoUrlByGuardId,
}: {
  client: Client;
  clients: Client[];
  detachment: Detachment;
  initialGuards: Guard[];
  initialNodes: OrgNode[];
  photoUrlByGuardId: Record<string, string>;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [detachment, setDetachment] = useState<Detachment>(initialDetachment);
  const [guards, setGuards] = useState<Guard[]>(initialGuards);
  const [editOpen, setEditOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [guardModal, setGuardModal] = useState<{
    open: boolean;
    editing: Guard | null;
  }>({ open: false, editing: null });

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
    const [detRes, guardsRes] = await Promise.all([
      supabase
        .from("detachments")
        .select("*")
        .eq("id", detachment.id)
        .maybeSingle(),
      supabase
        .from("guards")
        .select("*")
        .eq("detachment_id", detachment.id)
        .order("full_name", { ascending: true }),
    ]);
    if (detRes.data) setDetachment(detRes.data as Detachment);
    setGuards((guardsRes.data ?? []) as Guard[]);
  }, [detachment.id]);

  const expiringRows: ExpiringRow[] = useMemo(
    () =>
      expiringGuards(guards).map(({ guard, days }) => ({
        guardId: guard.id,
        guardName: guard.full_name,
        expiry: guard.license_expiry,
        days,
      })),
    [guards],
  );

  async function handleDelete() {
    const ok = window.confirm(
      `Delete "${detachment.name}"? Its org chart will be removed and its guards unassigned (not deleted).`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("detachments")
      .delete()
      .eq("id", detachment.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Detachment deleted", "success");
    router.push(`/hierarchy/clients/${client.id}`);
  }

  async function handleReplaceGuard(current: Guard) {
    const ok = window.confirm(
      `Replace ${current.full_name} at this post? They'll be unassigned from this detachment (not deleted), then you can add the replacement.`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("guards")
      .update({ detachment_id: null, org_node_id: null })
      .eq("id", current.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    await refetch();
    setGuardModal({ open: true, editing: null });
  }

  const isSinglePost = detachment.is_single_post;

  return (
    <div style={{ maxWidth: 1100 }}>
      <BackButton
        href={`/hierarchy/clients/${client.id}`}
        label="Back to client"
      />
      <Breadcrumb client={client} detachmentName={detachment.name} />

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
              {detachment.name}
            </h1>
            <DetachmentTypeBadge isSinglePost={isSinglePost} />
          </div>
          {detachment.address ? (
            <p
              style={{
                marginTop: 8,
                marginBottom: 0,
                fontSize: 13.5,
                color: "rgba(245, 245, 247, 0.6)",
              }}
            >
              {detachment.address}
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <button
            type="button"
            style={goldButtonStyle}
            onClick={() => setGuardModal({ open: true, editing: null })}
          >
            <PlusIcon />
            Add guard to this detachment
          </button>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => setBulkOpen(true)}
            title="Import guards from a CSV (resolved by client_name + detachment_name)"
          >
            Bulk import guards
          </button>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => setEditOpen(true)}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
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

      {isSinglePost ? (
        <SinglePostBody
          guards={guards}
          photoUrlByGuardId={photoUrlByGuardId}
          onAddGuard={() => setGuardModal({ open: true, editing: null })}
          onEditGuard={(g) => setGuardModal({ open: true, editing: g })}
          onReplaceGuard={handleReplaceGuard}
        />
      ) : (
        <OrgChartCanvas
          detachmentId={detachment.id}
          clientId={client.id}
          clients={clients}
          initialNodes={initialNodes}
          initialGuards={initialGuards}
          photoUrlByGuardId={photoUrlByGuardId}
        />
      )}

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

      {editOpen ? (
        <DetachmentFormModal
          clientId={client.id}
          initialDetachment={detachment}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            refetch();
          }}
        />
      ) : null}

      {guardModal.open ? (
        <GuardFormModal
          clientId={client.id}
          detachmentId={detachment.id}
          lockAssignment={guardModal.editing === null}
          initialGuard={guardModal.editing}
          clients={clients}
          onClose={() => setGuardModal({ open: false, editing: null })}
          onSaved={() => {
            setGuardModal({ open: false, editing: null });
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function Breadcrumb({
  client,
  detachmentName,
}: {
  client: Client;
  detachmentName: string;
}) {
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
      <Link
        href={`/hierarchy/clients/${client.id}`}
        style={{ color: "rgba(245, 245, 247, 0.6)", textDecoration: "none" }}
      >
        {client.name}
      </Link>
      <span aria-hidden>/</span>
      <span style={{ color: "rgba(245, 245, 247, 0.7)" }}>{detachmentName}</span>
    </div>
  );
}

function SinglePostBody({
  guards,
  photoUrlByGuardId,
  onAddGuard,
  onEditGuard,
  onReplaceGuard,
}: {
  guards: Guard[];
  photoUrlByGuardId: Record<string, string>;
  onAddGuard: () => void;
  onEditGuard: (g: Guard) => void;
  onReplaceGuard: (g: Guard) => void;
}) {
  if (guards.length === 0) {
    return (
      <GlassCard>
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
          <GuardAvatar name="?" photoUrl={null} size={72} ring={false} />
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#f5f5f7",
              margin: 0,
            }}
          >
            No guard at this post yet
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "rgba(245, 245, 247, 0.6)",
              maxWidth: 340,
            }}
          >
            This is a single-post detachment. Assign the guard who covers it.
          </p>
          <button type="button" style={goldButtonStyle} onClick={onAddGuard}>
            <PlusIcon />
            Add the post&rsquo;s guard
          </button>
        </div>
      </GlassCard>
    );
  }

  const [primary, ...extras] = guards;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FocusedGuardCard
        guard={primary}
        photoUrl={photoUrlByGuardId[primary.id] ?? null}
        onEdit={() => onEditGuard(primary)}
        onReplace={() => onReplaceGuard(primary)}
      />
      {extras.length > 0 ? (
        <GlassCard>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(245, 158, 11, 0.85)",
              marginBottom: 12,
            }}
          >
            Additional guards on this single post
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {extras.map((g) => (
              <ExtraGuardRow
                key={g.id}
                guard={g}
                photoUrl={photoUrlByGuardId[g.id] ?? null}
                onEdit={() => onEditGuard(g)}
              />
            ))}
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}

function FocusedGuardCard({
  guard,
  photoUrl,
  onEdit,
  onReplace,
}: {
  guard: Guard;
  photoUrl: string | null;
  onEdit: () => void;
  onReplace: () => void;
}) {
  return (
    <GlassCard>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <GuardAvatar name={guard.full_name} photoUrl={photoUrl} size={128} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href={`/hierarchy/guards/${guard.id}`}
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "#f5f5f7",
                letterSpacing: "-0.02em",
                textDecoration: "none",
              }}
            >
              {guard.full_name}
            </Link>
            <GuardStatusBadge status={guard.status} />
          </div>
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px 24px",
            }}
          >
            <KeyVal label="ID number" value={guard.id_number} />
            <KeyVal label="License no." value={guard.license_no} />
            <KeyVal label="License expiry" value={guard.license_expiry} />
            <KeyVal label="Contact" value={guard.contact_no} />
            <KeyVal
              label="Deployment location"
              value={guard.deployment_location}
            />
          </div>
          <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
            <button type="button" style={secondaryButtonStyle} onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={onReplace}
            >
              Replace guard
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function ExtraGuardRow({
  guard,
  photoUrl,
  onEdit,
}: {
  guard: Guard;
  photoUrl: string | null;
  onEdit: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 10,
        borderRadius: 10,
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <GuardAvatar name={guard.full_name} photoUrl={photoUrl} size={40} ring={false} />
      <Link
        href={`/hierarchy/guards/${guard.id}`}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          fontWeight: 500,
          color: "#f5f5f7",
          textDecoration: "none",
        }}
      >
        {guard.full_name}
      </Link>
      <button
        type="button"
        onClick={onEdit}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          fontSize: 12,
          fontWeight: 500,
          fontFamily: "inherit",
          cursor: "pointer",
          color: "rgba(245, 245, 247, 0.55)",
        }}
      >
        Edit
      </button>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string | null }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(245, 245, 247, 0.4)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        className="tabular"
        style={{
          fontSize: 14,
          color: empty ? "rgba(245, 245, 247, 0.3)" : "#f5f5f7",
        }}
      >
        {empty ? "—" : value}
      </div>
    </div>
  );
}

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
