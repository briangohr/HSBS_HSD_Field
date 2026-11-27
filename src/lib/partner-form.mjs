// Shared rules for the partner update page, /update/<key> (sheet PU, piece A). Plain JS so
// the page script, the save route and node --test all use the same checks. It holds no
// key, no flow URL and no lead data. Contract: docs/field-flow-contract.md, "HSBS 7F".

import { oneLine } from './one-line.mjs';
import { PARK_CHOICES, PARK_CODES, RETIRED_CHOICE_CODES, STAND_CHOICES, displayStatus } from './partner-status-words.mjs';

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
  parked: '',
  unpark: '',
};

/** The disqualified codes (the page offers only dq_noanswer). Each closes the lead and emails Brian. */
export const DISQUALIFIED = ['dq_noanswer', 'dq_notinterested'];

/** "Not moving forward" reasons. No answer is its own choice now (Disqualified). */
export const CLOSED_REASONS = ['Chose another provider', 'Price', 'Timing', 'Not a fit', 'Other'];

export const CHOICE_CODES = [...STAND_CHOICES.map((c) => c.code), ...RETIRED_CHOICE_CODES];

/**
 * A page loaded before 11/20/2026 still asks "Have you talked to the doctor?" and sends its
 * answer, and may send `handback` or the reason "No response". The save keeps taking those,
 * with the old rules, so an open tab or a retry of a partly written save still reaches 7F
 * (Codex P1 on #20). The new page never sends talkedToDoctor, so it gets the new rules.
 */
export const LEGACY_CHOICE_CODES = ['meeting', 'proposal', 'signed', 'lost', 'handback', 'nochange'];
export const LEGACY_CLOSED_REASONS = ['No response', ...CLOSED_REASONS];
export const MAX_UPDATES = 50;
export const NOTE_MAX = 300;
export const PRODUCT_MAX = 100;

/** The fields a save sends for each lead, in contract order. */
export const UPDATE_FIELDS = ['talkedToDoctor', 'meetingDate', 'signedDate', 'signedProduct', 'closedReason', 'note', 'offices'];

/**
 * The choices that make a lead qualified (7F sets Qualified Yes). On the save that first
 * qualifies a Direct Dental lead the rep marked Group, the page asks the office count.
 */
export const QUALIFYING_CHOICES = ['qualified', 'meeting', 'proposal', 'signed'];

/** The office count answers: yes, 3 or more locations; no, fewer. */
export const OFFICE_ANSWERS = ['yes', 'no'];

/**
 * Year 1 deal value (Brian, 11/25/2026): an optional whole-dollar guess on the stages where a
 * deal is moving. Behind PARTNER_DEAL_VALUE_ENABLED. Blank means "leave the stored value as
 * it is", never "clear it".
 */
export const DEAL_VALUE_CHOICES = ['meeting', 'proposal', 'signed'];
export const DEAL_VALUE_MAX = 9_999_999;
/** Room for "$9,999,999" as typed; the page strips $, commas and spaces before the check. */
export const DEAL_VALUE_INPUT_MAX = 12;
export const DEAL_VALUE_LABEL = 'Year 1 deal value in dollars, your best guess (optional)';

/**
 * What a partner typed, as the digits the check reads: "$25,000" is "25000". Anything else
 * stays as typed, so the check refuses it.
 * @param {string} typed
 */
export const dealValueDigits = (typed) => (typeof typed === 'string' ? typed.replace(/[$,\s]/g, '') : '');

/**
 * A deal value as 7F stores and sends it: whole dollars from 0 to 9,999,999 written as plain
 * digits ("25000", no leading zeros), or null.
 * @param {unknown} value
 */
export function dealValueOf(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 && value <= DEAL_VALUE_MAX ? String(value) : null;
  if (typeof value !== 'string' || !/^\d{1,12}$/.test(value)) return null;
  const n = Number(value);
  return n <= DEAL_VALUE_MAX ? String(n) : null;
}

