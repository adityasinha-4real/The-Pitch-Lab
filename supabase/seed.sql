-- Nutmeg Arena seed. Dates are relative to "today" in arena time (IST),
-- so the grid always has a realistic mix of booked, held and blocked slots.

create or replace function pg_temp.at_local(p_day int, p_hour int) returns timestamptz
language sql stable
as $$
  select (date_trunc('day', now() at time zone interval '+05:30')
          + make_interval(days => p_day, hours => p_hour)) at time zone interval '+05:30'
$$;

-- Players and the arena desk.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@nutmeg.arena', now(), '{"full_name": "Arena Desk"}'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kabir@nutmeg.arena', now(), '{"full_name": "Kabir Mehta"}'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'meera@nutmeg.arena', now(), '{"full_name": "Meera Iyer"}'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rohan@nutmeg.arena', now(), '{"full_name": "Rohan Das"}')
on conflict (id) do nothing;

update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000001';

insert into public.turfs (id, slug, name, format, surface, tagline, description, amenities, images, open_hour, close_hour) values
  ('10000000-0000-4000-8000-000000000001', 'nutmeg-box', 'The Nutmeg Box', '5s', '50 mm FIFA Quality artificial grass',
   'Tight box, quick feet. Our flagship five-a-side cage.',
   'A fully netted five-a-side box under eight LED floodlights. Shock-pad underlay, rebound boards on all sides and a scoreboard you can actually read from the far post.',
   array['LED floodlights', 'Changing rooms', 'Bibs & balls', 'Drinking water', 'Parking'],
   array['/turfs/nutmeg-box.svg'], 6, 24),
  ('10000000-0000-4000-8000-000000000002', 'rabona-ridge', 'Rabona Ridge', '7s', 'Hybrid grass with shock pad',
   'Room to switch play. Seven-a-side on the ridge.',
   'Our largest pitch: a seven-a-side hybrid surface with proper wing space, full-size goals and a raised spectator deck for the bench.',
   array['LED floodlights', 'Spectator deck', 'Changing rooms', 'First aid', 'Parking'],
   array['/turfs/rabona-ridge.svg'], 6, 24),
  ('10000000-0000-4000-8000-000000000003', 'panenka-yard', 'Panenka Yard', '5s', '40 mm rooftop turf',
   'Rooftop five-a-side with a skyline view.',
   'A rooftop cage with a breeze, a skyline and a surface that rewards a cheeky chip. Closes at 11 PM for the neighbours.',
   array['Rooftop', 'LED floodlights', 'Bibs & balls', 'Drinking water'],
   array['/turfs/panenka-yard.svg'], 7, 23)
on conflict (id) do nothing;

-- dow: 0 = Sunday … 6 = Saturday. Peak 18:00–23:00 overrides the base rate.
insert into public.pricing_rules (turf_id, label, dow, start_time, end_time, price_paise)
select v.turf_id::uuid, v.label, v.dow::int[], v.start_time::time, v.end_time::time, v.price_paise from (values
  ('10000000-0000-4000-8000-000000000001', 'Weekday',      '{1,2,3,4,5}', '06:00', '24:00', 120000),
  ('10000000-0000-4000-8000-000000000001', 'Weekend',      '{0,6}',       '06:00', '24:00', 150000),
  ('10000000-0000-4000-8000-000000000001', 'Weekday peak', '{1,2,3,4,5}', '18:00', '23:00', 180000),
  ('10000000-0000-4000-8000-000000000001', 'Weekend peak', '{0,6}',       '18:00', '23:00', 220000),
  ('10000000-0000-4000-8000-000000000002', 'Weekday',      '{1,2,3,4,5}', '06:00', '24:00', 200000),
  ('10000000-0000-4000-8000-000000000002', 'Weekend',      '{0,6}',       '06:00', '24:00', 240000),
  ('10000000-0000-4000-8000-000000000002', 'Weekday peak', '{1,2,3,4,5}', '18:00', '23:00', 280000),
  ('10000000-0000-4000-8000-000000000002', 'Weekend peak', '{0,6}',       '18:00', '23:00', 320000),
  ('10000000-0000-4000-8000-000000000003', 'Weekday',      '{1,2,3,4,5}', '07:00', '23:00', 100000),
  ('10000000-0000-4000-8000-000000000003', 'Weekend',      '{0,6}',       '07:00', '23:00', 130000),
  ('10000000-0000-4000-8000-000000000003', 'Weekday peak', '{1,2,3,4,5}', '18:00', '23:00', 160000),
  ('10000000-0000-4000-8000-000000000003', 'Weekend peak', '{0,6}',       '18:00', '23:00', 190000)
) as v(turf_id, label, dow, start_time, end_time, price_paise)
where not exists (select 1 from public.pricing_rules);

