"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { Guard, OrgNode } from "@/types/database";

export function NodeBox({
  node,
  assignedGuards,
  unassignedGuards,
  busy,
  canMoveUp,
  canMoveDown,
  onAddChild,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAssign,
  onUnassign,
}: {
  node: OrgNode;
  assignedGuards: Guard[];
  unassignedGuards: Guard[];
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onAddChild: () => void;
  onRename: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAssign: (guardId: string) => void;
  onUnassign: (guardId: string) => void;
}) {
  return (
    <div
      style={{
        display: "inline-block",
        width: 240,
        textAlign: "left",
        verticalAlign: "top",
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderTop: "2px solid #c9a961",
        borderRadius: 10,
        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)",
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#f5f5f7",
              letterSpacing: "-0.01em",
              wordBreak: "break-word",
            }}
          >
            {node.label}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(245, 245, 247, 0.4)",
            }}
          >
            Level {node.level}
          </div>
        </div>
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
          <ReorderButton dir="up" disabled={busy || !canMoveUp} onClick={onMoveUp} />
          <ReorderButton
            dir="down"
            disabled={busy || !canMoveDown}
            onClick={onMoveDown}
          />
        </div>
      </div>

      {/* Assigned guards */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {assignedGuards.length === 0 ? (
          <span
            style={{
              fontSize: 12,
              color: "rgba(245, 245, 247, 0.35)",
            }}
          >
            No guards assigned
          </span>
        ) : (
          assignedGuards.map((g) => (
            <GuardChip
              key={g.id}
              guard={g}
              busy={busy}
              onUnassign={() => onUnassign(g.id)}
            />
          ))
        )}
      </div>

      {/* Assign dropdown */}
      {unassignedGuards.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <AssignSelect
            unassignedGuards={unassignedGuards}
            disabled={busy}
            onAssign={onAssign}
          />
        </div>
      ) : null}

      {/* Actions */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <ActionButton label="Add child" onClick={onAddChild} disabled={busy} />
        <ActionButton label="Rename" onClick={onRename} disabled={busy} />
        <ActionButton label="Delete" onClick={onDelete} disabled={busy} danger />
      </div>
    </div>
  );
}

function GuardChip({
  guard,
  busy,
  onUnassign,
}: {
  guard: Guard;
  busy: boolean;
  onUnassign: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [xHover, setXHover] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 6,
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 6,
        padding: "5px 8px",
      }}
    >
      <Link
        href={`/hierarchy/guards/${guard.id}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: hover ? "#c9a961" : "#f5f5f7",
          textDecoration: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          transition: "color 150ms ease-out",
        }}
        title={guard.full_name}
      >
        {guard.full_name}
      </Link>
      <button
        type="button"
        onClick={onUnassign}
        disabled={busy}
        aria-label={`Unassign ${guard.full_name}`}
        title="Unassign"
        onMouseEnter={() => setXHover(true)}
        onMouseLeave={() => setXHover(false)}
        style={{
          flexShrink: 0,
          width: 16,
          height: 16,
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: busy ? "wait" : "pointer",
          color: xHover ? "#ef4444" : "rgba(245, 245, 247, 0.4)",
          transition: "color 150ms ease-out",
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function AssignSelect({
  unassignedGuards,
  disabled,
  onAssign,
}: {
  unassignedGuards: Guard[];
  disabled: boolean;
  onAssign: (guardId: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <select
        value=""
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value) onAssign(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${focused ? "rgba(201, 169, 97, 0.5)" : "rgba(255, 255, 255, 0.08)"}`,
          borderRadius: 6,
          padding: "6px 28px 6px 10px",
          color: "rgba(245, 245, 247, 0.7)",
          fontSize: 12,
          fontFamily: "inherit",
          outline: "none",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <option value="" style={{ background: "#080b12" }}>
          + Assign guard…
        </option>
        {unassignedGuards.map((g) => (
          <option key={g.id} value={g.id} style={{ background: "#080b12" }}>
            {g.full_name}
          </option>
        ))}
      </select>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(245, 245, 247, 0.5)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
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
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        color,
        transition: "color 150ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

const reorderBtnStyle: CSSProperties = {
  width: 18,
  height: 14,
  padding: 0,
  background: "transparent",
  border: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

function ReorderButton({
  dir,
  disabled,
  onClick,
}: {
  dir: "up" | "down";
  disabled: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const color =
    disabled
      ? "rgba(245, 245, 247, 0.25)"
      : hover
        ? "#f5f5f7"
        : "rgba(245, 245, 247, 0.5)";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={dir === "up" ? "Move up" : "Move down"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...reorderBtnStyle,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <svg
        width="10"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {dir === "up" ? (
          <polyline points="1 5 5 1 9 5" />
        ) : (
          <polyline points="1 1 5 5 9 1" />
        )}
      </svg>
    </button>
  );
}
