import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { Row, SqlClient, SqlRunner } from "./sql";

const root = process.cwd();
const SHIM = path.join(root, "supabase/local/shim.sql");
const MIGRATIONS = path.join(root, "supabase/migrations");
const SEED = path.join(root, "supabase/seed.sql");

/** Open a PGlite database. `dir` of "memory" (or empty) gives an ephemeral DB. */
export async function openPglite(dir?: string): Promise<SqlClient> {
  const dataDir = !dir || dir === "memory" ? undefined : dir;
  const db = await PGlite.create({ dataDir, extensions: { btree_gist } });

  const runner = (q: Pick<PGlite, "query">): SqlRunner => ({
    async query<T extends Row>(text: string, params: unknown[] = []) {
      const res = await q.query<T>(text, params);
      return res.rows;
    },
  });

  return {
    ...runner(db),
    transaction: (fn) => db.transaction((tx) => fn(runner(tx))),
    exec: async (script) => {
      await db.exec(script);
    },
    close: () => db.close(),
  };
}

/** Apply the shim, every pending migration and (on a fresh DB) the seed. */
export async function migrateLocal(sql: SqlClient, opts: { seed: boolean }): Promise<{ applied: string[] }> {
  await sql.exec(`create schema if not exists local_meta;
    create table if not exists local_meta.migrations (name text primary key, applied_at timestamptz not null default now());`);
  const done = new Set(
    (await sql.query<{ name: string }>("select name from local_meta.migrations")).map((r) => r.name),
  );
  const fresh = done.size === 0;
  const applied: string[] = [];
  if (fresh) await sql.exec(await readFile(SHIM, "utf8"));
  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    await sql.exec(await readFile(path.join(MIGRATIONS, file), "utf8"));
    await sql.query("insert into local_meta.migrations (name) values ($1)", [file]);
    applied.push(file);
  }
  if (fresh && opts.seed) await sql.exec(await readFile(SEED, "utf8"));
  return { applied };
}
