"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

// A subtle left-arrow icon button placed above the breadcrumb/title as a
// distinct "go back" affordance. Pass `href` for a fixed destination, or
// `onClick` (e.g. router.back()) when the origin can vary. Matches the
// admin's icon-button treatment: muted by default, gold accent on hover.
export function BackButton({
  href,
  onClick,
  label = "Back",
}: {
  href?: string;
  onClick?: () => void;
  label?: string;
}) {
  const [hover, setHover] = useState(false);

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 8,
    background: hover ? "rgba(201, 169, 97, 0.10)" : "rgba(255, 255, 255, 0.04)",
    border: `1px solid ${hover ? "rgba(201, 169, 97, 0.45)" : "rgba(255, 255, 255, 0.10)"}`,
    color: hover ? "#d4b670" : "rgba(245, 245, 247, 0.6)",
    cursor: "pointer",
    transition: "color 150ms ease-out, background-color 150ms ease-out, border-color 150ms ease-out",
    padding: 0,
  };

  const icon = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );

  const wrap: CSSProperties = { marginBottom: 12 };

  if (href) {
    return (
      <div style={wrap}>
        <Link
          href={href}
          aria-label={label}
          title={label}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={style}
        >
          {icon}
        </Link>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={style}
      >
        {icon}
      </button>
    </div>
  );
}
