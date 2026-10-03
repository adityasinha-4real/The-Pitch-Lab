import { beforeAll, describe, expect, it } from "vitest";
import * as repo from "@/server/db/repo";
import { asSystem } from "@/server/db/client";
import { handleWebhook } from "@/server/payments/webhook";
import { MockPaymentProvider } from "@/server/payments/provider";
import { signPayload } from "@/server/payments/hmac";
import { subscribe, channels } from "@/server/realtime/bus";
import { IDS, actor, freshDb, slotAt } from "../helpers/db";

const gateway = new MockPaymentProvider("webhook-test");

beforeAll(async () => {
  await freshDb();
});

async function heldWithOrder(userId: string, turfId: string, start: Date) {
  const hold = await repo.createHold(actor(userId), turfId, start);
  const order = await gateway.createOrder({ amountPaise: hold.amountPaise, receipt: hold.id, notes: { booking_id: hold.id } });
  await repo.attachOrder(hold.id, order.id);
  return { hold, order };
}

const deliver = (evt: { rawBody: string; signature: string; eventId: string }) =>
  handleWebhook(gateway, evt.rawBody, evt.signature, evt.eventId);

describe("webhook confirms bookings", () => {
  it("rejects a bad signature and leaves the booking held", async () => {
    const { hold, order } = await heldWithOrder(IDS.meera, IDS.nutmegBox, slotAt(2, 9));
    const evt = gateway.buildCapturedEvent(order);
    const forged = await handleWebhook(gateway, evt.rawBody, signPayload(evt.rawBody, "not-the-secret"), evt.eventId);
    expect(forged.status).toBe(401);
    const missing = await handleWebhook(gateway, evt.rawBody, null, evt.eventId);
    expect(missing.status).toBe(401);
    expect((await repo.getBookingStatus(actor(IDS.meera), hold.id))?.status).toBe("held");
  });

  it("confirms on a valid signature, pings the turf channel, and is idempotent", async () => {
    const { hold, order } = await heldWithOrder(IDS.rohan, IDS.nutmegBox, slotAt(2, 10));
    const pings: string[] = [];
    const off = subscribe(channels.turf(IDS.nutmegBox), (c) => pings.push(c));
    const evt = gateway.buildCapturedEvent(order);

    expect(await deliver(evt)).toEqual({ status: 200, body: { result: "confirmed" } });
    expect((await repo.getBookingStatus(actor(IDS.rohan), hold.id))?.status).toBe("confirmed");
    expect(pings).toHaveLength(1);

    // Same event redelivered: de-duplicated by event id.
    expect(await deliver(evt)).toEqual({ status: 200, body: { duplicate: true } });
    // Same payment under a different event (e.g. order.paid): confirm_payment is idempotent.
    expect((await deliver({ ...evt, eventId: "evt_other" })).body).toEqual({ result: "already" });
    off();

    const b = (await repo.getBooking(actor(IDS.rohan), hold.id))!;
    expect(b.confirmedAt).not.toBeNull();
    expect(b.holdExpiresAt).toBeNull();
    expect(b.rzpPaymentId).toMatch(/^pay_mock_/);
  });

  it("never confirms from the client: an authenticated user cannot call confirm_payment", async () => {
    const { hold, order } = await heldWithOrder(IDS.kabir, IDS.nutmegBox, slotAt(2, 11));
    await expect(
      (await import("@/server/db/client")).asUser(actor(IDS.kabir), (tx) =>
        tx.query("select public.confirm_payment($1, 'pay_fake', $2)", [order.id, hold.amountPaise]),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", pgCode: "42501" });
    expect((await repo.getBookingStatus(actor(IDS.kabir), hold.id))?.status).toBe("held");
  });

  it("refunds instead of confirming when the amount doesn't match", async () => {
    const { hold, order } = await heldWithOrder(IDS.meera, IDS.rabonaRidge, slotAt(3, 9));
    const evt = gateway.buildCapturedEvent({ ...order, amountPaise: order.amountPaise - 100 });
    expect((await deliver(evt)).body).toEqual({ result: "amount_mismatch_refunded" });
    expect((await repo.getBookingStatus(actor(IDS.meera), hold.id))?.status).toBe("held");
  });

  it("revives a hold that lapsed during payment if the slot is still free", async () => {
    const { hold, order } = await heldWithOrder(IDS.meera, IDS.rabonaRidge, slotAt(3, 10));
    await repo.testExpireHolds(hold.id);
    await repo.releaseExpiredHolds();
    expect((await deliver(gateway.buildCapturedEvent(order))).body).toEqual({ result: "confirmed" });
    expect((await repo.getBookingStatus(actor(IDS.meera), hold.id))?.status).toBe("confirmed");
  });

  it("refunds a late payment when someone else took the lapsed slot", async () => {
    const start = slotAt(3, 11);
    const { hold, order } = await heldWithOrder(IDS.meera, IDS.rabonaRidge, start);
    await repo.testExpireHolds(hold.id);
    await repo.createHold(actor(IDS.rohan), IDS.rabonaRidge, start);
    expect((await deliver(gateway.buildCapturedEvent(order))).body).toEqual({ result: "needs_refund" });
    const b = (await repo.getBooking(actor(IDS.meera), hold.id))!;
    expect(b.status).toBe("cancelled");
    const [row] = await asSystem((tx) => tx.query<{ r: string }>("select rzp_refund_id as r from public.bookings where id = $1", [hold.id]));
    expect(row!.r).toMatch(/^rfnd_mock_/);
  });

  it("ignores unrelated events and rejects malformed payloads", async () => {
    const other = JSON.stringify({ event: "payment.failed", payload: {} });
    expect((await handleWebhook(gateway, other, signPayload(other, gateway.webhookSecret), "e1")).body).toEqual({
      ignored: "payment.failed",
    });
    const junk = "not json";
    expect((await handleWebhook(gateway, junk, signPayload(junk, gateway.webhookSecret), "e2")).status).toBe(400);
  });
});
