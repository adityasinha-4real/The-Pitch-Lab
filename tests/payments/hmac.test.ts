import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signPayload, verifySignature } from "@/server/payments/hmac";

const secret = "whsec_test_nutmeg";
const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });

describe("Razorpay webhook HMAC", () => {
  it("matches Razorpay's scheme: hex HMAC-SHA256 of the raw body", () => {
    expect(signPayload(body, secret)).toBe(createHmac("sha256", secret).update(body).digest("hex"));
  });

  it("accepts a valid signature", () => {
    expect(verifySignature(body, signPayload(body, secret), secret)).toBe(true);
  });

  it("accepts upper-case hex", () => {
    expect(verifySignature(body, signPayload(body, secret).toUpperCase(), secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = signPayload(body, secret);
    expect(verifySignature(body.replace("pay_1", "pay_2"), sig, secret)).toBe(false);
    expect(verifySignature(`${body} `, sig, secret)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifySignature(body, signPayload(body, "other"), secret)).toBe(false);
  });

  it("rejects missing, malformed or truncated signatures without throwing", () => {
    const sig = signPayload(body, secret);
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, "", secret)).toBe(false);
    expect(verifySignature(body, "zz".repeat(32), secret)).toBe(false);
    expect(verifySignature(body, sig.slice(0, 62), secret)).toBe(false);
    expect(verifySignature(body, sig, "")).toBe(false);
  });
});
