// The rep app's companies (field two-track spec, section 4 "Send"). One table, and the
// only place a company key, its Solutions value and its screen name are tied together.
// The key is what REP_APP_COMPANIES, the pay plan settings and the ledger's Company
// column hold. The Solutions value is what a submit sends in `companies` and what
// Referrals and Service Cases store, exactly as the field app sends it today
// (src/lib/field-form.mjs). The name is what the rep and the customer see.
//
// REP_APP_COMPANIES gates SENDING only: which companies the Send tab offers and which
// the server accepts on a new send. Nothing on Track, My Earnings or My Team reads it,
// so it never hides a referral or an award that already exists (check M15).

/**
 * @typedef {{
 *   key: string,
 *   solutions: string,
 *   name: string,
 *   form: boolean,
 * }} RepCompany
 */

/**
 * In Send order. `form` says whether the site has a send form for the company. A company
 * with `form: false` can be listed in REP_APP_COMPANIES and shows a placeholder on the
 * Send tab, but the server refuses every send to it (src/lib/rep-submit.ts).
 *
 * A company's `form` and its sender in REP_SENDERS (src/lib/rep-submit.ts) go together;
 * rep-companies.test.mjs fails until both agree.
 * @type {readonly RepCompany[]}
 */
export const REP_COMPANIES = Object.freeze([
  Object.freeze({ key: 'HealthFirst', solutions: 'HealthFirst', name: 'HealthFirst', form: true }),
  Object.freeze({
    key: 'Staffing',
    solutions: 'HS Staffing / Recruiting Services (including GoTu)',
    name: 'Direct Dental',
    form: true,
  }),
]);

/** Unset, empty or nothing known in REP_APP_COMPANIES: today's app, HealthFirst only. */
export const DEFAULT_REP_COMPANIES = Object.freeze(['HealthFirst']);

/** @param {unknown} key */
export const repCompany = (key) => REP_COMPANIES.find((c) => c.key === key);

/** The key for a Solutions value, or '' when the value is not in the table (no plan, no dollars). */
export const keyForSolutions = (/** @type {unknown} */ solutions) =>
  REP_COMPANIES.find((c) => c.solutions === solutions)?.key ?? '';

/** The Solutions value for a key, or '' for an unknown key. */
export const solutionsForKey = (/** @type {unknown} */ key) => repCompany(key)?.solutions ?? '';

/** The screen name for a key, or '' for an unknown key. */
export const companyName = (/** @type {unknown} */ key) => repCompany(key)?.name ?? '';

/**
 * Parse REP_APP_COMPANIES: a comma list of company keys.
 * - Each entry is trimmed and matched to a key without regard to case ("staffing" is
 *   Staffing). An entry that matches no key is dropped. Repeats count once.
 * - The result is in table order, not the order typed.
 * - Unset, empty, or nothing left after dropping: HealthFirst only, today's app.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseRepCompanies(raw) {
  if (typeof raw !== 'string') return [...DEFAULT_REP_COMPANIES];
  const typed = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const keys = REP_COMPANIES.filter((c) => typed.has(c.key.toLowerCase())).map((c) => c.key);
  return keys.length ? keys : [...DEFAULT_REP_COMPANIES];
}

/**
 * What the Send tab shows for a REP_APP_COMPANIES value.
 * `classic` is today's HealthFirst-only Send tab, unchanged from main. `choice` means it
 * opens on a company choice.
 * @param {unknown} raw
 */
export function sendTab(raw) {
  const keys = parseRepCompanies(raw);
  return { keys, choice: keys.length > 1, classic: keys.length === 1 && keys[0] === 'HealthFirst' };
}

export const ONE_COMPANY_MESSAGE = 'Pick one company for this referral.';
export const STALE_MESSAGE = 'This page is out of date. Reload it, then send again.';
export const COMPANY_OFF_MESSAGE = 'Referrals to this company are not open right now.';

/**
 * The company a rep app submit names, checked before anything is sent (spec section 4,
 * "One referral, one company"). The request must name exactly one company key, spelled
 * exactly, that is switched on and has a form. The answer never depends on anything but
 * the request and REP_APP_COMPANIES.
 * - none named: 409, the page is older than this rule (it sends no company); reload.
 * - two or more, or a value that is not a string: 400.
 * - unknown, switched off, or no form yet: 403.
 * @param {unknown} named the request's `company`: a string, or the list a form posted
 * @param {unknown} raw REP_APP_COMPANIES
 * @returns {{ ok: true, key: string } | { ok: false, status: number, error: string }}
 */
export function checkSendCompany(named, raw) {
  const list = named == null ? [] : Array.isArray(named) ? named : [named];
  if (list.some((v) => typeof v !== 'string')) return { ok: false, status: 400, error: ONE_COMPANY_MESSAGE };
  if (list.length > 1) return { ok: false, status: 400, error: ONE_COMPANY_MESSAGE };
  if (list.length === 0 || list[0] === '') return { ok: false, status: 409, error: STALE_MESSAGE };
  const company = repCompany(list[0]);
  if (!company || !company.form || !parseRepCompanies(raw).includes(company.key)) {
    return { ok: false, status: 403, error: COMPANY_OFF_MESSAGE };
  }
  return { ok: true, key: company.key };
}
