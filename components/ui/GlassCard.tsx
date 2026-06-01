import type { CSSProperties, ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function GlassCard({ children, className = "", style }: GlassCardProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 12,
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)",
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
