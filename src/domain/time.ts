/**
 * Arena clock. Nutmeg Arena runs on Asia/Kolkata: UTC+05:30 all year (no DST),
 * so a fixed offset is exact. A "date key" is a local calendar date, YYYY-MM-DD.
 */
export const ARENA_TZ = "Asia/Kolkata";
const OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTH = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

export type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; dow: number };

export function toLocalParts(d: Date): LocalParts {
  const t = new Date(d.getTime() + OFFSET_MS);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    dow: t.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function localDateKey(d: Date): string {
  const p = toLocalParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function isDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** The instant at which `hour` (0–24) starts on local date `dateKey`. */
export function fromLocal(dateKey: string, hour: number): Date {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + hour * 3_600_000 - OFFSET_MS);
}

export function addDays(dateKey: string, n: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Today plus the following local dates (7 by default). */
export function bookingWindow(now: Date, days = 7): string[] {
  const today = localDateKey(now);
  return Array.from({ length: days }, (_, i) => addDays(today, i));
}

export function dowOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function dateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return { dow: DOW[d.getUTCDay()]!, day: pad(d.getUTCDate()), month: MONTH[d.getUTCMonth()]! };
}

/** 6 → "6 AM", 12 → "12 PM", 0 / 24 → "12 AM". */
export function formatHour(hour: number): string {
  const h = hour % 24;
  const suffix = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

export function formatSlotRange(start: Date, end: Date): string {
  return `${formatHour(toLocalParts(start).hour)} – ${formatHour(toLocalParts(end).hour)}`;
}

const title = (s: string) => s[0] + s.slice(1).toLowerCase();

/** "Sat 3 Oct" in arena time. */
export function formatDay(d: Date): string {
  const p = toLocalParts(d);
  return `${title(DOW[p.dow]!)} ${p.day} ${title(MONTH[p.month - 1]!)}`;
}

export function relativeDayLabel(dateKey: string, now: Date): string | null {
  const today = localDateKey(now);
  if (dateKey === today) return "Today";
  if (dateKey === addDays(today, 1)) return "Tomorrow";
  return null;
}
