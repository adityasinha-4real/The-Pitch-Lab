"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/domain/errors";
import { validateRule } from "@/domain/pricing";
import { actorOf, getSessionUser } from "@/server/auth";
import { toFailure } from "@/server/actions";
import * as repo from "@/server/db/repo";
import { channels, publish } from "@/server/realtime/bus";

async function admin() {
  const user = await getSessionUser();
  return user?.role === "admin" ? user : null;
}

const blockSchema = z.object({ turfId: z.uuid(), startAt: z.iso.datetime(), note: z.string().trim().max(80) });

export async function blockSlotAction(input: { turfId: string; startAt: string; note: string }): Promise<ActionResult> {
  const user = await admin();
  if (!user) return fail("FORBIDDEN");
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  try {
    await repo.adminBlockSlot(actorOf(user), parsed.data.turfId, new Date(parsed.data.startAt), parsed.data.note);
    await publish(channels.turf(parsed.data.turfId));
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function unblockSlotAction(bookingId: string): Promise<ActionResult> {
  const user = await admin();
  if (!user) return fail("FORBIDDEN");
  if (!z.uuid().safeParse(bookingId).success) return fail("INVALID_INPUT");
  try {
    const turfId = await repo.adminUnblock(actorOf(user), bookingId);
    await publish(channels.turf(turfId));
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return toFailure(err);
  }
}

const ruleSchema = z.object({
  turfId: z.uuid(),
  id: z.uuid().optional(),
  label: z.string().trim().min(1).max(40),
  dow: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  pricePaise: z.number().int().positive().max(10_000_000),
});

export async function saveRuleAction(input: z.input<typeof ruleSchema>): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("FORBIDDEN");
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success || validateRule(parsed.data)) return fail("INVALID_INPUT");
  const { turfId, ...rule } = parsed.data;
  try {
    const saved = await repo.adminUpsertRule(actorOf(user), turfId, { ...rule, dow: [...new Set(rule.dow)].sort() });
    await publish(channels.turf(turfId));
    revalidatePath("/admin");
    return { ok: true, id: saved.id };
  } catch (err) {
    return toFailure(err);
  }
}

export async function deleteRuleAction(ruleId: string, turfId: string): Promise<ActionResult> {
  const user = await admin();
  if (!user) return fail("FORBIDDEN");
  if (!z.uuid().safeParse(ruleId).success || !z.uuid().safeParse(turfId).success) return fail("INVALID_INPUT");
  try {
    await repo.adminDeleteRule(actorOf(user), ruleId);
    await publish(channels.turf(turfId));
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return toFailure(err);
  }
}
