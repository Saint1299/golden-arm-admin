import type { AlertStatus } from "@/types/database";

// 30-day threshold matches the compliance_board view's classification so the
// guard/client detail panels (which read documents directly) agree with the
// main /compliance board.
export const DUE_SOON_THRESHOLD_DAYS = 30;

export function daysRemaining(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return null;
  const diff = expiry.getTime() - today.getTime();
  return Math.floor(diff / 86_400_000);
}

export function computeAlertStatus(
  expiryDate: string | null,
): AlertStatus {
  if (!expiryDate) return "ok";
  const days = daysRemaining(expiryDate);
  if (days === null) return "ok";
  if (days < 0) return "expired";
  if (days <= DUE_SOON_THRESHOLD_DAYS) return "due_soon";
  return "ok";
}

// Section header + card accents. Muted, on-brand for the dark-glass look:
// low-alpha tints on the background, a brighter border to define the card
// edge, and a Tailwind-400 hex for text legibility on the dark base. The
// rhythm mirrors the existing gold (#C9A961) brand accent treatment.
export const ALERT_ACCENT: Record<AlertStatus, { fg: string; bg: string; border: string }> = {
  expired: {
    fg: "#fb7185",
    bg: "rgba(244, 63, 94, 0.10)",
    border: "rgba(244, 63, 94, 0.35)",
  },
  due_soon: {
    fg: "#fbbf24",
    bg: "rgba(245, 158, 11, 0.10)",
    border: "rgba(245, 158, 11, 0.40)",
  },
  ok: {
    fg: "#34d399",
    bg: "rgba(16, 185, 129, 0.10)",
    border: "rgba(16, 185, 129, 0.35)",
  },
};
