/** Minimal SQL surface shared by PGlite (local) and postgres.js (Supabase). */
export type Row = Record<string, unknown>;

export interface SqlRunner {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface SqlClient extends SqlRunner {
  transaction<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T>;
  exec(script: string): Promise<void>;
  close(): Promise<void>;
}

export type PgError = Error & { code?: string };
