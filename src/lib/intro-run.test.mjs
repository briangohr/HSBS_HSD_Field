// Lean rebuild U1: the intro job against the in-memory gateway store, with a seeded fault at every
// step. The rule under test: a retry does only what is missing, a mail with no clear answer is never
// sent again, and nothing is lost without an alert. TEST data only.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { introDue } from './field-rules.mjs';
import { createFakeStore } from './gateway-fake.mjs';
import { introJob } from './intro-job.mjs';
import { BUDGET_MS, IntroSettingsError, LOCK_MINUTES, runIntro } from './intro-run.mjs';

const T0 = Date.parse('2026-12-02T15:00:00Z');
const at = (minutes) => new Date(T0 + minutes * 60_000);
const STAFF = 'HS Staffing / Recruiting Services (including GoTu)';

const SETTINGS = [
  { Title: 'MailOwner', Value: 'owner@example.invalid' },
  { Title: 'IntroCc', Value: 'cc@example.invalid' },
  { Title: 'IntroReplyTo', Value: 'reply@example.invalid' },
  { Title: 'IntroSignatureEmail', Value: 'sign@example.invalid' },
];
const ROUTING = [
  { Title: 'HealthFirst', Primaryemail: 'hf@example.invalid', Primaryname: 'HF', Verified: true, Greeting: 'Hello HealthFirst team', ShowState: true },
  { Title: STAFF, Primaryemail: 'staff@example.invalid', Primaryname: 'Pat', Verified: true },
  { Title: 'Unverified Co', Primaryemail: 'x@example.invalid', Verified: false },
];
const REFERRAL = {
  Title: 'HSBS-F90',
  Source: 'Rep app',
  Route: 'Direct to partner',
  Solutions: ['HealthFirst'],
  Created: '2026-12-02T14:50:00Z',
  PracticeName: 'TEST North Side Dental',
  Referring_x0020_Rep: 'Test Rep',
  Referring_x0020_Rep_x0020_Email: 'rep@example.invalid',
  Test: true,
};

const world = (over = {}, { faults = [], settings = SETTINGS, extra = {} } = {}) =>
  createFakeStore({
    lists: {
      'Field Settings': settings,
      Routing: ROUTING,
      Referrals: [{ ...REFERRAL, ...over }],
      'Service Cases': [],
      'Field Send Log': [],
      'Rep Roster': [{ RepEmail: 'rep@example.invalid', Role: 'RM' }],
      ...extra,
    },
    faults,
  });

const cases = (store) => store.inspect.rows('Service Cases');
const logs = (store) => store.inspect.rows('Field Send Log').filter((r) => r.fields.Kind !== 'lock');
const referral = (store) => store.inspect.rows('Referrals')[0].fields;
const mails = (store, part) => store.inspect.sent.filter((m) => m.subject.includes(part));
const introMails = (store) => mails(store, ' referral: ');
const alerts = (store) => store.inspect.sent.filter((m) => !m.subject.includes(' referral: '));

/** Run the job every 6 minutes until `runs` have gone. */
async function runMany(store, runs) {
  const answers = [];
  for (let i = 0; i < runs; i += 1) answers.push(await runIntro({ store, now: at(i * 6) }));
  return answers;
}

