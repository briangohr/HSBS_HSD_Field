// My Earnings and the money lines for the HealthFirst rep app (spec v3 section 2, D3,
// D8, D10, D11). One module for the money math, so every screen shows the same totals.
// Input is the rep's own SPIFF Ledger rows from HSBS 1F action "earnings" (Payee Role
// Rep only; the manager's rows belong to My Team) and the rep's referral list.
// Contract: docs/field-flow-contract.md.
//
// Money words (D11): Earned = Waiting + Paid. Pending review (an auto-reached award
// Brian hasn't cleared, D10) and Void are never counted. A Void row always shows its
// reason. A Paid row stays paid (D3).
//
// What an event will pay comes from the plan (src/lib/rep-pay-plan.mjs, REP_PAY_PLAN):
// it words the promises ("$100 more if they sign", "Up to $X more"). What has been
// earned always comes from the ledger rows, whatever plan wrote them.
//
// Field two-track slice S5 (spec section 6, "Ledger" and "What each track sees"): every
// ledger row carries its company (sheet F6: `company`, the company key). A row with no
// Company is HealthFirst, so every row written before the column existed reads exactly as
// a HealthFirst row. A staffing row's amount is the ledger's, written by HSBS 10 from Award
// Practice Type (decision 82); the site never works an earned amount out of a practice
// type, and the type it names on a line is the ledger row's own, never the rep's pick.
// Promises are worded per company: HealthFirst from REP_PAY_PLAN, staffing from
// REP_PAY_PLAN_STAFFING.

import { bucketOf, sanitizeReferral, shortDate, todayInNewYork } from './track.mjs';
import { REP_COMPANIES, companyName, keyForSolutions } from './rep-companies.mjs';
import {
  DEFAULT_PAY_PLAN,
  emptyEarnings,
  mixedUpToLine,
  notYetLine,
  parsePayPlan,
  signTail,
  staffingNotYetLine,
  staffingUpTo,
  staffingUpToLine,
  upToLine,
  usableStaffingPlan,
} from './rep-pay-plan.mjs';
import { FEED_MAX, repFeed } from './rep-track.mjs';

/** The approved v3 plan, for callers (and tests) that don't pass one. */
const V3_PLAN = /** @type {import('./rep-pay-plan.mjs').PayPlan} */ (parsePayPlan(DEFAULT_PAY_PLAN));

/**
 * The plans that word promises, one per company. Callers that pass one plan pass the
 * HealthFirst plan, as before slice S5, and staffing then promises nothing.
 * @typedef {import('./rep-pay-plan.mjs').PayPlan} PayPlan
 * @typedef {import('./rep-pay-plan.mjs').StaffingPayPlan} StaffingPayPlan
 * @typedef {{ healthFirst: PayPlan | null, staffing: StaffingPayPlan | null }} Plans
 */

/** @param {unknown} p */
const isHealthFirstPlan = (p) =>
  Boolean(p) && Number.isInteger(/** @type {any} */ (p).reached) && Number.isInteger(/** @type {any} */ (p).signed);

/**
 * @param {PayPlan | Plans | null | undefined} plan
 * @returns {Plans}
 */
export function plansOf(plan) {
  if (plan && typeof plan === 'object' && 'healthFirst' in plan && 'staffing' in plan) {
    const p = /** @type {Plans} */ (plan);
    return { healthFirst: isHealthFirstPlan(p.healthFirst) ? p.healthFirst : null, staffing: usableStaffingPlan(p.staffing) ? p.staffing : null };
  }
  // A staffing plan passed where the HealthFirst plan goes promises nothing (never NaN).
  return { healthFirst: isHealthFirstPlan(plan) ? /** @type {PayPlan} */ (plan) : null, staffing: null };
}

const HEALTHFIRST = 'HealthFirst';
const STAFFING = 'Staffing';
const PRACTICE_TYPES = ['Private practice', 'Group'];

/**
 * A ledger row's Company as a company key (spec section 4). Blank is HealthFirst (spec
 * section 6, "Ledger": every row written before the column existed is HealthFirst). A
 * Solutions value is read as its key. Anything else is '': the row still counts in every
 * total, because a total always equals the ledger, and names no company.
 * @param {unknown} v
 */
