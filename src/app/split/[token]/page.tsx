import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { actorOf, getSessionUser } from "@/server/auth";
import * as repo from "@/server/db/repo";
import { SplitPanel } from "./split-panel";
import { toSplitView } from "./view-model";

export const metadata: Metadata = { title: "Split the cost", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SplitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-z0-9]{16,64}$/.test(token)) notFound();
  const split = await repo.getSplit(actorOf(await getSessionUser()), token);
  if (!split) notFound();
  return <SplitPanel initial={toSplitView(split)} />;
}
