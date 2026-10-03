"use client";

import { useCallback, useState, useTransition } from "react";
import { motion } from "motion/react";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/domain/money";
import { formatDay, formatSlotRange } from "@/domain/time";
import { useLiveChannels } from "@/hooks/use-live-channels";
import { PitchLines } from "@/components/brand";
import { usePaymentFlow } from "@/components/payments/use-payment-flow";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { payShare } from "./actions";
import type { SplitView } from "./view-model";

export function SplitPanel({ initial }: { initial: SplitView }) {
  const [split, setSplit] = useState(initial);
  const [seat, setSeat] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [waiting, setWaiting] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const { pay, element } = usePaymentFlow();

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/split/${initial.token}`, { cache: "no-store" });
    if (!res.ok) return;
    const next = (await res.json()) as SplitView;
    setSplit(next);
    setWaiting((w) => (w !== null && next.seats.find((s) => s.seat === w)?.paid ? null : w));
  }, [initial.token]);

  useLiveChannels([`split:${initial.token}`], refresh);

  const pct = Math.round((split.paidPaise / split.totalPaise) * 100);
  const start_ = new Date(split.startAt);
  const end = new Date(split.endAt);
  const closed = split.status !== "confirmed" || start_.getTime() <= Date.now();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (seat === null) return;
    start(async () => {
      const res = await payShare({ token: split.token, seat, name });
      if (!res.ok) {
        toast.error(res.message);
        void refresh();
        return;
      }
      const chosen = seat;
      setSeat(null);
      const outcome = await pay(res.config);
      if (outcome === "submitted") {
        setWaiting(chosen);
        toast.success("Payment sent. Your seat turns green once it clears.");
        void refresh();
      } else if (outcome === "failed") toast.error("Payment declined. Try again.");
    });
  };

  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="floodlights pitch-stripes absolute inset-0 -z-10" />
      <PitchLines className="-z-10 opacity-60" />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-fg">Split the cost</p>
        <h1 className="mt-3 font-display text-6xl font-black uppercase leading-[0.85] sm:text-7xl">{split.turfName}</h1>
        <p className="mt-3 text-muted">
          {formatDay(start_)} · {formatSlotRange(start_, end)} · {split.format}
        </p>

        <section aria-labelledby="progress-title" className="mt-10 rounded-[1.75rem] border border-line-strong bg-surface p-6 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="progress-title" className="font-display text-2xl font-extrabold uppercase">Collected</h2>
            <p className="num font-display text-4xl font-black leading-none">
              {formatINR(split.paidPaise)} <span className="text-xl text-muted">/ {formatINR(split.totalPaise)}</span>
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="Split payment progress"
            aria-valuemin={0}
            aria-valuemax={split.totalPaise}
            aria-valuenow={split.paidPaise}
            aria-valuetext={`${split.paidSeats} of ${split.seats.length} shares paid, ${pct}%`}
            className="relative mt-4 h-4 overflow-hidden rounded-full bg-surface-2"
            data-testid="split-progress"
            data-paid-seats={split.paidSeats}
          >
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
            <div aria-hidden className="pointer-events-none absolute inset-0 flex">
              {split.seats.slice(1).map((s) => (
                <span key={s.seat} className="h-full flex-1 border-r border-[var(--surface)] last:border-0" />
              ))}
            </div>
          </div>
          <p className="mt-2 text-sm text-muted" aria-live="polite">
            <span className="num">{split.paidSeats}</span> of <span className="num">{split.seats.length}</span> shares paid
          </p>
        </section>

        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {split.seats.map((s) => {
            const mineWaiting = waiting === s.seat && !s.paid;
            return (
              <li
                key={s.seat}
                className={cn(
                  "flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-4 py-3",
                  s.paid ? "border-transparent bg-accent-soft" : "border-line-strong bg-surface",
                )}
                data-testid={`seat-${s.seat}`}
                data-paid={s.paid}
              >
                <div className="flex items-center gap-3">
                  <span className={cn("grid size-9 place-items-center rounded-xl font-display text-lg font-black", s.paid ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted")}>
                    {s.paid ? <Check className="size-4" aria-hidden /> : s.seat}
                  </span>
                  <span>
                    <span className="block font-semibold">{s.payerName ?? `Seat ${s.seat}`}</span>
                    <span className="num text-xs text-muted">
                      {formatINR(s.amountPaise)} · {s.paid ? "Paid" : s.pending || mineWaiting ? "Payment in progress" : "Open"}
                    </span>
                  </span>
                </div>
                {!s.paid && !closed && !(s.pending || mineWaiting) && s.seat > 1 && (
                  <Button size="sm" onClick={() => setSeat(s.seat)} data-testid={`pay-seat-${s.seat}`}>
                    Pay share
                  </Button>
                )}
                {(s.pending || mineWaiting) && <Clock className="size-4 text-held" aria-hidden />}
              </li>
            );
          })}
        </ul>
        {closed && <p className="mt-6 text-sm text-muted">This split is closed: the game has kicked off or the booking was cancelled.</p>}
      </div>

      <Dialog open={seat !== null} onOpenChange={(o) => !o && setSeat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay your share</DialogTitle>
            <DialogDescription>
              Seat {seat} · {seat !== null ? formatINR(split.seats.find((s) => s.seat === seat)?.amountPaise ?? 0) : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Label htmlFor="payer-name">Your name</Label>
            <Input id="payer-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="given-name" />
            <Button type="submit" size="lg" disabled={pending || !name.trim()} className="mt-2" data-testid="share-continue">
              {pending ? "Starting…" : "Continue to payment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {element}
    </div>
  );
}
