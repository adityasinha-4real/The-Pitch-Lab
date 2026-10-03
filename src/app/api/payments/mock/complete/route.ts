import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPaymentProvider } from "@/server/payments";
import { MockPaymentProvider } from "@/server/payments/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ orderId: z.string().regex(/^order_mock_[a-f0-9]+$/) });

/**
 * Plays Razorpay's servers for the mock gateway (DECISIONS D7): signs a
 * payment.captured event and delivers it to our webhook over HTTP. The
 * browser gets no say in whether the booking is confirmed.
 */
export async function POST(request: NextRequest) {
  const provider = getPaymentProvider();
  if (!(provider instanceof MockPaymentProvider)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const order = provider.getOrder(parsed.data.orderId);
  if (!order) return NextResponse.json({ error: "unknown_order" }, { status: 404 });

  const evt = provider.buildCapturedEvent(order);
  const res = await fetch(new URL("/api/webhooks/razorpay", request.nextUrl.origin), {
    method: "POST",
    headers: { "content-type": "application/json", "x-razorpay-signature": evt.signature, "x-razorpay-event-id": evt.eventId },
    body: evt.rawBody,
  });
  return NextResponse.json({ delivered: res.ok }, { status: res.ok ? 202 : 502 });
}
