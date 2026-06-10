"use client";

import Link from "next/link";
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
            <ClientCardItem key={c.id} card={c} />
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

function ClientCardItem({ card }: { card: ClientCard }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/hierarchy/clients/${card.id}`}
      prefetch
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ textDecoration: "none", display: "block" }}
    >
      <GlassCard
        style={{
          cursor: "pointer",
          padding: 22,
        backgroundColor: hover
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(255, 255, 255, 0.03)",
        border: hover
          ? "1px solid rgba(201, 169, 97, 0.4)"
          : "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: hover
          ? "0 10px 30px rgba(0, 0, 0, 0.4)"
          : "0 6px 20px rgba(0, 0, 0, 0.25)",
        transition:
          "border-color 150ms ease-out, box-shadow 150ms ease-out, background-color 150ms ease-out",
        }}
      >
      {/* Top row: identity (left) + hero metric (right) */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "#f5f5f7",
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {card.name}
          </div>
          {card.industry ? (
            <div
              style={{
                marginTop: 3,
                fontSize: 13,
                color: "rgba(245, 245, 247, 0.5)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {card.industry}
            </div>
          ) : null}
          {card.conglomerate ? (
            <div
              style={{
                marginTop: 3,
                fontSize: 12,
                color: "rgba(245, 245, 247, 0.35)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {card.conglomerate}
            </div>
          ) : null}
        </div>

        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div
            className="tabular"
            style={{
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1,
              margin: 0,
              color: "#f5f5f7",
            }}
          >
            {card.guardCount}
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(245, 245, 247, 0.4)",
            }}
          >
            Guards
          </div>
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: "0.5px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 12.5,
        }}
      >
        <span style={{ color: "rgba(245, 245, 247, 0.55)" }}>
          {card.detachmentCount} detachment{card.detachmentCount === 1 ? "" : "s"}
        </span>
        {card.expiringCount > 0 ? (
          <span style={{ color: "#d4b670", fontWeight: 500 }}>
            {card.expiringCount} expiring soon
          </span>
        ) : null}
      </div>
      </GlassCard>
    </Link>
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
