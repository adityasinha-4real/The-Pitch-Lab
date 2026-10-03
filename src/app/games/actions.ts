"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/domain/errors";
import { actorOf, getSessionUser } from "@/server/auth";
import { toFailure } from "@/server/actions";
import * as repo from "@/server/db/repo";
import { channels, publish } from "@/server/realtime/bus";

const id = z.uuid();

export async function joinGameAction(gameId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED");
  if (!id.safeParse(gameId).success) return fail("INVALID_INPUT");
  try {
    await repo.joinOpenGame(actorOf(user), gameId, user.name?.split(" ")[0] ?? user.email.split("@")[0]!);
    await publish(channels.games);
    revalidatePath("/games");
    return { ok: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function leaveGameAction(gameId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED");
  if (!id.safeParse(gameId).success) return fail("INVALID_INPUT");
  try {
    await repo.leaveOpenGame(actorOf(user), gameId);
    await publish(channels.games);
    revalidatePath("/games");
    return { ok: true };
  } catch (err) {
    return toFailure(err);
  }
}
