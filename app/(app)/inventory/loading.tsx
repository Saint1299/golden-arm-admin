import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function InventoryLoading() {
  return (
    <div style={{ maxWidth: 1280 }}>
      <Skeleton width={160} height={28} radius={6} />
      <div style={{ height: 12 }} />
      <Skeleton width={380} height={14} radius={6} />

      <div style={{ height: 24 }} />
      <Skeleton width={360} height={42} radius={8} />
      <div style={{ height: 20 }} />

      <GlassCard style={{ padding: 0 }}>
        <div style={{ padding: "12px 16px" }}>
          <Skeleton width="30%" height={12} radius={6} />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "14px 16px",
              borderTop: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            <Skeleton width="26%" height={14} radius={6} />
            <Skeleton width="18%" height={14} radius={6} />
            <Skeleton width="16%" height={14} radius={6} />
            <Skeleton width={70} height={20} radius={6} />
          </div>
        ))}
      </GlassCard>
    </div>
  );
}
