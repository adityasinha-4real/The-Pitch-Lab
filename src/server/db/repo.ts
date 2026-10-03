import type { Occupancy } from "@/domain/slots";
import type { PricingRuleLike } from "@/domain/pricing";
import { asService, asSystem, asUser, type Actor } from "./client";
import type { Row, SqlRunner } from "./sql";

/**
 * The only place SQL lives in TypeScript. Every user-facing call runs under
 * RLS as that user (asUser); trusted paths use asService.
 */

export type TurfFormat = "5s" | "7s";
export type BookingStatus = "held" | "confirmed" | "cancelled";
export type BookingKind = "booking" | "block";

export type Turf = {
  id: string;
  slug: string;
  name: string;
  format: TurfFormat;
  surface: string;
  tagline: string;
  description: string;
  amenities: string[];
  images: string[];
  openHour: number;
  closeHour: number;
};

export type PricingRule = PricingRuleLike & { id: string; turfId: string; label: string };

export type Booking = {
  id: string;
  turfId: string;
  userId: string | null;
  kind: BookingKind;
  status: BookingStatus;
  startAt: Date;
  endAt: Date;
  amountPaise: number;
  holdExpiresAt: Date | null;
  rzpOrderId: string | null;
  rzpPaymentId: string | null;
  refundPaise: number | null;
  note: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
};

export type BookingWithTurf = Booking & {
  turf: Pick<Turf, "id" | "slug" | "name" | "format" | "surface" | "images">;
  split: { token: string; seats: number; paidSeats: number; paidPaise: number } | null;
  openGame: { id: string; playersNeeded: number; joined: number; note: string } | null;
};

export type Profile = { id: string; role: "user" | "admin"; email: string | null; fullName: string | null };

const BOOKING_COLS = `b.id, b.turf_id, b.user_id, b.kind, b.status, lower(b.slot) as start_at, upper(b.slot) as end_at,
  b.amount_paise, b.hold_expires_at, b.rzp_order_id, b.rzp_payment_id, b.refund_paise, b.note,
  b.created_at, b.confirmed_at, b.cancelled_at`;

const str = (v: unknown) => v as string;
const strOrNull = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) => Number(v);
const date = (v: unknown) => (v instanceof Date ? v : new Date(String(v)));
const dateOrNull = (v: unknown) => (v === null || v === undefined ? null : date(v));
const hhmm = (v: unknown) => String(v).slice(0, 5);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function toTurf(r: Row): Turf {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name: str(r.name),
    format: r.format as TurfFormat,
    surface: str(r.surface),
    tagline: str(r.tagline),
    description: str(r.description),
    amenities: arr<string>(r.amenities),
    images: arr<string>(r.images),
    openHour: num(r.open_hour),
    closeHour: num(r.close_hour),
  };
}

function toRule(r: Row): PricingRule {
  return {
    id: str(r.id),
    turfId: str(r.turf_id),
    label: str(r.label),
    dow: arr<number>(r.dow).map(Number),
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    pricePaise: num(r.price_paise),
  };
}

function toBooking(r: Row): Booking {
  return {
    id: str(r.id),
    turfId: str(r.turf_id),
    userId: strOrNull(r.user_id),
    kind: r.kind as BookingKind,
    status: r.status as BookingStatus,
    startAt: date(r.start_at),
    endAt: date(r.end_at),
    amountPaise: num(r.amount_paise),
    holdExpiresAt: dateOrNull(r.hold_expires_at),
    rzpOrderId: strOrNull(r.rzp_order_id),
    rzpPaymentId: strOrNull(r.rzp_payment_id),
    refundPaise: r.refund_paise === null || r.refund_paise === undefined ? null : num(r.refund_paise),
    note: strOrNull(r.note),
    createdAt: date(r.created_at),
    confirmedAt: dateOrNull(r.confirmed_at),
    cancelledAt: dateOrNull(r.cancelled_at),
  };
}

/** Function results returning a composite row come back with plain column names. */
async function bookingById(tx: SqlRunner, id: string): Promise<Booking | null> {
  const rows = await tx.query(`select ${BOOKING_COLS} from public.bookings b where b.id = $1`, [id]);
  return rows[0] ? toBooking(rows[0]) : null;
}

