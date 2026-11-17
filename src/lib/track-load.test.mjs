// Track and My Earnings under load (Brian, 11/11). Counted at a fake 1F, so what is proved
// is exactly how many times the site posts to the flow, every post counted:
//   - a COLD Track open (nothing held) is one browser request and up to THREE flow posts,
//     started together: the list, the ledger and the lookup that says whether the key is a
//     Rep's (the answer is held only for a Rep);
//   - a WARM open (inside 45 seconds) is ZERO flow posts;
//   - a key the lookup does not confirm as a Rep is never held.
// Refresh, a send and a pay-off switch behave too.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { POST as earningsRoute } from '../pages/api/earnings.ts';
import { POST as listRoute } from '../pages/api/referral-list.ts';
import { clearFlowCache } from './flow-cache.mjs';
import { submitReferral } from './field-flow.mjs';

let n = 0;
const freshIp = () => `10.7.0.${++n % 250}`;
const key = (name) => `${name}_${'k'.repeat(30)}`;

function listen(reply) {
  const posts = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    posts.push(body);
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

const ENV = ['FIELD_FLOW_URL', 'REP_APP_ENABLED', 'REP_PAY_ENABLED', 'REP_PAY_PLAN', 'FLOW_CACHE_SECONDS'];
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
const restore = () => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
};

const REP_LOOKUP = { role: 'Rep', repName: 'TEST Rep', repEmail: 'test.rep@example.com', services: ['HealthFirst'], isManager: false };
// A lookup answer that is not a Rep Roster row: the field site never holds its reads.
const NOT_REP_LOOKUP = { role: 'Other', repName: 'TEST Other', repEmail: 'test.other@example.com', services: ['HealthFirst'] };

/** A 1F that lists two referrals and an empty ledger, and counts nothing itself. */
const fakeFlow = (overrides = {}) => (body) => {
  if (overrides[body.action]) return overrides[body.action](body);
  if (body.action === 'list') return [200, { referrals: [] }];
  if (body.action === 'earnings') return [200, { rows: [] }];
  if (body.action === 'submit') return [200, { ok: true }];
  if (body.action === 'lookup') return [200, REP_LOOKUP];
  return [400, ''];
};
const actions = (flow) => flow.posts.map((p) => p.action);
/** Every post the site made to the flow counts, the role check (lookup) included. */
const total = (flow) => flow.posts.length;
/** One cold snapshot: the list, the ledger and the role check, started together. */
const COLD = ['earnings', 'list', 'lookup'];
/** A failed list can return before the other two posts are recorded; wait for them before counting. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

const call = async (route, path, body) => {
  const res = await route(/** @type {any} */ ({
    request: new Request(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    clientAddress: freshIp(),
  }));
  return { status: res.status, body: await res.json() };
};
const track = (k, extra = {}) => call(listRoute, '/api/referral-list', { referralKey: k, feed: true, earnings: true, ...extra });
const earn = (k, extra = {}) => call(earningsRoute, '/api/earnings', { referralKey: k, ...extra });

