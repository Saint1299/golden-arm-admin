import {
  ALERT_STATUS_LABEL,
  DOCUMENT_SCOPE_LABEL,
  type AlertStatus,
  type DocumentScope,
} from "@/types/database";

const pillBase = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
} as const;

const SCOPE_PILL: Record<DocumentScope, { bg: string; fg: string }> = {
  guard: { bg: "rgba(99, 102, 241, 0.14)", fg: "#a5a8f5" },
  client: { bg: "rgba(201, 169, 97, 0.14)", fg: "#d4b670" },
  company: { bg: "rgba(245, 245, 247, 0.08)", fg: "rgba(245, 245, 247, 0.7)" },
};

const ALERT_PILL: Record<AlertStatus, { bg: string; fg: string }> = {
  expired: { bg: "rgba(244, 63, 94, 0.16)", fg: "#fb7185" },
  due_soon: { bg: "rgba(245, 158, 11, 0.16)", fg: "#fbbf24" },
  ok: { bg: "rgba(16, 185, 129, 0.16)", fg: "#34d399" },
};

export function ScopeBadge({ scope }: { scope: DocumentScope }) {
  const pill = SCOPE_PILL[scope];
  return (
    <span style={{ ...pillBase, backgroundColor: pill.bg, color: pill.fg }}>
      {DOCUMENT_SCOPE_LABEL[scope]}
    </span>
  );
}

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const pill = ALERT_PILL[status];
  return (
    <span style={{ ...pillBase, backgroundColor: pill.bg, color: pill.fg }}>
      {ALERT_STATUS_LABEL[status]}
    </span>
  );
}
