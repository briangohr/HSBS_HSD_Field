// Ledger-level checks and the one balance every pay screen shows (TSM pay plan v3.3,
// "The award record, schema 2" and Task 3). A row can pass alone and still fail here.
//
// Schema 1 is every row HSBS 10 writes today: no Schema Version, no Record Type. It reads
// exactly as before: an Award, Eligible unless Void, never a problem only because the
// schema 2 columns are missing. Schema 2 adds Record Type (Award or Adjustment), signed
// adjustments that point at a parent Award Key, and an Eligibility the writer sets.
//
// Only Eligible rows that pass every rule count as money. A Held row, or a row that breaks
// a rule, counts in "needs review" and makes the balance incomplete, so a screen never
// shows a total it cannot stand behind as if it were whole.

/**
 * @typedef {{
 *   referralId: string, company: string, event: string, amount: number, status: string,
 *   earnedOn: string, paidOn: string, schemaVersion: number, recordType: 'Award' | 'Adjustment',
 *   awardKey: string, adjustmentId: string, parentAwardKey: string, adjustmentReason: string,
 *   eligibility: 'Eligible' | 'Ineligible' | 'Held', review?: string,
 * }} LedgerRow
 * @typedef {{ id: string, rule: string, reason: string }} Problem
 */

const idOf = (r, i) => r.adjustmentId || r.awardKey || `row ${i + 1}`;
const isAward = (r) => r.recordType !== 'Adjustment';
const voided = (r) => r.status === 'Void' || r.eligibility === 'Ineligible';

/**
 * Applies L1 to L5 to the rows one person can see. Returns new row objects; a row that
 * breaks a rule carries `review` (the rule name). Rows are never dropped here.
 * L5 checks schema 2 awards only: a schema 1 row is read exactly as today.
 * @template {LedgerRow} T
 * @param {T[]} rows sanitized rows (sanitizeLedger)
 * @returns {{ rows: T[], problems: Problem[] }}
 */
export function checkLedger(rows) {
  const list = rows.map((r) => ({ ...r, review: '' }));
  /** @type {Problem[]} */
  const problems = [];
  const flag = (r, i, rule, reason) => {
    if (r.review) return;
    r.review = rule;
    problems.push({ id: idOf(r, i), rule, reason });
  };

  // L1: an Award Key and an Adjustment ID are each unique.
  const seen = (pick) => {
    const count = new Map();
    for (const r of list) {
      const k = pick(r);
      if (k) count.set(k, (count.get(k) ?? 0) + 1);
    }
    return count;
  };
  const awardKeys = seen((r) => (isAward(r) ? r.awardKey : ''));
  const adjIds = seen((r) => (isAward(r) ? '' : r.adjustmentId));
  list.forEach((r, i) => {
    if (isAward(r) && r.awardKey && awardKeys.get(r.awardKey) > 1) flag(r, i, 'L1', 'Two awards share an Award Key');
    if (!isAward(r) && adjIds.get(r.adjustmentId) > 1) flag(r, i, 'L1', 'Two adjustments share an Adjustment ID');
  });

  // L5: one Case and Event has one award (schema 2 only; the key says so, this catches a
  // hand-made key that breaks the pattern). The site sees referral and company, which is
  // the case for a field rep.
  const byEvent = seen((r) => (isAward(r) && r.schemaVersion === 2 ? `${r.referralId}|${r.company}|${r.event}` : ''));
  list.forEach((r, i) => {
    if (isAward(r) && r.schemaVersion === 2 && byEvent.get(`${r.referralId}|${r.company}|${r.event}`) > 1)
      flag(r, i, 'L5', 'Two awards for one lead and event');
  });

  // L2 and L4: every adjustment names a parent award this person can see, for the same
  // company, and that award is not Void.
  const parents = new Map(list.filter((r) => isAward(r) && r.awardKey && !r.review).map((r) => [r.awardKey, r]));
  list.forEach((r, i) => {
    if (isAward(r)) return;
    const parent = parents.get(r.parentAwardKey);
    if (!parent) flag(r, i, 'L2', 'Adjustment with no parent award');
    else if (parent.company !== r.company) flag(r, i, 'L2', 'Adjustment and parent award name different companies');
    else if (voided(parent)) flag(r, i, 'L4', 'Adjustment on a Void award');
  });

  // L3: an award plus its adjustments never goes below 0. Every adjustment on that award
  // is held, since no one of them alone is the wrong one.
  const net = new Map();
  for (const r of list) {
    if (isAward(r) || r.review) continue;
    net.set(r.parentAwardKey, (net.get(r.parentAwardKey) ?? 0) + r.amount);
  }
  list.forEach((r, i) => {
    if (isAward(r) || r.review) return;
    const parent = parents.get(r.parentAwardKey);
    if (parent && parent.amount + net.get(r.parentAwardKey) < 0) flag(r, i, 'L3', 'Adjustments take the award below $0');
  });

  return { rows: /** @type {T[]} */ (list), problems };
}

/**
 * Whether a checked row counts as money: Eligible and breaking no rule.
 * @param {LedgerRow} r
 */
export const counts = (r) => r.eligibility === 'Eligible' && !r.review;

/**
 * Whether a checked row is held out for review (Held, or it broke a rule). Pending review
 * is today's own state (D10) and stays its own total, as on main.
 * @param {LedgerRow} r
 */
export const needsReview = (r) => r.eligibility === 'Held' || Boolean(r.review);

/**
 * The one balance. Earned = Waiting + Paid, over counted rows, adjustments signed.
 * `needsReview` is the dollars held out (Pending review, Held and rule breaks);
 * `needsReviewCount` counts Held and rule-break rows plus `dropped` (rows the reader
 * refused, such as a Payee Role it does not know). `complete` is false when any is held.
 * @param {LedgerRow[]} rows checked rows (checkLedger)
 * @param {Problem[]} problems from checkLedger
 * @param {number} [dropped]
 */
export function balance(rows, problems, dropped = 0) {
  let waiting = 0;
  let paid = 0;
  let pendingReview = 0;
  let held = 0;
  let heldCount = 0;
  for (const r of rows) {
    if (needsReview(r)) {
      held += Math.abs(r.amount);
      heldCount += 1;
      continue;
    }
    if (!counts(r)) continue;
    if (r.status === 'Waiting') waiting += r.amount;
    else if (r.status === 'Paid') paid += r.amount;
    else if (r.status === 'Pending review') pendingReview += r.amount;
  }
  // A problem always marks its row, so heldCount already counts it; the max guards a
  // caller that passes problems for rows it left out.
  const needsReviewCount = Math.max(heldCount, problems.length) + dropped;
  return {
    earned: waiting + paid,
    waiting,
    paid,
    pendingReview,
    needsReview: pendingReview + held,
    needsReviewCount,
    complete: needsReviewCount === 0,
  };
}

/** `+$100` or `-$100`, for an adjustment line. */
export const signedDollars = (n) => `${n < 0 ? '-' : '+'}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

/** "1 amount needs review." or "3 amounts need review." */
export const reviewText = (n) => (n === 1 ? '1 amount needs review.' : `${n} amounts need review.`);
