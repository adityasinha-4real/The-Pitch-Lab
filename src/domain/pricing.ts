import { toLocalParts } from "./time";

export type PricingRuleLike = {
  id?: string;
  label?: string;
  /** 0 = Sunday … 6 = Saturday */
  dow: number[];
  /** "HH:MM" or "HH:MM:SS"; end may be "24:00" */
  startTime: string;
  endTime: string;
  pricePaise: number;
};

export function timeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t.trim());
  if (!m) throw new Error(`Invalid time "${t}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) throw new Error(`Invalid time "${t}"`);
  return h * 60 + min;
}

export function minutesToTime(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/**
 * Price for a slot starting at `start` (DECISIONS D6): rules whose weekday
 * contains the slot's local weekday and whose [start, end) covers its start;
 * the narrowest window wins, ties go to the higher price. Mirrors SQL slot_price().
 */
export function resolvePrice<R extends PricingRuleLike>(
  rules: readonly R[],
  start: Date,
): { pricePaise: number; rule: R } | null {
  const local = toLocalParts(start);
  const minute = local.hour * 60 + local.minute;
  let best: R | null = null;
  let bestWidth = Infinity;
  for (const r of rules) {
    if (!r.dow.includes(local.dow)) continue;
    const s = timeToMinutes(r.startTime);
    const e = timeToMinutes(r.endTime);
    if (minute < s || minute >= e) continue;
    const width = e - s;
    if (width < bestWidth || (width === bestWidth && best !== null && r.pricePaise > best.pricePaise)) {
      best = r;
      bestWidth = width;
    }
  }
  return best ? { pricePaise: best.pricePaise, rule: best } : null;
}

export function lowestPrice(rules: readonly PricingRuleLike[]): number | null {
  return rules.length ? Math.min(...rules.map((r) => r.pricePaise)) : null;
}

/** Returns a human-readable problem, or null when the rule is valid. */
export function validateRule(r: PricingRuleLike): string | null {
  if (!r.dow.length) return "Pick at least one day";
  if (r.dow.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return "Days must be 0–6";
  let s: number;
  let e: number;
  try {
    s = timeToMinutes(r.startTime);
    e = timeToMinutes(r.endTime);
  } catch {
    return "Times must look like 18:00";
  }
  if (e <= s) return "End time must be after start time";
  if (!Number.isInteger(r.pricePaise) || r.pricePaise <= 0) return "Price must be positive";
  return null;
}
