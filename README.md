# The Pitch Lab

Football turf booking: hourly slots on three floodlit turfs, five-minute holds, Razorpay payments confirmed only by a verified webhook, split-the-bill links, an open-games board and an admin control room.

**Floodlit night** (dark) and **chalk on grass** (light) themes, both first-class.

## Run it

```bash
pnpm install
pnpm exec playwright install chromium   # for e2e
pnpm dev                                # http://localhost:3000
```

With no environment variables it runs in **local mode**: the real Supabase migrations run in an embedded Postgres (PGlite), auth uses signed magic links shown on screen, and payments use a mock gateway that signs real HMAC webhooks. Sign in as `admin@pitchlab.test` for the admin area.

To run against Supabase and Razorpay, copy `.env.example` to `.env.local` and fill it in, apply `supabase/migrations` and `supabase/seed.sql` to your project, and point Razorpay's webhook at `/api/webhooks/razorpay`.

## Deploy it (Vercel + Supabase)

1. Create a Supabase project. Run `supabase/migrations/*.sql` in order, then optionally `pnpm db:seed` with `DATABASE_URL` set.
2. Import the GitHub repo into Vercel (framework preset: Next.js).
3. Add the variables from `.env.example`: the four Supabase ones, `AUTH_SECRET`, `CRON_SECRET`, `ADMIN_EMAILS`, and `NEXT_PUBLIC_SITE_URL` set to your Vercel URL. Add the Razorpay keys too, or leave them empty to keep the mock gateway.
4. Deploy. If you use Razorpay, point its webhook at `https://<your-domain>/api/webhooks/razorpay`.

No other server is needed. The hold-cleanup cron in `vercel.json` runs daily, which the free Hobby plan allows (see DECISIONS D11).

## Check it

```bash
pnpm verify   # docs check → lint → typecheck → unit/DB tests → build → e2e (incl. axe + screenshots)
```

Screenshots of every key page in both themes at 390px and 1440px land in `e2e/screenshots/`.

See `SPEC.md` for the feature checklist, `DECISIONS.md` for the reasoning, `CLAUDE.md` for conventions and tokens.
