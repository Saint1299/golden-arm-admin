"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { InventoryCategoryBadge, InventoryStatusBadge } from "./badges";
import { IssueItemModal } from "./IssueItemModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { InventoryItem } from "@/types/database";

export type HistoryEntry = {
  id: string;
  guard_id: string;
  guard_name: string;
  issued_date: string;
  returned_date: string | null;
  notes: string | null;
};

type RawHistoryRow = {
  id: string;
  guard_id: string;
  issued_date: string;
  returned_date: string | null;
  notes: string | null;
  guard: { id: string; full_name: string } | null;
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

const todayIso = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export function InventoryItemDetailView({
  item,
  initialHistory,
}: {
  item: InventoryItem;
  initialHistory: HistoryEntry[];
}) {
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);
  const [issuing, setIssuing] = useState(false);
  const [returning, setReturning] = useState(false);
  const { showToast } = useToast();

  const openAssignment = useMemo(
    () => history.find((h) => h.returned_date === null) ?? null,
    [history],
  );

  const refetchHistory = useCallback(async () => {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("guard_inventory")
      .select("*, guard:guards(id, full_name)")
      .eq("item_id", item.id)
      .order("issued_date", { ascending: false })
      .order("created_at", { ascending: false });
    const next: HistoryEntry[] = ((data ?? []) as RawHistoryRow[]).map((h) => ({
      id: h.id,
      guard_id: h.guard_id,
      guard_name: h.guard?.full_name ?? "Unknown",
      issued_date: h.issued_date,
      returned_date: h.returned_date,
      notes: h.notes,
    }));
    setHistory(next);
  }, [item.id]);

  async function handleReturn() {
    if (!openAssignment) return;
    const ok = window.confirm(
      `Mark "${item.name}" as returned by ${openAssignment.guard_name} today?`,
    );
    if (!ok) return;
    setReturning(true);
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("guard_inventory")
      .update({ returned_date: todayIso() })
      .eq("id", openAssignment.id);
    setReturning(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Item returned", "success");
    refetchHistory();
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <Breadcrumb itemName={item.name} />

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
              {item.name}
            </h1>
            <InventoryStatusBadge status={item.status} />
            <InventoryCategoryBadge category={item.category} />
          </div>
          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              fontSize: 13,
              color: "rgba(245, 245, 247, 0.5)",
            }}
          >
            {openAssignment ? (
              <>
                Currently held by{" "}
                <Link
                  href={`/hierarchy/guards/${openAssignment.guard_id}`}
                  style={{
                    color: "rgba(245, 245, 247, 0.85)",
                    textDecoration: "none",
                  }}
                >
                  {openAssignment.guard_name}
                </Link>
                {" · since "}
                <span className="tabular">{openAssignment.issued_date}</span>
              </>
            ) : (
              "Not currently issued."
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {openAssignment ? (
            <button
              type="button"
              style={{
                ...secondaryButtonStyle,
                cursor: returning ? "wait" : "pointer",
                opacity: returning ? 0.7 : 1,
              }}
              disabled={returning}
              onClick={handleReturn}
            >
              {returning ? "Returning…" : "Return item"}
            </button>
          ) : null}
          <button
            type="button"
            style={{
              ...goldButtonStyle,
              opacity: openAssignment ? 0.5 : 1,
              cursor: openAssignment ? "not-allowed" : "pointer",
            }}
            disabled={Boolean(openAssignment)}
            onClick={() => setIssuing(true)}
            title={
              openAssignment
                ? "Already issued — return it first."
                : "Issue to a guard"
            }
          >
            Issue to guard
          </button>
        </div>
      </div>

      <div style={{ height: 24 }} />

      <SectionHeading>Item details</SectionHeading>
      <GlassCard>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px 32px",
          }}
        >
          <DetailItem label="Name" value={item.name} />
          <DetailItem
            label="Category"
            value={<InventoryCategoryBadge category={item.category} />}
          />
          <DetailItem label="Serial no." value={item.serial_no} tabular />
          <DetailItem
            label="Status"
            value={<InventoryStatusBadge status={item.status} />}
          />
        </div>
        {item.notes ? (
          <>
            <div
              style={{
                height: 1,
                margin: "20px 0",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
              }}
            />
            <DetailItem label="Notes" value={item.notes} multiline />
          </>
        ) : null}
      </GlassCard>

      <div style={{ height: 28 }} />

      <SectionHeading>Assignment history</SectionHeading>
      <GlassCard style={{ padding: 0, overflow: "hidden" }}>
        {history.length === 0 ? (
          <div
            style={{
              padding: "32px 24px",
              textAlign: "center",
              color: "rgba(245, 245, 247, 0.6)",
              fontSize: 13,
            }}
          >
            This item hasn’t been issued yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headerCellStyle}>Guard</th>
                <th style={headerCellStyle}>Issued</th>
                <th style={headerCellStyle}>Returned</th>
                <th style={headerCellStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td style={{ ...bodyCellStyle, color: "#f5f5f7" }}>
                    <Link
                      href={`/hierarchy/guards/${h.guard_id}`}
                      style={{ color: "#f5f5f7", textDecoration: "none" }}
                    >
                      {h.guard_name}
                    </Link>
                  </td>
                  <td style={bodyCellStyle} className="tabular">
                    {h.issued_date}
                  </td>
                  <td style={bodyCellStyle} className="tabular">
                    {h.returned_date ?? (
                      <span style={{ color: "#10b981" }}>Currently held</span>
                    )}
                  </td>
                  <td
                    style={{
                      ...bodyCellStyle,
                      maxWidth: 320,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={h.notes ?? undefined}
                  >
                    {h.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>

      {issuing ? (
        <IssueItemModal
          itemId={item.id}
          itemName={item.name}
          onClose={() => setIssuing(false)}
          onSaved={() => {
            setIssuing(false);
            refetchHistory();
          }}
        />
      ) : null}
    </div>
  );
}

function Breadcrumb({ itemName }: { itemName: string }) {
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
        href="/inventory"
        style={{ color: "rgba(245, 245, 247, 0.6)", textDecoration: "none" }}
      >
        Inventory
      </Link>
      <span aria-hidden>/</span>
      <span style={{ color: "rgba(245, 245, 247, 0.7)" }}>{itemName}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 16,
        fontWeight: 600,
        color: "#f5f5f7",
        letterSpacing: "-0.01em",
        marginBottom: 12,
      }}
    >
      {children}
    </h2>
  );
}

function DetailItem({
  label,
  value,
  tabular,
  multiline,
}: {
  label: string;
  value: ReactNode;
  tabular?: boolean;
  multiline?: boolean;
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
