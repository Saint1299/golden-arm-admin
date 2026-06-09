"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { GuardStatusBadge } from "./badges";
import type { Guard, GuardStatus } from "@/types/database";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic on-brand gradient from the name so each placeholder is stable
// and visually distinct without straying from the dark/gold palette.
function gradientFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  const a = h;
  const b = (h + 40) % 360;
  return `linear-gradient(135deg, hsl(${a} 42% 30%) 0%, hsl(${b} 38% 18%) 100%)`;
}

export function GuardAvatar({
  name,
  photoUrl,
  size = 64,
  ring = true,
}: {
  name: string;
  // Pre-signed display URL (or legacy http). Null → gradient + initials.
  photoUrl: string | null;
  size?: number;
  ring?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  const showImg = photoUrl && !errored;
  const border = ring ? "2px solid rgba(201, 169, 97, 0.45)" : "none";
  const common: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    objectFit: "cover",
    border,
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.35)",
  };
  if (showImg) {
    return (
      // Signed Supabase URLs are short-lived and per-guard; next/image's
      // optimizer/caching doesn't help here, so a plain img is intentional.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        onError={() => setErrored(true)}
        style={common}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        ...common,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: gradientFor(name),
        color: "rgba(245, 245, 247, 0.92)",
        fontWeight: 600,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        letterSpacing: "0.02em",
        userSelect: "none",
      }}
    >
      {initials(name)}
    </div>
  );
}

// A rectangular, edge-to-edge photo block (vs the round GuardAvatar). Fills
// its parent; the parent decides the dimensions. Real photos crop with
// object-fit: cover; unphotographed guards get the gradient + initials.
export function GuardPhotoBlock({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl: string | null;
}) {
  const [errored, setErrored] = useState(false);
  if (photoUrl && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        onError={() => setErrored(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: gradientFor(name),
        color: "rgba(245, 245, 247, 0.92)",
        fontWeight: 600,
        fontSize: 32,
        letterSpacing: "0.02em",
        userSelect: "none",
      }}
    >
      {initials(name)}
    </div>
  );
}

// A clickable guard summary card: avatar + name + license + status. Used in
// the detachment single-post body and various lists. `photoUrl` is a signed
// URL resolved by the caller (server batch or client fetch).
export function GuardCard({
  guard,
  photoUrl,
  avatarSize = 64,
}: {
  guard: Pick<Guard, "id" | "full_name" | "license_no" | "status"> & {
    status: GuardStatus;
  };
  photoUrl: string | null;
  avatarSize?: number;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/hierarchy/guards/${guard.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 14,
        borderRadius: 12,
        textDecoration: "none",
        backgroundColor: hover
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        transition: "background-color 150ms ease-out",
      }}
    >
      <GuardAvatar name={guard.full_name} photoUrl={photoUrl} size={avatarSize} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#f5f5f7",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {guard.full_name}
        </div>
        <div
          className="tabular"
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "rgba(245, 245, 247, 0.55)",
          }}
        >
          {guard.license_no ? `License ${guard.license_no}` : "No license no."}
        </div>
        <div style={{ marginTop: 8 }}>
          <GuardStatusBadge status={guard.status} />
        </div>
      </div>
    </Link>
  );
}
