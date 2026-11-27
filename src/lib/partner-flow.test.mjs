// The 7F client and the save route's logic, counted at a fake 7F on localhost. Success is
// only 200 {"ok":true,"saved":n}; a 202, a non-JSON 200, a redirect or a 5xx is no clear
// answer. With the page off, or a bad key, nothing is posted. (Sheet PU, piece A.)
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { PartnerFlowError, dealValueEnabled, listLeads, officeCheckEnabled, parkedEnabled, partnerPageEnabled, readLead, saveUpdates, sortLeads } from './partner-flow.mjs';
import { partnerSave } from './partner-save.mjs';

const KEY = 'ab'.repeat(20);
const SID = '11111111-1111-4111-8111-111111111111';
const UPDATE = { id: 36, choice: 'meeting', talkedToDoctor: 'Yes', meetingDate: '2026-11-24', signedDate: '', signedProduct: '', closedReason: '', note: '', offices: '' };
const LEAD = {
  id: 36,
  ref: 'HSBS-F90',
  practice: 'TEST North Side Dental',
  contact: 'TEST Office Manager',
  company: 'HealthFirst',
  introducedOn: '2026-11-19',
  status: '',
  talkedToDoctor: '',
  meetingDate: '',
  nextUpdateDue: '2026-11-23',
  missedUpdates: 0,
  askOffices: false,
};

let server;
let posts;
let reply;
beforeEach(async () => {
  posts = [];
  reply = () => [200, '{"ok":true,"saved":1}'];
  server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    posts.push(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
    const [status, value, headers = {}] = reply();
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(typeof value === 'string' ? value : JSON.stringify(value));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.PARTNER_FLOW_URL = `http://127.0.0.1:${server.address().port}/flow`;
  process.env.REP_APP_ENABLED = 'true';
  process.env.PARTNER_PAGE_ENABLED = 'true';
});
afterEach(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  delete process.env.PARTNER_FLOW_URL;
  delete process.env.REP_APP_ENABLED;
  delete process.env.PARTNER_PAGE_ENABLED;
  delete process.env.PARTNER_OFFICE_CHECK;
});

const kind = (k) => (err) => err instanceof PartnerFlowError && err.kind === k;

describe('switches', () => {
  test('both switches must be exactly true', () => {
    assert.equal(partnerPageEnabled(), true);
    process.env.PARTNER_PAGE_ENABLED = 'TRUE';
    assert.equal(partnerPageEnabled(), false);
    process.env.PARTNER_PAGE_ENABLED = 'true';
    process.env.REP_APP_ENABLED = 'false';
    assert.equal(partnerPageEnabled(), false);
  });
  test('off or a bad key posts nothing', async () => {
    process.env.PARTNER_PAGE_ENABLED = 'false';
    await assert.rejects(listLeads(KEY), kind('unknown'));
    process.env.PARTNER_PAGE_ENABLED = 'true';
    await assert.rejects(listLeads('short'), kind('unknown'));
    await assert.rejects(saveUpdates(`RepTest_${'r'.repeat(32)}`, SID, [UPDATE]), kind('unknown'));
    assert.equal(posts.length, 0);
  });
  test('a non-https flow URL is a config error, before any post', async () => {
    process.env.PARTNER_FLOW_URL = 'http://example.com/flow';
    await assert.rejects(listLeads(KEY), kind('config'));
    process.env.PARTNER_FLOW_URL = 'https://user:pw@example.com/flow';
    await assert.rejects(listLeads(KEY), kind('config'));
    assert.equal(posts.length, 0);
  });
});

