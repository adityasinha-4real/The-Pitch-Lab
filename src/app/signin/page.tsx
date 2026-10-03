import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { safeNext } from "@/server/auth/tokens";
import { env } from "@/server/env";
import { PitchLines } from "@/components/brand";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  expired: "That link has expired. Request a fresh one.",
  used: "That link was already used. Request a fresh one.",
  oauth: "Google sign-in didn't complete. Try again.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext, "/");
  if (await getSessionUser()) redirect(next);

  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="floodlights pitch-stripes absolute inset-0 -z-10" />
      <PitchLines className="-z-10 opacity-70" />
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2">
        <div className="hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-fg">Pre-match</p>
          <h1 className="mt-4 font-display text-[5.5rem] font-black uppercase leading-[0.85]">
            Into the
            <br />
            tunnel.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Sign in to hold slots, pay, and split the bill. No password: we send you a link.
          </p>
        </div>
        <div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-line-strong bg-surface p-6 shadow-lift sm:p-8">
          <h1 className="font-display text-5xl font-black uppercase leading-none lg:text-4xl">Sign in</h1>
          <p className="mt-2 text-sm text-muted">Magic link or Google. New here? Same buttons.</p>
          {error && ERRORS[error] && (
            <p role="alert" className="mt-5 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
              {ERRORS[error]}
            </p>
          )}
          <SignInForm next={next} localMode={env.mode === "local"} />
        </div>
      </div>
    </div>
  );
}
