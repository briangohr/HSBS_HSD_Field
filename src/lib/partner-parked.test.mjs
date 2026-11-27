// Parked on the partner page (Brian, 11/26/2026; LTI-SHARED-001 r8 "Parked rules", E20 to
// E26). The page and /api/partner-save share checkUpdate, so these rules hold before any 7F
// call; 7F checks them again. Behind PARTNER_PARKED_ENABLED: off, nothing changes.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  FIELD_WORDS,
  PARK_NO_DATE_REASON,
  PARK_NO_DATE_WORDS,
  PARKED_BY_MAX,
  PARK_REASON_MAX,
  TALKED_FOR,
  checkUpdate,
  checkUpdates,
  fieldWords,
  nextDay,
  noChangeHint,
  nowLine,
  parkNoDateCount,
  pickedWords,
  withParkWords,
} from './partner-form.mjs';
import { PARK_CHOICES, PARK_CODES, choiceGroupsFor } from './partner-status-words.mjs';

const TODAY = '2026-11-27';
const on = { parked: true };
const base = { id: 36, choice: 'parked', talkedToDoctor: '', meetingDate: '', signedDate: '', signedProduct: '', closedReason: '', note: '', offices: '' };
const park = { ...base, parkDate: '2026-12-15', parkReason: 'Office remodel until January', parkedBy: 'TEST Jane Partner' };
const okOn = (raw, today = TODAY) => {
  const r = checkUpdate(raw, today, on);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.update;
};
const badOn = (raw, field, today = TODAY) => assert.deepEqual(checkUpdate(raw, today, on), { ok: false, id: 36, field });

describe('switch', () => {
  test('off: parked and unpark are a bad choice, and no park key is added (parity with main)', () => {
    for (const opts of [undefined, {}, { parked: false }, { dealValue: true }]) {
      for (const choice of PARK_CODES) assert.deepEqual(checkUpdate({ ...park, choice }, TODAY, opts), { ok: false, id: 36, field: 'choice' }, choice);
      const r = checkUpdate({ ...park, choice: 'proposal' }, TODAY, opts);
      assert.equal(r.ok, true);
      for (const k of ['parkDate', 'parkReason', 'parkedBy']) assert.equal(k in r.update, false, k);
    }
  });
  test('off: a lead offers no Set aside group', () => {
    for (const park of [undefined, {}, { on: false, parked: true }]) {
      assert.equal(choiceGroupsFor('Reached', park).some((g) => g.group === 'side'), false);
    }
  });
  test('an old page (talkedToDoctor sent) never parks, even with the switch on', () => {
    assert.deepEqual(checkUpdate({ ...park, talkedToDoctor: 'Yes' }, TODAY, on), { ok: false, id: 36, field: 'choice' });
  });
});

