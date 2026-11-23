// The partner page's answer checks (sheet PU, A and B4). The page and /api/partner-save
// both use checkUpdate, so these rules hold before any 7F call.
import assert from 'node:assert/strict';
import { STAND_CHOICES } from './partner-status-words.mjs';
import { describe, test } from 'node:test';
import { CLOSED_REASONS, LEGACY_CLOSED_REASONS, QUALIFYING_CHOICES, TALKED_CHOICES, TALKED_FOR, checkUpdate, checkUpdates, easternToday, dueLine, isDate, isPartnerKey, noChangeHint, nowLine, pickedWords, saveLabel, saveResultWords, showDate } from './partner-form.mjs';

const TODAY = '2026-11-20';
// The new page sends no Talked To Doctor answer; checkUpdate fills it in from the choice.
const base = { id: 36, choice: 'proposal', talkedToDoctor: '', meetingDate: '', signedDate: '', signedProduct: '', closedReason: '', note: '', offices: '' };
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
      talkedToDoctor: 'Yes',
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
    // Retired from the page 11/21/2026; the save still takes it from an older open tab.
    assert.equal(ok({ ...base, choice: 'dq_notinterested', note: 'TEST using another vendor' }).note, 'TEST using another vendor');
  });
  test('hand back is no longer a page choice', () => {
    bad({ ...base, choice: 'handback', note: 'TEST note one' }, 'choice');
  });
  test('Talked To Doctor follows the choice when the page sends none', () => {
    assert.equal(ok({ ...base, choice: 'trying' }).talkedToDoctor, 'Not yet, still trying');
    assert.equal(ok({ ...base, choice: 'dq_noanswer' }).talkedToDoctor, 'Not yet, still trying');
    assert.equal(ok({ ...base, choice: 'qualified' }).talkedToDoctor, 'Yes');
    assert.equal(ok({ ...base, choice: 'nochange' }).talkedToDoctor, '');
    for (const c of STAND_CHOICES) {
      const t = TALKED_FOR[c.code];
      assert.ok(t === '' ? c.code === 'nochange' : TALKED_CHOICES.includes(t), c.code);
    }
  });
  test('a page loaded before the change still saves with the old rules (Codex P1 on #20)', () => {
    const old = { ...base, talkedToDoctor: "Not yet, haven't tried" };
    assert.equal(ok({ ...old, choice: 'handback', note: 'TEST wrong number' }).choice, 'handback');
    assert.equal(ok({ ...old, choice: 'handback', note: 'TEST wrong number' }).talkedToDoctor, "Not yet, haven't tried");
    bad({ ...old, choice: 'handback' }, 'note');
    for (const reason of LEGACY_CLOSED_REASONS) assert.equal(ok({ ...old, choice: 'lost', closedReason: reason }).closedReason, reason);
    assert.equal(ok({ ...old, choice: 'nochange' }).talkedToDoctor, "Not yet, haven't tried");
    bad({ ...base, talkedToDoctor: 'Maybe' }, 'talkedToDoctor');
    bad({ ...old, choice: 'qualified' }, 'choice');
  });
  test('every page choice has a heading group and a label', () => {
    assert.deepEqual(STAND_CHOICES.map((c) => c.code), ['qualified', 'trying', 'dq_noanswer', 'meeting', 'proposal', 'signed', 'lost', 'nochange']);
    for (const c of STAND_CHOICES) assert.ok(c.label && ['qualify', 'deal', 'checkin'].includes(c.group), c.code);
    assert.deepEqual(STAND_CHOICES.filter((c) => c.group === 'qualify').map((c) => c.label), ['Reached the customer', 'Not reached yet', 'Disqualified: no answer after 4 attempts']);
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

test('the Now line shows the meeting date only while the lead stands at a meeting', () => {
  assert.equal(nowLine('Meeting set', '2026-11-24'), 'Meeting set, meeting Nov 24, 2026');
  assert.equal(nowLine('Scheduled', '2026-11-24'), 'Meeting set, meeting Nov 24, 2026');
  assert.equal(nowLine('Complete', '2026-11-24'), 'Meeting held, meeting Nov 24, 2026');
  assert.equal(nowLine('Meeting set', ''), 'Meeting set');
  // The case keeps an old Meeting Date after a later save (TEST F60, 11/21/2026).
  assert.equal(nowLine('Trying to reach', '2026-11-24'), 'Not reached yet');
  assert.equal(nowLine('Proposal or agreement sent', '2026-11-24'), 'Proposal or agreement sent');
  assert.equal(nowLine('Not moving forward', '2026-11-24'), 'Not moving forward');
  assert.equal(nowLine('', '2026-11-24'), 'No update yet');
  // Qualified is stored as Reached (7F).
  assert.equal(nowLine('Reached', ''), 'Reached the customer');
});

test('No change names the stage the lead keeps', () => {
  assert.equal(noChangeHint('Meeting set'), "Keeps it at Meeting set. Counts as this week's update.");
  assert.equal(noChangeHint('Reached'), "Keeps it at Reached the customer. Counts as this week's update.");
  assert.equal(noChangeHint(''), "Counts as this week's update.");
});

test('the Next update line says when the update is due, or that it is overdue', () => {
  assert.equal(dueLine(0, '2026-11-24'), 'Due Nov 24, 2026');
  assert.equal(dueLine(2, '2026-11-24'), 'Overdue. Now due Nov 24, 2026');
  assert.equal(dueLine(1, ''), 'Overdue');
  assert.equal(dueLine(0, ''), 'Not set yet');
});

test('a save says exactly what saved: full, partial, none; more than sent is no answer', () => {
  assert.equal(saveResultWords(1, 1), 'Saved 1 update.');
  assert.equal(saveResultWords(3, 3), 'Saved 3 updates.');
  assert.equal(saveResultWords(1, 2), 'Saved 1 of 2 updates. 1 lead closed or changed while you worked and did not save. The list below is current.');
  assert.equal(saveResultWords(1, 4), 'Saved 1 of 4 updates. 3 leads closed or changed while you worked and did not save. The list below is current.');
  assert.equal(saveResultWords(0, 1), 'Nothing saved. This lead closed or changed while you worked. The list below is current.');
  assert.equal(saveResultWords(0, 2), 'Nothing saved. These 2 leads closed or changed while you worked. The list below is current.');
  for (const [saved, sent] of [[3, 2], [1, 0], [-1, 1], [1.5, 2], [NaN, 1], [1, 51], [0, 0]]) {
    assert.equal(saveResultWords(saved, sent), null, `${saved} of ${sent}`);
  }
  // Partner-facing copy: no em dashes or arrows.
  for (const words of [saveResultWords(1, 2), saveResultWords(0, 1), saveResultWords(0, 2)]) assert.doesNotMatch(String(words), /[\u2014\u2013\u2192]/);
});

describe('office count answer (Brian, 11/22/2026)', () => {
  test('kept only on a qualifying choice', () => {
    for (const choice of QUALIFYING_CHOICES) {
      const extra = choice === 'meeting' ? { meetingDate: TODAY } : choice === 'signed' ? { signedDate: TODAY } : {};
      assert.equal(ok({ ...base, choice, offices: 'yes', ...extra }).offices, 'yes', choice);
      assert.equal(ok({ ...base, choice, offices: 'no', ...extra }).offices, 'no', choice);
    }
    for (const choice of ['trying', 'dq_noanswer', 'nochange']) assert.equal(ok({ ...base, choice, offices: 'yes' }).offices, '', choice);
    assert.equal(ok({ ...base, choice: 'lost', closedReason: 'Price', offices: 'no' }).offices, '');
  });
  test('only yes, no or blank; a missing answer is blank', () => {
    for (const offices of ['maybe', 'Yes', true, 1, ['yes']]) bad({ ...base, choice: 'qualified', offices }, 'offices');
    const { offices: _drop, ...noField } = base;
    assert.equal(ok({ ...noField, choice: 'qualified' }).offices, '');
    assert.equal(ok({ ...noField, choice: 'qualified', offices: null }).offices, '');
  });
  test('the page needs an answer on a lead that asks; the route does not', () => {
    bad({ ...base, choice: 'qualified', askOffices: true }, 'offices');
    bad({ ...base, choice: 'signed', signedDate: TODAY, askOffices: true }, 'offices');
    assert.equal(ok({ ...base, choice: 'qualified', askOffices: true, offices: 'no' }).offices, 'no');
    assert.equal(ok({ ...base, choice: 'trying', askOffices: true }).offices, '');
    assert.equal(checkUpdate({ ...base, choice: 'qualified', askOffices: true }, null).ok, true);
    assert.equal('askOffices' in ok({ ...base, choice: 'qualified', askOffices: true, offices: 'yes' }), false, 'never sent');
  });
});

test('the sticky Save says how many leads will save (Brian, 11/23/2026 Release A)', () => {
  assert.equal(saveLabel(0), 'Save');
  assert.equal(saveLabel(1), 'Save 1 update');
  assert.equal(saveLabel(2), 'Save 2 updates');
  assert.equal(saveLabel(10), 'Save 10 updates');
  for (const bad of [-1, 1.5, NaN, undefined]) assert.equal(saveLabel(bad), 'Save');
});

test('a collapsed card names the answer it will save', () => {
  assert.equal(pickedWords('qualified'), 'Selected: Reached the customer');
  assert.equal(pickedWords('meeting'), 'Selected: Demo set');
  assert.equal(pickedWords('nochange'), 'Selected: No change this week');
  assert.equal(pickedWords(''), '');
  assert.equal(pickedWords('bogus'), '');
  for (const c of STAND_CHOICES) assert.doesNotMatch(pickedWords(c.code), /[—→]/);
});
