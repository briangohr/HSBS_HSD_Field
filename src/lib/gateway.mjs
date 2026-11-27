// Server-side client for HSBS GW Field gateway (new site), the one flow that reads, writes and
// sends for Field code (lean rebuild, G0). This is the only module that posts to the gateway.
// Logic lives in tested code; the gateway is four plain operations:
//   read    rows of one allowlisted list, filtered by equals and not-equals clauses
//   create  one row, answered only after it exists
//   patch   one row by id and etag, a stale etag is a clean 412
//   send    one mail, answered only after the mail action returned
// There is no delete. The flow, not this module, enforces the list, column and recipient
// allowlists (docs/field-flow-contract.md, "HSBS GW"). This module also refuses anything
// outside the list allowlist so a typo never reaches the flow.
//
// Same call rules as field-flow.mjs: https only (loopback for local tests), no redirects, JSON
// in and out, fail closed. Never logs the URL, the secret, a row or a mail. Success is HTTP 200
// with {"ok":true} after the write or send is done. A 202, a timeout or non-JSON on a write is
// "maybe": it may have happened, so the caller must not resend a mail or create a second row.

import { repAppEnabled } from './register-flow.mjs';

export const READ_TIMEOUT_MS = 20_000;
export const WRITE_TIMEOUT_MS = 55_000;
export const SEND_TIMEOUT_MS = 30_000;
/** One read answers at most this many rows. More is a failed read, never a list cut short. */
export const MAX_ROWS = 500;

/** The lists the gateway may touch. Same set the flow allows. */
export const LISTS = Object.freeze([
  'Referrals',
  'Service Cases',
  'Routing',
  'Rep Roster',
  'Field Settings',
  'Field Send Log',
]);

const env = (k) => {
  if (typeof process === 'undefined') return undefined;
  if (process.env[k] != null) return process.env[k];
  const lower = k.toLowerCase();
  const match = Object.keys(process.env).find((key) => key.toLowerCase() === lower);
  return match ? process.env[match] : undefined;
};

/** Code that uses the gateway runs only with REP_APP_ENABLED and GATEWAY_ENABLED exactly true. */
export const gatewayEnabled = () => repAppEnabled() && env('GATEWAY_ENABLED') === 'true';

/**
 * kind: 'disabled' or 'config' (nothing posted), 'bad_request' (refused here, nothing posted),
 * 'not_allowed' (403, nothing written), 'stale' (412, nothing written), 'failed' (a clear no),
 * 'maybe' (a write or send with no clear answer: it may have happened).
 */
export class GatewayError extends Error {
  /**
   * @param {'disabled' | 'config' | 'bad_request' | 'not_allowed' | 'stale' | 'failed' | 'maybe'} kind
   * @param {{ status?: number }} [detail]
   */
  constructor(kind, detail = {}) {
    super(`gateway: ${kind}`);
    this.name = 'GatewayError';
    this.kind = kind;
    this.status = detail.status ?? 0;
  }
}

function target() {
  let parsed;
  try {
    parsed = new URL(String(env('GATEWAY_FLOW_URL') ?? ''));
  } catch {
    throw new GatewayError('config');
  }
  const loopback = parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  if ((parsed.protocol !== 'https:' && !loopback) || parsed.username || parsed.password) throw new GatewayError('config');
  const secret = String(env('GATEWAY_SECRET') ?? '');
  if (secret.length < 16) throw new GatewayError('config');
  return { url: parsed.toString(), secret };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isId = (v) => Number.isSafeInteger(v) && v > 0;
const isEtag = (v) => typeof v === 'string' && v.length > 0 && v.length <= 100;

/** A column value: text, number, yes or no, blank, or a list of text (multi choice). */
function isValue(v) {
  if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) return true;
  return Array.isArray(v) && v.length <= 50 && v.every((x) => typeof x === 'string');
}
const isFields = (f) => isObject(f) && Object.keys(f).length > 0 && Object.values(f).every(isValue);
const isList = (l) => typeof l === 'string' && LISTS.includes(l);
const isAddress = (a) => typeof a === 'string' && a.length <= 254 && /^[^\s@;,<>]+@[^\s@;,<>]+$/.test(a);

/**
 * @param {Record<string, unknown>} body
 * @param {number} timeoutMs
 * @param {boolean} write a write or send: no clear answer is "maybe", not "failed"
 */
async function post(body, timeoutMs, write) {
  if (!gatewayEnabled()) throw new GatewayError('disabled');
  const { url, secret } = target();
  const unclear = (status = 0) => new GatewayError(write ? 'maybe' : 'failed', { status });
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-gw-secret': secret },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    // The fetch error text includes the request URL. Do not attach it.
    throw unclear();
  }
  const status = res.status;
  let parsed = null;
  try {
    const raw = await res.text();
    parsed = raw.length <= 2_000_000 ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (status === 401) throw new GatewayError('config', { status });
  if (status === 403) throw new GatewayError('not_allowed', { status });
  if (status === 412) throw new GatewayError('stale', { status });
  if (status === 400 || status === 404 || status === 422) throw new GatewayError('failed', { status });
  // 3xx, 202, 408, 429, 5xx, non-JSON and anything else: no clear answer.
  if (status !== 200 || !isObject(parsed) || parsed.ok !== true) throw unclear(status);
  return parsed;
}

