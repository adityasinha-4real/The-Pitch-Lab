import { cn } from "@/lib/utils";

/** Chalk-dust shimmer. Static under reduced motion. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      data-skeleton
      className={cn(
        "relative overflow-hidden rounded-xl bg-surface-2",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.6s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[var(--line-strong)] after:to-transparent",
        "motion-reduce:after:hidden",
        className,
      )}
      {...props}
    />
  );
}
