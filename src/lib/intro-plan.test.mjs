// Lean rebuild U1: the intro decisions, pinned to what 3F HealthFirst and 3F Staffing do today,
// plus the changes on purpose. Fixtures are TEST data only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { introDue } from './field-rules.mjs';
import {
  MAX_TRIES,
  MIN_AGE_SECONDS,
  heldKey,
  introKey,
  isCandidate,
  partnerNames,
  planName,
  planReferral,
  readReferral,
  readRoute,
  unknownKey,
} from './intro-plan.mjs';

const NOW = Date.parse('2026-12-02T15:00:00Z');
const OLD = '2026-12-02T14:50:00Z';
const TODAY = '2026-12-02';

const referral = (over = {}, id = 90) =>
  readReferral(id, {
    Title: 'HSBS-F90',
    Source: 'Rep app',
    Route: 'Direct to partner',
    Solutions: ['HealthFirst'],
    Created: OLD,
    PracticeName: 'TEST North Side Dental',
    Test: true,
    ...over,
  });

const routing = (rows) => new Map(rows.map((f) => [f.Title, readRoute(f)]));
const ROUTES = routing([
  { Title: 'HealthFirst', Primaryemail: 'hf@example.invalid', Verified: true },
  { Title: 'HS Staffing / Recruiting Services (including GoTu)', Primaryemail: 'staff@example.invalid', Primaryname: 'Pat', Verified: true },
  { Title: 'Unverified Co', Primaryemail: 'x@example.invalid', Verified: false },
]);

describe('isCandidate (the 3F trigger conditions)', () => {
  test('a Rep app, Direct to partner row with no stamp, under 3 tries, old enough', () => {
    assert.equal(isCandidate(referral(), NOW), true);
    assert.equal(isCandidate(referral({ Intro_x0020_Tries: 2 }), NOW), true);
  });

  for (const [why, over] of [
    ['another source', { Source: 'Web' }],
    ['another route', { Route: 'Via HSBS' }],
    ['already introduced', { Introduced_x0020_On: '2026-12-01' }],
    ['3 tries used', { Intro_x0020_Tries: 3 }],
    ['no created time', { Created: '' }],
    ['younger than 120 seconds', { Created: '2026-12-02T14:58:30Z' }],
  ]) {
    test(`not a candidate: ${why}`, () => assert.equal(isCandidate(referral(over), NOW), false));
  }

  test('exactly 120 seconds old is old enough', () => {
    const created = new Date(NOW - MIN_AGE_SECONDS * 1000).toISOString();
    assert.equal(isCandidate(referral({ Created: created }), NOW), true);
  });
});

describe('partnerNames', () => {
  test('Solutions and Partner together, trimmed, each once', () => {
    const r = referral({ Solutions: [' HealthFirst ', 'HS Staffing / Recruiting Services (including GoTu)'], Partner: ['HealthFirst'] });
    assert.deepEqual(partnerNames(r), ['HealthFirst', 'HS Staffing / Recruiting Services (including GoTu)']);
  });

  test('reads choice objects as well as plain text, and drops blanks', () => {
    assert.deepEqual(partnerNames(referral({ Solutions: [{ Value: 'HealthFirst' }, '', null], Partner: undefined })), ['HealthFirst']);
  });

  test('the two older labels are read as Unitas, once', () => {
    assert.deepEqual(partnerNames(referral({ Solutions: ['PPO Fees', 'HSRA', 'Unitas'] })), ['Unitas']);
  });

  test('an empty row has no names', () => assert.deepEqual(partnerNames(referral({ Solutions: [] })), []));
});

describe('readRoute', () => {
  test('routable needs an email and Verified true', () => {
    assert.equal(ROUTES.get('HealthFirst').routable, true);
    assert.equal(ROUTES.get('Unverified Co').routable, false);
    assert.equal(readRoute({ Title: 'X', Primaryemail: '', Verified: true }).routable, false);
    assert.equal(readRoute({ Title: 'X', Primaryemail: 'a@example.invalid', Verified: 'yes' }).routable, false);
  });
});