// ---------------------------------------------------------------- catalogue

export async function listTurfs(): Promise<Array<Turf & { rules: PricingRule[] }>> {
  return asUser(null, async (tx) => {
    const turfs = (await tx.query("select * from public.turfs order by format, name")).map(toTurf);
    const rules = (await tx.query("select * from public.pricing_rules order by start_time, label")).map(toRule);
    return turfs.map((t) => ({ ...t, rules: rules.filter((r) => r.turfId === t.id) }));
  });
}

export async function getTurfBySlug(slug: string): Promise<(Turf & { rules: PricingRule[] }) | null> {
  return asUser(null, async (tx) => {
    const row = (await tx.query("select * from public.turfs where slug = $1", [slug]))[0];
    if (!row) return null;
    const turf = toTurf(row);
    const rules = (
      await tx.query("select * from public.pricing_rules where turf_id = $1 order by start_time, label", [turf.id])
    ).map(toRule);
    return { ...turf, rules };
  });
}

export async function getTurfById(id: string): Promise<(Turf & { rules: PricingRule[] }) | null> {
  return asUser(null, async (tx) => {
    const row = (await tx.query("select * from public.turfs where id = $1", [id]))[0];
    if (!row) return null;
    const rules = (await tx.query("select * from public.pricing_rules where turf_id = $1", [id])).map(toRule);
    return { ...toTurf(row), rules };
  });
}

export async function getOccupancy(actor: Actor, turfId: string, from: Date, to: Date): Promise<Occupancy[]> {
  return asUser(actor, async (tx) => {
    const rows = await tx.query("select * from public.turf_slot_occupancy($1, $2, $3)", [turfId, from, to]);
    return rows.map((r) => ({
      bookingId: strOrNull(r.booking_id),
      startAt: date(r.start_at),
      endAt: date(r.end_at),
      status: r.status as Occupancy["status"],
      kind: r.kind as Occupancy["kind"],
      holdExpiresAt: dateOrNull(r.hold_expires_at),
      isMine: Boolean(r.is_mine),
    }));
  });
}

// ------------------------------------------------------------------ holds

export async function createHold(actor: Actor, turfId: string, start: Date): Promise<Booking> {
  return asUser(actor, async (tx) => {
    const row = (await tx.query<{ id: string }>("select (public.create_hold($1, $2)).id as id", [turfId, start]))[0]!;
    return (await bookingById(tx, row.id))!;
  });
}

export async function releaseHold(actor: Actor, bookingId: string): Promise<string> {
  return asUser(actor, async (tx) => {
    const row = (await tx.query<{ turf_id: string }>("select public.release_hold($1) as turf_id", [bookingId]))[0]!;
    return row.turf_id;
  });
}

export async function releaseExpiredHolds(): Promise<string[]> {
  return asService(async (tx) =>
    (await tx.query<{ turf_id: string }>("select turf_id from public.release_expired_holds()")).map((r) => r.turf_id),
  );
}

// --------------------------------------------------------------- bookings

export async function getBooking(actor: Actor, id: string): Promise<BookingWithTurf | null> {
  return asUser(actor, async (tx) => (await bookingsWithTurf(tx, "b.id = $1", [id]))[0] ?? null);
}

export async function listMyBookings(actor: Actor): Promise<BookingWithTurf[]> {
  if (!actor) return [];
  return asUser(actor, (tx) =>
    bookingsWithTurf(tx, "b.user_id = auth.uid() and b.kind = 'booking' and (b.status <> 'held' or b.hold_expires_at > now())", []),
  );
}

