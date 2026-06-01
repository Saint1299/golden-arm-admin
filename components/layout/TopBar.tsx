"use client";

import { useState } from "react";
import { BrandLogo } from "./BrandLogo";
import { useMobileNav } from "./MobileNav";
import { UserDropdown } from "./UserDropdown";

function HamburgerButton() {
  const { toggle } = useMobileNav();
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      className="hamburger-button"
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Open menu"
      style={{
        width: 40,
        height: 40,
        padding: 0,
        backgroundColor: hover ? "rgba(255, 255, 255, 0.04)" : "transparent",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 8,
        cursor: "pointer",
        transition: "background-color 200ms ease-out",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(245, 245, 247, 0.6)"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden
      >
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
      </svg>
    </button>
  );
}

type Props = {
  email: string;
  fullName: string | null;
};

export function TopBar({ email, fullName }: Props) {
  return (
    <header
      style={{
        height: 64,
        flexShrink: 0,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "inset 0 -1px 0 rgba(255, 255, 255, 0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          minWidth: 0,
        }}
      >
        <HamburgerButton />
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <BrandLogo size={40} />
        </span>
        <span
          style={{
            display: "inline-flex",
            flexDirection: "column",
            lineHeight: 1.15,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "#f5f5f7",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Golden Arm Security
          </span>
          <span
            style={{
              marginTop: 2,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(245, 245, 247, 0.45)",
              whiteSpace: "nowrap",
            }}
          >
            Admin
          </span>
        </span>
      </div>

      <UserDropdown email={email} fullName={fullName} />
    </header>
  );
}
