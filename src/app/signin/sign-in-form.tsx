"use client";

import { useActionState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestMagicLink, type MagicLinkState } from "./actions";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="!size-5">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6H1.4a12 12 0 0 0 0 10.9l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

export function SignInForm({ next, localMode }: { next: string; localMode: boolean }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(requestMagicLink, { status: "idle" });

  return (
    <div className="mt-6">
      <AnimatePresence mode="wait" initial={false}>
        {state.status === "sent" ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-line-strong bg-surface-2 p-5"
            role="status"
          >
            <MailCheck className="size-6 text-accent-fg" aria-hidden />
            <p className="mt-3 font-semibold">Check your inbox</p>
            <p className="mt-1 text-sm text-muted">
              We sent a sign-in link to <span className="font-semibold text-text">{state.email}</span>. It works once and expires in 10 minutes.
            </p>
            {state.localLink && (
              <div className="mt-4 border-t border-line-strong pt-4">
                <p className="text-xs text-muted">Local mode has no mail server, so here is the link that would have been emailed:</p>
                <Button asChild className="mt-3 w-full">
                  <a href={state.localLink} data-testid="local-magic-link">
                    Open magic link <ArrowRight />
                  </a>
                </Button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.form key="form" action={action} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-3" noValidate>
            <input type="hidden" name="next" value={next} />
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              aria-invalid={state.status === "error" || undefined}
              aria-describedby={state.status === "error" ? "email-error" : undefined}
            />
            {state.status === "error" && (
              <p id="email-error" role="alert" className="text-sm font-medium text-danger">
                {state.message}
              </p>
            )}
            <Button type="submit" size="lg" disabled={pending} className="mt-1">
              {pending ? "Sending…" : "Email me a magic link"}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        <span className="h-px flex-1 bg-line-strong" />
        or
        <span className="h-px flex-1 bg-line-strong" />
      </div>

      <Button asChild variant="secondary" size="lg" className="w-full">
        <a href={`/auth/google?next=${encodeURIComponent(next)}`}>
          <GoogleGlyph /> Continue with Google
        </a>
      </Button>
      {localMode && (
        <p className="mt-3 text-center text-xs text-muted">Local mode: Google signs you in as a demo Google account.</p>
      )}
    </div>
  );
}
