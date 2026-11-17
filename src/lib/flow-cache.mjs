// A short read-through cache for the rep app's flow reads (Track and My Earnings).
//
// Why: every read is one Power Automate run, and a Track open used to make three of them
// (the list, then the list again inside /api/earnings, then the ledger). With 500 to 900
// reps that is real load on the flows and on SharePoint. The cache keeps one answer per
// rep link for a short time, and shares one in-flight read between callers that ask at
// the same moment.
//
// What a Track open costs now: a cold open (nothing held, or the
// answer older than the TTL) is up to THREE flow runs, started together: the list, the
// ledger, and the lookup that says whether the key is a Rep's. A warm open is zero.
//
// What it is not: a source of truth. It lives in one serverless instance's memory, so
// another instance may hold an older answer or none. The answers are up to TTL seconds
// old (45 by default), counted from when the read started, not when it finished; a read
// that took nearly the whole TTL is not held at all. That is fine for a status screen and
// a money tile. These bypass it, so a rep never waits to see their own action:
//   - `fresh: true` (the Refresh button, and Track right after a send) reads the flow
//     and stores the result;
//   - a successful submit calls forgetKey(), so the next read in that instance is new.
//
// Who may be held is not decided here: callers pass `mayStore`, and rep-reads.mjs uses it
// to hold only keys the lookup confirms as Rep keys (docs/field-flow-contract.md T4).
//
// Rules this file keeps: errors are never cached; one rep's answer is never returned for
// another link; the key stays in memory only (it is never logged or put in a message);
// the map is bounded and drops its least recently used link first.

export const DEFAULT_TTL_SECONDS = 45;
export const MAX_TTL_SECONDS = 300;
/** Most rep links one warm instance remembers. */
export const MAX_KEYS = 5_000;
/** Most bytes (as JSON text) one warm instance holds in total. Least recently used links go first. */
export const MAX_TOTAL_BYTES = 48 * 1024 * 1024;
/** An answer bigger than this is served but not held, so one large history can't fill the cache. */
export const MAX_ENTRY_BYTES = 1024 * 1024;

/** FLOW_CACHE_SECONDS: 0 turns the cache off, unset means the default, never above 5 minutes. */
export function cacheTtlMs() {
  const raw = typeof process === 'undefined' ? undefined : process.env.FLOW_CACHE_SECONDS;
  if (raw === undefined || raw === '') return DEFAULT_TTL_SECONDS * 1000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_TTL_SECONDS * 1000;
  return Math.min(n, MAX_TTL_SECONDS) * 1000;
}

/** @type {Map<string, Map<string, { at: number, value?: unknown, size: number, fresh: boolean, promise?: Promise<unknown> | null }>>} */
const byKey = new Map();
let totalBytes = 0;

/** Remove one rep link and give back the bytes it held. */
function dropBucket(key) {
  const bucket = byKey.get(key);
  if (!bucket) return;
  for (const entry of bucket.values()) totalBytes -= entry.size;
  byKey.delete(key);
}

/**
 * Remove one entry of a link and give back its bytes. A link left with no entries is
 * removed too: an empty bucket holds nothing but still counts toward MAX_KEYS, so enough
 * uncached or failed reads would push real Rep answers out.
 */
function dropEntry(key, scope) {
  const bucket = byKey.get(key);
  const entry = bucket?.get(scope);
  if (!bucket || !entry) return;
  totalBytes -= entry.size;
  bucket.delete(scope);
  if (bucket.size === 0) byKey.delete(key);
}

const copy = (value) => (value === undefined ? value : structuredClone(value));

function bucketFor(key) {
  let bucket = byKey.get(key);
  if (bucket) {
    byKey.delete(key); // re-insert: least recently used first
  } else {
    bucket = new Map();
  }
  byKey.set(key, bucket);
  while (byKey.size > MAX_KEYS) {
    const oldest = byKey.keys().next().value;
    if (oldest === undefined || oldest === key) break;
    dropBucket(oldest);
  }
  return bucket;
}

