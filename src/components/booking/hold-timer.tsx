"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

const ANNOUNCE_AT = new Set([240, 180, 120, 60, 30, 10]);

function FlipDigit({ value, urgent }: { value: string; urgent: boolean }) {
  return (
    <span
      className={cn(
        "flip-digit relative inline-grid h-[1.15em] w-[0.72em] place-items-center overflow-hidden rounded-[0.14em] bg-[#0a110c] text-[#c6ff3d]",
        "shadow-[inset_0_-0.06em_0_rgb(0_0_0/0.5),inset_0_0.06em_0_rgb(255_255_255/0.04)]",
        urgent && "text-[#ffb547]",
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ rotateX: -90, y: "-30%", opacity: 0 }}
          animate={{ rotateX: 0, y: "0%", opacity: 1 }}
          exit={{ rotateX: 90, y: "30%", opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="num block [backface-visibility:hidden]"
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/50" />
    </span>
  );
}

/**
 * Scoreboard countdown for a hold. Digits are decorative; a polite live
 * region announces the time left at sensible intervals and on expiry.
 */
export function HoldTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const target = Date.parse(expiresAt);
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((target - Date.now()) / 1000)));
  const [announcement, setAnnouncement] = useState("");
  const fired = useRef(false);

  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setLeft(s);
      if (ANNOUNCE_AT.has(s)) {
        setAnnouncement(s >= 60 ? `${s / 60} minute${s === 60 ? "" : "s"} left on your hold` : `${s} seconds left on your hold`);
      }
      if (s === 0 && !fired.current) {
        fired.current = true;
        setAnnouncement("Your hold has expired");
        onExpire();
      }
    };
    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [target, onExpire]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const urgent = left <= 60;

  return (
    <div role="timer" aria-label={`Hold time remaining: ${Number(mm)} minutes ${Number(ss)} seconds`} data-testid="hold-timer">
      <div aria-hidden className="flex items-center gap-[0.08em] font-display text-7xl font-black leading-none sm:text-8xl">
        <FlipDigit value={mm[0]!} urgent={urgent} />
        <FlipDigit value={mm[1]!} urgent={urgent} />
        <span className={cn("px-[0.04em] text-accent-fg motion-safe:animate-pulse", urgent && "text-held")}>:</span>
        <FlipDigit value={ss[0]!} urgent={urgent} />
        <FlipDigit value={ss[1]!} urgent={urgent} />
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="hold-announcer">
        {announcement}
      </p>
    </div>
  );
}
