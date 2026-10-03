import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { releaseExpiredHolds } from "@/server/db/repo";
import { channels, publish } from "@/server/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cleanup job (DECISIONS D11). Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  if (!env.cronSecret || request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const turfs = await releaseExpiredHolds();
  for (const id of turfs) await publish(channels.turf(id));
  return NextResponse.json({ released: turfs.length });
}