describe('leads', () => {
  test('posts the contract body and keeps only display fields', async () => {
    reply = () => [200, { partner: 'HealthFirst', leads: [{ ...LEAD, doctorPhone: '303-555-0100', repEmail: 'rep@example.com', jde: '001234' }] }];
    const answer = await listLeads(KEY);
    assert.deepEqual(posts, [{ action: 'leads', key: KEY }]);
    assert.deepEqual(answer, { partner: 'HealthFirst', leads: [LEAD] });
  });
  test('drops a lead with a bad id or ref, overdue first then by due date', () => {
    assert.equal(readLead({ ...LEAD, id: '36' }), null);
    assert.equal(readLead({ ...LEAD, ref: 'TEST-1' }), null);
    assert.equal(readLead({ ...LEAD, ref: 'HSBS-A238' })?.ref, 'HSBS-A238');
    const a = readLead({ ...LEAD, id: 1, ref: 'HSBS-F1', nextUpdateDue: '2026-11-21' });
    const b = readLead({ ...LEAD, id: 2, ref: 'HSBS-F2', nextUpdateDue: '2026-11-25', missedUpdates: 1 });
    const c = readLead({ ...LEAD, id: 3, ref: 'HSBS-F3', nextUpdateDue: '' });
    assert.deepEqual(sortLeads([c, a, b]).map((l) => l.id), [2, 1, 3]);
  });
  test('404 is unknown, 410 expired, a busy flow failed', async () => {
    reply = () => [404, ''];
    await assert.rejects(listLeads(KEY), kind('unknown'));
    reply = () => [410, ''];
    await assert.rejects(listLeads(KEY), kind('expired'));
    for (const status of [202, 302, 408, 429, 500]) {
      reply = () => [status, { partner: 'x', leads: [] }, status === 302 ? { location: 'https://example.com' } : {}];
      await assert.rejects(listLeads(KEY), kind('failed'), String(status));
    }
    reply = () => [200, 'not json'];
    await assert.rejects(listLeads(KEY), kind('failed'));
    reply = () => [200, { partner: 'x' }];
    await assert.rejects(listLeads(KEY), kind('failed'));
  });
});

describe('save', () => {
  test('success is only 200 ok true with a count', async () => {
    reply = () => [200, { ok: true, saved: 1 }];
    assert.equal(await saveUpdates(KEY, SID, [UPDATE]), 1);
    assert.deepEqual(posts[0], { action: 'save', key: KEY, submissionId: SID, updates: [UPDATE] });
    for (const answer of [{ ok: true }, { ok: 'true', saved: 1 }, { saved: 1 }, 'ok']) {
      reply = () => [200, answer];
      await assert.rejects(saveUpdates(KEY, SID, [UPDATE]), kind('failed'), JSON.stringify(answer));
    }
    reply = () => [202, { ok: true, saved: 1 }];
    await assert.rejects(saveUpdates(KEY, SID, [UPDATE]), kind('failed'));
  });
  test('saved 0 or below the count is an answer; above the count breaks the contract', async () => {
    const two = [UPDATE, { ...UPDATE, id: 37 }];
    reply = () => [200, { ok: true, saved: 0 }];
    assert.equal(await saveUpdates(KEY, SID, two), 0);
    reply = () => [200, { ok: true, saved: 1 }];
    assert.equal(await saveUpdates(KEY, SID, two), 1);
    reply = () => [200, { ok: true, saved: 3 }];
    await assert.rejects(saveUpdates(KEY, SID, two), kind('failed'));
    reply = () => [200, { ok: true, saved: 2 }];
    await assert.rejects(saveUpdates(KEY, SID, [UPDATE]), kind('failed'));
  });
  test('422 carries reload or bad_value and the lead id', async () => {
    reply = () => [422, { error: 'reload', id: 36 }];
    await assert.rejects(saveUpdates(KEY, SID, [UPDATE]), (e) => kind('reload')(e) && e.id === 36);
    reply = () => [422, { error: 'bad_value', id: 36 }];
    await assert.rejects(saveUpdates(KEY, SID, [UPDATE]), (e) => kind('bad_value')(e) && e.id === 36);
    reply = () => [422, 'junk'];
    await assert.rejects(saveUpdates(KEY, SID, [UPDATE]), (e) => kind('bad_value')(e) && e.id === null);
  });
});

