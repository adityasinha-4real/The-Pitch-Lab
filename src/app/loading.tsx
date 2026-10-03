import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-32 rounded-full" />
      <Skeleton className="mt-4 h-20 w-3/4 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-1/2 max-w-md" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-[var(--radius-card)]" />
        ))}
      </div>
    </div>
  );
}
