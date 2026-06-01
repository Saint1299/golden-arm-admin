"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type CSSProperties } from "react";
import { ClientTypeBadge, GuardStatusBadge } from "./badges";
import { GuardFormModal } from "./GuardFormModal";
import { OrgChart } from "./OrgChart";
import { SubjectCompliancePanel } from "@/components/compliance/SubjectCompliancePanel";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Client, Guard, OrgNode, Region } from "@/types/database";

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
  padding: "12px 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
};

const bodyCellStyle: CSSProperties = {
  fontSize: 14,
  color: "rgba(245, 245, 247, 0.6)",
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
};

export function ClientDetailView({
  client,
  region,
  initialGuards,
  initialNodes,
}: {
  client: Client;
  region: Region | null;
  initialGuards: Guard[];
  initialNodes: OrgNode[];
}) {
  const [guards, setGuards] = useState<Guard[]>(initialGuards);
  const [nodes, setNodes] = useState<OrgNode[]>(initialNodes);
  const [modalOpen, setModalOpen] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
    const [guardsRes, nodesRes] = await Promise.all([
      supabase
        .from("guards")
        .select("*")
        .eq("client_id", client.id)
        .order("full_name", { ascending: true }),
      supabase
        .from("org_nodes")
        .select("*")
        .eq("client_id", client.id)
        .order("sort_order", { ascending: true }),
    ]);
    setGuards((guardsRes.data ?? []) as Guard[]);
    setNodes((nodesRes.data ?? []) as OrgNode[]);
  }, [client.id]);

  return (
    <div style={{ maxWidth: 1000 }}>
      <Breadcrumb client={client} region={region} />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 8,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              fontSize: 13,
              color: "rgba(245, 245, 247, 0.5)",
            }}
          >
            {region ? region.name : "Unknown region"}
            {" · "}
            <span className="tabular">{guards.length}</span>{" "}
            {guards.length === 1 ? "guard" : "guards"}
            {client.conglomerate ? ` · ${client.conglomerate}` : ""}
            {client.industry ? ` · ${client.industry}` : ""}
          </p>
        </div>
        <button
          type="button"
          style={addButtonStyle}
          onClick={() => setModalOpen(true)}
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

      <div style={{ height: 24 }} />

      {client.type === "pooled" ? (
        <OrgChart
          clientId={client.id}
          nodes={nodes}
          guards={guards}
          onChanged={refetch}
        />
      ) : null}

      <GuardTable
        guards={guards}
        title={
          client.type === "pooled" ? "All guards (flat list)" : "Guards"
        }
      />

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

      {modalOpen ? (
        <GuardFormModal
          clientId={client.id}
          initialGuard={null}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function Breadcrumb({
  client,
  region,
}: {
  client: Client;
  region: Region | null;
}) {
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
      <Link
        href="/hierarchy"
        style={{ color: "rgba(245, 245, 247, 0.6)", textDecoration: "none" }}
      >
        Hierarchy
      </Link>
      <span aria-hidden>/</span>
      <span>{region ? region.name : "—"}</span>
      <span aria-hidden>/</span>
      <span style={{ color: "rgba(245, 245, 247, 0.7)" }}>{client.name}</span>
    </div>
  );
}

function GuardTable({ guards, title }: { guards: Guard[]; title: string }) {
  return (
    <div>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#f5f5f7",
          letterSpacing: "-0.01em",
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
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
            No guards deployed to this client yet. Use “Add guard” to deploy
            one.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headerCellStyle}>Name</th>
                <th style={headerCellStyle}>Employee No.</th>
                <th style={headerCellStyle}>SOSIA</th>
                <th style={headerCellStyle}>Contact</th>
                <th style={headerCellStyle}>Deployed</th>
                <th style={headerCellStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {guards.map((guard) => (
                <GuardRow key={guard.id} guard={guard} />
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>
    </div>
  );
}

function GuardRow({ guard }: { guard: Guard }) {
  const router = useRouter();
  const [hover, setHover] = useState(false);
  return (
    <tr
      onClick={() => router.push(`/hierarchy/guards/${guard.id}`)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        backgroundColor: hover ? "rgba(255, 255, 255, 0.02)" : "transparent",
        cursor: "pointer",
        transition: "background-color 150ms ease-out",
      }}
    >
      <td style={{ ...bodyCellStyle, color: "#f5f5f7", fontWeight: 500 }}>
        {guard.full_name}
      </td>
      <td style={bodyCellStyle}>{guard.employee_no ?? "—"}</td>
      <td style={bodyCellStyle}>{guard.sosia_license ?? "—"}</td>
      <td style={bodyCellStyle}>{guard.contact_no ?? "—"}</td>
      <td style={bodyCellStyle} className="tabular">
        {guard.date_deployed ?? "—"}
      </td>
      <td style={bodyCellStyle}>
        <GuardStatusBadge status={guard.status} />
      </td>
    </tr>
  );
}
