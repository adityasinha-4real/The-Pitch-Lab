"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Unlock } from "lucide-react";
import { toast } from "sonner";
import { SLOT_STATE_LABEL, type Slot } from "@/domain/slots";
import { formatHour } from "@/domain/time";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { blockSlotAction, unblockSlotAction } from "./actions";

export function BlockBoard({ turfId, slots, blocks }: { turfId: string; slots: Slot[]; blocks: Record<string, { id: string; note: string }> }) {
  const router = useRouter();
  const [target, setTarget] = useState<Slot | null>(null);
  const [note, setNote] = useState("Maintenance");
  const [pending, start] = useTransition();

  const block = () =>
    start(async () => {
      if (!target) return;
      const res = await blockSlotAction({ turfId, startAt: target.startAt, note });
      if (!res.ok) return void toast.error(res.message);
      toast.success(`${formatHour(target.hour)} blocked.`);
      setTarget(null);
      router.refresh();
    });

  const unblock = (id: string, hour: number) =>
    start(async () => {
      const res = await unblockSlotAction(id);
      if (!res.ok) return void toast.error(res.message);
      toast.success(`${formatHour(hour)} is back on the board.`);
      router.refresh();
    });

  return (
    <>
      <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="block-board">
        {slots.map((s) => {
          const blockInfo = blocks[String(s.hour)];
          return (
            <li
              key={s.hour}
              data-testid={`admin-slot-${s.hour}`}
              data-state={s.state}
              className={cn(
                "flex min-h-28 flex-col justify-between rounded-2xl border p-3",
                s.state === "blocked" ? "hatch border-dashed border-line-strong text-muted" : "border-line-strong",
              )}
            >
              <div>
                <p className="font-display text-2xl font-extrabold uppercase leading-none">{formatHour(s.hour)}</p>
                <p className="mt-1 text-xs text-muted">{blockInfo ? blockInfo.note : SLOT_STATE_LABEL[s.state]}</p>
              </div>
              {s.state === "available" && (
                <Button size="sm" variant="secondary" onClick={() => setTarget(s)} aria-label={`Block ${formatHour(s.hour)}`}>
                  <Ban /> Block
                </Button>
              )}
              {blockInfo && s.state === "blocked" && (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => unblock(blockInfo.id, s.hour)} aria-label={`Unblock ${formatHour(s.hour)}`}>
                  <Unlock /> Unblock
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block {target ? formatHour(target.hour) : ""}</DialogTitle>
            <DialogDescription>Players will see this hour as unavailable.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="block-note">Reason</Label>
            <Input id="block-note" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button size="lg" className="mt-5 w-full" onClick={block} disabled={pending} data-testid="block-confirm">
            {pending ? "Blocking…" : "Block slot"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
