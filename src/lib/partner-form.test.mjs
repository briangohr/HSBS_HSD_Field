// The partner page's answer checks (sheet PU, A and B4). The page and /api/partner-save
// both use checkUpdate, so these rules hold before any 7F call.
import assert from 'node:assert/strict';
import { STAND_CHOICES } from './partner-status-words.mjs';
import { describe, test } from 'node:test';
import { CLOSED_REASONS, TALKED_CHOICES, TALKED_FOR, checkUpdate, checkUpdates, easternToday, isDate, isPartnerKey, showDate } from './partner-form.mjs';

const TODAY = '2026-11-20';
const base = { id: 36, choice: 'proposal', talkedToDoctor: 'Yes', meetingDate: '', signedDate: '', signedProduct: '', closedReason: '', note: '' };
const ok = (raw) => {
  const r = checkUpdate(raw, TODAY);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.update;
};
const bad = (raw, field) => assert.deepEqual(checkUpdate(raw, TODAY), { ok: false, id: raw.id ?? null, field });

describe('isPartnerKey', () => {
  test('only 40 hex characters', () => {
    assert.equal(isPartnerKey('a'.repeat(40)), true);
    assert.equal(isPartnerKey('0123456789ABCDEFabcdef0123456789abcdef01'), true); // secret-scan: allow (made-up hex shape test)
    assert.equal(isPartnerKey('a'.repeat(39)), false);
    assert.equal(isPartnerKey('a'.repeat(41)), false);
    assert.equal(isPartnerKey('g'.repeat(40)), false);
    assert.equal(isPartnerKey(`RepTest_${'r'.repeat(32)}`), false);
    assert.equal(isPartnerKey(undefined), false);
  });
});

describe('dates', () => {
  test('isDate is a real calendar date', () => {
    assert.equal(isDate('2026-11-20'), true);
    assert.equal(isDate('2026-02-30'), false);
    assert.equal(isDate('2026-11-20T00:00:00Z'), false);
    assert.equal(isDate(''), false);
  });
  test('showDate words a date and drops junk', () => {
    assert.equal(showDate('2026-11-23'), 'Nov 23, 2026');
    assert.equal(showDate('nope'), '');
  });
  test('easternToday uses Eastern, not UTC', () => {
    assert.equal(easternToday(new Date('2026-11-21T03:30:00Z')), '2026-11-20');
    assert.equal(easternToday(new Date('2026-11-21T05:30:00Z')), '2026-11-21');
  });
});