function ledgerCompany(v) {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t || t === HEALTHFIRST) return HEALTHFIRST;
  if (t === STAFFING) return STAFFING;
  return keyForSolutions(t);
}

/**
 * The company key of one referral list line (sheet F6): from `solutions` when the list
 * sends it, else from `company` as the Solutions value or the screen name. '' for any
 * other partner.
 * @param {Record<string, unknown>} line
 */
function lineKey(line) {
  const solutions = typeof line.solutions === 'string' ? line.solutions.trim() : '';
  const company = typeof line.company === 'string' ? line.company.trim() : '';
  return keyForSolutions(solutions) || keyForSolutions(company) || (REP_COMPANIES.find((c) => c.name === company)?.key ?? '');
}

// A status that proves the partner has already reached the customer: the partner's Yes to
// question 1 (rep-lead.mjs reads the same words as "talked with the doctor"), and every
// status past first contact, for both companies (Codex P1 on #132): a meeting, a proposal or
// agreement, a sign, and the older stored values for each. "No change this week" proves
// nothing. Only for wording a promise; nothing is earned from it.
const TALKED =
  /^(yes|talked with the (?:doctor|customer)|reached|reached the doctor|meeting held|meeting set|scheduled|complete|proposal or agreement sent|proposal|signed|won|closed - won|close won)\b/i;

/**
 * What one raw 1F list referral says about its company and the partner's answers, read
 * from the line Track speaks for (the HealthFirst line, or the first). A referral with no
 * line yet is HealthFirst, as the screens have always read it. Promises only: no amount is
 * ever earned from these facts.
 * @param {unknown} raw
 * @returns {{ company: string, reached: boolean, qualified: string, practiceType: string }}
 */
export function referralFacts(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : {};
  const list = Array.isArray(r.lines) ? r.lines : Array.isArray(r.cases) ? r.cases : [];
  const lines = /** @type {Record<string, unknown>[]} */ (list.filter((l) => l && typeof l === 'object' && !Array.isArray(l)));
  const line = lines.find((l) => lineKey(l) === HEALTHFIRST) ?? lines[0];
  if (!line) return { company: HEALTHFIRST, reached: r.reached === true, qualified: '', practiceType: '' };
  const company = lineKey(line);
  const status = s(line.status, 80) || s(line.partnerStatus, 80);
  const qualified = s(line.qualified, 10);
  const practiceType = s(line.practiceType, 40);
  return {
    company,
    reached: r.reached === true || TALKED.test(status),
    qualified: qualified === 'Yes' || qualified === 'No' ? qualified : '',
    practiceType: company === STAFFING && PRACTICE_TYPES.includes(practiceType) ? practiceType : '',
  };
}

/**
 * The company words on one ledger line: "HealthFirst", or "Direct Dental, Group" with the
 * ledger row's own practice type. '' for a company the site does not know.
 * @param {{ company: string, practiceType?: string }} row
 */
export function companyText(row) {
  const name = companyName(row.company);
  if (!name) return '';
  return row.company === STAFFING && row.practiceType ? `${name}, ${row.practiceType}` : name;
}

export const STATUSES = ['Pending review', 'Waiting', 'Paid', 'Void'];
export const EVENTS = ['Reached', 'Signed'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 1000;

const s = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, max);
// Exactly YYYY-MM-DD and a real calendar date (the contract's Eastern date). A timestamp
// or anything else drops the row: cutting it to a UTC date could show the wrong day.
const day = (v) => {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!DATE.test(t)) return '';
  const [y, m, d] = t.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d ? t : '';
};
export const dollars = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * One ledger row, checked. Anything malformed is dropped, never guessed at.
 * The default ('Rep') is My Earnings: a Manager row is always dropped there. 'Manager'
 * (My Team, slice 5) keeps only Payee Role Manager rows for a Signed event, and adds
 * the rep's email so the server can name the rep; it never reaches the browser.
 * @param {unknown} raw
 * @param {'Rep' | 'Manager'} [payeeRole]
 */
