"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CalendarCheck, CircleAlert, Loader2, Lock, TimerOff } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/domain/money";
import { formatDay, formatSlotRange, localDateKey } from "@/domain/time";
import { useLiveChannels } from "@/hooks/use-live-channels";
import { HoldTimer } from "@/components/booking/hold-timer";
import { Celebration } from "@/components/booking/celebration";
import { OpenGameDialog, SplitDialog } from "@/components/booking/post-booking";
import { usePaymentFlow } from "@/components/payments/use-payment-flow";
import { PitchLines } from "@/components/brand";
import { TurfArt } from "@/components/turf-art";
import { Button } from "@/components/ui/button";
import { releaseHoldAction, startCheckout } from "./actions";

type BookingView = {
  id: string;
  status: "held" | "confirmed" | "cancelled";
  amountPaise: number;
  startAt: string;
  endAt: string;
  holdExpiresAt: string | null;
  refundPaise: number | null;
  confirmedAt: string | null;
  turf: { name: string; slug: string; format: string };
  splitToken: string | null;
  openGame: { id: string; playersNeeded: number; joined: number; note: string } | null;
};

type Phase = "held" | "paying" | "awaiting" | "confirmed" | "expired" | "cancelled";

const initialPhase = (b: BookingView): Phase => {
  if (b.status === "confirmed") return "confirmed";
  if (b.status === "cancelled") return "cancelled";
  return b.holdExpiresAt && Date.parse(b.holdExpiresAt) > Date.now() ? "held" : "expired";
};

