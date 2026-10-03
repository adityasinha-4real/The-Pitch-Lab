# The Pitch Lab

Football turf booking: hourly slots on three floodlit turfs, five-minute holds, Razorpay payments confirmed only by a verified webhook, split-the-bill links, an open-games board and an admin control room.

**Floodlit night** (dark) and **chalk on grass** (light) themes, both first-class.

## Run it

```bash
pnpm install
pnpm exec playwright install chromium   # for e2e
pnpm dev                                # http://localhost:3000
```

With no environment variables it runs in **local mode**: the real Supabase migrations run in an embedded Postgres (PGlite), auth uses signed magic links shown on screen, and payments use a mock gateway that signs real HMAC webhooks. Sign in as `admin@nutmeg.arena` for the admin area.

To run against Supabase and Razorpay, copy `.env.example` to `.env.local` and fill it in, apply `supabase/migrations` and `supabase/seed.sql` to your project, and point Razorpay's webhook at `/api/webhooks/razorpay`.

## Check it

```bash
pnpm verify   # docs check → lint → typecheck → unit/DB tests → build → e2e (incl. axe + screenshots)
```

Screenshots of every key page in both themes at 390px and 1440px land in `e2e/screenshots/`.

See `SPEC.md` for the feature checklist, `DECISIONS.md` for the reasoning, `CLAUDE.md` for conventions and tokens.
