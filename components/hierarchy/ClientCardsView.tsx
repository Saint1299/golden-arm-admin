"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { BulkImportModal } from "./BulkImportModal";
import { ClientFormModal } from "./ClientFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { TextInput } from "@/components/ui/form";
import { buildCards, type ClientCard } from "@/lib/client-cards";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Client, Guard } from "@/types/database";

export type { ClientCard };

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
};

export function ClientCardsView({
  initialCards,
}: {
  initialCards: ClientCard[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState<ClientCard[]>(initialCards);
  const [search, setSearch] = useState("");
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<
    "clients" | "detachments" | null
  >(null);

  const refetch = useCallback(async () => {
    const supabase = createSupabaseClient();
    const [clientsRes, detsRes, guardsRes] = await Promise.all([
      supabase.from("clients").select("*").order("name", { ascending: true }),
      supabase.from("detachments").select("id, client_id"),
      supabase.from("guards").select("*"),
    ]);
    setCards(
      buildCards(
        (clientsRes.data ?? []) as Client[],
        (detsRes.data ?? []) as Array<{ id: string; client_id: string }>,
        (guardsRes.data ?? []) as Guard[],
      ),
    );
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = q
      ? cards.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.industry ?? "").toLowerCase().includes(q),
        )
      : cards;
    return [...arr].sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, search]);

  return (
    <div style={{ maxWidth: 1280 }}>
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
            Each client holds one or more detachments. Open a client to manage
            its detachments and guards.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            style={secondaryButtonStyle}
            onClick={() => setBulkMode("detachments")}
            title="Import detachments from a CSV"
          >
            Bulk import detachments
          </button>
          <button
            type="button"
            style={addButtonStyle}
            onClick={() => setClientModalOpen(true)}
            title="Add a new client"
          >
            <PlusIcon />
            Add client
          </button>
        </div>
      </div>

      <div style={{ height: 24 }} />

      <div style={{ maxWidth: 360, marginBottom: 20 }}>
        <TextInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or industry…"
        />
      </div>

      {cards.length === 0 ? (
        <EmptyState
          onAddClient={() => setClientModalOpen(true)}
          onBulkImport={() => setBulkMode("clients")}
        />
      ) : filtered.length === 0 ? (
        <GlassCard>
          <div
            style={{
              padding: "32px 24px",
              textAlign: "center",
              color: "rgba(245, 245, 247, 0.6)",
              fontSize: 13,
            }}
          >
            No clients match “{search}”.
          </div>
        </GlassCard>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((c) => (
            <ClientCardItem
              key={c.id}
              card={c}
              onOpen={() => router.push(`/hierarchy/clients/${c.id}`)}
            />
          ))}
        </div>
      )}

      {clientModalOpen ? (
        <ClientFormModal
          initialClient={null}
          onClose={() => setClientModalOpen(false)}
          onSaved={() => {
            setClientModalOpen(false);
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
    </div>
  );
}

function ClientCardItem({
  card,
  onOpen,
}: {
  card: ClientCard;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <GlassCard
      onClick={onOpen}
      style={{
        cursor: "pointer",
        border: hover
          ? "1px solid rgba(201, 169, 97, 0.4)"
          : "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: hover
          ? "0 10px 30px rgba(0, 0, 0, 0.4)"
          : "0 6px 20px rgba(0, 0, 0, 0.25)",
        transition: "border-color 150ms ease-out, box-shadow 150ms ease-out",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: "#f5f5f7",
          letterSpacing: "-0.01em",
        }}
      >
        {card.name}
      </div>
      {card.conglomerate ? (
        <div
          style={{
            marginTop: 4,
            fontSize: 12.5,
            color: "rgba(245, 245, 247, 0.5)",
          }}
        >
          {card.conglomerate}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 20,
        }}
      >
        <Stat label="Detachments" value={card.detachmentCount} />
        <Stat label="Guards" value={card.guardCount} />
      </div>

      {card.expiringCount > 0 ? (
        <div
          style={{
            marginTop: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 999,
            backgroundColor: "rgba(201, 169, 97, 0.14)",
            border: "1px solid rgba(201, 169, 97, 0.35)",
          }}
        >
          <span
            className="tabular"
            style={{ fontSize: 12.5, fontWeight: 700, color: "#d4b670" }}
          >
            {card.expiringCount}
          </span>
          <span style={{ fontSize: 11.5, color: "#d4b670" }}>
            license{card.expiringCount === 1 ? "" : "s"} expiring
          </span>
        </div>
      ) : null}
    </GlassCard>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div
        className="tabular"
        style={{ fontSize: 22, fontWeight: 600, color: "#f5f5f7" }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(245, 245, 247, 0.4)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function EmptyState({
  onAddClient,
  onBulkImport,
}: {
  onAddClient: () => void;
  onBulkImport: () => void;
}) {
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
            margin: 0,
            fontSize: 13,
            color: "rgba(245, 245, 247, 0.6)",
            maxWidth: 380,
            lineHeight: 1.5,
          }}
        >
          Add your first client to start building detachments and deploying
          guards.
        </p>
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
          <button type="button" onClick={onAddClient} style={addButtonStyle}>
            <PlusIcon />
            Add client
          </button>
          <span style={{ fontSize: 12, color: "rgba(245, 245, 247, 0.45)" }}>
            or{" "}
            <button
              type="button"
              onClick={onBulkImport}
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
      </div>
    </GlassCard>
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
