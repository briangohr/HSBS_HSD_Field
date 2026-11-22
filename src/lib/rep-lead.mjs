// Track's compact rows and the lead screen for the HealthFirst rep app (Brian, 11/9;
// spec v3 section 2 "Track My Referrals", tests 17 and 18). Server only: the browser
// gets ready strings and draws them with textContent.
//
// Everything here comes from the 1F list answer the page already gets (the HealthFirst
// line's status, detail and updatedOn, the `closed` and `signed` flags, and the Status
// Log in `history`). No new flow field, no new action. The words follow the spec's map:
//
//   Sent, no partner status yet, or no line          Sent to HealthFirst
//   Not yet, still trying; Trying to reach            HealthFirst is reaching out
//   Not yet, haven't tried; Not called yet            Sent to HealthFirst (no try yet)
//   Yes; Talked with the doctor; Reached; Meeting held HealthFirst talked with the doctor
//   Meeting set                                       Meeting set (a timeline step with
//                                                     the date: "Meeting set for Nov 12")
//   Proposal or agreement sent                        HealthFirst sent a proposal
//   No change this week                               HealthFirst is working on it
//   Signed or Won, or `signed` true                   Signed and billed
//   Not moving forward, Already a customer, Hand
//   back to HSBS, Closed, Not a Fit, or `closed`      Closed: [reason], or Closed
//   Anything else                                     its existing display words
//
// Signed reads "Signed and billed": HealthFirst bills an office as soon as it signs.
// "HealthFirst" above is the line's company, so the words stay true for any partner.
//
// 7B writes each Status Log line as "<partner>: <label>. <note>" (the partner
// update page). Only the label is a status: the first sentence, and a later sentence only
// when it is whole one of the label shapes the partner update page
// writes. The partner's note is never read as a status, so "Signed up for a demo"
// never shows as "Signed and billed".
//
// A manager's view (`team: true`, My Team) leaves out the contact name and the partner's
// free-text update, and its timeline holds only the mapped step words and dates: a
// Status Log line the map doesn't know is dropped there, since it can name the doctor.

import { decorateReferrals, isNotQualifiedClose, officeName, sanitizeReferral, shortDate, todayInNewYork } from './track.mjs';
import { displayStatus, displayStatusText, isSignedStatus } from './partner-status-words.mjs';
import { companyName, keyForSolutions } from './rep-companies.mjs';

export const SIGNED_WORDS = 'Signed and billed';
const DEFAULT_COMPANY = 'HealthFirst';
// Field two-track spec section 5: the staffing row has its own words. It is known by its
// screen name, so a line whose company is not in the company table keeps main's words.
const STAFFING_NAME = companyName('Staffing');
const isStaffing = (/** @type {string} */ co) => co === STAFFING_NAME;
/** "Signed and billed" is HealthFirst's, who bills an office as soon as it signs. */
const signedWords = (/** @type {string} */ co) => (isStaffing(co) ? 'Signed' : SIGNED_WORDS);
const NO_PERMISSION = 'No permission to contact';
const NEW_KEYS = /** @type {const} */ (['solutions', 'practiceType', 'qualified', 'notQualifiedReason', 'closedReason']);

/** "<partner>: " in front of a Status Log line ("Unitas: Talked with the doctor"). */
const PREFIX = /^[^:.]{1,80}:\s*/;

/**
 * The label shapes that can follow the first sentence of a Status Log line (the partner
 * page's second question, on the partner update page). A later sentence counts as a
 * status only when it matches one of these whole.
 */
const LATER_LABEL = [
  /^talked with the doctor on [a-z]{3} \d{1,2}, \d{4}$/i,
  /^meeting set for [a-z]{3} \d{1,2}, \d{4}$/i,
  /^proposal or agreement sent$/i,
  /^signed on [a-z]{3} \d{1,2}, \d{4}(?:: .*)?$/i,
  /^not moving forward$/i,
  /^hand back to hsbs$/i,
];

