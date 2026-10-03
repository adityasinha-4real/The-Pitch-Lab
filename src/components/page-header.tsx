import { PitchLines } from "./brand";

export function PageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <section className="relative isolate mb-10 overflow-hidden border-b border-line">
      <div aria-hidden className="floodlights pitch-stripes absolute inset-0 -z-10" />
      <PitchLines className="-z-10 opacity-60" />
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-fg">{eyebrow}</p>
          <h1 className="mt-3 font-display text-6xl font-black uppercase leading-[0.85] sm:text-7xl">{title}</h1>
          {description && <p className="mt-4 max-w-xl text-muted">{description}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
