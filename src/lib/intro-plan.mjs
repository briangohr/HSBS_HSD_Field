// Lean rebuild U1: what the intro job does for one referral, as pure functions. This replaces
// the decisions inside HSBS 3F HealthFirst and 3F Staffing (S1b exports 11/26/2026, raw hashes
// aec0c8b3 and 0e2b3dc3). Nothing here reads a list, writes a row or sends a mail: it takes
// rows that are already read and says what to do. `intro-run.mjs` (a later PR) does it.
//
// Differences from 3F, on purpose (docs: field-rebuild build spec, "What changes on purpose"):
// the case is created before the mail, the referral is stamped last, each partner name has its
// own state, an ambiguous send is never resent, the due date skips holidays, and a company with
// no Routing row gets an alert instead of the HealthFirst mail or nothing.

import { introDue } from './field-rules.mjs';

/** A referral younger than this is left alone, so a half-written row is never read. 3F: 120 s. */
export const MIN_AGE_SECONDS = 120;
/** Failed tries on one case before the owner is told. 3F: Intro Tries under 3. */
export const MAX_TRIES = 3;
/** Wait between tries of one case. 3F waited 5 minutes inside the run. */
export const RETRY_MINUTES = 5;
/** A send with no clear answer older than this is an alert, never a resend. */
export const MAYBE_ALERT_MINUTES = 5;

/** Two older labels that mean Unitas (the same two 3F maps). */
const UNITAS_LABELS = ['ppo fees', 'hsra'];

const text = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const list = (v) => (Array.isArray(v) ? v.map((x) => text(x?.Value ?? x)).filter(Boolean) : []);

/**
 * A referral as the plan reads it. The gateway returns SharePoint internal column names,
 * choice columns as plain text and multi choice columns as lists of text.
 * @param {number} id
 * @param {Record<string, unknown>} f
 */
export function readReferral(id, f) {
  const title = text(f.Title);
  return {
    id,
    ref: title || `HSBS-${id}`,
    source: text(f.Source),
    route: text(f.Route),
    introducedOn: text(f.Introduced_x0020_On),
    tries: Number.isSafeInteger(f.Intro_x0020_Tries) ? /** @type {number} */ (f.Intro_x0020_Tries) : 0,
    solutions: list(f.Solutions),
    partners: list(f.Partner),
    test: f.Test === true,
    created: text(f.Created),
    practice: text(f.PracticeName),
    rep: text(f.Referring_x0020_Rep),
    repEmail: text(f.Referring_x0020_Rep_x0020_Email),
    customerName: text(f.CustomerName),
    jde: text(f.JDEAccount),
    cell: text(f.Doctor_x0020_Cell),
    phone: text(f.CustomerPhone),
    preferredContact: text(f.Preferred_x0020_Contact),
    instructions: text(f.Contact_x0020_Instructions),
    customerEmail: text(f.CustomerEmail),
    state: text(f.State),
    doctorOk: f.PVApermission === true,
    note: typeof f.Note === 'string' ? f.Note : '',
    ownerName: text(f.PVAName),
  };
}

/**
 * Whether the intro job should look at this referral at all (the union of the 3F HealthFirst and
 * 3F Staffing trigger conditions, minus the Solutions split, which is now per name).
 * @param {ReturnType<typeof readReferral>} r
 * @param {number} nowMs
 */
export function isCandidate(r, nowMs) {
  if (r.source !== 'Rep app' || r.route !== 'Direct to partner') return false;
  if (r.introducedOn !== '' || r.tries >= MAX_TRIES) return false;
  const created = Date.parse(r.created);
  if (Number.isNaN(created)) return false;
  return nowMs - created >= MIN_AGE_SECONDS * 1000;
}

/**
 * The partner names on a referral: Solutions and Partner together, trimmed, each once, the two
 * older labels read as Unitas. Same as 3F `Partner_names`.
 * @param {ReturnType<typeof readReferral>} r
 */