describe('checkUpdate', () => {
  test('a meeting needs a date today or later; other fields go blank', () => {
    assert.deepEqual(ok({ ...base, choice: 'meeting', meetingDate: '2026-11-24', signedDate: '2026-11-01', closedReason: 'Price' }), {
      ...base,
      choice: 'meeting',
      meetingDate: '2026-11-24',
    });
    ok({ ...base, choice: 'meeting', meetingDate: TODAY });
    bad({ ...base, choice: 'meeting', meetingDate: '2026-11-19' }, 'meetingDate');
    bad({ ...base, choice: 'meeting', meetingDate: '' }, 'meetingDate');
  });
  test('signed needs a date not in the future; product up to 100', () => {
    assert.equal(ok({ ...base, choice: 'signed', signedDate: TODAY, signedProduct: ' TEST plan ' }).signedProduct, 'TEST plan');
    bad({ ...base, choice: 'signed', signedDate: '2026-11-21' }, 'signedDate');
    bad({ ...base, choice: 'signed', signedDate: TODAY, signedProduct: 'x'.repeat(101) }, 'signedProduct');
  });
  test('with no day (the save route) the day rules are left to 7F, the shape rules stay', () => {
    assert.equal(checkUpdate({ ...base, choice: 'meeting', meetingDate: '2026-11-19' }, null).ok, true);
    assert.equal(checkUpdate({ ...base, choice: 'signed', signedDate: '2026-11-21' }, null).ok, true);
    assert.deepEqual(checkUpdate({ ...base, choice: 'meeting', meetingDate: '' }, null), { ok: false, id: 36, field: 'meetingDate' });
    assert.deepEqual(checkUpdate({ ...base, choice: 'signed', signedDate: '11/20/2026' }, null), { ok: false, id: 36, field: 'signedDate' });
  });
  test('lost needs one of the five reasons; no answer is the disqualified choice now', () => {
    for (const reason of CLOSED_REASONS) assert.equal(ok({ ...base, choice: 'lost', closedReason: reason }).closedReason, reason);
    bad({ ...base, choice: 'lost', closedReason: 'Bored' }, 'closedReason');
    bad({ ...base, choice: 'lost' }, 'closedReason');
    bad({ ...base, choice: 'lost', closedReason: 'No response' }, 'closedReason');
  });
  test('the qualify choices need nothing more, and a note stays optional', () => {
    for (const choice of ['trying', 'qualified', 'dq_noanswer', 'dq_notinterested']) {
      assert.deepEqual(ok({ ...base, choice, closedReason: 'Price' }), { ...base, choice, talkedToDoctor: TALKED_FOR[choice] });
    }
    assert.equal(ok({ ...base, choice: 'dq_notinterested', note: 'TEST using another vendor' }).note, 'TEST using another vendor');
  });
  test('hand back is no longer a page choice', () => {
    bad({ ...base, choice: 'handback', note: 'TEST note one' }, 'choice');
  });
  test('Talked To Doctor follows the choice; the browser value is ignored', () => {
    assert.equal(ok({ ...base, choice: 'trying', talkedToDoctor: 'Yes' }).talkedToDoctor, 'Not yet, still trying');
    assert.equal(ok({ ...base, choice: 'dq_noanswer', talkedToDoctor: 'Yes' }).talkedToDoctor, 'Not yet, still trying');
    assert.equal(ok({ ...base, choice: 'qualified', talkedToDoctor: 'Maybe' }).talkedToDoctor, 'Yes');
    assert.equal(ok({ ...base, choice: 'nochange', talkedToDoctor: 'Yes' }).talkedToDoctor, '');
    for (const c of STAND_CHOICES) {
      const t = TALKED_FOR[c.code];
      assert.ok(t === '' ? c.code === 'nochange' : TALKED_CHOICES.includes(t), c.code);
    }
  });
  test('every page choice has a heading group and a label', () => {
    assert.deepEqual(STAND_CHOICES.map((c) => c.code), ['trying', 'qualified', 'dq_noanswer', 'dq_notinterested', 'meeting', 'proposal', 'signed', 'lost', 'nochange']);
    for (const c of STAND_CHOICES) assert.ok(c.label && ['qualify', 'deal', 'other'].includes(c.group), c.code);
  });
  test('note is one line, up to 300 characters', () => {
    assert.equal(ok({ ...base, note: 'line one\nReferred by: x' }).note, 'line one Referred by: x');
    ok({ ...base, note: 'x'.repeat(300) });
    bad({ ...base, note: 'x'.repeat(301) }, 'note');
  });
  test('choice and id must be known shapes', () => {
    bad({ ...base, choice: 'won' }, 'choice');
    bad({ ...base, choice: '' }, 'choice');
    assert.deepEqual(checkUpdate({ ...base, id: '36' }, TODAY), { ok: false, id: null, field: 'id' });
    assert.deepEqual(checkUpdate({ ...base, id: 0 }, TODAY), { ok: false, id: null, field: 'id' });
    assert.deepEqual(checkUpdate(null, TODAY), { ok: false, id: null, field: 'id' });
  });
  test('only contract fields are sent', () => {
    assert.deepEqual(Object.keys(ok({ ...base, key: 'x', repEmail: 'x@y.z' })), Object.keys(base));
  });
});

describe('checkUpdates', () => {
  test('1 to 50 updates, each lead once', () => {
    assert.deepEqual(checkUpdates([], TODAY), { ok: false, id: null, field: 'none' });
    assert.deepEqual(checkUpdates('x', TODAY), { ok: false, id: null, field: 'none' });
    const many = Array.from({ length: 51 }, (_, i) => ({ ...base, id: i + 1 }));
    assert.deepEqual(checkUpdates(many, TODAY), { ok: false, id: null, field: 'tooMany' });
    assert.equal(checkUpdates(many.slice(0, 50), TODAY).ok, true);
    assert.deepEqual(checkUpdates([base, base], TODAY), { ok: false, id: 36, field: 'id' });
  });
  test('the first bad lead is named', () => {
    assert.deepEqual(checkUpdates([base, { ...base, id: 37, choice: 'lost' }], TODAY), { ok: false, id: 37, field: 'closedReason' });
  });
});
