# Decisions

Each entry: the decision, then why. Newest last.

## D1 — Two runtime modes: `supabase` and `local`
The app runs in **supabase** mode when `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `DATABASE_URL` are all set; otherwise **local** mode.
No Supabase project, Supabase CLI or running Docker daemon was available while building, so local mode is what the test suite exercises.
Local mode is not a fake: it runs the real migrations in **PGlite** (Postgres 17 compiled to WASM, with the `btree_gist` contrib), so the EXCLUDE constraint, RLS policies and SQL functions are the same code that ships to Supabase.

## D2 — One SQL repository for both modes, RLS via role switching
All data access goes through `src/server/db/repo.ts`, which issues SQL against a `SqlClient` (PGlite locally, `postgres.js` against Supabase's pooler in production).
User-scoped calls run inside a transaction that does `set local role authenticated` and sets `request.jwt.claims` — exactly what PostgREST does — so RLS policies and `auth.uid()` behave identically in both modes.
Trusted server paths (webhook, cleanup job, seeding) run as the service role.
Why: one implementation, fully covered by tests, instead of a tested local path and an untested PostgREST path.
`@supabase/ssr` is still used for what it is for: auth sessions (cookies, middleware refresh, OTP and OAuth).

## D3 — Business rules live in SQL functions
`create_hold`, `confirm_payment`, `cancel_booking`, `join_open_game`, `claim_share`, `release_expired_holds` etc. are Postgres functions.
The EXCLUDE constraint is the only arbiter of double booking — there is no app-level "is it free?" pre-check that could race.
`create_hold` first cancels any *expired* hold overlapping the requested slot (expired holds are free on read), then inserts.

## D4 — Blocks are bookings with `kind = 'block'`
Admin slot blocks are rows in `bookings` with `kind='block'`, `status='confirmed'`, amount 0.
Why: the same EXCLUDE constraint then prevents blocking a booked slot and booking a blocked slot, with no second overlap check.
Added columns beyond the brief: `kind`, `created_at`, `confirmed_at`, `cancelled_at`, `refund_paise`, `rzp_payment_id`, `rzp_refund_id`.

## D5 — Time zone
The arena runs on `Asia/Kolkata` (UTC+05:30, no DST). Slots are whole hours from `open_hour` to `close_hour` local time; `close_hour` may be 24 (midnight).
Slot ranges are stored as `tstzrange` with `[)` bounds.

## D6 — Pricing rule resolution
A slot's price comes from the rules whose `dow` contains the slot's local weekday (0 = Sunday) and whose `[start_time, end_time)` covers the slot's start.
If several match, the narrowest time window wins (so "peak 18:00–23:00" overrides "weekday 06:00–24:00"); ties go to the higher price.
No match → the slot is not bookable ("blocked" state, no price), rather than silently defaulting.

## D7 — Payments: provider interface, webhook is the only confirmer
`PaymentProvider` has `createOrder`, `verifyWebhookSignature`, `refund`, `checkoutConfig`.
`RazorpayProvider` is used when `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are set; otherwise `MockPaymentProvider`.
**No Razorpay test keys were available, so the mock provider is what the tests run.**
The mock does not shortcut confirmation: its in-app checkout sheet calls `/api/payments/mock/complete`, which plays the role of Razorpay's servers — it builds a `payment.captured` event, signs it with HMAC-SHA256 using the webhook secret, and delivers it to `/api/webhooks/razorpay`.
The browser's success callback only starts polling for status; it never writes.

## D8 — Split pay model
The organiser pays the full amount to confirm (a 5-minute hold cannot wait for friends).
They can then split the booking into N seats; seat 1 is theirs and marked paid. The share link `/split/<token>` lets friends claim a seat by name and pay their per-head amount (same provider + webhook path).
`booking_shares.token` is the booking's link token (shared by all seats of that booking); each seat has its own `id` and `seat` number.
Per-head is `floor(total / N)` with the remainder added to the organiser's seat, so seats always sum to the total.
Collected split money is recorded against the booking; paying it out to the organiser is a settlement concern outside this app.

