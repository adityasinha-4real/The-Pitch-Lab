import { beforeAll, describe, expect, it } from "vitest";
import * as repo from "@/server/db/repo";
import { asSystem } from "@/server/db/client";
import type { SqlClient } from "@/server/db/sql";
import { resolvePrice } from "@/domain/pricing";
import { refundPercent } from "@/domain/refund";
import { IDS, actor, createUser, freshDb, slotAt } from "../helpers/db";

let sql: SqlClient;
beforeAll(async () => {
  sql = await freshDb();
});

describe("holds", () => {
  it("creates a 5-minute hold priced from the rules", async () => {
    const start = slotAt(2, 9);
    const before = Date.now();
    const hold = await repo.createHold(actor(IDS.meera), IDS.rabonaRidge, start);
    expect(hold.status).toBe("held");
    expect(hold.startAt.toISOString()).toBe(start.toISOString());
    const ttl = hold.holdExpiresAt!.getTime() - before;
    expect(ttl).toBeGreaterThan(4.9 * 60_000);
    expect(ttl).toBeLessThanOrEqual(5 * 60_000 + 2_000);
    const turf = (await repo.getTurfById(IDS.rabonaRidge))!;
    expect(hold.amountPaise).toBe(resolvePrice(turf.rules, start)!.pricePaise);
  });

  it("rejects past, closed and off-the-hour slots", async () => {
    await expect(repo.createHold(actor(IDS.meera), IDS.nutmegBox, slotAt(-1, 10))).rejects.toMatchObject({ code: "SLOT_PAST" });
    await expect(repo.createHold(actor(IDS.meera), IDS.panenkaYard, slotAt(1, 23))).rejects.toMatchObject({ code: "SLOT_CLOSED" });
    await expect(
      repo.createHold(actor(IDS.meera), IDS.nutmegBox, new Date(slotAt(1, 10).getTime() + 1_800_000)),
    ).rejects.toMatchObject({ code: "SLOT_INVALID" });
    await expect(repo.createHold(actor(IDS.meera), IDS.nutmegBox, slotAt(9, 10))).rejects.toMatchObject({ code: "SLOT_TOO_FAR" });
    await expect(repo.createHold(null, IDS.nutmegBox, slotAt(1, 10))).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("keeps one live hold per player", async () => {
    const a = await repo.createHold(actor(IDS.kabir), IDS.panenkaYard, slotAt(2, 9));
    const b = await repo.createHold(actor(IDS.kabir), IDS.panenkaYard, slotAt(2, 10));
    expect((await repo.getBookingStatus(actor(IDS.kabir), a.id))?.status).toBe("cancelled");
    expect((await repo.getBookingStatus(actor(IDS.kabir), b.id))?.status).toBe("held");
  });

  it("treats an expired hold as free on read and lets someone else take it", async () => {
    const start = slotAt(3, 9);
    const hold = await repo.createHold(actor(IDS.rohan), IDS.nutmegBox, start);
    await expect(repo.createHold(actor(IDS.meera), IDS.nutmegBox, start)).rejects.toMatchObject({ code: "SLOT_TAKEN" });

    await repo.testExpireHolds(hold.id);
    const occ = await repo.getOccupancy(null, IDS.nutmegBox, start, new Date(start.getTime() + 3_600_000));
    expect(occ).toHaveLength(0); // expired = free on read

    const taken = await repo.createHold(actor(IDS.meera), IDS.nutmegBox, start);
    expect(taken.status).toBe("held");
    expect((await repo.getBookingStatus(actor(IDS.rohan), hold.id))?.status).toBe("cancelled");
  });

  it("cleanup job releases expired holds and reports the turfs", async () => {
    const uid = await createUser(sql, "cleanup@pitchlab.test");
    const hold = await repo.createHold(actor(uid), IDS.panenkaYard, slotAt(4, 9));
    await repo.testExpireHolds(hold.id);
    const turfs = await repo.releaseExpiredHolds();
    expect(turfs).toContain(IDS.panenkaYard);
    expect((await repo.getBookingStatus(actor(uid), hold.id))?.status).toBe("cancelled");
    expect(await repo.releaseExpiredHolds()).toEqual([]);
  });

  it("lets a player release their own hold", async () => {
    const hold = await repo.createHold(actor(IDS.rohan), IDS.rabonaRidge, slotAt(4, 9));
    await expect(repo.releaseHold(actor(IDS.meera), hold.id)).rejects.toMatchObject({ code: "HOLD_NOT_FOUND" });
    expect(await repo.releaseHold(actor(IDS.rohan), hold.id)).toBe(IDS.rabonaRidge);
  });
});

describe("SQL and TypeScript rules agree", () => {
  it("slot_price() matches resolvePrice() for every hour of the next week", async () => {
    const turfs = await repo.listTurfs();
    for (const turf of turfs) {
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const start = slotAt(day, hour);
          const [row] = await asSystem((tx) => tx.query<{ p: number | null }>("select public.slot_price($1, $2) as p", [turf.id, start]));
          expect(row!.p, `${turf.slug} d${day} h${hour}`).toBe(resolvePrice(turf.rules, start)?.pricePaise ?? null);
        }
      }
    }
  });

  it("refund_percent() matches refundPercent() around the boundaries", async () => {
    const kickoff = new Date("2026-10-10T13:30:00Z");
    const offsets = [48, 24.001, 24, 23.999, 12, 6.001, 6, 5.999, 1, 0].map((h) => h * 3_600_000);
    for (const ms of offsets) {
      const at = new Date(kickoff.getTime() - ms);
      const [row] = await asSystem((tx) => tx.query<{ p: number }>("select public.refund_percent($1, $2) as p", [kickoff, at]));
      expect(row!.p, `${ms / 3_600_000}h`).toBe(refundPercent(kickoff, at));
    }
  });
});
