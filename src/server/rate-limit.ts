/** Fixed-window in-memory limiter. Per instance; good enough to blunt abuse of auth and payment endpoints. */
const g = globalThis as unknown as { __pitchlabRate?: Map<string, { count: number; resetAt: number }> };

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  g.__pitchlabRate ??= new Map();
  const now = Date.now();
  const hit = g.__pitchlabRate.get(key);
  if (!hit || hit.resetAt <= now) {
    g.__pitchlabRate.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  hit.count += 1;
  return hit.count <= limit;
}
