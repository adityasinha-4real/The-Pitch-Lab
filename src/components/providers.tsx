"use client";

import { createContext, useContext } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

export type RuntimeConfig = {
  mode: "local" | "supabase";
  supabaseUrl: string;
  supabaseAnonKey: string;
  payments: "mock" | "razorpay";
};

const RuntimeContext = createContext<RuntimeConfig>({
  mode: "local",
  supabaseUrl: "",
  supabaseAnonKey: "",
  payments: "mock",
});

export const useRuntime = () => useContext(RuntimeContext);

export const THEME_STORAGE_KEY = "pitchlab-theme";

export function Providers({ config, children }: { config: RuntimeConfig; children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey={THEME_STORAGE_KEY} disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <RuntimeContext.Provider value={config}>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                toast: "!rounded-2xl !border !border-line-strong !bg-surface !text-text !shadow-lift !font-sans",
                description: "!text-muted",
              },
            }}
          />
        </RuntimeContext.Provider>
      </MotionConfig>
    </ThemeProvider>
  );
}
