import "server-only";
import { env } from "../env";
import { MockPaymentProvider, RazorpayProvider, type PaymentProvider } from "./provider";

const g = globalThis as unknown as { __pitchlabPayments?: PaymentProvider };

/** Razorpay when all three keys are present, otherwise the mock gateway. */
export function getPaymentProvider(): PaymentProvider {
  if (!g.__pitchlabPayments) {
    const rz = env.razorpay;
    g.__pitchlabPayments = rz.configured
      ? new RazorpayProvider(rz.keyId, rz.keySecret, rz.webhookSecret)
      : new MockPaymentProvider(env.authSecret);
  }
  return g.__pitchlabPayments;
}

export type { PaymentProvider } from "./provider";