export function sanitizeLedgerRow(raw, payeeRole = 'Rep') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  const referralId = s(r.referralId, 80);
  const event = s(r.event, 20);
  const status = s(r.status, 20);
  const amount = typeof r.amount === 'number' ? r.amount : Number(s(r.amount, 12));
  const earnedOn = day(r.earnedOn);
  if (!referralId || !EVENTS.includes(event) || !STATUSES.includes(status)) return null;
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT || !earnedOn) return null;
  if (payeeRole === 'Manager') {
    if (s(r.payeeRole, 20) !== 'Manager' || event !== 'Signed') return null;
  } else if (r.payeeRole != null && s(r.payeeRole, 20) !== 'Rep') return null;
  const paidOn = day(r.paidOn);
  if (status === 'Paid' && !paidOn) return null;
  // One period, added where the sentence is built: strip any the flow sent.
  const voidReason = s(r.voidReason, 200).replace(/[.\s]+$/, '');
  const company = ledgerCompany(r.company);
  // The ledger's own Practice Type, kept on a staffing row only and only as stored. It
  // names the line; the amount is the row's, never worked out from the type.
  const practiceType = company === STAFFING && PRACTICE_TYPES.includes(s(r.practiceType, 40)) ? s(r.practiceType, 40) : '';
  const row = {
    company,
    practiceType,
    referralId,
    practiceName: s(r.practiceName, 160),
    event,
    amount,
    earnedOn,
    status,
    paidOn: status === 'Paid' ? paidOn : '',
    voidReason: status === 'Void' ? voidReason || 'This award did not qualify' : '',
    disputed: status === 'Paid' && r.disputed === true,
  };
  if (payeeRole !== 'Manager') return row;
  return { ...row, repEmail: s(r.repEmail, 320).toLowerCase() };
}

/**
 * @param {unknown} list
 * @param {'Rep' | 'Manager'} [payeeRole] 'Rep' unless this is a manager's own rows
 */
export function sanitizeLedger(list, payeeRole = 'Rep') {
  // No row cap: Earned must match the whole ledger. The flow answer is already bounded
  // (listEarnings refuses a body over 500 KB), so every row it sends is counted.
  // Pass the role explicitly: map's index must never land in the payeeRole slot.
  return (Array.isArray(list) ? list : []).map((r) => sanitizeLedgerRow(r, payeeRole)).filter(Boolean);
}

/**
 * What the row was earned for, in the company's words (board 5a): HealthFirst reaches an
 * office, Direct Dental a customer.
 * @param {{ event: string, company: string }} row
 */
function whatOf(row) {
  if (row.event === 'Signed') return 'Office signed';
  if (row.company === STAFFING) return `${companyName(STAFFING)} reached the customer`;
  if (row.company === HEALTHFIRST) return 'HealthFirst reached the office';
  return 'Reached the office';
}

// A Paid row Brian flagged stays Paid and in the Paid total (D3), and its money lines say
// "Disputed" (field two-track spec section 6: "the correction shows on the money lines as
// 'Not paid' or 'Disputed' from the ledger").
const DISPUTED = 'Disputed';

function statusWords(row) {
  if (row.status === 'Paid') return row.disputed ? `Paid on ${shortDate(row.paidOn)}. ${DISPUTED}` : `Paid on ${shortDate(row.paidOn)}`;
  if (row.status === 'Waiting') return 'Earned, waiting to be paid';
  if (row.status === 'Pending review') return 'Pending review';
  return `Not paid: ${row.voidReason}`;
}

/**
 * Signed and closed, worked out exactly as the Track tiles do (the flag or the line
 * statuses, docs/field-flow-contract.md), so the money never disagrees with the tile.
 * @param {{ signed?: boolean, closed?: boolean, lines?: { status: string }[] }} ref
 */
function stateOf(ref) {
  const bucket = Array.isArray(ref.lines)
    ? bucketOf(/** @type {any} */ (ref))
    : ref.signed
      ? 'signed'
      : ref.closed
        ? 'closed'
        : 'inProgress';
  return { signed: bucket === 'signed', closed: bucket === 'closed' };
}

/** The footer when a row or referral names a company the site does not know (Codex P1, #132). */
export const NEUTRAL_FOOTER = "Earnings follow your partners' updates.";

