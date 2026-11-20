// The "Ask a DPT rep to join you" form (src/lib/rep-dpt-form.mjs) and its send through
// /api/referral. A stub flow on localhost stands in for HSBS 1F; nothing leaves the machine.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  DPT_CONSENT,
  DPT_KEY,
  DPT_NAME,
  DPT_NO_TIME,
  DPT_SITUATIONS,
  dptFlowPayload,
  dptReceipt,
  dptSendLabel,
  validateDptReferral,
} from './rep-dpt-form.mjs';
import { checkSendCompany, keyForSolutions, sendTab } from './rep-companies.mjs';

const good = {
  contactName: 'TEST Dr. Smith',
  practiceName: 'TEST North Side Dental',
  officePhone: '303-555-0100',
  jde: '001234',
  practiceSituation: 'Selling or retiring',
  joinWhen: 'Tue 12/2, 10 AM',
  notes: 'TEST wants to retire in 2 years',
  permission: true,
};
const meta = { referralKey: 'k'.repeat(30), submissionId: '00000000-0000-4000-8000-000000000000' };

describe('DPT ask form', () => {
  test('the company is DPT, named Dental Practice Transition, and stored as that Solutions value', () => {
    assert.equal(DPT_KEY, 'DPT');
    assert.equal(DPT_NAME, 'Dental Practice Transition');
    assert.equal(keyForSolutions('Dental Practice Transition'), 'DPT');
  });

  test('a good ask passes; JDE and the visit time are optional', () => {
    assert.deepEqual(validateDptReferral(good), { ok: true, errors: [] });
    assert.equal(validateDptReferral({ ...good, jde: '', joinWhen: '' }).ok, true);
  });

  test('each missing or bad field is refused, with its field named', () => {
    const fieldsOf = (input) => validateDptReferral(input).errors.map((e) => e.field);
    assert.deepEqual(fieldsOf({}), ['contactName', 'practiceName', 'officePhone', 'practiceSituation', 'permission']);
    assert.deepEqual(fieldsOf({ ...good, jde: '12a' }), ['jde']);
    assert.deepEqual(fieldsOf({ ...good, practiceSituation: 'selling or retiring' }), ['practiceSituation']);
    assert.deepEqual(fieldsOf({ ...good, permission: 'yes' }), ['permission']);
    assert.deepEqual(fieldsOf({ ...good, joinWhen: 'x'.repeat(201) }), ['joinWhen']);
    assert.deepEqual(fieldsOf({ ...good, notes: 'x'.repeat(2001) }), ['notes']);
  });

  test('the button says what is missing, then "Ask Dental Practice Transition"', () => {
    assert.equal(dptSendLabel({}), "Enter the doctor's name");
    assert.equal(dptSendLabel({ ...good, practiceSituation: '' }), 'Pick what the doctor is thinking about');
    assert.equal(dptSendLabel({ ...good, permission: false }), "Check the doctor's OK");
    assert.equal(dptSendLabel(good), 'Ask Dental Practice Transition');
  });

  test('the 1F body uses only fields 1F maps today, with every fixed value set here', () => {
    const b = dptFlowPayload({ ...good, referralKey: 'evil', source: 'PVA app', companies: ['HealthFirst'] }, meta);
    assert.deepEqual(b, {
      action: 'submit',
      referralKey: meta.referralKey,
      submissionId: meta.submissionId,
      leadType: 'Practice owner',
      doctorName: 'TEST Dr. Smith',
      practiceName: 'TEST North Side Dental',
      officePhone: '303-555-0100',
      doctorCell: '',
      doctorEmail: '',
      jde: '001234',
      companies: ['Dental Practice Transition'],
      needs: ['Practice transition'],
      PVApermission: true,
      contactFirst: true,
      contactInstructions: 'Join me: Tue 12/2, 10 AM',
      practiceSituation: 'Selling or retiring',
      preferredContact: '',
      consentText: DPT_CONSENT,
      notes: 'TEST wants to retire in 2 years',
      route: 'Partner',
      referrerRole: 'Rep',
      source: 'Rep app',
      status: 'Received',
    });
    // No name, email or role for the rep: 1F reads those from the Rep Roster row.
    for (const k of ['repName', 'repEmail', 'role']) assert.equal(k in b, false);
  });

  test('no visit time asks the DPT rep to call and set one', () => {
    assert.equal(dptFlowPayload({ ...good, joinWhen: '  ' }, meta).contactInstructions, DPT_NO_TIME);
  });

  test('every situation is a plain stored value, and the copy has no em dash or arrow', () => {
    assert.equal(DPT_SITUATIONS.length, 4);
    const copy = [DPT_CONSENT, DPT_NO_TIME, ...DPT_SITUATIONS, ...Object.values(dptReceipt({ contactName: 'TEST Dr. Smith' }))].join(' ');
    assert.doesNotMatch(copy, /[—–←-⇿]/);
    assert.doesNotMatch(copy, /HSPA|HSRA|NumbersIQ/);
  });

  test('the receipt never promises money', () => {
    assert.deepEqual(dptReceipt({ contactName: 'TEST Dr. Smith' }), {
      title: 'Sent to Dental Practice Transition',
      calls: 'A Dental Practice Transition rep will call you first to plan a visit with TEST Dr. Smith.',
      money: '',
    });
  });

  test('off unless REP_APP_COMPANIES lists DPT; with it, the Send tab offers the choice', () => {
    assert.equal(checkSendCompany('DPT', 'HealthFirst,Staffing').ok, false);
    assert.deepEqual(checkSendCompany('DPT', 'HealthFirst,Staffing,DPT'), { ok: true, key: 'DPT' });
    assert.deepEqual(sendTab('HealthFirst,Staffing,DPT'), { keys: ['HealthFirst', 'Staffing', 'DPT'], choice: true, classic: false });
    assert.deepEqual(sendTab('HealthFirst,Staffing').keys, ['HealthFirst', 'Staffing']);
  });
});

