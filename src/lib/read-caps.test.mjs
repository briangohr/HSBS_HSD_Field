// FT-1b (11/22/2026): 1F read the Team Roster at Top 200 (team) and 500 (lookup) with
// pagination off, and its three SPIFF Ledger reads at Top 5000 with pagination off. Each
// stopped there with no error, so the site's 200-member guard could never fire and a
// ledger past 5,000 rows would have shown less money than earned. 1F now pages every one
// to 5,001 (one over the limit, as in FT-1), and the site fails any read over its limit.
// These are site tests against a fake 1F: they prove the guards, not 1F's own reads.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { clearFlowCache } from './flow-cache.mjs';
import { LEDGER_READ_MAX, ReferralAppWriteError, TEAM_MAX_MEMBERS, listEarnings, listTeam } from './field-flow.mjs';
import { shapeTeam } from './rep-team.mjs';

const TODAY = '2026-11-20';
const failed = (err) => err instanceof ReferralAppWriteError && err.status === 200;
const row = (i, role = 'Rep') => ({ referralId: `L${i}`, event: 'Signed', payeeRole: role, amount: 0, earnedOn: '2026-11-16', status: 'Void' });
const rows = (n, role) => Array.from({ length: n }, (_, i) => row(i, role));
const unsigned = (n) => Array.from({ length: n }, (_, i) => ({ signedUp: false, name: `TEST Rep${i}` }));

describe('1F team and ledger read bounds', () => {
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
  const KEY = `caps_${'k'.repeat(30)}`;

  test(`a team of ${TEAM_MAX_MEMBERS} reads; ${TEAM_MAX_MEMBERS + 1} is a failed read, never a team cut short`, async () => {
    await flow({ team: unsigned(TEAM_MAX_MEMBERS), managerRows: [] });
    assert.equal((await listTeam(KEY)).team.length, TEAM_MAX_MEMBERS);
    await new Promise((r) => { server.closeAllConnections?.(); server.close(r); });
    await flow({ team: unsigned(TEAM_MAX_MEMBERS + 1), managerRows: [] });
    await assert.rejects(listTeam(KEY), failed);
  });

  test(`${LEDGER_READ_MAX} manager ledger rows read; ${LEDGER_READ_MAX + 1} is a failed read`, async () => {
    await flow({ team: unsigned(1), managerRows: rows(LEDGER_READ_MAX, 'Manager') });
    assert.equal((await listTeam(KEY)).managerRows.length, LEDGER_READ_MAX);
    await new Promise((r) => { server.closeAllConnections?.(); server.close(r); });
    await flow({ team: unsigned(1), managerRows: rows(LEDGER_READ_MAX + 1, 'Manager') });
    await assert.rejects(listTeam(KEY), failed);
  });

  test(`${LEDGER_READ_MAX} earnings rows read; ${LEDGER_READ_MAX + 1} is a failed read, never earnings cut short`, async () => {
    await flow({ rows: rows(LEDGER_READ_MAX) });
    assert.equal((await listEarnings(KEY)).length, LEDGER_READ_MAX);
    await new Promise((r) => { server.closeAllConnections?.(); server.close(r); });
    await flow({ rows: rows(LEDGER_READ_MAX + 1) });
    await assert.rejects(listEarnings(KEY), failed);
  });
});

describe('My Team ledger bounds when shaped directly', () => {
  const member = (n) => ({ signedUp: true, name: 'Test Rep', registeredOn: '2026-11-01', referrals: [], rows: rows(n) });

  test(`a member with ${LEDGER_READ_MAX} ledger rows shapes; ${LEDGER_READ_MAX + 1} is a failed load`, () => {
    assert.equal(shapeTeam({ team: [member(LEDGER_READ_MAX)], managerRows: [] }, null, TODAY).team.length, 1);
    assert.throws(() => shapeTeam({ team: [member(LEDGER_READ_MAX + 1)], managerRows: [] }, null, TODAY), failed);
  });

  test(`more than ${LEDGER_READ_MAX} manager rows is a failed load with pay on`, () => {
    const team = [member(0)];
    assert.doesNotThrow(() => shapeTeam({ team, managerRows: rows(LEDGER_READ_MAX, 'Manager') }, null, TODAY, { pay: true }));
    assert.throws(() => shapeTeam({ team, managerRows: rows(LEDGER_READ_MAX + 1, 'Manager') }, null, TODAY, { pay: true }), failed);
  });
});
