"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { ClientCard } from "./ClientCard";
import { ClientFormModal } from "./ClientFormModal";
import { RegionManagerModal } from "./RegionManagerModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { SelectInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { ClientType, Region } from "@/types/database";

export type ClientWithCount = {
  id: string;
  region_id: string;
  name: string;
  type: ClientType;
  industry: string | null;
  conglomerate: string | null;
  created_at: string;
  guard_count: number;
};

type ClientRow = {
  id: string;
  region_id: string;
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

export function HierarchyBrowser({
  initialRegions,
  initialClients,
}: {
  initialRegions: Region[];
  initialClients: ClientWithCount[];
}) {
  const [regions, setRegions] = useState<Region[]>(initialRegions);
  const [clients, setClients] = useState<ClientWithCount[]>(initialClients);
  const [selectedRegionId, setSelectedRegionId] = useState<string>(
    initialRegions[0]?.id ?? "",
  );
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [clientModal, setClientModal] = useState<{
    open: boolean;
    editing: ClientWithCount | null;
  }>({ open: false, editing: null });
  const { showToast } = useToast();

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
    const [regionsRes, clientsRes] = await Promise.all([
      supabase.from("regions").select("*").order("name", { ascending: true }),
      supabase
        .from("clients")
        .select("*, guards(count)")
        .order("name", { ascending: true }),
    ]);
    const nextRegions = (regionsRes.data ?? []) as Region[];
    const nextClients = ((clientsRes.data ?? []) as ClientRow[]).map((c) => ({
      id: c.id,
      region_id: c.region_id,
      name: c.name,
      type: c.type,
      industry: c.industry,
      conglomerate: c.conglomerate,
      created_at: c.created_at,
      guard_count: c.guards?.[0]?.count ?? 0,
    }));
    setRegions(nextRegions);
    setClients(nextClients);
    // Keep the current selection if it still exists; otherwise fall back.
    setSelectedRegionId((prev) =>
      nextRegions.some((r) => r.id === prev) ? prev : nextRegions[0]?.id ?? "",
    );
  }, []);

  const filteredClients = useMemo(
    () => clients.filter((c) => c.region_id === selectedRegionId),
    [clients, selectedRegionId],
  );

  async function handleDeleteClient(client: ClientWithCount) {
    const ok = window.confirm(
      `Delete "${client.name}"? This cannot be undone. Clients with guards cannot be deleted until their guards are removed.`,
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
    refetch();
  }

  const hasRegions = regions.length > 0;

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "#f5f5f7",
        }}
      >
        Hierarchy
      </h1>
      <p
        style={{
          marginTop: 8,
          marginBottom: 24,
          fontSize: 14,
          color: "rgba(245, 245, 247, 0.6)",
        }}
      >
        Browse clients and deployed guards by region.
      </p>

      {!hasRegions ? (
        <GlassCard>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f7" }}>
              No regions yet
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "rgba(245, 245, 247, 0.6)",
                margin: 0,
                maxWidth: 360,
              }}
            >
              Regions group your clients geographically. Add your first region
              to start building the hierarchy.
            </p>
            <button
              type="button"
              style={addButtonStyle}
              onClick={() => setRegionModalOpen(true)}
            >
              Manage regions
            </button>
          </div>
        </GlassCard>
      ) : (
        <>
          {/* Region selector row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            <div style={{ minWidth: 260 }}>
              <label
                htmlFor="region-select"
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
                Region
              </label>
              <SelectInput
                id="region-select"
                value={selectedRegionId}
                onChange={setSelectedRegionId}
                options={regions.map((r) => ({ value: r.id, label: r.name }))}
              />
            </div>
            <button
              type="button"
              onClick={() => setRegionModalOpen(true)}
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(245, 245, 247, 0.8)",
                borderRadius: 8,
                padding: "10px 16px",
                fontWeight: 500,
                fontSize: 14,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              Manage regions
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              style={addButtonStyle}
              onClick={() => setClientModal({ open: true, editing: null })}
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

          {filteredClients.length === 0 ? (
            <GlassCard>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "32px 24px",
                  textAlign: "center",
                }}
              >
                <h3
                  style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f7" }}
                >
                  No clients in this region
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(245, 245, 247, 0.6)",
                    margin: 0,
                    maxWidth: 360,
                  }}
                >
                  Add a client to this region to begin tracking its posts and
                  guards.
                </p>
              </div>
            </GlassCard>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 16,
              }}
            >
              {filteredClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onEdit={() =>
                    setClientModal({ open: true, editing: client })
                  }
                  onDelete={() => handleDeleteClient(client)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {regionModalOpen ? (
        <RegionManagerModal
          regions={regions}
          onClose={() => setRegionModalOpen(false)}
          onChanged={refetch}
        />
      ) : null}

      {clientModal.open ? (
        <ClientFormModal
          regions={regions}
          defaultRegionId={selectedRegionId}
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
