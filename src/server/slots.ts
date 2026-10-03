import "server-only";
import { buildSlots, type Slot } from "@/domain/slots";
import { fromLocal } from "@/domain/time";
import type { Actor } from "./db/client";
import * as repo from "./db/repo";

type TurfWithRules = Awaited<ReturnType<typeof repo.getTurfById>> & object;

/** The slot grid for one turf on one local date, as seen by `actor`. */
export async function slotsFor(actor: Actor, turf: TurfWithRules, dateKey: string, now = new Date()): Promise<Slot[]> {
  const from = fromLocal(dateKey, turf.openHour);
  const to = fromLocal(dateKey, turf.closeHour);
  const occupancy = await repo.getOccupancy(actor, turf.id, from, to);
  return buildSlots({ dateKey, openHour: turf.openHour, closeHour: turf.closeHour, rules: turf.rules, occupancy, now });
}
