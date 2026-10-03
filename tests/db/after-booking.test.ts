import { beforeAll, describe, expect, it } from "vitest";
import * as repo from "@/server/db/repo";
import { asSystem } from "@/server/db/client";
import { handleWebhook } from "@/server/payments/webhook";
import { MockPaymentProvider } from "@/server/payments/provider";
import { IDS, actor, freshDb, slotAt } from "../helpers/db";

const gateway = new MockPaymentProvider("after-booking");

beforeAll(async () => {
  await freshDb();
});

async function confirmedBooking(userId: string, turfId: string, start: Date) {
  const hold = await repo.createHold(actor(userId), turfId, start);
  const order = await gateway.createOrder({ amountPaise: hold.amountPaise, receipt: hold.id, notes: {} });
  await repo.attachOrder(hold.id, order.id);
  const evt = gateway.buildCapturedEvent(order);
  await handleWebhook(gateway, evt.rawBody, evt.signature, evt.eventId);
  return hold;
}

/** Move a booking's kick-off to `hoursFromNow` (cancellation tiers are relative to now). */
async function moveKickoff(id: string, hoursFromNow: number) {
  await asSystem(async (tx) => {
    // Clear anything already sitting in the target hour so the move can't collide.
    await tx.query(
      `update public.bookings o set status = 'cancelled'
         from public.bookings b
        where b.id = $1 and o.id <> b.id and o.turf_id = b.turf_id and o.status in ('held', 'confirmed')
          and o.slot && tstzrange(date_trunc('hour', now()) + make_interval(hours => $2),
                                  date_trunc('hour', now()) + make_interval(hours => $2 + 1), '[)')`,
      [id, hoursFromNow],
    );
    await tx.query(
      `update public.bookings set slot = tstzrange(date_trunc('hour', now()) + make_interval(hours => $2),
                                                    date_trunc('hour', now()) + make_interval(hours => $2 + 1), '[)')
        where id = $1`,
      [id, hoursFromNow],
    );
  });
}

describe("cancel with refund policy", () => {
  it.each([
    [48, 100, 9],
    [12, 50, 10],
    [3, 0, 11],
  ])("kick-off in %ih refunds %i%%", async (hours, pct, hour) => {
    const b = await confirmedBooking(IDS.meera, IDS.panenkaYard, slotAt(5, hour));
    await moveKickoff(b.id, hours);
    const res = await repo.cancelBooking(actor(IDS.meera), b.id);
    expect(res.refund_percent).toBe(pct);
    expect(res.refund_paise).toBe(Math.floor((b.amountPaise * pct) / 100));
    expect((await repo.getBooking(actor(IDS.meera), b.id))?.status).toBe("cancelled");
  });

  it("only the owner can cancel, and only once", async () => {
    const b = await confirmedBooking(IDS.rohan, IDS.panenkaYard, slotAt(6, 9));
    await expect(repo.cancelBooking(actor(IDS.meera), b.id)).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND" });
    await repo.cancelBooking(actor(IDS.rohan), b.id);
    await expect(repo.cancelBooking(actor(IDS.rohan), b.id)).rejects.toMatchObject({ code: "NOT_CANCELLABLE" });
  });
});

describe("split pay", () => {
  it("splits into seats that sum to the total, organiser seat pre-paid", async () => {
    const b = await confirmedBooking(IDS.kabir, IDS.rabonaRidge, slotAt(4, 10));
    const token = await repo.createSplit(actor(IDS.kabir), b.id, 3, "Kabir");
    const split = (await repo.getSplit(null, token))!;
    expect(split.seats).toHaveLength(3);
    expect(split.seats.reduce((s, x) => s + x.amountPaise, 0)).toBe(b.amountPaise);
    expect(split.seats[0]).toMatchObject({ seat: 1, payerName: "Kabir", paid: true });
    expect(split.seats.slice(1).every((s) => !s.paid && s.amountPaise === Math.floor(b.amountPaise / 3))).toBe(true);
    await expect(repo.createSplit(actor(IDS.kabir), b.id, 3, "Kabir")).rejects.toMatchObject({ code: "SPLIT_EXISTS" });
  });

  it("a friend claims a seat and the webhook marks it paid", async () => {
    const b = await confirmedBooking(IDS.kabir, IDS.rabonaRidge, slotAt(4, 11));
    const token = await repo.createSplit(actor(IDS.kabir), b.id, 4, "Kabir");
    const amount = (await repo.getShareAmount(token, 2))!;
    const order = await gateway.createOrder({ amountPaise: amount, receipt: `${token}:2`, notes: {} });
    await repo.claimShare(token, 2, "Aarav", order.id);
    expect((await repo.getSplit(null, token))!.seats[1]).toMatchObject({ payerName: "Aarav", paid: false, pending: true });
    // Another payer can't grab a seat that's mid-payment.
    await expect(repo.claimShare(token, 2, "Zoya", "order_other")).rejects.toMatchObject({ code: "SEAT_PENDING" });

    const evt = gateway.buildCapturedEvent(order);
    expect((await handleWebhook(gateway, evt.rawBody, evt.signature, evt.eventId)).body).toEqual({ result: "share_paid" });
    const split = (await repo.getSplit(null, token))!;
    expect(split.seats[1]).toMatchObject({ paid: true });
    await expect(repo.claimShare(token, 2, "Aarav", "order_again")).rejects.toMatchObject({ code: "SEAT_PAID" });
  });

  it("only the organiser can split", async () => {
    const b = await confirmedBooking(IDS.kabir, IDS.rabonaRidge, slotAt(4, 12));
    await expect(repo.createSplit(actor(IDS.meera), b.id, 3, "M")).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND" });
    await expect(repo.createSplit(actor(IDS.kabir), b.id, 1, "K")).rejects.toMatchObject({ code: "SEATS_INVALID" });
  });
});

