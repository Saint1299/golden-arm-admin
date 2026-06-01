"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "info";

type ToastEntry = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ACCENT_COLOR: Record<ToastType, string> = {
  success: "#10b981",
  error: "#ef4444",
  info: "#6366f1",
};

const TOAST_DURATION_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id =
      typeof performance !== "undefined" && performance.now
        ? performance.now() + Math.random()
        : Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <Toast key={t.id} entry={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Allow components to call useToast outside the provider without throwing
    // — return a noop rather than crashing the page.
    return { showToast: () => {} };
  }
  return ctx;
}

function Toast({
  entry,
  onDismiss,
}: {
  entry: ToastEntry;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  // Slide-in on mount, slide-out before unmount.
  useEffect(() => {
    const inId = window.requestAnimationFrame(() => setVisible(true));
    const dismissId = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(onDismiss, 220);
    }, TOAST_DURATION_MS);
    return () => {
      window.cancelAnimationFrame(inId);
      window.clearTimeout(dismissId);
    };
  }, [onDismiss]);

  const accent = ACCENT_COLOR[entry.type];

  return (
    <div
      role="status"
      style={{
        maxWidth: 280,
        backgroundColor: "rgba(8, 11, 18, 0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 10,
        padding: "12px 16px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
        color: "#f5f5f7",
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.4,
        transform: visible
          ? "translateY(0) scale(1)"
          : "translateY(16px) scale(0.98)",
        opacity: visible ? 1 : 0,
        transition: "transform 220ms ease-out, opacity 220ms ease-out",
        pointerEvents: "auto",
      }}
    >
      {entry.message}
    </div>
  );
}
