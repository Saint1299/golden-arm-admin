"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientTypeBadge } from "./badges";
import type { ClientWithCount } from "./HierarchyBrowser";

export function ClientCard({
  client,
  onEdit,
  onDelete,
}: {
  client: ClientWithCount;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: `1px solid ${hover ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.08)"}`,
        borderRadius: 12,
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)",
        transition: "border-color 200ms ease-out",
      }}
    >
      <Link
        href={`/hierarchy/clients/${client.id}`}
        style={{
          display: "block",
          padding: "20px 20px 16px",
          textDecoration: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
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
            {client.name}
          </h3>
          <ClientTypeBadge type={client.type} />
        </div>

        {client.industry || client.conglomerate ? (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 12,
              color: "rgba(245, 245, 247, 0.45)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {[client.conglomerate, client.industry]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}

        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "rgba(245, 245, 247, 0.6)",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(245, 245, 247, 0.5)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="tabular">{client.guard_count}</span>
          <span>{client.guard_count === 1 ? "guard" : "guards"}</span>
        </div>
      </Link>

      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "0 20px 16px",
          justifyContent: "flex-end",
        }}
      >
        <CardAction label="Edit" onClick={onEdit} />
        <CardAction label="Delete" onClick={onDelete} danger />
      </div>
    </div>
  );
}

function CardAction({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const color = danger
    ? hover
      ? "#ef4444"
      : "rgba(239, 68, 68, 0.7)"
    : hover
      ? "#f5f5f7"
      : "rgba(245, 245, 247, 0.5)";
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        fontSize: 12,
        fontFamily: "inherit",
        fontWeight: 500,
        cursor: "pointer",
        color,
        transition: "color 150ms ease-out",
      }}
    >
      {label}
    </button>
  );
}
