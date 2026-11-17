// The HealthFirst rep SPIFF plan (spec v3 section 5, Brian 11/9). The pay structure is
// not final, so nothing on the site is tied to one plan. One setting, REP_PAY_PLAN, says
// what each event pays, and every promise on every screen is worded from it. Totals never
// come from here: Earned, Waiting and Paid always add up the ledger rows HSBS 10 wrote, so
// rows earned under an earlier plan still count and a paid row stays paid (D3).
//
// REP_PAY_PLAN is a short list of event:dollars, comma separated:
//   reached:50,signed:100,manager:50   the approved v3 plan (the default when unset)
//   signed:150                          closed won only: one award when the office signs
//   signed:150,manager:50               closed won, with the manager's award (Brian's
//                                       11/9 draft; still needs Katy and Tracy, spec D15)
//   reached:100,manager:50              HealthFirst's 11/11 plan: the rep at reached, the
//                                       manager at the sign, no sign award to the rep
//   reached:100                         reached only: nothing is paid at the sign, to the
//                                       rep or the manager (rep app v3 check 23)
// Each event is optional, but a plan must pay the rep something (`reached` or `signed`),
// so `manager:50` alone is refused. Nothing has to be paid at the sign. Whole dollars, 1
// to 1000. Anything else is refused, and with no valid plan the site shows no dollar
// amounts.
// HSBS 10 must use the same amounts (BB1 build sheet 4).
//
// A plan per company (field two-track spec, section 6). The company keys are exactly
// `HealthFirst` and `Staffing` (spec section 4). REP_PAY_PLAN is the HealthFirst plan, as
// above. REP_PAY_PLAN_STAFFING is the Staffing plan, three parts, all required:
//   reached_private:100,reached_group:200,manager:50
// `reached_private` pays a Reached award on a `Private practice`, `reached_group` one on a
// `Group`, and `manager` pays at the sign. Unset or bad means no staffing plan: staffing
// shows status only. A bad staffing value never turns off HealthFirst pay. Earned and
// paid amounts always come from ledger rows, never from a plan, so no plan hides a row.

export const DEFAULT_PAY_PLAN = 'reached:50,signed:100,manager:50';
const EVENTS = ['reached', 'signed', 'manager'];
const MAX = 1000;

/**
 * @typedef {{ reached: number, signed: number, manager: number }} PayPlan
 * Dollars per event. 0 means that event pays nothing under this plan.
 */

/**
 * @param {unknown} text
 * @returns {PayPlan | null}
 */
export function parsePayPlan(text) {
  if (typeof text !== 'string') return null;
  const plan = { reached: 0, signed: 0, manager: 0 };
  const seen = new Set();
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  for (const part of parts) {
    const m = /^([a-z]+)\s*:\s*(\d{1,4})$/i.exec(part);
    if (!m) return null;
    const event = m[1].toLowerCase();
    const amount = Number(m[2]);
    if (!EVENTS.includes(event) || seen.has(event)) return null;
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX) return null;
    seen.add(event);
    plan[/** @type {keyof PayPlan} */ (event)] = amount;
  }
  return plan.reached > 0 || plan.signed > 0 ? plan : null;
}

/**
 * @typedef {{ reachedPrivate: number, reachedGroup: number, manager: number }} StaffingPayPlan
 * Dollars per staffing event. Every amount is at least 1: all three parts are required.
 */

const STAFFING_KEYS = /** @type {const} */ ({
  reached_private: 'reachedPrivate',
  reached_group: 'reachedGroup',
  manager: 'manager',
});

/**
 * REP_PAY_PLAN_STAFFING, read as strictly as REP_PAY_PLAN.
 * @param {unknown} text
 * @returns {StaffingPayPlan | null}
 */