describe('one referral, no trouble', () => {
  test('a HealthFirst TEST referral: case, one mail to the owner only, log row, stamp, lock freed', async () => {
    const store = world();
    const answer = await runIntro({ store, now: at(0) });
    assert.deepEqual([answer.scanned, answer.introduced, answer.alerts], [1, 1, 0]);
    assert.deepEqual(cases(store).map((c) => [c.fields.Title, c.fields.Status, c.fields.Dispatch, c.fields.Stage]), [
      ['HSBS-F90 | HealthFirst', 'Sent', 'Sent delivery unverified', 'New lead'],
    ]);
    const [mail] = introMails(store);
    assert.deepEqual([introMails(store).length, mail.to, mail.cc], [1, ['owner@example.invalid'], []]);
    assert.ok(mail.subject.startsWith('[TEST] New HealthFirst referral'));
    assert.ok(mail.html.includes('</b>, RGM'), 'the roster role RM reads as RGM');
    assert.deepEqual(logs(store).map((r) => [r.fields.Title, r.fields.Result]), [['intro:1', 'Sent']]);
    const r = referral(store);
    assert.equal(r.Introduced_x0020_On, '2026-12-02');
    assert.equal(r.Next_x0020_Update_x0020_Due, introDue('2026-12-02'));
    assert.equal(r.Last_x0020_Notified_x0020_Status, 'Introduced to Solution Company');
    assert.equal(store.inspect.rows('Field Send Log').find((x) => x.fields.Kind === 'lock').fields.Result, 'Free');
  });

  test('a real referral mails the partner and CCs the rep and the intro CC', async () => {
    const store = world({ Test: false });
    await runIntro({ store, now: at(0) });
    const [mail] = introMails(store);
    assert.deepEqual([mail.to, mail.cc], [['hf@example.invalid'], ['rep@example.invalid', 'cc@example.invalid']]);
  });

  test('a second run changes nothing and sends nothing', async () => {
    const store = world();
    await runIntro({ store, now: at(0) });
    const before = store.inspect.writes;
    const second = await runIntro({ store, now: at(6) });
    assert.equal(second.scanned, 0);
    assert.equal(introMails(store).length, 1);
    assert.equal(store.inspect.writes - before, 2, 'only the lock row is written');
  });

  test('a referral younger than 120 seconds is left alone', async () => {
    const store = world({ Created: '2026-12-02T14:58:30Z' });
    assert.equal((await runIntro({ store, now: at(0) })).scanned, 0);
    assert.equal(cases(store).length, 0);
  });
});

describe('several partners and unknown companies', () => {
  test('HealthFirst, staffing and an unknown company: two cases and mails, one alert, stamped, no repeat alert', async () => {
    const store = world({ Solutions: ['HealthFirst', STAFF, 'eAssist'] });
    await runMany(store, 3);
    assert.deepEqual(cases(store).map((c) => c.fields.Service), ['HealthFirst', STAFF]);
    assert.equal(introMails(store).length, 2);
    assert.equal(alerts(store).length, 1);
    assert.ok(alerts(store)[0].subject.includes('no Routing row for eAssist'));
    assert.equal(referral(store).Introduced_x0020_On, '2026-12-02');
  });

  test('a near match alone: no case, no intro mail, no stamp, one alert a day', async () => {
    const store = world({ Solutions: ['HealthFirst Plus'] });
    await runMany(store, 3);
    assert.equal(cases(store).length, 0);
    assert.equal(introMails(store).length, 0);
    assert.equal(alerts(store).length, 1);
    assert.equal(referral(store).Introduced_x0020_On, undefined);
  });

  test('an unroutable partner: Held case, one NOT SENT mail to the owner, then stamped', async () => {
    const store = world({ Solutions: ['Unverified Co'] });
    const answer = await runIntro({ store, now: at(0) });
    assert.equal(answer.held, 1);
    assert.deepEqual(cases(store).map((c) => [c.fields.Status, c.fields.Dispatch]), [['Held', 'Not sent']]);
    const [mail] = introMails(store);
    assert.ok(mail.subject.includes('NOT SENT, forward manually'));
    assert.deepEqual(mail.to, ['owner@example.invalid']);
    assert.equal(logs(store)[0].fields.Title, 'held:1');
    assert.equal(referral(store).Introduced_x0020_On, '2026-12-02');
  });

  test('one partner already Sent: only the other is mailed', async () => {
    const store = world(
      { Solutions: ['HealthFirst', STAFF] },
      { extra: { 'Service Cases': [{ Title: 'HSBS-F90 | HealthFirst', Service: 'HealthFirst', Status: 'Sent', Dispatch: 'Sent delivery unverified' }] } },
    );
    await runIntro({ store, now: at(0) });
    assert.deepEqual(introMails(store).map((m) => m.subject.includes(STAFF)), [true]);
    assert.equal(cases(store).length, 2);
  });
});

