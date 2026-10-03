import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { actorOf, getSessionUser } from "@/server/auth";
import * as repo from "@/server/db/repo";
import { slotsFor } from "@/server/slots";
import { formatDay, formatHour, localDateKey, toLocalParts } from "@/domain/time";
import { PitchLines } from "@/components/brand";
import { HeroCopy } from "@/components/home/hero";
import { TurfCard } from "@/components/turf-card";

export const dynamic = "force-dynamic";

const PEAK = { from: 18, to: 23 };

export default async function HomePage() {
  const now = new Date();
  const today = localDateKey(now);
  const user = await getSessionUser();
  const [turfs, games] = await Promise.all([repo.listTurfs(), repo.listOpenGames(actorOf(user))]);
  const tonight = await Promise.all(
    turfs.map(async (t) => {
      const slots = await slotsFor(null, t, today, now);
      return slots.filter((s) => s.hour >= PEAK.from && s.hour < PEAK.to && s.state === "available").length;
    }),
  );

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line">
        <div aria-hidden className="floodlights pitch-stripes absolute inset-0 -z-10" />
        <PitchLines className="-z-10" />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:items-end lg:pb-24 lg:pt-20">
          <HeroCopy />
          <Scoreboard
            rows={turfs.map((t, i) => ({ name: t.name, slug: t.slug, format: t.format, open: tonight[i]! }))}
            dateLabel={formatDay(now)}
          />
        </div>
      </section>

      <section aria-labelledby="turfs-title" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-fg">The grounds</p>
            <h2 id="turfs-title" className="mt-2 font-display text-5xl font-black uppercase leading-none sm:text-6xl">
              Three turfs
            </h2>
          </div>
          <Link href="/turfs" className="hidden min-h-11 items-center gap-1.5 font-semibold text-accent-fg hover:underline sm:inline-flex">
            Compare all <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {turfs.map((t, i) => (
            <TurfCard key={t.id} turf={t} openTonight={tonight[i]} />
          ))}
        </div>
      </section>

      <section aria-labelledby="how-title" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <h2 id="how-title" className="font-display text-5xl font-black uppercase leading-none sm:text-6xl">
          Kick-off in three
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["01", "Pick a slot", "Seven days ahead, hour by hour, priced live from the rate card. Taken slots update as they go."],
            ["02", "Hold it for 5:00", "The slot is yours while the clock runs. Nobody else can grab it, and if you walk away it frees itself."],
            ["03", "Pay, then split", "Pay once to lock it in, then send a link so everyone chips in their share."],
          ].map(([n, title, body]) => (
            <li key={n} className="relative overflow-hidden rounded-[var(--radius-card)] border border-line-strong bg-surface p-6">
              <span aria-hidden className="num font-display text-7xl font-black leading-none text-accent-fg">
                {n}
              </span>
              <h3 className="mt-4 font-display text-3xl font-extrabold uppercase">{title}</h3>
              <p className="mt-2 text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="games-title" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-fg">Short a few?</p>
            <h2 id="games-title" className="mt-2 font-display text-5xl font-black uppercase leading-none sm:text-6xl">
              Open games
            </h2>
          </div>
          <Link href="/games" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent-fg hover:underline">
            See the board <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {games.length ? (
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {games.slice(0, 3).map((g) => (
              <li key={g.id}>
                <Link
                  href="/games"
                  className="flex h-full items-center gap-5 rounded-[var(--radius-card)] border border-line-strong bg-surface p-5 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-accent-fg motion-reduce:hover:translate-y-0"
                >
                  <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-accent text-accent-ink">
                    <span className="num font-display text-5xl font-black leading-none">{g.playersNeeded - g.joined}</span>
                  </span>
                  <span>
                    <span className="block text-xs font-bold uppercase tracking-[0.14em] text-muted">
                      {g.playersNeeded - g.joined === 1 ? "player needed" : "players needed"}
                    </span>
                    <span className="mt-1 block font-display text-2xl font-extrabold uppercase leading-none">{g.turfName}</span>
                    <span className="mt-1 block text-sm text-muted">
                      {formatDay(g.startAt)} · {formatHour(toLocalParts(g.startAt).hour)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-muted">No open games right now. Book a slot and post one.</p>
        )}
      </section>
    </>
  );
}

function Scoreboard({ rows, dateLabel }: { rows: Array<{ name: string; slug: string; format: string; open: number }>; dateLabel: string }) {
  return (
    <aside
      aria-labelledby="scoreboard-title"
      className="relative overflow-hidden rounded-[1.75rem] border border-[#24352a] bg-[#0a110c] p-5 text-[#eef3ec] shadow-lift sm:p-6"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgb(198_255_61/0.14),transparent_70%)]" />
      <div className="relative flex items-center justify-between">
        <h2 id="scoreboard-title" className="font-display text-xl font-extrabold uppercase tracking-[0.12em] text-[#c6ff3d]">
          Tonight · 6–11 PM
        </h2>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9db0a2]">{dateLabel}</span>
      </div>
      <ul className="relative mt-5 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.slug}>
            <Link
              href={`/turfs/${r.slug}`}
              className="flex min-h-14 items-center justify-between gap-4 rounded-2xl bg-[#121c15] px-4 py-3 transition-colors hover:bg-[#1a271e]"
            >
              <span>
                <span className="block font-display text-2xl font-extrabold uppercase leading-none">{r.name}</span>
                <span className="text-xs uppercase tracking-[0.14em] text-[#9db0a2]">{r.format}</span>
              </span>
              <span className="flex items-baseline gap-2">
                <span className="sr-only">{r.open} slots open</span>
                <span
                  aria-hidden
                  className="num font-display text-5xl font-black leading-none text-[#c6ff3d] [text-shadow:0_0_18px_rgb(198_255_61/0.45)]"
                >
                  {String(r.open).padStart(2, "0")}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9db0a2]" aria-hidden>
                  open
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
