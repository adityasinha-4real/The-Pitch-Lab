# The Pitch Lab — Specification

A football turf booking web app. A box is ticked only after the test that proves it passes.
The proving test is named after each item (`unit:` = Vitest, `e2e:` = Playwright, `script:` = verify step).

## M0 — Foundations
- [x] SPEC.md, CLAUDE.md, DECISIONS.md exist and are maintained — `script: verify` (files read by `scripts/check-docs.mjs`)
- [x] Next.js 15 App Router, TypeScript strict, pnpm, Tailwind v4 — `script: typecheck` + `script: build`
- [x] Scripts: build, lint, typecheck, test, test:e2e, verify (fails fast) — `script: verify`
- [x] No lorem / TODO / placeholder text in shipped code — `script: check-docs` (banned-word scan of `src/`)

## M1 — Data layer
- [x] Migrations in `supabase/migrations`: turfs, pricing_rules, bookings, booking_shares, open_games, profiles — `unit: db/migrations.test.ts`
- [x] RLS enabled on every table — `unit: db/migrations.test.ts › every public table has RLS`
- [x] RLS isolates users: a user cannot read another user's booking — `unit: db/rls.test.ts`
- [x] `btree_gist` EXCLUDE (turf_id WITH =, slot WITH &&) WHERE status IN ('held','confirmed') — `unit: db/migrations.test.ts › exclusion constraint`
- [x] Seed: 3 turfs, pricing (weekday / weekend / peak 6–11 PM), sample bookings — `unit: db/seed.test.ts`
- [x] Concurrency: 2 simultaneous holds on the same slot → exactly 1 succeeds (result printed) — `unit: db/concurrency.test.ts`

## M2 — Domain logic
- [x] Pricing calc from rules (weekday, weekend, peak override, no-rule fallback) — `unit: domain/pricing.test.ts`
- [x] Refund calc: 100% > 24h, 50% 6–24h, 0% < 6h, boundaries — `unit: domain/refund.test.ts`
- [x] Razorpay HMAC-SHA256 webhook verification (valid, tampered, wrong secret, timing-safe) — `unit: payments/hmac.test.ts`
- [x] Slot state derivation: available / held / booked / past / blocked, expired holds read as free — `unit: domain/slots.test.ts`

## M3 — Auth
- [x] Magic-link sign in (Supabase OTP; local adapter with signed link when Supabase is not configured) — `e2e: auth.spec.ts`
- [x] Google sign in (Supabase OAuth; local adapter in mock mode) — `e2e: auth.spec.ts › google`
- [x] Protected routes redirect to sign-in and return afterwards — `e2e: auth.spec.ts › redirect`

## M4 — Browse & book
- [x] Turf list with format, surface, from-price — `e2e: booking.spec.ts`
- [x] Turf detail page — `e2e: booking.spec.ts`
- [x] Slot grid: 7-day date strip, hourly slots, price from rules — `e2e: booking.spec.ts`
- [x] Slot states available / held / booked / past / blocked rendered distinctly — `e2e: slots.spec.ts`
- [x] Slot grid live via Realtime (another user's hold appears without reload) — `e2e: slots.spec.ts › live`
- [x] Arrow-key navigable slot grid — `e2e: slots.spec.ts › keyboard`
- [x] Hold: server action creates held booking with 5-min TTL — `e2e: booking.spec.ts`
- [x] Expired holds treated as free on read + cleanup job — `e2e: hold-expiry.spec.ts` + `unit: db/holds.test.ts`
- [x] aria-live scoreboard-flip hold countdown — `e2e: booking.spec.ts › countdown`

## M5 — Payments
- [x] PaymentProvider interface; Razorpay provider; MockPaymentProvider when keys absent — `unit: payments/provider.test.ts`
- [x] Order → checkout → webhook verifies HMAC → confirm — `e2e: booking.spec.ts › browse→hold→pay(mock)→confirmed`
- [x] Client callback never confirms (confirm only from verified webhook) — `unit: payments/webhook.test.ts`
- [x] Webhook rejects bad signatures and is idempotent — `unit: payments/webhook.test.ts`
- [x] Net-ripple / confetti on confirm (reduced-motion aware) — `e2e: booking.spec.ts`

## M6 — After booking
- [x] My bookings (upcoming / past / cancelled) — `e2e: my-bookings.spec.ts`
- [x] Cancel with refund policy 100% / 50% / 0% — `e2e: my-bookings.spec.ts › cancel` + `unit: domain/refund.test.ts`
- [x] Split pay: share link, per-head amount, live progress bar — `e2e: split-pay.spec.ts`
- [x] Open games board: "need N players", join — `e2e: open-games.spec.ts`

## M7 — Admin
- [x] /admin role-gated (non-admin gets 404) — `e2e: admin.spec.ts › gate`
- [x] Block slots — `e2e: admin.spec.ts › block slot`
- [x] Edit pricing — `e2e: admin.spec.ts › pricing`
- [x] Occupancy heatmap — `e2e: admin.spec.ts`
- [x] Bookings table — `e2e: admin.spec.ts`

## M8 — Design & accessibility
- [x] Dark "floodlit night" + light "chalk on grass" themes, tokens as CSS vars — `e2e: theme.spec.ts`
- [x] System default + toggle, no theme flash, persists on reload — `e2e: theme.spec.ts`
- [x] Big Shoulders Display + Inter Tight, tabular-nums for prices / timers — `e2e: theme.spec.ts › fonts`
- [x] Pitch-line SVG backgrounds, floodlight glow, grain — `e2e: screenshots.spec.ts` (visual)
- [x] Motion: hero stagger, slot cascade, shared-layout selection, hover lift; prefers-reduced-motion respected — `e2e: theme.spec.ts › reduced motion`
- [x] Mobile-first, 44px targets, sticky bottom booking bar on mobile — `e2e: mobile.spec.ts`
- [x] Skeleton loaders, not spinners — `e2e: mobile.spec.ts › skeleton` (route `loading.tsx` renders skeletons)
- [x] axe: zero serious/critical violations in both themes — `e2e: a11y.spec.ts`
- [x] Screenshots light + dark at 390px and 1440px for home, slot grid, checkout, admin → `e2e/screenshots/` — `e2e: screenshots.spec.ts`