/**
 * The footer under My Earnings, naming the partners whose updates the rep's money follows
 * (board 5a). A rep whose rows and referrals are all HealthFirst (a blank Company is
 * HealthFirst), or who has none, reads it exactly as on main. A company the site does not
 * know ('' in keys) names no partner, so the footer then names none either.
 * @param {Set<string>} keys company keys on the rep's rows and referrals, '' for an unknown one
 */
export function earningsFooter(keys) {
  if (keys.has('')) return NEUTRAL_FOOTER;
  const hf = keys.has(HEALTHFIRST);
  const st = keys.has(STAFFING);
  if (st && hf) return `Earnings follow HealthFirst's and ${companyName(STAFFING)}'s updates.`;
  if (st) return `Earnings follow ${companyName(STAFFING)}'s updates.`;
  return EARNINGS_FOOTER;
}

/**
 * One My Earnings line, as board 5a draws it: the office and the amount, the company
 * (with the ledger row's practice type on a staffing row), what it was earned for, and
 * where it stands. A Void row shows no amount and no "what", only "Not paid" and its
 * reason. `label` is the whole line as one sentence, for a screen reader.
 * @param {NonNullable<ReturnType<typeof sanitizeLedgerRow>>} r
 */
function earningsLine(r) {
  const office = r.practiceName || 'Office';
  const isVoid = r.status === 'Void';
  // A Void line names the company alone, as board 5a draws it: it pays nothing, so no type.
  const company = isVoid ? companyName(r.company) : companyText(r);
  const what = whatOf(r);
  const words = statusWords(r);
  return {
    referralId: r.referralId,
    on: r.earnedOn,
    // The whole line for a screen reader. A Void line says only what it shows: the office,
    // the company and why it was not paid, never the event or a dollar amount (Codex P1).
    label: isVoid
      ? `${office}. ${company ? `${company}. ` : ''}${words}.`
      : `${shortDate(r.earnedOn)}. ${office}. ${company ? `${company}. ` : ''}${what}. ${dollars(r.amount)}. ${words}.`,
    office,
    amount: isVoid ? '' : dollars(r.amount),
    company,
    what: isVoid ? '' : what,
    status: isVoid ? `${words}.` : words,
  };
}

/**
 * Totals and lines for My Earnings, plus the Earned tile.
 * @param {ReturnType<typeof sanitizeLedger>} rows
 * @param {unknown} referrals raw 1F list rows, for "Up to $X more"
 * @param {PayPlan | Plans | null} [plan] the HealthFirst plan, or both plans. null: pay on
 *   with no plan to promise from (REP_PAY_PLAN bad). The totals and lines still come from
 *   the rows; "Up to" is 0 and no line promises anything.
 */
