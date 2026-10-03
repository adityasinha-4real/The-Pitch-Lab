import Link from "next/link";
import { LogoMark } from "./brand";
import { ThemeSwitcher } from "./theme-controls";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_auto]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <LogoMark />
            <span className="font-display text-2xl font-black uppercase">Nutmeg Arena</span>
          </div>
          <p className="max-w-sm text-sm text-muted">
            Three floodlit turfs, bookable by the hour. Hold a slot for five minutes, pay, and split it with the squad.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 text-sm">
          {[
            ["/turfs", "All turfs"],
            ["/games", "Open games"],
            ["/bookings", "My bookings"],
            ["/turfs#policy", "Cancellation policy"],
          ].map(([href, label]) => (
            <Link key={href} href={href!} className="inline-flex min-h-11 items-center text-muted hover:text-text">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-3 md:items-end">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Theme</span>
          <ThemeSwitcher />
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted sm:px-6">
          Turfs open from 6 AM, every day. All times are arena time (IST, UTC+05:30).
        </p>
      </div>
    </footer>
  );
}
