# The Pitch Lab — working notes

Football turf booking app. Read `SPEC.md` (checklist) and `DECISIONS.md` (why things are the way they are) before changing behaviour.

## Stack
Next.js 15 App Router · TypeScript strict · pnpm · Tailwind v4 · shadcn/ui structure (restyled) · motion · next-themes ·
Supabase (Auth via `@supabase/ssr`, Postgres, Realtime broadcast) · PGlite for local mode · Razorpay (test mode) · Zod · Vitest · Playwright · @axe-core/playwright.

## Commands
| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on :3000 (local mode unless Supabase env is set) |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint (flat config) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest: domain, payments, DB (PGlite) incl. concurrency |
| `pnpm test:e2e` | Playwright on :3100 against a production build, in-memory DB, test hooks on |
| `pnpm verify` | docs check → lint → typecheck → test → build → e2e, stops at first failure |
| `pnpm db:seed` | Seed `DATABASE_URL` (Supabase) or the local PGlite dir |

## Layout
- `supabase/migrations/*.sql` — schema, RLS, functions (shared by both modes). `supabase/seed.sql` — relative-date seed.
- `supabase/local/shim.sql` — the bits of Supabase (`auth` schema, roles, `auth.uid()`) that PGlite lacks. Never shipped to Supabase.
- `src/server/db` — `SqlClient` adapters + `repo.ts` (the only place SQL lives in TS).
- `src/server/auth` — `AuthAdapter` (supabase | local).
- `src/server/payments` — `PaymentProvider` (razorpay | mock), HMAC, webhook handler.
- `src/server/realtime` — invalidation bus (Supabase broadcast | in-process SSE).
- `src/domain` — pure logic (pricing, refund, slots, time). No I/O. Unit tested.
- `src/app` — routes. Server actions live next to the route in `actions.ts`.
- `src/components/ui` — shadcn-structured primitives. `src/components/*` — app components.
- `tests/` — Vitest. `e2e/` — Playwright; screenshots land in `e2e/screenshots/`.

## Conventions
- Money is integer paise everywhere; format only at the edge with `formatINR`.
- Times: store `timestamptz`; all slot math in `src/domain/time.ts` (IST, fixed +05:30).
- Validate every server action / route input with Zod. Server actions return `{ ok: true, ... } | { ok: false, error }`, never throw to the client.
- Never confirm a booking from client code. Only `handleWebhook` → `confirm_payment()`.
- No lorem, TODO or placeholder copy in `src/` (verify scans for it).
- Interactive targets ≥ 44px. Every animation must have a reduced-motion path (`useReducedMotion` / `motion-reduce:`).
- Prices, timers, scores use `tabular-nums` (`.num` utility).

## Design tokens (`src/app/globals.css`)
| Token | Dark — floodlit night | Light — chalk on grass |
|---|---|---|
| `--bg` | `#0B120D` | `#F6F5EF` |
| `--surface` | `#121C15` | `#FFFFFF` |
| `--surface-2` | `#1A271E` | `#ECEBE3` |
| `--accent` | `#C6FF3D` | `#0F7A3D` |
| `--accent-ink` (text on accent) | `#0B120D` | `#FFFFFF` |
| `--text` | `#EEF3EC` | `#0E1A12` |
| `--muted` | `#9DB0A2` | `#4A5A4F` |
| `--line` (pitch chalk) | `rgb(238 243 236 / .08)` | `rgb(15 122 61 / .12)` |
| `--held` | `#FFB547` | `#9A5B00` |
| `--danger` | `#FF6B5E` | `#B42318` |

Type: `--font-display` Big Shoulders Display (headings, scoreboard numerals), `--font-body` Inter Tight.
Theme: `next-themes` with `attribute="class"`, `defaultTheme="system"`, storage key `pitchlab-theme`.