/** Staffing's partner page asks "Talked with the customer?"; only a staffing row reads that. */
const STAFFING_TALKED = /^talked with the customer on [a-z]{3} \d{1,2}, \d{4}$/i;

/** @param {unknown} raw */
const clean = (raw) => (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '') : '');

/**
 * The sentences of one Status Log line that carry its status, read the way the partner
 * page writes it (partner-flow.ts plainLabel): the first answer (with any "<partner>: " in
 * front, and its "Last try ..." sentence when it is "Not yet, still trying"), then at most
 * one more sentence, the second answer, when it is whole a label shape. Reading stops
 * there: a reason or note after the second answer is the partner's own words, even when
 * it looks like a label ("Not moving forward. Signed on Nov 14, 2026: another vendor.").
 * @param {unknown} text
 * @param {boolean} [staffing] the row is a staffing row
 * @returns {string[]}
 */
export function labelSentences(text, staffing = false) {
  const parts = String(text ?? '').split(/\.\s+/);
  const out = [parts[0]];
  let next = 1;
  if (next < parts.length && /^last try\b/i.test(clean(parts[next]))) next += 1;
  if (next < parts.length && (LATER_LABEL.some((re) => re.test(clean(parts[next]))) || (staffing && STAFFING_TALKED.test(clean(parts[next]))))) out.push(parts[next]);
  return out;
}

/**
 * One status value or one Status Log sentence, in the spec's words. '' when the map has
 * no entry for it.
 * @param {unknown} raw
 * @param {string} [company]
 */
export function stepWords(raw, company = DEFAULT_COMPANY) {
  const text = clean(raw);
  if (!text) return '';
  // "Signed on Nov 14, 2026: kit plan" reads as a whole; "HealthFirst: Signed" without
  // its partner name.
  return mapped(text, company) || mapped(text.replace(PREFIX, ''), company);
}

