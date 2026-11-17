// Server-side client for the HSBS 1F flow, the field app's own flow. The browser never sees
// FIELD_FLOW_URL. This site calls no other flow for a field key: every lookup, submit, list,
// earnings and team read is one POST to 1F, and nothing else.
//
// One HTTPS endpoint does these jobs, told apart by `action`:
//   lookup: the Rep Roster row for this key. See docs/field-flow-contract.md. The body carries `activate: true`.
//   submit: create one Referrals row, and answer 200 {"ok":true} only after it exists
//   list: this rep's own referrals and the Service Cases on them
//   earnings: this rep's own SPIFF Ledger rows (slice 4)
//   team: one manager's team from Brian's Team Roster, read only (slice 5, D18)
//
// The key list stays in the SharePoint Rep Roster. This module does not contain it. A
// loopback URL is allowed so local tests can stand in for the flow.
//
// Fail closed: with REP_APP_ENABLED off nothing is posted and every key is unknown. A
// lookup answer whose role is anything but "Rep" is an unknown key, so the field app opens
// only for a Rep Roster row.

import { createHash } from 'node:crypto';
import { forgetKey } from './flow-cache.mjs';
import { isReferralKey } from './field-form.mjs';
import { repAppEnabled } from './register-flow.mjs';

/**
 * Lookup, list and earnings. A launch meeting opens its links at once. Under SharePoint
 * throttling a read can take 12 to 18s (the load test's slow band).
 */
export const REP_LOOKUP_TIMEOUT_MS = 20_000;
/**
 * 408 and 429 are Power Automate being slow or busy, not 1F refusing the key, so they are
 * a failed read (try again), never "This link does not work." The same rule the submit
 * uses.
 * @param {number} status
 */
const busy = (status) => status === 408 || status === 429;
/** Under the 60s function limit, so the route can still answer after the flow stalls. */
export const SUBMIT_TIMEOUT_MS = 55_000;
/** The least a submit is given, even after a slow lookup. */
const MIN_SUBMIT_MS = 5_000;
/**
 * The submit wait left for a request that has already spent `spentMs`, such as the
 * no-JavaScript POST to /refer/<key>, which looks the key up first. The two together stay
 * under the 60s function limit, so the rep sees the timeout message, not a platform 504.
 * @param {number} spentMs
 */
export const submitBudgetMs = (spentMs) =>
  Math.max(MIN_SUBMIT_MS, Math.min(SUBMIT_TIMEOUT_MS, SUBMIT_TIMEOUT_MS - Math.max(0, spentMs)));
/** My Team. The flow answers within 20s (contract); the site waits 25s. */
export const TEAM_TIMEOUT_MS = 25_000;
const TEAM_MAX_CHARS = 2_000_000;
/** Same cap as TEAM_MAX in rep-team.mjs. */
export const TEAM_MAX_MEMBERS = 200;
const SAVED_MS = 30 * 60 * 1000;

export class ReferralKeyUnknownError extends Error {
  /**
   * Why the key did not resolve. `detail` is a short status, never the key,
   * the flow URL, or the doctor's data.
   * @param {'shape' | 'off' | 'flow-4xx' | 'flow-identity'} [code]
   * @param {string} [detail]
   */
  constructor(code = 'shape', detail = '') {
    super('unknown key');
    this.name = 'ReferralKeyUnknownError';
    this.code = code;
    this.detail = detail;
  }
}

export class ReferralAppConfigError extends Error {
  constructor() {
    super('FIELD_FLOW_URL is not set to an https URL.');
    this.name = 'ReferralAppConfigError';
  }
}

/** The flow did not answer in time. The Referrals row may already exist. */
export class ReferralAppTimeoutError extends Error {
  constructor() {
    super('flow timeout');
    this.name = 'ReferralAppTimeoutError';
  }
}

export class ReferralAppWriteError extends Error {
  /**
   * @param {number} status
   */
  constructor(status) {
    super(`flow ${status}`);
    this.name = 'ReferralAppWriteError';
    this.status = status;
  }
}

// Same case-insensitive read as src/lib/http.ts. Duplicated so this file stays
// plain JS and the node tests can import it without a TypeScript loader.
const env = (k) => {
  if (typeof process === 'undefined') return undefined;
  if (process.env[k] != null) return process.env[k];
  const lower = k.toLowerCase();
  const match = Object.keys(process.env).find((key) => key.toLowerCase() === lower);
  return match ? process.env[match] : undefined;
};

/** @returns {string} */
function flowUrl() {
  const url = env('FIELD_FLOW_URL');
  if (!url) throw new ReferralAppConfigError();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ReferralAppConfigError();
  }
  const loopback =
    parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  if (parsed.protocol !== 'https:' && !loopback) throw new ReferralAppConfigError();
  if (parsed.username || parsed.password) throw new ReferralAppConfigError();
  return url;
}

/**
 * One POST to 1F.
 * @param {Record<string, unknown>} body
 * @param {number} timeoutMs
 */
async function postFlow(body, timeoutMs) {
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
    // The fetch error text includes the request URL. Do not attach it.
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') throw new ReferralAppTimeoutError();
    throw new ReferralAppWriteError(0);
  }
}