describe('planName', () => {
  const route = ROUTES.get('HealthFirst');
  const unrouted = ROUTES.get('Unverified Co');
  const kase = { id: 7, sent: false };
  const at = (minutesAgo) => NOW - minutesAgo * 60_000;
  const plan = (ctx) => planName('HealthFirst', { nowMs: NOW, ...ctx }).kind;

  test('no Routing row is unknown_company: no case, no mail', () => {
    assert.equal(plan({ route: undefined, kase: undefined, log: undefined }), 'unknown_company');
  });

  test('a known name with no case creates the case first', () => {
    assert.equal(plan({ route, kase: undefined, log: undefined }), 'create_case');
    assert.equal(plan({ route: unrouted, kase: undefined, log: undefined }), 'create_case');
  });

  test('a case not yet mailed with no log row is sent', () => assert.equal(plan({ route, kase, log: undefined }), 'send'));

  test('a case already Sent is done, whatever the log says', () => {
    assert.equal(plan({ route, kase: { id: 7, sent: true }, log: { result: 'Failed', tries: 1, lastTryMs: at(1) } }), 'done');
  });

  test('Sent in the log with the case still Not sent: only patch the case, never mail again', () => {
    assert.equal(plan({ route, kase, log: { result: 'Sent', tries: 1, lastTryMs: at(1) } }), 'patch_case');
  });

  test('Failed waits 5 minutes, then retries, then alerts at 3 tries', () => {
    assert.equal(plan({ route, kase, log: { result: 'Failed', tries: 1, lastTryMs: at(4) } }), 'wait');
    assert.equal(plan({ route, kase, log: { result: 'Failed', tries: 1, lastTryMs: at(5) } }), 'send');
    assert.equal(plan({ route, kase, log: { result: 'Failed', tries: MAX_TRIES, lastTryMs: at(60) } }), 'alert_tries');
  });

  test('Claimed or Maybe is never resent: wait, then one alert', () => {
    for (const result of ['Claimed', 'Maybe']) {
      assert.equal(plan({ route, kase, log: { result, tries: 1, lastTryMs: at(2) } }), 'wait');
      assert.equal(plan({ route, kase, log: { result, tries: 1, lastTryMs: at(6) } }), 'alert_maybe');
    }
  });

  test('Alerted, and any word the job does not know, blocks until the owner acts', () => {
    assert.equal(plan({ route, kase, log: { result: 'Alerted', tries: 3, lastTryMs: at(90) } }), 'blocked');
    assert.equal(plan({ route, kase, log: { result: '???', tries: 0, lastTryMs: at(90) } }), 'blocked');
  });

  test('an unroutable case: the forward-manually mail goes once, then it is done', () => {
    assert.equal(plan({ route: unrouted, kase, log: undefined }), 'send');
    assert.equal(plan({ route: unrouted, kase, log: { result: 'Sent', tries: 1, lastTryMs: at(1) } }), 'done');
  });
});

describe('planReferral', () => {
  const ctx = (over = {}) => ({ routing: ROUTES, cases: new Map(), logs: new Map(), nowMs: NOW, today: TODAY, ...over });
  const STAFF = 'HS Staffing / Recruiting Services (including GoTu)';

  test('a new referral creates a case for each name with a Routing row and does not stamp', () => {
    const plan = planReferral(referral({ Solutions: ['HealthFirst', STAFF] }), ctx());
    assert.deepEqual(plan.names.map((n) => n.kind), ['create_case', 'create_case']);
    assert.equal(plan.stamp, null);
  });

  test('mixed row: HealthFirst and staffing are handled, the unknown company is only an alert', () => {
    const r = referral({ Solutions: ['HealthFirst', STAFF, 'eAssist'] });
    const sent = new Map([['HealthFirst', { id: 1, sent: true }], [STAFF, { id: 2, sent: true }]]);
    const plan = planReferral(r, ctx({ cases: sent }));
    assert.deepEqual(plan.names.map((n) => n.kind), ['done', 'done', 'unknown_company']);
    assert.deepEqual(plan.stamp, { introducedOn: TODAY, nextUpdateDue: introDue(TODAY), lastNotifiedStatus: 'Introduced to Solution Company' });
  });

  test('a near match has no Routing row: no case, no mail, no stamp, one alert', () => {
    const plan = planReferral(referral({ Solutions: ['HealthFirst Plus'] }), ctx());
    assert.deepEqual(plan.names.map((n) => n.kind), ['unknown_company']);
    assert.equal(plan.stamp, null);
  });

  test('one partner failed and one sent: no stamp, and only the missing one is planned', () => {
    const r = referral({ Solutions: ['HealthFirst', STAFF] });
    const cases = new Map([['HealthFirst', { id: 1, sent: true }], [STAFF, { id: 2, sent: false }]]);
    const logs = new Map([[introKey(2), { result: 'Failed', tries: 1, lastTryMs: NOW - 10 * 60_000 }]]);
    const plan = planReferral(r, ctx({ cases, logs }));
    assert.deepEqual(plan.names.map((n) => n.kind), ['done', 'send']);
    assert.equal(plan.stamp, null);
  });

  test('an unroutable name reads the held log row, not the intro one', () => {
    const r = referral({ Solutions: ['Unverified Co'] });
    const cases = new Map([['Unverified Co', { id: 5, sent: false }]]);
    const held = new Map([[heldKey(5), { result: 'Sent', tries: 1, lastTryMs: NOW - 60_000 }]]);
    assert.equal(planReferral(r, ctx({ cases, logs: held })).stamp?.introducedOn, TODAY);
    assert.deepEqual(planReferral(r, ctx({ cases })).names.map((n) => n.kind), ['send']);
  });

  test('the stamp uses the holiday aware due date', () => {
    const plan = planReferral(referral(), ctx({ cases: new Map([['HealthFirst', { id: 1, sent: true }]]), today: '2026-11-25' }));
    assert.equal(plan.stamp?.nextUpdateDue, '2026-12-01');
  });

  test('a referral with no names is never stamped', () => {
    assert.equal(planReferral(referral({ Solutions: [] }), ctx()).stamp, null);
  });
});

describe('log keys and files', () => {
  test('keys', () => {
    assert.equal(introKey(7), 'intro:7');
    assert.equal(heldKey(7), 'held:7');
    assert.equal(unknownKey(90, 'eAssist', TODAY), 'unknown:90:eAssist:2026-12-02');
  });

  test('no email address is typed into the intro modules', () => {
    for (const file of ['intro-plan.mjs', 'intro-mail.mjs']) {
      const src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      assert.equal(/[\w.+-]+@[\w-]+\.[\w.-]+/.test(src), false, file);
    }
  });
});
