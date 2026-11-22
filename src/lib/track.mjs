// Track My Referrals presentation. HSBS 1F action "list" returns the facts.
// This module turns them into counts, filters, plain status lines and the
// 7-day flag. It does not call the flow.
// The live list uses SharePoint names. Those are mapped onto the contract
// names below. When both are present, the contract name wins, except the row
// id: a title (HSBS-…) is the stable id when the list sent one.

import { displayStatus, displayStatusText, isClosedStatus, isSignedStatus } from './partner-status-words.mjs';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const s = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim().slice(0, max);

/**
 * YYYY-MM-DD, a timestamp that starts with one, or M/D/YYYY. Anything else is blank.
 * @param {unknown} value
 */
function calendarDate(value) {
  const text = s(value, 64);
  const lead = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(text);
  const us = lead ? null : /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = lead
    ? `${lead[1]}-${lead[2]}-${lead[3]}`
    : us
      ? `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
      : '';
  if (!DATE.test(iso)) return '';
  const day = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(day.getTime())) return '';
  return day.toISOString().slice(0, 10) === iso ? iso : '';
}

/** @param {unknown[]} values */
function firstDate(values) {
  for (const value of values) {
    const iso = calendarDate(value);
    if (iso) return iso;
  }
  return '';
}

/**
 * Title (HSBS-…) when the list sent one. Otherwise the contract id, or the item number.
 * @param {Record<string, unknown>} row
 */
function referralId(row) {
  const title = typeof row.title === 'string' ? s(row.title, 40) : '';
  if (title) return title;
  if (typeof row.id === 'number' && Number.isFinite(row.id)) return String(Math.trunc(row.id)).slice(0, 40);
  return s(row.id, 40);
}

/** Calendar day in Eastern time, YYYY-MM-DD. */
export function todayInNewYork(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** @param {string} iso */
export function shortDate(iso) {
  if (!DATE.test(iso)) return '';
  const day = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(day.getTime())) return '';
  return day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
}

/** @param {string} earlier @param {string} later */
export function daysBetween(earlier, later) {
  if (!DATE.test(earlier) || !DATE.test(later)) return null;
  const a = Date.parse(`${earlier}T12:00:00Z`);
  const b = Date.parse(`${later}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Drop anything that is not a display field. A key the flow echoes is not kept.
 * @param {unknown} raw
 */
export function sanitizeReferral(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = /** @type {Record<string, unknown>} */ (raw);
  const id = referralId(row);
  // Only the id is required. A blank Doctor Name (the contact) still shows on Track, named
  // by its practice or its id (officeName), so a referral is never missing (G2 finding 7).
  const doctorName = s(row.doctorName, 120) || s(row.doctor, 120);
  if (!id) return null;
  const source = Array.isArray(row.lines) ? row.lines : Array.isArray(row.cases) ? row.cases : [];
  const lines = source.slice(0, 20).map(sanitizeLine).filter(Boolean);
  const history = Array.isArray(row.history) ? row.history.slice(-50).map(sanitizeHistory).filter(Boolean) : [];
  // The field app has one route: the partner calls first. Anything else is blank.
  const route = row.route === 'Partner' ? 'Partner' : '';
  return {
    id,
    doctorName,
    practiceName: s(row.practiceName, 160) || s(row.practice, 160),
    sentOn: firstDate([row.sentOn, row.created]),
    route,
    closed: row.closed === true,
    signed: row.signed === true,
    lines,
    history,
  };
}

/** @param {unknown} raw */
function sanitizeLine(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = /** @type {Record<string, unknown>} */ (raw);
  const company = s(row.company, 80);
  // A new Service Case has its company and no Partner Status until the partner's first
  // update (the 3F flows set Status, not Partner Status). It still names the company, so
  // it is kept with a blank status; dropping it made Track fall back to HealthFirst.
  const status = s(row.status, 80) || s(row.partnerStatus, 80);
  if (!company) return null;
  const line = {
    company,
    status,
    detail: s(row.detail, 200),
    updatedOn: firstDate([row.updatedOn, row.updated, row.lastTouch]),
  };
  // Field two-track spec section 5 (sheet F6): values the list sends, kept only when sent,
  // so a row with none of them is exactly the row on main. Each is a stored choice, never
  // words. The partner's typed Not Qualified Note is not on this list and is never kept.
  for (const key of ['solutions', 'practiceType', 'qualified', 'notQualifiedReason', 'closedReason']) {
    if (typeof row[key] === 'string') line[key] = s(row[key], 120);
  }
  return line;
}

/** @param {unknown} raw */
function sanitizeHistory(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = /** @type {Record<string, unknown>} */ (raw);
  const text = s(row.text, 240);
  if (!text) return null;
  const on = s(row.on, 10);
  /** @type {{ on: string, text: string, company?: string, solutions?: string }} */
  const out = { on: DATE.test(on) ? on : '', text };
  // The case the entry came from (status-log.mjs), kept only when sent.
  const company = s(row.company, 80);
  const solutions = s(row.solutions, 120);
  if (company) out.company = company;
  if (solutions) out.solutions = solutions;
  return out;
}

/**
 * The name a rep sees for a referral: the practice, else the contact, else "Referral <id>".
 * A manager's view never uses this, because it never shows the contact.
 * @param {{ id: string, doctorName: string, practiceName: string }} row
 */
export function officeName(row) {
  return row.practiceName || row.doctorName || `Referral ${row.id}`;
}

/**
 * A case the partner closed as not qualified: Qualified No and Closed Reason Not qualified,
 * both stored (spec section 5). Qualified alone is never enough.
 * @param {{ qualified?: string, closedReason?: string }} line
 */
export function isNotQualifiedClose(line) {
  return line.qualified === 'No' && line.closedReason === 'Not qualified';
}

/**
 * @param {ReturnType<typeof sanitizeReferral>} row
 * @param {string} today
 */
export function bucketOf(row) {
  const signed = row.signed || row.lines.some((line) => isSignedStatus(line.status));
  if (signed) return 'signed';
  // The rule on main: closed when every case is closed. A case the partner marked not
  // qualified counts as closed, so one such case never closes a referral whose other cases
  // are still active.
  const everyClosed = row.lines.length > 0 && row.lines.every((line) => isClosedStatus(line.status) || isNotQualifiedClose(line));
  if (row.closed || everyClosed) return 'closed';
  return 'inProgress';
}

/**
 * @param {ReturnType<typeof sanitizeReferral>} row
 * @param {string} today
 */
function staleText(row, today) {
  if (bucketOf(row, today) !== 'inProgress') return '';
  /** @type {string[]} */
  const dates = [];
  if (row.sentOn) dates.push(row.sentOn);
  for (const line of row.lines) if (line.updatedOn) dates.push(line.updatedOn);
  if (dates.length === 0) return '';
  const latest = dates.sort().at(-1) ?? '';
  const days = daysBetween(latest, today);
  if (days == null || days < 7) return '';
  return `No update in ${days} days`;
}

/**
 * @param {ReturnType<typeof sanitizeReferral>} row
 */
function routeLabel(row) {
  if (row.route === 'Partner') {
    return row.lines.length >= 2 ? 'Sent to partners' : 'Sent to partner';
  }
  return '';
}

/**
 * @param {unknown} list
 * @param {string} [today]
 */
export function decorateReferrals(list, today = todayInNewYork()) {
  // Every row, sorted newest first. No cap here: the read already refuses an oversized list,
  // and a cap before the sort dropped the newest referral (field MVP plan R5).
  const rows = (Array.isArray(list) ? list : [])
    .map(sanitizeReferral)
    .filter(Boolean)
    .sort((a, b) => (a.sentOn < b.sentOn ? 1 : a.sentOn > b.sentOn ? -1 : a.id < b.id ? 1 : -1));

  const referrals = rows.map((row) => ({
    id: row.id,
    doctorName: row.doctorName,
    practiceName: row.practiceName,
    sentLabel: row.sentOn ? `Sent ${shortDate(row.sentOn)}` : 'Sent',
    routeLabel: routeLabel(row),
    bucket: bucketOf(row),
    staleText: staleText(row, today),
    lines: row.lines.map((line) => ({
      company: line.company,
      status: displayStatus(line.status),
      detail: displayStatusText(line.detail),
      updatedLabel: line.updatedOn ? `Updated ${shortDate(line.updatedOn)}` : '',
    })),
    history: [...row.history]
      .sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0))
      .map((item) => {
        const text = displayStatusText(item.text);
        return { label: item.on ? `${shortDate(item.on)}. ${text}` : text };
      }),
  }));

  return {
    counts: {
      sent: referrals.length,
      inProgress: referrals.filter((row) => row.bucket === 'inProgress').length,
      signed: referrals.filter((row) => row.bucket === 'signed').length,
      closed: referrals.filter((row) => row.bucket === 'closed').length,
    },
    referrals,
  };
}
