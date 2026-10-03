-- The Pitch Lab: core schema.
create extension if not exists btree_gist with schema extensions;

create type public.turf_format as enum ('5s', '7s');
create type public.booking_status as enum ('held', 'confirmed', 'cancelled');
create type public.booking_kind as enum ('booking', 'block');
create type public.user_role as enum ('user', 'admin');

-- Profiles mirror auth.users and carry the role.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'user',
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.turfs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  format public.turf_format not null,
  surface text not null,
  tagline text not null default '',
  description text not null default '',
  amenities text[] not null default '{}',
  images text[] not null default '{}',
  open_hour int not null check (open_hour between 0 and 23),
  close_hour int not null check (close_hour between 1 and 24),
  created_at timestamptz not null default now(),
  check (close_hour > open_hour)
);

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  turf_id uuid not null references public.turfs (id) on delete cascade,
  label text not null,
  dow int[] not null check (cardinality(dow) > 0 and dow <@ array[0, 1, 2, 3, 4, 5, 6]),
  start_time time not null,
  end_time time not null,
  price_paise int not null check (price_paise > 0),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index pricing_rules_turf_idx on public.pricing_rules (turf_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  turf_id uuid not null references public.turfs (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kind public.booking_kind not null default 'booking',
  slot tstzrange not null,
  status public.booking_status not null default 'held',
  amount_paise int not null default 0 check (amount_paise >= 0),
  hold_expires_at timestamptz,
  rzp_order_id text unique,
  rzp_payment_id text,
  refund_paise int check (refund_paise >= 0),
  rzp_refund_id text,
  note text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  constraint bookings_slot_shape check (
    not isempty(slot) and lower_inc(slot) and not upper_inc(slot)
    and not lower_inf(slot) and not upper_inf(slot)
  ),
  constraint bookings_hold_has_expiry check (status <> 'held' or hold_expires_at is not null),
  constraint bookings_no_overlap exclude using gist (turf_id with =, slot with &&)
    where (status in ('held', 'confirmed'))
);
create index bookings_user_idx on public.bookings (user_id, created_at desc);
create index bookings_turf_slot_idx on public.bookings using gist (turf_id, slot);
create index bookings_held_expiry_idx on public.bookings (hold_expires_at) where status = 'held';

-- Split payments: one row per seat. All seats of a booking share the link token.
create table public.booking_shares (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  token text not null,
  seat int not null check (seat >= 1),
  payer_name text,
  amount_paise int not null check (amount_paise > 0),
  paid boolean not null default false,
  rzp_order_id text unique,
  claimed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, seat)
);
create index booking_shares_token_idx on public.booking_shares (token);

create table public.open_games (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  players_needed int not null check (players_needed between 1 and 13),
  joined int not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (joined between 0 and players_needed)
);

create table public.open_game_players (
  open_game_id uuid not null references public.open_games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (open_game_id, user_id)
);

-- Raw webhook deliveries, for idempotency and audit. Service role only.
create table public.payment_events (
  event_id text primary key,
  event_type text not null,
  order_id text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
