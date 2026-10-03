import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.12em]",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-muted",
        accent: "bg-accent-soft text-accent-fg",
        held: "bg-held-soft text-held",
        danger: "bg-danger-soft text-danger",
        solid: "bg-accent text-accent-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