describe('seeded faults: no duplicate mail, no lost case, nothing lost without an alert', () => {
  /** [name, fault, partner mails sent, an alert about a maybe, ends Sent and stamped] */
  const FAULTS = [
    ['case create fails', { op: 'create', list: 'Service Cases', nth: 1, mode: 'fail' }, 1, false, true],
    ['case create times out before the write', { op: 'create', list: 'Service Cases', nth: 1, mode: 'maybe_before' }, 1, false, true],
    ['case create times out after the write', { op: 'create', list: 'Service Cases', nth: 1, mode: 'maybe_after' }, 1, false, true],
    ['claim row create fails', { op: 'create', list: 'Field Send Log', nth: 2, mode: 'fail' }, 1, false, true],
    ['send fails', { op: 'send', nth: 1, mode: 'fail' }, 1, false, true],
    ['send times out before it went', { op: 'send', nth: 1, mode: 'maybe_before' }, 0, true, false],
    ['send times out after it went', { op: 'send', nth: 1, mode: 'maybe_after' }, 1, true, false],
    ['log row patch fails after the send', { op: 'patch', list: 'Field Send Log', nth: 1, mode: 'fail' }, 1, true, false],
    ['case patch fails after the send', { op: 'patch', list: 'Service Cases', nth: 1, mode: 'fail' }, 1, false, true],
    ['stamp patch fails', { op: 'patch', list: 'Referrals', nth: 1, mode: 'fail' }, 1, false, true],
    ['lock create fails', { op: 'create', list: 'Field Send Log', nth: 1, mode: 'fail' }, 1, false, true],
    ['a read fails', { op: 'read', list: 'Routing', nth: 1, mode: 'fail' }, 1, false, true],
  ];
  for (const [name, fault, partnerMails, maybeAlert, complete] of FAULTS) {
    test(name, async () => {
      const store = world({}, { faults: [fault] });
      // A failed run may throw; later runs must still finish the job. Run on regardless.
      for (let i = 0; i < 6; i += 1) await runIntro({ store, now: at(i * 6) }).catch(() => {});
      for (let i = 0; i < 6 && !complete; i += 1) await runIntro({ store, now: at(60 + i * 6) }).catch(() => {});
      assert.ok(cases(store).length <= 1, 'never a second case');
      assert.equal(introMails(store).length, partnerMails, 'partner mails');
      assert.equal(alerts(store).some((m) => m.subject.includes('may or may not')), maybeAlert, 'maybe alert');
      assert.equal(alerts(store).length <= 1, true, 'at most one alert');
      if (complete) {
        assert.deepEqual(cases(store).map((c) => c.fields.Dispatch), ['Sent delivery unverified']);
        assert.equal(referral(store).Introduced_x0020_On, '2026-12-02');
      } else {
        assert.equal(referral(store).Introduced_x0020_On, undefined, 'a lead with no clear send is never stamped');
      }
    });
  }

  test('three failed sends: one alert, Intro Tries set to 3, then nothing more is sent', async () => {
    const faults = [1, 2, 3].map((nth) => ({ op: 'send', nth, mode: 'fail' }));
    const store = world({}, { faults });
    await runMany(store, 8);
    assert.equal(introMails(store).length, 0);
    assert.equal(alerts(store).length, 1);
    assert.ok(alerts(store)[0].subject.includes('not sent after 3 tries'));
    assert.equal(referral(store).Intro_x0020_Tries, 3);
    assert.equal(referral(store).Introduced_x0020_On, undefined);
  });

  test('a failed try waits 5 minutes before the next', async () => {
    const store = world({}, { faults: [{ op: 'send', nth: 1, mode: 'fail' }] });
    await runIntro({ store, now: at(0) });
    await runIntro({ store, now: at(3) });
    assert.equal(introMails(store).length, 0, 'still waiting at 3 minutes');
    await runIntro({ store, now: at(6) });
    assert.equal(introMails(store).length, 1);
  });

  test('a recipient off the gateway allow list is a failed try, never a mail', async () => {
    const store = createFakeStore({
      lists: { 'Field Settings': SETTINGS, Routing: ROUTING, Referrals: [{ ...REFERRAL, Test: false }], 'Field Send Log': [] },
      allowRecipients: ['owner@example.invalid'],
    });
    await runIntro({ store, now: at(0) });
    assert.equal(store.inspect.sent.length, 0);
    assert.equal(logs(store)[0].fields.Result, 'Failed');
    assert.equal(logs(store)[0].fields.Note, 'not_allowed');
  });
});

