import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function DetachmentDetailLoading() {
  return (
    <div style={{ maxWidth: 1100 }}>
      <Skeleton width={32} height={32} radius={8} />
      <div style={{ height: 12 }} />
      <Skeleton width={320} height={13} radius={6} />

      {/* Header */}
      <div style={{ height: 16 }} />
      <Skeleton width={300} height={28} radius={6} />
      <div style={{ height: 12 }} />
      <Skeleton width={380} height={13} radius={6} />

      <div style={{ height: 28 }} />

      {/* Shift tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Skeleton width={50} height={20} radius={6} />
        <Skeleton width={80} height={20} radius={6} />
        <Skeleton width={90} height={20} radius={6} />
      </div>

      {/* Unassigned strip + chart canvas */}
      <GlassCard style={{ padding: 12 }}>
        <Skeleton width="100%" height={36} radius={8} />
      </GlassCard>
      <div style={{ height: 16 }} />
      <GlassCard style={{ padding: 0 }}>
        <Skeleton height={420} radius={0} style={{ opacity: 0.5 }} />
      </GlassCard>

      {/* Relievers strip */}
      <div style={{ height: 32 }} />
      <Skeleton width={120} height={18} radius={6} />
      <div style={{ height: 12 }} />
      <div style={{ display: "flex", gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width={220} height={110} radius={10} />
        ))}
      </div>
    </div>
  );
}