async function bookingsWithTurf(tx: SqlRunner, where: string, params: unknown[]): Promise<BookingWithTurf[]> {
  const rows = await tx.query(
    `select ${BOOKING_COLS},
            t.slug as t_slug, t.name as t_name, t.format as t_format, t.surface as t_surface, t.images as t_images,
            sp.token as sp_token, sp.seats as sp_seats, sp.paid_seats as sp_paid_seats, sp.paid_paise as sp_paid_paise,
            g.id as g_id, g.players_needed as g_needed, g.joined as g_joined, g.note as g_note
       from public.bookings b
       join public.turfs t on t.id = b.turf_id
       left join lateral (
         select min(s.token) as token, count(*)::int as seats,
                count(*) filter (where s.paid)::int as paid_seats,
                coalesce(sum(s.amount_paise) filter (where s.paid), 0)::int as paid_paise
           from public.booking_shares s where s.booking_id = b.id
       ) sp on true
       left join public.open_games g on g.booking_id = b.id
      where ${where}
      order by lower(b.slot) desc`,
    params,
  );
  return rows.map((r) => ({
    ...toBooking(r),
    turf: {
      id: str(r.turf_id),
      slug: str(r.t_slug),
      name: str(r.t_name),
      format: r.t_format as TurfFormat,
      surface: str(r.t_surface),
      images: arr<string>(r.t_images),
    },
    split: r.sp_token
      ? { token: str(r.sp_token), seats: num(r.sp_seats), paidSeats: num(r.sp_paid_seats), paidPaise: num(r.sp_paid_paise) }
      : null,
    openGame: r.g_id
      ? { id: str(r.g_id), playersNeeded: num(r.g_needed), joined: num(r.g_joined), note: str(r.g_note) }
      : null,
  }));
}

export async function attachOrder(bookingId: string, orderId: string): Promise<Booking> {
  return asService(async (tx) => {
    await tx.query("select public.set_booking_order($1, $2)", [bookingId, orderId]);
    return (await bookingById(tx, bookingId))!;
  });
}

export type ConfirmResult =
  | { result: "confirmed" | "already"; booking_id: string; turf_id?: string; token?: string }
  | { result: "needs_refund"; booking_id: string; turf_id: string; amount_paise: number }
  | { result: "share_paid"; booking_id: string; token: string }
  | { result: "unknown_order" };

export async function confirmPayment(orderId: string, paymentId: string, amountPaise: number): Promise<ConfirmResult> {
  return asService(async (tx) => {
    const row = (await tx.query<{ r: ConfirmResult }>("select public.confirm_payment($1, $2, $3) as r", [
      orderId,
      paymentId,
      amountPaise,
    ]))[0]!;
    return typeof row.r === "string" ? (JSON.parse(row.r) as ConfirmResult) : row.r;
  });
}

/** Returns false when this webhook event id was already processed. */
export async function recordPaymentEvent(
  eventId: string,
  eventType: string,
  orderId: string | null,
  payload: unknown,
): Promise<boolean> {
  return asService(async (tx) => {
    const rows = await tx.query(
      `insert into public.payment_events (event_id, event_type, order_id, payload)
       values ($1, $2, $3, $4::jsonb) on conflict (event_id) do nothing returning event_id`,
      [eventId, eventType, orderId, JSON.stringify(payload)],
    );
    return rows.length === 1;
  });
}

export type CancelResult = {
  booking_id: string;
  turf_id: string;
  amount_paise: number;
  refund_percent: number;
  refund_paise: number;
  rzp_payment_id: string | null;
};

export async function cancelBooking(actor: Actor, bookingId: string): Promise<CancelResult> {
  return asUser(actor, async (tx) => {
    const row = (await tx.query<{ r: CancelResult }>("select public.cancel_booking($1) as r", [bookingId]))[0]!;
    return typeof row.r === "string" ? (JSON.parse(row.r) as CancelResult) : row.r;
  });
}

export async function setRefundId(bookingId: string, refundId: string): Promise<void> {
  await asService((tx) => tx.query("select public.set_refund_id($1, $2)", [bookingId, refundId]));
}

export async function getBookingStatus(actor: Actor, id: string): Promise<{ status: BookingStatus; turfId: string } | null> {
  return asUser(actor, async (tx) => {
    const r = (await tx.query("select status, turf_id from public.bookings where id = $1", [id]))[0];
    return r ? { status: r.status as BookingStatus, turfId: str(r.turf_id) } : null;
  });
}

// ------------------------------------------------------------------ split

export type SplitSeat = { seat: number; payerName: string | null; amountPaise: number; paid: boolean; pending: boolean };
export type Split = {
  token: string;
  bookingId: string;
  turfName: string;
  turfSlug: string;
  format: TurfFormat;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
  totalPaise: number;
  isOrganiser: boolean;
  seats: SplitSeat[];
};

