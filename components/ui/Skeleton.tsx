import type { CSSProperties } from "react";

// Shared loading-skeleton primitive: a light-tinted, gently pulsing box that
// stands in for real content while a route server-renders. Server-safe (no
// hooks) so it can be used directly inside loading.tsx files. The pulse and
// base tint live in globals.css (.ga-skeleton).
export function Skeleton({
  width = "100%",
  height = 16,
  radius,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className="ga-skeleton"
      style={{ width, height, ...(radius !== undefined ? { borderRadius: radius } : null), ...style }}
    />
  );
}
