// The 7F client and the save route's logic, counted at a fake 7F on localhost. Success is
// only 200 {"ok":true,"saved":n}; a 202, a non-JSON 200, a redirect or a 5xx is no clear
// answer. With the page off, or a bad key, nothing is posted. (Sheet PU, piece A.)
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { PartnerFlowError, listLeads, partnerPageEnabled, readLead, saveUpdates, sortLeads } from './partner-flow.mjs';
import { partnerSave } from './partner-save.mjs';

const KEY = 'ab'.repeat(20);
const SID = '11111111-1111-4111-8111-111111111111';
const UPDATE = { id: 36, choice: 'meeting', talkedToDoctor: 'Yes', meetingDate: '2026-11-24', signedDate: '', signedProduct: '', closedReason: '', note: '' };
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
