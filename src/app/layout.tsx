import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Inter_Tight } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { env } from "@/server/env";
import "./globals.css";

const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-big-shoulders",
  display: "swap",
  adjustFontFallback: false,
});
const body = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "The Pitch Lab — Book a floodlit turf", template: "%s · The Pitch Lab" },
  description: "Book five- and seven-a-side football turfs by the hour. Hold a slot, pay, split it with your squad, or find players for an open game.",
  applicationName: "The Pitch Lab",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F5EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B120D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = {
    mode: env.mode,
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey,
    payments: env.razorpay.configured ? ("razorpay" as const) : ("mock" as const),
  };
  return (
    <html lang="en-IN" suppressHydrationWarning className={`${display.variable} ${body.variable}`}>
      <body className="grain flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-[70] rounded-xl bg-accent px-4 py-3 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <Providers config={config}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
