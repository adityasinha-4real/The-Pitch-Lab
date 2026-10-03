"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarX2 } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/domain/money";
import { REFUND_TIERS, refundFor } from "@/domain/refund";
import { dateLabel, formatSlotRange, localDateKey } from "@/domain/time";
import { OpenGameDialog, SplitDialog } from "@/components/booking/post-booking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { cancelBookingAction } from "./actions";

export type BookingItem = {
  id: string;
  status: "held" | "confirmed" | "cancelled";
  startAt: string;
  endAt: string;
  amountPaise: number;
  refundPaise: number | null;
  holdExpiresAt: string | null;
  turf: { name: string; slug: string; format: string };
  split: { token: string; seats: number; paidSeats: number; paidPaise: number } | null;
  openGame: { id: string; playersNeeded: number; joined: number; note: string } | null;
};

export function BookingsTabs({ upcoming, past, cancelled }: { upcoming: BookingItem[]; past: BookingItem[]; cancelled: BookingItem[] }) {
  return (
    <Tabs defaultValue="upcoming">
      <TabsList aria-label="Booking lists">
        <TabsTrigger value="upcoming">
          Upcoming <span className="num opacity-80">{upcoming.length}</span>
        </TabsTrigger>
        <TabsTrigger value="past">
          Played <span className="num opacity-80">{past.length}</span>
        </TabsTrigger>
        <TabsTrigger value="cancelled">
          Cancelled <span className="num opacity-80">{cancelled.length}</span>
        </TabsTrigger>
      </TabsList>
      {(
        [
          ["upcoming", upcoming, "Nothing booked yet. The pitch is waiting."],
          ["past", past, "No games played yet."],
          ["cancelled", cancelled, "Nothing cancelled. Good attendance."],
        ] as const
      ).map(([value, list, empty]) => (
        <TabsContent key={value} value={value}>
          {list.length ? (
            <ul className="flex flex-col gap-3">
              {list.map((b) => (
                <BookingRow key={b.id} b={b} />
              ))}
            </ul>
          ) : (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-10 text-center">
              <p className="text-muted">{empty}</p>
              {value === "upcoming" && (
                <Button asChild className="mt-4">
                  <Link href="/turfs">
                    Find a slot <ArrowRight />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function BookingRow({ b }: { b: BookingItem }) {
  const start = new Date(b.startAt);
  const end = new Date(b.endAt);
  const d = dateLabel(localDateKey(start));
  const upcoming = b.status !== "cancelled" && start.getTime() > Date.now();

  return (
    <li
      className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line-strong bg-surface p-4 sm:flex-row sm:items-center sm:p-5"
      data-testid="booking-row"
      data-status={b.status}
    >
      <div className={cn("grid w-20 shrink-0 place-items-center rounded-2xl py-2", upcoming ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted")}>
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em]">{d.dow}</span>
        <span className="num font-display text-4xl font-black leading-none">{d.day}</span>
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em]">{d.month}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-2xl font-extrabold uppercase leading-none">{b.turf.name}</h3>
          {b.status === "held" && <Badge tone="held">On hold</Badge>}
          {b.status === "confirmed" && upcoming && <Badge tone="accent">Confirmed</Badge>}
          {b.status === "cancelled" && <Badge tone="danger">Cancelled</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {formatSlotRange(start, end)} · {b.turf.format} · <span className="num">{formatINR(b.amountPaise)}</span>
          {b.status === "cancelled" && b.refundPaise !== null && (
            <>
              {" "}
              · refunded <span className="num font-semibold text-text">{formatINR(b.refundPaise)}</span>
            </>
          )}
        </p>
        {b.split && (
          <div className="mt-3 max-w-sm">
            <div className="flex justify-between text-xs text-muted">
              <span>
                Split: <span className="num">{b.split.paidSeats}</span>/<span className="num">{b.split.seats}</span> paid
              </span>
              <span className="num">
                {formatINR(b.split.paidPaise)} of {formatINR(b.amountPaise)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(b.split.paidPaise / b.amountPaise) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
      {upcoming && (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {b.status === "held" ? (
            <Button asChild>
              <Link href={`/checkout/${b.id}`}>
                Pay now <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <SplitDialog bookingId={b.id} amountPaise={b.amountPaise} existingToken={b.split?.token} />
              <OpenGameDialog bookingId={b.id} existing={b.openGame} />
              <CancelDialog b={b} />
            </>
          )}
        </div>
      )}
    </li>
  );
}

function CancelDialog({ b }: { b: BookingItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [pending, start] = useTransition();
  const preview = refundFor(b.amountPaise, new Date(b.startAt), now);

  const confirm = () =>
    start(async () => {
      const res = await cancelBookingAction(b.id);
      if (!res.ok) return void toast.error(res.message);
      toast.success(
        res.refundPaise > 0
          ? `Cancelled. ${formatINR(res.refundPaise)} (${res.refundPercent}%) is on its way back.`
          : "Cancelled. No refund applies this close to kick-off.",
      );
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setNow(new Date());
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-danger hover:bg-danger-soft" data-testid="cancel-open">
          <CalendarX2 /> Cancel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Call it off?</DialogTitle>
          <DialogDescription>
            {b.turf.name}, {formatSlotRange(new Date(b.startAt), new Date(b.endAt))}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">You get back</p>
          <p className="mt-1 flex items-baseline gap-3">
            <span className="num font-display text-5xl font-black" data-testid="refund-preview">
              {formatINR(preview.refundPaise)}
            </span>
            <span className="num text-sm font-semibold text-muted">{preview.percent}% of {formatINR(b.amountPaise)}</span>
          </p>
        </div>
        <ul className="mt-4 flex flex-col gap-1.5 text-sm">
          {REFUND_TIERS.map((t) => (
            <li key={t.percent} className={cn("flex justify-between", t.percent === preview.percent ? "font-semibold text-text" : "text-muted")}>
              <span>{t.label}</span>
              <span className="num">{t.percent}%</span>
            </li>
          ))}
        </ul>
        <Button variant="danger" size="lg" className="mt-6 w-full" onClick={confirm} disabled={pending} data-testid="cancel-confirm">
          {pending ? "Cancelling…" : "Cancel booking"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
