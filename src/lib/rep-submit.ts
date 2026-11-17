// One server path for a Rep app referral (spec v3 section 2), used by /api/referral
// (app "rep", the page script) and by /refer/<key> itself on a plain form POST (no
// JavaScript). Both get the same checks, limit and answer. The rep's name and email are
// never taken from the request; HSBS 1F reads them from the Rep Roster row for the key.
// Contract: docs/field-flow-contract.md.
import { keyLimited } from './http';
import {
  ReferralAppConfigError,
  ReferralAppTimeoutError,
  ReferralAppWriteError,
  ReferralKeyUnknownError,
  submitReferral,
} from './field-flow.mjs';
import { TIMEOUT_MESSAGE, isReferralKey, isSubmissionId } from './field-form.mjs';
import { repAppCompanies, repAppEnabled, repAskState } from './register-flow.mjs';
import { COMPANY_OFF_MESSAGE, ONE_COMPANY_MESSAGE, checkSendCompany } from './rep-companies.mjs';
import { repFlowPayload, validateRepReferral } from './rep-referral-form.mjs';
import { staffingFlowPayload, validateStaffingReferral } from './rep-staffing-form.mjs';

const STRINGS = ['contactName', 'practiceName', 'jde', 'officePhone', 'email', 'preferredContact', 'practiceType', 'practiceState', 'notes'] as const;

/**
 * One sender per company that has a send form (field two-track spec, section 4). A
 * company key with no entry here can never send, whatever REP_APP_COMPANIES says.
 * A company's `form` flag in src/lib/rep-companies.mjs and its entry here go together
 * (rep-companies.test.mjs checks the two agree). Each payload builder sets every fixed value itself; identity is never
 * in the body (HSBS 1F reads it from the Rep Roster row for the key).
 */
type RepFormOptions = { askState?: boolean };
type RepSender = {
  validate: (fields: Record<string, unknown>, options?: RepFormOptions) => { ok: boolean; errors: { field: string; message: string }[] };
  payload: (fields: Record<string, unknown>, meta: { referralKey: string; submissionId: string }, options?: RepFormOptions) => Record<string, unknown>;
  /** The form's switches, read from env on each send. */
  options?: () => RepFormOptions;
};
export const REP_SENDERS: Readonly<Record<string, RepSender>> = Object.freeze({
  HealthFirst: { validate: validateRepReferral, payload: repFlowPayload, options: () => ({ askState: repAskState() }) },
  Staffing: { validate: validateStaffingReferral, payload: staffingFlowPayload },
});

export type RepSubmitResult = {
  status: number;
  ok?: true;
  error?: string;
  errors?: { field: string; message: string }[];
  timeout?: true;
};

/**
 * The fields a Rep submit may carry, as plain values. Anything else is dropped.
 * `company` is the one company key the send names (a list when a form posts it more than
 * once, so two are refused rather than the first taken). `companies` is kept only so a
 * request that names companies that way is refused.
 */
export function pickRepFields(get: (k: string) => unknown, getAll?: (k: string) => unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (getAll) {
    const named = getAll('company');
    if (named.length) out.company = named.length === 1 ? named[0] : named;
    const listed = getAll('companies');
    if (listed.length) out.companies = listed;
  } else {
    if (get('company') !== undefined) out.company = get('company');
    if (get('companies') != null) out.companies = get('companies');
  }
  for (const k of STRINGS) {
    const v = get(k);
    out[k] = typeof v === 'string' ? v : v == null ? '' : v;
  }
  const permission = get('permission');
  out.permission = permission === true || permission === 'yes' || permission === 'on';
  return out;
}

export async function submitRep(
  referralKey: unknown,
  submissionId: unknown,
  fields: Record<string, unknown>,
  ip: string,
  timeoutMs?: number,
): Promise<RepSubmitResult> {
  if (!repAppEnabled()) return { status: 404, error: 'This link does not work.' };
  if (!isReferralKey(referralKey)) return { status: 404, error: 'This link does not work.' };
  if (!isSubmissionId(submissionId)) return { status: 400, error: 'Invalid request body.' };
  if (STRINGS.some((k) => fields[k] != null && typeof fields[k] !== 'string')) {
    return { status: 400, error: 'Invalid request body.' };
  }
  if (keyLimited('referral', String(referralKey), ip, 30)) {
    return { status: 429, error: 'Too many requests. Please try again in a few minutes.' };
  }

  // One referral, one company (field two-track spec, section 4): exactly one company key,
  // switched on in REP_APP_COMPANIES, with a sender. Checked before the fields, so nothing
  // for a refused company is ever validated or sent.
  if (fields.companies != null) return { status: 400, error: ONE_COMPANY_MESSAGE };
  const company = checkSendCompany(fields.company, repAppCompanies());
  if (!company.ok) return { status: company.status, error: company.error };
  const sender = REP_SENDERS[company.key];
  if (!sender) return { status: 403, error: COMPANY_OFF_MESSAGE };

  const options = sender.options?.() ?? {};
  const result = sender.validate(fields, options);
  if (!result.ok) return { status: 422, errors: result.errors };

  try {
    await submitReferral(sender.payload(fields, { referralKey: String(referralKey), submissionId: String(submissionId) }, options), timeoutMs);
  } catch (err) {
    // Status only. The flow URL, the key and the office's details stay out of the log.
    if (err instanceof ReferralAppConfigError) {
      console.error('rep referral: FIELD_FLOW_URL is not set');
      return { status: 503, error: 'This referral did not send.' };
    }
    if (err instanceof ReferralKeyUnknownError) return { status: 404, error: 'This link does not work.' };
    if (err instanceof ReferralAppTimeoutError) {
      console.error('rep referral: flow timed out');
      return { status: 504, timeout: true, error: TIMEOUT_MESSAGE };
    }
    const status = err instanceof ReferralAppWriteError ? err.status : 0;
    // 1F answers 4xx when the key is not an active Rep (contract: "Refuse a mismatch").
    // That link will never work, so say so. 408 and 429 are the flow being slow or busy,
    // which a retry can fix, so they stay "did not send".
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return { status: 404, error: 'This link does not work.' };
    }
    console.error('rep referral: flow failed', status);
    return { status: 502, error: 'This referral did not send.' };
  }
  return { status: 200, ok: true };
}
