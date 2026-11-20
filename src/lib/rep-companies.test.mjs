import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  COMPANY_OFF_MESSAGE,
  DEFAULT_REP_COMPANIES,
  ONE_COMPANY_MESSAGE,
  REP_COMPANIES,
  STALE_MESSAGE,
  checkSendCompany,
  companyName,
  keyForSolutions,
  parseRepCompanies,
  repCompany,
  sendTab,
  solutionsForKey,
} from './rep-companies.mjs';
import { REP_COMPANY } from './rep-referral-form.mjs';

describe('rep app company table (field two-track spec, section 4)', () => {
  test('three keys, each with its Solutions value and its screen name', () => {
    assert.deepEqual(
      REP_COMPANIES.map((c) => [c.key, c.solutions, c.name]),
      [
        ['HealthFirst', 'HealthFirst', 'HealthFirst'],
        ['Staffing', 'HS Staffing / Recruiting Services (including GoTu)', 'Direct Dental'],
        ['DPT', 'Dental Practice Transition', 'Dental Practice Transition'],
      ],
    );
    // The Solutions values exactly as Referrals and Service Cases store them today.
    assert.equal(solutionsForKey('Staffing'), 'HS Staffing / Recruiting Services (including GoTu)');
    assert.equal(solutionsForKey('HealthFirst'), 'HealthFirst');
    assert.equal(solutionsForKey('HealthFirst'), REP_COMPANY);
  });

  test('key and Solutions value turn into each other through the table only', () => {
    for (const c of REP_COMPANIES) {
      assert.equal(keyForSolutions(c.solutions), c.key);
      assert.equal(solutionsForKey(c.key), c.solutions);
      assert.equal(companyName(c.key), c.name);
      assert.equal(repCompany(c.key), c);
    }
    // A Solutions value not in the table has no key; an unknown key has no value or name.
    assert.equal(keyForSolutions('Unitas'), '');
    assert.equal(keyForSolutions(''), '');
    assert.equal(keyForSolutions(undefined), '');
    assert.equal(solutionsForKey('staffing'), '');
    assert.equal(companyName('Unitas'), '');
    assert.equal(repCompany('healthfirst'), undefined);
  });

  test('the table cannot be changed at run time', () => {
    assert.throws(() => /** @type {any} */ (REP_COMPANIES).push({}));
    assert.throws(() => {
      /** @type {any} */ (REP_COMPANIES[1]).form = true;
    });
    assert.throws(() => /** @type {any} */ (DEFAULT_REP_COMPANIES).push('Staffing'));
  });

  test('every company has a send form (HealthFirst, staffing since S3, the DPT ask)', () => {
    assert.deepEqual(REP_COMPANIES.filter((c) => c.form).map((c) => c.key), ['HealthFirst', 'Staffing', 'DPT']);
  });

  test('every company with a form has a server sender, and no sender lacks a form (S3 seam)', async () => {
    const { REP_SENDERS } = await import('./rep-submit.ts');
    assert.deepEqual(Object.keys(REP_SENDERS).sort(), REP_COMPANIES.filter((c) => c.form).map((c) => c.key).sort());
  });
});

