"use server";

import { z } from "zod";
import { env } from "@/server/env";
import { requestOrigin, supabaseServer } from "@/server/auth";
import { issueToken, safeNext } from "@/server/auth/tokens";
import { rateLimit } from "@/server/rate-limit";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string; localLink: string | null }
  | { status: "error"; message: string };

const schema = z.object({
  email: z.email("Enter a valid email address").max(254).transform((e) => e.trim().toLowerCase()),
  next: z.string().max(512).optional(),
});

export async function requestMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const parsed = schema.safeParse({ email: formData.get("email"), next: formData.get("next") ?? undefined });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter a valid email address" };
  const { email } = parsed.data;
  const next = safeNext(parsed.data.next, "/");
  // The e2e server signs the same admin in many times; the limiter stands down only there (DECISIONS D13).
  if (!env.testHooks && !rateLimit(`magic:${email}`, 5, 10 * 60_000)) {
    return { status: "error", message: "Too many links requested. Wait a few minutes and try again." };
  }
  const origin = await requestOrigin();

  if (env.mode === "local") {
    // No mail server in local mode: hand the signed link straight to the page (DECISIONS D12).
    const token = issueToken("magic", { email, next }, 10 * 60, env.authSecret);
    return { status: "sent", email, localLink: `/auth/callback?token=${encodeURIComponent(token)}` };
  }

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { status: "error", message: "We couldn't send the link. Try again in a minute." };
  return { status: "sent", email, localLink: null };
}