describe('partnerSave (the save route)', () => {
  test('checks before posting: bad key, bad id, no updates, a bad answer', async () => {
    assert.equal((await partnerSave({ key: 'x', submissionId: SID, updates: [UPDATE] })).status, 404);
    assert.equal((await partnerSave({ key: KEY, submissionId: 'x', updates: [UPDATE] })).status, 400);
    assert.equal((await partnerSave({ key: KEY, submissionId: SID, updates: [] })).status, 400);
    const refused = await partnerSave({ key: KEY, submissionId: SID, updates: [{ ...UPDATE, meetingDate: '' }] });
    assert.deepEqual(refused, { status: 422, body: { error: 'bad_value', id: 36, field: 'meetingDate' } });
    assert.equal(posts.length, 0);
  });
  test('a resend after midnight still reaches 7F (its tag check finds the earlier write)', async () => {
    reply = () => [200, { ok: true, saved: 1 }];
    const resent = await partnerSave({ key: KEY, submissionId: SID, updates: [{ ...UPDATE, meetingDate: '2000-01-01' }] });
    assert.equal(resent.status, 200);
    assert.equal(posts.length, 1);
  });
  test('sends only the cleaned updates and words the answers', async () => {
    reply = () => [200, { ok: true, saved: 1 }];
    const done = await partnerSave({ key: KEY, submissionId: SID, updates: [{ ...UPDATE, repEmail: 'x@y.z', signedDate: '2026-11-01' }] });
    assert.deepEqual(done, { status: 200, body: { ok: true, saved: 1, sent: 1, partial: false, message: 'Saved 1 update.' } });
    assert.deepEqual(posts[0].updates, [UPDATE]);
    reply = () => [404, ''];
    assert.equal((await partnerSave({ key: KEY, submissionId: SID, updates: [UPDATE] })).status, 404);
    reply = () => [410, ''];
    assert.equal((await partnerSave({ key: KEY, submissionId: SID, updates: [UPDATE] })).status, 410);
    reply = () => [422, { error: 'reload', id: 36 }];
    assert.deepEqual(await partnerSave({ key: KEY, submissionId: SID, updates: [UPDATE] }), {
      status: 422,
      body: { error: 'reload', id: 36, field: '' },
    });
    reply = () => [503, ''];
    const unclear = await partnerSave({ key: KEY, submissionId: SID, updates: [UPDATE] });
    assert.equal(unclear.status, 502);
    assert.equal(unclear.body.error, 'timeout');
  });
  test('a partial or zero save says so; more saved than sent is no clear answer', async () => {
    const two = [UPDATE, { ...UPDATE, id: 37 }];
    reply = () => [200, { ok: true, saved: 1 }];
    assert.deepEqual(await partnerSave({ key: KEY, submissionId: SID, updates: two }), {
      status: 200,
      body: {
        ok: true,
        saved: 1,
        sent: 2,
        partial: true,
        message: 'Saved 1 of 2 updates. 1 lead closed or changed while you worked and did not save. The list below is current.',
      },
    });
    reply = () => [200, { ok: true, saved: 0 }];
    assert.deepEqual(await partnerSave({ key: KEY, submissionId: SID, updates: two }), {
      status: 200,
      body: { ok: true, saved: 0, sent: 2, partial: true, message: 'Nothing saved. These 2 leads closed or changed while you worked. The list below is current.' },
    });
    reply = () => [200, { ok: true, saved: 3 }];
    const over = await partnerSave({ key: KEY, submissionId: SID, updates: two });
    assert.equal(over.status, 502);
    assert.equal(over.body.error, 'timeout');
    assert.equal(over.body.ok, undefined);
  });
});

describe('office count check (Brian, 11/22/2026)', () => {
  // The page sends no Talked To Doctor (that marks an old page); the route fills it in.
  const GROUP = { ...UPDATE, choice: 'qualified', talkedToDoctor: 'Yes', meetingDate: '', offices: 'yes' };
  const SENT = { ...GROUP, talkedToDoctor: '' };
  test('the switch is off unless exactly true, and needs the page switch', () => {
    assert.equal(officeCheckEnabled(), false);
    process.env.PARTNER_OFFICE_CHECK = 'TRUE';
    assert.equal(officeCheckEnabled(), false);
    process.env.PARTNER_OFFICE_CHECK = 'true';
    assert.equal(officeCheckEnabled(), true);
    process.env.PARTNER_PAGE_ENABLED = 'false';
    assert.equal(officeCheckEnabled(), false);
  });
  test('askOffices is true only when 7F says exactly true and the switch is on', async () => {
    assert.equal(readLead({ ...LEAD, askOffices: true })?.askOffices, false);
    process.env.PARTNER_OFFICE_CHECK = 'true';
    assert.equal(readLead({ ...LEAD, askOffices: true })?.askOffices, true);
    for (const v of ['true', 1, 'yes', null, undefined]) assert.equal(readLead({ ...LEAD, askOffices: v })?.askOffices, false, String(v));
    reply = () => [200, { partner: 'TEST Direct Dental', leads: [{ ...LEAD, askOffices: true }] }];
    assert.equal((await listLeads(KEY)).leads[0].askOffices, true);
  });
  test('switch on: the answer reaches 7F', async () => {
    process.env.PARTNER_OFFICE_CHECK = 'true';
    reply = () => [200, { ok: true, saved: 1 }];
    assert.equal((await partnerSave({ key: KEY, submissionId: SID, updates: [SENT] })).status, 200);
    assert.deepEqual(posts[0].updates, [GROUP]);
  });
  test('switch off: the answer is blanked, so no lead earns the group amount', async () => {
    reply = () => [200, { ok: true, saved: 1 }];
    assert.equal((await partnerSave({ key: KEY, submissionId: SID, updates: [SENT] })).status, 200);
    assert.deepEqual(posts[0].updates, [{ ...GROUP, offices: '' }]);
  });
  test('a bad answer is refused before any post', async () => {
    process.env.PARTNER_OFFICE_CHECK = 'true';
    for (const offices of ['maybe', 'YES', true, 3]) {
      const refused = await partnerSave({ key: KEY, submissionId: SID, updates: [{ ...SENT, offices }] });
      assert.deepEqual(refused, { status: 422, body: { error: 'bad_value', id: 36, field: 'offices' } }, String(offices));
    }
    assert.equal(posts.length, 0);
  });
});

