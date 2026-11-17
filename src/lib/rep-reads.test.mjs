// The snapshot read in rep-reads.mjs: a list that fails is reported at once, and the ledger
// only waits for the list when the list worked (Codex #77, round 4). Counted at a fake 1F.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { cachedKeyCount, clearFlowCache } from './flow-cache.mjs';
import { ReferralAppWriteError, ReferralKeyUnknownError } from './field-flow.mjs';
import { LedgerReadError, cachedSnapshot } from './rep-reads.mjs';

const key = (name) => `${name}_${'k'.repeat(30)}`;
const REP_LOOKUP = { role: 'Rep', repName: 'TEST Rep', repEmail: 'test.rep@example.com', services: ['HealthFirst'], isManager: false };

function listen(reply) {
  const posts = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    posts.push(body.action);
    const [status, value] = await reply(body);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(typeof value === 'string' ? value : JSON.stringify(value));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      process.env.FIELD_FLOW_URL = `http://127.0.0.1:${server.address().port}/flow`;
      resolve({ server, posts });
    });
  });
}
const close = ({ server }) =>
  new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(resolve);
  });
const never = () => new Promise(() => {});
/** Rejects if `promise` has not settled within `ms`: the stand-in for "it waited for the ledger's 20 second timeout". */
const within = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`still waiting after ${ms} ms`)), ms))]);

const saved = { url: process.env.FIELD_FLOW_URL, ttl: process.env.FLOW_CACHE_SECONDS, app: process.env.REP_APP_ENABLED };
const unhandled = [];
const onUnhandled = (err) => unhandled.push(err);

describe('cachedSnapshot: the list decides, the ledger is a bonus', { concurrency: false }, () => {
  beforeEach(() => {
    clearFlowCache();
    delete process.env.FLOW_CACHE_SECONDS;
    process.env.REP_APP_ENABLED = 'true'; // the role check accepts a Rep key only with the rep app on
    unhandled.length = 0;
    process.on('unhandledRejection', onUnhandled);
  });
  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    clearFlowCache();
    if (saved.url === undefined) delete process.env.FIELD_FLOW_URL;
    else process.env.FIELD_FLOW_URL = saved.url;
    if (saved.ttl !== undefined) process.env.FLOW_CACHE_SECONDS = saved.ttl;
    if (saved.app === undefined) delete process.env.REP_APP_ENABLED;
    else process.env.REP_APP_ENABLED = saved.app;
  });

  for (const [label, listReply, expected] of [
    ['the flow fails', () => [500, ''], ReferralAppWriteError],
    ['the link is unknown', () => [404, ''], ReferralKeyUnknownError],
  ]) {
    test(`a list that fails at once is thrown at once, even when the ledger never answers (${label})`, async () => {
      const flow = await listen((body) => {
        if (body.action === 'list') return listReply();
        if (body.action === 'earnings') return never(); // the ledger stalls
        if (body.action === 'lookup') return [200, REP_LOOKUP];
        return [400, ''];
      });
      try {
        const started = Date.now();
        await assert.rejects(within(cachedSnapshot(key('RepStall')), 3000), (err) => {
          assert.ok(err instanceof expected, `the list's own error comes back, not "${err.message}"`);
          assert.equal(err instanceof LedgerReadError, false);
          return true;
        });
        assert.ok(Date.now() - started < 3000, 'it did not wait for the ledger');
        assert.equal(cachedKeyCount(), 0, 'nothing of the failed snapshot is held');
        // A later read starts over, and again fails at once.
        await assert.rejects(within(cachedSnapshot(key('RepStall')), 3000));
        assert.equal(cachedKeyCount(), 0);
      } finally {
        await close(flow);
      }
      await new Promise((r) => setTimeout(r, 50)); // let the abandoned ledger request settle
      assert.deepEqual(unhandled, [], 'the abandoned ledger read left no unhandled rejection');
    });
  }

  test('a ledger that fails alone still carries the list (LedgerReadError), and nothing is held', async () => {
    const flow = await listen((body) => {
      if (body.action === 'list') return [200, { referrals: [{ id: 'R1' }] }];
      if (body.action === 'earnings') return [500, ''];
      if (body.action === 'lookup') return [200, REP_LOOKUP];
      return [400, ''];
    });
    try {
      await assert.rejects(within(cachedSnapshot(key('RepLedgerOnly')), 3000), (err) => {
        assert.ok(err instanceof LedgerReadError);
        assert.deepEqual(err.referrals, [{ id: 'R1' }]);
        return true;
      });
      assert.equal(cachedKeyCount(), 0);
    } finally {
      await close(flow);
    }
    assert.deepEqual(unhandled, []);
  });

  test('a ledger that fails before a list that then fails reports the list, with no unhandled rejection', async () => {
    const flow = await listen(async (body) => {
      if (body.action === 'earnings') return [500, ''];
      if (body.action === 'list') {
        await new Promise((r) => setTimeout(r, 40));
        return [500, ''];
      }
      if (body.action === 'lookup') return [200, REP_LOOKUP];
      return [400, ''];
    });
    try {
      await assert.rejects(within(cachedSnapshot(key('RepBoth')), 3000), (err) => err instanceof ReferralAppWriteError);
    } finally {
      await close(flow);
    }
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(unhandled, []);
  });

  test('both reads working holds one snapshot, and the repeat costs no flow run', async () => {
    const flow = await listen((body) => {
      if (body.action === 'list') return [200, { referrals: [] }];
      if (body.action === 'earnings') return [200, { rows: [] }];
      if (body.action === 'lookup') return [200, REP_LOOKUP];
      return [400, ''];
    });
    try {
      const k = key('RepWorks');
      const first = await within(cachedSnapshot(k), 3000);
      assert.deepEqual(first.referrals, []);
      assert.deepEqual(flow.posts.slice().sort(), ['earnings', 'list', 'lookup'], 'cold: list, ledger and role check');
      await cachedSnapshot(k);
      assert.equal(flow.posts.length, 3, 'warm: no flow run');
      assert.equal(cachedKeyCount(), 1);
    } finally {
      await close(flow);
    }
  });
});
