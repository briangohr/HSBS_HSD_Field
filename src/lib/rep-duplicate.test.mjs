// Duplicate warning before Send (Brian, 11/21/2026): the rep's own open referral for the
// same office and company, matched on practice name, or on JDE once 1F sends one.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { duplicateWarning, findOpenDuplicate, jdeKey, practiceKey } from './rep-duplicate.mjs';

const TODAY = '2026-11-21';
const STAFFING = 'HS Staffing / Recruiting Services (including GoTu)';
const ref = (o = {}) => ({
  id: 7,
  title: 'HSBS-F70',
  doctor: 'TEST Office Manager',
  practice: 'TEST North Side Dental',
  created: '2026-11-18T15:00:00Z',
  cases: [{ company: 'HealthFirst', partnerStatus: 'Trying to reach', updated: '2026-11-19' }],
  ...o,
});
const hf = (practiceName, jde = '') => ({ company: 'HealthFirst', practiceName, jde });

describe('practiceKey and jdeKey', () => {
  test('case, spaces and punctuation do not matter; & reads as and', () => {
    assert.equal(practiceKey('TEST North-Side Dental, P.C.'), practiceKey('test northside dental pc'));
    assert.equal(practiceKey('Smith & Jones DDS'), practiceKey('Smith and Jones DDS'));
    assert.notEqual(practiceKey('TEST North Side Dental'), practiceKey('TEST South Side Dental'));
    assert.equal(practiceKey(undefined), '');
  });
  test('a JDE is text: leading zeros count, anything not digits is blank', () => {
    assert.equal(jdeKey(' 001234 '), '001234');
    assert.notEqual(jdeKey('001234'), jdeKey('1234'));
    assert.equal(jdeKey('12a4'), '');
    assert.equal(jdeKey(null), '');
  });
});

describe('findOpenDuplicate', () => {
  test('an open referral to the same company with the same practice name warns', () => {
    const dup = findOpenDuplicate([ref()], hf('test north side dental'), TODAY);
    assert.deepEqual(dup, { office: 'TEST North Side Dental', sentLabel: 'Sent Nov 18', company: 'HealthFirst' });
    assert.equal(
      duplicateWarning(dup),
      'You already sent TEST North Side Dental to HealthFirst on Nov 18, and it is still open. Check Track first. To send another referral anyway, press Send again.',
    );
  });

  test('another practice, or nothing typed, does not warn', () => {
    assert.equal(findOpenDuplicate([ref()], hf('TEST South Side Dental'), TODAY), null);
    assert.equal(findOpenDuplicate([ref()], hf(''), TODAY), null);
    assert.equal(findOpenDuplicate([], hf('TEST North Side Dental'), TODAY), null);
    assert.equal(findOpenDuplicate(null, hf('TEST North Side Dental'), TODAY), null);
  });

  test('the same office to the other company does not warn', () => {
    assert.equal(findOpenDuplicate([ref()], { company: 'Staffing', practiceName: 'TEST North Side Dental' }, TODAY), null);
    const staffing = ref({ cases: [{ company: STAFFING, partnerStatus: '' }] });
    assert.equal(findOpenDuplicate([staffing], hf('TEST North Side Dental'), TODAY), null);
    assert.equal(
      findOpenDuplicate([staffing], { company: 'Staffing', practiceName: 'TEST North Side Dental' }, TODAY)?.company,
      'Direct Dental',
    );
  });

  test('an unknown company never warns', () => {
    assert.equal(findOpenDuplicate([ref()], { company: 'GoTu', practiceName: 'TEST North Side Dental' }, TODAY), null);
    assert.equal(findOpenDuplicate([ref()], { company: undefined, practiceName: 'TEST North Side Dental' }, TODAY), null);
  });

  test('a closed, disqualified or signed referral does not warn', () => {
    for (const cases of [
      [{ company: 'HealthFirst', partnerStatus: 'Not moving forward' }],
      [{ company: 'HealthFirst', partnerStatus: 'Signed' }],
      [{ company: 'HealthFirst', partnerStatus: 'Trying to reach', qualified: 'No', closedReason: 'Not qualified' }],
    ]) {
      assert.equal(findOpenDuplicate([ref({ cases })], hf('TEST North Side Dental'), TODAY), null, JSON.stringify(cases));
    }
    assert.equal(findOpenDuplicate([ref({ closed: true })], hf('TEST North Side Dental'), TODAY), null);
    assert.equal(findOpenDuplicate([ref({ signed: true })], hf('TEST North Side Dental'), TODAY), null);
  });

  test('a referral with no case yet counts as HealthFirst', () => {
    assert.ok(findOpenDuplicate([ref({ cases: [] })], hf('TEST North Side Dental'), TODAY));
    assert.equal(findOpenDuplicate([ref({ cases: [] })], { company: 'Staffing', practiceName: 'TEST North Side Dental' }, TODAY), null);
  });

  test('a JDE on the list row matches under another practice name; none on the row matches by name only', () => {
    const withJde = ref({ jde: '001234', practice: 'TEST Old Name Dental' });
    assert.equal(findOpenDuplicate([withJde], hf('TEST New Name Dental', '001234'), TODAY)?.office, 'TEST Old Name Dental');
    assert.equal(findOpenDuplicate([withJde], hf('TEST New Name Dental', '1234'), TODAY), null);
    // 1F sends no JDE today: the name still matches, a JDE alone does not.
    assert.ok(findOpenDuplicate([ref()], hf('TEST North Side Dental', '001234'), TODAY));
    assert.equal(findOpenDuplicate([ref()], hf('', '001234'), TODAY), null);
  });

  test('the answer carries no JDE, contact or key', () => {
    const dup = findOpenDuplicate([ref({ jde: '001234', referralKey: 'c'.repeat(43) })], hf('TEST North Side Dental'), TODAY);
    assert.deepEqual(Object.keys(dup).sort(), ['company', 'office', 'sentLabel']);
    assert.ok(!JSON.stringify(dup).includes('001234'));
  });
});
