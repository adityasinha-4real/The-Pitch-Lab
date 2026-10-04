import { createHmac, randomBytes } from "node:crypto";
import { signPayload, verifySignature } from "./hmac";

export type Order = {
  id: string;
  amountPaise: number;
  currency: "INR";
  receipt: string;
  notes: Record<string, string>;
};

export type CheckoutConfig =
  | {
      provider: "razorpay";
      keyId: string;
      orderId: string;
      amountPaise: number;
      currency: "INR";
      name: string;
      description: string;
      prefill: { email?: string; name?: string };
    }
  | { provider: "mock"; orderId: string; amountPaise: number; name: string; description: string };

export interface PaymentProvider {
  readonly name: "razorpay" | "mock";
  createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<Order>;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  refund(paymentId: string, amountPaise: number): Promise<{ id: string }>;
  checkoutConfig(order: Order, ctx: { description: string; email?: string; name?: string }): CheckoutConfig;
}

const MERCHANT = "The Pitch Lab";

/** Razorpay over its REST API (test or live keys). */
export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay" as const;
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`https://api.razorpay.com/v1${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Razorpay ${path} failed with ${res.status}`);
    return (await res.json()) as T;
  }

  async createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<Order> {
    const o = await this.call<{ id: string; amount: number; receipt: string }>("/orders", {
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    });
    return { id: o.id, amountPaise: o.amount, currency: "INR", receipt: o.receipt, notes: input.notes };
  }

  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    return verifySignature(rawBody, signature, this.webhookSecret);
  }

  async refund(paymentId: string, amountPaise: number): Promise<{ id: string }> {
    const r = await this.call<{ id: string }>(`/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise });
    return { id: r.id };
  }

  checkoutConfig(order: Order, ctx: { description: string; email?: string; name?: string }): CheckoutConfig {
    return {
      provider: "razorpay",
      keyId: this.keyId,
      orderId: order.id,
      amountPaise: order.amountPaise,
      currency: "INR",
      name: MERCHANT,
      description: ctx.description,
      prefill: { email: ctx.email, name: ctx.name },
    };
  }
}

type MockOrder = Order & { createdAt: number };
const store = globalThis as unknown as { __pitchlabMockOrders?: Map<string, MockOrder> };

/**
 * Stand-in gateway when Razorpay keys are absent (DECISIONS D7). Keeps its own
 * order book and signs webhooks with a real HMAC, so the webhook path is the
 * same code that runs against Razorpay.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;
  readonly webhookSecret: string;

  constructor(secretSeed: string) {
    this.webhookSecret = createHmac("sha256", secretSeed).update("pitchlab-mock-webhook").digest("hex");
  }

  private get orders() {
    store.__pitchlabMockOrders ??= new Map();
    return store.__pitchlabMockOrders;
  }

  async createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<Order> {
    const order: MockOrder = {
      id: `order_mock_${randomBytes(9).toString("hex")}`,
      amountPaise: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
      createdAt: Date.now(),
    };
    this.orders.set(order.id, order);
    return order;
  }

  getOrder(id: string): Order | undefined {
    return this.orders.get(id);
  }

  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    return verifySignature(rawBody, signature, this.webhookSecret);
  }

  async refund(_paymentId: string, _amountPaise: number): Promise<{ id: string }> {
    return { id: `rfnd_mock_${randomBytes(9).toString("hex")}` };
  }

  checkoutConfig(order: Order, ctx: { description: string }): CheckoutConfig {
    return { provider: "mock", orderId: order.id, amountPaise: order.amountPaise, name: MERCHANT, description: ctx.description };
  }

  /** What Razorpay's servers would POST after a successful capture. */
  buildCapturedEvent(order: Order): { rawBody: string; signature: string; eventId: string } {
    const paymentId = `pay_mock_${randomBytes(9).toString("hex")}`;
    const eventId = `evt_mock_${randomBytes(9).toString("hex")}`;
    const rawBody = JSON.stringify({
      entity: "event",
      event: "payment.captured",
      created_at: Math.floor(Date.now() / 1000),
      payload: {
        payment: {
          entity: {
            id: paymentId,
            entity: "payment",
            amount: order.amountPaise,
            currency: "INR",
            status: "captured",
            order_id: order.id,
            method: "upi",
          },
        },
      },
    });
    return { rawBody, signature: signPayload(rawBody, this.webhookSecret), eventId };
  }
}
