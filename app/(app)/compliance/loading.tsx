import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ComplianceLoading() {
  return (
    <div style={{ maxWidth: 1280 }}>
      <Skeleton width={200} height={28} radius={6} />
      <div style={{ height: 12 }} />
      <Skeleton width={400} height={14} radius={6} />

      <div style={{ height: 24 }} />
      <Skeleton width={360} height={42} radius={8} />
      <div style={{ height: 24 }} />

      {Array.from({ length: 3 }).map((_, s) => (
        <div key={s} style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Skeleton width={9} height={9} radius="50%" />
            <Skeleton width={120} height={15} radius={6} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <GlassCard key={i} style={{ padding: "12px 14px" }}>
                <Skeleton width="35%" height={14} radius={6} />
                <div style={{ height: 8 }} />
                <Skeleton width="55%" height={12} radius={6} />
              </GlassCard>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
