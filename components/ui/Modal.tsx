"use client";

import { useEffect, type ReactNode } from "react";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
};

export function Modal({ title, onClose, children, maxWidth = 480 }: ModalProps) {
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
        overflowY: "auto",
        animation: "modal-overlay-in 200ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth,
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
          boxShadow:
            "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)",
          padding: 32,
          animation: "modal-card-in 250ms ease-out",
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
        <div style={{ height: 24 }} />
        {children}
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