describe('Year 1 deal value (Brian, 11/25/2026)', () => {
  const SENT = { ...UPDATE, choice: 'proposal', talkedToDoctor: '', meetingDate: '', dealValue: '25000' };
  const off = () => delete process.env.PARTNER_DEAL_VALUE_ENABLED;
  afterEach(off);
  test('the switch is off unless exactly true, and needs the page switch', () => {
    assert.equal(dealValueEnabled(), false);
    process.env.PARTNER_DEAL_VALUE_ENABLED = 'TRUE';
    assert.equal(dealValueEnabled(), false);
    process.env.PARTNER_DEAL_VALUE_ENABLED = 'true';
    assert.equal(dealValueEnabled(), true);
    process.env.PARTNER_PAGE_ENABLED = 'false';
    assert.equal(dealValueEnabled(), false);
  });
  test('switch off: the lead is exactly as before, dealValue dropped', async () => {
    reply = () => [200, { partner: 'HealthFirst', leads: [{ ...LEAD, dealValue: '25000' }] }];
    assert.deepEqual((await listLeads(KEY)).leads, [LEAD]);
  });
  test('switch on: the stored value is read as digits, anything else blank', async () => {
    process.env.PARTNER_DEAL_VALUE_ENABLED = 'true';
    reply = () => [200, { partner: 'HealthFirst', leads: [{ ...LEAD, dealValue: '25000' }] }];
    assert.deepEqual((await listLeads(KEY)).leads, [{ ...LEAD, dealValue: '25000' }]);
    for (const [v, want] of [['', ''], [undefined, ''], [null, ''], [40000, '40000'], ['12.5', ''], ['abc', ''], ['10000000', ''], [-1, '']]) {
      assert.equal(readLead({ ...LEAD, dealValue: v })?.dealValue, want, String(v));
    }
  });
  test('switch off: a sent dealValue is ignored and the 7F body matches main', async () => {
    reply = () => [200, { ok: true, saved: 1 }];
    for (const dealValue of ['25000', 'junk']) {
      posts.length = 0;
      assert.equal((await partnerSave({ key: KEY, submissionId: SID, updates: [{ ...SENT, dealValue }] })).status, 200);
      assert.deepEqual(posts[0].updates, [{ ...UPDATE, choice: 'proposal', meetingDate: '' }]);
      assert.equal('dealValue' in posts[0].updates[0], false);
    }
  });
  test('switch on: the value reaches 7F; blank and an old page send blank', async () => {
    process.env.PARTNER_DEAL_VALUE_ENABLED = 'true';
    reply = () => [200, { ok: true, saved: 1 }];
    await partnerSave({ key: KEY, submissionId: SID, updates: [SENT] });
    assert.deepEqual(posts[0].updates, [{ ...UPDATE, choice: 'proposal', meetingDate: '', dealValue: '25000' }]);
    const { dealValue: _none, ...oldPage } = SENT;
    await partnerSave({ key: KEY, submissionId: SID, updates: [oldPage] });
    assert.equal(posts[1].updates[0].dealValue, '');
    await partnerSave({ key: KEY, submissionId: SID, updates: [{ ...SENT, choice: 'trying' }] });
    assert.equal(posts[2].updates[0].dealValue, '');
  });
  test('switch on: bad input is refused before any post', async () => {
    process.env.PARTNER_DEAL_VALUE_ENABLED = 'true';
    for (const dealValue of ['10000000', '25.5', 'abc', '$25,000']) {
      const refused = await partnerSave({ key: KEY, submissionId: SID, updates: [{ ...SENT, dealValue }] });
      assert.deepEqual(refused, { status: 422, body: { error: 'bad_value', id: 36, field: 'dealValue' } }, dealValue);
    }
    assert.equal(posts.length, 0);
  });
});

