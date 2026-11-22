// FT-4 (11/22/2026): 1F read Service Cases once per referral, one after another, so a rep
// with 207 referrals took about two minutes and every Track, Earnings and My Team read
// timed out. 1F now reads a rep's cases once and sends them beside the referrals as
// `cases`, each line naming its `referralId`; the site puts each line back on its
// referral (attachCases). These tests pin that join: every line lands on its own
// referral, totals do not move, and anything that could drop a line is a failed read.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { clearFlowCache } from './flow-cache.mjs';
import { CASE_READ_MAX, ReferralAppWriteError, attachCases, listReferrals, listTeam } from './field-flow.mjs';
import { decorateReferrals } from './track.mjs';

const failed = (err) => err instanceof ReferralAppWriteError && err.status === 200;
const ref = (id, extra = {}) => ({ id, title: `HSBS-F${id}`, practice: `TEST Practice ${id}`, created: '2026-11-20T15:00:00Z', ...extra });
const line = (referralId, extra = {}) => ({ referralId, company: 'HealthFirst', partnerStatus: '', ...extra });

describe('attachCases', () => {
  test('no top-level cases is the older shape, returned as is', () => {
    const refs = [ref(1, { cases: [line(1)] })];
    assert.equal(attachCases(refs, undefined), refs);
  });

  test('each line lands on its own referral; a referral with none gets an empty list', () => {
    const out = attachCases([ref(1), ref(2), ref(3)], [line(2, { company: 'Direct Dental' }), line(1), line(2)]);
    assert.deepEqual(out.map((r) => r.cases.length), [1, 2, 0]);
    assert.equal(out[1].cases[0].company, 'Direct Dental');
  });

  test('a number id matches a text id', () => {
    const out = attachCases([ref('7')], [line(7)]);
    assert.equal(out[0].cases.length, 1);
  });

  test('a line for no referral in the answer is a failed read, never a dropped line', () => {
    assert.throws(() => attachCases([ref(1)], [line(1), line(99)]), failed);
    assert.throws(() => attachCases([ref(1)], [{ company: 'HealthFirst' }]), failed);
    assert.throws(() => attachCases([ref(1)], [null]), failed);
  });

  test('cases that are not a list are a failed read', () => {
    assert.throws(() => attachCases([ref(1)], { value: [] }), failed);
    assert.throws(() => attachCases([ref(1)], null), failed);
  });

  test(`${CASE_READ_MAX} lines read; ${CASE_READ_MAX + 1} is a failed read`, () => {
    const many = (n) => Array.from({ length: n }, () => line(1));
    assert.equal(attachCases([ref(1)], many(CASE_READ_MAX))[0].cases.length, CASE_READ_MAX);
    assert.throws(() => attachCases([ref(1)], many(CASE_READ_MAX + 1)), failed);
  });

  test('reached comes from a line the partner marked talked to doctor, unless 1F sent it', () => {
    const out = attachCases(
      [ref(1), ref(2), ref(3, { reached: false })],
      [line(1, { talkedToDoctor: 'Yes' }), line(2, { talkedToDoctor: 'No' }), line(3, { talkedToDoctor: 'Yes' })],
      { reached: true },
    );
    assert.deepEqual(out.map((r) => r.reached), [true, false, false]);
    assert.equal(attachCases([ref(1)], [line(1, { talkedToDoctor: 'Yes' })])[0].reached, undefined);
  });

  test('the same Track totals as lines sent on each referral', () => {
    const lines = {
      1: [line(1, { partnerStatus: 'Signed' })],
      2: [line(2, { partnerStatus: 'Working' })],
      3: [line(3, { partnerStatus: 'Closed', closedReason: 'Not interested' })],
      4: [],
    };
    const nested = [1, 2, 3, 4].map((id) => ref(id, { cases: lines[id] }));
    const flat = attachCases([1, 2, 3, 4].map((id) => ref(id)), Object.values(lines).flat());
    const a = decorateReferrals(nested, '2026-11-22');
    const b = decorateReferrals(flat, '2026-11-22');
    assert.deepEqual(b, a);
    assert.deepEqual(a.counts, { sent: 4, inProgress: 2, signed: 1, closed: 1 });
  });
});

describe('list and team answers in the FT-4 shape', () => {
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
  const flow = (value) =>
    new Promise((resolve) => {
      server = createServer(async (req, res) => {
        for await (const _ of req);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(value));
      });
      server.listen(0, '127.0.0.1', () => {
        process.env.FIELD_FLOW_URL = `http://127.0.0.1:${server.address().port}/flow`;
        resolve();
      });
    });
  const KEY = `join_${'k'.repeat(30)}`;

  test('list puts every line back on its referral', async () => {
    await flow({ referrals: [ref(10), ref(11)], cases: [line(11), line(10), line(11)] });
    const out = await listReferrals(KEY);
    assert.deepEqual(out.map((r) => r.cases.length), [1, 2]);
  });

  test('list with a stray line is a failed read', async () => {
    await flow({ referrals: [ref(10)], cases: [line(12)] });
    await assert.rejects(listReferrals(KEY), failed);
  });

  test("team puts each member's lines back and works out reached; unsigned members pass through", async () => {
    await flow({
      team: [
        { signedUp: true, name: 'TEST Rep A', referrals: [ref(20), ref(21)], cases: [line(20, { talkedToDoctor: 'Yes' })], rows: [] },
        { signedUp: false, name: 'TEST Rep B' },
      ],
      managerRows: [],
    });
    const { team } = await listTeam(KEY);
    assert.equal(team[0].cases, undefined);
    assert.deepEqual(team[0].referrals.map((r) => [r.cases.length, r.reached]), [[1, true], [0, false]]);
    assert.deepEqual(team[1], { signedUp: false, name: 'TEST Rep B' });
  });

  test("a team member's stray line, or lines with no referrals list, is a failed read", async () => {
    await flow({ team: [{ signedUp: true, name: 'TEST Rep A', referrals: [ref(20)], cases: [line(30)], rows: [] }], managerRows: [] });
    await assert.rejects(listTeam(KEY), failed);
    await new Promise((r) => { server.closeAllConnections?.(); server.close(r); });
    await flow({ team: [{ signedUp: true, name: 'TEST Rep A', cases: [], rows: [] }], managerRows: [] });
    await assert.rejects(listTeam(KEY), failed);
  });
});
