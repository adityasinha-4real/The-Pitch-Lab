"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRuntime } from "@/components/providers";

let browserClient: SupabaseClient | null = null;

/**
 * Calls `onPing` whenever any of `channels` is invalidated (DECISIONS D10),
 * and when the tab becomes visible again. Local mode listens over SSE;
 * Supabase mode uses Realtime broadcast.
 */
export function useLiveChannels(channels: string[], onPing: () => void) {
  const { mode, supabaseUrl, supabaseAnonKey } = useRuntime();
  const handler = useRef(onPing);
  useEffect(() => {
    handler.current = onPing;
  }, [onPing]);

  const key = channels.filter(Boolean).join(",");

  useEffect(() => {
    if (!key) return;
    const names = key.split(",");
    const fire = () => handler.current();
    let stop: () => void;

    if (mode === "local") {
      const qs = names.map((c) => `channel=${encodeURIComponent(c)}`).join("&");
      const es = new EventSource(`/api/realtime?${qs}`);
      es.addEventListener("ping", fire);
      stop = () => es.close();
    } else {
      browserClient ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
      const sb = browserClient;
      const subs = names.map((name) => sb.channel(name).on("broadcast", { event: "ping" }, fire).subscribe());
      stop = () => {
        for (const s of subs) void sb.removeChannel(s);
      };
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") fire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, mode, supabaseUrl, supabaseAnonKey]);
}
