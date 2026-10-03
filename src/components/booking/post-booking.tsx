"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Minus, Plus, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { createOpenGameAction, createSplitAction } from "@/app/bookings/actions";
import { formatINR } from "@/domain/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Stepper({ id, value, min, max, onChange, label }: { id: string; value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="secondary" size="icon" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label}`}>
        <Minus />
      </Button>
      <output id={id} aria-live="polite" className="num w-16 text-center font-display text-5xl font-black leading-none">
        {value}
      </output>
      <Button type="button" variant="secondary" size="icon" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`}>
        <Plus />
      </Button>
    </div>
  );
}

export function SplitDialog({ bookingId, amountPaise, existingToken }: { bookingId: string; amountPaise: number; existingToken?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [seats, setSeats] = useState(5);
  const [token, setToken] = useState<string | null>(existingToken ?? null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const each = Math.floor(amountPaise / seats);
  const link = token && typeof window !== "undefined" ? `${window.location.origin}/split/${token}` : token ? `/split/${token}` : "";

  const create = () =>
    start(async () => {
      const res = await createSplitAction({ bookingId, seats });
      if (!res.ok) return void toast.error(res.message);
      setToken(res.token);
      router.refresh();
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Long-press the link instead.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" data-testid="split-open">
          <Share2 /> {existingToken ? "Split link" : "Split the cost"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Split the cost</DialogTitle>
          <DialogDescription>Everyone pays their share from one link. Your seat is already covered.</DialogDescription>
        </DialogHeader>
        {token ? (
          <div className="flex flex-col gap-3">
            <Label htmlFor="split-link">Share link</Label>
            <div className="flex gap-2">
              <Input id="split-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} data-testid="split-link" />
              <Button type="button" variant="secondary" size="icon" onClick={copy} aria-label="Copy link">
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            <Button asChild className="mt-2">
              <Link href={`/split/${token}`}>Open split page</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <Label htmlFor="split-seats">Players</Label>
            <Stepper id="split-seats" value={seats} min={2} max={14} onChange={setSeats} label="players" />
            <p className="text-center text-sm text-muted">
              <span className="num font-display text-3xl font-extrabold text-text">{formatINR(each)}</span> each
              {amountPaise % seats ? <span className="block text-xs">The odd paise land on your seat.</span> : null}
            </p>
            <Button size="lg" className="w-full" onClick={create} disabled={pending} data-testid="split-create">
              {pending ? "Creating…" : "Create split link"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function OpenGameDialog({ bookingId, existing }: { bookingId: string; existing?: { playersNeeded: number; joined: number; note: string } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [needed, setNeeded] = useState(existing?.playersNeeded ?? 3);
  const [note, setNote] = useState(existing?.note ?? "");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await createOpenGameAction({ bookingId, playersNeeded: needed, note });
      if (!res.ok) return void toast.error(res.message);
      toast.success(`Listed on the open games board: need ${needed}.`);
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" data-testid="open-game-open">
          <Users /> {existing ? `Need ${existing.playersNeeded - existing.joined} more` : "Find players"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post an open game</DialogTitle>
          <DialogDescription>Short a few? List the game and players can join from the board.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-5">
          <Label htmlFor="players-needed">Players needed</Label>
          <Stepper id="players-needed" value={needed} min={Math.max(1, existing?.joined ?? 1)} max={13} onChange={setNeeded} label="players" />
          <div className="flex w-full flex-col gap-2">
            <Label htmlFor="game-note">Note for players</Label>
            <Input id="game-note" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button size="lg" className="w-full" onClick={save} disabled={pending} data-testid="open-game-save">
            {pending ? "Posting…" : existing ? "Update listing" : "Post to the board"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
