"use server";

import { z } from "zod";
import { fail, type ActionResult } from "@/domain/errors";
import { formatDay } from "@/domain/time";
import { toFailure } from "@/server/actions";
import * as repo from "@/server/db/repo";
import { getPaymentProvider } from "@/server/payments";
import type { CheckoutConfig } from "@/server/payments/provider";
import { channels, publish } from "@/server/realtime/bus";
import { rateLimit } from "@/server/rate-limit";
import { headers } from "next/headers";

const schema = z.object({
  token: z.string().regex(/^[a-z0-9]{16,64}$/),
  seat: z.number().int().min(2).max(14),
  name: z.string().trim().min(1, "Enter your name").max(40),
});

/** A friend pays their seat. Anyone with the link may pay; the webhook marks it paid. */
export async function payShare(input: { token: string; seat: number; name: string }): Promise<ActionResult<{ config: CheckoutConfig }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`share:${ip}`, 12, 60_000)) return fail("RATE_LIMITED");
  const { token, seat, name } = parsed.data;
  try {
    const split = await repo.getSplit(null, token);
    if (!split) return fail("SHARE_NOT_FOUND");
    const amount = await repo.getShareAmount(token, seat);
    if (amount === null) return fail("SHARE_NOT_FOUND");
    const provider = getPaymentProvider();
    const order = await provider.createOrder({ amountPaise: amount, receipt: `${token.slice(0, 30)}-${seat}`, notes: { kind: "share", token, seat: String(seat) } });
    await repo.claimShare(token, seat, name, order.id);
    await publish(channels.split(token));
    const description = `${name}'s share · ${split.turfName} · ${formatDay(split.startAt)}`;
    return { ok: true, config: provider.checkoutConfig(order, { description, name }) };
  } catch (err) {
    return toFailure(err);
  }
}