export function parseStaffingPayPlan(text) {
  if (typeof text !== 'string') return null;
  const plan = { reachedPrivate: 0, reachedGroup: 0, manager: 0 };
  const seen = new Set();
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  for (const part of parts) {
    const m = /^([a-z_]+)\s*:\s*(\d{1,4})$/i.exec(part);
    if (!m) return null;
    const key = m[1].toLowerCase();
    const amount = Number(m[2]);
    if (!Object.hasOwn(STAFFING_KEYS, key) || seen.has(key)) return null;
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX) return null;
    seen.add(key);
    plan[STAFFING_KEYS[/** @type {keyof typeof STAFFING_KEYS} */ (key)]] = amount;
  }
  return seen.size === Object.keys(STAFFING_KEYS).length ? plan : null;
}

/** The company keys a pay plan can be set for (spec section 4), spelled exactly. */
export const PAY_COMPANIES = Object.freeze(['HealthFirst', 'Staffing']);

/**
 * The plan for one company, from settings (process.env by default). HealthFirst falls
 * back to the approved v3 plan when REP_PAY_PLAN is unset, as before. Staffing has no
 * default. Any other company has no plan. null means no dollars for that company.
 * @param {unknown} company
 * @param {Record<string, string | undefined>} [settings]
 * @returns {PayPlan | StaffingPayPlan | null}
 */
export function payPlanFor(company, settings = process.env) {
  if (company === 'HealthFirst') return payPlanFrom(settings.REP_PAY_PLAN);
  if (company === 'Staffing') {
    const raw = settings.REP_PAY_PLAN_STAFFING;
    return parseStaffingPayPlan(typeof raw === 'string' ? raw.trim() : '');
  }
  return null;
}

/** Unset or blank means the approved v3 plan. A set but bad value is no plan at all. */
export function payPlanFrom(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  return parsePayPlan(text || DEFAULT_PAY_PLAN);
}

const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

// Field two-track spec section 6, "Promise wording": every HealthFirst promise that rep app
// v3 worded as "when HealthFirst reaches the office" also waits for the partner to confirm
// the lead qualifies (T16, T17): the pay line, the receipt, the lead screen money line,
// "Up to $X more" and the empty My Earnings line.

/** The line under the header (spec section 2). */
export function payLine(plan) {
  if (plan.reached && !plan.signed) return `You earn ${usd(plan.reached)} when HealthFirst reaches the office and confirms the lead qualifies.`;
  return plan.reached
    ? `You earn ${usd(plan.reached)} when HealthFirst reaches the office and confirms the lead qualifies, and ${usd(plan.signed)} more when it signs.`
    : `You earn ${usd(plan.signed)} when the office signs.`;
}

/** The receipt's money line. */
export function receiptMoney(plan, contact) {
  if (plan.reached && !plan.signed) return `You'll earn ${usd(plan.reached)} when HealthFirst reaches ${contact} and confirms the lead qualifies.`;
  return plan.reached
    ? `You'll earn ${usd(plan.reached)} when HealthFirst reaches ${contact} and confirms the lead qualifies, and ${usd(plan.signed)} more if the office signs.`
    : `You'll earn ${usd(plan.signed)} if the office signs.`;
}

/**
 * A staffing plan that can word a promise: all three amounts are whole dollars, 1 to 1000,
 * as parseStaffingPayPlan returns them. Anything else promises nothing.
 * @param {unknown} plan
 * @returns {plan is StaffingPayPlan}
 */
export function usableStaffingPlan(plan) {
  const p = /** @type {any} */ (plan);
  return Boolean(p) && [p.reachedPrivate, p.reachedGroup, p.manager].every((n) => Number.isInteger(n) && n >= 1 && n <= MAX);
}

/** The staffing sentence for the empty My Earnings line. '' with no staffing plan. */
function staffingHowTo(staffing) {
  if (!usableStaffingPlan(staffing)) return '';
  return `${usd(staffing.reachedPrivate)} for a private practice, or ${usd(staffing.reachedGroup)} for a group, when Direct Dental reaches the customer and confirms the lead qualifies.`;
}