describe('Parked (Brian, 11/26/2026)', () => {
  const PARK = { ...UPDATE, choice: 'parked', talkedToDoctor: '', meetingDate: '', parkDate: '2026-12-15', parkReason: 'Remodel', parkedBy: 'TEST Jane' };
  const off = () => delete process.env.PARTNER_PARKED_ENABLED;
  afterEach(off);
  test('the switch is off unless exactly true, and needs the page switch', () => {
    assert.equal(parkedEnabled(), false);
    process.env.PARTNER_PARKED_ENABLED = 'TRUE';
    assert.equal(parkedEnabled(), false);
    process.env.PARTNER_PARKED_ENABLED = 'true';
    assert.equal(parkedEnabled(), true);
    process.env.PARTNER_PAGE_ENABLED = 'false';
    assert.equal(parkedEnabled(), false);
  });
  test('switch off: the lead is exactly as before, parkedUntil dropped', async () => {
    reply = () => [200, { partner: 'HealthFirst', leads: [{ ...LEAD, parkedUntil: '2026-12-15' }] }];
    assert.deepEqual((await listLeads(KEY)).leads, [LEAD]);
  });
  test('switch on: parkedUntil is a date or blank', async () => {
    process.env.PARTNER_PARKED_ENABLED = 'true';
    reply = () => [200, { partner: 'HealthFirst', leads: [{ ...LEAD, parkedUntil: '2026-12-15' }] }];
    assert.deepEqual((await listLeads(KEY)).leads, [{ ...LEAD, parkedUntil: '2026-12-15' }]);
    for (const [v, want] of [['', ''], [undefined, ''], [null, ''], ['2026-02-30', ''], ['soon', ''], [20261215, '']]) {
      assert.equal(readLead({ ...LEAD, parkedUntil: v })?.parkedUntil, want, String(v));
    }
  });
  test('switch off: a park is refused before any post, and other bodies match main', async () => {
    for (const choice of ['parked', 'unpark']) {
      const refused = await partnerSave({ key: KEY, submissionId: SID, updates: [{ ...PARK, choice }] });
      assert.deepEqual(refused, { status: 422, body: { error: 'bad_value', id: 36, field: 'choice' } }, choice);
    }
    assert.equal(posts.length, 0);
    reply = () => [200, { ok: true, saved: 1 }];
    const done = await partnerSave({ key: KEY, submissionId: SID, updates: [{ ...PARK, choice: 'proposal' }] });
    assert.equal(done.status, 200);
    assert.equal('parkNoDate' in done.body, false);
    assert.deepEqual(posts[0].updates, [{ ...UPDATE, choice: 'proposal', meetingDate: '' }]);
  });
  test('switch on: the park fields reach 7F, blank on other choices', async () => {
    process.env.PARTNER_PARKED_ENABLED = 'true';
    reply = () => [200, { ok: true, saved: 2 }];
    const done = await partnerSave({ key: KEY, submissionId: SID, updates: [PARK, { ...PARK, id: 37, choice: 'unpark' }] });
    assert.equal(done.status, 200);
    assert.equal(done.body.parkNoDate, 0);
    assert.deepEqual(posts[0].updates, [
      { ...UPDATE, choice: 'parked', talkedToDoctor: '', meetingDate: '', parkDate: '2026-12-15', parkReason: 'Remodel', parkedBy: 'TEST Jane' },
      { ...UPDATE, id: 37, choice: 'unpark', talkedToDoctor: '', meetingDate: '', parkDate: '', parkReason: '', parkedBy: '' },
    ]);
  });
  test('switch on: a park with no date is posted and the answer says Saved as Closed Lost', async () => {
    process.env.PARTNER_PARKED_ENABLED = 'true';
    reply = () => [200, { ok: true, saved: 1 }];
    const done = await partnerSave({ key: KEY, submissionId: SID, updates: [{ ...PARK, parkDate: '' }] });
    assert.equal(done.status, 200);
    assert.equal(done.body.parkNoDate, 1);
    assert.equal(done.body.message, 'Saved 1 update. Saved as Closed Lost, no revisit date.');
    assert.equal(posts[0].updates[0].parkDate, '');
  });
  test('switch on: a park missing reason or who is refused before any post (E21)', async () => {
    process.env.PARTNER_PARKED_ENABLED = 'true';
    for (const [more, field] of [[{ parkReason: '' }, 'parkReason'], [{ parkedBy: '' }, 'parkedBy'], [{ parkReason: '', parkedBy: '', parkDate: '' }, 'parkReasonBy']]) {
      const refused = await partnerSave({ key: KEY, submissionId: SID, updates: [{ ...PARK, ...more }] });
      assert.deepEqual(refused, { status: 422, body: { error: 'bad_value', id: 36, field } }, field);
    }
    assert.equal(posts.length, 0);
  });
});
