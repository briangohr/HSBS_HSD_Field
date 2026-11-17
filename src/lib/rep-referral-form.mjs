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
 * Under Notes on the HealthFirst form: a nudge to pass on what the rep learned, such as a
 * qualifying question and the office's answer (Matt DeFazio's ask, 11/16/2026).
 */
export const NOTES_HINT = 'Anything HealthFirst should know, like a question you asked and their answer.';

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
 */
export function repSendLabel(input) {
  if (!PREFERRED_CONTACTS.includes(trim(input.preferredContact))) return 'Pick how to reach them';
  if (input.permission !== true) return "Check the office's OK";
  if (!cap(input.contactName, 120)) return 'Enter the contact name';
  if (!cap(input.practiceName, 160)) return 'Enter the practice name';
  if (!isJde(cap(input.jde, 40))) return 'Enter the JDE number';
  if (!cap(input.officePhone, 40)) return 'Enter the best phone';
  return 'Send to HealthFirst';
}

/**
 * @param {Record<string, unknown>} input
 * @returns {{ ok: boolean, errors: { field: string, message: string }[] }}
 */
export function validateRepReferral(input) {
  const errors = [];
  if (!cap(input.contactName, 120)) errors.push({ field: 'contactName', message: 'Enter the contact name.' });
  if (!cap(input.practiceName, 160)) errors.push({ field: 'practiceName', message: 'Enter the practice name.' });
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
 * validateRepReferral succeeds. Every fixed value comes from the spec, not the page.
 * @param {Record<string, unknown>} input
 * @param {{ referralKey: string, submissionId: string }} meta
 */
export function repFlowPayload(input, meta) {
  return {
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