describe("open games", () => {
  it("lists a game, lets others join until full", async () => {
    const b = await confirmedBooking(IDS.rohan, IDS.nutmegBox, slotAt(5, 9));
    const gameId = await repo.createOpenGame(actor(IDS.rohan), b.id, 2, "Casual");
    const board = await repo.listOpenGames(actor(IDS.meera));
    expect(board.find((g) => g.id === gameId)).toMatchObject({ playersNeeded: 2, joined: 0, organiserName: "Rohan" });

    await expect(repo.joinOpenGame(actor(IDS.rohan), gameId, "Rohan")).rejects.toMatchObject({ code: "OWN_GAME" });
    expect(await repo.joinOpenGame(actor(IDS.meera), gameId, "Meera")).toEqual({ joined: 1, playersNeeded: 2 });
    await expect(repo.joinOpenGame(actor(IDS.meera), gameId, "Meera")).rejects.toMatchObject({ code: "ALREADY_JOINED" });
    await repo.joinOpenGame(actor(IDS.kabir), gameId, "Kabir");
    await expect(repo.joinOpenGame(actor(IDS.admin), gameId, "Desk")).rejects.toMatchObject({ code: "GAME_FULL" });

    await repo.leaveOpenGame(actor(IDS.kabir), gameId);
    expect((await repo.listOpenGames(null)).find((g) => g.id === gameId)?.joined).toBe(1);
  });

  it("joining requires sign-in", async () => {
    const [g] = await repo.listOpenGames(null);
    await expect(repo.joinOpenGame(null, g!.id, "Anon")).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });
});

describe("admin", () => {
  it("blocks and unblocks a slot; blocks and bookings exclude each other", async () => {
    const start = slotAt(6, 7);
    const block = await repo.adminBlockSlot(actor(IDS.admin), IDS.nutmegBox, start, "Resurfacing");
    expect(block).toMatchObject({ kind: "block", status: "confirmed", amountPaise: 0 });
    await expect(repo.createHold(actor(IDS.meera), IDS.nutmegBox, start)).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    await repo.adminUnblock(actor(IDS.admin), block.id);
    await expect(repo.createHold(actor(IDS.meera), IDS.nutmegBox, start)).resolves.toMatchObject({ status: "held" });
    await expect(repo.adminBlockSlot(actor(IDS.admin), IDS.nutmegBox, start, "x")).rejects.toMatchObject({ code: "SLOT_TAKEN" });
  });

  it("reports occupancy by weekday and hour", async () => {
    const from = slotAt(-7, 0);
    const to = slotAt(7, 0);
    const cells = await repo.adminOccupancyHeatmap(actor(IDS.admin), from, to);
    expect(cells.length).toBe(7 * 18); // 06:00–24:00 across the week
    const total = cells.reduce((s, c) => s + c.booked, 0);
    expect(total).toBeGreaterThan(0);
    // Under RLS a player only counts their own bookings.
    const own = (await repo.adminOccupancyHeatmap(actor(IDS.meera), from, to)).reduce((s, x) => s + x.booked, 0);
    expect(own).toBeLessThan(total);
  });

  it("lists bookings with player emails", async () => {
    const rows = await repo.adminListBookings(actor(IDS.admin), { kind: "booking", status: "confirmed" });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.email === "kabir@nutmeg.arena")).toBe(true);
  });
});
