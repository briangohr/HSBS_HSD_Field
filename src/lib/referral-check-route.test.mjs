// /api/referral-check (duplicate warning before Send, Brian 11/21/2026). It reads the rep's
// own 1F list, answers a warning or none, and writes nothing. A failed read never stops a
// send: it answers no warning. A stub flow on localhost stands in for 1F; nothing leaves
// the machine.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';

let keySeq = 0;
const nextKey = () => `RepChk_${String(keySeq++).padStart(6, '0')}${'c'.repeat(26)}`;
let ipSeq = 0;
const freshIp = () => `10.78.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;

const REP = { role: 'Rep', repName: 'TEST Rep', repEmail: 'test.rep@henryschein.com', services: ['HealthFirst'] };
const OPEN = {
  id: 7,
  title: 'HSBS-F70',
  doctor: 'TEST Office Manager',
  practice: 'TEST North Side Dental',
  created: '2026-11-18T15:00:00Z',
  jde: '009999',
  cases: [{ company: 'HealthFirst', partnerStatus: 'Trying to reach' }],
};

let server;
const bodies = [];
const saved = {};
const ENV = ['FIELD_FLOW_URL', 'REP_APP_ENABLED', 'FLOW_CACHE_SECONDS'];
/** @type {{ lookup: [number, unknown], list: [number, unknown] }} */
let answers;

before(async () => {
  for (const k of ENV) saved[k] = process.env[k];
  server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    bodies.push(body);
    const [status, out] = answers[body.action] ?? [400, {}];
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.FIELD_FLOW_URL = `http://127.0.0.1:${server.address().port}/flow`;
  process.env.REP_APP_ENABLED = 'true';
});
after(async () => {
  for (const k of ENV) {
    if (saved[k] == null) delete process.env[k];
    else process.env[k] = saved[k];
  }
  await new Promise((r) => server.close(r));
});
beforeEach(() => {
  bodies.length = 0;
  process.env.REP_APP_ENABLED = 'true';
  answers = { lookup: [200, REP], list: [200, { referrals: [OPEN] }] };
});

async function check(body, key = nextKey()) {
  const { POST } = await import('../pages/api/referral-check.ts');
  const res = await POST(
    /** @type {any} */ ({
      request: new Request('http://localhost/api/referral-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ referralKey: key, company: 'HealthFirst', ...body }),
      }),
      clientAddress: freshIp(),
    }),
  );
  return { status: res.status, body: await res.json() };
}

describe('/api/referral-check', { concurrency: false }, () => {
  test('an open referral for the same office and company answers a warning; nothing is written', async () => {
    const res = await check({ practiceName: 'test north side dental' });
    assert.equal(res.status, 200);
    assert.match(res.body.warning, /^You already sent TEST North Side Dental to HealthFirst on Nov 18, and it is still open\./);
    assert.deepEqual(Object.keys(res.body), ['warning']);
    assert.ok(!JSON.stringify(res.body).includes('009999'), 'no JDE in the answer');
    assert.deepEqual([...new Set(bodies.map((b) => b.action))].sort(), ['list', 'lookup']);
    for (const b of bodies) assert.deepEqual(Object.keys(b).sort(), b.action === 'lookup' ? ['action', 'activate', 'referralKey'] : ['action', 'referralKey']);
  });

  test('a JDE on the list row matches; another office answers no warning', async () => {
    assert.match((await check({ practiceName: 'TEST Renamed Dental', jde: '009999' })).body.warning, /TEST North Side Dental/);
    assert.deepEqual(await check({ practiceName: 'TEST South Side Dental', jde: '001111' }), { status: 200, body: { warning: '' } });
  });

  test('a key the lookup refuses, or a role that is not Rep, is 404 and shows nothing', async () => {
    answers.lookup = [404, {}];
    assert.equal((await check({ practiceName: 'TEST North Side Dental' })).status, 404);
    answers.lookup = [200, { ...REP, role: 'Partner' }];
    const res = await check({ practiceName: 'TEST North Side Dental' });
    assert.equal(res.status, 404);
    assert.equal(res.body.warning, undefined);
  });

  test('a failed list or lookup answers no warning, so the send goes on', async () => {
    answers.list = [500, {}];
    assert.deepEqual(await check({ practiceName: 'TEST North Side Dental' }), { status: 200, body: { warning: '' } });
    answers = { lookup: [500, {}], list: [200, { referrals: [OPEN] }] };
    assert.deepEqual(await check({ practiceName: 'TEST North Side Dental' }), { status: 200, body: { warning: '' } });
  });

  test('a bad key is 404 before any flow call; the switch off is 404', async () => {
    assert.equal((await check({ practiceName: 'x' }, 'short')).status, 404);
    assert.equal(bodies.length, 0);
    process.env.REP_APP_ENABLED = 'false';
    assert.equal((await check({ practiceName: 'TEST North Side Dental' })).status, 404);
    assert.equal(bodies.length, 0);
  });
});