export async function createSplit(actor: Actor, bookingId: string, seats: number, organiserName: string): Promise<string> {
  return asUser(actor, async (tx) => {
    const row = (await tx.query<{ token: string }>("select public.create_split($1, $2, $3) as token", [
      bookingId,
      seats,
      organiserName,
    ]))[0]!;
    return row.token;
  });
}

export async function getSplit(actor: Actor, token: string): Promise<Split | null> {
  return asUser(actor, async (tx) => {
    const raw = (await tx.query<{ s: unknown }>("select public.get_split($1) as s", [token]))[0]?.s;
    if (!raw) return null;
    const s = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
    return {
      token: str(s.token),
      bookingId: str(s.booking_id),
      turfName: str(s.turf_name),
      turfSlug: str(s.turf_slug),
      format: s.format as TurfFormat,
      startAt: date(s.start_at),
      endAt: date(s.end_at),
      status: s.status as BookingStatus,
      totalPaise: num(s.total_paise),
      isOrganiser: Boolean(s.is_organiser),
      seats: arr<Record<string, unknown>>(s.seats).map((x) => ({
        seat: num(x.seat),
        payerName: strOrNull(x.payer_name),
        amountPaise: num(x.amount_paise),
        paid: Boolean(x.paid),
        pending: Boolean(x.pending),
      })),
    };
  });
}

export async function claimShare(
  token: string,
  seat: number,
  name: string,
  orderId: string,
): Promise<{ id: string; amountPaise: number; bookingId: string }> {
  return asService(async (tx) => {
    const r = (
      await tx.query("select (s).id, (s).amount_paise, (s).booking_id from public.claim_share($1, $2, $3, $4) s", [
        token,
        seat,
        name,
        orderId,
      ])
    )[0]!;
    return { id: str(r.id), amountPaise: num(r.amount_paise), bookingId: str(r.booking_id) };
  });
}

export async function getShareAmount(token: string, seat: number): Promise<number | null> {
  return asService(async (tx) => {
    const r = (await tx.query("select amount_paise from public.booking_shares where token = $1 and seat = $2", [token, seat]))[0];
    return r ? num(r.amount_paise) : null;
  });
}

// ------------------------------------------------------------- open games

export type OpenGame = {
  id: string;
  bookingId: string;
  turfId: string;
  turfName: string;
  turfSlug: string;
  format: TurfFormat;
  startAt: Date;
  endAt: Date;
  playersNeeded: number;
  joined: number;
  note: string;
  organiserName: string;
  isMine: boolean;
  joinedByMe: boolean;
};

export async function listOpenGames(actor: Actor): Promise<OpenGame[]> {
  return asUser(actor, async (tx) =>
    (await tx.query("select * from public.open_games_board()")).map((r) => ({
      id: str(r.id),
      bookingId: str(r.booking_id),
      turfId: str(r.turf_id),
      turfName: str(r.turf_name),
      turfSlug: str(r.turf_slug),
      format: r.format as TurfFormat,
      startAt: date(r.start_at),
      endAt: date(r.end_at),
      playersNeeded: num(r.players_needed),
      joined: num(r.joined),
      note: str(r.note),
      organiserName: str(r.organiser_name),
      isMine: Boolean(r.is_mine),
      joinedByMe: Boolean(r.joined_by_me),
    })),
  );
}

export async function createOpenGame(actor: Actor, bookingId: string, playersNeeded: number, note: string): Promise<string> {
  return asUser(actor, async (tx) => {
    const r = (await tx.query<{ id: string }>("select (public.create_open_game($1, $2, $3)).id as id", [
      bookingId,
      playersNeeded,
      note,
    ]))[0]!;
    return r.id;
  });
}

export async function joinOpenGame(actor: Actor, gameId: string, displayName: string): Promise<{ joined: number; playersNeeded: number }> {
  return asUser(actor, async (tx) => {
    const r = (await tx.query("select (g).joined, (g).players_needed from public.join_open_game($1, $2) g", [gameId, displayName]))[0]!;
    return { joined: num(r.joined), playersNeeded: num(r.players_needed) };
  });
}

export async function leaveOpenGame(actor: Actor, gameId: string): Promise<void> {
  await asUser(actor, (tx) => tx.query("select public.leave_open_game($1)", [gameId]));
}

