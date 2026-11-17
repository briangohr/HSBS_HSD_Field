// /api/referral with app "rep" (field two-track spec, section 4 "Send"): a new send must
// name exactly one company that REP_APP_COMPANIES switches on and that has a form. A
// refused request never reaches HSBS 1F, so no row is made. A stub flow on localhost
// stands in for 1F; nothing leaves the machine.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';

// A fresh key per request, so the per-key limit (30) never answers in place of the rule.
let keySeq = 0;
const nextKey = () => `RepCo_${String(keySeq++).padStart(6, '0')}${'c'.repeat(26)}`;
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

let server;
const bodies = [];
const saved = {};
const ENV = ['FIELD_FLOW_URL', 'REP_APP_ENABLED', 'REP_APP_COMPANIES'];
let ipSeq = 0;
const freshIp = () => `10.77.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;

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
});

async function post(body) {
  const { POST } = await import('../pages/api/referral.ts');
  const res = await POST(
    /** @type {any} */ ({
      request: new Request('http://localhost/api/referral', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app: 'rep', referralKey: nextKey(), submissionId: crypto.randomUUID(), ...good, ...body }),
      }),
      clientAddress: freshIp(),
    }),
  );
  return { status: res.status, body: await res.json() };
}
const submits = () => bodies.filter((b) => b.action === 'submit');

const STAFFING = { company: 'Staffing', practiceType: 'Private practice', permission: true };

describe('/api/referral, rep app: the staffing send (S3)', { concurrency: false }, () => {
  test('switched on, a good send posts the staffing body: needs Staffing, one company, practice type, the consent on screen', async () => {
    process.env.REP_APP_COMPANIES = 'HealthFirst,Staffing';
    const { STAFFING_CONSENT } = await import('./rep-staffing-form.mjs');
    const res = await post(STAFFING);
    // The answer names the pay terms (none here: pay is off), staffing's too.
    assert.deepEqual(res, { status: 200, body: { ok: true, terms: '', staffingTerms: '' } });
    assert.equal(submits().length, 1);
    const b = submits()[0];
    assert.deepEqual(b.needs, ['Staffing']);
    assert.deepEqual(b.companies, ['HS Staffing / Recruiting Services (including GoTu)']);
    assert.equal(b.practiceType, 'Private practice');
    assert.equal(b.consentText, STAFFING_CONSENT);
    assert.equal(b.consentText, 'The customer gave permission for Direct Dental to contact them about staffing.*');
    assert.equal(b.route, 'Partner');
    assert.equal(b.referrerRole, 'Rep');
    assert.equal(b.source, 'Rep app');
    assert.equal('company' in b, false);
    assert.equal(/OSHA|HealthFirst/.test(JSON.stringify(b)), false);
  });

  test('with pay on and a staffing plan, a staffing send names the staffing terms; a HealthFirst send does not', async () => {
    process.env.REP_APP_COMPANIES = 'HealthFirst,Staffing';
    const saved = [process.env.REP_PAY_ENABLED, process.env.REP_PAY_PLAN_STAFFING];
    process.env.REP_PAY_ENABLED = 'true';
    process.env.REP_PAY_PLAN_STAFFING = 'reached_private:100,reached_group:200,manager:50';
    try {
      const st = await post(STAFFING);
      assert.equal(st.body.staffingTerms, '100,200');
      assert.equal('staffingTerms' in (await post({ company: 'HealthFirst' })).body, false);
      process.env.REP_PAY_PLAN_STAFFING = 'junk';
      assert.equal((await post(STAFFING)).body.staffingTerms, '');
    } finally {
      for (const [i, k] of ['REP_PAY_ENABLED', 'REP_PAY_PLAN_STAFFING'].entries()) {
        if (saved[i] == null) delete process.env[k];
        else process.env[k] = saved[i];
      }
    }
  });

  test('Group is accepted; any other practice type or none is refused with no row', async () => {
    process.env.REP_APP_COMPANIES = 'Staffing';
    assert.equal((await post({ ...STAFFING, practiceType: 'Group' })).status, 200);
    assert.equal(submits()[0].practiceType, 'Group');
    for (const practiceType of [undefined, '', 'group', 'Group (3 or more locations)', 'Solo', 1]) {
      const res = await post({ ...STAFFING, practiceType });
      assert.ok([400, 422].includes(res.status), String(practiceType));
    }
    assert.equal(submits().length, 1);
  });

  test('an unticked box is refused with no row', async () => {
    process.env.REP_APP_COMPANIES = 'Staffing';
    const res = await post({ ...STAFFING, permission: false });
    assert.equal(res.status, 422);
    assert.equal(res.body.errors[0].field, 'permission');
    assert.equal(submits().length, 0);
  });

  test('a HealthFirst send never carries a practice type', async () => {
    process.env.REP_APP_COMPANIES = 'HealthFirst,Staffing';
    await post({ company: 'HealthFirst', practiceType: 'Group' });
    assert.equal('practiceType' in submits()[0], false);
    assert.deepEqual(submits()[0].needs, ['OSHA and HIPAA compliance']);
  });
});

describe('/api/referral, rep app: one referral, one company', { concurrency: false }, () => {
  test('HealthFirst named, switch unset: sent, with the same 1F body as main', async () => {
    const res = await post({ company: 'HealthFirst' });
    assert.deepEqual(res, { status: 200, body: { ok: true, terms: '' } });
    assert.equal(submits().length, 1);
    const b = submits()[0];
    assert.deepEqual(b.companies, ['HealthFirst']);
    assert.deepEqual(b.needs, ['OSHA and HIPAA compliance']);
    // The company key is checked by the site, never forwarded.
    assert.equal('company' in b, false);
  });

  test('HealthFirst named, both switched on: sent', async () => {
    process.env.REP_APP_COMPANIES = 'HealthFirst,Staffing';
    assert.equal((await post({ company: 'HealthFirst' })).status, 200);
    assert.equal(submits().length, 1);
  });

  test('no company named: refused, nothing sent', async () => {
    for (const raw of [undefined, 'HealthFirst,Staffing']) {
      if (raw) process.env.REP_APP_COMPANIES = raw;
      for (const extra of [{}, { company: '' }, { company: [] }]) {
        const res = await post(extra);
        assert.equal(res.status, 409, JSON.stringify(extra));
        assert.equal(res.body.error, 'This page is out of date. Reload it, then send again.');
      }
    }
    assert.equal(submits().length, 0);
  });

  test('both companies named: refused, nothing sent, even with both switched on', async () => {
    process.env.REP_APP_COMPANIES = 'HealthFirst,Staffing';
    for (const extra of [
      { company: ['HealthFirst', 'Staffing'] },
      { company: ['HealthFirst', 'HealthFirst'] },
      { company: 'HealthFirst', companies: ['HealthFirst', 'HS Staffing / Recruiting Services (including GoTu)'] },
      { company: 'HealthFirst', companies: ['HealthFirst'] },
      { companies: ['HealthFirst', 'Staffing'] },
    ]) {
      const res = await post(extra);
      assert.equal(res.status, 400, JSON.stringify(extra));
      assert.equal(res.body.error, 'Pick one company for this referral.');
    }
    assert.equal(submits().length, 0);
  });

  test('a company that is off: refused, nothing sent', async () => {
    process.env.REP_APP_COMPANIES = 'Staffing';
    const hf = await post({ company: 'HealthFirst' });
    assert.deepEqual(hf, { status: 403, body: { error: 'Referrals to this company are not open right now.' } });
    delete process.env.REP_APP_COMPANIES;
    const st = await post({ company: 'Staffing' });
    assert.equal(st.status, 403);
    assert.equal(submits().length, 0);
  });

  test('staffing is refused while it is not switched on, whatever else is posted', async () => {
    for (const raw of [undefined, 'HealthFirst', 'junk']) {
      if (raw) process.env.REP_APP_COMPANIES = raw;
      else delete process.env.REP_APP_COMPANIES;
      const res = await post({ company: 'Staffing', practiceType: 'Group', needs: ['Staffing'] });
      assert.equal(res.status, 403, String(raw));
    }
    assert.equal(submits().length, 0);
  });

  test('unknown, misspelled or non-string companies are refused', async () => {
    process.env.REP_APP_COMPANIES = 'HealthFirst,Staffing';
    for (const company of ['Unitas', 'healthfirst', 'Direct Dental', 'HS Staffing / Recruiting Services (including GoTu)']) {
      assert.equal((await post({ company })).status, 403, company);
    }
    for (const company of [1, true, { key: 'HealthFirst' }, [null]]) {
      assert.equal((await post({ company })).status, 400, JSON.stringify(company));
    }
    assert.equal(submits().length, 0);
  });

  test('junk in REP_APP_COMPANIES: unknown keys dropped, HealthFirst still sends', async () => {
    for (const raw of ['', '  ', 'Unitas', 'HealthFirst,Unitas', ' healthfirst ', ',,HealthFirst,,', 'nonsense;;']) {
      process.env.REP_APP_COMPANIES = raw;
      assert.equal((await post({ company: 'HealthFirst' })).status, 200, JSON.stringify(raw));
    }
    assert.equal(submits().length, 7);
  });

  test('a company refusal comes before the field checks: an empty staffing send is 403, not 422', async () => {
    delete process.env.REP_APP_COMPANIES;
    const res = await post({ company: 'Staffing', contactName: '', jde: '', permission: false });
    assert.equal(res.status, 403);
    assert.equal(submits().length, 0);
  });

  test('with REP_APP_ENABLED off nothing changes: a rep send is 404 before any company check', async () => {
    process.env.REP_APP_ENABLED = 'false';
    try {
      assert.equal((await post({ company: 'HealthFirst' })).status, 404);
      assert.equal((await post({})).status, 404);
    } finally {
      process.env.REP_APP_ENABLED = 'true';
    }
    assert.equal(submits().length, 0);
  });
});

describe('no-JavaScript rep submit picks the company from the posted form', () => {
  test('one company field is a string; two are a list, so the send is refused', async () => {
    const { pickRepFields } = await import('./rep-submit.ts');
    const one = new FormData();
    one.append('company', 'HealthFirst');
    assert.equal(pickRepFields((k) => one.get(k), (k) => one.getAll(k)).company, 'HealthFirst');
    const two = new FormData();
    two.append('company', 'HealthFirst');
    two.append('company', 'Staffing');
    assert.deepEqual(pickRepFields((k) => two.get(k), (k) => two.getAll(k)).company, ['HealthFirst', 'Staffing']);
    const none = new FormData();
    assert.equal('company' in pickRepFields((k) => none.get(k), (k) => none.getAll(k)), false);
    const listed = new FormData();
    listed.append('company', 'HealthFirst');
    listed.append('companies', 'HealthFirst');
    assert.deepEqual(pickRepFields((k) => listed.get(k), (k) => listed.getAll(k)).companies, ['HealthFirst']);
  });
});
