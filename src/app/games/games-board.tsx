"use client";

import { useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { formatDay, formatSlotRange } from "@/domain/time";
import type { OpenGame } from "@/server/db/repo";
import { useLiveChannels } from "@/hooks/use-live-channels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { joinGameAction, leaveGameAction } from "./actions";

type GameView = Omit<OpenGame, "startAt" | "endAt"> & { startAt: string; endAt: string };

export function GamesBoard({ games, signedIn }: { games: GameView[]; signedIn: boolean }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useLiveChannels(["games"], refresh);

  if (!games.length) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-12 text-center">
        <p className="font-display text-3xl font-extrabold uppercase">The board is empty</p>
        <p className="mt-2 text-muted">Book a slot, then tap “Find players” to list it here.</p>
        <Button asChild className="mt-5">
          <Link href="/turfs">Book a slot</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {games.map((g, i) => (
        <motion.li key={g.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4 }}>
          <GameCard g={g} signedIn={signedIn} />
        </motion.li>
      ))}
    </ul>
  );
}

function GameCard({ g, signedIn }: { g: GameView; signedIn: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const left = g.playersNeeded - g.joined;
  const full = left <= 0;
  const startAt = new Date(g.startAt);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.message ?? "Something went wrong.");
      toast.success(success);
      router.refresh();
    });

  return (
    <article
      className="flex h-full flex-col rounded-[var(--radius-card)] border border-line-strong bg-surface p-5 shadow-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-accent-fg hover:shadow-lift motion-reduce:hover:translate-y-0"
      data-testid={`game-${g.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge tone="accent">{g.format}</Badge>
          <h2 className="mt-3 font-display text-3xl font-extrabold uppercase leading-none">{g.turfName}</h2>
          <p className="mt-1 text-sm text-muted">
            {formatDay(startAt)} · {formatSlotRange(startAt, new Date(g.endAt))}
          </p>
        </div>
        <div className={cn("grid size-24 shrink-0 place-items-center rounded-2xl text-center", full ? "bg-surface-2 text-muted" : "bg-accent text-accent-ink")}>
          <span>
            <span className="num block font-display text-5xl font-black leading-none" data-testid="players-left">
              {Math.max(0, left)}
            </span>
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em]">{full ? "full" : "needed"}</span>
          </span>
        </div>
      </div>
      {g.note && <p className="mt-4 text-sm">“{g.note}”</p>}
      <div className="mt-4 flex items-center gap-1.5" aria-label={`${g.joined} of ${g.playersNeeded} spots filled`} role="img">
        {Array.from({ length: g.playersNeeded }, (_, i) => (
          <span key={i} className={cn("h-2 flex-1 rounded-full", i < g.joined ? "bg-accent" : "bg-surface-2")} />
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="text-sm text-muted">Organised by {g.organiserName}</span>
        {g.isMine ? (
          <Badge>Your game</Badge>
        ) : g.joinedByMe ? (
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => leaveGameAction(g.id), "You've left the game.")}>
            Leave
          </Button>
        ) : signedIn ? (
          <Button size="sm" disabled={pending || full} onClick={() => run(() => joinGameAction(g.id), "You're in. See you on the pitch.")} data-testid="join-game">
            {full ? "Full" : "Join game"}
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href="/signin?next=/games">Sign in to join</Link>
          </Button>
        )}
      </div>
    </article>
  );
}
