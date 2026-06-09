import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
};

export function GlassCard({
  children,
  className = "",
  style,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: GlassCardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
