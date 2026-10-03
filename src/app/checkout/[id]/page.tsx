import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { actorOf, requireUser } from "@/server/auth";
import * as repo from "@/server/db/repo";
import { CheckoutView } from "./checkout-view";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser(`/checkout/${id}`);
  const booking = await repo.getBooking(actorOf(user), id);
  if (!booking || booking.kind !== "booking") notFound();

  return (
    <CheckoutView
      booking={{
        id: booking.id,
        status: booking.status,
        amountPaise: booking.amountPaise,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
        refundPaise: booking.refundPaise,
        confirmedAt: booking.confirmedAt?.toISOString() ?? null,
        turf: { name: booking.turf.name, slug: booking.turf.slug, format: booking.turf.format },
        splitToken: booking.split?.token ?? null,
        openGame: booking.openGame,
      }}
    />
  );
}