export function CheckoutView({ booking }: { booking: BookingView }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(() => initialPhase(booking));
  const [celebrate, setCelebrate] = useState(false);
  const [releasing, startRelease] = useTransition();
  const { pay, element: paymentElement } = usePaymentFlow();
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);
  const when = `${formatDay(start)} · ${formatSlotRange(start, end)}`;

  const checkStatus = useCallback(async () => {
    if (phaseRef.current !== "awaiting" && phaseRef.current !== "held") return;
    const res = await fetch(`/api/bookings/${booking.id}/status`, { cache: "no-store" });
    if (!res.ok) return;
    const { status } = (await res.json()) as { status: BookingView["status"] };
    if (status === "confirmed") {
      setPhase("confirmed");
      setCelebrate(true);
      router.refresh();
    } else if (status === "cancelled" && phaseRef.current === "awaiting") {
      setPhase("cancelled");
      router.refresh();
    }
  }, [booking.id, router]);

  useLiveChannels([`booking:${booking.id}`], checkStatus);

  // Webhooks can lag: poll gently while we wait for confirmation.
  useEffect(() => {
    if (phase !== "awaiting") return;
    const t = window.setInterval(checkStatus, 1200);
    const giveUp = window.setTimeout(() => window.clearInterval(t), 90_000);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(giveUp);
    };
  }, [phase, checkStatus]);

  const onExpire = useCallback(() => {
    if (phaseRef.current === "held") setPhase("expired");
  }, []);

  const payNow = async () => {
    setPhase("paying");
    const res = await startCheckout(booking.id);
    if (!res.ok) {
      toast.error(res.message);
      setPhase(res.error === "HOLD_EXPIRED" ? "expired" : "held");
      return;
    }
    const outcome = await pay(res.config);
    if (outcome === "submitted") {
      setPhase("awaiting");
      void checkStatus();
    } else {
      if (outcome === "failed") toast.error("Payment declined. Your slot is still held, so try again.");
      setPhase(booking.holdExpiresAt && Date.parse(booking.holdExpiresAt) > Date.now() ? "held" : "expired");
    }
  };

  const release = () =>
    startRelease(async () => {
      const res = await releaseHoldAction(booking.id);
      if (!res.ok) toast.error(res.message);
      router.push(`/turfs/${booking.turf.slug}?date=${localDateKey(start)}`);
    });

  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="floodlights pitch-stripes absolute inset-0 -z-10" />
      <PitchLines className="-z-10 opacity-60" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_minmax(0,420px)] md:py-16">
        <section aria-labelledby="checkout-title" className="relative min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "confirmed" ? (
              <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-fg">Booking confirmed</p>
                <h1 id="checkout-title" className="mt-3 font-display text-[clamp(4rem,12vw,8rem)] font-black uppercase leading-[0.82]" data-testid="confirmed-heading">
                  It&apos;s on.
                </h1>
                <p className="mt-4 max-w-md text-lg text-muted" role="status">
                  {booking.turf.name}, {when}. See you on the pitch.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <SplitDialog bookingId={booking.id} amountPaise={booking.amountPaise} existingToken={booking.splitToken} />
                  <OpenGameDialog bookingId={booking.id} existing={booking.openGame} />
                  <Button asChild variant="ghost">
                    <Link href="/bookings">
                      <CalendarCheck /> My bookings
                    </Link>
                  </Button>
                </div>
              </motion.div>
            ) : phase === "expired" ? (
              <motion.div key="expired" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <TimerOff className="size-10 text-held" aria-hidden />
                <h1 id="checkout-title" className="mt-4 font-display text-6xl font-black uppercase leading-[0.85] sm:text-7xl">
                  Full time on your hold
                </h1>
                <p className="mt-4 max-w-md text-muted" role="status">
                  Five minutes passed, so the slot went back on the board. It might still be free.
                </p>
                <Button asChild size="lg" className="mt-8">
                  <Link href={`/turfs/${booking.turf.slug}`}>Pick a slot again</Link>
                </Button>
              </motion.div>
            ) : phase === "cancelled" ? (
              <motion.div key="cancelled" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <CircleAlert className="size-10 text-danger" aria-hidden />
                <h1 id="checkout-title" className="mt-4 font-display text-6xl font-black uppercase leading-[0.85]">
                  {booking.refundPaise !== null ? "Booking cancelled" : "Slot no longer held"}
                </h1>
                <p className="mt-4 max-w-md text-muted" role="status">
                  {booking.refundPaise !== null
                    ? `A refund of ${formatINR(booking.refundPaise)} is on its way to your original payment method.`
                    : "This hold was released. If a payment went through after it lapsed, it is refunded automatically."}
                </p>
                <Button asChild size="lg" className="mt-8">
                  <Link href={`/turfs/${booking.turf.slug}`}>Back to {booking.turf.name}</Link>
                </Button>
              </motion.div>
            ) : (
              <motion.div key="held" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-fg">Slot held for you</p>
                <h1 id="checkout-title" className="mt-3 font-display text-6xl font-black uppercase leading-[0.85] sm:text-7xl">
                  Beat the clock
                </h1>
                <div className="mt-8">
                  {booking.holdExpiresAt && <HoldTimer expiresAt={booking.holdExpiresAt} onExpire={onExpire} />}
                </div>
                <p className="mt-6 max-w-md text-muted">
                  Nobody else can book this slot until the clock runs out. Pay before then to lock it in.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <aside className="relative">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-line-strong bg-surface shadow-lift" data-testid="checkout-card">
            {celebrate && <Celebration />}
            <div className="aspect-[16/8] overflow-hidden border-b border-line-strong">
              <TurfArt slug={booking.turf.slug} />
            </div>
            <div className="p-6">
              <h2 className="font-display text-3xl font-extrabold uppercase leading-none">{booking.turf.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {booking.turf.format === "5s" ? "5-a-side" : "7-a-side"} · {when}
              </p>
              <dl className="mt-5 flex flex-col gap-2 border-t border-line-strong pt-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">1 hour</dt>
                  <dd className="num">{formatINR(booking.amountPaise)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="font-semibold">Total</dt>
                  <dd className="num font-display text-4xl font-black" data-testid="checkout-total">
                    {formatINR(booking.amountPaise)}
                  </dd>
                </div>
              </dl>
              {(phase === "held" || phase === "paying" || phase === "awaiting") && (
                <div className="mt-6 flex flex-col gap-2">
                  <Button size="lg" onClick={payNow} disabled={phase !== "held"} data-testid="pay-button">
                    {phase === "awaiting" ? (
                      <>
                        <Loader2 className="animate-spin motion-reduce:animate-none" /> Confirming payment…
                      </>
                    ) : phase === "paying" ? (
                      "Opening checkout…"
                    ) : (
                      <>
                        <Lock /> Pay {formatINR(booking.amountPaise)}
                      </>
                    )}
                  </Button>
                  {phase === "awaiting" && (
                    <p className="text-center text-xs text-muted" role="status">
                      Waiting for the payment gateway to confirm. This usually takes a second.
                    </p>
                  )}
                  {phase === "held" && (
                    <Button variant="ghost" onClick={release} disabled={releasing}>
                      <ArrowLeft /> Release slot
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
      {paymentElement}
    </div>
  );
}
