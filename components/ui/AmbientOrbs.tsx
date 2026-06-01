import type { CSSProperties } from "react";

type Orb = {
  color: string;
  size: number;
  blur: number;
  opacity: number;
  position: CSSProperties;
  animation: string;
};

const orbs: Orb[] = [
  {
    color: "#c9a961",
    size: 600,
    blur: 200,
    opacity: 0.11,
    position: { top: "-8%", left: "-6%" },
    animation: "drift-1 75s ease-in-out infinite alternate",
  },
  {
    color: "#6366f1",
    size: 700,
    blur: 220,
    opacity: 0.08,
    position: { bottom: "-12%", right: "-10%" },
    animation: "drift-2 85s ease-in-out infinite alternate",
  },
  {
    color: "#3b1f8a",
    size: 500,
    blur: 180,
    opacity: 0.1,
    position: { top: "28%", right: "8%" },
    animation: "drift-3 65s ease-in-out infinite alternate",
  },
];

export function AmbientOrbs() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {orbs.map((orb, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...orb.position,
            width: `${orb.size}px`,
            height: `${orb.size}px`,
            borderRadius: "50%",
            backgroundColor: orb.color,
            filter: `blur(${orb.blur}px)`,
            opacity: orb.opacity,
            animation: orb.animation,
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
