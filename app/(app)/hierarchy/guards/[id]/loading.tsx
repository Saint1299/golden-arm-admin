import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function GuardDetailLoading() {
  return (
    <div style={{ maxWidth: 860 }}>
      <Skeleton width={32} height={32} radius={8} />
      <div style={{ height: 12 }} />
      <Skeleton width={300} height={13} radius={6} />

      {/* Header: photo + name */}
      <div style={{ height: 16 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Skeleton width={128} height={128} radius="50%" />
        <div style={{ flex: 1 }}>
          <Skeleton width={260} height={26} radius={6} />
          <div style={{ height: 12 }} />
          <Skeleton width={80} height={20} radius={6} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ height: 24 }} />
      <div style={{ display: "flex", gap: 16 }}>
        <Skeleton width={64} height={20} radius={6} />
        <Skeleton width={72} height={20} radius={6} />
        <Skeleton width={84} height={20} radius={6} />
      </div>

      {/* Details grid */}
      <div style={{ height: 20 }} />
      {Array.from({ length: 3 }).map((_, s) => (
        <GlassCard key={s} style={{ marginBottom: 16 }}>
          <Skeleton width={120} height={12} radius={6} />
          <div style={{ height: 16 }} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px 32px",
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton width="50%" height={11} radius={6} />
                <div style={{ height: 8 }} />
                <Skeleton width="80%" height={14} radius={6} />
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