/**
 * Parked (PARTNER_PARKED_ENABLED, Brian 11/26/2026, LTI-SHARED-001 r8 "Parked rules"). A park
 * needs a reason and the name of who parked it; a save missing either is refused and names
 * what is missing, even when the date is missing too (E21). With both and no revisit date,
 * 7F saves the lead as Closed Lost, reason "Parked without a revisit date" (E22). A revisit
 * date must be after today. The partner link is shared per company, so who is typed.
 */
export const PARK_REASON_MAX = 300;
export const PARKED_BY_MAX = 100;
export const PARK_FIELDS = ['parkDate', 'parkReason', 'parkedBy'];
/** The Closed Reason 7F writes on a park with no revisit date. */
export const PARK_NO_DATE_REASON = 'Parked without a revisit date';
/** What the saver sees after a park with no revisit date (E22). */
export const PARK_NO_DATE_WORDS = 'Saved as Closed Lost, no revisit date.';
export const PARK_DATE_HINT = 'Leave it blank only to close the lead: a park with no revisit date saves as Closed lost.';

/**
 * How many updates in a checked save are parks with no revisit date, which 7F closes.
 * @param {Record<string, unknown>[]} updates
 */
export const parkNoDateCount = (updates) => updates.filter((u) => u.choice === 'parked' && u.parkDate === '').length;

/**
 * The status words after a reload. A park with no revisit date adds PARK_NO_DATE_WORDS, but
 * only on a full save: a partial one cannot tell which lead went through.
 * @param {string} words the save result words
 * @param {number} saved @param {number} sent @param {number} noDate parkNoDateCount of the save
 */
export function withParkWords(words, saved, sent, noDate) {
  if (!words || !Number.isSafeInteger(noDate) || noDate < 1 || noDate > sent || saved !== sent) return words;
  return `${words} ${noDate === 1 ? PARK_NO_DATE_WORDS : `${noDate} leads: ${PARK_NO_DATE_WORDS}`}`;
}

