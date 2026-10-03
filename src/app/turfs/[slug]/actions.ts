"use server";

import { z } from "zod";
import { fail, type ActionResult } from "@/domain/errors";
import { actorOf, getSessionUser } from "@/server/auth";
import { toFailure } from "@/server/actions";
import * as repo from "@/server/db/repo";
import { channels, publish } from "@/server/realtime/bus";
import { rateLimit } from "@/server/rate-limit";

const holdSchema = z.object({ turfId: z.uuid(), startAt: z.iso.datetime() });

/** Hold a slot for five minutes. The database decides who wins a race. */
export async function holdSlot(input: { turfId: string; startAt: string }): Promise<ActionResult<{ bookingId: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED");
  const parsed = holdSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  if (!rateLimit(`hold:${user.id}`, 20, 60_000)) return fail("RATE_LIMITED");
  try {
    const booking = await repo.createHold(actorOf(user), parsed.data.turfId, new Date(parsed.data.startAt));
    await publish(channels.turf(parsed.data.turfId));
    return { ok: true, bookingId: booking.id };
  } catch (err) {
    return toFailure(err);
  }
}
