/** Fixed-window in-memory limiter. Per instance; good enough to blunt abuse of auth and payment endpoints. */
const g = globalThis as unknown as { __nutmegRate?: Map<string, { count: number; resetAt: number }> };

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  g.__nutmegRate ??= new Map();
  const now = Date.now();
  const hit = g.__nutmegRate.get(key);
  if (!hit || hit.resetAt <= now) {
    g.__nutmegRate.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  hit.count += 1;
  return hit.count <= limit;
}
