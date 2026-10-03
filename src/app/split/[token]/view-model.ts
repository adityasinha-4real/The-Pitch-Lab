import type { Split } from "@/server/db/repo";

export type SplitView = Omit<Split, "startAt" | "endAt"> & { startAt: string; endAt: string; paidPaise: number; paidSeats: number };

export function toSplitView(s: Split): SplitView {
  return {
    ...s,
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
    paidPaise: s.seats.filter((x) => x.paid).reduce((sum, x) => sum + x.amountPaise, 0),
    paidSeats: s.seats.filter((x) => x.paid).length,
  };
}