export function summarizeEarnings(rows, referrals, plan = V3_PLAN) {
  const plans = plansOf(plan);
  const hfPlan = plans.healthFirst;
  let waiting = 0;
  let paid = 0;
  let pendingReview = 0;
  for (const r of rows) {
    if (r.status === 'Waiting') waiting += r.amount;
    else if (r.status === 'Paid') paid += r.amount;
    else if (r.status === 'Pending review') pendingReview += r.amount;
  }
  const byRef = groupByReferral(rows);
  /** Company keys on the rep's rows and referrals, for the footer and the empty line. */
  const keys = new Set(rows.map((r) => r.company));
  const reachedPays = hfPlan?.reached ?? 0;
  const signedPays = hfPlan?.signed ?? 0;
  let upHealthFirst = 0;
  let upStaffing = 0;
  for (const raw of Array.isArray(referrals) ? referrals : []) {
    const ref = sanitizeReferral(raw);
    if (!ref) continue;
    const facts = referralFacts(raw);
    keys.add(facts.company);
    const state = stateOf(ref);
    // A lead the partner marked not qualified is closed (spec section 6), whatever the
    // status text says, and can't add to "Up to".
    if (state.closed || state.signed || facts.qualified === 'No') continue;
    const mine = byRef.get(ref.id) ?? [];
    // Any Signed row, void or not, settles the sign award: it was earned or ruled out.
    if (mine.some((r) => r.event === 'Signed')) continue;
    // Rows, all Void: a no-pay office (D12, D7). Its card says only "Not paid", so it
    // can't add to "Up to" either, under any plan.
    if (mine.length && mine.every((r) => r.status === 'Void')) continue;
    // Staffing pays the rep once, at reached and qualified (spec section 6). A Reached row
    // of any status settles it. With no staffing plan it adds nothing.
    if (facts.company === STAFFING) {
      if (!mine.some((r) => r.event === 'Reached')) upStaffing += staffingUpTo(plans.staffing, facts.practiceType);
      continue;
    }
    // Only a HealthFirst referral counts under the HealthFirst plan; another partner's
    // referral has no plan here and promises nothing.
    if (facts.company !== HEALTHFIRST) continue;
    // A reached-only plan (signed 0, such as reached:100,manager:50) counts the reached
    // award for each referral with no Reached row of any status, so a Pending review row
    // is not counted twice (rep app v3 check 23). A plan that pays on reaching and on
    // signing counts the sign award for reached offices only (spec section 5). A
    // closed-won plan counts every open referral, since signing is the only award.
    // The manager award never counts: "Up to" is the rep's.
    if (reachedPays && !signedPays) {
      if (!mine.some((r) => r.event === 'Reached')) upHealthFirst += reachedPays;
      continue;
    }
    const reached = mine.some((r) => r.event === 'Reached' && r.status !== 'Void');
    if (reached || !reachedPays) upHealthFirst += signedPays;
  }
  const upTo = upHealthFirst + upStaffing;
  const lines = [...rows].sort((a, b) => (a.earnedOn < b.earnedOn ? 1 : a.earnedOn > b.earnedOn ? -1 : 0)).map(earningsLine);
  // The "Up to" line and the empty My Earnings line are worded here, from the same plans
  // that counted upTo, so an amount and its condition never come from two plans (a page
  // opened before a plan changed words neither itself). upToText is blank when there
  // is nothing to promise.
  const upToText = upHealthFirst && upStaffing ? mixedUpToLine(upTo) : upHealthFirst ? upToLine(hfPlan, upTo) : upStaffing ? staffingUpToLine(upTo) : '';
  const emptyText = emptyEarnings(hfPlan, keys.has(STAFFING) ? plans.staffing : null);
  const footer = earningsFooter(keys);
  return { earned: waiting + paid, waiting, paid, pendingReview, upTo, upToText, emptyText, footer, lines };
}

/**
 * A manager's own pay on My Team (slice 5, spec section 2). Rows are the manager's own
 * Payee Role Manager rows from sanitizeLedger(list, 'Manager'). Earned = Waiting + Paid,
 * as for a rep (D10, D11). No "Up to": the plan's sign award is a rep's, not a manager's.
 * Each line names its company and "signed" (board 5b).
 * @param {ReturnType<typeof sanitizeLedger>} rows
 * @param {Map<string, string>} nameByEmail signed-up team member email (lowercase) to name, from the caller's Active Team Roster rows (D18)
 */
export function managerPay(rows, nameByEmail) {
  let waiting = 0;
  let paid = 0;
  let pendingReview = 0;
  for (const r of rows) {
    if (r.status === 'Waiting') waiting += r.amount;
    else if (r.status === 'Paid') paid += r.amount;
    else if (r.status === 'Pending review') pendingReview += r.amount;
  }
  const nameOf = (email) => (nameByEmail instanceof Map && email ? nameByEmail.get(email) : '') || 'A former team member';
  const lines = [...rows]
    .sort((a, b) => (a.earnedOn < b.earnedOn ? 1 : a.earnedOn > b.earnedOn ? -1 : 0))
    .map((r) => {
      const co = companyName(r.company);
      return {
        on: r.earnedOn,
        label: `${shortDate(r.earnedOn)}. ${r.practiceName || 'Office'}. ${co ? `${co}, signed` : 'Signed'}. ${nameOf(/** @type {any} */ (r).repEmail)}. ${dollars(r.amount)}. ${statusWords(r)}.`,
      };
    });
  return { earned: waiting + paid, waiting, paid, pendingReview, lines };
}

/** @param {ReturnType<typeof sanitizeLedger>} rows */
function groupByReferral(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.referralId)) map.set(r.referralId, []);
    map.get(r.referralId).push(r);
  }
  return map;
}

