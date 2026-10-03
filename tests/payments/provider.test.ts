import { describe, expect, it, vi } from "vitest";
import { signPayload } from "@/server/payments/hmac";
import { MockPaymentProvider, RazorpayProvider, type PaymentProvider } from "@/server/payments/provider";

describe("MockPaymentProvider", () => {
  const mock = new MockPaymentProvider("seed");

  it("implements PaymentProvider", () => {
    const p: PaymentProvider = mock;
    expect(p.name).toBe("mock");
  });

  it("creates orders it can look up later", async () => {
    const order = await mock.createOrder({ amountPaise: 150000, receipt: "b1", notes: { kind: "booking" } });
    expect(order.id).toMatch(/^order_mock_/);
    expect(mock.getOrder(order.id)?.amountPaise).toBe(150000);
  });

  it("signs captured events with a real HMAC that it verifies", async () => {
    const order = await mock.createOrder({ amountPaise: 1000, receipt: "b2", notes: {} });
    const evt = mock.buildCapturedEvent(order);
    expect(evt.signature).toBe(signPayload(evt.rawBody, mock.webhookSecret));
    expect(mock.verifyWebhookSignature(evt.rawBody, evt.signature)).toBe(true);
    expect(mock.verifyWebhookSignature(evt.rawBody, signPayload(evt.rawBody, "attacker"))).toBe(false);
    const body = JSON.parse(evt.rawBody);
    expect(body.payload.payment.entity).toMatchObject({ order_id: order.id, amount: 1000, status: "captured" });
  });

  it("gives a mock checkout config", async () => {
    const order = await mock.createOrder({ amountPaise: 1000, receipt: "b3", notes: {} });
    expect(mock.checkoutConfig(order, { description: "x" })).toMatchObject({ provider: "mock", orderId: order.id });
  });
});

describe("RazorpayProvider", () => {
  it("creates orders through the REST API with basic auth", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "order_X", amount: 220000, receipt: "r" })));
    const rz = new RazorpayProvider("rzp_test_key", "secret", "whsec", fetchImpl as unknown as typeof fetch);
    const order = await rz.createOrder({ amountPaise: 220000, receipt: "r", notes: { booking_id: "b" } });
    expect(order).toMatchObject({ id: "order_X", amountPaise: 220000, currency: "INR" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from("rzp_test_key:secret").toString("base64")}`,
    );
    expect(JSON.parse(init.body as string)).toMatchObject({ amount: 220000, currency: "INR" });
  });

  it("verifies webhooks with the webhook secret, not the key secret", () => {
    const rz = new RazorpayProvider("k", "key_secret", "whsec");
    expect(rz.verifyWebhookSignature("{}", signPayload("{}", "whsec"))).toBe(true);
    expect(rz.verifyWebhookSignature("{}", signPayload("{}", "key_secret"))).toBe(false);
  });

  it("refunds a payment", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "rfnd_1" })));
    const rz = new RazorpayProvider("k", "s", "w", fetchImpl as unknown as typeof fetch);
    expect(await rz.refund("pay_1", 5000)).toEqual({ id: "rfnd_1" });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://api.razorpay.com/v1/payments/pay_1/refund");
  });

  it("surfaces gateway errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad", { status: 400 }));
    const rz = new RazorpayProvider("k", "s", "w", fetchImpl as unknown as typeof fetch);
    await expect(rz.createOrder({ amountPaise: 1, receipt: "r", notes: {} })).rejects.toThrow(/400/);
  });
});