// ---------------------------------------------------------------- profiles

export async function ensureProfile(user: { id: string; email: string; name: string | null }, admin: boolean): Promise<Profile> {
  return asService(async (tx) => {
    const r = (
      await tx.query("select (p).id, (p).role, (p).email, (p).full_name from public.ensure_profile($1, $2, $3, $4) p", [
        user.id,
        user.email,
        user.name ?? "",
        admin,
      ])
    )[0]!;
    return { id: str(r.id), role: r.role as Profile["role"], email: strOrNull(r.email), fullName: strOrNull(r.full_name) };
  });
}

export async function getProfile(userId: string): Promise<Profile | null> {
  return asService(async (tx) => {
    const r = (await tx.query("select id, role, email, full_name from public.profiles where id = $1", [userId]))[0];
    return r ? { id: str(r.id), role: r.role as Profile["role"], email: strOrNull(r.email), fullName: strOrNull(r.full_name) } : null;
  });
}

/** Local auth adapter only: find or create an auth.users row (DECISIONS D12). */
export async function upsertLocalAuthUser(email: string, name: string | null): Promise<{ id: string; email: string; name: string | null }> {
  return asSystem(async (tx) => {
    const r = (
      await tx.query(
        `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
         values ($1, now(), jsonb_build_object('full_name', $2::text))
         on conflict (email) do update set email = excluded.email
         returning id, email, raw_user_meta_data ->> 'full_name' as name`,
        [email, name],
      )
    )[0]!;
    return { id: str(r.id), email: str(r.email), name: strOrNull(r.name) };
  });
}

// ------------------------------------------------------------------- admin

export async function adminBlockSlot(actor: Actor, turfId: string, start: Date, note: string): Promise<Booking> {
  return asUser(actor, async (tx) => {
    const r = (await tx.query<{ id: string }>("select (public.admin_block_slot($1, $2, $3)).id as id", [turfId, start, note]))[0]!;
    return (await bookingById(tx, r.id))!;
  });
}

export async function adminUnblock(actor: Actor, bookingId: string): Promise<string> {
  return asUser(actor, async (tx) => {
    const r = (await tx.query<{ turf_id: string }>("select public.admin_unblock($1) as turf_id", [bookingId]))[0]!;
    return r.turf_id;
  });
}

export type AdminBookingRow = Booking & { turfName: string; turfSlug: string; email: string | null; playerName: string | null };

export async function adminListBookings(
  actor: Actor,
  filter: { turfId?: string; status?: BookingStatus; kind?: BookingKind; from?: Date; to?: Date; limit?: number },
): Promise<AdminBookingRow[]> {
  return asUser(actor, async (tx) => {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, v: unknown) => {
      params.push(v);
      where.push(clause.replace("?", `$${params.length}`));
    };
    if (filter.turfId) add("b.turf_id = ?", filter.turfId);
    if (filter.status) add("b.status = ?::public.booking_status", filter.status);
    if (filter.kind) add("b.kind = ?::public.booking_kind", filter.kind);
    if (filter.from) add("upper(b.slot) > ?", filter.from);
    if (filter.to) add("lower(b.slot) < ?", filter.to);
    params.push(filter.limit ?? 200);
    const rows = await tx.query(
      `select ${BOOKING_COLS}, t.name as turf_name, t.slug as turf_slug, p.email, p.full_name
         from public.bookings b
         join public.turfs t on t.id = b.turf_id
         left join public.profiles p on p.id = b.user_id
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by lower(b.slot) desc
        limit $${params.length}`,
      params,
    );
    return rows.map((r) => ({
      ...toBooking(r),
      turfName: str(r.turf_name),
      turfSlug: str(r.turf_slug),
      email: strOrNull(r.email),
      playerName: strOrNull(r.full_name),
    }));
  });
}

export type HeatCell = { dow: number; hour: number; booked: number; slots: number };