describe('a cold Track open costs up to three flow posts, a warm one costs none', { concurrency: false }, () => {
  beforeEach(() => {
    clearFlowCache();
    process.env.REP_APP_ENABLED = 'true';
    process.env.REP_PAY_ENABLED = 'true';
    process.env.REP_PAY_PLAN = 'signed:150';
    delete process.env.FLOW_CACHE_SECONDS;
  });
  afterEach(restore);

  test('one request with the money inside: three flow posts when cold (list, ledger, role check)', async () => {
    const flow = await listen(fakeFlow());
    try {
      const open = await track(key('RepOne'));
      assert.equal(open.status, 200);
      assert.ok(open.body.money && open.body.money.summary, 'the money came back in the same answer');
      assert.ok(Array.isArray(open.body.feed) && Array.isArray(open.body.leads), 'the feed and leads are still there');
      assert.deepEqual(actions(flow).sort(), COLD);
      assert.equal(total(flow), 3, 'cold total: 3');
    } finally {
      await close(flow);
    }
  });

  test('a second open, and then the Earnings tab, inside the TTL cost no flow run', async () => {
    const flow = await listen(fakeFlow());
    try {
      const k = key('RepTwo');
      const first = await track(k);
      const again = await track(k);
      const tab = await earn(k);
      assert.deepEqual(actions(flow).sort(), COLD, 'the three requests made one cold read');
      assert.equal(total(flow), 3, 'cold total 3, and the two warm requests added 0');
      assert.deepEqual(again.body.money, first.body.money);
      assert.deepEqual(tab.body, first.body.money, 'the Earnings tab shows the same figures');
    } finally {
      await close(flow);
    }
  });

  test('fresh (Refresh, or Track right after a send) reads the flow again', async () => {
    const flow = await listen(fakeFlow());
    try {
      const k = key('RepFresh');
      await track(k);
      assert.equal(total(flow), 3, 'cold: 3');
      await track(k, { fresh: true });
      assert.deepEqual(actions(flow).sort(), [...COLD, ...COLD].sort(), 'fresh is another full read');
      assert.equal(total(flow), 6, 'fresh: 3 more');
      await track(k); // the fresh answer is the one held
      assert.equal(total(flow), 6, 'warm: 0');
      await earn(k, { fresh: true });
      assert.equal(total(flow), 9, 'the Earnings tab can skip the cache too: 3 more');
    } finally {
      await close(flow);
    }
  });

  test('a send clears that rep\'s held answers, so the new referral shows on the next read', async () => {
    let referrals = [];
    const flow = await listen(fakeFlow({ list: () => [200, { referrals }] }));
    try {
      const k = key('RepSend');
      const before = await track(k);
      assert.equal(before.body.leads.length, 0);
      referrals = [{ id: 'R1', practice: 'TEST Dental' }];
      await submitReferral({ action: 'submit', referralKey: k }, 5000, { requireOk: true, role: 'Rep' });
      const posts = total(flow); // includes the send itself
      await track(k);
      assert.deepEqual(actions(flow).slice(posts).sort(), COLD, 'the next read went to the flow');
      assert.equal(total(flow) - posts, 3);
    } finally {
      await close(flow);
    }
  });

  test('REP_APP_ENABLED off: the list route answers 404 and calls no flow', async () => {
    delete process.env.REP_APP_ENABLED;
    delete process.env.REP_PAY_ENABLED;
    const flow = await listen(fakeFlow());
    try {
      const k = key('RepOff');
      for (const body of [{ referralKey: k }, { referralKey: k, feed: true }]) {
        const r = await call(listRoute, '/api/referral-list', body);
        assert.equal(r.status, 404);
      }
      assert.equal(total(flow), 0);
    } finally {
      await close(flow);
    }
  });

  test('one rep\'s answer is never another rep\'s', async () => {
    const flow = await listen(fakeFlow());
    try {
      await track(key('RepAlpha'));
      await track(key('RepBravo'));
      assert.equal(total(flow), 6, 'each rep is its own cold read: 3 and 3');
      assert.deepEqual(new Set(flow.posts.map((p) => p.referralKey)), new Set([key('RepAlpha'), key('RepBravo')]));
    } finally {
      await close(flow);
    }
  });

  test('pay off: the money is not asked for, so a cold open is two flow posts (list, role check) and no ledger run', async () => {
    delete process.env.REP_PAY_ENABLED;
    const flow = await listen(fakeFlow());
    try {
      const open = await track(key('RepNoPay'));
      assert.equal(open.status, 200);
      assert.equal('money' in open.body, false);
      assert.deepEqual(actions(flow).sort(), ['list', 'lookup']);
      assert.equal(total(flow), 2);
      assert.equal((await earn(key('RepNoPay'))).status, 404);
      assert.equal(total(flow), 2, 'and the Earnings route made no post');
    } finally {
      await close(flow);
    }
  });

  test('a failed ledger does not fail the list: money is null, and nothing half-fresh is held', async () => {
    let ledgerUp = false;
    const flow = await listen(fakeFlow({ earnings: () => (ledgerUp ? [200, { rows: [] }] : [500, '']) }));
    try {
      const k = key('RepLedger');
      const down = await track(k);
      assert.equal(down.status, 200);
      assert.equal(down.body.money, null);
      ledgerUp = true;
      const up = await track(k);
      assert.ok(up.body.money && up.body.money.summary, 'the next open asks the ledger again');
      // Down: the ledger failed, so the list that did load is used as it is and nothing is held.
      // Up: a new pair. No list read from one moment is ever paired with a ledger from another.
      assert.deepEqual(actions(flow).sort(), [...COLD, ...COLD].sort(), 'three flow posts each time, the list is never read twice in one open');
      assert.equal(total(flow), 6);
    } finally {
      await close(flow);
    }
  });

  test('a pair that half fails holds nothing: the retry reads both again, from one moment (Codex #77)', async () => {
    let listUp = false;
    const flow = await listen(fakeFlow({ list: () => (listUp ? [200, { referrals: [] }] : [500, '']) }));
    try {
      const k = key('RepHalf');
      assert.equal((await earn(k)).status, 502, 'the list failed, so the route failed');
      listUp = true;
      const retry = await earn(k);
      assert.equal(retry.status, 200);
      await settle();
      // Both reads happened twice. The ledger from the failed try was not kept to pair with the new list.
      assert.deepEqual(actions(flow).sort(), [...COLD, ...COLD].sort());
      assert.equal(total(flow), 6, '3 for the failed try, 3 for the retry');
    } finally {
      await close(flow);
    }
  });

  test('the Earnings route keeps its error contract when only the ledger fails (Codex #77)', async () => {
    for (const [status, expected] of [[404, 404], [500, 502]]) {
      const flow = await listen(fakeFlow({ earnings: () => [status, ''] }));
      try {
        const r = await earn(key(`RepErr${status}`));
        assert.equal(r.status, expected, `ledger answered ${status}`);
      } finally {
        await close(flow);
      }
    }
  });

  test('a link the flow refuses is a 404 every time and is not held', async () => {
    const flow = await listen(fakeFlow({ list: () => [404, ''] }));
    try {
      const k = key('RepUnknown');
      assert.equal((await track(k)).status, 404);
      assert.equal((await track(k)).status, 404);
      await settle();
      assert.equal(actions(flow).filter((a) => a === 'list').length, 2, 'asked the flow both times');
      assert.equal(total(flow), 6, 'nothing held: 3 posts each time');
    } finally {
      await close(flow);
    }
  });

  test('the rate limit still counts every request, held or not', async () => {
    const flow = await listen(fakeFlow());
    try {
      const k = key('RepLimit');
      let refused = 0;
      for (let i = 0; i < 35; i += 1) if ((await track(k)).status === 429) refused += 1;
      assert.equal(refused, 5, 'the 31st to 35th are refused, as before');
      assert.equal(total(flow), 3, 'and the 30 that passed made one cold read: 3 posts, then 0');
    } finally {
      await close(flow);
    }
  });

  test('FLOW_CACHE_SECONDS=0 turns the cache off: no hold, but one key check per read', async () => {
    process.env.FLOW_CACHE_SECONDS = '0';
    const flow = await listen(fakeFlow());
    try {
      const k = key('RepOff');
      await track(k);
      await track(k);
      // No cache means no hold and no role check from the cache, so the route asks the
      // lookup itself before it returns anything: the list, the ledger and the lookup, twice.
      assert.equal(total(flow), 6);
      assert.equal(actions(flow).filter((a) => a === 'lookup').length, 2);
    } finally {
      await close(flow);
    }
  });

  test('a key the lookup does not confirm, disabled afterwards, gets no rows from memory (Codex #77 P0)', async () => {
    let disabled = false;
    const flow = await listen(
      fakeFlow({
        lookup: () => (disabled ? [404, ''] : [200, NOT_REP_LOOKUP]),
        list: () => (disabled ? [404, ''] : [200, { referrals: [{ id: 'R1', practice: 'TEST Dental' }] }]),
      }),
    );
    try {
      const k = key('NotRepGone');
      // Not a Rep: refused from the first read (fails closed), so nothing is ever held.
      assert.equal((await call(listRoute, '/api/referral-list', { referralKey: k })).status, 404);
      disabled = true;
      assert.equal((await call(listRoute, '/api/referral-list', { referralKey: k })).status, 404);
    } finally {
      await close(flow);
    }
  });

  test('a lookup that fails or answers badly holds nothing, and a Rep answer with no services is not a Rep', async () => {
    for (const reply of [() => [500, ''], () => [404, ''], () => [200, { role: 'Rep', repName: 'TEST Rep' }], () => [200, 'not json']]) {
      const flow = await listen(fakeFlow({ lookup: reply }));
      try {
        const k = key('BadRole');
        await track(k);
        await track(k);
        assert.equal(actions(flow).filter((a) => a === 'list').length, 2, 'nothing was held');
      } finally {
        await close(flow);
        clearFlowCache();
      }
    }
  });

  test('a Rep answer is held, and only after the lookup says Rep', async () => {
    const flow = await listen(fakeFlow());
    try {
      const k = key('RepHeld');
      await track(k);
      assert.deepEqual(actions(flow).sort(), ['earnings', 'list', 'lookup']);
      await track(k);
      await earn(k);
      assert.equal(flow.posts.length, 3, 'repeats cost nothing');
    } finally {
      await close(flow);
    }
  });
});