/**
 * The money line on one Track card, in the spec's words (section 2). Every Void row's
 * reason is shown, even next to rows that pay (D11: "The reason is always shown").
 * "$N more if they sign" (N from the plan) only while the office can still sign: not
 * signed, not closed, and no Signed row yet (a voided Signed row means it was ruled out).
 * Slice S5: the promise is the referral's own company's, from that company's plan, and
 * never an earned amount: a reached case with no qualify answer and no ledger row reads
 * "$100 when HealthFirst confirms the lead qualifies." Every earned amount is a row's.
 * @param {{ closed?: boolean, signed?: boolean, lines?: { status: string }[] }} referral sanitized referral
 * @param {ReturnType<typeof sanitizeLedger>} rows this referral's rows only
 * @param {PayPlan | Plans | null} [plan] null: no promise, earned lines only
 * @param {ReturnType<typeof referralFacts>} [facts] from the raw list row (referralFacts)
 */
export function moneyLine(referral, rows, plan = V3_PLAN, facts = referralFacts(referral)) {
  const plans = plansOf(plan);
  const state = stateOf(referral);
  const partner = companyName(facts.company) || HEALTHFIRST;
  const reasons = [...new Set(rows.filter((r) => r.status === 'Void').map((r) => r.voidReason))];
  const notPaid = reasons.map((reason) => `Not paid: ${reason}.`).join(' ');
  const withNotPaid = (line) => (notPaid ? `${line} ${notPaid}` : line);
  const live = rows.filter((r) => r.status !== 'Void');
  if (live.length === 0) {
    if (notPaid) return notPaid;
    if (state.signed) return `Signed. ${earningsFooter(new Set([facts.company]))}`;
    if (state.closed || facts.qualified === 'No') return 'Closed before any pay was earned.';
    if (facts.company === STAFFING) return staffingNotYetLine(plans.staffing, facts);
    return facts.company === HEALTHFIRST ? notYetLine(plans.healthFirst, facts) : '';
  }
  const pending = live.filter((r) => r.status === 'Pending review');
  const counted = live.filter((r) => r.status === 'Waiting' || r.status === 'Paid');
  const signedPays = live.some((r) => r.event === 'Signed');
  if (counted.length === 0 && pending.length) {
    return withNotPaid(`${dollars(pending.reduce((n, r) => n + r.amount, 0))} pending review. ${partner} hasn't confirmed contact yet.`);
  }
  const earned = counted.reduce((n, r) => n + r.amount, 0);
  if (!signedPays) {
    const first = [...counted].sort((a, b) => (a.earnedOn < b.earnedOn ? -1 : 1))[0];
    const settled = state.signed || state.closed || rows.some((r) => r.event === 'Signed');
    // Only HealthFirst's plan has a rep award at the sign; staffing pays the rep once.
    const tail = settled || facts.company !== HEALTHFIRST ? '' : signTail(plans.healthFirst);
    // A paid Reached award says when it was paid, as My Earnings does.
    const paid = counted.filter((r) => r.status === 'Paid');
    const disputed = paid.some((r) => r.disputed) ? ` ${DISPUTED}.` : '';
    const paidBit = paid.length ? ` Paid ${dollars(paid.reduce((n, r) => n + r.amount, 0))} on ${shortDate(paid[0].paidOn)}.${disputed}` : '';
    return withNotPaid(`${dollars(earned)} earned ${shortDate(first.earnedOn)}.${paidBit}${tail}`);
  }
  const parts = [`${dollars(earned)} earned.`];
  const paidByDay = new Map();
  for (const r of counted) if (r.status === 'Paid') paidByDay.set(r.paidOn, (paidByDay.get(r.paidOn) ?? 0) + r.amount);
  for (const [on, amt] of [...paidByDay].sort()) {
    const disputed = counted.some((r) => r.status === 'Paid' && r.paidOn === on && r.disputed) ? ` ${DISPUTED}.` : '';
    parts.push(`Paid ${dollars(amt)} on ${shortDate(on)}.${disputed}`);
  }
  const waiting = counted.filter((r) => r.status === 'Waiting').reduce((n, r) => n + r.amount, 0);
  if (waiting) parts.push(`${dollars(waiting)} waiting to be paid.`);
  if (pending.length) parts.push(`${dollars(pending.reduce((n, r) => n + r.amount, 0))} pending review.`);
  return withNotPaid(parts.join(' '));
}

