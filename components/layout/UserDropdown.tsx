"use client";

import { useEffect, useRef, useState } from "react";
import { useSignOut } from "@/lib/auth/sign-out";

function getInitials(fullName: string | null, email: string): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => (p[0] ?? "").toUpperCase())
      .join("");
  }
  const local = email.split("@")[0] ?? "";
  return (local[0] ?? "?").toUpperCase();
}

function getDisplayName(fullName: string | null, email: string): string {
  if (fullName && fullName.trim()) return fullName.trim();
  const local = email.split("@")[0] ?? "";
  return local || email;
}

type Props = {
  email: string;
  fullName: string | null;
};

export function UserDropdown({ email, fullName }: Props) {
  const [open, setOpen] = useState(false);
  const [triggerHover, setTriggerHover] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { signOut, loading: signingOut } = useSignOut();

  const initials = getInitials(fullName, email);
  const displayName = getDisplayName(fullName, email);

  // Outside-click closes the menu.
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  // Esc closes the menu.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setTriggerHover(true)}
        onMouseLeave={() => setTriggerHover(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 10px 6px 6px",
          background:
            open || triggerHover ? "rgba(255, 255, 255, 0.04)" : "transparent",
          border: `1px solid ${open || triggerHover ? "rgba(255, 255, 255, 0.14)" : "transparent"}`,
          borderRadius: 999,
          cursor: "pointer",
          fontFamily: "inherit",
          transition:
            "background-color 200ms ease-out, border-color 200ms ease-out",
        }}
      >
        <Avatar initials={initials} />
        <span
          className="topbar-user-meta"
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "flex-start",
            lineHeight: 1.15,
            textAlign: "left",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#f5f5f7",
              maxWidth: 180,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </span>
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(245, 245, 247, 0.5)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease-out",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            minWidth: 220,
            backgroundColor: "rgba(8, 11, 18, 0.95)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            padding: 6,
            zIndex: 60,
            animation: "modal-card-in 150ms ease-out",
          }}
        >
          <div
            style={{
              padding: "8px 10px 10px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#f5f5f7",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 11,
                color: "rgba(245, 245, 247, 0.5)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={email}
            >
              {email}
            </div>
          </div>

          <MenuButton
            label={signingOut ? "Signing out…" : "Sign out"}
            disabled={signingOut}
            onClick={handleSignOut}
            danger
          />
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "linear-gradient(180deg, #D4B670 0%, #C9A961 100%)",
        color: "#080b12",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.02em",
        boxShadow:
          "inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 1px 2px rgba(0, 0, 0, 0.4)",
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

function MenuButton({
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
      : "rgba(239, 68, 68, 0.85)"
    : "#f5f5f7";
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        borderRadius: 6,
        border: "none",
        fontFamily: "inherit",
        fontSize: 13,
        color,
        background: hover ? "rgba(255, 255, 255, 0.06)" : "transparent",
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.7 : 1,
        transition: "background-color 150ms ease-out, color 150ms ease-out",
      }}
    >
      {label}
    </button>
  );
}
