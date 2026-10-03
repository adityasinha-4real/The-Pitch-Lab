import type { Metadata } from "next";
import { actorOf, getSessionUser } from "@/server/auth";
import * as repo from "@/server/db/repo";
import { PageHeader } from "@/components/page-header";
import { GamesBoard } from "./games-board";

export const metadata: Metadata = { title: "Open games" };
export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const user = await getSessionUser();
  const games = await repo.listOpenGames(actorOf(user));
  return (
    <>
      <PageHeader
        eyebrow="Short a few?"
        title="Open games"
        description="Booked games looking for players. Join one and you're on the team sheet. Pay the organiser on the day."
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <GamesBoard
          signedIn={Boolean(user)}
          games={games.map((g) => ({ ...g, startAt: g.startAt.toISOString(), endAt: g.endAt.toISOString() }))}
        />
      </div>
    </>
  );
}