/**
 * Read `scope` for `key`: from memory when it is younger than the TTL, otherwise through
 * `load`. A read already in flight is shared, fresh or not.
 *
 * @template T
 * @param {string} scope  'list' or 'earnings': what is being read
 * @param {string} key    the rep link; memory only
 * @param {() => Promise<T>} load
 * @param {{ fresh?: boolean, cache?: boolean, ttlMs?: number, now?: () => number, mayStore?: () => Promise<boolean>, onWarm?: () => void }} [opts]
 *   `cache: false` skips the cache entirely (no read, no store, no sharing).
 *   `mayStore` is asked at the same time as `load` and decides, once the answer is in,
 *   whether it may be held. It must resolve true; false, or a failure, serves the answer
 *   and holds nothing. So a held entry exists only if `mayStore` said yes for that read.
 * @returns {Promise<T>}
 */
export async function readThrough(scope, key, load, opts = {}) {
  const ttl = opts.ttlMs ?? cacheTtlMs();
  if (ttl <= 0 || opts.cache === false) return load();
  const now = opts.now ?? Date.now;
  const bucket = bucketFor(key);
  const hit = bucket.get(scope);
  if (hit) {
    // An ordinary read may share a read already in flight. A fresh read never joins one,
    // fresh or not: any read in flight could have started before the rep's send (on this
    // instance or another), so its answer could leave out the referral just sent. A fresh
    // read starts its own call and replaces the entry; the older read still answers its own
    // caller but no longer stores anything.
    if (hit.promise && !opts.fresh) return /** @type {Promise<T>} */ (hit.promise).then(copy);
    if (!hit.promise && !opts.fresh && now() - hit.at < ttl) {
      // Served from memory: only a Rep key is ever held, so the caller can know this was one.
      opts.onWarm?.();
      return /** @type {T} */ (copy(hit.value));
    }
  }
  if (hit) totalBytes -= hit.size;
  // The TTL runs from here, when the read and its Rep check start together, not from when
  // the slowest of them finishes. So an answer can never be readable longer than the TTL
  // after the role check began, however slowly the flows answer (docs/field-flow-contract.md T4).
  const startedAt = now();
  const entry = { at: 0, value: undefined, size: 0, fresh: opts.fresh === true, promise: null };
  const allowed = opts.mayStore ? Promise.resolve().then(opts.mayStore).then((ok) => ok === true, () => false) : null;
  const pending = load().then(
    async (value) => {
      const ok = allowed ? await allowed : true;
      // forgetKey() or a newer read may have replaced this entry while it loaded; only
      // the entry still in place may store its answer.
      if (!ok && byKey.get(key)?.get(scope) === entry) dropEntry(key, scope);
      if (ok && byKey.get(key)?.get(scope) === entry) {
        const size = JSON.stringify(value ?? null).length;
        entry.promise = null;
        // Time left on the TTL that began at startedAt. Under a margin (a tenth of the TTL,
        // at most a second) it is not worth holding, so a slow read is served and forgotten.
        const left = startedAt + ttl - now();
        if (size > MAX_ENTRY_BYTES || left <= Math.min(1000, ttl / 10)) {
          dropEntry(key, scope); // too big, or already stale: served, not remembered
        } else {
          entry.value = copy(value);
          entry.at = startedAt;
          entry.size = size;
          totalBytes += size;
          // Over the total: drop the least recently used other links until it fits.
          for (const other of byKey.keys()) {
            if (totalBytes <= MAX_TOTAL_BYTES) break;
            if (other !== key) dropBucket(other);
          }
        }
      }
      return value;
    },
    (err) => {
      if (byKey.get(key)?.get(scope) === entry) dropEntry(key, scope);
      throw err;
    },
  );
  entry.promise = pending;
  bucket.set(scope, entry);
  return pending;
}

/** Forget everything held for one rep link (after that rep sends a referral). */
export function forgetKey(key) {
  if (typeof key === 'string') dropBucket(key);
}

/** Test helper: how many rep links are held. */
export const cachedKeyCount = () => byKey.size;

/** Test helper: drop everything. */
export const clearFlowCache = () => {
  byKey.clear();
  totalBytes = 0;
};

/** Test helper: bytes held, as JSON text. */
export const cachedBytes = () => totalBytes;