describe('review findings: starvation, alert delivery, held maybe', () => {
  test('25 unresolved referrals do not block a valid one behind them', async () => {
    const unknown = Array.from({ length: 30 }, (_, i) => ({ ...REFERRAL, Title: `HSBS-U${i}`, Solutions: ['Nobody Inc'] }));
    const store = createFakeStore({
      lists: {
        'Field Settings': SETTINGS,
        Routing: ROUTING,
        Referrals: [...unknown, { ...REFERRAL, Title: 'HSBS-GOOD' }],
        'Service Cases': [],
        'Field Send Log': [],
        'Rep Roster': [],
      },
    });
    await runMany(store, 6);
    assert.equal(introMails(store).filter((m) => m.html.includes('HSBS-GOOD')).length, 1);
    assert.equal(introMails(store).length, 1, 'only the valid referral is mailed');
  });

  test('a failed alert is tried again; the maybe log is not marked Alerted until it went out', async () => {
    // send 1 is the intro (no clear answer), send 2 is the alert and fails.
    const faults = [
      { op: 'send', nth: 1, mode: 'maybe_before' },
      { op: 'send', nth: 2, mode: 'fail' },
    ];
    const store = world({}, { faults });
    await runMany(store, 5);
    assert.equal(alerts(store).filter((m) => m.subject.includes('may or may not')).length, 1);
    assert.equal(logs(store).find((r) => r.fields.Title === 'intro:1').fields.Result, 'Alerted');
  });

  test('a failed tries alert does not set Intro Tries until it went out', async () => {
    const faults = [1, 2, 3].map((nth) => ({ op: 'send', nth, mode: 'fail' }));
    faults.push({ op: 'send', nth: 4, mode: 'fail' });
    const store = world({}, { faults });
    await runIntro({ store, now: at(0) });
    await runIntro({ store, now: at(6) });
    await runIntro({ store, now: at(12) });
    await runIntro({ store, now: at(18) });
    assert.equal(referral(store).Intro_x0020_Tries, undefined, 'alert send 4 failed, so tries stay open');
    await runIntro({ store, now: at(24) });
    assert.equal(alerts(store).length, 1);
    assert.equal(referral(store).Intro_x0020_Tries, 3);
  });

  test('out of time: the run stops starting referrals, frees the lock, and the next run finishes', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ ...REFERRAL, Title: `HSBS-T${i}`, Solutions: ['HealthFirst'] }));
    const store = createFakeStore({
      lists: { 'Field Settings': SETTINGS, Routing: ROUTING, Referrals: many, 'Service Cases': [], 'Field Send Log': [], 'Rep Roster': [] },
    });
    // Each clock read moves 10 seconds, so the budget runs out after two referrals.
    let t = 0;
    const slow = () => (t += BUDGET_MS / 2.5);
    const first = await runIntro({ store, now: at(0), clock: slow });
    assert.ok(first.deferred > 0 && first.scanned < 5, 'some referrals wait for the next run');
    assert.equal(store.inspect.rows('Field Send Log').find((x) => x.fields.Kind === 'lock').fields.Result, 'Free');
    await runIntro({ store, now: at(6) });
    await runIntro({ store, now: at(12) });
    await runIntro({ store, now: at(18) });
    assert.equal(introMails(store).length, 5, 'every referral is mailed exactly once');
  });

  test('more open referrals than one read window: a later one is still reached, once-a-day alert', async () => {
    const dead = Array.from({ length: 2100 }, (_, i) => ({ ...REFERRAL, Title: `HSBS-D${i}`, Intro_x0020_Tries: 3 }));
    const store = createFakeStore({
      lists: {
        'Field Settings': SETTINGS,
        Routing: ROUTING,
        Referrals: [...dead, { ...REFERRAL, Title: 'HSBS-LATE' }],
        'Service Cases': [],
        'Field Send Log': [],
        'Rep Roster': [],
      },
    });
    // One run every 2 minutes, so the read window moves each time.
    for (let i = 0; i < 12; i += 1) await runIntro({ store, now: at(i * 2) });
    assert.equal(introMails(store).filter((m) => m.html.includes('HSBS-LATE')).length, 1);
    assert.equal(alerts(store).filter((m) => m.subject.includes('still open')).length, 1);
  });

  test('window and batch rotation do not lock out a valid referral behind 26 unresolved ones', async () => {
    const stuck = Array.from({ length: 2000 }, (_, i) => ({ ...REFERRAL, Title: `HSBS-S${i}`, Solutions: ['Nobody Inc'] }));
    stuck.splice(25, 0, { ...REFERRAL, Title: 'HSBS-VALID' });
    const dead = Array.from({ length: 100 }, (_, i) => ({ ...REFERRAL, Title: `HSBS-X${i}`, Intro_x0020_Tries: 3 }));
    const store = createFakeStore({
      lists: { 'Field Settings': SETTINGS, Routing: ROUTING, Referrals: [...stuck, ...dead], 'Service Cases': [], 'Field Send Log': [], 'Rep Roster': [] },
    });
    // A full cycle is 80 batches of 25 over 10 windows, about 800 runs. Stop as soon as it is mailed.
    const mailed = () => introMails(store).filter((m) => m.html.includes('HSBS-VALID')).length;
    for (let i = 0; i < 1000 && mailed() === 0; i += 1) await runIntro({ store, now: at(i * 2) });
    assert.equal(mailed(), 1);
  });

  test('two requests racing for a missing lock: one runs, one case, one mail', async () => {
    const store = world();
    const [a, b] = await Promise.all([runIntro({ store, now: at(0) }), runIntro({ store, now: at(0) })]);
    assert.deepEqual([a.skipped, b.skipped].filter(Boolean), ['locked']);
    assert.equal(cases(store).length, 1);
    assert.equal(introMails(store).length, 1);
  });

  test('one partner out of tries does not stop the other partner from its retries and alert', async () => {
    // HealthFirst sends fail three times. Staffing sends fail three times too, one run later.
    const faults = [1, 2, 3, 4, 5, 6, 7].map((nth) => ({ op: 'send', nth, mode: 'fail' }));
    // The second partner's first claim row fails, so its tries run one behind the first partner's.
    faults.push({ op: 'create', list: 'Field Send Log', nth: 3, mode: 'fail' });
    const store = world({ Solutions: ['HealthFirst', STAFF] }, { faults });
    await runMany(store, 12);
    const tried = alerts(store).filter((m) => m.subject.includes('not sent after 3 tries'));
    assert.equal(tried.length, 2, 'one alert per partner');
    assert.equal(referral(store).Intro_x0020_Tries, 3, 'cutoff only after both alerts went out');
  });

  test('an unroutable partner with an ambiguous owner mail gets its maybe alert', async () => {
    const store = world({ Solutions: ['Unverified Co'] }, { faults: [{ op: 'send', nth: 1, mode: 'maybe_before' }] });
    await runMany(store, 4);
    assert.equal(alerts(store).filter((m) => m.subject.includes('may or may not')).length, 1);
  });
});

