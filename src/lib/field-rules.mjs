// One copy of the Field rules that 7F, 7G, 7H, 10 and 10D each type into their own flow
// today (lean rebuild, unit U0). Nothing imports this yet. The flows still hold their own
// copies until each moves to code, so `scripts/check-flow-constants.mjs` compares a flow
// export with this file. Words and dates live here. Addresses and switches do not.
//
// Dates are `yyyy-MM-dd` strings. Day math runs at noon UTC so a daylight saving change
// never moves a date. Day of week follows Power Automate: 0 is Sunday, 5 is Friday.

/** Days with no asks and no due dates. Same list as 7F, 7G and 7H `Holidays` (11/26/2026). */
export const HOLIDAYS = Object.freeze([
  '2026-11-26',
  '2026-11-27',
  '2026-12-24',
  '2026-12-25',
  '2027-01-01',
  '2027-01-18',
]);

/** Business days between an ask and the next one for a lead still in qualification. */
export const WINDOW_DAYS = 2;

/** Partner Status words that close a lead. Same list as 7F `Closed_words`. */
export const CLOSED_WORDS = Object.freeze([
  'Signed',
  'Not moving forward',
  'Hand back to HSBS',
  'Close won',
  'Close loss',
  'Returned to HSBS',
]);

/** Days of holiday list left under which the exceptions job tells Brian to extend it. */
export const HOLIDAY_RUNWAY_WARN_DAYS = 30;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
/** The furthest `addBusinessDays` looks. A real window is a few days. */
const SEARCH_LIMIT_DAYS = 60;

/** @param {string} day */
function parse(day) {
  if (typeof day !== 'string' || !DAY.test(day)) throw new RangeError(`not a yyyy-MM-dd date: ${String(day)}`);
  const at = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== day) {
    throw new RangeError(`not a real date: ${day}`);
  }
  return at;
}

/** @param {string} day @param {number} n whole days, may be negative */
export function addDays(day, n) {
  return new Date(parse(day).getTime() + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 0 is Sunday, 6 is Saturday, like Power Automate `dayOfWeek`. @param {string} day */
export function dayOfWeek(day) {
  return parse(day).getUTCDay();
}

/**
 * Today in Eastern time, like `Today_ET`.
 * @param {Date} [now]
 */
export function etDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * @param {string} day
 * @param {readonly string[]} [holidays]
 */
export function isBusinessDay(day, holidays = HOLIDAYS) {
  const dow = dayOfWeek(day);
  return dow !== 0 && dow !== 6 && !holidays.includes(day);
}

/**
 * The n-th business day after `day`. `day` itself never counts, so Friday plus 1 is Monday.
 * @param {string} day
 * @param {number} n 1 or more
 * @param {readonly string[]} [holidays]
 */
export function addBusinessDays(day, n, holidays = HOLIDAYS) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('n must be a whole number of 1 or more');
  let found = 0;
  for (let step = 1; step <= SEARCH_LIMIT_DAYS; step += 1) {
    const next = addDays(day, step);
    if (isBusinessDay(next, holidays)) {
      found += 1;
      if (found === n) return next;
    }
  }
  throw new RangeError('no business day in range, extend HOLIDAYS or check the date');
}

/**
 * The first Friday after `today`, never today. A Friday on the holiday list moves to the
 * next business day after it (7F `Friday_due`).
 * @param {string} today
 * @param {readonly string[]} [holidays]
 */
export function comingFriday(today, holidays = HOLIDAYS) {
  let friday = addDays(today, 1);
  while (dayOfWeek(friday) !== 5) friday = addDays(friday, 1);
  return holidays.includes(friday) ? addBusinessDays(friday, 1, holidays) : friday;
}

/** @param {unknown} status a Partner Status word */
export function isClosed(status) {
  return CLOSED_WORDS.includes(String(status ?? ''));
}

const CLOSING_CHOICES = ['signed', 'lost', 'handback', 'dq_noanswer', 'dq_notinterested'];
const FRIDAY_CHOICES = ['qualified', 'proposal'];
const CHOICES = [...CLOSING_CHOICES, ...FRIDAY_CHOICES, 'trying', 'meeting', 'nochange'];

/**
 * The Next Update Due a partner save sets, same answer as 7F `W_due`.
 *   closing choices                          blank
 *   qualified, proposal, nochange on a
 *     qualified lead                         the coming Friday
 *   meeting                                  first business day after the demo date
 *                                            (today when no date), blank when none in 15 days
 *   trying, nochange on an unqualified lead  WINDOW_DAYS business days from today
 * @param {{ choice: string, qualified?: boolean, today: string, meetingDate?: string }} save
 * @param {readonly string[]} [holidays]
 * @returns {string} `yyyy-MM-dd`, or '' to clear the due date
 */
export function nextUpdateDue({ choice, qualified = false, today, meetingDate = '' }, holidays = HOLIDAYS) {
  if (!CHOICES.includes(choice)) throw new RangeError(`unknown choice: ${String(choice)}`);
  if (CLOSING_CHOICES.includes(choice)) return '';
  if (FRIDAY_CHOICES.includes(choice) || (choice === 'nochange' && qualified)) {
    return comingFriday(today, holidays);
  }
  if (choice === 'meeting') {
    const base = meetingDate || today;
    for (let step = 1; step <= 15; step += 1) {
      const next = addDays(base, step);
      if (isBusinessDay(next, holidays)) return next;
    }
    return '';
  }
  return addBusinessDays(today, WINDOW_DAYS, holidays);
}

/**
 * The Next Update Due an intro sets: WINDOW_DAYS business days, holidays skipped. 3F does
 * not skip holidays today (plus 2, plus 4 on Thu and Fri, plus 3 on Sat).
 * @param {string} today
 * @param {readonly string[]} [holidays]
 */
export function introDue(today, holidays = HOLIDAYS) {
  return addBusinessDays(today, WINDOW_DAYS, holidays);
}

/**
 * Days from `today` to the last listed holiday, negative when it has passed. The exceptions
 * job mails Brian when this is under HOLIDAY_RUNWAY_WARN_DAYS.
 * @param {string} today
 * @param {readonly string[]} [holidays]
 */
export function holidayRunwayDays(today, holidays = HOLIDAYS) {
  const last = [...holidays].sort().at(-1);
  if (!last) return 0;
  return Math.round((parse(last).getTime() - parse(today).getTime()) / MS_PER_DAY);
}
