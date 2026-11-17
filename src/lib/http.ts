// Shared helpers for the on-demand API routes.
import { createHash } from 'node:crypto';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// Coerce anything to a trimmed, length-capped string — never trust the payload.
export const str = (v: unknown, max = 200): string =>
  (typeof v === 'string' ? v : v == null ? '' : String(v)).trim().slice(0, max);

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 320;

// Runtime secrets live in process.env on Vercel (set in the dashboard / `vercel env`),
// NOT import.meta.env (which only sees build-time values). Read case-insensitively
// so env-var name casing (SMARTSHEET_TOKEN vs smartsheet_token) can't silently break it.
export const env = (k: string): string | undefined => {
  if (typeof process === 'undefined') return undefined;
  if (process.env[k] != null) return process.env[k];
  const lower = k.toLowerCase();
  const match = Object.keys(process.env).find((key) => key.toLowerCase() === lower);
  return match ? process.env[match] : undefined;
};

// Best-effort per-IP limit. Serverless instances don't share memory, so this slows a
// single noisy client rather than guaranteeing a global cap. Pair it with Vercel's
// firewall rate limiting if abuse shows up.
// 20 per 10 minutes by default, not 5: doctors at a study club or trade show scan the QR
// on the same venue Wi-Fi, so they share one public IP. At 5, the sixth doctor was
// blocked. LEAD_RATE_LIMIT overrides it (raise it for a big event, or for local tests).
//
// Two maps: one for addresses and plain names, one for per-key buckets. New keys can't
// push an address's count out, and neither map is ever cleared whole. When a map is full,
// expired buckets go first, then the least recently used.
const hits = new Map<string, number[]>();
const keyHits = new Map<string, number[]>();
/** Most buckets one map holds on a warm instance before it evicts. */
export const MAX_BUCKETS = 20_000;
const defaultLimit = () => Number(env('LEAD_RATE_LIMIT')) || 20;

function count(map: Map<string, number[]>, name: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (map.get(name) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  // Only the newest limit + 1 matter to the answer, so a hammering client can't grow one
  // bucket without end.
  if (recent.length > limit + 1) recent.splice(0, recent.length - (limit + 1));
  map.delete(name); // re-insert, so map order is least recently used first
  map.set(name, recent);
  if (map.size > MAX_BUCKETS) evict(map, now, windowMs, (t) => t);
  return recent.length > limit;
}

function evict<T>(map: Map<string, T[]>, now: number, windowMs: number, at: (entry: T) => number) {
  for (const [name, entries] of map) {
    if (map.size <= MAX_BUCKETS) return;
    if (!entries.length || now - at(entries[entries.length - 1]) >= windowMs) map.delete(name);
  }
  for (const name of map.keys()) {
    if (map.size <= MAX_BUCKETS) return;
    map.delete(name);
  }
}

export function rateLimited(ip: string, limit = defaultLimit(), windowMs = 10 * 60 * 1000): boolean {
  return count(hits, ip, limit, windowMs);
}

// Per link key, with a high per-IP backstop. A launch brings up to 150 people to the Rep
// app at once, most behind one corporate or VPN address, so a per-IP limit of 30 blocked
// everyone after the 30th. A secret link (Referral Key, confirm token) now carries the
// per-person limit, and the IP counts toward a backstop high enough for a whole meeting
// behind one address. The backstop is per route (scope): one address gets IP_BACKSTOP on
// each route, per instance. The Vercel firewall is the real cross-instance cap.
// The bucket name holds a SHA-256 of the key, never the key itself.
/** Requests per IP per 10 minutes, per server instance, per route. */
export const IP_BACKSTOP = 600;

/** The bucket name for one secret: scope plus the first 32 hex of its SHA-256. */
export const keyBucket = (scope: string, secret: string): string =>
  `${scope}:key:${createHash('sha256').update(secret).digest('hex').slice(0, 32)}`;

/** The bucket name for one address under a scope's backstop. */
export const ipBucket = (scope: string, ip: string): string => `${scope}:ip:${ip}`;

/** Count one hit on a per-key bucket (held apart from the address buckets). */
export function keyCounted(name: string, limit: number, windowMs = 10 * 60 * 1000): boolean {
  return count(keyHits, name, limit, windowMs);
}

/** One admitted request on a refundable bucket. Only keyRefund reads it. */
export type KeyHold = { readonly at: number };
// A third map, for buckets whose hits can be given back. A hold is one admitted request;
// a refused request adds none, so it never uses up the allowance and is never given back
// in place of another request. Bounded like the others.
const keyHolds = new Map<string, KeyHold[]>();

/**
 * Admit one request on a refundable per-key bucket: its hold, or null when `limit` holds
 * are live in the window. A refused request adds nothing. keyCounted is unchanged for
 * every other route.
 */
export function keyReserve(name: string, limit: number, windowMs = 10 * 60 * 1000): KeyHold | null {
  const now = Date.now();
  const live = (keyHolds.get(name) ?? []).filter((h) => now - h.at < windowMs);
  keyHolds.delete(name); // re-insert, so map order is least recently used first
  if (live.length >= limit) {
    if (live.length) keyHolds.set(name, live);
    return null;
  }
  const hold: KeyHold = { at: now };
  live.push(hold);
  keyHolds.set(name, live);
  if (keyHolds.size > MAX_BUCKETS) evict(keyHolds, now, windowMs, (h) => h.at);
  return hold;
}

/**
 * Give back exactly the request `hold` admitted, for a call the caller decides should not
 * count (see notActedOn in register-submit.ts). A no-op when that hold has expired, was
 * evicted or was already given back, so it never takes another request's count and never
 * makes a bucket. Address buckets have no refund: the per-IP limit counts every request.
 */
export function keyRefund(name: string, hold: KeyHold): void {
  const live = keyHolds.get(name);
  const i = live ? live.indexOf(hold) : -1;
  if (i >= 0) live!.splice(i, 1);
}

/**
 * True when this IP is over `perIp`, or this secret over `perKey`, in 10 minutes. The IP
 * is checked first: a refused address makes no key bucket, so cycling keys can't fill
 * the map. A key under its limit still counts toward the IP's backstop.
 */
export function keyLimited(scope: string, secret: string, ip: string, perKey: number, perIp = IP_BACKSTOP): boolean {
  if (rateLimited(ipBucket(scope, ip), perIp)) return true;
  return keyCounted(keyBucket(scope, secret), perKey);
}

/**
 * The limit for a link route. With the Rep app on: per link key, with the IP backstop, so
 * many people behind one office IP are never limited. With it off: a plain per-IP limit.
 */
export function journeyLimited(scope: string, secret: string, ip: string, perKey: number, repAppOn: boolean): boolean {
  return repAppOn ? keyLimited(scope, secret, ip, perKey) : rateLimited(`${scope}:${ip}`, perKey);
}

/** Test hook: the bucket names held now. Lets a test prove no raw key is stored. */
export const rateBuckets = (): string[] => [...hits.keys(), ...keyHits.keys(), ...keyHolds.keys()];

export const clientIp = (request: Request, fallback = 'unknown') =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || fallback;
