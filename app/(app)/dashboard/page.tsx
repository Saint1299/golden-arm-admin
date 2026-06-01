import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/GlassCard";

export const metadata: Metadata = {
  title: "Dashboard · Golden Arm Admin",
};

export default function DashboardPage() {
  return (
    <div style={{ maxWidth: 960 }}>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "#f5f5f7",
        }}
      >
        Dashboard
      </h1>
      <p
        style={{
          marginTop: 8,
          marginBottom: 0,
          fontSize: 14,
          color: "rgba(245, 245, 247, 0.6)",
        }}
      >
        Golden Arm Elite Security Agency — internal admin &amp; HR platform.
      </p>

      <div style={{ height: 24 }} />

      <GlassCard>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f7" }}>
          Welcome
        </h2>
        <p
          style={{
            marginTop: 8,
            marginBottom: 0,
            fontSize: 14,
            color: "rgba(245, 245, 247, 0.6)",
            lineHeight: 1.6,
          }}
        >
          This is the foundation shell. Features for Guard Deployment, Inventory Management, and
          the Compliance Board will be added in upcoming milestones.
        </p>
      </GlassCard>
    </div>
  );
}
