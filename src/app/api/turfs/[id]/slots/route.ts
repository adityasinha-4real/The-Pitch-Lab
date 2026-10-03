import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { bookingWindow, isDateKey } from "@/domain/time";
import { actorOf, getSessionUser } from "@/server/auth";
import * as repo from "@/server/db/repo";
import { slotsFor } from "@/server/slots";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!z.uuid().safeParse(id).success || !isDateKey(date)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const now = new Date();
  if (!bookingWindow(now).includes(date)) return NextResponse.json({ error: "SLOT_TOO_FAR" }, { status: 400 });
  const turf = await repo.getTurfById(id);
  if (!turf) return NextResponse.json({ error: "TURF_NOT_FOUND" }, { status: 404 });
  const slots = await slotsFor(actorOf(await getSessionUser()), turf, date, now);
  return NextResponse.json({ date, slots }, { headers: { "cache-control": "no-store" } });
}