describe('REP_APP_COMPANIES parsing', () => {
  test('unset, empty or blank means HealthFirst only', () => {
    for (const raw of [undefined, null, '', '   ', ',', ' , , ']) assert.deepEqual(parseRepCompanies(raw), ['HealthFirst'], String(raw));
  });

  test('a value that is not a string means HealthFirst only', () => {
    for (const raw of [1, true, {}, ['Staffing']]) assert.deepEqual(parseRepCompanies(raw), ['HealthFirst']);
  });

  test('both keys, in table order whatever order they are typed', () => {
    assert.deepEqual(parseRepCompanies('HealthFirst,Staffing'), ['HealthFirst', 'Staffing']);
    assert.deepEqual(parseRepCompanies('Staffing,HealthFirst'), ['HealthFirst', 'Staffing']);
  });

  test('spaces around entries and odd case are accepted', () => {
    assert.deepEqual(parseRepCompanies('  healthfirst ,  STAFFING  '), ['HealthFirst', 'Staffing']);
    assert.deepEqual(parseRepCompanies('HEALTHFIRST'), ['HealthFirst']);
  });

  test('unknown keys are dropped; repeats count once', () => {
    assert.deepEqual(parseRepCompanies('HealthFirst,Unitas,Stafing'), ['HealthFirst']);
    assert.deepEqual(parseRepCompanies('Staffing,staffing,Staffing'), ['Staffing']);
    assert.deepEqual(parseRepCompanies('HealthFirst;Staffing'), ['HealthFirst']);
    // Solutions values and screen names are not keys.
    assert.deepEqual(parseRepCompanies('Direct Dental'), ['HealthFirst']);
    assert.deepEqual(parseRepCompanies('HS Staffing / Recruiting Services (including GoTu)'), ['HealthFirst']);
  });

  test('nothing known left means HealthFirst only', () => {
    assert.deepEqual(parseRepCompanies('Unitas,eAssist'), ['HealthFirst']);
  });

  test('Staffing alone switches HealthFirst off', () => {
    assert.deepEqual(parseRepCompanies('Staffing'), ['Staffing']);
  });

  test('the Send tab: classic for HealthFirst only, a choice for two', () => {
    assert.deepEqual(sendTab(undefined), { keys: ['HealthFirst'], choice: false, classic: true });
    assert.deepEqual(sendTab('Unitas'), { keys: ['HealthFirst'], choice: false, classic: true });
    assert.deepEqual(sendTab('HealthFirst,Staffing'), { keys: ['HealthFirst', 'Staffing'], choice: true, classic: false });
    assert.deepEqual(sendTab('Staffing'), { keys: ['Staffing'], choice: false, classic: false });
  });
});

describe('a send names exactly one company that is switched on (spec section 4)', () => {
  const both = 'HealthFirst,Staffing';

  test('HealthFirst is accepted when it is on', () => {
    for (const raw of [undefined, '', 'HealthFirst', both, 'junk']) {
      assert.deepEqual(checkSendCompany('HealthFirst', raw), { ok: true, key: 'HealthFirst' }, String(raw));
      assert.deepEqual(checkSendCompany(['HealthFirst'], raw), { ok: true, key: 'HealthFirst' });
    }
  });

  test('none named is refused as an out of date page', () => {
    for (const named of [undefined, null, '', [], ['']]) {
      assert.deepEqual(checkSendCompany(named, both), { ok: false, status: 409, error: STALE_MESSAGE }, JSON.stringify(named));
    }
  });

  test('two named is refused, even when both are on', () => {
    for (const named of [['HealthFirst', 'Staffing'], ['HealthFirst', 'HealthFirst'], ['HealthFirst', 'Unitas']]) {
      assert.deepEqual(checkSendCompany(named, both), { ok: false, status: 400, error: ONE_COMPANY_MESSAGE });
    }
  });

  test('a value that is not a string is refused', () => {
    for (const named of [1, true, { key: 'HealthFirst' }, ['HealthFirst', 2], [null]]) {
      assert.deepEqual(checkSendCompany(named, both), { ok: false, status: 400, error: ONE_COMPANY_MESSAGE }, JSON.stringify(named));
    }
  });

  test('a company that is off is refused', () => {
    assert.deepEqual(checkSendCompany('HealthFirst', 'Staffing'), { ok: false, status: 403, error: COMPANY_OFF_MESSAGE });
    assert.deepEqual(checkSendCompany('Staffing', undefined), { ok: false, status: 403, error: COMPANY_OFF_MESSAGE });
  });

  test('staffing is accepted when switched on (it has a form since S3) and refused when off', () => {
    assert.deepEqual(checkSendCompany('Staffing', both), { ok: true, key: 'Staffing' });
    assert.deepEqual(checkSendCompany('Staffing', 'Staffing'), { ok: true, key: 'Staffing' });
    assert.deepEqual(checkSendCompany('Staffing', 'HealthFirst'), { ok: false, status: 403, error: COMPANY_OFF_MESSAGE });
  });

  test('the key must be spelled exactly; Solutions values and names are not keys', () => {
    for (const named of ['healthfirst', ' HealthFirst', 'Direct Dental', 'HS Staffing / Recruiting Services (including GoTu)', 'Unitas']) {
      assert.deepEqual(checkSendCompany(named, both), { ok: false, status: 403, error: COMPANY_OFF_MESSAGE }, named);
    }
  });

  test('copy has no em dashes or arrows', () => {
    for (const s of [ONE_COMPANY_MESSAGE, STALE_MESSAGE, COMPANY_OFF_MESSAGE]) assert.equal(/[\u2014\u2190-\u21ff]/.test(s), false);
  });
});
