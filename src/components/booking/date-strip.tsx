"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { dateLabel } from "@/domain/time";
import { cn } from "@/lib/utils";

/** Seven-day strip. Arrow keys move between days (roving tabindex). */
export function DateStrip({
  dates,
  value,
  onChange,
  labels,
}: {
  dates: string[];
  value: string;
  onChange: (d: string) => void;
  labels: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = dates.indexOf(value);
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(dates.length - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(0, i - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = dates.length - 1;
    else return;
    e.preventDefault();
    onChange(dates[next]!);
    ref.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Choose a date"
      onKeyDown={onKeyDown}
      className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0"
      data-testid="date-strip"
    >
      {dates.map((d, i) => {
        const l = dateLabel(d);
        const active = d === value;
        const rel = i === 0 ? "Today" : i === 1 ? "Tomorrow" : l.dow;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={labels[d]}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(d)}
            data-date={d}
            className={cn(
              "relative isolate flex min-w-[4.5rem] snap-start flex-col items-center rounded-2xl border px-2 py-2.5 transition-colors",
              active ? "border-transparent text-accent-ink" : "border-line-strong bg-surface text-text hover:border-accent-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId="date-selection"
                className="absolute inset-0 -z-10 rounded-2xl bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className={cn("text-[0.65rem] font-bold uppercase tracking-[0.14em]", !active && "text-muted")}>{rel}</span>
            <span className="num font-display text-3xl font-black leading-none">{l.day}</span>
            <span className={cn("text-[0.65rem] font-bold uppercase tracking-[0.14em]", !active && "text-muted")}>{l.month}</span>
          </button>
        );
      })}
    </div>
  );
}
