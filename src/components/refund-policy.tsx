import { REFUND_TIERS } from "@/domain/refund";

export function RefundPolicy() {
  return (
    <section aria-labelledby="policy-title" className="rounded-[var(--radius-card)] border border-line-strong bg-surface p-6 sm:p-8">
      <h2 id="policy-title" className="font-display text-3xl font-extrabold uppercase">Cancellation policy</h2>
      <p className="mt-1 text-sm text-muted">Refunds go back to the original payment method.</p>
      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {REFUND_TIERS.map((t) => (
          <li key={t.percent} className="rounded-2xl bg-surface-2 p-4">
            <span className="num font-display text-5xl font-black leading-none text-accent-fg">{t.percent}%</span>
            <p className="mt-2 text-sm text-muted">{t.label}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
