import { resolvePrice, type PricingRuleLike } from "./pricing";
import { fromLocal } from "./time";

export type SlotState = "available" | "held" | "booked" | "past" | "blocked";

export type Occupancy = {
  bookingId: string | null;
  startAt: Date;
  endAt: Date;
  status: "held" | "confirmed" | "cancelled";
  kind: "booking" | "block";
  holdExpiresAt: Date | null;
  isMine: boolean;
};

export type Slot = {
  hour: number;
  startAt: string;
  endAt: string;
  state: SlotState;
  pricePaise: number | null;
  isMine: boolean;
  bookingId: string | null;
  holdExpiresAt: string | null;
};

/** An occupancy row blocks its slot only while confirmed, or held and unexpired. */
export function isLive(o: Occupancy, now: Date): boolean {
  if (o.status === "confirmed") return true;
  return o.status === "held" && o.holdExpiresAt !== null && o.holdExpiresAt.getTime() > now.getTime();
}

export function buildSlots(input: {
  dateKey: string;
  openHour: number;
  closeHour: number;
  rules: readonly PricingRuleLike[];
  occupancy: readonly Occupancy[];
  now: Date;
}): Slot[] {
  const { dateKey, openHour, closeHour, rules, occupancy, now } = input;
  const slots: Slot[] = [];
  for (let hour = openHour; hour < closeHour; hour++) {
    const start = fromLocal(dateKey, hour);
    const end = fromLocal(dateKey, hour + 1);
    const price = resolvePrice(rules, start)?.pricePaise ?? null;
    const occ = occupancy.find(
      (o) => isLive(o, now) && o.startAt.getTime() < end.getTime() && o.endAt.getTime() > start.getTime(),
    );
    let state: SlotState;
    if (start.getTime() <= now.getTime()) state = "past";
    else if (occ?.kind === "block") state = "blocked";
    else if (occ?.status === "confirmed") state = "booked";
    else if (occ?.status === "held") state = "held";
    else if (price === null) state = "blocked";
    else state = "available";
    const live = state !== "past" && occ !== undefined;
    slots.push({
      hour,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      state,
      pricePaise: price,
      isMine: live && occ.isMine,
      bookingId: live && occ.isMine ? occ.bookingId : null,
      holdExpiresAt: live && occ.status === "held" && occ.holdExpiresAt ? occ.holdExpiresAt.toISOString() : null,
    });
  }
  return slots;
}

export const SLOT_STATE_LABEL: Record<SlotState, string> = {
  available: "Available",
  held: "On hold",
  booked: "Booked",
  past: "Kicked off",
  blocked: "Unavailable",
};
