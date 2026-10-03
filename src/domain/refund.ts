/** Cancellation policy. Mirrors SQL refund_percent(); the database is authoritative. */
export const REFUND_TIERS = [
  { label: "More than 24 hours before kick-off", percent: 100 },
  { label: "6 to 24 hours before kick-off", percent: 50 },
  { label: "Less than 6 hours before kick-off", percent: 0 },
] as const;

const HOUR = 3_600_000;

export type RefundPercent = 0 | 50 | 100;

export function refundPercent(kickoff: Date, at: Date): RefundPercent {
  const ms = kickoff.getTime() - at.getTime();
  if (ms > 24 * HOUR) return 100;
  if (ms >= 6 * HOUR) return 50;
  return 0;
}

export function refundFor(amountPaise: number, kickoff: Date, at: Date) {
  const percent = refundPercent(kickoff, at);
  return { percent, refundPaise: Math.floor((amountPaise * percent) / 100) };
}