/** What the page names when a field is missing or wrong. */
export const FIELD_WORDS = {
  choice: 'Where does it stand?',
  talkedToDoctor: 'Have you talked to the doctor?',
  meetingDate: 'Demo date',
  signedDate: 'Signed date',
  signedProduct: 'Product',
  closedReason: 'Reason',
  note: 'Note',
  offices: 'Office count',
  dealValue: 'Year 1 deal value',
  parkDate: 'Revisit date',
  parkReason: 'Reason for setting it aside',
  parkedBy: 'Your name',
  parkReasonBy: 'Reason for setting it aside and Your name',
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

/**
 * The sticky Save button's words: how many leads have a complete answer right now. Each lead
 * counts once, however often its answer changes. 0 is the plain "Save".
 * @param {number} n
 */
export const saveLabel = (n) => (Number.isSafeInteger(n) && n > 0 ? `Save ${n} ${n === 1 ? 'update' : 'updates'}` : 'Save');

/**
 * What a collapsed lead card shows: the answer it will save.
 * @param {string} choice a choice code, or 'nochange'
 */
export function pickedWords(choice) {
  const c = [...STAND_CHOICES, ...PARK_CHOICES].find((x) => x.code === choice);
  return c ? `Selected: ${c.label}` : '';
}

/**
 * Words for a save that 7F answered with 200 {"ok":true,"saved":n}, given how many updates
 * were sent. 7F skips a lead that closed or moved between its check and its write, so
 * `saved` can be below `sent`; the page must say so (Codex FT-3). `saved` above `sent`, or
 * either count not a whole number in range, is not a save answer: null.
 * @param {number} saved
 * @param {number} sent
 * @returns {string | null}
 */
export function saveResultWords(saved, sent) {
  if (!Number.isSafeInteger(saved) || !Number.isSafeInteger(sent)) return null;
  if (sent < 1 || sent > MAX_UPDATES || saved < 0 || saved > sent) return null;
  if (saved === sent) return savedWords(saved);
  const missed = sent - saved;
  if (saved === 0) {
    return sent === 1
      ? 'Nothing saved. This lead closed or changed while you worked. The list below is current.'
      : `Nothing saved. These ${sent} leads closed or changed while you worked. The list below is current.`;
  }
  return `Saved ${saved} of ${sent} updates. ${missed === 1 ? '1 lead' : `${missed} leads`} closed or changed while you worked and did not save. The list below is current.`;
}
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

/** The day after a yyyy-MM-dd date, or "" when it is not one. The earliest revisit date. */
export function nextDay(value) {
  if (!isDate(value)) return '';
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
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
 * `offices` is kept only on a qualifying choice and must be yes, no or blank. The page also
 * passes `askOffices` (never sent): then a qualifying choice needs an answer. The route
 * cannot tell which leads ask, so it takes a blank one; 7F writes it only on a Group lead.
 *
 * `dealValue` is read only with `opts.dealValue` (PARTNER_DEAL_VALUE_ENABLED). Off, it is
 * ignored and the update has no dealValue key, exactly as before. On, the update always has
 * one: digits on a deal choice (meeting, proposal, signed), blank on the rest. Blank keeps
 * the stored value.
 *
 * `parkDate`, `parkReason` and `parkedBy` are read only with `opts.parked`
 * (PARTNER_PARKED_ENABLED), which also lets `parked` and `unpark` through. Off, both codes are
 * a bad choice and the update has none of the three keys. On, it always has all three, blank
 * unless the choice is `parked`. Reason and who are checked before the date (E21); a blank
 * date is allowed and 7F closes the lead (E22). The day rule (after today) needs `today`.
 * @param {unknown} raw
 * @param {string | null} today yyyy-MM-dd, Eastern, or null to skip the day rules
 * @param {{ dealValue?: boolean, parked?: boolean }} [opts]
 * @returns {{ ok: true, update: Record<string, unknown> } | { ok: false, id: number | null, field: string }}
 */
export function checkUpdate(raw, today, opts = {}) {
  const u = raw && typeof raw === 'object' && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : {};
  const id = isLeadId(u.id) ? /** @type {number} */ (u.id) : null;
  if (id === null) return { ok: false, id: null, field: 'id' };
  const bad = (field) => ({ ok: false, id, field });
  const choice = text(u.choice);
  const sentTalked = text(u.talkedToDoctor);
  const legacy = sentTalked !== '';
  const codes = legacy ? LEGACY_CHOICE_CODES : opts.parked === true ? [...CHOICE_CODES, ...PARK_CODES] : CHOICE_CODES;
  if (!codes.includes(choice)) return bad('choice');
  if (legacy && !TALKED_CHOICES.includes(sentTalked)) return bad('talkedToDoctor');
  const talked = legacy ? sentTalked : (TALKED_FOR[choice] ?? '');
  const rawNote = text(u.note);
  const note = oneLine(rawNote, NOTE_MAX + 1);
  if (note.length > NOTE_MAX) return bad('note');
  if (choice === 'handback' && !note) return bad('note');
  const offices = u.offices === undefined || u.offices === null ? '' : u.offices;
  if (offices !== '' && !OFFICE_ANSWERS.includes(/** @type {string} */ (offices))) return bad('offices');
  const qualifying = QUALIFYING_CHOICES.includes(choice);
  if (qualifying && u.askOffices === true && today !== null && offices === '') return bad('offices');
  const update = {
    id,
    choice,
    talkedToDoctor: talked,
    meetingDate: '',
    signedDate: '',
    signedProduct: '',
    closedReason: '',
    note,
    offices: qualifying ? /** @type {string} */ (offices) : '',
  };
  if (opts.dealValue === true) {
    const sent = u.dealValue === undefined || u.dealValue === null ? '' : u.dealValue;
    let deal = '';
    if (DEAL_VALUE_CHOICES.includes(choice) && sent !== '') {
      const digits = dealValueOf(sent);
      if (digits === null) return bad('dealValue');
      deal = digits;
    }
    update.dealValue = deal;
  }
  if (opts.parked === true) {
    update.parkDate = '';
    update.parkReason = '';
    update.parkedBy = '';
  }
  if (choice === 'parked') {
    const reason = oneLine(text(u.parkReason), PARK_REASON_MAX + 1);
    const by = oneLine(text(u.parkedBy), PARKED_BY_MAX + 1);
    if (!reason && !by) return bad('parkReasonBy');
    if (!reason || reason.length > PARK_REASON_MAX) return bad('parkReason');
    if (!by || by.length > PARKED_BY_MAX) return bad('parkedBy');
    const date = text(u.parkDate);
    if (date !== '' && (!isDate(date) || (today !== null && date <= today))) return bad('parkDate');
    update.parkDate = date;
    update.parkReason = reason;
    update.parkedBy = by;
  }
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
    if (!(legacy ? LEGACY_CLOSED_REASONS : CLOSED_REASONS).includes(reason)) return bad('closedReason');
    update.closedReason = reason;
  }
  return { ok: true, update };
}

/**
 * Check a whole save: 1 to 50 updates, each lead once.
 * @param {unknown} updates
 * @param {string | null} today as checkUpdate
 * @param {{ dealValue?: boolean, parked?: boolean }} [opts] as checkUpdate
 * @returns {{ ok: true, updates: Record<string, unknown>[] } | { ok: false, id: number | null, field: string }}
 */
export function checkUpdates(updates, today, opts = {}) {
  if (!Array.isArray(updates) || updates.length === 0) return { ok: false, id: null, field: 'none' };
  if (updates.length > MAX_UPDATES) return { ok: false, id: null, field: 'tooMany' };
  const seen = new Set();
  const clean = [];
  for (const raw of updates) {
    const result = checkUpdate(raw, today, opts);
    if (!result.ok) return result;
    const id = /** @type {number} */ (result.update.id);
    if (seen.has(id)) return { ok: false, id, field: 'id' };
    seen.add(id);
    clean.push(result.update);
  }
  return { ok: true, updates: clean };
}

/** Statuses where the case's Meeting Date still describes the lead. */
const MEETING_STATUSES = ['Meeting set', 'Meeting held'];

/**
 * The "Now:" words on a lead card. The case keeps its old Meeting Date after a later save
 * (7F leaves the column alone), so the date shows only while the lead stands at a meeting.
 * Brian, 11/21/2026: "Trying to reach, meeting Nov 24" made no sense.
 * A parked lead (7F's `parkedUntil`, PARTNER_PARKED_ENABLED) adds "Parked until <date>".
 * @param {string} status Partner Status as stored
 * @param {string} meetingDate YYYY-MM-DD or blank
 * @param {string} [parkedUntil] YYYY-MM-DD while parked, else blank
 */
export function nowLine(status, meetingDate, parkedUntil = '') {
  const shown = stageWords(status);
  const until = showDate(parkedUntil);
  const park = until ? `Parked until ${until}` : '';
  if (!shown) return park ? `No update yet. ${park}` : 'No update yet';
  const date = MEETING_STATUSES.includes(shown) ? showDate(meetingDate) : '';
  const line = date ? `${shown}, meeting ${date}` : shown;
  return park ? `${line}. ${park}` : line;
}

/** The stage in the page's words: 7F stores Reached and Trying to reach. @param {string} status */
function stageWords(status) {
  const raw = typeof status === 'string' ? status.trim() : '';
  if (raw === 'Reached') return 'Reached the customer';
  if (raw === 'Trying to reach') return 'Not reached yet';
  return displayStatus(status);
}

/**
 * The hint under "No change this week". 7F leaves Partner Status as it is and counts the
 * save as this week's update, so the hint names the stage the lead keeps.
 * A parked lead stays parked (E24): the hint says so.
 * @param {string} status Partner Status as stored
 * @param {string} [parkedUntil] YYYY-MM-DD while parked, else blank
 */
export function noChangeHint(status, parkedUntil = '') {
  const shown = stageWords(status);
  const until = showDate(parkedUntil);
  if (until) return `Keeps it parked until ${until}${shown ? `, at ${shown}` : ''}. Counts as this week's update.`;
  return shown ? `Keeps it at ${shown}. Counts as this week's update.` : "Counts as this week's update.";
}

/**
 * The "Next update" line on a lead card. A lead with missed updates is overdue; 7G has
 * already moved its due date on.
 * @param {number} missed Missed Updates
 * @param {string} due Next Update Due, YYYY-MM-DD or blank
 */
export function dueLine(missed, due) {
  const date = showDate(due);
  if (missed > 0) return date ? `Overdue. Now due ${date}` : 'Overdue';
  return date ? `Due ${date}` : 'Not set yet';
}
