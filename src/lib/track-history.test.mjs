// Track past 200 referrals (field MVP plan R5, FT5). Before this, every reader sliced 1F's list
// to 200 BEFORE sorting, so a rep with 201 saw a Sent count of 200, and if 1F answered oldest
// first (SharePoint's default order) the newest referral was the one dropped. Now the count is
// the true total, the newest is always kept, and a list too big to read is a failed load,
// never a short one.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { POST as listRoute } from '../pages/api/referral-list.ts';
import { clearFlowCache } from './flow-cache.mjs';
import { REFERRAL_READ_MAX, ReferralAppWriteError, listReferrals } from './field-flow.mjs';
import { decorateReferrals } from './track.mjs';
import { leadViews } from './rep-lead.mjs';
import { repFeed } from './rep-track.mjs';
import { moneyForReferrals } from './rep-earnings.mjs';
import { shapeTeam } from './rep-team.mjs';

const TODAY = '2026-11-20';
/** n referrals, oldest first, the way SharePoint answers with no Order By. The last is the newest. */
const oldestFirst = (n) =>
  Array.from({ length: n }, (_, i) => ({
    // Recent enough that no stale line crowds the feed.
    id: `R${i + 1}`,
    doctorName: 'TEST Doctor',
    practiceName: `TEST Office ${i + 1}`,
    sentOn: i === n - 1 ? '2026-11-19' : '2026-11-15',
    route: 'Partner',
    lines: [{ company: 'HealthFirst', status: '', updatedOn: '' }],
    history: [{ on: i === n - 1 ? '2026-11-19' : '2026-11-15', text: 'Sent to HealthFirst' }],
  }));

describe('Track past 200 referrals', () => {
  test('201 referrals: Sent is 201 and the newest is listed first', () => {
    const list = oldestFirst(201);
    const d = decorateReferrals(list, TODAY);
    assert.equal(d.counts.sent, 201);
    assert.equal(d.referrals[0].id, 'R201');
    const leads = leadViews(list, TODAY);
    assert.equal(leads.length, 201);
    assert.equal(leads[0].id, 'R201');
  });

  test('the feed and the money lines include the newest referral', () => {
    const list = oldestFirst(250);
    assert.ok(repFeed(list, TODAY).some((f) => f.referralId === 'R250'));
    assert.ok('R250' in moneyForReferrals(list, [], TODAY, null).lines);
  });

  test('My Team: a member with 250 referrals counts 250', () => {
    const member = { signedUp: true, name: 'Test Rep', registeredOn: '2026-11-01', referrals: oldestFirst(250), rows: [] };
    const out = shapeTeam({ team: [member], managerRows: [] }, null, TODAY);
    assert.equal(out.tiles.referrals, 250);
    assert.equal(out.team[0].cards.length, 250);
  });

  test(`My Team: a member with more than ${REFERRAL_READ_MAX} referrals is a failed load`, () => {
    const many = Array.from({ length: REFERRAL_READ_MAX + 1 }, (_, i) => ({ id: `R${i}` }));
    const member = { signedUp: true, name: 'Test Rep', registeredOn: '2026-11-01', referrals: many, rows: [] };
    assert.throws(() => shapeTeam({ team: [member], managerRows: [] }, null, TODAY), (err) => err instanceof ReferralAppWriteError && err.status === 200);
  });
});

// FT-1 (11/22/2026): 1F read Top Count 100 on its case reads with pagination off. Live 1F runs
// them once per referral, so that cap is per referral, but the totals must still hold past
// 100 case lines in all. This is a site test: it fakes 1F's answer, so it proves the totals
// logic past 100 lines, not 1F's own read. The live proof uses the Test Fieldsite rep.
/** n referrals, newest first, each with one case line: the first `signed` are Signed. */
const withCases = (n, signed) =>
  Array.from({ length: n }, (_, i) => ({
    id: `C${n - i}`,
    practiceName: `TEST Office ${n - i}`,
    sentOn: '2026-11-15',
    route: 'Partner',
    lines: [{ company: 'HealthFirst', status: i < signed ? 'Signed' : 'Trying to reach', updatedOn: '2026-11-16' }],
  }));

describe('Track past 100 case lines', () => {
  test('110 case lines: In progress and Signed are the true totals', () => {
    const d = decorateReferrals(withCases(110, 40), TODAY);
    assert.deepEqual(d.counts, { sent: 110, inProgress: 70, signed: 40, closed: 0 });
  });

  test('a referral with two lines past line 100 still reads both', () => {
    const list = withCases(105, 0);
    list[104].lines.push({ company: 'HS Staffing / Recruiting Services (including GoTu)', status: 'Signed', updatedOn: '2026-11-17' });
    const d = decorateReferrals(list, TODAY);
    assert.equal(d.counts.signed, 1);
    assert.equal(d.counts.inProgress, 104);
  });

  test('My Team: a member with 110 case lines counts every one', () => {
    const member = { signedUp: true, name: 'Test Rep', registeredOn: '2026-11-01', referrals: withCases(110, 40), rows: [] };
    const out = shapeTeam({ team: [member], managerRows: [] }, null, TODAY);
    assert.equal(out.tiles.referrals, 110);
    assert.equal(out.tiles.signed, 40);
  });
});

describe('1F list read bounds', () => {
  const ENV = ['FIELD_FLOW_URL', 'REP_APP_ENABLED'];
  const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  let server;
  beforeEach(() => {
    process.env.REP_APP_ENABLED = 'true';
  });
  afterEach(async () => {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    clearFlowCache();
    if (server) await new Promise((r) => { server.closeAllConnections?.(); server.close(r); });
    server = null;
  });
  const flow = (reply) =>
    new Promise((resolve) => {
      server = createServer(async (req, res) => {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const [status, value] = reply(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(value));
      });
      server.listen(0, '127.0.0.1', () => {
        process.env.FIELD_FLOW_URL = `http://127.0.0.1:${server.address().port}/flow`;
        resolve();
      });
    });
  const KEY = `history_${'k'.repeat(30)}`;

  test('a list over 500 KB still reads (it used to fail to parse)', async () => {
    const list = oldestFirst(1200);
    const padded = list.map((r) => ({ ...r, notes: 'x'.repeat(400) }));
    assert.ok(JSON.stringify({ referrals: padded }).length > 500_000);
    await flow(() => [200, { referrals: padded }]);
    assert.equal((await listReferrals(KEY)).length, 1200);
  });

  test(`more than ${REFERRAL_READ_MAX} referrals is a failed read, never a short list`, async () => {
    const tiny = Array.from({ length: REFERRAL_READ_MAX + 1 }, (_, i) => ({ id: `R${i}` }));
    await flow(() => [200, { referrals: tiny }]);
    await assert.rejects(listReferrals(KEY), (err) => err instanceof ReferralAppWriteError && err.status === 200);
  });

  test('the Track route answers the true total and every lead, newest first', async () => {
    process.env.REP_APP_ENABLED = 'true';
    const list = oldestFirst(201);
    await flow((body) => {
      if (body.action === 'list') return [200, { referrals: list }];
      if (body.action === 'lookup') return [200, { role: 'Rep', repName: 'TEST Rep', repEmail: 'test.rep@example.com', services: ['HealthFirst'], isManager: false }];
      return [400, {}];
    });
    const res = await listRoute(/** @type {any} */ ({
      request: new Request('http://localhost/api/referral-list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referralKey: KEY, feed: true }) }),
      clientAddress: '10.9.0.1',
    }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.counts.sent, 201);
    assert.equal(body.leads.length, 201);
    assert.equal(body.leads[0].id, 'R201');
  });
});
