// One list of partner status words. The partner page stores these. Track My
// Referrals shows these. Older values are still accepted and shown in the
// plain words the old page used. Complete still reads "Meeting held".

/** Stored values for "Where does it stand?" */
export const STAND_WORDS = [
  'Meeting set',
  'Proposal or agreement sent',
  'Signed',
  'Not moving forward',
  'Hand back to HSBS',
  'No change this week',
];

/**
 * One line under the After qualified heading. A partner picks one stage, the furthest, so a
 * first update of Demo set alone records Qualified Yes too (Brian, 11/23/2026: picking Demo
 * set looked like it dropped qualified). Said once, not under each stage (Release A).
 */
export const QUALIFIES_LINE = 'Demo set, Proposal, and Signed count as reached and qualified.';

/**
 * "Where does it stand?" on the partner page, one list (Brian, 11/20/2026, after the
 * HealthFirst process call): qualify first, then the deal. Qualified means reached, knows
 * the partner will follow up, and wants a demo; up to 4 attempts, then disqualified. `group`
 * sets the heading the page shows. The words are placeholders until HealthFirst sends its
 * Salesforce picklist; 7F stores its own value per code (docs/field-flow-contract.md, 7F).
 */
export const STAND_CHOICES = [
  { code: 'qualified', label: 'Reached the customer', hint: 'Knows you will follow up and wants a demo', group: 'qualify' },
  { code: 'trying', label: 'Not reached yet', hint: 'Attempts 1 to 3 so far. A 4th Not reached yet closes the lead. Need help reaching them? Reply to the intro email.', group: 'qualify' },
  { code: 'dq_noanswer', label: 'Disqualified: no answer after 4 attempts', hint: '', group: 'qualify' },
  { code: 'meeting', label: 'Demo set', hint: '', group: 'deal' },
  { code: 'proposal', label: 'Proposal or agreement sent', hint: '', group: 'deal' },
  { code: 'signed', label: 'Signed (Closed won)', hint: '', group: 'deal' },
  { code: 'lost', label: 'Not moving forward (Closed lost)', hint: '', group: 'deal' },
  // Not a stage: a weekly check-in at any step (a demo set 2 weeks out has a week with no
  // change). The page shows it as its own tick box under the stage list.
  { code: 'nochange', label: 'No change this week', hint: '', group: 'checkin' },
];

/**
 * Codes the page no longer offers but the save still takes, so a tab opened before the
 * change still saves. "Disqualified, not interested" went 11/21/2026 (Brian: one
 * Disqualified only); a reached customer who says no is Not moving forward.
 */
export const RETIRED_CHOICE_CODES = ['dq_notinterested'];

/** The headings over each group of STAND_CHOICES, in page order. */
export const STAND_GROUPS = [
  { group: 'qualify', heading: 'Qualifying', note: '' },
  { group: 'deal', heading: 'After qualified', note: QUALIFIES_LINE },
];

/**
 * Stages that mean the lead is qualified: Reached the customer (stored as Reached) and every
 * step after it. 7F sets Qualified Yes for each of these.
 */
const QUALIFIED_SHOWN = ['Reached the doctor', 'Meeting set', 'Meeting held', 'Proposal or agreement sent', 'Signed', 'Won'];

/** @param {unknown} raw Partner Status as stored */
export function isQualifiedStatus(raw) {
  return QUALIFIED_SHOWN.includes(displayStatus(raw));
}

/**
 * The groups the page offers one lead. Once a lead is qualified the Qualifying group is
 * frozen (Brian, 11/21/2026): it shows Qualified as done and offers no choice, so the
 * partner moves on through the After qualified steps.
 * @param {unknown} status Partner Status as stored
 */
export function choiceGroupsFor(status) {
  const frozen = isQualifiedStatus(status);
  return STAND_GROUPS.map((g) => {
    const done = frozen && g.group === 'qualify';
    return { ...g, done: done ? 'Reached the customer' : '', choices: done ? [] : STAND_CHOICES.filter((c) => c.group === g.group) };
  });
}

/**
 * Old stored values, and the words to show. Keys are exact strings a flow
 * might still send. "Handed back to HSBS" is not a stored value anymore.
 */
const OLD_DISPLAY = {
  Complete: 'Meeting held',
  'Meeting held': 'Meeting held',
  Scheduled: 'Meeting set',
  Reached: 'Reached the doctor',
  'Reached the doctor': 'Reached the doctor',
  'Trying to reach': 'Trying to reach',
  Won: 'Won',
  'Close won': 'Won',
  'Closed - Won': 'Won',
  'Close loss': 'Not moving forward',
  'Closed - Lost': 'Not moving forward',
  // Old Partner Status. The button said "Return to HSBS". The column stored this.
  'Returned to HSBS': 'Hand back to HSBS',
  Held: 'Hand back to HSBS',
  'Handed back to HSBS': 'Hand back to HSBS',
  Closed: 'Closed',
  'Not a Fit': 'Not a Fit',
  Sent: 'Sent',
};

const HAND = 'Hand back to HSBS';
const OLD_HAND_PHRASES = ['Handed back to HSBS', 'Returned to HSBS'];

/** @param {unknown} raw */
export function displayStatus(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return '';
  if (STAND_WORDS.includes(text)) return text;
  return OLD_DISPLAY[text] ?? replaceHandPhrases(text);
}

function replaceHandPhrases(text) {
  return OLD_HAND_PHRASES.reduce((line, phrase) => line.replaceAll(phrase, HAND), text);
}

/** Swap a retired hand-back phrase inside a sentence. A bare old status becomes its label. */
export function displayStatusText(raw) {
  const text = typeof raw === 'string' ? raw : '';
  const swapped = replaceHandPhrases(text);
  const shown = displayStatus(swapped.trim());
  if (shown && shown !== swapped.trim()) return shown;
  return swapped;
}

/** @param {unknown} raw */
export function isSignedStatus(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  return text === 'Signed' || text === 'Won' || text === 'Closed - Won' || text === 'Close won';
}

/** @param {unknown} raw */
export function isClosedStatus(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return false;
  const shown = displayStatus(text);
  return (
    shown === 'Not moving forward' ||
    isHandedBackStatus(text) ||
    shown === 'Closed' ||
    shown === 'Not a Fit' ||
    text === 'Closed' ||
    text === 'Not a Fit'
  );
}

/** Handed back: the new stored words, or the old stored Partner Status. */
export function isHandedBackStatus(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  return text === 'Hand back to HSBS' || text === 'Returned to HSBS' || text === 'Handed back to HSBS' || text === 'Held';
}
