import { beforeAll, describe, expect, it } from "vitest";
import type { SqlClient } from "@/server/db/sql";
import { freshDb } from "../helpers/db";

let sql: SqlClient;
beforeAll(async () => {
  sql = await freshDb();
});

describe("seed", () => {
  it("has 3 turfs in both formats", async () => {
    const rows = await sql.query<{ format: string }>("select format from public.turfs");
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.format))).toEqual(new Set(["5s", "7s"]));
  });

  it("prices weekday, weekend and peak 6–11 PM for every turf", async () => {
    const rows = await sql.query<{ turf_id: string; label: string; start_time: string; end_time: string }>(
      "select turf_id, label, start_time::text, end_time::text from public.pricing_rules",
    );
    const byTurf = Map.groupBy(rows, (r) => r.turf_id);
    expect(byTurf.size).toBe(3);
    for (const rules of byTurf.values()) {
      const labels = rules.map((r) => r.label);
      expect(labels).toEqual(expect.arrayContaining(["Weekday", "Weekend", "Weekday peak", "Weekend peak"]));
      for (const peak of rules.filter((r) => r.label.endsWith("peak"))) {
        expect([peak.start_time, peak.end_time]).toEqual(["18:00:00", "23:00:00"]);
      }
    }
  });

  it("has sample bookings in every state, a block, a split and open games", async () => {
    const rows = await sql.query<{ status: string; kind: string }>("select status, kind from public.bookings");
    const states = new Set(rows.map((r) => `${r.kind}:${r.status}`));
    expect(states).toEqual(new Set(["booking:confirmed", "booking:held", "booking:cancelled", "block:confirmed"]));
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect((await sql.query("select 1 from public.booking_shares")).length).toBe(5);
    expect((await sql.query("select 1 from public.open_games")).length).toBe(2);
  });

  it("seeds an admin", async () => {
    const rows = await sql.query<{ email: string }>("select email from public.profiles where role = 'admin'");
    expect(rows.map((r) => r.email)).toEqual(["admin@nutmeg.arena"]);
  });
});