describe('fail closed: nothing is returned unless the lookup confirms a Rep (Codex P0 on #1)', { concurrency: false }, () => {
  beforeEach(() => {
    clearFlowCache();
    process.env.REP_APP_ENABLED = 'true';
    process.env.REP_PAY_ENABLED = 'true';
    process.env.REP_PAY_PLAN = 'signed:150';
    delete process.env.FLOW_CACHE_SECONDS;
  });
  afterEach(restore);

  const ROWS = { referrals: [{ id: 'R1', doctorName: 'TEST Secret Office', practiceName: 'TEST Dental', sentOn: '2026-11-01' }] };
  const LEDGER = { rows: [{ referralId: 'R1', practiceName: 'TEST Dental', event: 'Reached', payeeRole: 'Rep', amount: 50, earnedOn: '2026-11-04', status: 'Waiting' }] };

  for (const cacheSeconds of [undefined, '0']) {
    const label = cacheSeconds === '0' ? 'cache off' : 'cache on';
    test(`${label}: a lookup that answers another role gets 404 and no rows, on Track and Earnings`, async () => {
      if (cacheSeconds) process.env.FLOW_CACHE_SECONDS = cacheSeconds;
      const flow = await listen(
        fakeFlow({ lookup: () => [200, NOT_REP_LOOKUP], list: () => [200, ROWS], earnings: () => [200, LEDGER] }),
      );
      try {
        for (const r of [
          await call(listRoute, '/api/referral-list', { referralKey: key(`NotRep${label.length}`) }),
          await track(key(`NotRep${label.length}`)),
          await earn(key(`NotRep${label.length}`)),
        ]) {
          assert.equal(r.status, 404);
          assert.equal(JSON.stringify(r.body).includes('TEST Secret Office'), false);
          assert.equal(JSON.stringify(r.body).includes('TEST Dental'), false);
        }
      } finally {
        await close(flow);
      }
    });

    test(`${label}: a lookup that fails gets 502 and no rows, and a later good lookup serves them`, async () => {
      if (cacheSeconds) process.env.FLOW_CACHE_SECONDS = cacheSeconds;
      let down = true;
      const flow = await listen(
        fakeFlow({ lookup: () => (down ? [500, ''] : [200, REP_LOOKUP]), list: () => [200, ROWS], earnings: () => [200, LEDGER] }),
      );
      try {
        for (const r of [await track(key(`Down${label.length}`)), await earn(key(`Down${label.length}`))]) {
          assert.equal(r.status, 502);
          assert.equal(JSON.stringify(r.body).includes('TEST Dental'), false);
        }
        down = false;
        clearFlowCache();
        const ok = await track(key(`Down${label.length}`));
        assert.equal(ok.status, 200);
        assert.equal(JSON.stringify(ok.body).includes('TEST Dental'), true);
      } finally {
        await close(flow);
      }
    });
  }

  test('a warm read needs no new lookup: only a confirmed Rep key is ever held', async () => {
    const flow = await listen(fakeFlow({ list: () => [200, ROWS], earnings: () => [200, LEDGER] }));
    try {
      assert.equal((await track(key('Warm'))).status, 200);
      const before = total(flow);
      assert.equal((await track(key('Warm'))).status, 200);
      assert.equal(total(flow), before, 'served from memory, no flow post');
    } finally {
      await close(flow);
    }
  });
});
