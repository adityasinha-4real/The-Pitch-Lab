-- Business rules. Every function callable by API roles derives identity from
-- auth.uid() and is safe to call directly through PostgREST. Functions that
-- trust their caller are revoked from API roles (service role only).

-- Arena clock: Asia/Kolkata, fixed +05:30, no DST.
create or replace function public.to_local(ts timestamptz) returns timestamp
language sql immutable
as $$ select ts at time zone interval '+05:30' $$;

create or replace function public.hold_ttl() returns interval
language sql immutable
as $$ select interval '5 minutes' $$;

-- Narrowest matching window wins; ties go to the higher price. NULL = unpriced.
create or replace function public.slot_price(p_turf_id uuid, p_start timestamptz) returns int
language sql stable set search_path = public
as $$
  select r.price_paise
  from public.pricing_rules r
  where r.turf_id = p_turf_id
    and extract(dow from public.to_local(p_start))::int = any (r.dow)
    and r.start_time <= public.to_local(p_start)::time
    and public.to_local(p_start)::time < r.end_time
  order by (r.end_time - r.start_time) asc, r.price_paise desc
  limit 1
$$;

-- 100% if more than 24h before kick-off, 50% from 24h down to 6h, else 0.
create or replace function public.refund_percent(p_start timestamptz, p_at timestamptz) returns int
language sql immutable
as $$
  select case
    when p_start - p_at > interval '24 hours' then 100
    when p_start - p_at >= interval '6 hours' then 50
    else 0
  end
$$;

create or replace function public.assert_slot_start(
  p_turf public.turfs, p_start timestamptz, p_horizon interval
) returns void
language plpgsql stable
as $$
declare
  v_local timestamp := public.to_local(p_start);
  v_hour int := extract(hour from v_local)::int;
begin
  if date_trunc('hour', v_local) <> v_local then
    raise exception 'SLOT_INVALID' using errcode = 'P0001';
  end if;
  if v_hour < p_turf.open_hour or v_hour + 1 > p_turf.close_hour then
    raise exception 'SLOT_CLOSED' using errcode = 'P0001';
  end if;
  if p_start <= now() then
    raise exception 'SLOT_PAST' using errcode = 'P0001';
  end if;
  if p_start > now() + p_horizon then
    raise exception 'SLOT_TOO_FAR' using errcode = 'P0001';
  end if;
end
$$;

-- Availability without identities. Expired holds are simply not returned.
create or replace function public.turf_slot_occupancy(
  p_turf_id uuid, p_from timestamptz, p_to timestamptz
) returns table (
  booking_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  status public.booking_status,
  kind public.booking_kind,
  hold_expires_at timestamptz,
  is_mine boolean
)
language sql stable security definer set search_path = public
as $$
  select
    case when b.user_id = auth.uid() then b.id end,
    lower(b.slot),
    upper(b.slot),
    b.status,
    b.kind,
    b.hold_expires_at,
    coalesce(b.user_id = auth.uid(), false)
  from public.bookings b
  where b.turf_id = p_turf_id
    and b.slot && tstzrange(p_from, p_to, '[)')
    and (b.status = 'confirmed' or (b.status = 'held' and b.hold_expires_at > now()))
  order by lower(b.slot)
$$;

-- Hold a one-hour slot for hold_ttl(). The EXCLUDE constraint is the only
-- arbiter: a concurrent loser fails with 23P01 (exclusion_violation).
create or replace function public.create_hold(p_turf_id uuid, p_start timestamptz)
returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_turf public.turfs;
  v_slot tstzrange;
  v_price int;
  v_row public.bookings;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  select * into v_turf from public.turfs where id = p_turf_id;
  if not found then
    raise exception 'TURF_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_slot_start(v_turf, p_start, interval '8 days');
  v_price := public.slot_price(p_turf_id, p_start);
  if v_price is null then
    raise exception 'SLOT_UNPRICED' using errcode = 'P0001';
  end if;
  v_slot := tstzrange(p_start, p_start + interval '1 hour', '[)');

  -- Expired holds read as free: reclaim any overlapping one.
  update public.bookings
     set status = 'cancelled', cancelled_at = now()
   where turf_id = p_turf_id and status = 'held'
     and hold_expires_at <= now() and slot && v_slot;

  -- One live hold per player: a new hold replaces the previous one.
  update public.bookings
     set status = 'cancelled', cancelled_at = now()
   where user_id = v_uid and status = 'held' and kind = 'booking';

  insert into public.bookings (turf_id, user_id, kind, slot, status, amount_paise, hold_expires_at)
  values (p_turf_id, v_uid, 'booking', v_slot, 'held', v_price, now() + public.hold_ttl())
  returning * into v_row;
  return v_row;
end
$$;

