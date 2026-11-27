// Lean rebuild, unit U0. These pin the Field rules to what 7F, 7G and 3F do today
// (S1b exports of 11/26/2026: 7F aeca13e5, 3F HealthFirst aec0c8b3).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CLOSED_WORDS,
  HOLIDAYS,
  WINDOW_DAYS,
  addBusinessDays,
  addDays,
  comingFriday,
  dayOfWeek,
  etDate,
  holidayRunwayDays,
  introDue,
  isBusinessDay,
  isClosed,
  nextUpdateDue,
} from './field-rules.mjs';

describe('constants', () => {
  test('match the arrays typed into 7F on 11/26/2026', () => {
    assert.deepEqual([...HOLIDAYS], ['2026-11-26', '2026-11-27', '2026-12-24', '2026-12-25', '2027-01-01', '2027-01-18']);
    assert.equal(WINDOW_DAYS, 2);
    assert.deepEqual([...CLOSED_WORDS], [
      'Signed',
      'Not moving forward',
      'Hand back to HSBS',
      'Close won',
      'Close loss',
      'Returned to HSBS',
    ]);
  });

  test('are frozen', () => {
    assert.throws(() => {
      'use strict';
      /** @type {string[]} */ (/** @type {unknown} */ (HOLIDAYS)).push('2027-02-01');
    }, TypeError);
  });
});

describe('dates', () => {
  test('etDate is the Eastern calendar day, in winter and summer time', () => {
    assert.equal(etDate(new Date('2026-11-27T04:11:53Z')), '2026-11-26'); // 11:11 PM EST
    assert.equal(etDate(new Date('2026-11-27T05:30:00Z')), '2026-11-27'); // 12:30 AM EST
    assert.equal(etDate(new Date('2026-07-01T03:30:00Z')), '2026-06-30'); // 11:30 PM EDT
  });

  test('addDays and dayOfWeek use Sunday as 0 and cross a daylight saving change', () => {
    assert.equal(dayOfWeek('2026-11-26'), 4); // Thanksgiving, a Thursday
    assert.equal(dayOfWeek('2026-11-29'), 0);
    assert.equal(addDays('2026-11-01', 1), '2026-11-02'); // the fall back day
    assert.equal(addDays('2026-03-08', 1), '2026-03-09'); // the spring forward day
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  });

  test('a bad or impossible date throws', () => {
    assert.throws(() => dayOfWeek('2026-02-30'), RangeError);
    assert.throws(() => dayOfWeek('11/26/2026'), RangeError);
    assert.throws(() => dayOfWeek(/** @type {any} */ (undefined)), RangeError);
  });
});

describe('business days', () => {
  test('weekends and listed holidays are not business days', () => {
    assert.equal(isBusinessDay('2026-11-25'), true);
    assert.equal(isBusinessDay('2026-11-26'), false);
    assert.equal(isBusinessDay('2026-11-28'), false);
    assert.equal(isBusinessDay('2026-11-29'), false);
    assert.equal(isBusinessDay('2026-11-30'), true);
  });

  test('addBusinessDays never counts the start day', () => {
    assert.equal(addBusinessDays('2026-12-03', 1), '2026-12-04'); // Thu to Fri
    assert.equal(addBusinessDays('2026-12-04', 1), '2026-12-07'); // Fri to Mon
    assert.equal(addBusinessDays('2026-12-05', 1), '2026-12-07'); // Sat to Mon
  });

  test('addBusinessDays skips holidays, including two in a row', () => {
    assert.equal(addBusinessDays('2026-11-25', 2), '2026-12-01');
    assert.equal(addBusinessDays('2026-12-23', 1), '2026-12-28');
  });

  test('addBusinessDays takes a custom holiday list', () => {
    assert.equal(addBusinessDays('2026-12-03', 1, ['2026-12-04']), '2026-12-07');
    assert.equal(addBusinessDays('2026-11-25', 1, []), '2026-11-26');
  });

  test('addBusinessDays refuses n under 1', () => {
    assert.throws(() => addBusinessDays('2026-12-03', 0), RangeError);
    assert.throws(() => addBusinessDays('2026-12-03', 1.5), RangeError);
  });
});

describe('comingFriday', () => {
  test('is the next Friday, never today', () => {
    assert.equal(comingFriday('2026-12-02'), '2026-12-04'); // Wed
    assert.equal(comingFriday('2026-12-04'), '2026-12-11'); // a Friday asks for the next one
    assert.equal(comingFriday('2026-12-05'), '2026-12-11'); // Sat
  });

  test('a Friday on the holiday list moves to the next business day after it', () => {
    assert.equal(comingFriday('2026-11-23'), '2026-11-30'); // 11/27 is listed
    assert.equal(comingFriday('2026-12-21'), '2026-12-28'); // 12/25 is listed
  });
});

