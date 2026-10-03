import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed tokens for the local auth adapter (DECISIONS D12):
 * session cookies and single-use magic links. Format: base64url(json).sig
 */
type Purpose = "session" | "magic";

function sign(purpose: Purpose, body: string, secret: string): string {
  return createHmac("sha256", secret).update(`${purpose}.${body}`).digest("base64url");
}

export function issueToken<T extends object>(purpose: Purpose, payload: T, ttlSeconds: number, secret: string): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds, n: randomBytes(8).toString("hex") }),
  ).toString("base64url");
  return `${body}.${sign(purpose, body, secret)}`;
}

export function readToken<T extends object>(
  purpose: Purpose,
  token: string | undefined | null,
  secret: string,
): (T & { exp: number; n: string }) | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(purpose, body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number; n: string };
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

const used = globalThis as unknown as { __nutmegUsedLinks?: Map<string, number> };

/** Magic links are single use: remember nonces until they would have expired anyway. */
export function consumeNonce(nonce: string, exp: number): boolean {
  used.__nutmegUsedLinks ??= new Map();
  const now = Date.now() / 1000;
  for (const [k, e] of used.__nutmegUsedLinks) if (e < now) used.__nutmegUsedLinks.delete(k);
  if (used.__nutmegUsedLinks.has(nonce)) return false;
  used.__nutmegUsedLinks.set(nonce, exp);
  return true;
}

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
