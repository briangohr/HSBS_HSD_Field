// Server-side client for HSBS 7F Field partner (new site), the partner update page's own
// flow (sheet PU, pieces A and B). This is the only module that posts to 7F. The browser
// never sees PARTNER_FLOW_URL. Two actions:
//   leads: the open leads of the Partner Links row with this key
//   save: write the partner's answers to those Service Cases, 200 {"ok":true,"saved":n}
//
// Same call rules as field-flow.mjs: https only (loopback for local tests), no redirects,
// JSON in and out. Fail closed: with PARTNER_PAGE_ENABLED or REP_APP_ENABLED off, or a key
// that is not 40 hex characters, nothing is posted. This module never logs the key, the
// URL or a lead. Contract: docs/field-flow-contract.md, "HSBS 7F".

import { isDate, isLeadId, isPartnerKey } from './partner-form.mjs';
import { oneLine } from './one-line.mjs';
import { repAppEnabled } from './register-flow.mjs';

export const LEADS_TIMEOUT_MS = 20_000;
/** Under the 60s function limit, so the route can still answer after the flow stalls. */
export const SAVE_TIMEOUT_MS = 55_000;
/** More leads than this in one answer is a failed read, never a list cut short. */
export const MAX_LEADS = 500;

// Same case-insensitive read as src/lib/http.ts, kept here so this stays plain JS.
const env = (k) => {
  if (typeof process === 'undefined') return undefined;
  if (process.env[k] != null) return process.env[k];
  const lower = k.toLowerCase();
  const match = Object.keys(process.env).find((key) => key.toLowerCase() === lower);
  return match ? process.env[match] : undefined;
};

/** The page and its API answer 404 unless both switches are exactly true. */
export const partnerPageEnabled = () => repAppEnabled() && env('PARTNER_PAGE_ENABLED') === 'true';

/**
 * Why a 7F call did not give leads or a save.
 * kind: 'unknown' (404, bad key, or off), 'expired' (410), 'reload' or 'bad_value' (422,
 * nothing written), 'config' (no URL), 'timeout' or 'failed' (no clear answer).
 */
export class PartnerFlowError extends Error {
  /**
   * @param {'unknown' | 'expired' | 'reload' | 'bad_value' | 'config' | 'timeout' | 'failed'} kind
   * @param {{ status?: number, id?: number | null }} [detail]
   */
  constructor(kind, detail = {}) {
    super(`partner flow: ${kind}`);
    this.name = 'PartnerFlowError';
    this.kind = kind;
    this.status = detail.status ?? 0;
    this.id = detail.id ?? null;
  }
}

function flowUrl() {
  const url = env('PARTNER_FLOW_URL');
  let parsed;
  try {
    parsed = new URL(String(url ?? ''));
  } catch {
    throw new PartnerFlowError('config');
  }
  const loopback = parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  if ((parsed.protocol !== 'https:' && !loopback) || parsed.username || parsed.password) throw new PartnerFlowError('config');
  return parsed.toString();
}

/** @param {Record<string, unknown>} body @param {number} timeoutMs */
async function post(body, timeoutMs) {
  if (!partnerPageEnabled() || !isPartnerKey(body.key)) throw new PartnerFlowError('unknown');
  const url = flowUrl();
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // The fetch error text includes the request URL. Do not attach it.
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') throw new PartnerFlowError('timeout');
    throw new PartnerFlowError('failed');
  }
  const status = res.status;
  let parsed = null;
  try {
    const raw = await res.text();
    parsed = raw.length <= 1_000_000 ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (status === 404) throw new PartnerFlowError('unknown', { status });
  if (status === 410) throw new PartnerFlowError('expired', { status });
  if (status === 422) {
    const id = parsed && isLeadId(parsed.id) ? parsed.id : null;
    throw new PartnerFlowError(parsed?.error === 'reload' ? 'reload' : 'bad_value', { status, id });
  }
  // 3xx, 202, 408, 429, 5xx and anything else: no clear answer.
  if (status !== 200 || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PartnerFlowError('failed', { status });
  }
  return parsed;
}

const date = (v) => (isDate(v) ? v : '');
const count = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);

/**
 * Keep only the display fields of one lead. No phone, email, JDE or rep detail is read,
 * so none can reach the page even when the flow sends it.
 * @param {unknown} raw
 */
export function readLead(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  if (!isLeadId(r.id)) return null;
  const ref = oneLine(r.ref, 40);
  // New-site referrals are HSBS-F<n>; the 12 moved from the old site keep HSBS-A<n>.
  if (!/^HSBS-[A-Z]{1,3}\d{1,9}$/.test(ref)) return null;
  return {
    id: /** @type {number} */ (r.id),
    ref,
    practice: oneLine(r.practice, 160),
    contact: oneLine(r.contact, 120),
    company: oneLine(r.company, 60),
    introducedOn: date(r.introducedOn),
    status: oneLine(r.status, 60),
    talkedToDoctor: oneLine(r.talkedToDoctor, 40),
    meetingDate: date(r.meetingDate),
    nextUpdateDue: date(r.nextUpdateDue),
    missedUpdates: count(r.missedUpdates),
  };
}

/**
 * Overdue first (Missed Updates above 0), then by due date, then by reference.
 * @param {NonNullable<ReturnType<typeof readLead>>[]} leads
 */
export function sortLeads(leads) {
  const due = (l) => l.nextUpdateDue || '9999-12-31';
  return [...leads].sort(
    (a, b) =>
      Number(b.missedUpdates > 0) - Number(a.missedUpdates > 0) ||
      due(a).localeCompare(due(b)) ||
      a.ref.localeCompare(b.ref, 'en', { numeric: true }),
  );
}

/**
 * Action "leads".
 * @param {string} key
 */
export async function listLeads(key) {
  const body = await post({ action: 'leads', key }, LEADS_TIMEOUT_MS);
  if (!Array.isArray(body.leads) || body.leads.length > MAX_LEADS) throw new PartnerFlowError('failed', { status: 200 });
  const leads = body.leads.map(readLead).filter((l) => l !== null);
  return { partner: oneLine(body.partner, 80), leads: sortLeads(leads) };
}

/**
 * Action "save". The updates are already checked (checkUpdates in partner-form.mjs).
 * Success is only 200 {"ok":true,"saved":n}.
 * @param {string} key
 * @param {string} submissionId
 * @param {Record<string, unknown>[]} updates
 */
export async function saveUpdates(key, submissionId, updates) {
  const body = await post({ action: 'save', key, submissionId, updates }, SAVE_TIMEOUT_MS);
  if (body.ok !== true || !Number.isSafeInteger(body.saved) || body.saved < 0) {
    throw new PartnerFlowError('failed', { status: 200 });
  }
  return /** @type {number} */ (body.saved);
}