describe('isClosed', () => {
  test('is exact, like the flow list', () => {
    for (const word of CLOSED_WORDS) assert.equal(isClosed(word), true);
    assert.equal(isClosed('Meeting set'), false);
    assert.equal(isClosed('signed'), false);
    assert.equal(isClosed(''), false);
    assert.equal(isClosed(null), false);
  });
});

describe('nextUpdateDue (7F W_due)', () => {
  const today = '2026-12-02'; // Wednesday

  test('closing choices clear the due date', () => {
    for (const choice of ['signed', 'lost', 'handback', 'dq_noanswer', 'dq_notinterested']) {
      assert.equal(nextUpdateDue({ choice, today }), '');
    }
  });

  test('qualified and proposal wait for Friday, whether or not the lead was qualified', () => {
    assert.equal(nextUpdateDue({ choice: 'qualified', today }), '2026-12-04');
    assert.equal(nextUpdateDue({ choice: 'proposal', today, qualified: true }), '2026-12-04');
  });

  test('nochange follows the lead: Friday when qualified, 2 business days when not', () => {
    assert.equal(nextUpdateDue({ choice: 'nochange', today, qualified: true }), '2026-12-04');
    assert.equal(nextUpdateDue({ choice: 'nochange', today, qualified: false }), '2026-12-04');
    assert.equal(nextUpdateDue({ choice: 'nochange', today: '2026-12-03', qualified: true }), '2026-12-04');
    assert.equal(nextUpdateDue({ choice: 'nochange', today: '2026-12-03', qualified: false }), '2026-12-07');
  });

  test('trying is 2 business days, even on a qualified lead', () => {
    assert.equal(nextUpdateDue({ choice: 'trying', today: '2026-12-04' }), '2026-12-08');
    assert.equal(nextUpdateDue({ choice: 'trying', today: '2026-12-04', qualified: true }), '2026-12-08');
  });

  test('meeting is the first business day after the demo date, or after today with no date', () => {
    assert.equal(nextUpdateDue({ choice: 'meeting', today, meetingDate: '2026-12-03' }), '2026-12-04');
    assert.equal(nextUpdateDue({ choice: 'meeting', today, meetingDate: '2026-12-04' }), '2026-12-07');
    assert.equal(nextUpdateDue({ choice: 'meeting', today: '2026-11-25' }), '2026-11-30');
  });

  test('an unknown choice throws instead of guessing a date', () => {
    assert.throws(() => nextUpdateDue({ choice: 'maybe', today }), RangeError);
  });
});

describe('introDue against the 3F Due_date expression', () => {
  // 3F: today plus 2, plus 4 on Thu and Fri, plus 3 on Sat. No holiday list.
  const legacy = (today) => {
    const dow = dayOfWeek(today);
    return addDays(today, dow === 4 || dow === 5 ? 4 : dow === 6 ? 3 : 2);
  };

  test('is 2 business days, holidays skipped', () => {
    assert.equal(introDue('2026-12-03'), '2026-12-07');
    assert.equal(introDue('2026-11-25'), '2026-12-01');
  });

  test('equals 3F on every date from 11/27/2026 to 1/31/2027 except these, where a holiday sits in the window', () => {
    const differs = [];
    for (let day = '2026-11-27'; day <= '2027-01-31'; day = addDays(day, 1)) {
      if (legacy(day) !== introDue(day)) differs.push(day);
    }
    assert.deepEqual(differs, [
      '2026-12-22',
      '2026-12-23',
      '2026-12-24',
      '2026-12-30',
      '2026-12-31',
      '2027-01-14',
      '2027-01-15',
      '2027-01-16',
      '2027-01-17',
    ]);
  });

  test('3F on Wed 11/25 lands on 11/27, a listed holiday. introDue does not', () => {
    assert.equal(legacy('2026-11-25'), '2026-11-27');
    assert.notEqual(introDue('2026-11-25'), '2026-11-27');
  });
});

describe('holidayRunwayDays', () => {
  test('counts days to the last listed holiday, negative once it has passed', () => {
    assert.equal(holidayRunwayDays('2026-12-19'), 30);
    assert.equal(holidayRunwayDays('2027-01-18'), 0);
    assert.equal(holidayRunwayDays('2027-02-01'), -14);
    assert.equal(holidayRunwayDays('2026-12-19', []), 0);
  });
});