/** Every read refuses before any network call when the key is malformed or the app is off. */
function checkKey(key) {
  if (!isReferralKey(key)) throw new ReferralKeyUnknownError('shape');
  if (!repAppEnabled()) throw new ReferralKeyUnknownError('off');
}

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const emailOk = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * A Rep Roster hit. Name and email come from the roster row, never from the page.
 * Services must include HealthFirst.
 * @param {Record<string, unknown>} body
 */
function readRep(body) {
  const name = clip(body.repName, 120);
  const email = clip(body.repEmail, 320);
  const services = Array.isArray(body.services) ? body.services.map((s) => clip(s, 40)) : [];
  if (!name || !emailOk(email) || !services.includes('HealthFirst')) {
    throw new ReferralKeyUnknownError('flow-identity', 'role:Rep');
  }
  // D18 (Brian, 11/9): a rep's manager comes from Brian's Team Roster, and nothing asks
  // the rep about it. Any managerName, managerEmail or managerStatus 1F sends is ignored.
  return { name, email, isManager: body.isManager === true };
}

/**
 * Resolve a key to a field person on the Rep Roster.
 *
 * @param {string} key
 * @returns {Promise<{ role: 'Rep', rep: { name: string, email: string }, isManager: boolean }>}
 * Only role "Rep" opens the app. A missing role or any other role is an unknown key.
 * `isManager` (slice 5) is only the JSON boolean true.
 */
export async function lookupReferral(key) {
  checkKey(key);
  // `activate` tells 1F this lookup may open a Pending Rep row (First Opened On, Status
  // Active). The app is on whenever a lookup is sent, so it is always true.
  const res = await postFlow({ action: 'lookup', referralKey: key, activate: true }, REP_LOOKUP_TIMEOUT_MS);
  if (res.status >= 300 && res.status < 400) throw new ReferralAppWriteError(res.status);
  if (res.status !== 200) {
    await res.arrayBuffer().catch(() => {});
    if (res.status >= 400 && res.status < 500 && !busy(res.status)) {
      throw new ReferralKeyUnknownError('flow-4xx', String(res.status));
    }
    throw new ReferralAppWriteError(res.status);
  }
  let body;
  try {
    const text = await res.text();
    body = JSON.parse(text.slice(0, 4000));
  } catch {
    throw new ReferralAppWriteError(200);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ReferralAppWriteError(200);
  if (clip(body.role, 20) !== 'Rep') throw new ReferralKeyUnknownError('flow-identity', 'role:bad');
  const rep = readRep(body);
  return { role: 'Rep', rep: { name: rep.name, email: rep.email }, isManager: rep.isManager };
}

/**
 * Action "list". Only the rows the flow returns for this key. The raw referrals are
 * sanitized by the caller. This does not log the key or the body.
 * @param {string} key
 * @returns {Promise<unknown[]>}
 */
export async function listReferrals(key) {
  checkKey(key);
  const res = await postFlow({ action: 'list', referralKey: key }, REP_LOOKUP_TIMEOUT_MS);
  if (res.status >= 300 && res.status < 400) throw new ReferralAppWriteError(res.status);
  if (res.status !== 200) {
    await res.arrayBuffer().catch(() => {});
    if (res.status >= 400 && res.status < 500 && !busy(res.status)) {
      throw new ReferralKeyUnknownError('flow-4xx', String(res.status));
    }
    throw new ReferralAppWriteError(res.status);
  }
  let body;
  try {
    const text = await res.text();
    body = JSON.parse(text.slice(0, 500_000));
  } catch {
    throw new ReferralAppWriteError(200);
  }
  if (!body || typeof body !== 'object' || !Array.isArray(body.referrals)) throw new ReferralAppWriteError(200);
  return body.referrals;
}

/**
 * Action "earnings" (slice 4). The rep's own SPIFF Ledger rows as payee, Payee Role Rep.
 * Raw rows are checked by rep-earnings.mjs. This does not log the key or the body.
 * @param {string} key
 * @returns {Promise<unknown[]>}
 */
export async function listEarnings(key) {
  checkKey(key);
  const res = await postFlow({ action: 'earnings', referralKey: key }, REP_LOOKUP_TIMEOUT_MS);
  if (res.status >= 300 && res.status < 400) throw new ReferralAppWriteError(res.status);
  if (res.status !== 200) {
    await res.arrayBuffer().catch(() => {});
    if (res.status >= 400 && res.status < 500 && !busy(res.status)) {
      throw new ReferralKeyUnknownError('flow-4xx', String(res.status));
    }
    throw new ReferralAppWriteError(res.status);
  }
  let body;
  try {
    const text = await res.text();
    body = JSON.parse(text.slice(0, 500_000));
  } catch {
    throw new ReferralAppWriteError(200);
  }
  if (!body || typeof body !== 'object' || !Array.isArray(body.rows)) throw new ReferralAppWriteError(200);
  return body.rows;
}

/**
 * Action "team" (slice 5, My Team, D18). One person's team, read from Brian's Team Roster
 * (every Active row whose Manager Email is this person): signed-up reps (`signedUp` true)
 * with their referrals and Rep ledger rows, reps not signed up yet (`signedUp` false) with
 * only a name, and this person's own Manager ledger rows. The raw answer holds rep emails,
 * so it stays on the server: src/lib/rep-team.mjs shapes what the browser gets. This does
 * not log the key or the body.
 * @param {string} key
 * @returns {Promise<{ team: unknown[], managerRows: unknown[] }>}
 */
export async function listTeam(key) {
  checkKey(key);
  const res = await postFlow({ action: 'team', referralKey: key }, TEAM_TIMEOUT_MS);
  if (res.status !== 200) {
    await res.arrayBuffer().catch(() => {});
    // Only 404 means "no team" (unknown key, Disabled row, or no Active Team Roster row
    // names this person). Every other answer, a 429 throttle or a 400 included, is a
    // failed call.
    if (res.status === 404) throw new ReferralKeyUnknownError('flow-4xx', '404');
    throw new ReferralAppWriteError(res.status);
  }
  const text = await readText(res);
  // Over the cap is a failed call, never a partial team (no partial money).
  if (text.length > TEAM_MAX_CHARS) throw new ReferralAppWriteError(200);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ReferralAppWriteError(200);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ReferralAppWriteError(200);
  if (!Array.isArray(body.team) || !Array.isArray(body.managerRows)) throw new ReferralAppWriteError(200);
  // More members than the site shows is a failed call too, never a team cut short.
  if (body.team.length > TEAM_MAX_MEMBERS) throw new ReferralAppWriteError(200);
  return body;
}

/** The whole body, under the request's timeout. A body that stalls is a timeout. */
async function readText(res) {
  try {
    return await res.text();
  } catch (err) {
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) throw new ReferralAppTimeoutError();
    throw new ReferralAppWriteError(200);
  }
}

