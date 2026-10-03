"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-3xl flex-col items-start justify-center px-4 py-20 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-danger">Stoppage time</p>
      <h1 className="mt-3 font-display text-7xl font-black uppercase leading-[0.85]">Something went wrong.</h1>
      <p className="mt-4 max-w-md text-muted">We hit a snag loading this page. Try again, and if it keeps happening, come back in a minute.</p>
      <Button size="lg" className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