/** Confirmed bookings by local weekday × hour over [from, to). `slots` = how many such hours existed. */
export async function adminOccupancyHeatmap(actor: Actor, from: Date, to: Date, turfId?: string): Promise<HeatCell[]> {
  return asUser(actor, async (tx) => {
    const rows = await tx.query(
      `with hours as (
         select t.id as turf_id, gs as start_at
           from public.turfs t
           cross join generate_series($1::timestamptz, $2::timestamptz - interval '1 hour', interval '1 hour') gs
          where ($3::uuid is null or t.id = $3::uuid)
            and extract(hour from public.to_local(gs)) >= t.open_hour
            and extract(hour from public.to_local(gs)) < t.close_hour
       )
       select extract(dow from public.to_local(h.start_at))::int as dow,
              extract(hour from public.to_local(h.start_at))::int as hour,
              count(*)::int as slots,
              count(b.id)::int as booked
         from hours h
         left join public.bookings b
           on b.turf_id = h.turf_id and b.kind = 'booking' and b.status = 'confirmed'
          and lower(b.slot) = h.start_at
        group by 1, 2
        order by 1, 2`,
      [from, to, turfId ?? null],
    );
    return rows.map((r) => ({ dow: num(r.dow), hour: num(r.hour), booked: num(r.booked), slots: num(r.slots) }));
  });
}

export async function adminStats(actor: Actor, from: Date, to: Date) {
  return asUser(actor, async (tx) => {
    const r = (
      await tx.query(
        `select
           count(*) filter (where kind = 'booking' and status = 'confirmed')::int as confirmed,
           coalesce(sum(amount_paise) filter (where kind = 'booking' and status = 'confirmed'), 0)::int as revenue,
           count(*) filter (where kind = 'booking' and status = 'cancelled' and confirmed_at is not null)::int as cancelled,
           coalesce(sum(refund_paise) filter (where kind = 'booking' and status = 'cancelled'), 0)::int as refunded,
           count(*) filter (where kind = 'block' and status = 'confirmed')::int as blocks,
           count(*) filter (where status = 'held' and hold_expires_at > now())::int as live_holds
         from public.bookings
        where lower(slot) >= $1 and lower(slot) < $2`,
        [from, to],
      )
    )[0]!;
    return {
      confirmed: num(r.confirmed),
      revenuePaise: num(r.revenue),
      cancelled: num(r.cancelled),
      refundedPaise: num(r.refunded),
      blocks: num(r.blocks),
      liveHolds: num(r.live_holds),
    };
  });
}

export type RuleInput = { label: string; dow: number[]; startTime: string; endTime: string; pricePaise: number };

export async function adminUpsertRule(actor: Actor, turfId: string, rule: RuleInput & { id?: string }): Promise<PricingRule> {
  return asUser(actor, async (tx) => {
    const params = [rule.label, `{${rule.dow.join(",")}}`, rule.startTime, rule.endTime, rule.pricePaise];
    const rows = rule.id
      ? await tx.query(
          `update public.pricing_rules set label = $1, dow = $2::int[], start_time = $3::time, end_time = $4::time, price_paise = $5
            where id = $6 and turf_id = $7 returning *`,
          [...params, rule.id, turfId],
        )
      : await tx.query(
          `insert into public.pricing_rules (label, dow, start_time, end_time, price_paise, turf_id)
           values ($1, $2::int[], $3::time, $4::time, $5, $6) returning *`,
          [...params, turfId],
        );
    if (!rows[0]) throw Object.assign(new Error("FORBIDDEN"), { code: "42501" });
    return toRule(rows[0]);
  });
}

export async function adminDeleteRule(actor: Actor, ruleId: string): Promise<void> {
  await asUser(actor, async (tx) => {
    const rows = await tx.query("delete from public.pricing_rules where id = $1 returning id", [ruleId]);
    if (!rows[0]) throw Object.assign(new Error("FORBIDDEN"), { code: "42501" });
  });
}

// ------------------------------------------------------------- test hooks

/** DECISIONS D13: back-date live holds so expiry can be tested without waiting. */
export async function testExpireHolds(bookingId?: string): Promise<string[]> {
  return asSystem(async (tx) =>
    (
      await tx.query<{ turf_id: string }>(
        `update public.bookings set hold_expires_at = now() - interval '1 second'
          where status = 'held' and ($1::uuid is null or id = $1::uuid) returning turf_id`,
        [bookingId ?? null],
      )
    ).map((r) => r.turf_id),
  );
}
