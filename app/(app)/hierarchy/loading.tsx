import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function HierarchyLoading() {
  return (
    <div style={{ maxWidth: 1280 }}>
      <Skeleton width={140} height={28} radius={6} />
      <div style={{ height: 12 }} />
      <Skeleton width={360} height={14} radius={6} />

      <div style={{ height: 24 }} />
      <Skeleton width={360} height={42} radius={8} />
      <div style={{ height: 20 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <GlassCard key={i} style={{ padding: 22 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <Skeleton width="70%" height={18} radius={6} />
                <div style={{ height: 8 }} />
                <Skeleton width="45%" height={13} radius={6} />
              </div>
              <Skeleton width={48} height={34} radius={6} />
            </div>
            <div style={{ height: 18 }} />
            <Skeleton height={1} radius={0} style={{ opacity: 0.4 }} />
            <div style={{ height: 14 }} />
            <Skeleton width="40%" height={13} radius={6} />
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