/**
 * My Earnings before anything is earned. With no plan (pay on, REP_PAY_PLAN bad) there is
 * nothing to promise: the line says only what the ledger says. `staffing` is the staffing
 * plan, passed only for a rep who has a staffing referral, so a HealthFirst-only rep reads
 * the HealthFirst line alone.
 * @param {PayPlan | null} plan
 * @param {StaffingPayPlan | null} [staffing]
 */
export function emptyEarnings(plan, staffing = null) {
  const st = staffingHowTo(staffing);
  if (!plan) return st ? `$0 so far. Here's how you earn: ${st}` : '$0 so far.';
  const hf =
    plan.reached && !plan.signed
      ? `$0 so far. Here's how you earn: ${usd(plan.reached)} when HealthFirst reaches an office you sent and confirms the lead qualifies.`
      : plan.reached
        ? `$0 so far. Here's how you earn: ${usd(plan.reached)} when HealthFirst reaches an office you sent and confirms the lead qualifies, ${usd(plan.signed)} more when it signs.`
        : `$0 so far. Here's how you earn: ${usd(plan.signed)} when an office you sent signs.`;
  return st ? `${hf} ${st}` : hf;
}

/**
 * What the partner has answered so far on one open referral (sheet F6): `reached` is the
 * partner's Yes to question 1, `qualified` the stored qualify answer and `practiceType`
 * the type on the case. They word promises only; no amount is ever earned from them.
 * @typedef {{ reached?: boolean, qualified?: string, practiceType?: string }} CaseFacts
 */

/** @param {string} partner @param {string} whom @param {CaseFacts} facts */
function stillToCome(partner, whom, facts) {
  const yes = facts.qualified === 'Yes';
  if (facts.reached && !yes) return `when ${partner} confirms the lead qualifies.`;
  if (yes && !facts.reached) return `when ${partner} reaches ${whom}.`;
  return `when ${partner} reaches ${whom} and confirms the lead qualifies.`;
}

/**
 * A card with nothing earned yet and the office still open. No plan, no line. A reached
 * case with no qualify answer reads "$100 when HealthFirst confirms the lead qualifies."
 * (spec section 6). It never says anything was earned.
 * @param {PayPlan | null} plan
 * @param {CaseFacts} [facts]
 */
export function notYetLine(plan, facts = {}) {
  if (!plan) return '';
  if (!plan.reached) return `${usd(plan.signed)} if they sign.`;
  const first = `${usd(plan.reached)} ${stillToCome('HealthFirst', 'them', facts)}`;
  return plan.signed ? `${first} ${usd(plan.signed)} more if they sign.` : first;
}

/**
 * The staffing promise on a lead screen with nothing earned yet (spec section 6, check
 * M23). The amount follows the practice type on the case and names the type it is for,
 * because the award is set by the type the partner confirms when it marks the lead
 * qualified (Award Practice Type, decision 82), never by this line. A case with no type
 * names both amounts. No staffing plan, no line.
 * @param {StaffingPayPlan | null} staffing
 * @param {CaseFacts} [facts]
 */
export function staffingNotYetLine(staffing, facts = {}) {
  if (!usableStaffingPlan(staffing)) return '';
  const amount =
    facts.practiceType === 'Group'
      ? `${usd(staffing.reachedGroup)} for a group`
      : facts.practiceType === 'Private practice'
        ? `${usd(staffing.reachedPrivate)} for a private practice`
        : `${usd(staffing.reachedPrivate)} for a private practice, or ${usd(staffing.reachedGroup)} for a group,`;
  return `${amount} ${stillToCome('Direct Dental', 'the customer', facts)}`;
}

/**
 * What one open staffing referral can still earn, for "Up to $X more": the group amount
 * unless the case says private practice. A case with no type counts as a group. It is a
 * promise only: the award is the ledger row HSBS 10 writes from Award Practice Type.
 * 0 with no staffing plan.
 * @param {StaffingPayPlan | null} staffing
 * @param {string} [practiceType]
 */
export function staffingUpTo(staffing, practiceType = '') {
  if (!usableStaffingPlan(staffing)) return 0;
  return practiceType === 'Private practice' ? staffing.reachedPrivate : staffing.reachedGroup;
}

