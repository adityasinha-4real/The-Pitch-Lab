"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/domain/errors";
import { actorOf, getSessionUser } from "@/server/auth";
import { toFailure } from "@/server/actions";
import * as repo from "@/server/db/repo";
import { getPaymentProvider } from "@/server/payments";
import { channels, publish } from "@/server/realtime/bus";

const id = z.uuid();

export async function cancelBookingAction(
  bookingId: string,
): Promise<ActionResult<{ refundPaise: number; refundPercent: number }>> {
  const user = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED");
  if (!id.safeParse(bookingId).success) return fail("INVALID_INPUT");
  try {
    const res = await repo.cancelBooking(actorOf(user), bookingId);
    if (res.refund_paise > 0 && res.rzp_payment_id) {
      try {
        const refund = await getPaymentProvider().refund(res.rzp_payment_id, res.refund_paise);
        await repo.setRefundId(res.booking_id, refund.id);
      } catch (err) {
        // The cancellation stands; the refund is retried from the admin side with the recorded amount.
        console.error("refund call failed", { booking: res.booking_id, err });
      }
    }
    await publish(channels.turf(res.turf_id));
    await publish(channels.games);
    revalidatePath("/bookings");
    return { ok: true, refundPaise: res.refund_paise, refundPercent: res.refund_percent };
  } catch (err) {
    return toFailure(err);
  }
}

const splitSchema = z.object({ bookingId: z.uuid(), seats: z.number().int().min(2).max(14) });

export async function createSplitAction(input: { bookingId: string; seats: number }): Promise<ActionResult<{ token: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED");
  const parsed = splitSchema.safeParse(input);
  if (!parsed.success) return fail("SEATS_INVALID");
  try {
    const organiser = user.name?.split(" ")[0] ?? user.email.split("@")[0]!;
    const token = await repo.createSplit(actorOf(user), parsed.data.bookingId, parsed.data.seats, organiser);
    revalidatePath("/bookings");
    return { ok: true, token };
  } catch (err) {
    return toFailure(err);
  }
}

const gameSchema = z.object({
  bookingId: z.uuid(),
  playersNeeded: z.number().int().min(1).max(13),
  note: z.string().trim().max(140),
});

export async function createOpenGameAction(input: { bookingId: string; playersNeeded: number; note: string }): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED");
  const parsed = gameSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  try {
    await repo.createOpenGame(actorOf(user), parsed.data.bookingId, parsed.data.playersNeeded, parsed.data.note);
    await publish(channels.games);
    revalidatePath("/bookings");
    revalidatePath("/games");
    return { ok: true };
  } catch (err) {
    return toFailure(err);
  }
}
