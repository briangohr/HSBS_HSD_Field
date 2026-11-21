// /api/referral with app "rep": what the rep is told when 1F gives no clear answer
// (G2 drift audit, top finding). A 5xx, 408, 429, a 200 without ok or a dropped
// connection may have saved the row, so the answer must never say "did not send".
// A stub flow on localhost stands in for 1F; nothing leaves the machine.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';
import { UNCLEAR_MESSAGE } from './field-form.mjs';

let keySeq = 0;
const nextKey = () => `RepUn_${String(keySeq++).padStart(6, '0')}${'d'.repeat(26)}`;
let ipSeq = 0;
const freshIp = () => `10.78.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;
const good = {
  company: 'HealthFirst',
  contactName: 'TEST Office Manager',
  practiceName: 'TEST North Side Dental',
  jde: '001234',
  officePhone: '303-555-0100',
  email: '',
  preferredContact: 'Text',
  notes: '',
  permission: true,
};

let server;
/** How the stub answers the next submit: a status and body, or 'drop'. */
let answer = { status: 200, body: '{"ok":true}' };
const ENV = ['FIELD_FLOW_URL', 'REP_APP_ENABLED', 'REP_APP_COMPANIES'];
const saved = {};
let flowUrl = '';

before(async () => {
  for (const k of ENV) saved[k] = process.env[k];
  server = createServer(async (req, res) => {
    for await (const _ of req);
    if (answer === 'drop') return req.socket.destroy();
    res.writeHead(answer.status, { 'content-type': 'application/json' });
    res.end(answer.body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  flowUrl = `http://127.0.0.1:${server.address().port}/flow`;
});
after(async () => {
  for (const k of ENV) {
    if (saved[k] == null) delete process.env[k];
    else process.env[k] = saved[k];
  }
  await new Promise((r) => server.close(r));
});
beforeEach(() => {
  process.env.FIELD_FLOW_URL = flowUrl;
  process.env.REP_APP_ENABLED = 'true';
  delete process.env.REP_APP_COMPANIES;
});

async function post() {
  const { POST } = await import('../pages/api/referral.ts');
  const res = await POST(
    /** @type {any} */ ({
      request: new Request('http://localhost/api/referral', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app: 'rep', referralKey: nextKey(), submissionId: crypto.randomUUID(), ...good }),
      }),
      clientAddress: freshIp(),
    }),
  );
  return { status: res.status, body: await res.json() };
}

describe('/api/referral, rep app: no clear answer from 1F', { concurrency: false }, () => {
  for (const status of [500, 502, 503, 408, 429]) {
    test(`1F ${status}: 502 with the "may already have gone through" words`, async () => {
      answer = { status, body: '' };
      const res = await post();
      assert.equal(res.status, 502);
      assert.equal(res.body.error, UNCLEAR_MESSAGE);
      assert.doesNotMatch(res.body.error, /did not send/);
    });
  }

  test('1F 200 without ok: 502 with the same words', async () => {
    answer = { status: 200, body: '{}' };
    const res = await post();
    assert.equal(res.status, 502);
    assert.equal(res.body.error, UNCLEAR_MESSAGE);
  });

  test('a dropped connection: 502 with the same words', async () => {
    answer = 'drop';
    const res = await post();
    assert.equal(res.status, 502);
    assert.equal(res.body.error, UNCLEAR_MESSAGE);
  });

  test('1F refuses the key (403): the link does not work', async () => {
    answer = { status: 403, body: '' };
    const res = await post();
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'This link does not work.');
  });

  test('no flow URL set: nothing was sent, so it says "did not send"', async () => {
    delete process.env.FIELD_FLOW_URL;
    const res = await post();
    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'This referral did not send.');
  });

  test('the words keep the house rules: no em dash, no arrow', () => {
    assert.doesNotMatch(UNCLEAR_MESSAGE, /[—→]/);
  });
});
