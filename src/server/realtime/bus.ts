import { EventEmitter } from "node:events";

/**
 * Invalidation bus (DECISIONS D10). Views subscribe to a channel and refetch
 * when pinged. Local mode: in-process emitter streamed over SSE.
 * Supabase mode: Realtime broadcast via the REST endpoint.
 */
export const channels = {
  turf: (id: string) => `turf:${id}`,
  booking: (id: string) => `booking:${id}`,
  split: (token: string) => `split:${token}`,
  games: "games",
} as const;

export const CHANNEL_PATTERN = /^(turf|booking|split):[A-Za-z0-9-]{1,64}$|^games$/;

const g = globalThis as unknown as { __pitchlabBus?: EventEmitter };

function emitter(): EventEmitter {
  if (!g.__pitchlabBus) {
    g.__pitchlabBus = new EventEmitter();
    g.__pitchlabBus.setMaxListeners(0);
  }
  return g.__pitchlabBus;
}

export async function publish(channel: string): Promise<void> {
  emitter().emit(channel, channel);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.DATABASE_URL) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic: channel, event: "ping", payload: { channel } }] }),
    });
  } catch (err) {
    // A missed ping only delays a refresh; clients also refetch on focus.
    console.warn("realtime broadcast failed", err);
  }
}

export function subscribe(channel: string, fn: (channel: string) => void): () => void {
  emitter().on(channel, fn);
  return () => {
    emitter().off(channel, fn);
  };
}
