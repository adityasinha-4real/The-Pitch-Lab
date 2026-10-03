"use server";

import { z } from "zod";
import { fail, type ActionResult } from "@/domain/errors";
import { formatDay, formatSlotRange } from "@/domain/time";
import { actorOf, getSessionUser } from "@/server/auth";
import { toFailure } from "@/server/actions";
import * as repo from "@/server/db/repo";
import { getPaymentProvider } from "@/server/payments";
import type { CheckoutConfig } from "@/server/payments/provider";
import { channels, publish } from "@/server/realtime/bus";
import { rateLimit } from "@/server/rate-limit";

const id = z.uuid();

/** Create a gateway order for a live hold. Does not confirm anything: only the webhook does. */
export async function startCheckout(bookingId: string): Promise<ActionResult<{ config: CheckoutConfig }>> {
  const user = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED");
  if (!id.safeParse(bookingId).success) return fail("INVALID_INPUT");
  if (!rateLimit(`checkout:${user.id}`, 10, 60_000)) return fail("RATE_LIMITED");
  try {
    const booking = await repo.getBooking(actorOf(user), bookingId);
    if (!booking || booking.kind !== "booking") return fail("BOOKING_NOT_FOUND");
    if (booking.status !== "held" || !booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) return fail("HOLD_EXPIRED");

    const provider = getPaymentProvider();
    const order = await provider.createOrder({
      amountPaise: booking.amountPaise,
      receipt: booking.id,
      notes: { kind: "booking", booking_id: booking.id },
    });
    await repo.attachOrder(booking.id, order.id);
    const description = `${booking.turf.name} · ${formatDay(booking.startAt)} · ${formatSlotRange(booking.startAt, booking.endAt)}`;
    return { ok: true, config: provider.checkoutConfig(order, { description, email: user.email, name: user.name ?? undefined }) };
  } catch (err) {
    return toFailure(err);
  }
}

export async function releaseHoldAction(bookingId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED");
  if (!id.safeParse(bookingId).success) return fail("INVALID_INPUT");
  try {
    const turfId = await repo.releaseHold(actorOf(user), bookingId);
    await publish(channels.turf(turfId));
    return { ok: true };
  } catch (err) {
    return toFailure(err);
  }
}