/**
 * What signing still adds, after something is earned. Nothing when the sign pays the rep
 * nothing, or when there is no plan.
 * @param {PayPlan | null} plan
 */
export function signTail(plan) {
  return plan?.signed ? ` ${usd(plan.signed)} more if they sign.` : '';
}

/**
 * My Earnings' fourth line, for an "Up to" total from summarizeEarnings (rep app v3 section 5).
 * @param {PayPlan | null} plan
 * @param {number} amount
 */
export function upToLine(plan, amount) {
  if (!plan) return '';
  return plan.reached && !plan.signed
    ? `Up to ${usd(amount)} more if HealthFirst reaches your open referrals and confirms they qualify.`
    : `Up to ${usd(amount)} more if your open referrals sign.`;
}

/** The "Up to" line when every dollar in it is Direct Dental's. */
export const staffingUpToLine = (/** @type {number} */ amount) =>
  `Up to ${usd(amount)} more if Direct Dental reaches your open referrals and confirms they qualify.`;

/** The "Up to" line when it adds HealthFirst and Direct Dental amounts together. */
export const mixedUpToLine = (/** @type {number} */ amount) => `Up to ${usd(amount)} more from your open referrals.`;

/** The plan back as REP_PAY_PLAN text, for the page to hand its script. */
export function payPlanText(plan) {
  return ['reached', 'signed', 'manager']
    .filter((k) => plan[k] > 0)
    .map((k) => `${k}:${plan[k]}`)
    .join(',');
}

/** The staffing plan back as REP_PAY_PLAN_STAFFING text. */
export function staffingPlanText(plan) {
  return `reached_private:${plan.reachedPrivate},reached_group:${plan.reachedGroup},manager:${plan.manager}`;
}

export const NO_PLAN_TERMS = 'none';

/** Where the staffing plan starts in a terms string. Never part of a HealthFirst plan's text. */
const STAFFING_TERMS = ';staffing=';

/** The DOM event My Team fires with each /api/team answer's terms, for the rep app page. */
export const PAY_TERMS_EVENT = 'hsbs:pay-terms';

/** What a page shows in place of a promise worded from pay terms that have since changed. */
export const TERMS_CHANGED = 'Pay terms changed. Reload this page to see them.';

/**
 * The pay terms a screen was worded from, as one string (Codex P1s on #113). The page
 * carries it in data-pay-plan and every money answer carries it as `terms`, so a page
 * opened before REP_PAY_PLAN changed can tell its own promises are out of date.
 * '' is pay off. NO_PLAN_TERMS is pay on with no plan to word promises from (REP_PAY_PLAN
 * set but bad): ledger amounts still show, nothing is promised. Anything else is the plan.
 * Slice S5: with a staffing plan that words promises (REP_PAY_PLAN_STAFFING good), its text
 * follows after ";staffing=", so a staffing plan change is a terms change too. With none,
 * the terms are exactly the HealthFirst part, as before.
 * @param {boolean} pay
 * @param {PayPlan | null} plan
 * @param {StaffingPayPlan | null} [staffing]
 */
export function payTerms(pay, plan, staffing = null) {
  if (!pay) return '';
  const base = plan ? payPlanText(plan) : NO_PLAN_TERMS;
  return usableStaffingPlan(staffing) ? `${base}${STAFFING_TERMS}${staffingPlanText(staffing)}` : base;
}

/** The HealthFirst part of a terms string: what the page reads with parsePayPlan. */
export function healthFirstTerms(terms) {
  const t = typeof terms === 'string' ? terms : '';
  const at = t.indexOf(STAFFING_TERMS);
  return at < 0 ? t : t.slice(0, at);
}

/** The staffing plan in a terms string, or null when it carries none. */
export function staffingPlanFromTerms(terms) {
  const t = typeof terms === 'string' ? terms : '';
  const at = t.indexOf(STAFFING_TERMS);
  return at < 0 ? null : parseStaffingPayPlan(t.slice(at + STAFFING_TERMS.length));
}
