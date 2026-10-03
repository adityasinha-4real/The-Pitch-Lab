import { beforeAll, describe, expect, it } from "vitest";
import type { SqlClient } from "@/server/db/sql";
import { IDS, freshDb, slotAt } from "../helpers/db";

let sql: SqlClient;
beforeAll(async () => {
  sql = await freshDb();
});

describe("migrations", () => {
  it("creates every table in the brief", async () => {
    const rows = await sql.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    );
    const names = rows.map((r) => r.table_name);
    for (const t of ["turfs", "pricing_rules", "bookings", "booking_shares", "open_games", "profiles"]) {
      expect(names).toContain(t);
    }
  });

  it("every public table has RLS", async () => {
    const rows = await sql.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const r of rows) expect(r.relrowsecurity, `${r.relname} has RLS`).toBe(true);
  });

  it("has the btree_gist exclusion constraint on (turf_id =, slot &&) for live statuses", async () => {
    const rows = await sql.query<{ def: string }>(
      "select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'bookings_no_overlap'",
    );
    expect(rows[0]?.def).toMatch(/EXCLUDE USING gist \(turf_id WITH =, slot WITH &&\)/);
    expect(rows[0]?.def).toMatch(/held/);
    expect(rows[0]?.def).toMatch(/confirmed/);
    const ext = await sql.query("select 1 from pg_extension where extname = 'btree_gist'");
    expect(ext).toHaveLength(1);
  });

  describe("exclusion constraint", () => {
    const insert = (status: string, start: Date, hours = 1) =>
      sql.query(
        `insert into public.bookings (turf_id, user_id, slot, status, amount_paise, hold_expires_at)
         values ($1, $2, tstzrange($3, $4, '[)'), $5::public.booking_status, 100, now() + interval '5 minutes')`,
        [IDS.panenkaYard, IDS.rohan, start, new Date(start.getTime() + hours * 3_600_000), status],
      );

    it("rejects an overlapping live booking with 23P01", async () => {
      await insert("confirmed", slotAt(6, 9));
      await expect(insert("held", slotAt(6, 9))).rejects.toMatchObject({ code: "23P01" });
      // Partial overlap counts too.
      await expect(insert("held", new Date(slotAt(6, 9).getTime() - 1_800_000))).rejects.toMatchObject({ code: "23P01" });
    });

    it("allows back-to-back slots ([) bounds)", async () => {
      await expect(insert("confirmed", slotAt(6, 10))).resolves.toBeDefined();
    });

    it("ignores cancelled rows", async () => {
      await insert("cancelled", slotAt(6, 11));
      await insert("cancelled", slotAt(6, 11));
      await expect(insert("held", slotAt(6, 11))).resolves.toBeDefined();
    });
  });
});
