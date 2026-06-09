import { daysRemaining } from "@/lib/compliance";
import type { Guard } from "@/types/database";

// Window for "expiring soon" license surfacing on the hierarchy cards and the
// client/detachment banners. Matches the compliance due-soon threshold.
export const LICENSE_EXPIRY_WINDOW_DAYS = 30;

export type ExpiringGuard = { guard: Guard; days: number };

// Guards whose license_expiry falls within the window. Includes already-expired
// guards (days < 0) so they keep surfacing until renewed. Sorted soonest-first
// (most negative / most overdue at the top).
export function expiringGuards(guards: Guard[]): ExpiringGuard[] {
  const out: ExpiringGuard[] = [];
  for (const g of guards) {
    const d = daysRemaining(g.license_expiry);
    if (d !== null && d <= LICENSE_EXPIRY_WINDOW_DAYS) {
      out.push({ guard: g, days: d });
    }
  }
  out.sort((a, b) => a.days - b.days);
  return out;
}

export function countExpiring(guards: Guard[]): number {
  return expiringGuards(guards).length;
}
