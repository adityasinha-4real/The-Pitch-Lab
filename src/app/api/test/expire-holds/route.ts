import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/server/env";
import { testExpireHolds } from "@/server/db/repo";
import { channels, publish } from "@/server/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DECISIONS D13: only exists when PITCHLAB_TEST_HOOKS=1 (the Playwright server). */
export async function POST(request: Request) {
  if (!env.testHooks) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = z.object({ bookingId: z.uuid().optional() }).safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const turfs = await testExpireHolds(body.data.bookingId);
  for (const id of new Set(turfs)) await publish(channels.turf(id));
  return NextResponse.json({ expired: turfs.length });
}