/** @param {string} t @param {string} co */
function mapped(t, co) {
  const x = t.toLowerCase();
  if (/^(signed|won|closed - won|close won)\b/.test(x)) return signedWords(co);
  if (/^(not moving forward|closed - lost|close loss)\b/.test(x)) return 'Closed: not moving forward';
  if (/^already a customer\b/.test(x)) return 'Closed: already a customer';
  if (/^(hand back to hsbs|handed back to hsbs|returned to hsbs|held)$/.test(x)) return 'Closed: handed back to HSBS';
  if (/^not a fit$/.test(x)) return 'Closed: not a fit';
  // The partner page's qualify choices (11/20/2026): "Qualified", "Disqualified, ...",
  // "Demo set".
  if (/^disqualified\b/.test(x)) return 'Closed: did not qualify';
  if (/^qualified\b/.test(x)) return `${co} qualified the lead`;
  if (/^demo set\b/.test(x)) return 'Meeting set';
  if (x === 'closed') return 'Closed';
  if (/^(sent|received)\b/.test(x)) return `Sent to ${co}`;
  // "Not yet, haven't tried" (the stored answer) and "Not called yet" (the label the
  // partner page writes since 11/13) say no one has tried yet, so they never read as
  // reaching out.
  if (/^(not yet, haven['’]t tried|not called yet)\b/.test(x)) return `Sent to ${co}`;
  if (/^(not yet\b|trying to reach\b)/.test(x)) return `${co} is reaching out`;
  if (x === 'yes' || /^(talked with the doctor|reached|reached the doctor|meeting held|complete)\b/.test(x) || (isStaffing(co) && /^talked with the customer\b/.test(x))) {
    return `${co} talked with the ${isStaffing(co) ? 'customer' : 'doctor'}`;
  }
  const meeting = /^meeting set for ([a-z]{3}) (\d{1,2}), \d{4}$/.exec(x);
  if (meeting) return `Meeting set for ${meeting[1][0].toUpperCase()}${meeting[1].slice(1)} ${meeting[2]}`;
  if (/^(meeting set|scheduled)\b/.test(x)) return 'Meeting set';
  if (/^proposal\b/.test(x)) return `${co} sent a proposal`;
  if (/^no change this week\b/.test(x)) return `${co} is working on it`;
  // 7H logs a partner's email answer to its update ask as "<partner>: replied by email".
  if (/^replied by email$/.test(x)) return `${co} sent an update by email`;
  return '';
}

/**
 * The steps one Status Log line reports, in order. A line can report two ("Talked with
 * the doctor on Nov 14, 2026. Signed on Nov 14, 2026: kit plan.").
 * @param {string} text
 * @param {string} company
 * @param {string} [closeWords] the not-qualified words that replace the ordinary close
 */
export function historySteps(text, company = DEFAULT_COMPANY, closeWords = '') {
  /** @type {string[]} */
  const out = [];
  for (const sentence of labelSentences(text, isStaffing(company))) {
    let w = stepWords(sentence, company);
    // A not-qualified save is logged as the ordinary "Not moving forward" close; the
    // stored qualification values say what it was (spec section 5).
    if (closeWords && w === 'Closed: not moving forward') w = closeWords;
    if (w && !out.includes(w)) out.push(w);
  }
  return out;
}

/**
 * The words for one Status Log line on the rep's own screens (the feed): the mapped
 * steps, or the line's existing display words when the map knows none of it.
 * @param {string} text
 * @param {string} company
 */
export function historyWords(text, company = DEFAULT_COMPANY, closeWords = '') {
  const steps = historySteps(text, company, closeWords);
  return steps.length ? steps.join('. ') : displayStatusText(text);
}

/** A step's words without a meeting date: "Meeting set for Nov 12" is "Meeting set". @param {string} label */
const baseStep = (label) => label.replace(/^(Meeting set) for [A-Z][a-z]{2} \d{1,2}$/, '$1');

/**
 * The company key of a line (rep-companies.mjs): from `solutions` when the list sends it,
 * else from `company` when that is the Solutions value, else HealthFirst by its own name.
 * '' for any other partner.
 * @param {{ company: string, solutions?: string } | null | undefined} line
 */
export function lineKey(line) {
  if (!line) return '';
  return keyForSolutions(line.solutions) || keyForSolutions(line.company) || (line.company === DEFAULT_COMPANY ? DEFAULT_COMPANY : '');
}

/**
 * The company name to show for a line: Direct Dental for staffing, never the Solutions
 * value. Any other line keeps the name it was sent with.
 * @param {{ company: string, solutions?: string } | null | undefined} line
 */
export function lineCompany(line) {
  if (!line) return DEFAULT_COMPANY;
  return companyName(lineKey(line)) || line.company || DEFAULT_COMPANY;
}

/**
 * The partner line Track speaks for: the HealthFirst line, or the first one.
 * @param {NonNullable<ReturnType<typeof sanitizeReferral>>} row
 */
export function mainLine(row) {
  return row.lines.find((l) => lineKey(l) === DEFAULT_COMPANY) ?? row.lines[0] ?? null;
}

/**
 * Closed because the partner marked the lead not qualified: Qualified No and Closed Reason
 * Not qualified, both stored (never from Qualified alone, so a close reason Brian set
 * later wins). Only the known reasons have words: No permission to contact gets its reason
 * in brackets, Other gets none, and any other value reads plain "Closed". The partner's
 * typed note is never read.
 * @param {{ qualified?: string, notQualifiedReason?: string, closedReason?: string }} line
 */
function notQualifiedWords(line) {
  if (!isNotQualifiedClose(line)) return '';
  if (line.notQualifiedReason === NO_PERMISSION) return 'Closed: did not qualify (no permission to contact)';
  if (line.notQualifiedReason === 'Other') return 'Closed: did not qualify';
  return 'Closed';
}

/** The Closed Reason choices 7B stores (partner-flow.ts CLOSED_REASONS) plus Already a customer. */
const KNOWN_CLOSED_REASONS = ['No response', 'Chose another provider', 'Price', 'Timing', 'Not a fit', 'Other', 'Already a customer'];

/**
 * The Closed Reason the list sent, as "Closed: [reason]". Only a value the site knows has
 * words; anything else, Not qualified without Qualified No included, is plain "Closed" and
 * the raw text is never shown. '' when none was sent.
 * @param {{ closedReason?: string }} line
 */
function closedReasonWords(line) {
  const reason = line.closedReason ?? '';
  if (!reason) return '';
  return KNOWN_CLOSED_REASONS.includes(reason) ? `Closed: ${reason.toLowerCase()}` : 'Closed';
}

/**
 * The words for how a referral closed, from its stored values: the not-qualified words,
 * else the Closed Reason's. '' when it sent neither, or the case signed (a signed case
 * stays signed). The chip, the timeline's saved close event and Latest updates all use it.
 * @param {NonNullable<ReturnType<typeof sanitizeReferral>>} row
 */
export function closeWordsFor(row) {
  const line = mainLine(row);
  if (!line || row.signed || row.lines.some((l) => isSignedStatus(l.status))) return '';
  return notQualifiedWords(line) || closedReasonWords(line);
}

/**
 * The partner one history entry speaks for: its own case's company when the entry names one
 * (status-log.mjs), else the referral's main partner. The not-qualified close words belong
 * to the main line, so an entry from another case never gets them.
 * @param {{ company?: string, solutions?: string }} h
 * @param {NonNullable<ReturnType<typeof sanitizeReferral>>} row
 * @param {string} main the main line's company
 */
export function entryCompany(h, row, main) {
  const company = h.company ? lineCompany({ company: h.company, solutions: h.solutions }) : main;
  return { company, closeWords: company === main ? closeWordsFor(row) : '' };
}

/** @param {string} company */
export const isStaffingCompany = (company) => isStaffing(company);

/**
 * The status chip: words and a tone ('open', 'signed' or 'closed').
 * @param {NonNullable<ReturnType<typeof sanitizeReferral>>} row
 * @param {string} bucket from decorateReferrals
 */
export function chipFor(row, bucket) {
  const line = mainLine(row);
  const company = lineCompany(line);
  if (bucket === 'signed') return { words: signedWords(company), tone: 'signed' };
  const close = closeWordsFor(row);
  if (close && ((line && isNotQualifiedClose(line)) || bucket === 'closed')) return { words: close, tone: 'closed' };
  const words = line ? stepWords(line.status, company) : '';
  if (words.startsWith('Closed')) return { words, tone: 'closed' };
  if (bucket === 'closed') return { words: 'Closed', tone: 'closed' };
  if (words === signedWords(company)) return { words, tone: 'signed' };
  // No line yet, or a case with no partner status yet: sent, to the line's company.
  if (!line || !line.status) return { words: `Sent to ${company}`, tone: 'open' };
  return { words: words || displayStatus(line.status) || line.status, tone: 'open' };
}

/**
 * "What happens next" on the rep's lead screen (Brian, 11/21): one plain line from where
 * the chip says the office stands. Only the chip's own words are read, so nothing new
 * comes from the list and the line can never disagree with the chip. It promises no time:
 * the partner's own pace is not on the list.
 * @param {{ words: string, tone: string }} chip
 * @param {string} company
 */
export function nextWords(chip, company) {
  if (chip.tone === 'signed') return 'Nothing more to do. The office signed.';
  if (chip.tone === 'closed') return 'Nothing more to do. This referral is closed.';
  const w = chip.words;
  if (w === `Sent to ${company}`) return `${company} reaches out to the office.`;
  if (w === `${company} is reaching out`) return `${company} keeps trying to reach the office.`;
  if (w === `${company} qualified the lead` || /^.+ talked with the (doctor|customer)$/.test(w)) return `${company} sets up a meeting with the office.`;
  if (/^Meeting set\b/.test(w)) return `${company} meets with the office, then sends a proposal.`;
  if (w === `${company} sent a proposal`) return 'The office decides on the proposal.';
  return `${company} sends its next update.`;
}

/**
 * @typedef {{ on: string, label: string }} Step
 * @typedef {{
 *   id: string, office: string, sentLabel: string, company: string, companyLine?: string, chip: string,
 *   tone: 'open' | 'signed' | 'closed', stale: string, steps: Step[],
 *   contact?: string, update?: { on: string, text: string }, lastUpdated?: string, next?: string
 * }} Lead
 */

/**
 * Every referral as a Track row and its lead screen, newest sent first (the order Track
 * has always used).
 * @param {unknown} list raw 1F list rows
 * @param {string} [today] YYYY-MM-DD, Eastern
 * @param {{ team?: boolean }} [opts] team: a manager's view (My Team)
 * @returns {Lead[]}
 */
export function leadViews(list, today = todayInNewYork(), opts = {}) {
  const team = opts.team === true;
  const raw = Array.isArray(list) ? list : [];
  /** @type {Map<string, NonNullable<ReturnType<typeof sanitizeReferral>>>} */
  const byId = new Map();
  for (const r of raw) {
    const clean = sanitizeReferral(r);
    if (clean && !byId.has(clean.id)) byId.set(clean.id, clean);
  }
  /** @type {Lead[]} */
  const out = [];
  for (const d of decorateReferrals(raw, today).referrals) {
    const row = byId.get(d.id);
    if (!row) continue;
    const line = mainLine(row);
    const company = lineCompany(line);
    const chip = chipFor(row, d.bucket);

    /** @type {Step[]} */
    const steps = [{ on: row.sentOn ? shortDate(row.sentOn) : '', label: `Sent to ${company}` }];
    const history = [...row.history].sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
    for (const h of history) {
      const { company: hc, closeWords } = entryCompany(h, row, company);
      let words = historySteps(h.text, hc, closeWords);
      if (words.length === 0 && !team) words = [displayStatusText(h.text).replace(/[.\s]+$/, '')];
      for (const w of words) if (w) steps.push({ on: h.on ? shortDate(h.on) : '', label: w });
    }
    // The timeline always ends where the chip says the office stands. "Meeting set for
    // Nov 12" already says "Meeting set".
    if (baseStep(steps[steps.length - 1].label) !== chip.words) {
      steps.push({ on: line?.updatedOn ? shortDate(line.updatedOn) : '', label: chip.words });
    }
    // One line per step: a step saved again (another "No change this week") keeps its first date.
    const timeline = steps.filter((s, i) => i === 0 || s.label !== steps[i - 1].label);

    /** @type {Lead} */
    const lead = {
      id: row.id,
      office: team ? row.practiceName || 'Office' : officeName(row),
      sentLabel: d.sentLabel,
      company,
      chip: chip.words,
      tone: /** @type {Lead['tone']} */ (chip.tone),
      // The existing 7-day flag, for an office that is still open.
      stale: chip.tone === 'open' && d.staleText ? `${d.staleText}.` : '',
      steps: timeline,
    };
    // The company line under the practice name (spec section 5, board 4). A row that came
    // with none of the new values and is not staffing reads exactly as it does on main.
    if (line && (lineKey(line) === 'Staffing' || NEW_KEYS.some((k) => typeof line[k] === 'string'))) {
      const type = lineKey(line) === 'Staffing' && (line.practiceType === 'Private practice' || line.practiceType === 'Group') ? `, ${line.practiceType}` : '';
      lead.companyLine = `${company}${type}`;
    }
    if (!team) {
      if (row.practiceName && row.doctorName) lead.contact = row.doctorName;
      const detail = line ? displayStatusText(line.detail).trim() : '';
      if (detail) lead.update = { on: line?.updatedOn ? shortDate(line.updatedOn) : '', text: detail };
      // "Last updated" (Brian, 11/21): the partner's last update (1F `updated`, from Last
      // Partner Update), else the date it was sent, as the contract's fallback says.
      const lastOn = line?.updatedOn || row.sentOn;
      if (lastOn) lead.lastUpdated = `Last updated ${shortDate(lastOn)}.`;
      lead.next = `What happens next: ${nextWords(chip, company)}`;
    }
    out.push(lead);
  }
  return out;
}
