// The rep app's two flow reads (the list and the ledger), behind the short cache in
// flow-cache.mjs, and the money view built from them. One place, so /api/referral-list and
// /api/earnings share one answer instead of each asking the flow.
//
// Cost of a Track open, counted at the flow (counting the role check): a cold open is
// up to THREE flow runs, started together (list, ledger, and the lookup below that says
// whether the key is a Rep's). A warm open is zero.
import { cacheTtlMs, readThrough } from './flow-cache.mjs';
import { ReferralKeyUnknownError, listEarnings, listReferrals, lookupReferral } from './field-flow.mjs';
import { moneyForReferrals, sanitizeLedger, summarizeEarnings } from './rep-earnings.mjs';
import { DEFAULT_PAY_PLAN, parsePayPlan, payTerms, usableStaffingPlan } from './rep-pay-plan.mjs';

/**
 * Is this key a Rep's? The list and earnings answers carry no role, so the flow's own
 * lookup says. Asked beside every read that could be held, and the answer is held only
 * when it is yes: a key the lookup does not confirm (or a lookup that fails) never gets a cache entry, even
 * if the browser sends `fresh` or anything else. Only a Rep answer can be held, and so
 * only a Rep answer can ever be served from memory (docs/field-flow-contract.md T4).
 * @param {string} key
 */
const isRepKey = (key, seen) => async () => {
  let referrer;
  const asking = lookupReferral(key);
  inFlight.set(key, asking);
  try {
    referrer = await asking;
  } catch (err) {
    remember(key, UNKNOWN);
    throw err;
  } finally {
    if (inFlight.get(key) === asking) inFlight.delete(key);
  }
  remember(key, referrer);
  // The same answer, handed to a caller that asks for it. No extra flow run.
  if (seen) seen(referrer);
  return referrer.role === 'Rep';
};

/** @type {Map<string, Promise<unknown>>} role checks running now, by key */
const inFlight = new Map();
/**
 * The role check running for this key, if there is one: the route waits on it instead of
 * asking again (a read that failed over before its check finished). Rejects if the check
 * fails.
 * @param {string} key
 */
export const classificationInFlight = (key) => inFlight.get(key);

// What the role check last found for a key, held a short time. A read that joins another
// caller's in-flight read never runs its own check, so the route asks here instead: the
// check always finishes before the shared read resolves. UNKNOWN means the check failed,
// and the route then refuses (fails closed). No entry means no check ran: a warm read,
// which only a Rep key can be.
const UNKNOWN = Symbol('unknown');
const CLASS_TTL_MS = 45_000;
const CLASS_MAX = 5_000;
/** @type {Map<string, { at: number, referrer: unknown }>} */
const classified = new Map();
/** @param {string} key @param {unknown} referrer */
function remember(key, referrer) {
  classified.delete(key);
  classified.set(key, { at: Date.now(), referrer });
  if (classified.size > CLASS_MAX) classified.delete(classified.keys().next().value);
}
/** @param {string} key */
export function classificationFor(key) {
  const hit = classified.get(key);
  return hit && Date.now() - hit.at < CLASS_TTL_MS ? hit.referrer : undefined;
}
export const UNKNOWN_CLASS = UNKNOWN;

/** The role check failed (a timeout, a 5xx), so the read is not served: try again. */
export class RepUnverifiedError extends Error {
  constructor() {
    super('rep check failed');
    this.name = 'RepUnverifiedError';
  }
}

/**
 * Fail closed: a list or ledger read is served only for a key the 1F lookup confirms as a
 * Rep (Codex P0 on HSBS_HSD_Field#1). The cache's role check (isRepKey) only decides
 * whether an answer may be held; this decides whether it may be returned at all.
 *   - A warm read came from memory, and only confirmed Rep keys are ever held: served.
 *   - Otherwise this caller's own role check decides. A check still running for this key
 *     is waited on first (no new flow run), so an older result is never used in place of
 *     a newer check that has not finished (Codex P0 on HSBS_HSD_Field#1, round 2: a fresh
 *     read whose ledger fails fast). Only a read that joined another caller's, whose
 *     check finished before that read resolved, uses the held result.
 *   - The cache is off (`cache` false, or FLOW_CACHE_SECONDS=0): no check ran beside the
 *     read, so the lookup is asked now. An older check is never reused then.
 * A lookup that refuses the key throws ReferralKeyUnknownError (404). One that failed
 * throws RepUnverifiedError (502). Nothing is returned for a key that was not confirmed.
 * @param {string} key
 * @param {{ referrer?: unknown, warm?: boolean, cache?: boolean }} seen
 */
