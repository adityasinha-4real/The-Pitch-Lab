"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Clock, Lock } from "lucide-react";
import { toast } from "sonner";
import { holdSlot } from "@/app/turfs/[slug]/actions";
import { useLiveChannels } from "@/hooks/use-live-channels";
import { formatINR } from "@/domain/money";
import { SLOT_STATE_LABEL, type Slot } from "@/domain/slots";
import { formatHour } from "@/domain/time";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DateStrip } from "./date-strip";

type TurfLite = { id: string; slug: string; name: string; format: string };

const isSelectable = (s: Slot) => s.state === "available" || (s.state === "held" && s.isMine);

export function SlotPicker({
  turf,
  dates,
  initialDate,
  initialSlots,
  initialHour,
  signedIn,
  dateLabels,
}: {
  turf: TurfLite;
  dates: string[];
  initialDate: string;
  initialSlots: Slot[];
  initialHour: number | null;
  signedIn: boolean;
  dateLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [loading, setLoading] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(() => {
    const s = initialSlots.find((x) => x.hour === initialHour);
    return s && isSelectable(s) ? s.hour : (initialSlots.find((x) => x.isMine && x.state === "held")?.hour ?? null);
  });
  const [focusIndex, setFocusIndex] = useState(() => Math.max(0, initialSlots.findIndex(isSelectable)));
  const [holding, startHolding] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (d: string, opts: { quiet?: boolean } = {}) => {
      const id = ++requestId.current;
      if (!opts.quiet) setLoading(true);
      try {
        const res = await fetch(`/api/turfs/${turf.id}/slots?date=${d}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { slots: Slot[] };
        if (id !== requestId.current) return;
        setSlots(data.slots);
        setSelectedHour((h) => {
          const s = data.slots.find((x) => x.hour === h);
          return s && isSelectable(s) ? h : null;
        });
      } catch {
        if (!opts.quiet) toast.error("Couldn't load slots. Check your connection.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [turf.id],
  );

  const refresh = useCallback(() => void load(date, { quiet: true }), [load, date]);
  useLiveChannels([`turf:${turf.id}`], refresh);

  // Holds expire on the clock, not on an event: refetch when the next one lapses, and roll "past" every minute.
  useEffect(() => {
    const now = Date.now();
    const next = slots
      .map((s) => (s.holdExpiresAt ? Date.parse(s.holdExpiresAt) : Infinity))
      .reduce((a, b) => Math.min(a, b), Infinity);
    const wait = Math.min(Number.isFinite(next) ? next - now + 400 : Infinity, 60_000);
    const t = window.setTimeout(refresh, Math.max(wait, 1_000));
    return () => window.clearTimeout(t);
  }, [slots, refresh]);

  const changeDate = (d: string) => {
    if (d === date) return;
    setDate(d);
    setSelectedHour(null);
    setFocusIndex(0);
    window.history.replaceState(null, "", `/turfs/${turf.slug}?date=${d}`);
    void load(d);
  };

  const selected = useMemo(() => slots.find((s) => s.hour === selectedHour) ?? null, [slots, selectedHour]);
  const openCount = slots.filter((s) => s.state === "available").length;

  const select = (s: Slot, index: number) => {
    setFocusIndex(index);
    if (!isSelectable(s)) return;
    setSelectedHour((h) => (h === s.hour ? null : s.hour));
  };

  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const grid = gridRef.current;
    if (!grid || !slots.length) return;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
    const last = slots.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: cols,
      ArrowUp: -cols,
    };
    let next = focusIndex;
    if (e.key in moves) next = Math.min(last, Math.max(0, focusIndex + moves[e.key]!));
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const s = slots[focusIndex];
      if (s) select(s, focusIndex);
      return;
    } else return;
    e.preventDefault();
    setFocusIndex(next);
    grid.querySelectorAll<HTMLButtonElement>("[data-slot]")[next]?.focus();
  };

  const hold = () => {
    if (!selected) return;
    if (selected.isMine && selected.bookingId) {
      router.push(`/checkout/${selected.bookingId}`);
      return;
    }
    startHolding(async () => {
      const res = await holdSlot({ turfId: turf.id, startAt: selected.startAt });
      if (res.ok) {
        router.push(`/checkout/${res.bookingId}`);
      } else {
        toast.error(res.message);
        if (res.error === "AUTH_REQUIRED") router.push(signInHref);
        void load(date, { quiet: true });
      }
    });
  };

  const signInHref = `/signin?next=${encodeURIComponent(`/turfs/${turf.slug}?date=${date}${selected ? `&hour=${selected.hour}` : ""}`)}`;

  const action = selected ? (
    signedIn ? (
      <Button size="lg" onClick={hold} disabled={holding} className="w-full" data-testid="hold-button">
        {selected.isMine ? (
          <>
            Continue to checkout <ArrowRight />
          </>
        ) : holding ? (
          "Holding…"
        ) : (
          <>
            <Lock /> Hold for 5:00
          </>
        )}
      </Button>
    ) : (
      <Button asChild size="lg" className="w-full">
        <Link href={signInHref}>Sign in to book</Link>
      </Button>
    )
  ) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <DateStrip dates={dates} value={date} onChange={changeDate} labels={dateLabels} />

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl font-extrabold uppercase leading-none">
            {dateLabels[date]}
            <span className="ml-3 align-middle text-sm font-sans font-semibold normal-case tracking-normal text-muted" aria-live="polite">
              {loading ? "Loading slots…" : `${openCount} open`}
            </span>
          </h2>
          <Legend />
        </div>

        <div className="relative mt-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6" data-testid="slot-skeleton">
              {Array.from({ length: Math.max(slots.length, 12) }, (_, i) => (
                <Skeleton key={i} className="h-[76px] rounded-2xl" />
              ))}
            </div>
          ) : (
            <div
              ref={gridRef}
              role="radiogroup"
              aria-label={`Slots at ${turf.name} on ${dateLabels[date]}. Use arrow keys to move, Enter to choose.`}
              onKeyDown={onGridKeyDown}
              className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6"
              data-testid="slot-grid"
            >
              {slots.map((s, i) => (
                <SlotCell
                  key={`${date}-${s.hour}`}
                  slot={s}
                  index={i}
                  selected={s.hour === selectedHour}
                  focusable={i === focusIndex}
                  onSelect={() => select(s, i)}
                  onFocus={() => setFocusIndex(i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop summary */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-[1.5rem] border border-line-strong bg-surface p-6 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Your slot</p>
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div key={`${date}-${selected.hour}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <p className="mt-3 font-display text-5xl font-black uppercase leading-none">
                  {formatHour(selected.hour)}
                  <span className="text-muted"> – {formatHour(selected.hour + 1)}</span>
                </p>
                <p className="mt-2 text-sm text-muted">
                  {dateLabels[date]} · {turf.name} · {turf.format}
                </p>
                <div className="my-5 flex items-baseline justify-between border-y border-line-strong py-4">
                  <span className="text-sm text-muted">60 minutes</span>
                  <span className="num font-display text-4xl font-extrabold">{formatINR(selected.pricePaise ?? 0)}</span>
                </div>
                {action}
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                  <Clock className="size-3.5" aria-hidden /> We hold it for 5 minutes while you pay.
                </p>
              </motion.div>
            ) : (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 text-muted">
                Pick a green slot to see the price and hold it for five minutes.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* Mobile sticky booking bar */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden"
            data-testid="mobile-booking-bar"
          >
            <div className="mx-auto flex max-w-xl items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl font-black uppercase leading-none">{formatHour(selected.hour)}</p>
                <p className="truncate text-xs text-muted">
                  {dateLabels[date]} · <span className="num font-semibold text-text">{formatINR(selected.pricePaise ?? 0)}</span>
                </p>
              </div>
              <div className="w-48 shrink-0">{action}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SlotCell({
  slot,
  index,
  selected,
  focusable,
  onSelect,
  onFocus,
}: {
  slot: Slot;
  index: number;
  selected: boolean;
  focusable: boolean;
  onSelect: () => void;
  onFocus: () => void;
}) {
  const selectable = isSelectable(slot);
  const label =
    slot.state === "held" && slot.isMine ? "Your hold" : slot.state === "available" && slot.pricePaise ? formatINR(slot.pricePaise) : SLOT_STATE_LABEL[slot.state];
  const aria = `${formatHour(slot.hour)} to ${formatHour(slot.hour + 1)}, ${label}${slot.state === "available" ? "" : selectable ? "" : ", not bookable"}`;

  return (
    <motion.button
      type="button"
      role="radio"
      data-slot
      data-state={slot.state}
      data-mine={slot.isMine || undefined}
      data-testid={`slot-${slot.hour}`}
      aria-checked={selected}
      aria-disabled={!selectable}
      aria-label={aria}
      tabIndex={focusable ? 0 : -1}
      onClick={onSelect}
      onFocus={onFocus}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.018, 0.35), duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      whileHover={selectable ? { y: -2 } : undefined}
      className={cn(
        "relative isolate flex min-h-[76px] flex-col items-start justify-between overflow-hidden rounded-2xl border px-3 py-2.5 text-left",
        "transition-[border-color,box-shadow,color] duration-200",
        slot.state === "available" && "border-line-strong bg-surface hover:border-accent-fg hover:shadow-card",
        slot.state === "held" && !slot.isMine && "hatch cursor-not-allowed border-transparent bg-held-soft text-held",
        slot.state === "held" && slot.isMine && "border-accent-fg bg-accent-soft",
        slot.state === "booked" && "net cursor-not-allowed border-transparent bg-surface-2 text-muted",
        slot.state === "blocked" && "hatch cursor-not-allowed border-dashed border-line-strong bg-transparent text-muted",
        slot.state === "past" && "cursor-not-allowed border-transparent bg-transparent text-muted",
        selected && "border-transparent text-accent-ink",
      )}
    >
      {selected && (
        <motion.span
          layoutId="slot-selection"
          className="absolute inset-0 -z-10 rounded-2xl bg-accent"
          transition={{ type: "spring", stiffness: 520, damping: 38 }}
        />
      )}
      <span className={cn("font-display text-[1.65rem] font-extrabold uppercase leading-none", slot.state === "past" && "line-through decoration-1")}>
        {formatHour(slot.hour)}
      </span>
      <span className={cn("num text-xs font-semibold", !selected && slot.state === "available" && "text-muted")}>{label}</span>
    </motion.button>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    ["bg-surface border border-line-strong", "Open"],
    ["bg-accent", "Selected"],
    ["hatch bg-held-soft text-held", "On hold"],
    ["net bg-surface-2", "Booked"],
    ["hatch border border-dashed border-line-strong text-muted", "Unavailable"],
  ];
  return (
    <ul id="slot-legend" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Legend">
      {items.map(([cls, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-3.5 rounded-[5px]", cls)} />
          {label}
        </li>
      ))}
    </ul>
  );
}