// The send, end to end through /api/referral.
let keySeq = 0;
const nextKey = () => `RepDpt_${String(keySeq++).padStart(6, '0')}${'d'.repeat(26)}`;
let ipSeq = 0;
const freshIp = () => `10.78.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;
let server;
const bodies = [];
const saved = {};
const ENV = ['FIELD_FLOW_URL', 'REP_APP_ENABLED', 'REP_APP_COMPANIES'];

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

describe('/api/referral, rep app: the DPT ask', { concurrency: false }, () => {
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

  test('switched on, a good ask posts the DPT body once', async () => {
    process.env.REP_APP_COMPANIES = 'HealthFirst,Staffing,DPT';
    const res = await post({ company: 'DPT' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(submits().length, 1);
    const b = submits()[0];
    assert.deepEqual(b.companies, ['Dental Practice Transition']);
    assert.equal(b.contactFirst, true);
    assert.equal(b.practiceSituation, 'Selling or retiring');
    assert.equal(b.contactInstructions, 'Join me: Tue 12/2, 10 AM');
  });

  test('switched off (today\'s setting), a DPT ask is refused before any 1F call', async () => {
    process.env.REP_APP_COMPANIES = 'HealthFirst,Staffing';
    const res = await post({ company: 'DPT' });
    assert.equal(res.status, 403);
    assert.equal(submits().length, 0);
  });

  test('a bad ask is refused with 422 and nothing is sent', async () => {
    process.env.REP_APP_COMPANIES = 'HealthFirst,Staffing,DPT';
    const res = await post({ company: 'DPT', practiceSituation: 'Retiring soon', permission: false });
    assert.equal(res.status, 422);
    assert.deepEqual(res.body.errors.map((e) => e.field), ['practiceSituation', 'permission']);
    assert.equal(submits().length, 0);
  });
});