describe('switches, settings and the lock', () => {
  test('dry run plans and writes and sends nothing', async () => {
    const store = world();
    const answer = await runIntro({ store, now: at(0), dryRun: true });
    assert.equal(store.inspect.writes, 0);
    assert.equal(store.inspect.sent.length, 0);
    assert.deepEqual([answer.dryRun, answer.scanned, answer.plan.create_case], [true, 1, 1]);
  });

  test('IntroEnabled No stops the job', async () => {
    const store = world({}, { settings: [...SETTINGS, { Title: 'IntroEnabled', Value: 'No' }] });
    assert.equal((await runIntro({ store, now: at(0) })).skipped, 'off');
    assert.equal(store.inspect.writes, 0);
  });

  test('a missing Settings row is a settings error and writes nothing', async () => {
    const store = world({}, { settings: SETTINGS.slice(0, 2) });
    await assert.rejects(runIntro({ store, now: at(0) }), IntroSettingsError);
    assert.equal(store.inspect.writes, 0);
  });

  test('a fresh lock skips the run, a stale one is taken over', async () => {
    const held = (minutes) => ({ 'Field Send Log': [{ Title: 'lock:intro', Kind: 'lock', Result: 'Held', LastTry: at(-minutes).toISOString() }] });
    const fresh = world({}, { extra: held(LOCK_MINUTES - 1) });
    assert.equal((await runIntro({ store: fresh, now: at(0) })).skipped, 'locked');
    assert.equal(cases(fresh).length, 0);
    const stale = world({}, { extra: held(LOCK_MINUTES + 1) });
    assert.equal((await runIntro({ store: stale, now: at(0) })).introduced, 1);
  });

  test('the answer carries counts only: no name, address or id', async () => {
    const store = world({ Solutions: ['HealthFirst', 'eAssist'] });
    const answer = JSON.stringify(await runIntro({ store, now: at(0) }));
    for (const secret of ['@', 'HSBS-F90', 'North Side', 'HealthFirst', 'eAssist']) assert.ok(!answer.includes(secret), secret);
  });
});

