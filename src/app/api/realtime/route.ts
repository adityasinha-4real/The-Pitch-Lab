import { CHANNEL_PATTERN, subscribe } from "@/server/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local-mode realtime: Server-Sent Events carrying invalidation pings (DECISIONS D10). */
export async function GET(request: Request) {
  const names = new URL(request.url).searchParams.getAll("channel").filter((c) => CHANNEL_PATTERN.test(c)).slice(0, 8);
  if (!names.length) return new Response("no channels", { status: 400 });

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send(`retry: 3000\n: connected\n\n`);
      const offs = names.map((name) => subscribe(name, (channel) => send(`event: ping\ndata: ${JSON.stringify({ channel })}\n\n`)));
      const heartbeat = setInterval(() => send(`: hb\n\n`), 25_000);
      cleanup = () => {
        clearInterval(heartbeat);
        for (const off of offs) off();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
