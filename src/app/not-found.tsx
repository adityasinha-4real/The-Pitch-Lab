import Link from "next/link";
import { PitchLines } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative isolate overflow-hidden">
      <PitchLines className="-z-10 opacity-70" />
      <div className="mx-auto flex min-h-[60dvh] max-w-3xl flex-col items-start justify-center px-4 py-20 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-fg">404 · Out of play</p>
        <h1 className="mt-3 font-display text-7xl font-black uppercase leading-[0.85] sm:text-8xl">Wide of the post.</h1>
        <p className="mt-4 max-w-md text-muted">That page isn&apos;t on the pitch. It may have moved, or the link is off target.</p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/">Back to kick-off</Link>
        </Button>
      </div>
    </div>
  );
}
