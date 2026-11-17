// HealthFirst rep app: "Send a Referral" rules (spec v3, docs/field-flow-contract.md,
// section 2 "/refer/<key> for a Rep key"). Shared by the page and the server, so both
// check the same things. The wire body is docs/field-flow-contract.md, "HSBS 1F for
// Rep keys". The rep's name and email are not in the body: HSBS 1F copies them from the
// Rep Roster row that owns the key.

import { PREFERRED_CONTACTS } from './field-form.mjs';
import { DEFAULT_PAY_PLAN, parsePayPlan, payLine, receiptMoney } from './rep-pay-plan.mjs';

/** Solutions spelling for HealthFirst, as Referrals and Service Cases store it. */
export const REP_COMPANY = 'HealthFirst';
export const REP_NEED = 'OSHA and HIPAA compliance';
/** Saved word for word in Consent text. */
export const REP_CONSENT = 'The office agreed to a call from HealthFirst.';

/** The approved v3 plan's header line. Screens use payLine(plan) from rep-pay-plan.mjs. */
export const PAY_LINE = payLine(/** @type {import('./rep-pay-plan.mjs').PayPlan} */ (parsePayPlan(DEFAULT_PAY_PLAN)));

export const GUIDE = [
  "Ask: Has the office done this year's OSHA and HIPAA training? Are the manuals current?",
  'If either answer is no, ask: Can HealthFirst call you to get it handled?',
  'If they say yes, send it.',
];

export { PREFERRED_CONTACTS };

/**
 * The practice's state, as HealthFirst splits its reps by state (Matt DeFazio's ask,
 * 11/17/2026). Two-letter USPS codes, the 50 states and DC, in the order the page lists
 * them. Asked and sent only while REP_ASK_STATE is on.
 */
export const US_STATES = Object.freeze([
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
].map((pair) => Object.freeze(pair)));

const STATE_CODES = new Set(US_STATES.map(([code]) => code));
/** A known two-letter code, exactly as the page's list sends it. */
export const isStateCode = (v) => typeof v === 'string' && STATE_CODES.has(v);

/** @typedef {{ askState?: boolean }} RepFormOptions */

const trim = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '');
const cap = (v, n) => trim(v).slice(0, n);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isJde = (v) => /^\d{1,40}$/.test(v);

/** First word of a name, for the receipt. */
export const firstWord = (name) => cap(name, 120).split(' ')[0] || '';

/**
 * The button label walks the rep through what's missing, in this order:
 * how to reach them, the office's OK, then the fields.
 * @param {Record<string, unknown>} input
 * @param {RepFormOptions} [options] askState: REP_ASK_STATE is on, so the state is required.
 */
export function repSendLabel(input, { askState = false } = {}) {
  if (!PREFERRED_CONTACTS.includes(trim(input.preferredContact))) return 'Pick how to reach them';
  if (input.permission !== true) return "Check the office's OK";
  if (!cap(input.contactName, 120)) return 'Enter the contact name';
  if (!cap(input.practiceName, 160)) return 'Enter the practice name';
  if (askState && !isStateCode(input.practiceState)) return 'Pick the state';
  if (!isJde(cap(input.jde, 40))) return 'Enter the JDE number';
  if (!cap(input.officePhone, 40)) return 'Enter the best phone';
  return 'Send to HealthFirst';
}

/**
 * @param {Record<string, unknown>} input
 * @param {RepFormOptions} [options] askState: REP_ASK_STATE is on, so the state is required.
 * @returns {{ ok: boolean, errors: { field: string, message: string }[] }}
 */
export function validateRepReferral(input, { askState = false } = {}) {
  const errors = [];
  if (!cap(input.contactName, 120)) errors.push({ field: 'contactName', message: 'Enter the contact name.' });
  if (!cap(input.practiceName, 160)) errors.push({ field: 'practiceName', message: 'Enter the practice name.' });
  if (askState && !isStateCode(input.practiceState)) errors.push({ field: 'practiceState', message: 'Pick the state the practice is in.' });
  if (!isJde(cap(input.jde, 40))) errors.push({ field: 'jde', message: 'Enter the JDE number. Use digits only.' });
  if (!cap(input.officePhone, 40)) errors.push({ field: 'officePhone', message: 'Enter the best phone.' });
  const email = cap(input.email, 320);
  if (email && !isEmail(email)) errors.push({ field: 'email', message: "Check the email. It doesn't look complete." });
  if (!PREFERRED_CONTACTS.includes(trim(input.preferredContact))) {
    errors.push({ field: 'preferredContact', message: 'Pick how to reach them.' });
  }
  if (input.permission !== true) errors.push({ field: 'permission', message: "Check the office's OK." });
  if (typeof input.notes === 'string' && input.notes.length > 2000) {
    errors.push({ field: 'notes', message: 'Keep notes under 2,000 characters.' });
  }
  return { ok: errors.length === 0, errors };
}

/**
 * JSON body for HSBS 1F action "submit" from the Rep app. Call only after
 * validateRepReferral succeeds, with the same options. Every fixed value comes from the
 * spec, not the page. practiceState is in the body only while REP_ASK_STATE is on, so with
 * it off 1F gets exactly what it gets today.
 * @param {Record<string, unknown>} input
 * @param {{ referralKey: string, submissionId: string }} meta
 * @param {RepFormOptions} [options]
 */
export function repFlowPayload(input, meta, { askState = false } = {}) {
  const body = {
    action: 'submit',
    referralKey: meta.referralKey,
    submissionId: meta.submissionId,
    leadType: 'Practice owner',
    doctorName: cap(input.contactName, 120),
    practiceName: cap(input.practiceName, 160),
    officePhone: cap(input.officePhone, 40),
    doctorCell: '',
    doctorEmail: cap(input.email, 320),
    jde: cap(input.jde, 40),
    companies: [REP_COMPANY],
    needs: [REP_NEED],
    PVApermission: true,
    contactFirst: false,
    preferredContact: trim(input.preferredContact),
    consentText: REP_CONSENT,
    notes: cap(input.notes, 2000),
    route: 'Partner',
    referrerRole: 'Rep',
    source: 'Rep app',
    status: 'Received',
  };
  return askState ? { ...body, practiceState: String(input.practiceState) } : body;
}

/**
 * Receipt words. No call-back time until Brian picks one (spec section 9, question 3).
 * The money line shows only when pay is on, worded from the plan (REP_PAY_PLAN).
 * @param {{ contactName: unknown, plan: import('./rep-pay-plan.mjs').PayPlan | null }} input
 */
export function repReceipt(input) {
  const contact = cap(input.contactName, 120) || 'the office';
  return {
    title: 'Sent to HealthFirst',
    calls: `HealthFirst's team will call ${contact}.`,
    money: input.plan ? receiptMoney(input.plan, contact) : '',
  };
}
