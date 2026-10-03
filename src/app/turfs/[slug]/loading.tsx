import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading turf">
      <div className="grid gap-8 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-40 rounded-full" />
          <Skeleton className="h-24 w-4/5" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="aspect-[16/10] rounded-[1.75rem]" />
      </div>
      <div className="mt-12 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6" data-testid="slot-skeleton">
        {Array.from({ length: 18 }, (_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
