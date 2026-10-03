import { NextResponse } from "next/server";
import { z } from "zod";
import { actorOf, getSessionUser } from "@/server/auth";
import * as repo from "@/server/db/repo";

export const dynamic = "force-dynamic";

/** Read-only status poll used by checkout while it waits for the webhook. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const status = await repo.getBookingStatus(actorOf(user), id);
  if (!status) return NextResponse.json({ error: "BOOKING_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ status: status.status }, { headers: { "cache-control": "no-store" } });
}