-- Sample bookings.
with s(id, turf_id, user_id, kind, day, hour, status, note) as (
  values
    ('20000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000002'::uuid, 'booking', 1, 19, 'confirmed', null),
    ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'booking', 1, 20, 'confirmed', null),
    ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'booking', 2, 18, 'confirmed', null),
    ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'booking', 3, 21, 'confirmed', null),
    ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'booking', -1, 19, 'confirmed', null),
    ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'block', 4, 7, 'confirmed', 'Pitch maintenance'),
    ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', 'booking', 1, 20, 'confirmed', null),
    ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'booking', 2, 19, 'confirmed', null),
    ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'booking', 5, 18, 'confirmed', null),
    ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'block', 2, 6, 'confirmed', 'Academy session'),
    ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'booking', 1, 18, 'confirmed', null),
    ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', 'booking', 3, 20, 'cancelled', null),
    ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'booking', 2, 21, 'held', null),
    ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'booking', -2, 20, 'confirmed', null),
    ('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'booking', -3, 19, 'confirmed', null)
)
insert into public.bookings (
  id, turf_id, user_id, kind, slot, status, amount_paise, hold_expires_at,
  rzp_order_id, rzp_payment_id, refund_paise, note, confirmed_at, cancelled_at
)
select
  s.id, s.turf_id, s.user_id, s.kind::public.booking_kind,
  tstzrange(pg_temp.at_local(s.day, s.hour), pg_temp.at_local(s.day, s.hour + 1), '[)'),
  s.status::public.booking_status,
  case when s.kind = 'block' then 0 else coalesce(public.slot_price(s.turf_id, pg_temp.at_local(s.day, s.hour)), 0) end,
  case when s.status = 'held' then now() + public.hold_ttl() end,
  case when s.kind = 'booking' and s.status <> 'held' then 'order_seed_' || right(s.id::text, 4) end,
  case when s.kind = 'booking' and s.status <> 'held' then 'pay_seed_' || right(s.id::text, 4) end,
  case when s.status = 'cancelled' then coalesce(public.slot_price(s.turf_id, pg_temp.at_local(s.day, s.hour)), 0) end,
  s.note,
  case when s.status <> 'held' then now() - interval '2 days' end,
  case when s.status = 'cancelled' then now() - interval '1 day' end
from s
on conflict (id) do nothing;

-- Kabir is splitting tomorrow's 7 PM game five ways; two friends have paid.
insert into public.booking_shares (booking_id, token, seat, payer_name, amount_paise, paid, paid_at, claimed_at)
select b.id, 'seedsplitkabir0000000000000000001', g.seat,
       case g.seat when 1 then 'Kabir' when 2 then 'Aarav' when 3 then 'Ishaan' end,
       case when g.seat = 1 then b.amount_paise - (b.amount_paise / 5) * 4 else b.amount_paise / 5 end,
       g.seat <= 3,
       case when g.seat <= 3 then now() - interval '1 day' end,
       case when g.seat <= 3 then now() - interval '1 day' end
from public.bookings b
cross join generate_series(1, 5) as g(seat)
where b.id = '20000000-0000-4000-8000-000000000001'
on conflict (booking_id, seat) do nothing;

-- Open games looking for players.
insert into public.open_games (id, booking_id, players_needed, joined, note) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 3, 0, 'Friendly pace, bring a dark and a light shirt.'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000007', 4, 1, 'Need a keeper and three outfield. Competitive.')
on conflict (id) do nothing;

insert into public.open_game_players (open_game_id, user_id, display_name) values
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'Meera')
on conflict do nothing;