create or replace function public.release_hold(p_booking_id uuid) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_turf uuid;
begin
  update public.bookings
     set status = 'cancelled', cancelled_at = now()
   where id = p_booking_id and user_id = auth.uid() and status = 'held'
  returning turf_id into v_turf;
  if v_turf is null then
    raise exception 'HOLD_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_turf;
end
$$;

-- Service role: attach a gateway order to a live hold.
create or replace function public.set_booking_order(p_booking_id uuid, p_order_id text)
returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.bookings;
begin
  update public.bookings
     set rzp_order_id = p_order_id
   where id = p_booking_id and status = 'held' and hold_expires_at > now()
  returning * into v_row;
  if v_row.id is null then
    raise exception 'HOLD_EXPIRED' using errcode = 'P0001';
  end if;
  return v_row;
end
$$;

-- Service role, called only by the verified webhook. Idempotent.
create or replace function public.confirm_payment(
  p_order_id text, p_payment_id text, p_amount_paise int
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_booking public.bookings;
  v_share public.booking_shares;
begin
  select * into v_booking from public.bookings where rzp_order_id = p_order_id for update;
  if found then
    if v_booking.status = 'confirmed' or v_booking.confirmed_at is not null then
      return jsonb_build_object('result', 'already', 'booking_id', v_booking.id, 'turf_id', v_booking.turf_id);
    end if;
    if p_amount_paise <> v_booking.amount_paise then
      raise exception 'AMOUNT_MISMATCH' using errcode = 'P0001';
    end if;
    begin
      -- Also revives a hold that expired while the player was paying, if the slot is still free.
      update public.bookings
         set status = 'confirmed', confirmed_at = now(), hold_expires_at = null,
             cancelled_at = null, rzp_payment_id = p_payment_id
       where id = v_booking.id;
    exception when exclusion_violation then
      update public.bookings set rzp_payment_id = p_payment_id where id = v_booking.id;
      return jsonb_build_object(
        'result', 'needs_refund', 'booking_id', v_booking.id, 'turf_id', v_booking.turf_id,
        'amount_paise', v_booking.amount_paise
      );
    end;
    return jsonb_build_object('result', 'confirmed', 'booking_id', v_booking.id, 'turf_id', v_booking.turf_id);
  end if;

  select * into v_share from public.booking_shares where rzp_order_id = p_order_id for update;
  if found then
    if v_share.paid then
      return jsonb_build_object('result', 'already', 'booking_id', v_share.booking_id, 'token', v_share.token);
    end if;
    if p_amount_paise <> v_share.amount_paise then
      raise exception 'AMOUNT_MISMATCH' using errcode = 'P0001';
    end if;
    update public.booking_shares set paid = true, paid_at = now() where id = v_share.id;
    return jsonb_build_object('result', 'share_paid', 'booking_id', v_share.booking_id, 'token', v_share.token);
  end if;

  return jsonb_build_object('result', 'unknown_order');
end
$$;

create or replace function public.cancel_booking(p_booking_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_booking public.bookings;
  v_pct int;
  v_refund int;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or (v_booking.user_id is distinct from auth.uid() and not public.is_admin()) then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_booking.kind <> 'booking' or v_booking.status <> 'confirmed' then
    raise exception 'NOT_CANCELLABLE' using errcode = 'P0001';
  end if;
  if lower(v_booking.slot) <= now() then
    raise exception 'ALREADY_STARTED' using errcode = 'P0001';
  end if;
  v_pct := public.refund_percent(lower(v_booking.slot), now());
  v_refund := (v_booking.amount_paise * v_pct) / 100;
  update public.bookings
     set status = 'cancelled', cancelled_at = now(), refund_paise = v_refund
   where id = v_booking.id;
  delete from public.open_games where booking_id = v_booking.id;
  return jsonb_build_object(
    'booking_id', v_booking.id, 'turf_id', v_booking.turf_id, 'amount_paise', v_booking.amount_paise,
    'refund_percent', v_pct, 'refund_paise', v_refund, 'rzp_payment_id', v_booking.rzp_payment_id
  );
end
$$;

-- Service role: record the gateway refund id.
create or replace function public.set_refund_id(p_booking_id uuid, p_refund_id text) returns void
language sql security definer set search_path = public
as $$ update public.bookings set rzp_refund_id = p_refund_id where id = p_booking_id $$;

-- Split a confirmed booking into seats. Seat 1 is the organiser's, already paid.
create or replace function public.create_split(
  p_booking_id uuid, p_seats int, p_organiser_name text
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_booking public.bookings;
  v_token text;
  v_each int;
  v_rem int;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.user_id is distinct from auth.uid() then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_booking.kind <> 'booking' or v_booking.status <> 'confirmed' or lower(v_booking.slot) <= now() then
    raise exception 'NOT_SPLITTABLE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.booking_shares where booking_id = v_booking.id) then
    raise exception 'SPLIT_EXISTS' using errcode = 'P0001';
  end if;
  if p_seats < 2 or p_seats > 14 or v_booking.amount_paise < p_seats then
    raise exception 'SEATS_INVALID' using errcode = 'P0001';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');
  v_each := v_booking.amount_paise / p_seats;
  v_rem := v_booking.amount_paise - v_each * p_seats;

  insert into public.booking_shares (booking_id, token, seat, payer_name, amount_paise, paid, paid_at, claimed_at)
  values (
    v_booking.id, v_token, 1, coalesce(nullif(trim(p_organiser_name), ''), 'Organiser'),
    v_each + v_rem, true, now(), now()
  );
  insert into public.booking_shares (booking_id, token, seat, amount_paise)
  select v_booking.id, v_token, g, v_each from generate_series(2, p_seats) as g;
  return v_token;
end
$$;

-- Public view of a split, by link token. First names and amounts only.
create or replace function public.get_split(p_token text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'token', p_token,
    'booking_id', b.id,
    'turf_name', t.name,
    'turf_slug', t.slug,
    'format', t.format,
    'start_at', lower(b.slot),
    'end_at', upper(b.slot),
    'status', b.status,
    'total_paise', b.amount_paise,
    'is_organiser', coalesce(b.user_id = auth.uid(), false),
    'seats', (
      select jsonb_agg(jsonb_build_object(
        'seat', s.seat,
        'payer_name', s.payer_name,
        'amount_paise', s.amount_paise,
        'paid', s.paid,
        'pending', (not s.paid and s.rzp_order_id is not null and s.claimed_at > now() - interval '10 minutes')
      ) order by s.seat)
      from public.booking_shares s where s.token = p_token
    )
  )
  from public.booking_shares s0
  join public.bookings b on b.id = s0.booking_id
  join public.turfs t on t.id = b.turf_id
  where s0.token = p_token
  limit 1
$$;

-- Service role: reserve a seat for a payer while their payment is in flight.
create or replace function public.claim_share(
  p_token text, p_seat int, p_name text, p_order_id text
) returns public.booking_shares
language plpgsql security definer set search_path = public
as $$
declare
  v_share public.booking_shares;
  v_booking public.bookings;
begin
  select * into v_share from public.booking_shares where token = p_token and seat = p_seat for update;
  if not found then
    raise exception 'SHARE_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_booking from public.bookings where id = v_share.booking_id;
  if v_booking.status <> 'confirmed' or lower(v_booking.slot) <= now() then
    raise exception 'SPLIT_CLOSED' using errcode = 'P0001';
  end if;
  if v_share.paid then
    raise exception 'SEAT_PAID' using errcode = 'P0001';
  end if;
  if v_share.rzp_order_id is not null
     and v_share.claimed_at > now() - interval '10 minutes'
     and lower(coalesce(v_share.payer_name, '')) <> lower(trim(p_name)) then
    raise exception 'SEAT_PENDING' using errcode = 'P0001';
  end if;
  update public.booking_shares
     set payer_name = trim(p_name), rzp_order_id = p_order_id, claimed_at = now()
   where id = v_share.id
  returning * into v_share;
  return v_share;
end
$$;

create or replace function public.create_open_game(
  p_booking_id uuid, p_players_needed int, p_note text
) returns public.open_games
language plpgsql security definer set search_path = public
as $$
declare
  v_booking public.bookings;
  v_game public.open_games;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found or v_booking.user_id is distinct from auth.uid() then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_booking.kind <> 'booking' or v_booking.status <> 'confirmed' or lower(v_booking.slot) <= now() then
    raise exception 'NOT_OPENABLE' using errcode = 'P0001';
  end if;
  insert into public.open_games (booking_id, players_needed, note)
  values (v_booking.id, p_players_needed, coalesce(trim(p_note), ''))
  on conflict (booking_id) do update
    set players_needed = greatest(excluded.players_needed, public.open_games.joined),
        note = excluded.note
  returning * into v_game;
  return v_game;
end
$$;

create or replace function public.join_open_game(p_game_id uuid, p_display_name text)
returns public.open_games
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.open_games;
  v_booking public.bookings;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  select * into v_game from public.open_games where id = p_game_id for update;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_booking from public.bookings where id = v_game.booking_id;
  if v_booking.status <> 'confirmed' or lower(v_booking.slot) <= now() then
    raise exception 'GAME_CLOSED' using errcode = 'P0001';
  end if;
  if v_booking.user_id = v_uid then
    raise exception 'OWN_GAME' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.open_game_players where open_game_id = p_game_id and user_id = v_uid) then
    raise exception 'ALREADY_JOINED' using errcode = 'P0001';
  end if;
  if v_game.joined >= v_game.players_needed then
    raise exception 'GAME_FULL' using errcode = 'P0001';
  end if;
  insert into public.open_game_players (open_game_id, user_id, display_name)
  values (p_game_id, v_uid, coalesce(nullif(trim(p_display_name), ''), 'Player'));
  update public.open_games set joined = joined + 1 where id = p_game_id returning * into v_game;
  return v_game;
end
$$;

create or replace function public.leave_open_game(p_game_id uuid) returns public.open_games
language plpgsql security definer set search_path = public
as $$
declare
  v_game public.open_games;
begin
  select * into v_game from public.open_games where id = p_game_id for update;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0002';
  end if;
  delete from public.open_game_players where open_game_id = p_game_id and user_id = auth.uid();
  if not found then
    raise exception 'NOT_JOINED' using errcode = 'P0001';
  end if;
  update public.open_games set joined = joined - 1 where id = p_game_id returning * into v_game;
  return v_game;
end
$$;

-- Public board of upcoming open games.
create or replace function public.open_games_board() returns table (
  id uuid,
  booking_id uuid,
  turf_id uuid,
  turf_name text,
  turf_slug text,
  format public.turf_format,
  start_at timestamptz,
  end_at timestamptz,
  players_needed int,
  joined int,
  note text,
  organiser_name text,
  is_mine boolean,
  joined_by_me boolean
)
language sql stable security definer set search_path = public
as $$
  select
    g.id, b.id, t.id, t.name, t.slug, t.format, lower(b.slot), upper(b.slot),
    g.players_needed, g.joined, g.note,
    coalesce(split_part(nullif(trim(p.full_name), ''), ' ', 1), split_part(p.email, '@', 1), 'Organiser'),
    coalesce(b.user_id = auth.uid(), false),
    exists (select 1 from public.open_game_players op where op.open_game_id = g.id and op.user_id = auth.uid())
  from public.open_games g
  join public.bookings b on b.id = g.booking_id
  join public.turfs t on t.id = b.turf_id
  left join public.profiles p on p.id = b.user_id
  where b.status = 'confirmed' and lower(b.slot) > now()
  order by lower(b.slot)
$$;

-- Admin: block a slot. Same EXCLUDE constraint, so a booked slot can't be blocked.
create or replace function public.admin_block_slot(p_turf_id uuid, p_start timestamptz, p_note text)
returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_turf public.turfs;
  v_slot tstzrange;
  v_row public.bookings;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_turf from public.turfs where id = p_turf_id;
  if not found then
    raise exception 'TURF_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_slot_start(v_turf, p_start, interval '90 days');
  v_slot := tstzrange(p_start, p_start + interval '1 hour', '[)');
  update public.bookings
     set status = 'cancelled', cancelled_at = now()
   where turf_id = p_turf_id and status = 'held'
     and hold_expires_at <= now() and slot && v_slot;
  insert into public.bookings (turf_id, user_id, kind, slot, status, amount_paise, note, confirmed_at)
  values (p_turf_id, auth.uid(), 'block', v_slot, 'confirmed', 0,
          coalesce(nullif(trim(p_note), ''), 'Blocked'), now())
  returning * into v_row;
  return v_row;
end
$$;

create or replace function public.admin_unblock(p_booking_id uuid) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_turf uuid;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.bookings
     set status = 'cancelled', cancelled_at = now()
   where id = p_booking_id and kind = 'block' and status = 'confirmed'
  returning turf_id into v_turf;
  if v_turf is null then
    raise exception 'BLOCK_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_turf;
end
$$;

-- Service role: the cleanup job. Returns the turfs whose grids changed.
create or replace function public.release_expired_holds() returns table (turf_id uuid)
language sql security definer set search_path = public
as $$
  with released as (
    update public.bookings
       set status = 'cancelled', cancelled_at = now()
     where status = 'held' and hold_expires_at <= now()
    returning bookings.turf_id
  )
  select distinct released.turf_id from released
$$;

-- Service role: upsert a profile at sign-in, optionally granting admin.
create or replace function public.ensure_profile(
  p_user_id uuid, p_email text, p_name text, p_admin boolean
) returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.profiles;
begin
  insert into public.profiles (id, email, full_name, role)
  values (p_user_id, p_email, nullif(trim(p_name), ''), case when p_admin then 'admin'::public.user_role else 'user' end)
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        role = case when p_admin then 'admin'::public.user_role else public.profiles.role end
  returning * into v_row;
  return v_row;
end
$$;

-- Lock trusted functions away from API roles.
revoke execute on function public.set_booking_order(uuid, text) from public, anon, authenticated;
revoke execute on function public.confirm_payment(text, text, int) from public, anon, authenticated;
revoke execute on function public.set_refund_id(uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_share(text, int, text, text) from public, anon, authenticated;
revoke execute on function public.release_expired_holds() from public, anon, authenticated;
revoke execute on function public.ensure_profile(uuid, text, text, boolean) from public, anon, authenticated;