describe('park rules (switch on)', () => {
  test('E20: date, reason and who save as a park; Talked To Doctor stays as it is', () => {
    const u = okOn(park);
    assert.equal(u.choice, 'parked');
    assert.equal(u.parkDate, '2026-12-15');
    assert.equal(u.parkReason, 'Office remodel until January');
    assert.equal(u.parkedBy, 'TEST Jane Partner');
    assert.equal(u.talkedToDoctor, '');
    assert.equal(TALKED_FOR.parked, '');
    assert.equal(u.meetingDate, '');
    assert.equal(u.closedReason, '');
  });
  test('E21: missing reason or who is refused and names what is missing, even with no date', () => {
    badOn({ ...park, parkReason: '' }, 'parkReason');
    badOn({ ...park, parkedBy: '' }, 'parkedBy');
    badOn({ ...park, parkReason: '  ', parkedBy: '' }, 'parkReasonBy');
    badOn({ ...park, parkReason: '', parkDate: '' }, 'parkReason');
    badOn({ ...park, parkedBy: '', parkDate: '' }, 'parkedBy');
    badOn({ ...park, parkReason: '', parkedBy: '', parkDate: '' }, 'parkReasonBy');
    badOn({ ...park, parkReason: undefined, parkedBy: null }, 'parkReasonBy');
    assert.equal(fieldWords('HSBS-F90', 'parkReasonBy'), 'Lead HSBS-F90: check Reason for setting it aside and Your name.');
    assert.equal(fieldWords('HSBS-F90', 'parkedBy'), 'Lead HSBS-F90: check Your name.');
    assert.equal(FIELD_WORDS.parkReason, 'Reason for setting it aside');
  });
  test('E22: reason and who with no date is allowed (7F closes it) and counted for the saved words', () => {
    const u = okOn({ ...park, parkDate: '' });
    assert.equal(u.parkDate, '');
    assert.equal(parkNoDateCount([u, okOn(park), okOn({ ...park, id: 37, choice: 'proposal' })]), 1);
    assert.equal(PARK_NO_DATE_REASON, 'Parked without a revisit date');
    assert.equal(withParkWords('Saved 1 update.', 1, 1, 1), 'Saved 1 update. Saved as Closed Lost, no revisit date.');
    assert.equal(withParkWords('Saved 3 updates.', 3, 3, 2), `Saved 3 updates. 2 leads: ${PARK_NO_DATE_WORDS}`);
  });
  test('the saved words add the Closed Lost line only on a full save with a count in range', () => {
    assert.equal(withParkWords('Saved 1 of 2 updates.', 1, 2, 1), 'Saved 1 of 2 updates.');
    for (const n of [0, NaN, -1, 3, 1.5]) assert.equal(withParkWords('Saved 2 updates.', 2, 2, n), 'Saved 2 updates.', String(n));
    assert.equal(withParkWords('', 1, 1, 1), '');
  });
  test('the revisit date must be a real business day after today, at most two years out', () => {
    badOn({ ...park, parkDate: TODAY }, 'parkDate');
    badOn({ ...park, parkDate: '2026-11-01' }, 'parkDate');
    for (const parkDate of ['2026-02-30', '2026-12-99', '2026-13-01', '12/15/2026', '2026-12-1', 'soon']) badOn({ ...park, parkDate }, 'parkDate');
    // Weekends and Field holidays: 7G sends no ask on them, so a revisit date there would not resume on the day.
    for (const parkDate of ['2026-11-28', '2026-11-29', '2026-12-24', '2026-12-25', '2027-01-01', '2027-01-18']) badOn({ ...park, parkDate }, 'parkDate');
    assert.equal(okOn({ ...park, parkDate: '2026-11-30' }).parkDate, '2026-11-30');
    assert.equal(okOn({ ...park, parkDate: '2028-12-01' }).parkDate, '2028-12-01');
    badOn({ ...park, parkDate: '2028-12-04' }, 'parkDate');
    // The route skips the day rule (a resend after midnight still reaches 7F's tag check), never the business-day rule.
    assert.equal(checkUpdate({ ...park, parkDate: '2026-11-25' }, null, on).ok, true);
    assert.equal(checkUpdate({ ...park, parkDate: '2026-11-28' }, null, on).ok, false);
    assert.equal(checkUpdate({ ...park, parkDate: '2026-02-30' }, null, on).ok, false);
    assert.equal(nextDay('2026-11-30'), '2026-12-01');
    assert.equal(nextDay('2026-12-31'), '2027-01-01');
    assert.equal(nextDay('nope'), '');
  });
  test('reason and who are one line and capped', () => {
    const u = okOn({ ...park, parkReason: ' Remodel\n until\tJan ', parkedBy: ' Jane\r\nP ' });
    assert.equal(u.parkReason, 'Remodel until Jan');
    assert.equal(u.parkedBy, 'Jane P');
    assert.equal(okOn({ ...park, parkReason: 'r'.repeat(PARK_REASON_MAX) }).parkReason.length, PARK_REASON_MAX);
    badOn({ ...park, parkReason: 'r'.repeat(PARK_REASON_MAX + 1) }, 'parkReason');
    badOn({ ...park, parkedBy: 'n'.repeat(PARKED_BY_MAX + 1) }, 'parkedBy');
  });
  test('every other choice sends blank park fields, whatever was typed', () => {
    for (const [choice, more] of [['trying', {}], ['qualified', {}], ['proposal', {}], ['nochange', {}], ['unpark', {}], ['lost', { closedReason: 'Price' }], ['meeting', { meetingDate: '2026-12-01' }]]) {
      const u = okOn({ ...park, choice, ...more });
      assert.deepEqual([u.parkDate, u.parkReason, u.parkedBy], ['', '', ''], choice);
    }
  });
  test('unpark needs nothing else and keeps Talked To Doctor', () => {
    const u = okOn({ ...base, choice: 'unpark' });
    assert.equal(u.talkedToDoctor, '');
    assert.equal(pickedWords('unpark'), 'Selected: Pick it back up');
    assert.equal(pickedWords('parked'), 'Selected: Set aside for later (Parked)');
  });
  test('checkUpdates passes the switch through', () => {
    const r = checkUpdates([park, { ...base, id: 37, choice: 'proposal' }], null, on);
    assert.equal(r.ok, true);
    assert.deepEqual(r.updates.map((u) => u.parkDate), ['2026-12-15', '']);
    assert.deepEqual(checkUpdates([park], null), { ok: false, id: 36, field: 'choice' });
  });
});

describe('page words (switch on)', () => {
  test('an open lead gets Set aside with Parked only; a parked lead can be picked back up', () => {
    const open = choiceGroupsFor('Reached', { on: true, parked: false });
    assert.deepEqual(open.at(-1).choices.map((c) => c.code), ['parked']);
    assert.equal(open.at(-1).heading, 'Set aside');
    const parked = choiceGroupsFor('Reached', { on: true, parked: true });
    assert.deepEqual(parked.at(-1).choices.map((c) => c.code), ['parked', 'unpark']);
    // The qualifying freeze still holds for a parked qualified lead.
    assert.deepEqual(parked[0].choices, []);
    assert.deepEqual(PARK_CHOICES.map((c) => c.group), ['side', 'side']);
  });
  test('the Now line and the No change hint name the revisit date while parked', () => {
    assert.equal(nowLine('Reached', '', '2026-12-15'), 'Reached the customer. Parked until Dec 15, 2026');
    assert.equal(nowLine('Meeting set', '2026-12-01', '2026-12-15'), 'Meeting set, meeting Dec 1, 2026. Parked until Dec 15, 2026');
    assert.equal(nowLine('', '', '2026-12-15'), 'No update yet. Parked until Dec 15, 2026');
    assert.equal(nowLine('Reached', '', ''), 'Reached the customer');
    assert.equal(nowLine('Reached', ''), 'Reached the customer');
    assert.equal(noChangeHint('Reached', '2026-12-15'), "Keeps it parked until Dec 15, 2026, at Reached the customer. Counts as this week's update.");
    assert.equal(noChangeHint('', '2026-12-15'), "Keeps it parked until Dec 15, 2026. Counts as this week's update.");
    assert.equal(noChangeHint('Reached'), "Keeps it at Reached the customer. Counts as this week's update.");
  });
  test('customer copy has no em dash or arrow', () => {
    const words = [...PARK_CHOICES.flatMap((c) => [c.label, c.hint]), PARK_NO_DATE_WORDS, FIELD_WORDS.parkReasonBy];
    for (const w of words) assert.doesNotMatch(w, /[—→⇒]/u, w);
  });
});
