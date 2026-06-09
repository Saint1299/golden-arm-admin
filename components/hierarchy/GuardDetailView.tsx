"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { GuardStatusBadge } from "./badges";
import { GuardAvatar } from "./GuardCard";
import { GuardFormModal } from "./GuardFormModal";
import { SubjectCompliancePanel } from "@/components/compliance/SubjectCompliancePanel";
import { GuardInventoryPanel } from "@/components/inventory/GuardInventoryPanel";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/components/ui/Toast";
import { ALERT_ACCENT, computeAlertStatus } from "@/lib/compliance";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Client, Detachment, Guard } from "@/types/database";

type Tab = "details" | "inventory" | "compliance";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "details", label: "Details" },
  { id: "inventory", label: "Inventory" },
  { id: "compliance", label: "Compliance" },
];

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

export function GuardDetailView({
  guard,
  client,
  clients,
  detachment,
  photoUrl,
}: {
  guard: Guard;
  client: Client | null;
  clients: Client[];
  detachment: Detachment | null;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  async function handleDelete() {
    const ok = window.confirm(
      `Delete ${guard.full_name}? This permanently removes the guard record and cannot be undone.`,
    );
    if (!ok) return;
    setDeleting(true);
    const supabase = createSupabaseClient();
    const { error } = await supabase.from("guards").delete().eq("id", guard.id);
    if (error) {
      showToast(error.message, "error");
      setDeleting(false);
      return;
    }
    showToast("Guard deleted", "success");
    router.push(client ? `/hierarchy/clients/${client.id}` : "/hierarchy");
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <Breadcrumb guard={guard} client={client} />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0 }}>
          <GuardAvatar name={guard.full_name} photoUrl={photoUrl} size={128} />
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "#f5f5f7",
                margin: 0,
              }}
            >
              {guard.full_name}
            </h1>
            <div style={{ marginTop: 10 }}>
              <GuardStatusBadge status={guard.status} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            style={{
              ...secondaryButtonStyle,
              color: "#ef4444",
              borderColor: "rgba(239, 68, 68, 0.3)",
              cursor: deleting ? "wait" : "pointer",
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <div style={{ height: 24 }} />

      <Tabs activeTab={activeTab} onChange={setActiveTab} />

      <div style={{ height: 20 }} />

      {activeTab === "details" ? (
        <DetailsTab guard={guard} client={client} detachment={detachment} />
      ) : null}
      {activeTab === "inventory" ? (
        <GuardInventoryPanel guardId={guard.id} guardName={guard.full_name} />
      ) : null}
      {activeTab === "compliance" ? (
        <SubjectCompliancePanel
          subjectScope="guard"
          subjectId={guard.id}
          subjectName={guard.full_name}
          addButtonLabel="Add document for this guard"
        />
      ) : null}

      {editing ? (
        <GuardFormModal
          clientId={guard.client_id}
          initialGuard={guard}
          clients={clients}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Breadcrumb({
  guard,
  client,
}: {
  guard: Guard;
  client: Client | null;
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
        Guard Deployment
      </Link>
      <span aria-hidden>/</span>
      {client ? (
        <Link
          href={`/hierarchy/clients/${client.id}`}
          style={{ color: "rgba(245, 245, 247, 0.6)", textDecoration: "none" }}
        >
          {client.name}
        </Link>
      ) : (
        <span>—</span>
      )}
      <span aria-hidden>/</span>
      <span style={{ color: "rgba(245, 245, 247, 0.7)" }}>
        {guard.full_name}
      </span>
    </div>
  );
}

function Tabs({
  activeTab,
  onChange,
}: {
  activeTab: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              position: "relative",
              background: "transparent",
              border: "none",
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: "pointer",
              color: active ? "#f5f5f7" : "rgba(245, 245, 247, 0.5)",
              transition: "color 200ms ease-out",
            }}
          >
            {tab.label}
            {active ? (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  bottom: -1,
                  height: 2,
                  backgroundColor: "#c9a961",
                  borderRadius: "2px 2px 0 0",
                }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function computeAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const dob = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

function DetailsTab({
  guard,
  client,
  detachment,
}: {
  guard: Guard;
  client: Client | null;
  detachment: Detachment | null;
}) {
  const age = computeAge(guard.birthdate);
  const birthdateValue = guard.birthdate
    ? age !== null
      ? `${guard.birthdate}  ·  ${age} yrs`
      : guard.birthdate
    : null;

  // License expiry takes the same accent rhythm as the compliance board:
  // expired → red, within 30 days → gold, otherwise plain.
  const expiryStatus = computeAlertStatus(guard.license_expiry);
  const expiryValue =
    guard.license_expiry !== null ? (
      <span
        style={{
          color:
            expiryStatus === "ok"
              ? "#f5f5f7"
              : ALERT_ACCENT[expiryStatus].fg,
          fontWeight: expiryStatus === "ok" ? 400 : 600,
        }}
      >
        {guard.license_expiry}
      </span>
    ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <DetailSection title="Personal info">
        <DetailItem label="Full name" value={guard.full_name} />
        <DetailItem label="First name" value={guard.first_name} />
        <DetailItem label="Middle name" value={guard.middle_name} />
        <DetailItem label="Last name" value={guard.last_name} />
        <DetailItem label="Birthdate" value={birthdateValue} tabular />
        <DetailItem label="Birth place" value={guard.birth_place} />
        <DetailItem label="Address" value={guard.address} />
        <DetailItem
          label="Educational attainment"
          value={guard.educational_attainment}
        />
      </DetailSection>

      <DetailSection title="Government IDs">
        <DetailItem label="SSS" value={guard.sss} tabular />
        <DetailItem label="PhilHealth" value={guard.philhealth} tabular />
        <DetailItem label="Pag-IBIG" value={guard.pagibig} tabular />
        <DetailItem label="TIN" value={guard.tin} tabular />
      </DetailSection>

      <DetailSection title="Employment">
        <DetailItem label="ID number" value={guard.id_number} tabular />
        <DetailItem
          label="Client"
          value={client?.name ?? "Unassigned"}
        />
        <DetailItem
          label="Detachment"
          value={detachment?.name ?? (guard.detachment_id ? "—" : "None")}
        />
        <DetailItem
          label="Deployment location"
          value={guard.deployment_location}
        />
        <DetailItem label="Date deployed" value={guard.date_deployed} tabular />
        <DetailItem
          label="Status"
          value={<GuardStatusBadge status={guard.status} />}
        />
      </DetailSection>

      <DetailSection title="License">
        <DetailItem label="License category" value={guard.license_category} />
        <DetailItem label="License no." value={guard.license_no} tabular />
        <DetailItem label="License expiry" value={expiryValue} tabular />
      </DetailSection>

      <DetailSection title="Contact">
        <DetailItem label="Contact no." value={guard.contact_no} tabular />
        <DetailItem
          label="Emergency contact no."
          value={guard.emergency_contact_no}
          tabular
        />
      </DetailSection>

      <DetailSection title="Notes">
        <DetailItem label="Notes" value={guard.notes} multiline fullWidth />
      </DetailSection>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <GlassCard>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#c9a961",
          marginBottom: 16,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px 32px",
        }}
      >
        {children}
      </div>
    </GlassCard>
  );
}

function DetailItem({
  label,
  value,
  tabular,
  multiline,
  fullWidth,
}: {
  label: string;
  value: ReactNode;
  tabular?: boolean;
  multiline?: boolean;
  fullWidth?: boolean;
}) {
  const isEmpty =
    value === null || value === undefined || value === "" ? true : false;
  return (
    <div style={fullWidth ? { gridColumn: "1 / -1" } : undefined}>
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
          color: isEmpty ? "rgba(245, 245, 247, 0.3)" : "#f5f5f7",
          whiteSpace: multiline ? "pre-wrap" : "normal",
          lineHeight: multiline ? 1.6 : 1.4,
        }}
      >
        {isEmpty ? "—" : value}
      </div>
    </div>
  );
}

