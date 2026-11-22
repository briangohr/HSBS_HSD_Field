// Rep app staffing form (field two-track spec, section 4 "Staffing form"). Shared by the
// page and the server, so both check the same things. The wire body is the rep app submit
// (src/lib/rep-referral-form.mjs) with the staffing values below plus `practiceType`
// (docs/field-flow-contract.md). The rep's name and email are never in
// the body: HSBS 1F reads them from the Rep Roster row that owns the key.

import { PREFERRED_CONTACTS } from './field-form.mjs';
import { companyName, solutionsForKey } from './rep-companies.mjs';

/** The company key and the name the rep and the customer see (Direct Dental, T14). */
export const STAFFING_KEY = 'Staffing';
export const STAFFING_NAME = companyName(STAFFING_KEY);
/** The staffing label, in place of the HealthFirst need. */
export const STAFFING_NEED = 'Staffing';

/** The two stored values, spelled exactly. The screen labels below are display only. */
export const PRACTICE_TYPES = Object.freeze(['Private practice', 'Group']);
export const PRACTICE_TYPE_LABELS = Object.freeze({
  'Private practice': 'Private practice',
  Group: 'Group (3 or more locations)',
});

/** The words next to the box. Saved word for word in Consent text. */
export const STAFFING_CONSENT = `The customer gave permission for ${STAFFING_NAME} to contact them about staffing.*`;
export const STAFFING_STAR = `* ${STAFFING_NAME} may void this referral if the customer did not give permission to be contacted about this service.`;

const trim = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '');
const cap = (v, n) => trim(v).slice(0, n);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isJde = (v) => /^\d{1,40}$/.test(v);
const isType = (v) => typeof v === 'string' && PRACTICE_TYPES.includes(v);

/**
 * The staffing pay plan the screens are worded from: dollars for a Reached award by
 * practice type. null means no staffing plan, and then no dollar amount shows anywhere.
 * @typedef {{ reachedPrivate: number, reachedGroup: number }} StaffingPlan
 */
const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
/** @param {any} plan @returns {plan is StaffingPlan} */
const usable = (plan) =>
  Boolean(plan) && Number.isInteger(plan.reachedPrivate) && Number.isInteger(plan.reachedGroup) && plan.reachedPrivate > 0 && plan.reachedGroup > 0;

/**
 * The staffing terms a screen was worded from, the way payTerms marks the HealthFirst plan:
 * '' with no usable plan, else "<private>,<group>". The page carries it and a good staffing
 * send answers with it, so a page opened before the staffing plan changed can tell its
 * promise is out of date.
 * @param {StaffingPlan | null | undefined} plan
 */
export const staffingTerms = (plan) => (usable(plan) ? `${plan.reachedPrivate},${plan.reachedGroup}` : '');

/**
 * The usable staffing plan, or null. Takes whatever the pay plan setting gave (a plan with
 * extra parts, or nothing) and keeps only what the screens are worded from.
 * @param {any} plan
 * @returns {StaffingPlan | null}
 */
export const asStaffingPlan = (plan) => (usable(plan) ? { reachedPrivate: plan.reachedPrivate, reachedGroup: plan.reachedGroup } : null);

/**
 * The line under the header; '' with no plan. A flat plan (the same amount for both
 * types, pay sheet R11) names one amount and no type, as the Earnings words do.
 */
export function staffingPayLine(plan) {
  if (!usable(plan)) return '';
  if (plan.reachedPrivate === plan.reachedGroup) {
    return `You earn ${usd(plan.reachedPrivate)} when ${STAFFING_NAME} reaches the customer and confirms the lead qualifies.`;
  }
  return `You earn ${usd(plan.reachedPrivate)} for a private practice, or ${usd(plan.reachedGroup)} for a group that ${STAFFING_NAME} confirms has 3 or more locations, when ${STAFFING_NAME} reaches the customer and confirms the lead qualifies.`;
}

/**
 * The button label walks the rep through what is missing, in the HealthFirst form's order.
 * @param {Record<string, unknown>} input
 */
export function staffingSendLabel(input) {
  if (!PREFERRED_CONTACTS.includes(trim(input.preferredContact))) return 'Pick how to reach them';
  if (!isType(input.practiceType)) return 'Pick the practice type';
  if (input.permission !== true) return "Check the customer's OK";
  if (!cap(input.contactName, 120)) return 'Enter the contact name';
  if (!cap(input.practiceName, 160)) return 'Enter the practice name';
  if (!isJde(cap(input.jde, 40))) return 'Enter the JDE number';
  if (!cap(input.officePhone, 40)) return 'Enter the best phone';
  return `Send to ${STAFFING_NAME}`;
}

/**
 * @param {Record<string, unknown>} input
 * @returns {{ ok: boolean, errors: { field: string, message: string }[] }}
 */
export function validateStaffingReferral(input) {
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
  // Exactly one of the two stored values; the screen label is never accepted.
  if (!isType(input.practiceType)) errors.push({ field: 'practiceType', message: 'Pick the practice type.' });
  if (input.permission !== true) errors.push({ field: 'permission', message: "Check the customer's OK." });
  if (typeof input.notes === 'string' && input.notes.length > 2000) {
    errors.push({ field: 'notes', message: 'Keep notes under 2,000 characters.' });
  }
  return { ok: errors.length === 0, errors };
}

/**
 * JSON body for HSBS 1F action "submit" from a staffing send. Call only after
 * validateStaffingReferral succeeds. Every fixed value comes from the spec, not the page.
 * @param {Record<string, unknown>} input
 * @param {{ referralKey: string, submissionId: string }} meta
 */
export function staffingFlowPayload(input, meta) {
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
    companies: [solutionsForKey(STAFFING_KEY)],
    needs: [STAFFING_NEED],
    contactFirst: false,
    preferredContact: trim(input.preferredContact),
    consentText: STAFFING_CONSENT,
    notes: cap(input.notes, 2000),
    route: 'Partner',
    referrerRole: 'Rep',
    source: 'Rep app',
    status: 'Received',
    practiceType: /** @type {string} */ (input.practiceType),
  };
}

/**
 * Receipt words. The money line shows only with a staffing plan (pay on), for the practice
 * type picked. With no plan it is '' and no dollar amount shows.
 * @param {{ contactName: unknown, practiceType: unknown, plan: StaffingPlan | null | undefined }} input
 */
export function staffingReceipt(input) {
  const contact = cap(input.contactName, 120) || 'the office';
  let money = '';
  if (usable(input.plan) && isType(input.practiceType)) {
    const amount = input.practiceType === 'Group' ? input.plan.reachedGroup : input.plan.reachedPrivate;
    money = `You'll earn ${usd(amount)} when ${STAFFING_NAME} reaches ${contact} and confirms the lead qualifies.`;
  }
  return {
    title: `Sent to ${STAFFING_NAME}`,
    calls: `${STAFFING_NAME}'s team will call ${contact}.`,
    money,
  };
}
