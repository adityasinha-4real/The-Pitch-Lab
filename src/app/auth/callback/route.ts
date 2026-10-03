import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { startLocalSession, supabaseServer } from "@/server/auth";
import { consumeNonce, readToken, safeNext } from "@/server/auth/tokens";
import * as repo from "@/server/db/repo";

/** Lands magic links and OAuth redirects, then sends the player where they were going. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/signin?error=${reason}`, url.origin));

  if (env.mode === "local") {
    const payload = readToken<{ email: string; next: string }>("magic", url.searchParams.get("token"), env.authSecret);
    if (!payload) return fail("expired");
    if (!consumeNonce(payload.n, payload.exp)) return fail("used");
    await startLocalSession(payload.email, null);
    return NextResponse.redirect(new URL(safeNext(payload.next), url.origin));
  }

  const next = safeNext(url.searchParams.get("next"));
  const sb = await supabaseServer();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const { data, error } = code
    ? await sb.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await sb.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" })
      : { data: { user: null }, error: new Error("missing code") };
  if (error || !data.user?.email) return fail("expired");

  const name = (data.user.user_metadata?.full_name as string | undefined) ?? (data.user.user_metadata?.name as string | undefined) ?? null;
  await repo.ensureProfile({ id: data.user.id, email: data.user.email, name }, env.adminEmails.includes(data.user.email.toLowerCase()));
  return NextResponse.redirect(new URL(next, url.origin));
}
