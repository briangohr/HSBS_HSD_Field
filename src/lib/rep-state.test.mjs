// REP_ASK_STATE (HealthFirst splits its reps by state): with it on, a HealthFirst send must
// name the practice's state, and 1F gets it as practiceState. With it off, the 1F body is
// exactly today's. Staffing is never asked. A stub flow on localhost stands in for 1F;
// nothing leaves the machine.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';
import { US_STATES, isStateCode, repFlowPayload, repSendLabel, validateRepReferral } from './rep-referral-form.mjs';

let keySeq = 0;
const nextKey = () => `RepSt_${String(keySeq++).padStart(6, '0')}${'s'.repeat(26)}`;
const good = {
  contactName: 'TEST Office Manager',
  practiceName: 'TEST North Side Dental',
  jde: '001234',
  officePhone: '303-555-0100',
  email: '',
  preferredContact: 'Text',
  notes: '',
  permission: true,
};
const META = { referralKey: `Rk_${'a'.repeat(30)}`, submissionId: '11111111-1111-4111-8111-111111111111' };

describe('State on the HealthFirst form (rules)', () => {
  test('the list is the 50 states and DC, two-letter codes, no repeats', () => {
    assert.equal(US_STATES.length, 51);
    assert.equal(new Set(US_STATES.map(([c]) => c)).size, 51);
    assert.ok(US_STATES.every(([c, n]) => /^[A-Z]{2}$/.test(c) && n.length > 2));
    assert.ok(isStateCode('CO') && isStateCode('DC'));
    for (const bad of ['co', 'Colorado', 'XX', '', ' CO', null, 5]) assert.equal(isStateCode(bad), false, String(bad));
  });

  test('off: no state is asked, checked or sent', () => {
    assert.deepEqual(validateRepReferral(good), { ok: true, errors: [] });
    assert.equal(repSendLabel(good), 'Send to HealthFirst');
    const body = repFlowPayload({ ...good, practiceState: 'CO' }, META);
    assert.equal('practiceState' in body, false);
  });

  test('on: the state is required, the button asks for it, and 1F gets the code', () => {
    const on = { askState: true };
    assert.deepEqual(validateRepReferral(good, on).errors.map((e) => e.field), ['practiceState']);
    assert.deepEqual(validateRepReferral({ ...good, practiceState: 'Colorado' }, on).errors.map((e) => e.field), ['practiceState']);
    assert.equal(validateRepReferral({ ...good, practiceState: 'CO' }, on).ok, true);
    assert.equal(repSendLabel({ ...good, jde: '' }, on), 'Pick the state');
    assert.equal(repSendLabel({ ...good, practiceState: 'CO' }, on), 'Send to HealthFirst');
    assert.equal(repFlowPayload({ ...good, practiceState: 'CO' }, META, on).practiceState, 'CO');
  });
});

let server;
const bodies = [];
const saved = {};
const ENV = ['FIELD_FLOW_URL', 'REP_APP_ENABLED', 'REP_APP_COMPANIES', 'REP_ASK_STATE'];
let ipSeq = 0;
const freshIp = () => `10.78.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;

before(async () => {
  for (const k of ENV) saved[k] = process.env[k];
  server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    bodies.push(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
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
  delete process.env.REP_APP_COMPANIES;
  delete process.env.REP_ASK_STATE;
});

async function post(body) {
  const { POST } = await import('../pages/api/referral.ts');
  const res = await POST(
    /** @type {any} */ ({
      request: new Request('http://localhost/api/referral', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app: 'rep', company: 'HealthFirst', referralKey: nextKey(), submissionId: crypto.randomUUID(), ...good, ...body }),
      }),
      clientAddress: freshIp(),
    }),
  );
  return { status: res.status, body: await res.json() };
}
const submits = () => bodies.filter((b) => b.action === 'submit');

describe('/api/referral, rep app: REP_ASK_STATE', { concurrency: false }, () => {
  test('off (unset or not exactly "true"): a send with no state goes through, and a posted state is dropped', async () => {
    for (const value of [undefined, 'TRUE', '1']) {
      bodies.length = 0;
      if (value == null) delete process.env.REP_ASK_STATE;
      else process.env.REP_ASK_STATE = value;
      assert.equal((await post({})).status, 200, String(value));
      assert.equal((await post({ practiceState: 'CO' })).status, 200, String(value));
      assert.equal(submits().length, 2);
      assert.ok(submits().every((b) => !('practiceState' in b)));
    }
  });

  test('on: no state or a bad one is refused before 1F; a good one is sent as practiceState', async () => {
    process.env.REP_ASK_STATE = 'true';
    for (const practiceState of [undefined, '', 'Colorado', 'co', 'XX']) {
      const res = await post({ practiceState });
      assert.equal(res.status, 422, String(practiceState));
      assert.deepEqual(res.body.errors.map((e) => e.field), ['practiceState']);
    }
    assert.equal((await post({ practiceState: 5 })).status, 400);
    assert.equal(submits().length, 0);
    assert.equal((await post({ practiceState: 'TX' })).status, 200);
    assert.equal(submits().length, 1);
    assert.equal(submits()[0].practiceState, 'TX');
  });

  test('on: a staffing send is not asked for a state and never carries one', async () => {
    process.env.REP_ASK_STATE = 'true';
    process.env.REP_APP_COMPANIES = 'HealthFirst,Staffing';
    const res = await post({ company: 'Staffing', practiceType: 'Private practice', practiceState: 'CO' });
    assert.equal(res.status, 200);
    assert.equal('practiceState' in submits()[0], false);
  });
});
