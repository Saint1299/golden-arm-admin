import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function InventoryItemLoading() {
  return (
    <div style={{ maxWidth: 1000 }}>
      <Skeleton width={32} height={32} radius={8} />
      <div style={{ height: 12 }} />
      <Skeleton width={260} height={13} radius={6} />

      {/* Header */}
      <div style={{ height: 16 }} />
      <Skeleton width={300} height={28} radius={6} />
      <div style={{ height: 12 }} />
      <Skeleton width={120} height={20} radius={6} />

      {/* Detail card */}
      <div style={{ height: 24 }} />
      <GlassCard>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px 32px",
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton width="50%" height={11} radius={6} />
              <div style={{ height: 8 }} />
              <Skeleton width="80%" height={14} radius={6} />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
