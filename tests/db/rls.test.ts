import { beforeAll, describe, expect, it } from "vitest";
import * as repo from "@/server/db/repo";
import { asUser } from "@/server/db/client";
import { AppError } from "@/domain/errors";
import { IDS, actor, freshDb, slotAt } from "../helpers/db";

beforeAll(async () => {
  await freshDb();
});

const count = (who: string | null, sqlText: string, params: unknown[] = []) =>
  asUser(who ? actor(who) : null, async (tx) => (await tx.query(sqlText, params)).length);

describe("row level security", () => {
  it("a user cannot read another user's booking", async () => {
    // Kabir owns the seeded tomorrow-7pm booking.
    expect(await count(IDS.kabir, "select 1 from public.bookings where id = $1", [IDS.kabirTomorrow7pm])).toBe(1);
    expect(await count(IDS.meera, "select 1 from public.bookings where id = $1", [IDS.kabirTomorrow7pm])).toBe(0);
    expect(await repo.getBooking(actor(IDS.meera), IDS.kabirTomorrow7pm)).toBeNull();
  });

  it("anonymous visitors see no bookings, but do see the catalogue", async () => {
    expect(await count(null, "select 1 from public.bookings")).toBe(0);
    expect(await count(null, "select 1 from public.turfs")).toBe(3);
    expect(await count(null, "select 1 from public.pricing_rules")).toBe(12);
  });

  it("admins see every booking", async () => {
    const all = await count(IDS.admin, "select 1 from public.bookings");
    expect(all).toBeGreaterThan(await count(IDS.kabir, "select 1 from public.bookings"));
  });

  it("availability is public but anonymous", async () => {
    const occ = await repo.getOccupancy(null, IDS.nutmegBox, slotAt(1, 0), slotAt(2, 0));
    expect(occ.length).toBeGreaterThan(0);
    expect(occ.every((o) => o.bookingId === null && !o.isMine)).toBe(true);
    const mine = await repo.getOccupancy(actor(IDS.kabir), IDS.nutmegBox, slotAt(1, 0), slotAt(2, 0));
    expect(mine.some((o) => o.isMine && o.bookingId === IDS.kabirTomorrow7pm)).toBe(true);
  });

  it("users cannot write bookings directly", async () => {
    await expect(
      asUser(actor(IDS.meera), (tx) =>
        tx.query(
          `insert into public.bookings (turf_id, user_id, slot, status, amount_paise)
           values ($1, $2, tstzrange(now() + interval '3 days', now() + interval '3 days 1 hour'), 'confirmed', 1)`,
          [IDS.nutmegBox, IDS.meera],
        ),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", pgCode: "42501" });
    const updated = await asUser(actor(IDS.meera), (tx) =>
      tx.query("update public.bookings set status = 'cancelled' where id = $1 returning id", [IDS.kabirTomorrow7pm]),
    );
    expect(updated).toHaveLength(0);
  });

  it("users cannot call service-only functions (the client can never confirm)", async () => {
    await expect(
      asUser(actor(IDS.meera), (tx) => tx.query("select public.confirm_payment('order_seed_0001', 'pay_x', 1)")),
    ).rejects.toMatchObject({ code: "FORBIDDEN", pgCode: "42501" });
    await expect(
      asUser(actor(IDS.meera), (tx) => tx.query("select public.ensure_profile($1, 'x', 'x', true)", [IDS.meera])),
    ).rejects.toMatchObject({ code: "FORBIDDEN", pgCode: "42501" });
  });

  it("only admins can change pricing", async () => {
    const rule = { label: "Late", dow: [1], startTime: "23:00", endTime: "24:00", pricePaise: 50000 };
    await expect(repo.adminUpsertRule(actor(IDS.meera), IDS.nutmegBox, rule)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const created = await repo.adminUpsertRule(actor(IDS.admin), IDS.nutmegBox, rule);
    expect(created).toMatchObject({ label: "Late", dow: [1], startTime: "23:00", endTime: "24:00" });
    await expect(repo.adminDeleteRule(actor(IDS.meera), created.id)).rejects.toBeInstanceOf(AppError);
    await repo.adminDeleteRule(actor(IDS.admin), created.id);
  });

  it("only admins can block slots", async () => {
    await expect(repo.adminBlockSlot(actor(IDS.meera), IDS.nutmegBox, slotAt(5, 9), "x")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
