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
 * "Where does it stand?" on the partner page, one list (Brian, 11/20/2026, after the
 * HealthFirst process call): qualify first, then the deal. Qualified means reached, knows
 * the partner will follow up, and wants a demo; up to 4 attempts, then disqualified. `group`
 * sets the heading the page shows. The words are placeholders until HealthFirst sends its
 * Salesforce picklist; 7F stores its own value per code (docs/field-flow-contract.md, 7F).
 */
export const STAND_CHOICES = [
  { code: 'qualified', label: 'Qualified', hint: 'Reached, knows you will follow up, and wants a demo', group: 'qualify' },
  { code: 'trying', label: 'Trying to reach', hint: 'Attempts 1 to 3 so far', group: 'qualify' },
  { code: 'dq_noanswer', label: 'Disqualified, no answer after 4 attempts', hint: '', group: 'qualify' },
  { code: 'dq_notinterested', label: 'Disqualified, not interested', hint: '', group: 'qualify' },
  { code: 'meeting', label: 'Demo set', hint: '', group: 'deal' },
  { code: 'proposal', label: 'Proposal or agreement sent', hint: '', group: 'deal' },
  { code: 'signed', label: 'Signed (Closed won)', hint: '', group: 'deal' },
  { code: 'lost', label: 'Not moving forward (Closed lost)', hint: '', group: 'deal' },
  { code: 'nochange', label: 'No change this week', hint: '', group: 'other' },
];

/** The headings over each group of STAND_CHOICES, in page order. */
export const STAND_GROUPS = [
  { group: 'qualify', heading: 'Qualifying' },
  { group: 'deal', heading: 'After qualified' },
  { group: 'other', heading: '' },
];

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
