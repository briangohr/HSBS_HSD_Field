// Rep app "Ask a DPT rep to join you" form. The pilot FSC app had a button that asked a
// Dental Practice Transition (DPT) rep to join the FSC at an office. This is the field
// app's own version: it is a rep app submit to HSBS 1F like the other two forms, with
// the company `Dental Practice Transition`, so the request lands on the field Referrals
// list and a field intro flow emails the DPT contact from the field Routing list. It
// touches no other team's list or flow (docs/field-flow-contract.md, "DPT ask").
// Shared by the page and the server, so both check the same things. The rep's name and
// email are never in the body: HSBS 1F reads them from the Rep Roster row for the key.

import { companyName, solutionsForKey } from './rep-companies.mjs';

/** The company key and the name the rep sees. */
export const DPT_KEY = 'DPT';
export const DPT_NAME = companyName(DPT_KEY);
/** The need 1F stores with the request. */
export const DPT_NEED = 'Practice transition';

/** What the doctor is thinking about. Stored word for word in Practice Situation. */
export const DPT_SITUATIONS = Object.freeze([
  'Selling or retiring',
  'Buying or adding a location',
  'Bringing in a partner or associate',
  'Not sure yet',
]);

/** The words next to the box. Saved word for word in Consent text. */
export const DPT_CONSENT = `The doctor is OK with a ${DPT_NAME} rep contacting them or joining my visit.*`;
export const DPT_STAR = `* The ${DPT_NAME} rep calls you first to plan the visit.`;

/** What the intro says when the rep names no time. */
export const DPT_NO_TIME = 'Call me to set a time to visit together.';

const trim = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '');
const cap = (v, n) => trim(v).slice(0, n);
const isJde = (v) => /^\d{1,40}$/.test(v);
const isSituation = (v) => typeof v === 'string' && DPT_SITUATIONS.includes(v);

/**
 * The button label walks the rep through what is missing, top to bottom.
 * @param {Record<string, unknown>} input
 */
export function dptSendLabel(input) {
  if (!cap(input.contactName, 120)) return "Enter the doctor's name";
  if (!cap(input.practiceName, 160)) return 'Enter the practice name';
  if (!cap(input.officePhone, 40)) return 'Enter the office phone';
  const jde = cap(input.jde, 40);
  if (jde && !isJde(jde)) return 'Check the JDE number';
  if (!isSituation(input.practiceSituation)) return 'Pick what the doctor is thinking about';
  if (input.permission !== true) return "Check the doctor's OK";
  return `Ask ${DPT_NAME}`;
}

/**
 * @param {Record<string, unknown>} input
 * @returns {{ ok: boolean, errors: { field: string, message: string }[] }}
 */
export function validateDptReferral(input) {
  const errors = [];
  if (!cap(input.contactName, 120)) errors.push({ field: 'contactName', message: "Enter the doctor's name." });
  if (!cap(input.practiceName, 160)) errors.push({ field: 'practiceName', message: 'Enter the practice name.' });
  if (!cap(input.officePhone, 40)) errors.push({ field: 'officePhone', message: 'Enter the office phone.' });
  // JDE is optional here: a DPT ask can be for an office that is not a customer yet.
  const jde = cap(input.jde, 40);
  if (jde && !isJde(jde)) errors.push({ field: 'jde', message: 'Check the JDE number. Use digits only.' });
  // Exactly one of the stored values.
  if (!isSituation(input.practiceSituation)) {
    errors.push({ field: 'practiceSituation', message: 'Pick what the doctor is thinking about.' });
  }
  if (typeof input.joinWhen === 'string' && input.joinWhen.length > 200) {
    errors.push({ field: 'joinWhen', message: 'Keep this under 200 characters.' });
  }
  if (input.permission !== true) errors.push({ field: 'permission', message: "Check the doctor's OK." });
  if (typeof input.notes === 'string' && input.notes.length > 2000) {
    errors.push({ field: 'notes', message: 'Keep notes under 2,000 characters.' });
  }
  return { ok: errors.length === 0, errors };
}

/**
 * JSON body for HSBS 1F action "submit" from a DPT ask. Call only after
 * validateDptReferral succeeds. Every fixed value is set here, never by the page. It uses
 * only fields 1F already maps today, so 1F needs no change:
 * - `contactFirst: true` puts "Please call <rep> before contacting the office" at the top
 *   of the intro, because the DPT rep plans the visit with the rep first.
 * - `contactInstructions` carries when to join, and shows in the intro's contact block.
 * - `practiceSituation` is stored in Practice Situation.
 * @param {Record<string, unknown>} input
 * @param {{ referralKey: string, submissionId: string }} meta
 */
export function dptFlowPayload(input, meta) {
  const when = cap(input.joinWhen, 200);
  return {
    action: 'submit',
    referralKey: meta.referralKey,
    submissionId: meta.submissionId,
    leadType: 'Practice owner',
    doctorName: cap(input.contactName, 120),
    practiceName: cap(input.practiceName, 160),
    officePhone: cap(input.officePhone, 40),
    doctorCell: '',
    doctorEmail: '',
    jde: cap(input.jde, 40),
    companies: [solutionsForKey(DPT_KEY)],
    needs: [DPT_NEED],
    PVApermission: true,
    contactFirst: true,
    contactInstructions: when ? `Join me: ${when}` : DPT_NO_TIME,
    practiceSituation: /** @type {string} */ (input.practiceSituation),
    preferredContact: '',
    consentText: DPT_CONSENT,
    notes: cap(input.notes, 2000),
    route: 'Partner',
    referrerRole: 'Rep',
    source: 'Rep app',
    status: 'Received',
  };
}

/**
 * Receipt words. A DPT ask earns no pay, so there is never a money line.
 * @param {{ contactName: unknown }} input
 */
export function dptReceipt(input) {
  const contact = cap(input.contactName, 120) || 'the doctor';
  return {
    title: `Sent to ${DPT_NAME}`,
    calls: `A ${DPT_NAME} rep will call you first to plan a visit with ${contact}.`,
    money: '',
  };
}
