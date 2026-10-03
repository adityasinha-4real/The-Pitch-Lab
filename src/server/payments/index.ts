import "server-only";
import { env } from "../env";
import { MockPaymentProvider, RazorpayProvider, type PaymentProvider } from "./provider";

const g = globalThis as unknown as { __nutmegPayments?: PaymentProvider };

/** Razorpay when all three keys are present, otherwise the mock gateway. */
export function getPaymentProvider(): PaymentProvider {
  if (!g.__nutmegPayments) {
    const rz = env.razorpay;
    g.__nutmegPayments = rz.configured
      ? new RazorpayProvider(rz.keyId, rz.keySecret, rz.webhookSecret)
      : new MockPaymentProvider(env.authSecret);
  }
  return g.__nutmegPayments;
}

export type { PaymentProvider } from "./provider";
