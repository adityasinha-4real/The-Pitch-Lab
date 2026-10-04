import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { startLocalSession, supabaseServer } from "@/server/auth";
import { safeNext } from "@/server/auth/tokens";

const LOCAL_GOOGLE_IDENTITY = { email: "google.player@pitchlab.test", name: "Google Player" };

/** "Continue with Google". Supabase OAuth, or a demo Google identity in local mode (DECISIONS D12). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));

  if (env.mode === "local") {
    await startLocalSession(LOCAL_GOOGLE_IDENTITY.email, LOCAL_GOOGLE_IDENTITY.name);
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) return NextResponse.redirect(new URL("/signin?error=oauth", url.origin));
  return NextResponse.redirect(data.url);
}
