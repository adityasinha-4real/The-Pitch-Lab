import type { Metadata } from "next";
import { actorOf, requireUser } from "@/server/auth";
import * as repo from "@/server/db/repo";
import { PageHeader } from "@/components/page-header";
import { BookingsTabs, type BookingItem } from "./bookings-tabs";

export const metadata: Metadata = { title: "My bookings" };
export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const user = await requireUser("/bookings");
  const now = Date.now();
  const rows = await repo.listMyBookings(actorOf(user));
  const items: BookingItem[] = rows.map((b) => ({
    id: b.id,
    status: b.status,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    amountPaise: b.amountPaise,
    refundPaise: b.refundPaise,
    holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
    turf: { name: b.turf.name, slug: b.turf.slug, format: b.turf.format },
    split: b.split,
    openGame: b.openGame,
  }));

  const upcoming = items.filter((b) => b.status !== "cancelled" && Date.parse(b.startAt) > now).reverse();
  const past = items.filter((b) => b.status === "confirmed" && Date.parse(b.startAt) <= now);
  const cancelled = items.filter((b) => b.status === "cancelled");

  return (
    <>
      <PageHeader eyebrow={user.name ?? user.email} title="My bookings" description="Upcoming games, the ones you've played, and anything you called off." />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <BookingsTabs upcoming={upcoming} past={past} cancelled={cancelled} />
      </div>
    </>
  );
}
