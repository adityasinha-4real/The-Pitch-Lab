import { NextResponse } from "next/server";
import { actorOf, getSessionUser } from "@/server/auth";
import * as repo from "@/server/db/repo";
import { toSplitView } from "@/app/split/[token]/view-model";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-z0-9]{16,64}$/.test(token)) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const split = await repo.getSplit(actorOf(await getSessionUser()), token);
  if (!split) return NextResponse.json({ error: "SHARE_NOT_FOUND" }, { status: 404 });
  return NextResponse.json(toSplitView(split), { headers: { "cache-control": "no-store" } });
}
