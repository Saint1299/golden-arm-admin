"use client";

import { useEffect, type ReactNode } from "react";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  // Optional fixed footer. When provided, the body scrolls and this stays
  // pinned at the bottom of the card so the primary action is always in
  // reach even with a tall form on a short viewport.
  footer?: ReactNode;
};

export function Modal({
  title,
  onClose,
  children,
  maxWidth = 480,
  footer,
}: ModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "modal-overlay-in 200ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
          boxShadow:
            "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)",
          animation: "modal-card-in 250ms ease-out",
        }}
      >
        {/* Header (fixed) */}
        <div
          style={{
            position: "relative",
            padding: "28px 32px 16px",
            flexShrink: 0,
          }}
        >
          <CloseButton onClose={onClose} />
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#f5f5f7",
              marginRight: 32,
            }}
          >
            {title}
          </h2>
        </div>

        {/* Body (scrollable) — min-height: 0 so flex lets it shrink below
            content size, which is what enables the overflow scroll. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "8px 32px 24px",
          }}
        >
          {children}
        </div>

        {/* Footer (fixed) — optional */}
        {footer ? (
          <div
            style={{
              flexShrink: 0,
              padding: "16px 32px 24px",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        width: 28,
        height: 28,
        padding: 0,
        backgroundColor: "transparent",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(245, 245, 247, 0.6)"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    </button>
  );
}