export function partnerNames(r) {
  const out = [];
  for (const raw of [...r.solutions, ...r.partners]) {
    const name = UNITAS_LABELS.includes(raw.toLowerCase()) ? 'Unitas' : raw;
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * A Routing row. Routable means a primary email and Verified true (3F `Routable`).
 * `greeting` and `showState` are two optional columns that replace what 3F types per company.
 * @param {Record<string, unknown>} f
 */
export function readRoute(f) {
  const email = text(f.Primaryemail);
  return {
    name: text(f.Title),
    email,
    contact: text(f.Primaryname),
    routable: email !== '' && f.Verified === true,
    greeting: text(f.Greeting),
    showState: f.ShowState === true,
  };
}

/** Send Log key of a case's intro mail. */
export const introKey = (caseId) => `intro:${caseId}`;
/** Send Log key of an unroutable case's "forward manually" mail. */
export const heldKey = (caseId) => `held:${caseId}`;
/** Send Log key of the once-a-day alert for a name with no Routing row. */
export const unknownKey = (referralId, name, today) => `unknown:${referralId}:${name}:${today}`;

/**
 * What to do for one partner name.
 *   unknown_company  no Routing row: no case, no mail, one alert a day
 *   create_case      no case yet: create it (Held, Not sent), then plan again
 *   send             mail the partner (routable) or the owner (not routable)
 *   patch_case       the mail is logged Sent but the case still reads Not sent
 *   wait             a try is too recent, or a send is not old enough to call it lost
 *   alert_tries      3 failed tries: tell the owner once
 *   alert_maybe      a send with no clear answer: tell the owner, never resend
 *   done             sent, or held and the owner told
 *   blocked          the owner was told and the row waits for them
 * @typedef {{ kind: 'unknown_company' | 'create_case' | 'send' | 'patch_case' | 'wait' | 'alert_tries' | 'alert_maybe' | 'done' | 'blocked', name: string, caseId?: number, routable?: boolean }} NamePlan
 */

/**
 * @param {string} name
 * @param {{
 *   route: ReturnType<typeof readRoute> | undefined,
 *   kase: { id: number, sent: boolean } | undefined,
 *   log: { result: string, tries: number, lastTryMs: number } | undefined,
 *   nowMs: number,
 * }} ctx `sent` is Dispatch `Sent delivery unverified`. `log` is the row for introKey or heldKey.
 * @returns {NamePlan}
 */
export function planName(name, { route, kase, log, nowMs }) {
  if (!route) return { kind: 'unknown_company', name };
  if (!kase) return { kind: 'create_case', name, routable: route.routable };
  const base = { name, caseId: kase.id, routable: route.routable };
  if (kase.sent) return { ...base, kind: 'done' };
  if (!log) return { ...base, kind: 'send' };
  const minutes = (nowMs - log.lastTryMs) / 60_000;
  switch (log.result) {
    case 'Sent':
      return { ...base, kind: route.routable ? 'patch_case' : 'done' };
    case 'Failed':
      if (log.tries >= MAX_TRIES) return { ...base, kind: 'alert_tries' };
      return { ...base, kind: minutes >= RETRY_MINUTES ? 'send' : 'wait' };
    case 'Claimed':
    case 'Maybe':
      return { ...base, kind: minutes >= MAYBE_ALERT_MINUTES ? 'alert_maybe' : 'wait' };
    case 'Alerted':
      return { ...base, kind: 'blocked' };
    default:
      return { ...base, kind: 'blocked' };
  }
}

/**
 * Plan a whole referral. The stamp comes last: only when every name with a Routing row is done.
 * A referral with only unknown names is never stamped.
 * @param {ReturnType<typeof readReferral>} r
 * @param {{
 *   routing: Map<string, ReturnType<typeof readRoute>>,
 *   cases: Map<string, { id: number, sent: boolean }>,
 *   logs: Map<string, { result: string, tries: number, lastTryMs: number }>,
 *   nowMs: number,
 *   today: string,
 * }} ctx
 */
export function planReferral(r, { routing, cases, logs, nowMs, today }) {
  const names = partnerNames(r).map((name) => {
    const route = routing.get(name);
    const kase = cases.get(name);
    const log = kase ? logs.get(route?.routable === false ? heldKey(kase.id) : introKey(kase.id)) : undefined;
    return planName(name, { route, kase, log, nowMs });
  });
  const known = names.filter((n) => n.kind !== 'unknown_company');
  const stamp = known.length > 0 && known.every((n) => n.kind === 'done');
  return {
    names,
    stamp: stamp ? { introducedOn: today, nextUpdateDue: introDue(today), lastNotifiedStatus: 'Introduced to Solution Company' } : null,
  };
}
