// Codex P1s on #113 (rounds 2 and 3): every answer the rep app page reads that carries
// money words or amounts names the pay terms it was worded from (`terms`, payTerms in
// rep-pay-plan.mjs), so a page opened under other terms can drop the promises it worded
// itself. The answers are: /api/earnings (200, and its pay-off 404), /api/referral-list
// with `earnings: true`, a good rep send on /api/referral, and /api/team. A stub 1F on
// localhost stands in for the flow; nothing leaves the machine.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';
import { POST as earningsRoute } from '../pages/api/earnings.ts';
import { POST as listRoute } from '../pages/api/referral-list.ts';
import { POST as sendRoute } from '../pages/api/referral.ts';
import { POST as teamRoute } from '../pages/api/team.ts';
import { clearFlowCache } from './flow-cache.mjs';
import { NO_PLAN_TERMS, PAY_TERMS_EVENT } from './rep-pay-plan.mjs';

let n = 0;
const freshIp = () => `10.88.${Math.floor(n / 250)}.${(n++ % 250) + 1}`;
const key = () => `RepTerms_${String(n).padStart(6, '0')}${'t'.repeat(24)}`;

const REP_LOOKUP = { role: 'Rep', repName: 'TEST Rep', repEmail: 'test.rep@example.com', services: ['HealthFirst'], isManager: true };
const REF = { id: 'A', doctor: 'TEST Office Manager', practice: 'TEST North Side Dental', created: '2026-11-01', cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-04' }] };
const ROW = { referralId: 'A', practiceName: 'TEST North Side Dental', event: 'Reached', payeeRole: 'Rep', amount: 50, earnedOn: '2026-11-04', status: 'Waiting' };
const TEAM = {
  team: [{ signedUp: true, name: 'Test Rep', email: 'test.member@example.com', role: 'AE', registeredOn: '2026-11-02', referrals: [REF], rows: [ROW] }],
  managerRows: [],
};

let server;
const ENV = ['FIELD_FLOW_URL', 'REP_APP_ENABLED', 'REP_PAY_ENABLED', 'REP_PAY_PLAN', 'REP_PAY_PLAN_STAFFING', 'REP_APP_COMPANIES', 'FLOW_CACHE_SECONDS'];
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));

before(async () => {
  server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    const answer = {
      lookup: REP_LOOKUP,
      list: { referrals: [REF] },
      earnings: { rows: [ROW] },
      submit: { ok: true },
      team: TEAM,
    }[body.action];
    res.writeHead(answer ? 200 : 400, { 'content-type': 'application/json' });
    res.end(JSON.stringify(answer ?? {}));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.FIELD_FLOW_URL = `http://127.0.0.1:${server.address().port}/flow`;
});
after(async () => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  await new Promise((r) => server.close(r));
});

