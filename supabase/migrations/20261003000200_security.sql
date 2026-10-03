-- Row level security on every table. Writes to bookings, shares and games
-- happen only through the security-definer functions in the next migration.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

alter table public.profiles enable row level security;
alter table public.turfs enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_shares enable row level security;
alter table public.open_games enable row level security;
alter table public.open_game_players enable row level security;
alter table public.payment_events enable row level security;

-- profiles: yourself, or everyone if admin.
create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- turfs + pricing: public catalogue, admin-managed.
create policy turfs_select on public.turfs for select to anon, authenticated using (true);
create policy turfs_admin_write on public.turfs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy pricing_select on public.pricing_rules for select to anon, authenticated using (true);
create policy pricing_admin_write on public.pricing_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- bookings: only your own rows (admins see all). Availability is exposed
-- without identities through turf_slot_occupancy().
create policy bookings_select on public.bookings
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy shares_select on public.booking_shares
  for select to authenticated using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and (b.user_id = auth.uid() or public.is_admin())
    )
  );

create policy open_games_select on public.open_games for select to anon, authenticated using (true);
create policy open_game_players_select on public.open_game_players
  for select to authenticated using (true);

-- payment_events: no policies, so only the service role (bypassrls) can touch it.

-- New auth user -> profile row.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
