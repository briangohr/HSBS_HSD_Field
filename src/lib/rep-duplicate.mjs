// Duplicate warning before Send (Brian, 11/21/2026). Before a referral goes out, the page
// asks whether the rep already has an open referral for the same office to the same
// company. It warns, never blocks: a second press of Send sends it.
//
// The match reads only the rep's own 1F `list` rows, the same ones Track shows, so it never
// sees another rep's referrals. An office matches on its practice name (letter case, spaces
// and punctuation ignored), or on its JDE when the list row carries one. 1F `list` sends no
// JDE today; the JDE match starts working once it does, with no site change. The JDE is read
// on the server only and never reaches the page.
//
// Open means the referral is still in progress (decorateReferrals) and its line for that
// company is not closed or signed. A referral with no line yet counts as HealthFirst, the
// way Track names it.

import { decorateReferrals, isNotQualifiedClose, officeName, sanitizeReferral, todayInNewYork } from './track.mjs';
import { isClosedStatus, isSignedStatus } from './partner-status-words.mjs';
import { lineKey } from './rep-lead.mjs';
import { companyName } from './rep-companies.mjs';

const COMPANIES = new Set(['HealthFirst', 'Staffing']);

/**
 * A practice name as the match compares it: lower case, "&" read as "and", only letters and
 * digits kept. "TEST North-Side Dental, P.C." and "test northside dental pc" match.
 * @param {unknown} name
 */
export function practiceKey(name) {
  return (typeof name === 'string' ? name : '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 160);
}

/** A JDE as text, trimmed, so leading zeros count. '' when it is not digits. @param {unknown} jde */
export function jdeKey(jde) {
  const t = typeof jde === 'string' ? jde.trim() : typeof jde === 'number' && Number.isFinite(jde) ? String(jde) : '';
  return /^\d{1,40}$/.test(t) ? t : '';
}

/**
 * The rep's open referral for this office and company, or null.
 * @param {unknown} list raw 1F list rows
 * @param {{ company: unknown, practiceName: unknown, jde?: unknown }} send what the form holds
 * @param {string} [today] YYYY-MM-DD, Eastern
 * @returns {{ office: string, sentLabel: string, company: string } | null}
 */
export function findOpenDuplicate(list, send, today = todayInNewYork()) {
  const company = typeof send?.company === 'string' && COMPANIES.has(send.company) ? send.company : '';
  const name = practiceKey(send?.practiceName);
  const jde = jdeKey(send?.jde);
  if (!company || (!name && !jde)) return null;
  // The whole list: listReferrals already fails a read over REFERRAL_READ_MAX (FT-1).
  const raw = Array.isArray(list) ? list : [];
  const buckets = new Map(decorateReferrals(raw, today).referrals.map((r) => [r.id, r]));
  for (const item of raw) {
    const row = sanitizeReferral(item);
    if (!row) continue;
    const view = buckets.get(row.id);
    if (!view || view.bucket !== 'inProgress') continue;
    const sameName = name !== '' && practiceKey(row.practiceName) === name;
    const rowJde = jdeKey(/** @type {Record<string, unknown>} */ (item).jde);
    const sameJde = jde !== '' && rowJde === jde;
    if (!sameName && !sameJde) continue;
    const open =
      row.lines.length === 0
        ? company === 'HealthFirst'
        : row.lines.some((l) => lineKey(l) === company && !isClosedStatus(l.status) && !isSignedStatus(l.status) && !isNotQualifiedClose(l));
    if (!open) continue;
    return { office: officeName(row), sentLabel: view.sentLabel, company: companyName(company) || company };
  }
  return null;
}

/**
 * The warning the page shows, in plain words.
 * @param {{ office: string, sentLabel: string, company: string }} dup
 */
export function duplicateWarning(dup) {
  const sent = dup.sentLabel.replace(/^Sent\s*/, '');
  return `You already sent ${dup.office} to ${dup.company}${sent ? ` on ${sent}` : ''}, and it is still open. Check Track first. To send another referral anyway, press Send again.`;
}