describe('the request side', () => {
  const SECRET = 'job-secret-0123456789';
  const keep = {};
  beforeEach(() => {
    for (const k of ['REP_APP_ENABLED', 'GATEWAY_ENABLED', 'INTRO_CODE_ENABLED', 'INTRO_CODE_DRY_RUN', 'JOB_SECRET']) keep[k] = process.env[k];
    Object.assign(process.env, { REP_APP_ENABLED: 'true', GATEWAY_ENABLED: 'true', INTRO_CODE_ENABLED: 'true', JOB_SECRET: SECRET });
    delete process.env.INTRO_CODE_DRY_RUN;
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(keep)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test('404 unless all three switches are exactly true, and nothing is read', async () => {
    for (const k of ['REP_APP_ENABLED', 'GATEWAY_ENABLED', 'INTRO_CODE_ENABLED']) {
      process.env[k] = 'yes';
      const store = world();
      assert.equal((await introJob({ secret: SECRET, store })).status, 404, k);
      assert.equal(store.inspect.calls.length, 0);
      process.env[k] = 'true';
    }
  });

  test('401 for a wrong, missing or short secret, and nothing is read', async () => {
    const store = world();
    for (const secret of [null, '', 'wrong-secret-0123456789', SECRET.slice(0, 5)]) {
      assert.equal((await introJob({ secret, store })).status, 401);
    }
    process.env.JOB_SECRET = 'short';
    assert.equal((await introJob({ secret: 'short', store })).status, 401);
    assert.equal(store.inspect.calls.length, 0);
  });

  test('200 with the right secret, and INTRO_CODE_DRY_RUN writes nothing', async () => {
    const store = world();
    process.env.INTRO_CODE_DRY_RUN = 'true';
    const res = await introJob({ secret: SECRET, store, now: at(0) });
    assert.equal(res.status, 200);
    assert.equal(res.body.dryRun, true);
    assert.equal(store.inspect.writes, 0);
  });

  test('503 settings when a Settings row is missing', async () => {
    const res = await introJob({ secret: SECRET, store: world({}, { settings: [] }), now: at(0) });
    assert.deepEqual([res.status, res.body], [503, { ok: false, error: 'settings' }]);
  });
});
