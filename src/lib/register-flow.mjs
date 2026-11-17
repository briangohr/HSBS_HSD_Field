// Server-side client for HSBS 1J (rep sign-up, and the #43 manager confirm, which is not
// used at launch: D18). The browser never sees REGISTER_FLOW_URL. Contract:
// docs/field-flow-contract.md.
//
// register: 1J answers 200 with {"ok":true} for a new sign-up, a repeat, and an email
// over its resend limit, so the site shows the same words for all three. A 4xx means 1J
// refused the fields, except 408 and 429 (Power Automate busy). Anything else is a
// failed send.
// confirm-peek and confirm: the manager link's single-use token. 404 unknown, 410 used
// or expired. Peek never changes anything; only confirm uses the token. Not used at
// launch (Brian, 11/9, D18: managers come from Brian's Team Roster, and a confirm grants
// nothing); off unless REP_CONFIRM_ENABLED=true; removable later.
// Every body is read whole under the request's timeout, so a body that stalls after the
// headers is a timeout, never a success. A loopback URL is allowed so tests can stand in
// for the flow.

import { cleanName } from './register-form.mjs';
import { payPlanFor, payPlanFrom, payTerms } from './rep-pay-plan.mjs';

/**
 * Sign-up waits on a row write and two emails. Under SharePoint throttling (a launch
 * meeting signing up at once) a 1J run can take well over 20s, so the wait is 45s: the
 * server function stops at 60s (astro.config.mjs maxDuration) and still needs time to
 * answer. A timeout says "This may have gone through", never "did not send".
 */
export const REGISTER_TIMEOUT_MS = 45_000;

export class RegisterConfigError extends Error {
  constructor() {
    super('REGISTER_FLOW_URL is not set to an https URL.');
    this.name = 'RegisterConfigError';
  }
}

export class RegisterRefusedError extends Error {
  /** @param {number} status */
  constructor(status) {
    super(`register refused (${status})`);
    this.name = 'RegisterRefusedError';
    this.status = status;
  }
}

export class RegisterWriteError extends Error {
  /**
   * @param {number} status 0 when the request never got an answer
   * @param {boolean} [notSent] true when the connection itself was refused or the host
   *   did not resolve, so the request never reached 1J
   */
  constructor(status, notSent = false) {
    super(`register failed (${status})`);
    this.name = 'RegisterWriteError';
    this.status = status;
    this.notSent = notSent;
  }
}

/** Connection errors that mean no byte of the request reached the flow. */
const NOT_SENT_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

export class RegisterTimeoutError extends Error {
  constructor() {
    super('register timed out');
    this.name = 'RegisterTimeoutError';
  }
}

const env = (k) => {
  const lower = k.toLowerCase();
  const match = Object.keys(process.env).find((key) => key.toLowerCase() === lower);
  return match ? process.env[match] : undefined;
};

/** The REP_APP_ENABLED switch (spec D14). Off unless exactly "true". */
export const repAppEnabled = () => env('REP_APP_ENABLED') === 'true';

/**
 * REP_APP_COMPANIES, raw: which companies the rep app may SEND to (field two-track spec,
 * section 4). Parsed by src/lib/rep-companies.mjs; unset means HealthFirst only.
 */
export const repAppCompanies = () => env('REP_APP_COMPANIES');

/**
 * The #43 manager confirm (/confirm/<token>, /api/confirm). Not used at launch (D18):
 * nothing issues a token, so the routes answer 404 before any 1J call unless
 * REP_CONFIRM_ENABLED is exactly "true" as well as REP_APP_ENABLED. Removable later.
 */
/**
 * REP_ASK_STATE: the HealthFirst form asks for the practice's state and sends it to 1F as
 * practiceState. Off unless exactly "true", so it goes on only after 1F stores the field.
 */
export const repAskState = () => repAppEnabled() && env('REP_ASK_STATE') === 'true';

export const confirmEnabled = () => repAppEnabled() && env('REP_CONFIRM_ENABLED') === 'true';

