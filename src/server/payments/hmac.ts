import { createHmac, timingSafeEqual } from "node:crypto";

/** Razorpay webhook signature: hex HMAC-SHA256 of the raw request body. */
export function signPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/** Constant-time check of `X-Razorpay-Signature` against the raw body. */
export function verifySignature(rawBody: string, signature: string | null | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signPayload(rawBody, secret), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(expected, given);
}
