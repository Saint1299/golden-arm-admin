import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ClientDetailLoading() {
  return (
    <div style={{ maxWidth: 1100 }}>
      <Skeleton width={32} height={32} radius={8} />
      <div style={{ height: 12 }} />
      <Skeleton width={220} height={13} radius={6} />

      {/* Header */}
      <div style={{ height: 16 }} />
      <Skeleton width={280} height={28} radius={6} />
      <div style={{ height: 12 }} />
      <Skeleton width={420} height={13} radius={6} />

      <div style={{ height: 28 }} />

      {/* Detachments */}
      <Skeleton width={140} height={18} radius={6} />
      <div style={{ height: 12 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <GlassCard key={i} style={{ padding: 16 }}>
            <Skeleton width="40%" height={15} radius={6} />
            <div style={{ height: 8 }} />
            <Skeleton width="60%" height={12} radius={6} />
          </GlassCard>
        ))}
      </div>

      {/* Compliance */}
      <div style={{ height: 32 }} />
      <Skeleton width={240} height={18} radius={6} />
      <div style={{ height: 12 }} />
      <GlassCard>
        <Skeleton width="100%" height={48} radius={8} />
      </GlassCard>
    </div>
  );
}
