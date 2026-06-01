import {
  CLIENT_TYPE_LABEL,
  GUARD_STATUS_LABEL,
  type ClientType,
  type GuardStatus,
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

const CLIENT_TYPE_PILL: Record<ClientType, { bg: string; fg: string }> = {
  single_post: { bg: "rgba(99, 102, 241, 0.14)", fg: "#a5a8f5" },
  pooled: { bg: "rgba(201, 169, 97, 0.14)", fg: "#d4b670" },
};

const GUARD_STATUS_PILL: Record<GuardStatus, { bg: string; fg: string }> = {
  active: { bg: "rgba(16, 185, 129, 0.12)", fg: "#10b981" },
  reliever: { bg: "rgba(99, 102, 241, 0.14)", fg: "#a5a8f5" },
  on_leave: { bg: "rgba(245, 158, 11, 0.12)", fg: "#f59e0b" },
  inactive: { bg: "rgba(245, 245, 247, 0.08)", fg: "rgba(245, 245, 247, 0.4)" },
};

export function ClientTypeBadge({ type }: { type: ClientType }) {
  const pill = CLIENT_TYPE_PILL[type];
  return (
    <span style={{ ...pillBase, backgroundColor: pill.bg, color: pill.fg }}>
      {CLIENT_TYPE_LABEL[type]}
    </span>
  );
}

export function GuardStatusBadge({ status }: { status: GuardStatus }) {
  const pill = GUARD_STATUS_PILL[status];
  return (
    <span style={{ ...pillBase, backgroundColor: pill.bg, color: pill.fg }}>
      {GUARD_STATUS_LABEL[status]}
    </span>
  );
}
