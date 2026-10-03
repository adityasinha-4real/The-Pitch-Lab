import Link from "next/link";
import { cn } from "@/lib/utils";

/** The mark: a ball slipping between two legs. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <rect width="40" height="40" rx="11" fill="var(--accent)" />
      <path d="M13.5 7.5 L17 25.5" stroke="var(--accent-ink)" strokeWidth="4" strokeLinecap="round" />
      <path d="M26.5 7.5 L23 25.5" stroke="var(--accent-ink)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="20" cy="30.5" r="4.6" fill="var(--accent-ink)" />
      <path d="M20 27.6 l2 1.5 -0.8 2.4 h-2.4 l-0.8 -2.4z" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex min-h-11 items-center gap-2.5 rounded-xl", className)} aria-label="The Pitch Lab home">
      <LogoMark className="transition-transform duration-300 ease-out-quint group-hover:-rotate-6" />
      <span className="font-display text-[1.6rem] font-black uppercase leading-none tracking-wide">
        The Pitch<span className="text-accent-fg"> Lab</span>
      </span>
    </Link>
  );
}

/** Full pitch markings, drawn in chalk. Decorative. */
export function PitchLines({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 760"
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      fill="none"
      stroke="var(--line)"
      strokeWidth="2"
    >
      <g vectorEffect="non-scaling-stroke">
        <rect x="40" y="40" width="1120" height="680" rx="4" />
        <line x1="600" y1="40" x2="600" y2="720" />
        <circle cx="600" cy="380" r="96" />
        <circle cx="600" cy="380" r="5" fill="var(--line)" />
        <rect x="40" y="200" width="170" height="360" />
        <rect x="40" y="290" width="62" height="180" />
        <path d="M210 312 A96 96 0 0 1 210 448" />
        <circle cx="150" cy="380" r="4" fill="var(--line)" />
        <rect x="990" y="200" width="170" height="360" />
        <rect x="1098" y="290" width="62" height="180" />
        <path d="M990 312 A96 96 0 0 0 990 448" />
        <circle cx="1050" cy="380" r="4" fill="var(--line)" />
        <path d="M40 58 A18 18 0 0 0 58 40" />
        <path d="M1142 40 A18 18 0 0 0 1160 58" />
        <path d="M40 702 A18 18 0 0 1 58 720" />
        <path d="M1142 720 A18 18 0 0 1 1160 702" />
      </g>
    </svg>
  );
}
