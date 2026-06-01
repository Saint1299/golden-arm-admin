"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { IssueToGuardModal } from "./IssueToGuardModal";
import { GlassCard } from "@/components/ui/GlassCard";
import type { InventoryItem, ItemType } from "@/types/database";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

type GuardLedgerEntry = {
  id: string;
  item_id: string;
  item_name: string;
  item_asset_code: string | null;
  item_type_name: string | null;
  item_type_code: string | null;
  issued_date: string;
  returned_date: string | null;
  notes: string | null;
};

type RawRow = {
  id: string;
  item_id: string;
  issued_date: string;
  returned_date: string | null;
  notes: string | null;
  item:
    | (Pick<InventoryItem, "id" | "name" | "asset_code"> & {
        item_type: Pick<ItemType, "code" | "name"> | null;
      })
    | null;
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

export function GuardInventoryPanel({
  guardId,
  guardName,
}: {
  guardId: string;
  guardName: string;
}) {
  const [entries, setEntries] = useState<GuardLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Pure loader — fetches + maps but does NOT touch state. The effect and the
  // post-save refetch callback both wrap it with their own state writes, so
  // there's no synchronous setState inside the effect body itself.
  const loadEntries = useCallback(async (): Promise<GuardLedgerEntry[]> => {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("guard_inventory")
      .select(
        "id, item_id, issued_date, returned_date, notes, item:inventory_items(id, name, asset_code, item_type:item_types(code, name))",
      )
      .eq("guard_id", guardId)
      .order("issued_date", { ascending: false })
      .order("created_at", { ascending: false });
    return ((data ?? []) as unknown as RawRow[]).map((r) => ({
      id: r.id,
      item_id: r.item_id,
      item_name: r.item?.name ?? "Unknown item",
      item_asset_code: r.item?.asset_code ?? null,
      item_type_name: r.item?.item_type?.name ?? null,
      item_type_code: r.item?.item_type?.code ?? null,
      issued_date: r.issued_date,
      returned_date: r.returned_date,
      notes: r.notes,
    }));
  }, [guardId]);

  useEffect(() => {
    let active = true;
    (async () => {
      const next = await loadEntries();
      if (!active) return;
      setEntries(next);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadEntries]);

  async function refetch() {
    const next = await loadEntries();
    setEntries(next);
  }

  const { held, past } = useMemo(() => {
    const heldArr: GuardLedgerEntry[] = [];
    const pastArr: GuardLedgerEntry[] = [];
    for (const e of entries) {
      if (e.returned_date === null) heldArr.push(e);
      else pastArr.push(e);
    }
    return { held: heldArr, past: pastArr };
  }, [entries]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          style={goldButtonStyle}
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
          Issue item to this guard
        </button>
      </div>

      <Section
        title="Currently held"
        emptyMessage={
          loading ? "Loading…" : "No items currently issued to this guard."
        }
        entries={held}
        showReturned={false}
      />

      <Section
        title="Past items"
        emptyMessage={
          loading ? "Loading…" : "No past items in this guard’s history."
        }
        entries={past}
        showReturned
      />

      {modalOpen ? (
        <IssueToGuardModal
          guardId={guardId}
          guardName={guardName}
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

function Section({
  title,
  entries,
  emptyMessage,
  showReturned,
}: {
  title: string;
  entries: GuardLedgerEntry[];
  emptyMessage: string;
  showReturned: boolean;
}) {
  return (
    <div>
      <h2
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#f5f5f7",
          letterSpacing: "-0.01em",
          marginBottom: 10,
        }}
      >
        {title}
        {entries.length > 0 ? (
          <span
            className="tabular"
            style={{
              marginLeft: 8,
              fontSize: 12,
              color: "rgba(245, 245, 247, 0.5)",
              fontWeight: 500,
            }}
          >
            ({entries.length})
          </span>
        ) : null}
      </h2>
      <GlassCard style={{ padding: 0, overflow: "hidden" }}>
        {entries.length === 0 ? (
          <div
            style={{
              padding: "28px 24px",
              textAlign: "center",
              color: "rgba(245, 245, 247, 0.6)",
              fontSize: 13,
            }}
          >
            {emptyMessage}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headerCellStyle}>Asset code</th>
                <th style={headerCellStyle}>Item</th>
                <th style={headerCellStyle}>Type</th>
                <th style={headerCellStyle}>Issued</th>
                {showReturned ? (
                  <th style={headerCellStyle}>Returned</th>
                ) : null}
                <th style={headerCellStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td style={bodyCellStyle} className="tabular">
                    {e.item_asset_code ? (
                      <Link
                        href={`/inventory/items/${e.item_id}`}
                        style={{
                          color: "#d4b670",
                          textDecoration: "none",
                          letterSpacing: "0.02em",
                          fontWeight: 500,
                        }}
                      >
                        {e.item_asset_code}
                      </Link>
                    ) : (
                      <span style={{ color: "rgba(245, 245, 247, 0.35)" }}>
                        —
                      </span>
                    )}
                  </td>
                  <td style={{ ...bodyCellStyle, color: "#f5f5f7" }}>
                    <Link
                      href={`/inventory/items/${e.item_id}`}
                      style={{
                        color: "#f5f5f7",
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      {e.item_name}
                    </Link>
                  </td>
                  <td style={bodyCellStyle}>
                    {e.item_type_name ?? "—"}
                  </td>
                  <td style={bodyCellStyle} className="tabular">
                    {e.issued_date}
                  </td>
                  {showReturned ? (
                    <td style={bodyCellStyle} className="tabular">
                      {e.returned_date ?? "—"}
                    </td>
                  ) : null}
                  <td
                    style={{
                      ...bodyCellStyle,
                      maxWidth: 240,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={e.notes ?? undefined}
                  >
                    {e.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>
    </div>
  );
}