/**
 * The SPIFF plan in REP_PAY_PLAN (src/lib/rep-pay-plan.mjs): the HealthFirst plan that
 * words every promise. Unset means the approved v3 plan. A value that doesn't parse gives
 * null: nothing is promised, while ledger amounts still show with pay on (field two-track
 * spec, slice S1).
 */
export const repPayPlan = () => payPlanFrom(env('REP_PAY_PLAN'));

/**
 * The plan for one company key (field two-track spec, section 6): `HealthFirst` reads
 * REP_PAY_PLAN exactly as repPayPlan() does, `Staffing` reads REP_PAY_PLAN_STAFFING and
 * has no default. null means that company promises nothing. The default is HealthFirst,
 * so a caller that names no company gets today's plan. Whether ledger amounts show is
 * repPayEnabled(), never a plan; a bad staffing plan never turns HealthFirst pay off.
 */
export const repPayPlanFor = (company = 'HealthFirst') => {
  const plan = payPlanFor(company, { REP_PAY_PLAN: env('REP_PAY_PLAN'), REP_PAY_PLAN_STAFFING: env('REP_PAY_PLAN_STAFFING') });
  if (!plan && company === 'Staffing' && (env('REP_PAY_PLAN_STAFFING') ?? '').trim()) {
    console.error('rep pay: REP_PAY_PLAN_STAFFING does not parse, so no staffing dollar amounts are shown');
  }
  return plan;
};

/**
 * The REP_PAY_ENABLED switch (spec D14): dollar amounts from the ledger on screens. Off
 * unless exactly "true", and only counts when REP_APP_ENABLED is on too. It does not hang
 * on the plan: with REP_PAY_PLAN set but bad, the ledger rows that exist still show their
 * amounts and nothing is promised (field two-track spec, slice S1: "ledger rows that exist
 * still show their amounts"). Promises come from repPayPlan(), which is then null.
 */
export const repPayEnabled = () => {
  if (!repAppEnabled() || env('REP_PAY_ENABLED') !== 'true') return false;
  if (!repPayPlan()) console.error('rep pay: REP_PAY_PLAN does not parse, so no dollar amounts are promised');
  return true;
};

/**
 * The promise plan for screens: the HealthFirst plan with pay on, null with pay off or
 * with a plan that doesn't parse. Use repPayEnabled() for whether ledger amounts show.
 */
export const repPromisePlan = () => (repPayEnabled() ? repPayPlan() : null);

/**
 * The staffing plan that words staffing promises: REP_PAY_PLAN_STAFFING with pay on, else
 * null (slice S5). Ledger amounts never hang on it.
 */
export const repStaffingPromisePlan = () => (repPayEnabled() ? repStaffingPlan() : null);

/**
 * REP_PAY_PLAN_STAFFING as a staffing plan, or null when unset or bad. It words staffing
 * promises only; whether amounts show is repPayEnabled().
 * @returns {import('./rep-pay-plan.mjs').StaffingPayPlan | null}
 */
export const repStaffingPlan = () => /** @type {import('./rep-pay-plan.mjs').StaffingPayPlan | null} */ (repPayPlanFor('Staffing'));

/** The pay terms string for the page and every money answer (payTerms in rep-pay-plan.mjs). */
export const repPayTerms = () => {
  const pay = repPayEnabled();
  return payTerms(pay, pay ? repPayPlan() : null, pay ? repStaffingPlan() : null);
};

function flowUrl() {
  const url = env('REGISTER_FLOW_URL');
  if (!url) throw new RegisterConfigError();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new RegisterConfigError();
  }
  const loopback =
    parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  if (parsed.protocol !== 'https:' && !loopback) throw new RegisterConfigError();
  if (parsed.username || parsed.password) throw new RegisterConfigError();
  return url;
}

/** Confirm calls wait on one read, or one write and two emails. */
export const CONFIRM_TIMEOUT_MS = 15_000;

/**
 * The manager link's token: 64 lowercase hex characters (two GUIDs, no dashes).
 * @param {unknown} t
 * @returns {t is string}
 */
