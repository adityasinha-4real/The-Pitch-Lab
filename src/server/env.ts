import "server-only";
import { randomBytes } from "node:crypto";

/** Runtime configuration. Mode is decided per process from the environment (DECISIONS D1). */
export type DataMode = "supabase" | "local";

const g = globalThis as unknown as { __nutmegAuthSecret?: string };

function bootSecret(): string {
  g.__nutmegAuthSecret ??= randomBytes(32).toString("hex");
  return g.__nutmegAuthSecret;
}

export const env = {
  get mode(): DataMode {
    return process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.DATABASE_URL
      ? "supabase"
      : "local";
  },
  get supabaseUrl() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  },
  get supabaseAnonKey() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  },
  get supabaseServiceKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  },
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "";
  },
  get localDbDir() {
    return process.env.LOCAL_DB_DIR || ".data/pglite";
  },
  get authSecret() {
    return process.env.AUTH_SECRET || bootSecret();
  },
  get adminEmails(): string[] {
    return (process.env.ADMIN_EMAILS ?? "admin@nutmeg.arena")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  get testHooks() {
    return process.env.NUTMEG_TEST_HOOKS === "1";
  },
  get razorpay() {
    const keyId = process.env.RAZORPAY_KEY_ID ?? "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
    return { keyId, keySecret, webhookSecret, configured: Boolean(keyId && keySecret && webhookSecret) };
  },
};