const call = async (route, path, body) => {
  const res = await route(/** @type {any} */ ({
    request: new Request(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    clientAddress: freshIp(),
  }));
  return { status: res.status, body: await res.json() };
};
const good = { contactName: 'TEST Office Manager', practiceName: 'TEST North Side Dental', jde: '001234', officePhone: '303-555-0100', email: '', preferredContact: 'Text', notes: '', permission: true };
const send = () => call(sendRoute, '/api/referral', { app: 'rep', company: 'HealthFirst', referralKey: key(), submissionId: crypto.randomUUID(), ...good });
const earn = () => call(earningsRoute, '/api/earnings', { referralKey: key() });
const track = () => call(listRoute, '/api/referral-list', { referralKey: key(), feed: true, earnings: true });
const team = () => call(teamRoute, '/api/team', { referralKey: key() });

/** Each setting, and the terms every answer must name under it. */
const SETTINGS = [
  ['pay off', { REP_PAY_ENABLED: 'false', REP_PAY_PLAN: 'signed:150' }, ''],
  ['pay on, a good plan', { REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'signed:150,manager:50' }, 'signed:150,manager:50'],
  ['pay on, the default plan', { REP_PAY_ENABLED: 'true', REP_PAY_PLAN: undefined }, 'reached:50,signed:100,manager:50'],
  ['pay on, a bad plan', { REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'signed:lots' }, NO_PLAN_TERMS],
  // Slice S5: a staffing plan that words promises is part of the terms, so a page worded
  // under another staffing plan drops its promises too. Unset or bad adds nothing.
  [
    'pay on, a staffing plan',
    { REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'reached:100,manager:50', REP_PAY_PLAN_STAFFING: 'reached_private:100,reached_group:200,manager:50' },
    'reached:100,manager:50;staffing=reached_private:100,reached_group:200,manager:50',
  ],
  ['pay on, a bad staffing plan', { REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'reached:100,manager:50', REP_PAY_PLAN_STAFFING: 'reached_private:100' }, 'reached:100,manager:50'],
  ['pay off, a staffing plan', { REP_PAY_ENABLED: 'false', REP_PAY_PLAN_STAFFING: 'reached_private:100,reached_group:200,manager:50' }, ''],
];

describe('every answer with money words names its pay terms', { concurrency: false }, () => {
  beforeEach(() => {
    clearFlowCache();
    process.env.REP_APP_ENABLED = 'true';
    delete process.env.REP_APP_COMPANIES;
    delete process.env.REP_PAY_PLAN_STAFFING;
  });

  for (const [label, vars, terms] of SETTINGS) {
    test(label, async () => {
      for (const [k, v] of Object.entries(vars)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      const quiet = console.error;
      console.error = () => {};
      try {
        const s = await send();
        assert.equal(s.status, 200);
        assert.equal(s.body.terms, terms, 'a good send, pay on or off (Codex P1 4560155144)');

        const e = await earn();
        assert.equal(e.status, terms === '' ? 404 : 200);
        assert.equal(e.body.terms, terms, '/api/earnings, its pay-off 404 included');

        const t = await track();
        assert.equal(t.status, 200);
        assert.equal(t.body.terms, terms, '/api/referral-list with earnings: true');
        if (terms !== '') assert.equal(t.body.money.terms, terms, 'and the money inside it');

        const m = await team();
        assert.equal(m.status, 200);
        assert.equal(m.body.terms, terms, '/api/team (Codex P1 4560155151)');
        // The team answer's own promise is worded from the same terms.
        if (terms === '') assert.equal('own' in m.body, false);
      } finally {
        console.error = quiet;
      }
    });
  }

  test('a list read that asks for no money is unchanged: no terms', async () => {
    process.env.REP_PAY_ENABLED = 'true';
    delete process.env.REP_PAY_PLAN;
    const plain = await call(listRoute, '/api/referral-list', { referralKey: key() });
    assert.equal(plain.status, 200);
    assert.equal('terms' in plain.body, false);
    const feed = await call(listRoute, '/api/referral-list', { referralKey: key(), feed: true });
    assert.equal('terms' in feed.body, false);
  });
});

describe('the page acts on the terms of every one of those answers', () => {
  const rep = readFileSync(new URL('../components/RepReferral.astro', import.meta.url), 'utf8');
  const script = rep.slice(rep.indexOf('<script>'));
  const team = readFileSync(new URL('../components/MyTeam.astro', import.meta.url), 'utf8');

  test('earnings, including a refusal; the list; a send; and My Team, through one check', () => {
    assert.match(script, /noteTerms\(\(\(await res\.json\(\)\.catch\(\(\) => null\)\) as \{ terms\?: unknown \} \| null\)\?\.terms\);\s*throw new Error\('earnings'\);/, 'an earnings refusal');
    assert.match(script, /const list = await res\.json\(\);\s*noteTerms\(list\?\.terms\);/, 'the Track list');
    assert.match(script, /if \(m\) noteTerms\(m\.terms\);/, 'every installed money answer');
    assert.match(script, /noteTerms\(body\.terms\);\s*showSent\(repReceipt/, 'a send');
    assert.match(script, /document\.addEventListener\(PAY_TERMS_EVENT, \(e\) => noteTerms\(\(e as CustomEvent\)\.detail\)\);/, 'My Team, by event');
    assert.equal(PAY_TERMS_EVENT, 'hsbs:pay-terms');
    assert.match(team, /if \(body && typeof body\.terms === 'string'\) document\.dispatchEvent\(new CustomEvent\('hsbs:pay-terms', \{ detail: body\.terms \}\)\);/, 'My Team hands every answer on');
  });
});
