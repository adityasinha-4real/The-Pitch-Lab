import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { env } from "../env";
import * as repo from "../db/repo";
import { issueToken, readToken } from "./tokens";

export const SESSION_COOKIE = "pitchlab_session";
const SESSION_TTL = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
};

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}

/** The signed-in user for this request, or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (env.mode === "local") {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const payload = readToken<{ sub: string }>("session", token, env.authSecret);
    if (!payload) return null;
    const profile = await repo.getProfile(payload.sub);
    if (!profile?.email) return null;
    return { id: profile.id, email: profile.email, name: profile.fullName, role: profile.role };
  }

  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user?.email) return null;
  const name = (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined) ?? null;
  const profile =
    (await repo.getProfile(user.id)) ??
    (await repo.ensureProfile({ id: user.id, email: user.email, name }, env.adminEmails.includes(user.email.toLowerCase())));
  return { id: user.id, email: user.email, name: profile.fullName ?? name, role: profile.role };
});

/** Redirects to sign-in (and back afterwards) when nobody is signed in. */
export async function requireUser(next: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return user;
}

/** Admin pages 404 for everyone else, so their existence isn't advertised. */
export async function requireAdmin(next: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (user.role !== "admin") notFound();
  return user;
}

export const actorOf = (u: SessionUser | null) => (u ? { id: u.id, email: u.email } : null);

/** Local adapter: finish sign-in for an email (creates the user on first visit). */
export async function startLocalSession(email: string, name: string | null): Promise<void> {
  const user = await repo.upsertLocalAuthUser(email.toLowerCase(), name);
  await repo.ensureProfile(user, env.adminEmails.includes(user.email));
  const store = await cookies();
  store.set(SESSION_COOKIE, issueToken("session", { sub: user.id }, SESSION_TTL, env.authSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export async function endSession(): Promise<void> {
  if (env.mode === "local") {
    (await cookies()).delete(SESSION_COOKIE);
    return;
  }
  await (await supabaseServer()).auth.signOut();
}

export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${(await isHttps()) ? "https" : "http"}://${host}`;
}

async function isHttps(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]!.trim() === "https";
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
}
