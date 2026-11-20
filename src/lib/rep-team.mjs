// My Team for the HealthFirst rep app (slice 5, spec v3 section 2, D4, D16, D18). Server
// only. Input is the raw HSBS 1F "team" answer (listTeam): every Active row on Brian's
// Team Roster that names this person as the manager (Brian, 11/9, D18: nobody confirms
// anything). It carries rep emails. Output is the browser object, built field by field
// from an allowlist, never by deleting fields. Every number is computed with the same
// code the rep's own screen uses (track.mjs and rep-earnings.mjs), so My Team can
// never disagree with a rep's own tiles. A rep's referrals use the same rows and lead
// screen the rep sees (rep-lead.mjs, manager view).
// Contract: docs/field-flow-contract.md.
//
// Never in the output: member emails, keys, contact (doctor) names, phones, emails,
// notes, partner detail text or Status Log text. A rep not signed up yet is exactly
// { name } (D4). With pay off there is no money key and no dollar sign anywhere. With pay
// on and no plan (REP_PAY_PLAN bad), ledger amounts show and nothing is promised.

import { daysBetween, decorateReferrals, sanitizeReferral, shortDate, todayInNewYork } from './track.mjs';
import { ROLES, normalizeName } from './register-form.mjs';
import { REFERRAL_READ_MAX, ReferralAppWriteError, TEAM_MAX_MEMBERS } from './field-flow.mjs';
import { companyText, dollars, managerPay, moneyForReferrals, referralFacts, sanitizeLedger, summarizeEarnings } from './rep-earnings.mjs';
import { usableStaffingPlan } from './rep-pay-plan.mjs';
import { leadViews } from './rep-lead.mjs';

export const TEAM_MAX = TEAM_MAX_MEMBERS;
const NUDGE_DAYS = 14;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A signed-up rep whose roster name fails the name rule still counts, under this name. */
const UNNAMED = 'A team member';
const s = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, max);
// Exactly YYYY-MM-DD and a real calendar date, as the ledger rows are read.
const day = (v) => {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!DATE.test(t)) return '';
  const [y, m, d] = t.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d ? t : '';
};
const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/**
 * A team member's name as the roster holds it: the sign-up rule (letters, marks, spaces,
 * apostrophes, periods, hyphens, 1 to 120, curly apostrophes read as straight) plus
 * digits, so TEST rows such as "TEST Rep2" show. No markup, @ or other symbols. '' when
 * it fails. The page renders names with textContent only.
 */
