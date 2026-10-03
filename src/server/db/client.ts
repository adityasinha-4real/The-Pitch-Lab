import { mkdir } from "node:fs/promises";
import { AppError, isErrorCode } from "@/domain/errors";
import type { PgError, SqlClient, SqlRunner } from "./sql";

/**
 * Process-wide SQL client. Local mode boots PGlite, applies migrations and
 * seeds a fresh database; Supabase mode connects to DATABASE_URL.
 * Stored on globalThis so dev-server module reloads share one database.
 */
const g = globalThis as unknown as { __nutmegSql?: Promise<SqlClient>; __nutmegOnBoot?: Array<() => void> };

async function boot(): Promise<SqlClient> {
  const { env } = await import("../env");
  if (env.mode === "supabase") {
    const { openPostgres } = await import("./postgres");
    return openPostgres(env.databaseUrl);
  }
  const { openPglite, migrateLocal } = await import("./pglite");
  const dir = env.localDbDir;
  if (dir !== "memory") await mkdir(dir, { recursive: true });
  const sql = await openPglite(dir);
  await migrateLocal(sql, { seed: true });
  for (const fn of g.__nutmegOnBoot ?? []) fn();
  return sql;
}

export function getSql(): Promise<SqlClient> {
  g.__nutmegSql ??= boot().catch((err) => {
    g.__nutmegSql = undefined;
    throw err;
  });
  return g.__nutmegSql;
}

/** Tests inject their own client (a fresh PGlite per suite). */
export function setSqlClient(client: SqlClient | undefined) {
  g.__nutmegSql = client ? Promise.resolve(client) : undefined;
}

/** Run something once the local database has booted (e.g. the cleanup interval). */
export function onLocalBoot(fn: () => void) {
  (g.__nutmegOnBoot ??= []).push(fn);
}

export type Actor = { id: string; email?: string | null } | null;

/**
 * Run `fn` as an API user, the way PostgREST does: role `authenticated`
 * (or `anon`) with JWT claims, so RLS and auth.uid() apply (DECISIONS D2).
 */
export async function asUser<T>(actor: Actor, fn: (tx: SqlRunner) => Promise<T>): Promise<T> {
  const sql = await getSql();
  return wrap(() =>
    sql.transaction(async (tx) => {
      const claims = actor
        ? { sub: actor.id, role: "authenticated", email: actor.email ?? undefined }
        : { role: "anon" };
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      await tx.query(actor ? "set local role authenticated" : "set local role anon");
      return fn(tx);
    }),
  );
}

/** Trusted server paths: webhook, cleanup job, profile sync. RLS bypassed. */
export async function asService<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T> {
  const sql = await getSql();
  return wrap(() =>
    sql.transaction(async (tx) => {
      await tx.query("set local role service_role");
      return fn(tx);
    }),
  );
}

/** Connection owner. Only for local-mode auth (writes auth.users) and test hooks. */
export async function asSystem<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T> {
  const sql = await getSql();
  return wrap(() => sql.transaction(fn));
}

async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw toAppError(err);
  }
}

/** Map Postgres errors to app error codes. Our SQL functions raise the code as the message. */
export function toAppError(err: unknown): unknown {
  if (err instanceof AppError) return err;
  const e = err as PgError;
  if (e && typeof e === "object") {
    if (e.code === "23P01") return Object.assign(new AppError("SLOT_TAKEN"), { cause: err, pgCode: e.code });
    if (typeof e.message === "string" && isErrorCode(e.message)) {
      return Object.assign(new AppError(e.message), { cause: err, pgCode: e.code });
    }
    if (e.code === "42501") return Object.assign(new AppError("FORBIDDEN"), { cause: err, pgCode: e.code });
  }
  return err;
}