export async function confirmRep(key, { referrer, warm, cache = true } = {}) {
  if (warm) return;
  const cacheOn = cache && cacheTtlMs() > 0;
  let r = referrer;
  if (!r && cacheOn) {
    const running = classificationInFlight(key);
    if (running) {
      try {
        r = await running;
      } catch {
        r = UNKNOWN;
      }
    } else {
      r = classificationFor(key);
    }
  }
  if (r === UNKNOWN) {
    // The check failed. Ask once more, so a refused key is a 404 and not a 502.
    try {
      r = await lookupReferral(key);
    } catch (err) {
      if (err instanceof ReferralKeyUnknownError) throw err;
      throw new RepUnverifiedError();
    }
  }
  if (!r) r = await lookupReferral(key);
  if (/** @type {any} */ (r).role !== 'Rep') throw new ReferralKeyUnknownError('flow-identity', 'role:bad');
}

/** @param {string} key @param {{ fresh?: boolean, cache?: boolean, seen?: (referrer: unknown) => void, onWarm?: () => void }} [opts] */
export const cachedReferrals = (key, opts = {}) =>
  readThrough('list', key, () => listReferrals(key), { ...opts, mayStore: isRepKey(key, opts.seen) });

/** @param {string} key @param {{ fresh?: boolean, cache?: boolean, seen?: (referrer: unknown) => void, onWarm?: () => void }} [opts] */
export const cachedEarnings = (key, opts = {}) =>
  readThrough('earnings', key, () => listEarnings(key), { ...opts, mayStore: isRepKey(key, opts.seen) });

/** Only the ledger half of a snapshot failed. The list is fine and can be read on its own. */
export class LedgerReadError extends Error {
  /** @param {unknown} cause the ledger's own error  @param {unknown[]} referrals the list that did load */
  constructor(cause, referrals) {
    super('ledger read failed');
    this.cause = cause;
    this.referrals = referrals;
  }
}

/**
 * The list and the ledger read together and held together, as one snapshot. Counting the
 * role lookup that runs beside them (isRepKey), a cold snapshot is three flow runs; a held
 * one is none. If either read fails the whole snapshot fails and nothing of it is held, so
 * a later read can never pair a new list with an older ledger (or the reverse) from two
 * different moments.
 * @param {string} key @param {{ fresh?: boolean, cache?: boolean, seen?: (referrer: unknown) => void, onWarm?: () => void }} [opts]
 * @returns {Promise<{ referrals: unknown[], ledger: unknown }>}
 */
export const cachedSnapshot = (key, opts = {}) =>
  readThrough(
    'snapshot',
    key,
    async () => {
      const listRead = listReferrals(key);
      const ledgerRead = listEarnings(key);
      // The ledger is observed here, so a ledger failure (or one that lands after the list
      // has already failed) is never an unhandled rejection.
      const ledger = ledgerRead.then(
        (value) => ({ ok: true, value }),
        (reason) => ({ ok: false, reason }),
      );
      // The list decides who the rep is and whether the link works, and Track cannot draw
      // without it. So its failure is the snapshot's failure, as it is, the moment it comes:
      // never after the ledger's own timeout. Nothing of the snapshot is held then.
      const referrals = await listRead;
      // A ledger failure alone is marked, so the route can still show the list with the
      // money as "--".
      const earnings = await ledger;
      if (!earnings.ok) throw new LedgerReadError(earnings.reason, referrals);
      return { referrals, ledger: earnings.value };
    },
    { ...opts, mayStore: isRepKey(key, opts.seen) },
  );

/**
 * What /api/earnings answers (pay on): the summary and the per-referral money lines, and
 * `terms`, the pay terms they were worded from (payTerms in rep-pay-plan.mjs). One plan
 * words all three, so the page can tell when its own promises are older than these.
 * Throws when the ledger has a bad row (the routes turn that into a 502).
 * @param {unknown[]} referrals
 * @param {unknown} ledger
 * @param {import('./rep-pay-plan.mjs').PayPlan | null | undefined} plan null: REP_PAY_PLAN
 *   is bad, so amounts come from the rows and nothing is promised. undefined: the v3 plan.
 * @param {import('./rep-pay-plan.mjs').StaffingPayPlan | null} [staffing] the staffing plan
 *   (REP_PAY_PLAN_STAFFING), or null: staffing promises nothing. Its amounts never change a
 *   total, and the terms name it, so a page worded under another staffing plan notices.
 */
export function moneyView(referrals, ledger, plan, staffing = null) {
  const rows = sanitizeLedger(ledger);
  const used = plan === undefined ? parsePayPlan(DEFAULT_PAY_PLAN) : plan;
  const st = usableStaffingPlan(staffing) ? staffing : null;
  const plans = { healthFirst: used, staffing: st };
  return {
    summary: summarizeEarnings(rows, referrals, plans),
    money: moneyForReferrals(referrals, rows, undefined, plans),
    terms: payTerms(true, used, st),
  };
}
