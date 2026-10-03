import { migrateLocal, openPglite } from "@/server/db/pglite";
import { setSqlClient } from "@/server/db/client";
import type { SqlClient } from "@/server/db/sql";
import { addDays, fromLocal, localDateKey } from "@/domain/time";

export const IDS = {
  admin: "00000000-0000-4000-8000-000000000001",
  kabir: "00000000-0000-4000-8000-000000000002",
  meera: "00000000-0000-4000-8000-000000000003",
  rohan: "00000000-0000-4000-8000-000000000004",
  nutmegBox: "10000000-0000-4000-8000-000000000001",
  rabonaRidge: "10000000-0000-4000-8000-000000000002",
  panenkaYard: "10000000-0000-4000-8000-000000000003",
  kabirTomorrow7pm: "20000000-0000-4000-8000-000000000001",
} as const;

export const actor = (id: string) => ({ id });

/** Fresh in-memory Postgres with migrations + seed, installed as the app's SQL client. */
export async function freshDb(opts: { seed?: boolean } = {}): Promise<SqlClient> {
  const sql = await openPglite("memory");
  await migrateLocal(sql, { seed: opts.seed ?? true });
  setSqlClient(sql);
  return sql;
}

/** A start time `days` from today (arena time) at `hour`, e.g. tomorrow 10 AM. */
export function slotAt(days: number, hour: number): Date {
  return fromLocal(addDays(localDateKey(new Date()), days), hour);
}

/** Create an auth user (the profile trigger fires) and return its id. */
export async function createUser(sql: SqlClient, email: string): Promise<string> {
  const rows = await sql.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]);
  return rows[0]!.id;
}