export const isConfirmToken = (t) => typeof t === 'string' && /^[0-9a-f]{64}$/.test(t);

export class ConfirmUnknownError extends Error {
  constructor() {
    super('confirm link unknown');
    this.name = 'ConfirmUnknownError';
  }
}

export class ConfirmUsedError extends Error {
  constructor() {
    super('confirm link used or expired');
    this.name = 'ConfirmUsedError';
  }
}

/**
 * One POST to 1J. Returns the response. Never includes the flow URL, the token or
 * anyone's details in an error.
 * @param {Record<string, unknown>} body
 * @param {number} timeoutMs
 */
async function post1J(body, timeoutMs) {
  const url = flowUrl();
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // The fetch error text can include the request URL. Don't pass it on.
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) throw new RegisterTimeoutError();
    throw new RegisterWriteError(0, NOT_SENT_CODES.has(err?.cause?.code));
  }
}

/** The whole body as text, under the same timeout as the request. */
async function readBody(res) {
  try {
    return await res.text();
  } catch (err) {
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) throw new RegisterTimeoutError();
    throw new RegisterWriteError(res.status);
  }
}

/** Success is HTTP 200 with the JSON body {"ok":true}, nothing less. */
function requireOk(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new RegisterWriteError(200);
  }
  if (!body || body.ok !== true) throw new RegisterWriteError(200);
}

/**
 * Post one sign-up to HSBS 1J. Resolves only on 200 with {"ok":true}.
 * @param {Record<string, string>} payload from registerPayload()
 * @param {number} [timeoutMs]
 */
export async function postRegistration(payload, timeoutMs = REGISTER_TIMEOUT_MS) {
  const res = await post1J(payload, timeoutMs);
  const text = await readBody(res);
  // 408 and 429 are Power Automate being slow or busy, not 1J refusing the fields, so
  // they say "not available right now", never "check your email and your manager's".
  if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
    throw new RegisterRefusedError(res.status);
  }
  if (res.status !== 200) throw new RegisterWriteError(res.status);
  requireOk(text);
}


/** 404 and 410 mean the link is done; anything else that isn't 200 is a failed call. */
function confirmStatus(res) {
  if (res.status === 404) throw new ConfirmUnknownError();
  if (res.status === 410) throw new ConfirmUsedError();
  if (res.status !== 200) throw new RegisterWriteError(res.status);
}

/**
 * Who is asking, for the page. Read-only: opening the link (or a mail scanner opening
 * it) never confirms anything. Not used at launch (D18); removable later.
 * @param {string} token
 * @returns {Promise<{ repName: string, managerName: string }>}
 */
export async function peekConfirm(token, timeoutMs = CONFIRM_TIMEOUT_MS) {
  if (!isConfirmToken(token)) throw new ConfirmUnknownError();
  const res = await post1J({ action: 'confirm-peek', token }, timeoutMs);
  const text = await readBody(res);
  confirmStatus(res);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new RegisterWriteError(200);
  }
  const repName = cleanName(body?.repName);
  const managerName = cleanName(body?.managerName);
  if (!repName) throw new RegisterWriteError(200);
  return { repName, managerName };
}

/**
 * The manager's answer. Uses the token. Not used at launch (D18); removable later. The
 * #43 contract had "yes" confirm that one rep row and "no" clear the typed manager; under
 * D18 neither grants or changes anything a screen or pay reads (only the Team Roster).
 * @param {string} token
 * @param {'yes' | 'no'} answer
 * @returns {Promise<'confirmed' | 'declined'>}
 */
export async function answerConfirm(token, answer, timeoutMs = CONFIRM_TIMEOUT_MS) {
  if (!isConfirmToken(token)) throw new ConfirmUnknownError();
  if (answer !== 'yes' && answer !== 'no') throw new RegisterRefusedError(400);
  const res = await post1J({ action: 'confirm', token, answer }, timeoutMs);
  const text = await readBody(res);
  confirmStatus(res);
  requireOk(text);
  return answer === 'yes' ? 'confirmed' : 'declined';
}
