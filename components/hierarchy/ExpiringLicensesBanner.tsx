"use client";

import Link from "next/link";
import { useState } from "react";

export type ExpiringRow = {
  guardId: string;
  guardName: string;
  // Shown only when provided (client-scope banner spans detachments).
  detachmentName?: string | null;
  expiry: string | null;
  days: number;
};

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "expires today";
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export function ExpiringLicensesBanner({ rows }: { rows: ExpiringRow[] }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <div
      style={{
        marginBottom: 24,
        borderRadius: 12,
        backgroundColor: "rgba(201, 169, 97, 0.10)",
        border: "1px solid rgba(201, 169, 97, 0.35)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#d4b670"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ flexShrink: 0 }}
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span
          style={{
            flex: 1,
            fontSize: 13.5,
            fontWeight: 600,
            color: "#e7cf93",
          }}
        >
          {rows.length} guard{rows.length === 1 ? " has" : "s have"} licenses
          expiring in the next 30 days
        </span>
        <span style={{ fontSize: 12, color: "rgba(231, 207, 147, 0.7)" }}>
          {open ? "Hide" : "View"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(231, 207, 147, 0.7)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease-out",
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div style={{ borderTop: "1px solid rgba(201, 169, 97, 0.25)" }}>
          {rows.map((r) => (
            <Link
              key={r.guardId}
              href={`/hierarchy/guards/${r.guardId}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                textDecoration: "none",
                borderTop: "1px solid rgba(201, 169, 97, 0.12)",
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#f5f5f7",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.guardName}
              </span>
              {r.detachmentName !== undefined ? (
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(245, 245, 247, 0.5)",
                    flexShrink: 0,
                  }}
                >
                  {r.detachmentName ?? "No detachment"}
                </span>
              ) : null}
              <span
                className="tabular"
                style={{
                  fontSize: 12,
                  color: "rgba(245, 245, 247, 0.6)",
                  flexShrink: 0,
                }}
              >
                {r.expiry ?? "—"}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: r.days < 0 ? "#fb7185" : "#fbbf24",
                  flexShrink: 0,
                  minWidth: 92,
                  textAlign: "right",
                }}
              >
                {daysLabel(r.days)}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