const TEAM_NAME = /^[\p{L}\p{M}\p{N}' .-]{1,120}$/u;
export const teamName = (v) => {
  const n = normalizeName(typeof v === 'string' ? v : '');
  return TEAM_NAME.test(n) ? n : '';
};

/**
 * Every team entry in the answer, checked (contract, "team"). A team over TEAM_MAX is a
 * failed load, never a team cut short: a cut would drop reps and their money from the
 * tiles with nothing to say so. listTeam already refuses it; this keeps the rule if
 * shapeTeam is ever fed directly. An entry that isn't an object, whose `signedUp` isn't
 * a JSON boolean, or a not-signed-up entry with no name is a failed load too: the site
 * never guesses which kind of row it holds.
 * @param {unknown} raw
 */
function members(raw) {
  const list = isObject(raw) && Array.isArray(/** @type {any} */ (raw).team) ? /** @type {any} */ (raw).team : [];
  if (list.length > TEAM_MAX) throw new ReferralAppWriteError(200);
  for (const m of list) {
    if (!isObject(m) || typeof m.signedUp !== 'boolean') throw new ReferralAppWriteError(200);
    if (m.signedUp === false && !(typeof m.name === 'string' && m.name.trim())) throw new ReferralAppWriteError(200);
  }
  return /** @type {Record<string, any>[]} */ (list);
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * @typedef {import('./rep-pay-plan.mjs').PayPlan} PayPlan
 * @typedef {import('./rep-pay-plan.mjs').StaffingPayPlan} StaffingPayPlan
 */

/**
 * "You earn $X each time an office your team sent signs", per company (slice S5). Staffing
 * is named only for a team with staffing referrals or staffing awards and a staffing plan.
 * '' when no plan pays the manager.
 * @param {number} hf HealthFirst plan's manager award, 0 for none
 * @param {number} st staffing plan's manager award, 0 for none or not shown
 */
function managerPromise(hf, st) {
  if (hf && st) {
    return hf === st
      ? `You earn ${dollars(hf)} each time an office your team sent signs.`
      : `You earn ${dollars(hf)} each time an office your team sent to HealthFirst signs, and ${dollars(st)} for Direct Dental.`;
  }
  if (hf) return `You earn ${dollars(hf)} each time an office your team sent signs.`;
  if (st) return `You earn ${dollars(st)} each time an office your team sent to Direct Dental signs.`;
  return '';
}

/**
 * One manager's team, for the browser.
 * @param {unknown} raw the listTeam answer
 * @param {PayPlan | null} plan the plan that words promises; null promises nothing
 * @param {string} [today] YYYY-MM-DD, Eastern
 * @param {{ pay?: boolean, staffing?: StaffingPayPlan | null }} [opts] pay: ledger amounts
 *   show. Defaults to a plan being given, so pay off is (raw, null). Pay on with a bad plan
 *   is (raw, null, today, { pay: true }). staffing: the staffing plan, which words staffing
 *   promises only; every amount is a ledger row's.
 */
export function shapeTeam(raw, plan, today = todayInNewYork(), opts = {}) {
  const pay = opts.pay ?? plan !== null;
  const staffing = pay && usableStaffingPlan(opts.staffing) ? opts.staffing : null;
  const plans = { healthFirst: plan, staffing };
  const all = members(raw);
  let teamHasStaffing = false;

  /**
   * Not signed up yet (D4, D18): the name from Brian's roster and nothing else. A roster
   * name outside the name rule ("Smith, John") shows as "A team member", the same as a
   * signed-up rep's, so the rep never drops off the list unseen.
   */
  const notSignedUp = all
    .filter((m) => m.signedUp === false)
    .map((m) => teamName(m.name) || UNNAMED)
    .sort(byName)
    .map((name) => ({ name }));

  const signedUp = all.filter((m) => m.signedUp === true);
  // A signed-up rep always carries referrals, and rows with pay on (the contract's
  // list and earnings branches). One missing is a failed load, shown as "--", never as
  // a $0 or "0 referrals" that only means the data did not come back.
  for (const m of signedUp) {
    if (!Array.isArray(m.referrals) || (pay && !Array.isArray(m.rows))) throw new ReferralAppWriteError(200);
  }
  /** @type {Map<string, string>} */
  const nameByEmail = new Map();
  let tileSent = 0;
  let tileSigned = 0;
  let tileEarned = 0;
  let tilePaid = 0;

  const rows = signedUp.map((m) => {
    const name = teamName(m.name) || UNNAMED;
    const email = s(m.email, 320).toLowerCase();
    if (email && !nameByEmail.has(email)) nameByEmail.set(email, name);
    const roleText = s(m.role, 30);
    const role = ROLES.includes(roleText) || roleText === 'Manager' ? roleText : '';
    const registeredOn = day(m.registeredOn);
    // The same bound as a rep's own list read: more is a failed load, never a short list.
    if (m.referrals.length > REFERRAL_READ_MAX) throw new ReferralAppWriteError(200);
    const rawReferrals = m.referrals;
    const d = decorateReferrals(rawReferrals, today);

    // Reached is only the flow's roll-up flag (Talked To Doctor ever Yes), never a status.
    /** @type {Set<string>} */
    const reachedIds = new Set();
    let last = '';
    for (const r of rawReferrals) {
      const clean = sanitizeReferral(r);
      if (!clean) continue;
      if (/** @type {any} */ (r).reached === true) reachedIds.add(clean.id);
      if (clean.sentOn && clean.sentOn > last) last = clean.sentOn;
    }
    const reached = d.referrals.filter((x) => reachedIds.has(x.id)).length;

    /** @type {Record<string, string>} */
    let lines = {};
    /** @type {string | undefined} */
    let money;
    /** @type {{ office: string, company: string, amount: string }[] | undefined} */
    let awards;
    if (rawReferrals.some((r) => referralFacts(r).company === 'Staffing')) teamHasStaffing = true;
    if (pay) {
      // The rep's own Payee Role Rep rows only. A manager row can't count here.
      const repRows = sanitizeLedger(m.rows);
      if (repRows.some((r) => r.company === 'Staffing')) teamHasStaffing = true;
      const sum = summarizeEarnings(repRows, rawReferrals, plans);
      lines = moneyForReferrals(rawReferrals, repRows, today, plans).lines;
      money = `Earned ${dollars(sum.earned)}. Paid ${dollars(sum.paid)}.`;
      // One line per row that counts in Earned (Waiting or Paid), each naming its company
      // (board 5b). They add up to this rep's Earned, to the dollar.
      awards = repRows
        .filter((r) => r.status === 'Waiting' || r.status === 'Paid')
        .sort((a, b) => (a.earnedOn < b.earnedOn ? 1 : a.earnedOn > b.earnedOn ? -1 : 0))
        .map((r) => ({ office: r.practiceName || 'Office', company: companyText(r), amount: dollars(r.amount) }));
      tileEarned += sum.earned;
      tilePaid += sum.paid;
    }
    tileSent += d.counts.sent;
    tileSigned += d.counts.signed;

    const since = daysBetween(registeredOn, today);
    const nudge = d.counts.sent === 0 && since != null && since >= NUDGE_DAYS;
    const joined = registeredOn ? ` Joined ${shortDate(registeredOn)}.` : '';

    // The same compact rows and lead screen the rep sees, manager view: no contact, no
    // partner update text, and only the plain step words in the timeline. With pay on,
    // the same money line the rep sees on that office.
    // The referral id stays here: the browser gets c0, c1 and so on.
    const cards = leadViews(rawReferrals, today, { team: true }).map(({ id, ...lead }, i) => {
      /** @type {Record<string, unknown>} */
      const card = { id: `c${i}`, ...lead };
      if (pay && lines[id]) card.money = lines[id];
      return card;
    });

    /** @type {{ id: string, name: string, head: string, counts: string, money?: string, awards?: typeof awards, last: string, nudge: boolean, cards: typeof cards }} */
    const row = {
      id: '',
      name,
      head: `${name}.${role ? ` ${role}.` : ''}${joined}`,
      counts: `${plural(d.counts.sent, 'referral', 'referrals')}. ${reached} reached. ${d.counts.signed} signed.`,
      last: nudge ? 'No referral yet.' : last ? `Last referral ${shortDate(last)}.` : '',
      nudge,
      cards,
    };
    if (money !== undefined) row.money = money;
    if (awards !== undefined) row.awards = awards;
    return { sent: d.counts.sent, row };
  });

  const team = rows
    .sort((a, b) => b.sent - a.sent || byName(a.row.name, b.row.name))
    .map(({ row }, i) => {
      // Rebuilt in display order, so the key order is the same with pay on or off.
      /** @type {Record<string, unknown>} */
      const out = { id: `m${i}`, name: row.name, head: row.head, counts: row.counts };
      if (row.money !== undefined) out.money = row.money;
      if (row.awards !== undefined) out.awards = row.awards;
      out.last = row.last;
      out.nudge = row.nudge;
      out.cards = row.cards;
      return out;
    });

  /** @type {Record<string, unknown>} */
  const tiles = { referrals: tileSent, signed: tileSigned };
  if (pay) {
    tiles.earned = dollars(tileEarned);
    tiles.paid = dollars(tilePaid);
  }

  /** @type {Record<string, unknown>} */
  const out = { tiles, team, notSignedUp };

  if (pay) {
    const rawManager = isObject(raw) ? /** @type {any} */ (raw).managerRows : [];
    // D4: a row that adds nothing (Void or Pending review) shows only while its rep is a
    // signed-up rep on this manager's team now (an Active Team Roster row naming this
    // manager), so a rep who is gone never shows an office here.
    // Waiting and Paid rows always show: that is pay this manager earned.
    const managerRows = sanitizeLedger(rawManager, 'Manager').filter(
      (r) => r.status === 'Waiting' || r.status === 'Paid' || nameByEmail.has(/** @type {any} */ (r).repEmail),
    );
    if (managerRows.some((r) => r.company === 'Staffing')) teamHasStaffing = true;
    const promise = managerPromise(plan?.manager ?? 0, teamHasStaffing && staffing ? staffing.manager : 0);
    if (promise || managerRows.length > 0) {
      const mp = managerPay(managerRows, nameByEmail);
      let sentence;
      if (mp.lines.length) {
        sentence = `You've earned ${dollars(mp.earned)} from your team's signed offices. Paid ${dollars(mp.paid)}. Waiting ${dollars(mp.waiting)}.`;
      } else {
        sentence = "You've earned $0 from your team's signed offices so far.";
        if (promise) sentence += ` ${promise}`;
      }
      out.own = { sentence, lines: mp.lines.map((l) => l.label) };
    }
  }
  return out;
}
