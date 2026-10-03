import postgres from "postgres";
import type { Row, SqlClient, SqlRunner } from "./sql";

/** postgres.js against Supabase's transaction pooler (port 6543): no prepared statements. */
export function openPostgres(url: string): SqlClient {
  const pg = postgres(url, { prepare: false, max: 5, idle_timeout: 20 });
  type Unsafe = { unsafe: (q: string, p?: never[]) => Promise<unknown> };
  const runner = (q: Unsafe): SqlRunner => ({
    async query<T extends Row>(text: string, params: unknown[] = []) {
      return (await q.unsafe(text, params as never[])) as T[];
    },
  });
  return {
    ...runner(pg),
    transaction: <T>(fn: (tx: SqlRunner) => Promise<T>) =>
      pg.begin((tx) => fn(runner(tx as unknown as Unsafe))) as Promise<T>,
    exec: async (script) => {
      await pg.unsafe(script);
    },
    close: () => pg.end(),
  };
}
