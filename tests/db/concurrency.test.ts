import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHold } from "@/server/db/repo";
import { AppError } from "@/domain/errors";
import { IDS, actor, freshDb, slotAt } from "../helpers/db";

/**
 * Two players press "Hold" on the same slot at the same instant.
 * Exactly one may win; the EXCLUDE constraint (not app code) decides.
 */
describe("concurrency: two simultaneous holds on one slot", () => {
  beforeAll(async () => {
    await freshDb();
  });

  it("exactly 1 of 2 succeeds (PGlite, via the app's createHold)", async () => {
    const start = slotAt(1, 10);
    const results = await Promise.allSettled([
      createHold(actor(IDS.meera), IDS.nutmegBox, start),
      createHold(actor(IDS.rohan), IDS.nutmegBox, start),
    ]);

    const summary = results.map((r, i) => ({
      player: i === 0 ? "meera" : "rohan",
      outcome: r.status === "fulfilled" ? `HELD booking ${r.value.id}` : `REJECTED ${(r.reason as AppError).code}`,
      pgCode: r.status === "rejected" ? (r.reason as { pgCode?: string }).pgCode : undefined,
    }));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    console.log("\n[concurrency] 2 simultaneous holds on The Nutmeg Box, tomorrow 10 AM");
    console.table(summary);
    console.log(`[concurrency] RESULT: ${ok} of 2 holds succeeded\n`);

    expect(ok).toBe(1);
    const loser = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(loser.reason).toBeInstanceOf(AppError);
    expect(loser.reason.code).toBe("SLOT_TAKEN");
    expect(loser.reason.pgCode).toBe("23P01"); // exclusion_violation from the constraint itself
  });

  it("holds the line under a burst of 10", async () => {
    const start = slotAt(1, 11);
    const players = [IDS.kabir, IDS.meera, IDS.rohan, IDS.admin];
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => createHold(actor(players[i % players.length]!), IDS.nutmegBox, start)),
    );
    const live = await (await import("@/server/db/client")).asSystem((tx) =>
      tx.query(
        "select count(*)::int as n from public.bookings where turf_id = $1 and lower(slot) = $2 and status in ('held','confirmed')",
        [IDS.nutmegBox, start],
      ),
    );
    console.log(`[concurrency] burst of 10: ${results.filter((r) => r.status === "fulfilled").length} fulfilled (a player's new hold replaces their own earlier one), live rows on the slot = ${live[0]!.n}`);
    expect(live[0]!.n).toBe(1);
  });
});

/** Optional: true parallelism on two real Postgres connections (DECISIONS D14). */
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("concurrency on real Postgres (TEST_DATABASE_URL)", () => {
  const a = url ? postgres(url, { max: 1, prepare: false }) : null;
  const b = url ? postgres(url, { max: 1, prepare: false }) : null;
  afterAll(async () => {
    await a?.end();
    await b?.end();
  });

  it("exactly 1 of 2 succeeds across two connections", async () => {
    const start = slotAt(1, 12);
    const hold = (pg: postgres.Sql, uid: string) =>
      pg.begin(async (tx) => {
        await tx.unsafe(`select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true)`);
        await tx.unsafe("set local role authenticated");
        return tx.unsafe("select (public.create_hold($1, $2)).id", [IDS.nutmegBox, start.toISOString()]);
      });
    const results = await Promise.allSettled([hold(a!, IDS.meera), hold(b!, IDS.rohan)]);
    console.log(`[concurrency/pg] ${results.filter((r) => r.status === "fulfilled").length} of 2 succeeded`);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});
