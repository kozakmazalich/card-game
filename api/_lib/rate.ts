// Best-effort in-memory rate limiting. Serverless instances are ephemeral,
// so this is per-instance — a placeholder until a shared store (Redis/DB)
// lands with the full backend. Good enough to blunt casual spam on testnet.
const buckets = new Map<string, number[]>();
const LIMIT = 30; // requests
const WINDOW_MS = 60_000;

export function allow(key: string): boolean {
  const now = Date.now();
  const list = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= LIMIT) return false;
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > 5000) buckets.clear(); // crude cap
  return true;
}