/**
 * The "Latest updates" feed with the money on it. One line per event (spec section 2):
 * a Waiting or Paid award adds "You earned $N." to the status line for the same
 * referral and day: Signed onto the signed line; Reached onto the "Talked with the
 * doctor" line, or else another non-signed line that day. One partner update that
 * reports both events carries both awards as one total ("You earned $150.").
 * It gets its own line only when there is no status line to join. Paid days add
 * "Paid $N." Pending review and Void rows aren't in the feed.
 * @param {import('./rep-track.mjs').FeedItem[]} feed from repFeed
 * @param {ReturnType<typeof sanitizeLedger>} rows
 */
export function mergeMoneyFeed(feed, rows) {
  const items = feed.map((item) => ({ ...item, earned: 0 }));
  /** Each line takes at most one award per event it reports. */
  const used = new Set();
  const ordered = [...rows].sort((a, b) => (a.earnedOn < b.earnedOn ? -1 : a.earnedOn > b.earnedOn ? 1 : 0));
  /** @type {typeof items} */
  const extra = [];
  for (const r of ordered) {
    if (r.status !== 'Waiting' && r.status !== 'Paid') continue;
    const wants = r.event === 'Signed' ? ['signed'] : ['reached', 'status'];
    let at = -1;
    let took = '';
    for (const want of wants) {
      at = items.findIndex(
        (item, i) =>
          !used.has(`${i}:${want}`) && item.referralId === r.referralId && item.on === r.earnedOn && item.kinds.includes(want),
      );
      if (at >= 0) {
        took = want;
        break;
      }
    }
    if (at >= 0) {
      used.add(`${at}:${took}`);
      items[at].earned += r.amount;
    } else {
      extra.push({ on: r.earnedOn, label: `${shortDate(r.earnedOn)}. ${r.practiceName || 'Office'}: ${whatOf(r)}.`, referralId: r.referralId, kinds: ['money'], earned: r.amount });
    }
  }
  items.push(...extra);
  for (const item of items) {
    if (!item.earned) continue;
    item.label = `${item.label}${/[.!?]$/.test(item.label) ? '' : '.'} You earned ${dollars(item.earned)}.`;
  }
  const paidByDay = new Map();
  for (const r of rows) if (r.status === 'Paid') paidByDay.set(r.paidOn, (paidByDay.get(r.paidOn) ?? 0) + r.amount);
  for (const [on, amt] of paidByDay) items.push({ on, label: `${shortDate(on)}. Paid ${dollars(amt)}.`, referralId: '', kinds: ['money'], earned: 0 });
  items.sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0));
  return items.slice(0, FEED_MAX).map(({ earned, ...item }) => item);
}

/**
 * Money lines for every referral, and the whole feed with the money joined on.
 * @param {unknown} referrals raw 1F list rows
 * @param {ReturnType<typeof sanitizeLedger>} rows
 * @param {string} [today] YYYY-MM-DD, Eastern
 * @param {PayPlan | Plans | null} [plan] null: no promise, earned lines only
 */
export function moneyForReferrals(referrals, rows, today = todayInNewYork(), plan = V3_PLAN) {
  const byRef = groupByReferral(rows);
  /** @type {Record<string, string>} */
  const lines = {};
  for (const raw of (Array.isArray(referrals) ? referrals : []).slice(0, 200)) {
    const ref = sanitizeReferral(raw);
    if (!ref) continue;
    lines[ref.id] = moneyLine(ref, byRef.get(ref.id) ?? [], plan, referralFacts(raw));
  }
  return { lines, feed: mergeMoneyFeed(repFeed(referrals, today), rows) };
}

/** The approved v3 plan's empty line. Screens use emptyEarnings(plan) from rep-pay-plan.mjs. */
export const EMPTY_EARNINGS = emptyEarnings(V3_PLAN);
export const EARNINGS_FOOTER = "Earnings follow HealthFirst's updates.";
