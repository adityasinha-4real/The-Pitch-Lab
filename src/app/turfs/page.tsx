import type { Metadata } from "next";
import Link from "next/link";
import * as repo from "@/server/db/repo";
import { TurfCard } from "@/components/turf-card";
import { PageHeader } from "@/components/page-header";
import { RefundPolicy } from "@/components/refund-policy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Turfs" };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "5s", label: "5-a-side" },
  { value: "7s", label: "7-a-side" },
] as const;

export default async function TurfsPage({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const { format = "all" } = await searchParams;
  const turfs = (await repo.listTurfs()).filter((t) => format === "all" || t.format === format);

  return (
    <>
      <PageHeader eyebrow="The grounds" title="Pick your pitch" description="Three turfs, two formats, one booking flow. Every slot is an hour." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <nav aria-label="Filter by format" className="flex gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "all" ? "/turfs" : `/turfs?format=${f.value}`}
              aria-current={format === f.value ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                format === f.value ? "border-transparent bg-accent text-accent-ink" : "border-line-strong bg-surface text-muted hover:text-text",
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {turfs.map((t) => (
            <TurfCard key={t.id} turf={t} />
          ))}
        </div>
        <div id="policy" className="mt-16 scroll-mt-24">
          <RefundPolicy />
        </div>
      </div>
    </>
  );
}
