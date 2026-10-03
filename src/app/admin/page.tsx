import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import * as repo from "@/server/db/repo";
import { slotsFor } from "@/server/slots";
import { addDays, bookingWindow, dateLabel, formatDay, formatSlotRange, fromLocal, isDateKey, localDateKey, toLocalParts } from "@/domain/time";
import { formatINR } from "@/domain/money";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Heatmap } from "./heatmap";
import { BlockBoard } from "./block-board";
import { PricingEditor } from "./pricing-editor";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "bookings", label: "Bookings" },
  { value: "slots", label: "Block slots" },
  { value: "pricing", label: "Pricing" },
] as const;
type Tab = (typeof TABS)[number]["value"];

type Search = { tab?: string; turf?: string; date?: string; status?: string };

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await requireAdmin("/admin");
  const actor = { id: user.id, email: user.email };
  const tab: Tab = (TABS.find((t) => t.value === sp.tab)?.value ?? "overview") as Tab;
  const turfs = await repo.listTurfs();
  const turf = turfs.find((t) => t.slug === sp.turf) ?? turfs[0]!;
  const now = new Date();
  const today = localDateKey(now);

  const href = (patch: Partial<Search>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin?${q.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-fg">Arena desk</p>
          <h1 className="mt-2 font-display text-6xl font-black uppercase leading-[0.85]">Control room</h1>
        </div>
        <nav aria-label="Admin sections" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line-strong bg-surface p-1">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={href({ tab: t.value })}
              aria-current={tab === t.value ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors",
                tab === t.value ? "bg-accent text-accent-ink" : "text-muted hover:text-text",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-8">
        {tab === "overview" && <Overview actor={actor} today={today} />}
        {tab === "bookings" && <BookingsTable actor={actor} turfs={turfs} sp={sp} />}
        {tab === "slots" && (
          <SlotsTab
            actor={actor}
            turfs={turfs}
            turf={turf}
            date={sp.date && isDateKey(sp.date) && bookingWindow(now).includes(sp.date) ? sp.date : today}
            dates={bookingWindow(now)}
            href={href}
          />
        )}
        {tab === "pricing" && (
          <div className="flex flex-col gap-6">
            {turfs.map((t) => (
              <PricingEditor key={t.id} turf={{ id: t.id, name: t.name }} rules={t.rules} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function Overview({ actor, today }: { actor: { id: string; email: string }; today: string }) {
  const weekFrom = fromLocal(today, 0);
  const weekTo = fromLocal(addDays(today, 7), 0);
  const heatFrom = fromLocal(addDays(today, -28), 0);
  const [stats, cells] = await Promise.all([repo.adminStats(actor, weekFrom, weekTo), repo.adminOccupancyHeatmap(actor, heatFrom, weekTo)]);
  const tiles = [
    ["Confirmed, next 7 days", String(stats.confirmed)],
    ["Revenue, next 7 days", formatINR(stats.revenuePaise)],
    ["Live holds", String(stats.liveHolds)],
    ["Blocked slots", String(stats.blocks)],
  ];
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-card)] border border-line-strong bg-surface p-5">
            <dt className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{label}</dt>
            <dd className="num mt-2 font-display text-5xl font-black leading-none">{value}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="heat-title" className="rounded-[var(--radius-card)] border border-line-strong bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="heat-title" className="font-display text-3xl font-extrabold uppercase">Occupancy heatmap</h2>
          <p className="text-sm text-muted">Share of turf-hours booked, last 4 weeks and next 7 days, all turfs</p>
        </div>
        <Heatmap cells={cells} />
      </section>
    </div>
  );
}

async function BookingsTable({ actor, turfs, sp }: { actor: { id: string; email: string }; turfs: Awaited<ReturnType<typeof repo.listTurfs>>; sp: Search }) {
  const turf = turfs.find((t) => t.slug === sp.turf);
  const status = (["held", "confirmed", "cancelled"] as const).find((s) => s === sp.status);
  const rows = await repo.adminListBookings(actor, { turfId: turf?.id, status, limit: 200 });
  return (
    <section aria-labelledby="bookings-title" className="rounded-[var(--radius-card)] border border-line-strong bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
        <h2 id="bookings-title" className="font-display text-3xl font-extrabold uppercase">Bookings</h2>
        <form method="get" action="/admin" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value="bookings" />
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Turf
            <select name="turf" defaultValue={sp.turf ?? ""} className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-sm normal-case tracking-normal text-text">
              <option value="">All turfs</option>
              {turfs.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Status
            <select name="status" defaultValue={sp.status ?? ""} className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-sm normal-case tracking-normal text-text">
              <option value="">Any status</option>
              <option value="confirmed">Confirmed</option>
              <option value="held">Held</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">
            Filter
          </button>
        </form>
      </div>
      <div className="overflow-x-auto border-t border-line-strong" tabIndex={0} role="region" aria-label="Bookings table, scrolls sideways">
        <table className="w-full min-w-[760px] text-sm" data-testid="admin-bookings">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted">
              <th scope="col" className="px-5 py-3 font-semibold">When</th>
              <th scope="col" className="px-5 py-3 font-semibold">Turf</th>
              <th scope="col" className="px-5 py-3 font-semibold">Player</th>
              <th scope="col" className="px-5 py-3 font-semibold">Status</th>
              <th scope="col" className="px-5 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="whitespace-nowrap px-5 py-3">
                  <span className="font-semibold">{formatDay(b.startAt)}</span> <span className="text-muted">{formatSlotRange(b.startAt, b.endAt)}</span>
                </td>
                <td className="px-5 py-3">{b.turfName}</td>
                <td className="px-5 py-3">
                  {b.kind === "block" ? <span className="text-muted">{b.note ?? "Blocked"}</span> : (b.playerName ?? b.email ?? "Deleted user")}
                </td>
                <td className="px-5 py-3">
                  {b.kind === "block" ? (
                    <Badge>Block</Badge>
                  ) : (
                    <Badge tone={b.status === "confirmed" ? "accent" : b.status === "held" ? "held" : "danger"}>{b.status}</Badge>
                  )}
                </td>
                <td className="num px-5 py-3 text-right">
                  {b.kind === "block" ? "—" : formatINR(b.amountPaise)}
                  {b.refundPaise !== null && <span className="block text-xs text-muted">refund {formatINR(b.refundPaise)}</span>}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted">
                  No bookings match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function SlotsTab({
  actor,
  turfs,
  turf,
  date,
  dates,
  href,
}: {
  actor: { id: string; email: string };
  turfs: Awaited<ReturnType<typeof repo.listTurfs>>;
  turf: Awaited<ReturnType<typeof repo.listTurfs>>[number];
  date: string;
  dates: string[];
  href: (p: Partial<Search>) => string;
}) {
  const [slots, blocks] = await Promise.all([
    slotsFor(actor, turf, date),
    repo.adminListBookings(actor, { turfId: turf.id, kind: "block", status: "confirmed", from: fromLocal(date, 0), to: fromLocal(date, 24) }),
  ]);
  const blockByHour = Object.fromEntries(
    blocks.map((b) => [String(toLocalParts(b.startAt).hour), { id: b.id, note: b.note ?? "Blocked" }]),
  );
  return (
    <section aria-labelledby="slots-title" className="rounded-[var(--radius-card)] border border-line-strong bg-surface p-5 sm:p-6">
      <h2 id="slots-title" className="font-display text-3xl font-extrabold uppercase">Block slots</h2>
      <p className="mt-1 text-sm text-muted">Take a slot off the board for maintenance, coaching or events. Booked slots can&apos;t be blocked.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {turfs.map((t) => (
          <Link
            key={t.id}
            href={href({ tab: "slots", turf: t.slug })}
            aria-current={t.id === turf.id ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
              t.id === turf.id ? "border-transparent bg-accent text-accent-ink" : "border-line-strong text-muted hover:text-text",
            )}
          >
            {t.name}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {dates.map((d) => {
          const l = dateLabel(d);
          return (
            <Link
              key={d}
              href={href({ tab: "slots", turf: turf.slug, date: d })}
              aria-current={d === date ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold",
                d === date ? "border-transparent bg-text text-bg" : "border-line-strong text-muted hover:text-text",
              )}
            >
              {l.dow} <span className="num">{Number(l.day)}</span>
            </Link>
          );
        })}
      </div>
      <BlockBoard turfId={turf.id} slots={slots} blocks={blockByHour} />
    </section>
  );
}
