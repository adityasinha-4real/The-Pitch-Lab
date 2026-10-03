"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { validateRule } from "@/domain/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deleteRuleAction, saveRuleAction } from "./actions";

type Rule = { id?: string; label: string; dow: number[]; startTime: string; endTime: string; pricePaise: number };
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function PricingEditor({ turf, rules }: { turf: { id: string; name: string }; rules: Rule[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <section aria-labelledby={`pricing-${turf.id}`} className="rounded-[var(--radius-card)] border border-line-strong bg-surface p-5 sm:p-6" data-testid={`pricing-${turf.name}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`pricing-${turf.id}`} className="font-display text-3xl font-extrabold uppercase">{turf.name}</h2>
        <Button variant="secondary" size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus /> Add rule
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted">Where rules overlap, the narrower time window wins.</p>
      <div className="mt-4 flex flex-col gap-2">
        {rules.map((r) => (
          <RuleRow key={r.id} turfId={turf.id} rule={r} />
        ))}
        {adding && (
          <RuleRow
            turfId={turf.id}
            rule={{ label: "Special", dow: [1, 2, 3, 4, 5], startTime: "06:00", endTime: "09:00", pricePaise: 100000 }}
            onDone={() => setAdding(false)}
            isNew
          />
        )}
      </div>
    </section>
  );
}

function RuleRow({ turfId, rule, isNew, onDone }: { turfId: string; rule: Rule; isNew?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [r, setR] = useState(rule);
  const [rupees, setRupees] = useState(String(rule.pricePaise / 100));
  const [pending, start] = useTransition();
  const priced = { ...r, pricePaise: Math.round(Number(rupees) * 100) };
  const problem = validateRule(priced);
  const dirty = isNew || JSON.stringify(priced) !== JSON.stringify(rule);
  const uid = rule.id ?? `new-${turfId}`;

  const save = () =>
    start(async () => {
      const res = await saveRuleAction({ turfId, ...priced });
      if (!res.ok) return void toast.error(res.message);
      toast.success(`Saved “${priced.label}”.`);
      onDone?.();
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!rule.id) return onDone?.();
      const res = await deleteRuleAction(rule.id, turfId);
      if (!res.ok) return void toast.error(res.message);
      toast.success(`Removed “${rule.label}”.`);
      router.refresh();
    });

  return (
    <div className="grid gap-3 rounded-2xl bg-surface-2 p-3 md:grid-cols-[1.2fr_auto_auto_auto_0.8fr_auto] md:items-center" data-testid="rule-row">
      <Input aria-label="Rule name" value={r.label} onChange={(e) => setR({ ...r, label: e.target.value })} className="bg-surface" />
      <div role="group" aria-label="Days" className="flex gap-1">
        {DAYS.map((d, i) => {
          const on = r.dow.includes(i);
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              aria-label={DAY_NAMES[i]}
              onClick={() => setR({ ...r, dow: on ? r.dow.filter((x) => x !== i) : [...r.dow, i].sort() })}
              className={cn("size-11 rounded-xl text-xs font-bold", on ? "bg-accent text-accent-ink" : "bg-surface text-muted")}
            >
              {d}
            </button>
          );
        })}
      </div>
      <Input aria-label="Starts" type="time" step={3600} value={r.startTime} onChange={(e) => setR({ ...r, startTime: e.target.value })} className="w-32 bg-surface" />
      <Input
        aria-label="Ends (24:00 for midnight)"
        value={r.endTime}
        inputMode="numeric"
        onChange={(e) => setR({ ...r, endTime: e.target.value })}
        className="w-28 bg-surface"
        id={`end-${uid}`}
      />
      <div className="flex items-center gap-2">
        <span className="text-muted" aria-hidden>
          ₹
        </span>
        <Input aria-label="Price per hour in rupees" inputMode="numeric" value={rupees} onChange={(e) => setRupees(e.target.value.replace(/[^\d.]/g, ""))} className="num bg-surface" data-testid="rule-price" />
      </div>
      <div className="flex gap-1">
        <Button size="icon" onClick={save} disabled={pending || !dirty || Boolean(problem)} aria-label={`Save ${r.label}`} data-testid="rule-save">
          <Save />
        </Button>
        <Button size="icon" variant="ghost" onClick={remove} disabled={pending} aria-label={`Delete ${r.label}`}>
          <Trash2 />
        </Button>
      </div>
      {problem && dirty && (
        <p role="alert" className="text-sm font-medium text-danger md:col-span-6">
          {problem}
        </p>
      )}
    </div>
  );
}
