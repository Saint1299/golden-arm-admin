import {
  INVENTORY_CATEGORY_LABEL,
  INVENTORY_STATUS_LABEL,
  type InventoryCategory,
  type InventoryStatus,
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

// Categories share a calm neutral palette so the eye lands on status instead.
const CATEGORY_PILL: Record<InventoryCategory, { bg: string; fg: string }> = {
  uniform: { bg: "rgba(99, 102, 241, 0.12)", fg: "#a5a8f5" },
  firearm: { bg: "rgba(239, 68, 68, 0.12)", fg: "#f87171" },
  detector: { bg: "rgba(16, 185, 129, 0.12)", fg: "#10b981" },
  radio: { bg: "rgba(99, 102, 241, 0.12)", fg: "#a5a8f5" },
  flashlight: { bg: "rgba(245, 158, 11, 0.12)", fg: "#f59e0b" },
  baton: { bg: "rgba(245, 245, 247, 0.08)", fg: "rgba(245, 245, 247, 0.7)" },
  vehicle: { bg: "rgba(201, 169, 97, 0.12)", fg: "#d4b670" },
  other: { bg: "rgba(245, 245, 247, 0.06)", fg: "rgba(245, 245, 247, 0.5)" },
};

const STATUS_PILL: Record<InventoryStatus, { bg: string; fg: string }> = {
  available: { bg: "rgba(16, 185, 129, 0.12)", fg: "#10b981" },
  issued: { bg: "rgba(99, 102, 241, 0.14)", fg: "#a5a8f5" },
  maintenance: { bg: "rgba(245, 158, 11, 0.12)", fg: "#f59e0b" },
  retired: { bg: "rgba(245, 245, 247, 0.08)", fg: "rgba(245, 245, 247, 0.4)" },
};

export function InventoryCategoryBadge({
  category,
}: {
  category: InventoryCategory;
}) {
  const pill = CATEGORY_PILL[category];
  return (
    <span style={{ ...pillBase, backgroundColor: pill.bg, color: pill.fg }}>
      {INVENTORY_CATEGORY_LABEL[category]}
    </span>
  );
}

export function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  const pill = STATUS_PILL[status];
  return (
    <span style={{ ...pillBase, backgroundColor: pill.bg, color: pill.fg }}>
      {INVENTORY_STATUS_LABEL[status]}
    </span>
  );
}
