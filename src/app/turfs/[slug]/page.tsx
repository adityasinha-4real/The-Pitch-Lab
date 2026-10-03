import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { actorOf, getSessionUser } from "@/server/auth";
import * as repo from "@/server/db/repo";
import { slotsFor } from "@/server/slots";
import { bookingWindow, dateLabel, formatHour, isDateKey, relativeDayLabel } from "@/domain/time";
import { formatINR } from "@/domain/money";
import { minutesToTime, timeToMinutes } from "@/domain/pricing";
import { SlotPicker } from "@/components/booking/slot-picker";
import { TurfArt } from "@/components/turf-art";
import { Badge } from "@/components/ui/badge";
import { RefundPolicy } from "@/components/refund-policy";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ date?: string; hour?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const turf = await repo.getTurfBySlug((await params).slug);
  return turf ? { title: turf.name, description: turf.tagline, openGraph: { images: turf.images } } : {};
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayRange(dow: number[]) {
  const sorted = [...dow].sort();
  if (sorted.join() === "1,2,3,4,5") return "Mon–Fri";
  if (sorted.join() === "0,6") return "Sat–Sun";
  if (sorted.length === 7) return "Every day";
  return sorted.map((d) => DAYS[d]).join(", ");
}

const clock = (t: string) => formatHour(Math.floor(timeToMinutes(t) / 60)) + (timeToMinutes(t) % 60 ? `:${minutesToTime(timeToMinutes(t)).slice(3)}` : "");

export default async function TurfPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { date: rawDate, hour: rawHour } = await searchParams;
  const turf = await repo.getTurfBySlug(slug);
  if (!turf) notFound();

  const now = new Date();
  const dates = bookingWindow(now);
  const date = rawDate && isDateKey(rawDate) && dates.includes(rawDate) ? rawDate : dates[0]!;
  const user = await getSessionUser();
  const slots = await slotsFor(actorOf(user), turf, date, now);
  const dateLabels = Object.fromEntries(
    dates.map((d) => {
      const l = dateLabel(d);
      const rel = relativeDayLabel(d, now);
      return [d, `${rel ? `${rel}, ` : ""}${l.dow.slice(0, 1)}${l.dow.slice(1).toLowerCase()} ${Number(l.day)} ${l.month.slice(0, 1)}${l.month.slice(1).toLowerCase()}`];
    }),
  );
  const hour = rawHour !== undefined && /^\d{1,2}$/.test(rawHour) ? Number(rawHour) : null;
  const rules = [...turf.rules].sort((a, b) => a.pricePaise - b.pricePaise);

  return (
    <div className="pb-28 lg:pb-0">
      <section className="relative isolate overflow-hidden border-b border-line">
        <div aria-hidden className="floodlights absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.1fr_1fr] md:items-center md:py-14">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="solid">{turf.format === "5s" ? "5-a-side" : "7-a-side"}</Badge>
              <Badge tone="accent">
                Open {formatHour(turf.openHour)} – {formatHour(turf.closeHour)}
              </Badge>
            </div>
            <h1 className="mt-4 font-display text-6xl font-black uppercase leading-[0.85] sm:text-8xl">{turf.name}</h1>
            <p className="mt-4 max-w-lg text-lg text-muted">{turf.description}</p>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {[turf.surface, ...turf.amenities].map((a) => (
                <li key={a} className="flex items-center gap-1.5">
                  <Check className="size-4 text-accent-fg" aria-hidden /> {a}
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-[1.75rem] border border-line-strong shadow-lift">
            <TurfArt slug={turf.slug} title={`Aerial illustration of ${turf.name}`} className="aspect-[16/10]" />
          </div>
        </div>
      </section>

      <section aria-labelledby="book-title" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h2 id="book-title" className="sr-only">
          Book a slot
        </h2>
        <SlotPicker
          turf={{ id: turf.id, slug: turf.slug, name: turf.name, format: turf.format }}
          dates={dates}
          initialDate={date}
          initialSlots={slots}
          initialHour={hour}
          signedIn={Boolean(user)}
          dateLabels={dateLabels}
        />
      </section>

      <section aria-labelledby="rates-title" className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-line-strong bg-surface p-6 sm:p-8">
          <h2 id="rates-title" className="font-display text-3xl font-extrabold uppercase">Rate card</h2>
          <p className="mt-1 text-sm text-muted">Per hour. Peak runs 6 PM to 11 PM.</p>
          <table className="mt-5 w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th>Rate</th>
                <th>Days</th>
                <th>Hours</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-3 font-semibold">{r.label}</td>
                  <td className="py-3 text-muted">{dayRange(r.dow)}</td>
                  <td className="py-3 text-muted">
                    {clock(r.startTime)} – {clock(r.endTime)}
                  </td>
                  <td className="num py-3 text-right font-display text-xl font-extrabold">{formatINR(r.pricePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <RefundPolicy />
      </section>
    </div>
  );
}
