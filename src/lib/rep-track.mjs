// "Latest updates" for the Rep app's Track My Referrals (spec v3 section 2): one running
// feed across all of the rep's referrals, newest first. Built from the same 1F list rows
// Track uses, through the same sanitizer, so nothing new reaches the page.
// Each line is in the same plain words as Track's rows and lead screen (rep-lead.mjs):
// "Nov 14. North Side Dental: Signed and billed."

import { decorateReferrals, sanitizeReferral, shortDate, todayInNewYork } from './track.mjs';
import { displayStatus } from './partner-status-words.mjs';
import { historyWords, labelSentences, lineCompany, mainLine, closeWordsFor, isStaffingCompany } from './rep-lead.mjs';

export const FEED_MAX = 50;

/**
 * `kinds` says what the line reports, so My Earnings can put "You earned $N." on the
 * status line for the same event instead of adding a second line (spec section 2). One
 * partner update can report two events ("Talked with the doctor on Nov 14, 2026. Signed
 * on Nov 14, 2026: kit plan."), so a line can be both reached and signed.
 * @typedef {'signed' | 'reached' | 'status' | 'stale' | 'money'} FeedKind
 * @typedef {{ on: string, label: string, referralId: string, kinds: FeedKind[] }} FeedItem
 */

// One sentence of a Status Log line, with or without the "<partner>: " in front.
const SIGNED = /^(?:[^:.]{1,80}:\s*)?(?:signed|won|closed - won|close won)\b/i;
const TALKED = /^(?:[^:.]{1,80}:\s*)?talked with the doctor\b/i;
const TALKED_STAFFING = /^(?:[^:.]{1,80}:\s*)?talked with the customer\b/i;
/** "Qualified" on the partner page means the partner reached the office (11/20/2026). */
const QUALIFIED = /^(?:[^:.]{1,80}:\s*)?qualified\b/i;

/**
 * What a Status Log line reports. The log writes "<partner>: <label>" ("Unitas:
 * Talked with the doctor"), and the partner page's label can hold
 * two sentences, one per question (the partner update page): "Talked with the
 * doctor on Nov 14, 2026. Signed on Nov 14, 2026: kit plan." Each label sentence is read;
 * the partner's free-text note never is (rep-lead.mjs labelSentences).
 * @param {string} text
 * @returns {FeedKind[]}
 */
export function historyKinds(text, company = 'HealthFirst') {
  /** @type {FeedKind[]} */
  const kinds = [];
  for (const sentence of labelSentences(text, isStaffingCompany(company))) {
    const t = sentence.trim();
    if (SIGNED.test(t) && !kinds.includes('signed')) kinds.push('signed');
    const bare = t.replace(/^[^:.]{1,80}:\s*/, '').replace(/\.$/, '');
    if ((TALKED.test(t) || QUALIFIED.test(t) || (isStaffingCompany(company) && TALKED_STAFFING.test(t)) || displayStatus(bare) === 'Reached the doctor') && !kinds.includes('reached')) kinds.push('reached');
  }
  return kinds.length ? kinds : ['status'];
}

/**
 * @param {unknown} list raw 1F list rows
 * @param {string} [today] YYYY-MM-DD, Eastern
 * @returns {FeedItem[]}
 */
export function repFeed(list, today = todayInNewYork()) {
  const rows = (Array.isArray(list) ? list : []).slice(0, 200).map(sanitizeReferral).filter(Boolean);
  const decorated = new Map(decorateReferrals(list, today).referrals.map((r) => [r.id, r]));
  /** @type {FeedItem[]} */
  const items = [];
  for (const row of rows) {
    const place = row.practiceName || row.doctorName;
    const company = lineCompany(mainLine(row));
    for (const h of row.history) {
      if (!h.on) continue;
      const words = historyWords(h.text, company, closeWordsFor(row));
      // Every feed line ends with a period, like the stale lines: "Nov 14. North Side Dental: Signed and billed."
      const label = `${shortDate(h.on)}. ${place}: ${words}`;
      items.push({ on: h.on, label: /[.!?]$/.test(label) ? label : `${label}.`, referralId: row.id, kinds: historyKinds(h.text, company) });
    }
    const stale = decorated.get(row.id)?.staleText;
    if (stale) items.push({ on: today, label: `${shortDate(today)}. ${stale} on ${place}.`, referralId: row.id, kinds: ['stale'] });
  }
  items.sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0));
  return items.slice(0, FEED_MAX);
}