/**
 * One filter clause. All clauses of a read must match.
 * @typedef {{ column: string, op: 'eq' | 'ne' | 'gt', value: string | number | boolean | null }} Clause  `gt` only on `ID`, with a whole number
 */

/**
 * Paging is by row id, not by offset: SharePoint REST ignores `$skip` on list items. When more
 * rows may match, `next` is the id of this page's last row; read the next page by adding
 * `{ column: 'ID', op: 'gt', value: next }`.
 * @param {{ list: string, select?: string[], where?: Clause[], top?: number }} q
 * @returns {Promise<{ items: { id: number, etag: string, fields: Record<string, unknown> }[], next: number | null }>}
 */
export async function readRows(q) {
  const { list, select = [], where = [], top = 100 } = q;
  if (!isList(list) || 'skip' in q) throw new GatewayError('bad_request');
  if (!Number.isSafeInteger(top) || top < 1 || top > MAX_ROWS) throw new GatewayError('bad_request');
  if (where.filter((c) => isObject(c) && c.op === 'gt').length > 1) throw new GatewayError('bad_request');
  const clauses = where.every(
    (c) =>
      isObject(c) &&
      typeof c.column === 'string' &&
      (['eq', 'ne'].includes(c.op)
        ? c.value === null || ['string', 'number', 'boolean'].includes(typeof c.value)
        : c.op === 'gt' && c.column === 'ID' && Number.isSafeInteger(c.value) && c.value >= 0),
  );
  if (!clauses || where.length > 10 || !Array.isArray(select) || select.some((s) => typeof s !== 'string')) {
    throw new GatewayError('bad_request');
  }
  const body = await post({ op: 'read', list, select, where, top }, READ_TIMEOUT_MS, false);
  if (!Array.isArray(body.items) || body.items.length > MAX_ROWS) throw new GatewayError('failed', { status: 200 });
  const items = [];
  for (const row of body.items) {
    if (!isObject(row) || !isId(row.id) || !isEtag(row.etag) || !isObject(row.fields)) throw new GatewayError('failed', { status: 200 });
    items.push({ id: row.id, etag: row.etag, fields: row.fields });
  }
  // Rows must come in ascending id order, and `next` must be the last row's id. Anything else
  // would page wrong, so it is a failed read.
  if (items.some((r, i) => i > 0 && r.id <= items[i - 1].id)) throw new GatewayError('failed', { status: 200 });
  const next = body.next ?? null;
  if (next !== null && (items.length === 0 || next !== items[items.length - 1].id)) throw new GatewayError('failed', { status: 200 });
  return { items, next };
}

/**
 * @param {{ list: string, fields: Record<string, unknown> }} row
 * @returns {Promise<{ id: number, etag: string }>}
 */
export async function createRow({ list, fields }) {
  if (!isList(list) || !isFields(fields)) throw new GatewayError('bad_request');
  const body = await post({ op: 'create', list, fields }, WRITE_TIMEOUT_MS, true);
  if (!isId(body.id) || !isEtag(body.etag)) throw new GatewayError('maybe', { status: 200 });
  return { id: /** @type {number} */ (body.id), etag: /** @type {string} */ (body.etag) };
}

/**
 * @param {{ list: string, id: number, etag: string, fields: Record<string, unknown> }} row
 * @returns {Promise<{ etag: string }>}
 */
export async function patchRow({ list, id, etag, fields }) {
  if (!isList(list) || !isId(id) || !isEtag(etag) || !isFields(fields)) throw new GatewayError('bad_request');
  const body = await post({ op: 'patch', list, id, etag, fields }, WRITE_TIMEOUT_MS, true);
  if (!isEtag(body.etag)) throw new GatewayError('maybe', { status: 200 });
  return { etag: /** @type {string} */ (body.etag) };
}

/**
 * @param {{ to: string[], cc?: string[], replyTo?: string, subject: string, html: string, importance?: 'Low' | 'Normal' | 'High' }} mail
 * @returns {Promise<void>}
 */
export async function sendMail({ to, cc = [], replyTo = '', subject, html, importance = 'Normal' }) {
  const addresses = [...to, ...cc];
  if (
    to.length < 1 ||
    addresses.length > 20 ||
    !addresses.every(isAddress) ||
    (replyTo !== '' && !isAddress(replyTo)) ||
    typeof subject !== 'string' ||
    subject.length < 1 ||
    subject.length > 300 ||
    /[\r\n]/.test(subject) ||
    typeof html !== 'string' ||
    html.length > 200_000 ||
    !['Low', 'Normal', 'High'].includes(importance)
  ) {
    throw new GatewayError('bad_request');
  }
  await post({ op: 'send', to, cc, replyTo, subject, html, importance }, SEND_TIMEOUT_MS, true);
}

/** The four operations as one object: the store port that job code takes (see gateway-fake.mjs). */
export const gatewayStore = Object.freeze({ read: readRows, create: createRow, patch: patchRow, send: sendMail });
