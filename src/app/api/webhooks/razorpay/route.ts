import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/server/payments";
import { handleWebhook } from "@/server/payments/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Razorpay → us. The signature is checked against the exact raw body. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  try {
    const outcome = await handleWebhook(
      getPaymentProvider(),
      raw,
      request.headers.get("x-razorpay-signature"),
      request.headers.get("x-razorpay-event-id"),
    );
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (err) {
    console.error("webhook failed", err);
    // Non-2xx makes the gateway retry later; confirm_payment is idempotent.
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
