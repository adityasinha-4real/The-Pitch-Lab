import { z } from "zod";
import { AppError } from "@/domain/errors";
import * as repo from "../db/repo";
import { channels, publish } from "../realtime/bus";
import type { PaymentProvider } from "./provider";

const eventSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z
      .object({
        entity: z.object({
          id: z.string().min(1),
          order_id: z.string().min(1),
          amount: z.number().int().positive(),
          status: z.string().optional(),
        }),
      })
      .optional(),
  }),
});

export type WebhookOutcome = { status: number; body: Record<string, unknown> };

const HANDLED = new Set(["payment.captured", "order.paid"]);

/**
 * The only code path that confirms a booking (DECISIONS D7). Verifies the
 * HMAC over the raw body, de-duplicates by event id, then calls
 * confirm_payment(), which is itself idempotent.
 */
export async function handleWebhook(
  provider: PaymentProvider,
  rawBody: string,
  signature: string | null,
  eventIdHeader: string | null,
): Promise<WebhookOutcome> {
  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    return { status: 401, body: { error: "invalid_signature" } };
  }

  let parsed: z.infer<typeof eventSchema>;
  try {
    parsed = eventSchema.parse(JSON.parse(rawBody));
  } catch {
    return { status: 400, body: { error: "invalid_payload" } };
  }

  const payment = parsed.payload.payment?.entity;
  if (!HANDLED.has(parsed.event) || !payment) {
    return { status: 200, body: { ignored: parsed.event } };
  }

  const eventId = eventIdHeader || `${parsed.event}:${payment.id}`;
  const fresh = await repo.recordPaymentEvent(eventId, parsed.event, payment.order_id, parsed);
  if (!fresh) return { status: 200, body: { duplicate: true } };

  let result: repo.ConfirmResult;
  try {
    result = await repo.confirmPayment(payment.order_id, payment.id, payment.amount);
  } catch (err) {
    if (err instanceof AppError && err.code === "AMOUNT_MISMATCH") {
      // Permanent failure: acknowledge so the gateway stops retrying, and return the money.
      await provider.refund(payment.id, payment.amount);
      console.error("webhook: amount mismatch, refunded", { order: payment.order_id });
      return { status: 200, body: { result: "amount_mismatch_refunded" } };
    }
    throw err;
  }

  switch (result.result) {
    case "confirmed":
    case "already":
      if (result.turf_id) await publish(channels.turf(result.turf_id));
      await publish(channels.booking(result.booking_id));
      break;
    case "share_paid":
      await publish(channels.split(result.token));
      break;
    case "needs_refund": {
      // The hold lapsed and someone else took the slot before payment landed.
      const refund = await provider.refund(payment.id, result.amount_paise);
      await repo.setRefundId(result.booking_id, refund.id);
      await publish(channels.booking(result.booking_id));
      break;
    }
    case "unknown_order":
      await provider.refund(payment.id, payment.amount);
      console.error("webhook: payment for unknown order, refunded", { order: payment.order_id });
      break;
  }
  return { status: 200, body: { result: result.result } };
}
