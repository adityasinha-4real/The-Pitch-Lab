"use client";

import { useCallback, useRef, useState } from "react";
import { CreditCard, ShieldCheck, Smartphone } from "lucide-react";
import { formatINR } from "@/domain/money";
import type { CheckoutConfig } from "@/server/payments/provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PayOutcome = "submitted" | "dismissed" | "failed";

type RazorpayCtor = new (opts: Record<string, unknown>) => { open(): void; on(evt: string, cb: () => void): void };
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

function loadRazorpay(): Promise<RazorpayCtor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay failed to load")));
    s.onerror = () => reject(new Error("Razorpay failed to load"));
    document.head.appendChild(s);
  });
}

/**
 * Opens the gateway's checkout and resolves when the player finishes with it.
 * "submitted" only means the gateway took the payment: confirmation arrives
 * separately via the webhook, so callers poll / listen for the status.
 */
export function usePaymentFlow() {
  const [mock, setMock] = useState<Extract<CheckoutConfig, { provider: "mock" }> | null>(null);
  const resolver = useRef<((o: PayOutcome) => void) | null>(null);

  const settle = (o: PayOutcome) => {
    resolver.current?.(o);
    resolver.current = null;
    setMock(null);
  };

  const pay = useCallback(async (config: CheckoutConfig): Promise<PayOutcome> => {
    if (config.provider === "mock") {
      return new Promise<PayOutcome>((resolve) => {
        resolver.current = resolve;
        setMock(config);
      });
    }
    const Razorpay = await loadRazorpay();
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#0F7A3D";
    return new Promise<PayOutcome>((resolve) => {
      const rzp = new Razorpay({
        key: config.keyId,
        order_id: config.orderId,
        amount: config.amountPaise,
        currency: config.currency,
        name: config.name,
        description: config.description,
        prefill: config.prefill,
        theme: { color: accent },
        handler: () => resolve("submitted"),
        modal: { ondismiss: () => resolve("dismissed") },
      });
      rzp.on("payment.failed", () => resolve("failed"));
      rzp.open();
    });
  }, []);

  const element = <MockCheckout config={mock} onSettle={settle} />;
  return { pay, element };
}

function MockCheckout({
  config,
  onSettle,
}: {
  config: Extract<CheckoutConfig, { provider: "mock" }> | null;
  onSettle: (o: PayOutcome) => void;
}) {
  const [method, setMethod] = useState<"upi" | "card">("upi");
  const [sending, setSending] = useState(false);

  const payNow = async () => {
    if (!config) return;
    setSending(true);
    try {
      const res = await fetch("/api/payments/mock/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: config.orderId }),
      });
      onSettle(res.ok ? "submitted" : "failed");
    } catch {
      onSettle("failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={Boolean(config)} onOpenChange={(open) => !open && !sending && onSettle("dismissed")}>
      <DialogContent data-testid="mock-checkout">
        <DialogHeader>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-held">Test mode · no real money</p>
          <DialogTitle>Nutmeg Pay</DialogTitle>
          <DialogDescription>{config?.description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-baseline justify-between rounded-2xl bg-surface-2 px-4 py-3">
          <span className="text-sm text-muted">Amount</span>
          <span className="num font-display text-3xl font-black">{config ? formatINR(config.amountPaise) : ""}</span>
        </div>
        <div role="radiogroup" aria-label="Payment method" className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              ["upi", "UPI", Smartphone],
              ["card", "Card", CreditCard],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={method === value}
              onClick={() => setMethod(value)}
              className={cn(
                "flex min-h-13 items-center gap-2 rounded-2xl border px-4 font-semibold transition-colors",
                method === value ? "border-accent-fg bg-accent-soft text-accent-fg" : "border-line-strong text-muted hover:text-text",
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          {method === "upi" ? "Simulates a UPI collect request approved on your phone." : "Simulates a test card (4111 1111 1111 1111)."}
        </p>
        <Button size="lg" className="mt-5 w-full" onClick={payNow} disabled={sending} data-testid="mock-pay">
          <ShieldCheck /> {sending ? "Processing…" : `Pay ${config ? formatINR(config.amountPaise) : ""}`}
        </Button>
        <Button variant="ghost" className="mt-2 w-full text-muted" onClick={() => onSettle("failed")} disabled={sending}>
          Simulate a declined payment
        </Button>
      </DialogContent>
    </Dialog>
  );
}
