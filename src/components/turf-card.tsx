import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatINR } from "@/domain/money";
import { lowestPrice } from "@/domain/pricing";
import type { PricingRule, Turf } from "@/server/db/repo";
import { Badge } from "./ui/badge";
import { TurfArt } from "./turf-art";

export function TurfCard({ turf, openTonight }: { turf: Turf & { rules: PricingRule[] }; openTonight?: number }) {
  const from = lowestPrice(turf.rules);
  return (
    <Link
      href={`/turfs/${turf.slug}`}
      data-testid={`turf-card-${turf.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line-strong bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-out-quint hover:-translate-y-1.5 hover:border-accent-fg hover:shadow-lift motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <TurfArt slug={turf.slug} className="transition-transform duration-700 ease-out-quint group-hover:scale-[1.04] motion-reduce:group-hover:scale-100" />
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge tone="solid">{turf.format}</Badge>
          {openTonight !== undefined && (
            <Badge className="bg-[rgb(11_18_13/0.78)] text-[#eef3ec] backdrop-blur">
              <span className="num">{openTonight}</span> open tonight
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-3xl font-extrabold uppercase leading-[0.9]">{turf.name}</h3>
          <ArrowUpRight className="mt-1 size-5 shrink-0 text-muted transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-fg" aria-hidden />
        </div>
        <p className="text-sm text-muted">{turf.tagline}</p>
        <div className="mt-auto flex items-end justify-between border-t border-line pt-4">
          <span className="text-xs text-muted">{turf.surface}</span>
          {from !== null && (
            <span className="text-right">
              <span className="block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">From</span>
              <span className="num font-display text-2xl font-extrabold leading-none">{formatINR(from)}</span>
              <span className="text-xs text-muted">/hr</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