## D9 — Open games joiners
Added `open_game_players(open_game_id, user_id)` so one user can't join twice; `open_games.joined` is kept as the denormalised count, updated in the same function under a row lock.

## D10 — Realtime as an invalidation bus
Slot and split views subscribe to a channel (`turf:<id>`, `split:<token>`) and refetch when pinged.
Supabase mode sends pings with Realtime **broadcast** (server → REST broadcast endpoint, service role). Local mode uses an in-process event bus streamed over SSE.
Why not `postgres_changes` on `bookings`: RLS rightly hides other users' rows, and slot availability must be public without exposing who booked.

## D11 — Expired-hold cleanup
Reads ignore expired holds; `create_hold` reclaims them on demand. A cleanup job (`release_expired_holds()`) marks them cancelled:
`/api/cron/release-holds` (Bearer `CRON_SECRET`, wired in `vercel.json`) in production, and a 30-second in-process interval in local mode.

## D12 — Local auth adapter
Without Supabase, magic link and Google sign-in use a local adapter: the "email" step issues an HMAC-signed, 10-minute single-use link, which local mode shows on screen (there is no mail server); "Continue with Google" signs in a demo Google identity.
Sessions are HMAC-signed cookies (`AUTH_SECRET`, random per boot if unset).
Admin role: `profiles.role = 'admin'`, seeded for `admin@nutmeg.arena`, and granted on sign-up to any email in `ADMIN_EMAILS`.

## D13 — Test hooks
Waiting five real minutes in an e2e test is not acceptable, so with `NUTMEG_TEST_HOOKS=1` (set only by the Playwright web server) `/api/test/expire-holds` back-dates holds; the route returns 404 otherwise. The same flag exempts magic-link requests from the per-email rate limit, because the suite signs the seeded admin in more than five times in ten minutes.

## D14 — Concurrency test
`tests/db/concurrency.test.ts` fires two `create_hold` calls for the same slot from two users with `Promise.all` and asserts exactly one succeeds, printing the result.
In PGlite the two transactions are serialised by the engine, and the loser fails on the EXCLUDE constraint (`23P01`), not on an application check.
If `TEST_DATABASE_URL` is set, the same test runs on two real Postgres connections in parallel.

## D15 — shadcn/ui
Components are written in shadcn's structure (`components.json`, `src/components/ui/*`, Radix primitives + `cva`) but restyled to the scoreboard/pitch language rather than generated with the default look.

## D16 — "Big Shoulders Display" is now the variable "Big Shoulders"
Google merged the Display/Text cuts into one variable family with an optical-size axis. We load `Big_Shoulders` with the `opsz` axis and set `font-variation-settings: "opsz" 72` in the `font-display` utility, which is the Display cut.

## D17 — Database boots in `instrumentation.ts`
Booting PGlite lazily inside the first render made that response fail (`ArrayBuffer is not detachable`, a WASM-memory buffer reaching the response stream). The DB now boots at server start, which is also where the local cleanup interval lives. Node-only code sits in `instrumentation-node.ts` so the edge bundle stays clean.

## D18 — No root `loading.tsx`
A root loading boundary wrapped every page in Suspense, so `notFound()` streamed with HTTP 200 and same-route search-param navigations (admin tabs) were dropped. Skeletons live in route segments instead (`/turfs`, `/turfs/[slug]`, `/games`, `/bookings`); admin and checkout 404 properly.

## D19 — Cross-bundle singletons are compared by name
Route handlers and server actions are separate bundles, so a provider stored on `globalThis` by one fails `instanceof` in the other. The mock-complete route checks `provider.name === "mock"`.

## D20 — Split payers don't need an account
Anyone holding the split link can pay a seat (the link is the capability: a v4 UUID, 122 random bits). Seat claims are rate-limited per IP and a claimed seat is reserved for 10 minutes while its payment is in flight.
