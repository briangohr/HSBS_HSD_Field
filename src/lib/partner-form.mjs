// Shared rules for the partner update page, /update/<key> (sheet PU, piece A). Plain JS so
// the page script, the save route and node --test all use the same checks. It holds no
// key, no flow URL and no lead data. Contract: docs/field-flow-contract.md, "HSBS 7F".

import { oneLine } from './one-line.mjs';
import { STAND_CHOICES } from './partner-status-words.mjs';

/** A Partner Links Link Key: 40 hex characters. Anything else is 404 before any flow call. */
export const isPartnerKey = (key) => typeof key === 'string' && /^[0-9a-fA-F]{40}$/.test(key);

/** The Service Cases Talked To Doctor choices 7F accepts. */
export const TALKED_CHOICES = ['Yes', 'Not yet, still trying', "Not yet, haven't tried"];

/**
 * The page no longer asks "Have you talked to the doctor?" (Brian, 11/20/2026). The answer
 * follows from the choice, so 7F still gets the Talked To Doctor it stores. No change sends
 * none, and the stored answer stays.
 */
export const TALKED_FOR = {
  trying: 'Not yet, still trying',
  qualified: 'Yes',
  dq_noanswer: 'Not yet, still trying',
  dq_notinterested: 'Yes',
  meeting: 'Yes',
  proposal: 'Yes',
  signed: 'Yes',
  lost: 'Yes',
  nochange: '',
};

/** The two disqualified choices. Each closes the lead and emails Brian, as a hand back did. */
export const DISQUALIFIED = ['dq_noanswer', 'dq_notinterested'];

/** "Not moving forward" reasons. No answer is its own choice now (Disqualified). */
export const CLOSED_REASONS = ['Chose another provider', 'Price', 'Timing', 'Not a fit', 'Other'];

export const CHOICE_CODES = STAND_CHOICES.map((c) => c.code);
export const MAX_UPDATES = 50;
export const NOTE_MAX = 300;
export const PRODUCT_MAX = 100;

/** The fields a save sends for each lead, in contract order. */
export const UPDATE_FIELDS = ['talkedToDoctor', 'meetingDate', 'signedDate', 'signedProduct', 'closedReason', 'note'];

/** What the page names when a field is missing or wrong. */
export const FIELD_WORDS = {
  choice: 'Where does it stand?',
  meetingDate: 'Demo date',
  signedDate: 'Signed date',
  signedProduct: 'Product',
  closedReason: 'Reason',
  note: 'Note',
};

export const SAVE_WORDS = {
  sending: 'Saving, this can take up to a minute',
  badLink: 'This link does not work.',
  expired: 'This link has expired. Use the link in your latest email.',
  timeout: 'This is taking too long. It may already have gone through. Press Save again; it will not save twice.',
  busy: 'Too many tries. Please wait a few minutes.',
  nothing: 'Pick an answer for at least one lead, then press Save.',
  tooMany: `Save up to ${MAX_UPDATES} leads at a time.`,
};

/** @param {number} n */
export const savedWords = (n) => `Saved ${n} ${n === 1 ? 'update' : 'updates'}.`;
/** @param {string} ref */
export const reloadWords = (ref) => `Lead ${ref} changed. Reload the page.`;
/** @param {string} ref @param {string} field */
export const fieldWords = (ref, field) => `Lead ${ref}: check ${FIELD_WORDS[field] ?? 'your answers'}.`;

/** Today in Eastern time, yyyy-MM-dd. Every date rule on the page and in 7F uses it. */
export function easternToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** A real calendar date written yyyy-MM-dd. */
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

/** "Nov 23, 2026" for a yyyy-MM-dd date, or "" when it is not one. */
export function showDate(value) {
  if (!isDate(value)) return '';
  const [y, m, d] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** A Service Cases item id. */
export const isLeadId = (id) => Number.isSafeInteger(id) && id > 0;

const text = (v) => (typeof v === 'string' ? v : '');

/**
 * Check one lead's answer and return the exact update 7F gets. Fields that do not belong to
 * the choice are sent blank. The same rules as 7F's check loop (sheet PU, B4).
 *
 * `today` turns on the two rules that depend on the day (meeting today or later, signed not
 * after today). The page passes it. The save route passes null: a resend after midnight
 * must still reach 7F, whose submission tag check finds what an earlier try wrote (Codex P1
 * on #14). 7F checks the day rules itself, except on a save it has already partly written.
 * @param {unknown} raw
 * @param {string | null} today yyyy-MM-dd, Eastern, or null to skip the day rules
 * @returns {{ ok: true, update: Record<string, unknown> } | { ok: false, id: number | null, field: string }}
 */
export function checkUpdate(raw, today) {
  const u = raw && typeof raw === 'object' && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : {};
  const id = isLeadId(u.id) ? /** @type {number} */ (u.id) : null;
  if (id === null) return { ok: false, id: null, field: 'id' };
  const bad = (field) => ({ ok: false, id, field });
  const choice = text(u.choice);
  if (!CHOICE_CODES.includes(choice)) return bad('choice');
  const talked = TALKED_FOR[choice] ?? '';
  const rawNote = text(u.note);
  const note = oneLine(rawNote, NOTE_MAX + 1);
  if (note.length > NOTE_MAX) return bad('note');
  const update = { id, choice, talkedToDoctor: talked, meetingDate: '', signedDate: '', signedProduct: '', closedReason: '', note };
  if (choice === 'meeting') {
    const date = text(u.meetingDate);
    if (!isDate(date) || (today !== null && date < today)) return bad('meetingDate');
    update.meetingDate = date;
  }
  if (choice === 'signed') {
    const date = text(u.signedDate);
    if (!isDate(date) || (today !== null && date > today)) return bad('signedDate');
    const product = oneLine(text(u.signedProduct), PRODUCT_MAX + 1);
    if (product.length > PRODUCT_MAX) return bad('signedProduct');
    update.signedDate = date;
    update.signedProduct = product;
  }
  if (choice === 'lost') {
    const reason = text(u.closedReason);
    if (!CLOSED_REASONS.includes(reason)) return bad('closedReason');
    update.closedReason = reason;
  }
  return { ok: true, update };
}

/**
 * Check a whole save: 1 to 50 updates, each lead once.
 * @param {unknown} updates
 * @param {string | null} today as checkUpdate
 * @returns {{ ok: true, updates: Record<string, unknown>[] } | { ok: false, id: number | null, field: string }}
 */
export function checkUpdates(updates, today) {
  if (!Array.isArray(updates) || updates.length === 0) return { ok: false, id: null, field: 'none' };
  if (updates.length > MAX_UPDATES) return { ok: false, id: null, field: 'tooMany' };
  const seen = new Set();
  const clean = [];
  for (const raw of updates) {
    const result = checkUpdate(raw, today);
    if (!result.ok) return result;
    const id = /** @type {number} */ (result.update.id);
    if (seen.has(id)) return { ok: false, id, field: 'id' };
    seen.add(id);
    clean.push(result.update);
  }
  return { ok: true, updates: clean };
}