/**
 * Retries already accepted with a 200, and retries still waiting on the flow. Both are
 * keyed by retryScope(): a SHA-256 of the Referral Key and the submission id. A
 * submission id alone is not enough (issue #48): it comes from the browser, so a reused id
 * on another key must still reach 1F and pass its key check. The raw key is never stored.
 */
const succeeded = new Map();
/** @type {Map<string, Promise<void>>} */
const inflight = new Map();

function remember(scope) {
  const now = Date.now();
  for (const [k, at] of succeeded) if (now - at > SAVED_MS) succeeded.delete(k);
  if (succeeded.size > 5000) succeeded.clear();
  succeeded.set(scope, now);
}

/**
 * The cache key for one submission: key hash and id. Empty when there is no id, so
 * nothing is cached or collapsed.
 * @param {unknown} referralKey
 * @param {string} id
 */
export function retryScope(referralKey, id) {
  if (!id) return '';
  const keyHash = createHash('sha256').update(typeof referralKey === 'string' ? referralKey : '').digest('hex');
  return `Rep|${keyHash}|${id}`;
}

/**
 * Wait on a write another request already started for this exact submission (same key,
 * same id), but only for this caller's own budget. Past it, this caller gets the
 * flow-timeout answer ("may already have gone through", try again with the same id) while
 * the shared write keeps running and still saves its success for that retry.
 * @param {Promise<void>} shared
 * @param {number} timeoutMs
 */
async function joinInflight(shared, timeoutMs) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ReferralAppTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([shared, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Post one referral. An exact retry (same key, same submission id) that already succeeded
 * returns success without a second post, and one still in flight joins the first, under
 * this caller's own deadline. A failed attempt is not remembered, so Try again sends the
 * same id again. Success is HTTP 200 with the JSON body {"ok":true}, read in full.
 *
 * @param {Record<string, unknown>} payload
 * @param {number} [timeoutMs]
 */
export async function submitReferral(payload, timeoutMs = SUBMIT_TIMEOUT_MS) {
  if (!repAppEnabled()) throw new ReferralKeyUnknownError('off');
  const id = typeof payload.submissionId === 'string' ? payload.submissionId : '';
  const scope = retryScope(payload.referralKey, id);
  if (scope && succeeded.has(scope)) return;
  if (scope && inflight.has(scope)) return joinInflight(inflight.get(scope), timeoutMs);
  const run = (async () => {
    const res = await postFlow(payload, timeoutMs);
    if (res.status === 504) {
      await res.arrayBuffer().catch(() => {});
      throw new ReferralAppTimeoutError();
    }
    if (res.status !== 200) {
      await res.arrayBuffer().catch(() => {});
      throw new ReferralAppWriteError(res.status);
    }
    let text;
    try {
      text = await res.text();
    } catch (err) {
      if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) throw new ReferralAppTimeoutError();
      throw new ReferralAppWriteError(200);
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ReferralAppWriteError(200);
    }
    if (!body || body.ok !== true) throw new ReferralAppWriteError(200);
    // The next Track read for this link must show the referral just sent (flow-cache.mjs).
    forgetKey(payload.referralKey);
    if (scope) remember(scope);
  })();
  if (scope) inflight.set(scope, run);
  try {
    await run;
  } finally {
    if (scope) inflight.delete(scope);
  }
}
