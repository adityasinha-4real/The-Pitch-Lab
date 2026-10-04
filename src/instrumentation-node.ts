/**
 * Boot the database before the first request, and in local mode run the
 * expired-hold cleanup job every 30 seconds (DECISIONS D11).
 */
import { getSql } from "./server/db/client";
import { env } from "./server/env";
import { releaseExpiredHolds } from "./server/db/repo";
import { channels, publish } from "./server/realtime/bus";

const g = globalThis as unknown as { __pitchlabCleanup?: NodeJS.Timeout };

await getSql();

if (env.mode === "local" && !g.__pitchlabCleanup) {
  g.__pitchlabCleanup = setInterval(async () => {
    try {
      for (const turfId of await releaseExpiredHolds()) await publish(channels.turf(turfId));
    } catch (err) {
      console.error("hold cleanup failed", err);
    }
  }, 30_000);
  g.__pitchlabCleanup.unref();
}
