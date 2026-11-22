// G2 (11/22/2026 history check): Track showed no history, because 1F `list` sent no
// Status Log. 1F now sends each Service Case's Status Log as `statusLog` on its line (the
// raw multi-line text, oldest line first), and this turns it into the referral's `history`
// (`on`, `text`) that Track, the lead screen and the feed already read.
//
// The flows write one line per event, newest at the bottom:
//   7F partner save   "2026-11-22 HealthFirst: Trying to reach. <note> [s:<submissionId>]"
//   7H email reply    "2026-11-22 HealthFirst: replied by email. [r:<received>]"
//   7G escalation     "2026-11-22 escalated to Brian [esc:<last update>]"
// The bracket tags are flow bookkeeping (retry and dedupe keys), so they are removed. An
// escalation line is HSBS's own follow-up, not the partner's, so it never shows. A line with
// no leading date keeps its text with a blank `on` (an older 7B line, "<partner>: <label>").

/** Most history lines kept per referral: the newest ones. */
export const HISTORY_MAX = 50;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LEAD_ISO = /^(\d{4}-\d{2}-\d{2})(?:T[\d:.]+Z?)?\s+/;
const LEAD_US = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+/;
const TAG = /\s*\[(?:s|r|esc):[^\]]*\]/gi;
const ESCALATION = /^escalated to\b/i;
/** A Status Log longer than this is cut before it is read (it is never this long). */
const LOG_MAX_CHARS = 100_000;

/** @param {string} iso */
function realDay(iso) {
  if (!DATE.test(iso)) return '';
  const day = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === iso ? iso : '';
}

/**
 * One Status Log line as a history entry, or null when it is blank, an escalation, or only
 * a tag.
 * @param {string} raw
 * @returns {{ on: string, text: string } | null}
 */
export function statusLogLine(raw) {
  let text = String(raw ?? '').trim();
  if (!text) return null;
  if (/\[esc:/i.test(text)) return null;
  let on = '';
  const iso = LEAD_ISO.exec(text);
  const us = iso ? null : LEAD_US.exec(text);
  if (iso) {
    on = realDay(iso[1]);
    text = text.slice(iso[0].length);
  } else if (us) {
    on = realDay(`${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`);
    text = text.slice(us[0].length);
  }
  text = text.replace(TAG, '').replace(/\s+/g, ' ').trim();
  if (!text || ESCALATION.test(text)) return null;
  return { on, text };
}

/**
 * A case's Status Log text as history entries, oldest first, at most HISTORY_MAX (the newest).
 * Anything that is not text reads as no history.
 * @param {unknown} log
 * @returns {{ on: string, text: string }[]}
 */
export function statusLogHistory(log) {
  if (typeof log !== 'string' || !log.trim()) return [];
  /** @type {{ on: string, text: string }[]} */
  const out = [];
  for (const raw of log.slice(-LOG_MAX_CHARS).split(/\r?\n/)) {
    const entry = statusLogLine(raw);
    if (entry) out.push(entry);
  }
  return out.slice(-HISTORY_MAX);
}

/**
 * The history of a referral from all its lines' Status Logs, oldest first, newest
 * HISTORY_MAX kept. Each entry carries its line's `company` (and `solutions`). Lines with no date stay where their log put them, before dated ones
 * from other cases. The sort is stable, so one day's lines keep their log order.
 * @param {unknown[]} lines
 */
export function referralHistory(lines) {
  /** @type {{ on: string, text: string, company?: string, solutions?: string, i: number }[]} */
  const all = [];
  for (const line of lines) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) continue;
    const l = /** @type {Record<string, unknown>} */ (line);
    // Each entry keeps its own case's partner, so one partner's step is never read as
    // another's on a referral with two cases (Codex P1 on PR 52).
    /** @type {{ company?: string, solutions?: string }} */
    const source = {};
    if (typeof l.company === 'string' && l.company.trim()) source.company = l.company.trim();
    if (typeof l.solutions === 'string' && l.solutions.trim()) source.solutions = l.solutions.trim();
    for (const h of statusLogHistory(l.statusLog)) all.push({ ...h, ...source, i: all.length });
  }
  all.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : a.i - b.i));
  return all.slice(-HISTORY_MAX).map(({ i, ...h }) => h);
}
