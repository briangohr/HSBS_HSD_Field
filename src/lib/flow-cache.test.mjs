// The short read cache for Track and My Earnings (src/lib/flow-cache.mjs): what it holds,
// what it never holds, and the ways a rep skips it.
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import {
  DEFAULT_TTL_SECONDS,
  MAX_ENTRY_BYTES,
  MAX_KEYS,
  MAX_TOTAL_BYTES,
  MAX_TTL_SECONDS,
  cacheTtlMs,
  cachedBytes,
  cachedKeyCount,
  clearFlowCache,
  forgetKey,
  readThrough,
} from './flow-cache.mjs';

const KEY = (n) => `Rep${String(n).padStart(5, '0')}_${'k'.repeat(30)}`;
const gate = () => {
  let release;
  const wait = new Promise((r) => (release = r));
  return { wait, release };
};

describe('readThrough', () => {
  afterEach(clearFlowCache);

  test('a second read inside the TTL does not call the flow; one after it does', async () => {
    let t = 0;
    let calls = 0;
    const load = async () => ({ n: ++calls });
    const opts = { ttlMs: 45_000, now: () => t };
    assert.deepEqual(await readThrough('list', KEY(1), load, opts), { n: 1 });
    t = 44_999;
    assert.deepEqual(await readThrough('list', KEY(1), load, opts), { n: 1 }, 'still inside the TTL');
    t = 45_000;
    assert.deepEqual(await readThrough('list', KEY(1), load, opts), { n: 2 }, 'at the TTL it reads again');
    assert.equal(calls, 2);
  });

  test('cache: false reads the flow every time and stores nothing', async () => {
    let calls = 0;
    const load = async () => ({ n: ++calls });
    assert.deepEqual(await readThrough('list', KEY(9), load, { cache: false }), { n: 1 });
    assert.deepEqual(await readThrough('list', KEY(9), load, { cache: false }), { n: 2 });
    assert.equal(cachedKeyCount(), 0, 'no link was remembered');
    assert.deepEqual(await readThrough('list', KEY(9), load), { n: 3 }, 'a normal read starts from empty');
  });

  test('two reads at the same moment share one flow call', async () => {
    const g = gate();
    let calls = 0;
    const load = async () => {
      calls += 1;
      await g.wait;
      return [{ id: 1 }];
    };
    const a = readThrough('list', KEY(2), load);
    const b = readThrough('list', KEY(2), load);
    g.release();
    assert.deepEqual(await Promise.all([a, b]), [[{ id: 1 }], [{ id: 1 }]]);
    assert.equal(calls, 1, 'two ordinary reads at the same moment share one call');
  });

  test('a fresh read never joins an older read that was not fresh (it may predate a send)', async () => {
    const g = gate();
    let calls = 0;
    const load = async () => {
      const n = ++calls;
      if (n === 1) await g.wait; // the older read is slow
      return { n };
    };
    const older = readThrough('list', KEY(20), load);
    const fresh = await readThrough('list', KEY(20), load, { fresh: true });
    assert.deepEqual(fresh, { n: 2 }, 'the fresh read made its own call');
    g.release();
    assert.deepEqual(await older, { n: 1 }, 'the older read still answers its own caller');
    assert.deepEqual(await readThrough('list', KEY(20), load), { n: 2 }, 'but only the fresh answer is held');
    assert.equal(calls, 2);
  });

  test('a fresh read never joins any read in flight, even a fresh one; an ordinary read may join a fresh one', async () => {
    const g = gate();
    let calls = 0;
    const load = async () => {
      const n = ++calls;
      await g.wait;
      return { n };
    };
    const a = readThrough('list', KEY(21), load, { fresh: true });
    const b = readThrough('list', KEY(21), load, { fresh: true }); // could predate a send: own call
    const c = readThrough('list', KEY(21), load); // an ordinary read joins the newest
    g.release();
    assert.deepEqual(await Promise.all([a, b, c]), [{ n: 1 }, { n: 2 }, { n: 2 }]);
    assert.equal(calls, 2);
  });

  test('an answer bigger than the per-entry limit is served but not held', async () => {
    let calls = 0;
    const big = () => ({ n: ++calls, pad: 'x'.repeat(MAX_ENTRY_BYTES + 10) });
    const first = await readThrough('list', KEY(22), async () => big());
    assert.equal(first.n, 1);
    assert.equal(cachedBytes(), 0, 'nothing was held');
    const second = await readThrough('list', KEY(22), async () => big());
    assert.equal(second.n, 2, 'so the next read asked again');
  });

  test('the total bytes are bounded: the least recently used links go first, and forgetting gives bytes back', async () => {
    const chunk = Math.floor(MAX_ENTRY_BYTES * 0.9);
    const make = (i) => async () => ({ i, pad: 'x'.repeat(chunk) });
    const fits = Math.floor(MAX_TOTAL_BYTES / chunk);
    for (let i = 0; i < fits + 5; i += 1) await readThrough('list', KEY(30 + i), make(i));
    assert.ok(cachedBytes() <= MAX_TOTAL_BYTES, `held ${cachedBytes()} bytes`);
    let calls = 0;
    await readThrough('list', KEY(30), async () => ++calls); // the oldest was dropped
    assert.equal(calls, 1);
    const newest = KEY(30 + fits + 4);
    calls = 0;
    await readThrough('list', newest, async () => ++calls); // the newest is still held
    assert.equal(calls, 0);
    const before = cachedBytes();
    forgetKey(newest);
    assert.ok(cachedBytes() < before, 'forgetting a link gives its bytes back');
    clearFlowCache();
    assert.equal(cachedBytes(), 0);
  });

  test('mayStore decides whether an answer is held: no, an error and a late yes (Codex #77)', async () => {
    const opts = (mayStore) => ({ ttlMs: 45_000, now: () => 0, mayStore });
    let calls = 0;
    const load = async () => ({ n: ++calls });
    for (const mayStore of [async () => false, async () => { throw new Error('lookup down'); }, async () => 'yes']) {
      clearFlowCache();
      calls = 0;
      assert.deepEqual(await readThrough('list', KEY(1), load, opts(mayStore)), { n: 1 }, 'the answer is still served');
      assert.deepEqual(await readThrough('list', KEY(1), load, opts(mayStore)), { n: 2 }, 'but nothing was held');
      assert.equal(cachedBytes(), 0);
    }
    clearFlowCache();
    calls = 0;
    const slowYes = () => new Promise((r) => setTimeout(() => r(true), 5));
    await readThrough('list', KEY(1), load, opts(slowYes));
    assert.deepEqual(await readThrough('list', KEY(1), load, opts(async () => false)), { n: 1 }, 'a yes is held');
  });

  test('the TTL runs from when the read started, not when the slow flow finished (Codex #77 round 7)', async () => {
    let t = 0;
    const opts = { ttlMs: 45_000, now: () => t, mayStore: async () => true };
    let calls = 0;
    // The Rep check answers at once; the list stalls 19 seconds.
    const slow = async () => {
      const n = ++calls;
      const g = gate();
      setTimeout(g.release, 0);
      await g.wait;
      t += 19_000;
      return { n, pad: 'x'.repeat(10) };
    };
    assert.deepEqual(await readThrough('list', KEY(1), slow, opts), { n: 1, pad: 'xxxxxxxxxx' });
    const bytes = cachedBytes();
    assert.ok(bytes > 0, 'still held: 26 seconds are left');
    t = 44_999;
    assert.deepEqual(await readThrough('list', KEY(1), slow, opts), { n: 1, pad: 'xxxxxxxxxx' }, 'held to 45s after the START');
    t = 45_000;
    await readThrough('list', KEY(1), slow, opts);
    assert.equal(calls, 2, 'at 45s from the start it is gone, not 64s');
    assert.equal(cachedKeyCount(), 1);
  });

  test('a read that took the whole TTL, or close to it, is served but not held (Codex #77 round 7)', async () => {
    let t = 0;
    const opts = { ttlMs: 45_000, now: () => t, mayStore: async () => true };
    let calls = 0;
    for (const took of [45_000, 60_000, 44_500]) {
      clearFlowCache();
      calls = 0;
      t = 0;
      const load = async () => {
        await Promise.resolve();
        t += took;
        return { n: ++calls };
      };
      assert.deepEqual(await readThrough('list', KEY(2), load, opts), { n: 1 });
      assert.equal(cachedBytes(), 0, `took ${took}: nothing held`);
      assert.equal(cachedKeyCount(), 0, 'and no empty link left behind');
    }
  });

  test('a normal fast read still holds the full TTL, and the bytes add up (Codex #77 round 7)', async () => {
    let t = 1_000_000;
    const opts = { ttlMs: 45_000, now: () => t, mayStore: async () => true };
    let calls = 0;
    const load = async () => ({ n: ++calls });
    await readThrough('list', KEY(3), load, opts);
    const one = cachedBytes();
    assert.equal(one, JSON.stringify({ n: 1 }).length);
    t += 44_999;
    await readThrough('list', KEY(3), load, opts);
    assert.equal(calls, 1);
    t += 1;
    await readThrough('list', KEY(3), load, opts);
    assert.equal(calls, 2);
    assert.equal(cachedBytes(), JSON.stringify({ n: 2 }).length, 'the old bytes were given back');
  });

  test('a fresh read counts its TTL from its own start too (Codex #77 round 7)', async () => {
    let t = 0;
    const opts = { ttlMs: 45_000, now: () => t, mayStore: async () => true, fresh: true };
    const load = async () => {
      await Promise.resolve();
      t += 50_000;
      return { n: 1 };
    };
    await readThrough('list', KEY(4), load, opts);
    assert.equal(cachedBytes(), 0);
  });

  test('fresh skips a held answer and stores the new one', async () => {
    let calls = 0;
    const load = async () => ({ n: ++calls });
    await readThrough('list', KEY(3), load);
    assert.deepEqual(await readThrough('list', KEY(3), load, { fresh: true }), { n: 2 });
    assert.deepEqual(await readThrough('list', KEY(3), load), { n: 2 }, 'the fresh answer is the one held');
  });

  test('forgetKey makes the next read go to the flow, and a read that was in flight does not come back', async () => {
    let calls = 0;
    const g = gate();
    const slow = async () => {
      calls += 1;
      await g.wait;
      return { n: 'old' };
    };
    const pending = readThrough('list', KEY(4), slow);
    forgetKey(KEY(4)); // the rep sent a referral while that read was running
    g.release();
    assert.deepEqual(await pending, { n: 'old' }, 'the caller that asked still gets its answer');
    assert.deepEqual(await readThrough('list', KEY(4), async () => ({ n: 'new' })), { n: 'new' }, 'but it was not stored');
    assert.equal(calls, 1);
  });

  test('an error is not cached', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      if (calls === 1) throw new Error('flow down');
      return 'ok';
    };
    await assert.rejects(readThrough('list', KEY(5), load), /flow down/);
    assert.equal(await readThrough('list', KEY(5), load), 'ok');
    assert.equal(calls, 2);
  });

  test('one rep link never gets another link\'s answer, and each scope is its own', async () => {
    const a = await readThrough('list', KEY(6), async () => 'six');
    const b = await readThrough('list', KEY(7), async () => 'seven');
    const c = await readThrough('earnings', KEY(6), async () => 'six-ledger');
    assert.deepEqual([a, b, c], ['six', 'seven', 'six-ledger']);
    assert.equal(await readThrough('list', KEY(6), async () => 'other'), 'six');
  });

  test('a caller that changes the answer cannot change what is held', async () => {
    const first = await readThrough('list', KEY(8), async () => [{ id: 1 }]);
    first.push({ id: 'planted' });
    first[0].id = 'changed';
    assert.deepEqual(await readThrough('list', KEY(8), async () => []), [{ id: 1 }]);
    const second = await readThrough('list', KEY(8), async () => []);
    second[0].id = 'changed too';
    assert.deepEqual(await readThrough('list', KEY(8), async () => []), [{ id: 1 }]);
  });

  test('a TTL of 0 never holds anything', async () => {
    let calls = 0;
    const load = async () => ++calls;
    await readThrough('list', KEY(9), load, { ttlMs: 0 });
    await readThrough('list', KEY(9), load, { ttlMs: 0 });
    assert.equal(calls, 2);
    assert.equal(cachedKeyCount(), 0);
  });

  test('the map is bounded and drops the least recently used link', async () => {
    const load = async () => 'x';
    for (let i = 0; i < MAX_KEYS + 25; i += 1) await readThrough('list', KEY(10_000 + i), load);
    assert.equal(cachedKeyCount(), MAX_KEYS);
    let calls = 0;
    await readThrough('list', KEY(10_000), async () => ++calls); // the oldest was dropped
    assert.equal(calls, 1);
    await readThrough('list', KEY(10_000 + MAX_KEYS + 24), async () => ++calls); // the newest is still held
    assert.equal(calls, 1);
  });

  // Codex #77 round 4: an empty bucket holds nothing but still counts toward MAX_KEYS, so
  // reads that are never held (a key the lookup does not confirm) must not leave one behind.
  test('reads that are never held leave no bucket, and a held Rep answer is not pushed out (Codex #77)', async () => {
    let repCalls = 0;
    await readThrough('list', KEY(1), async () => ({ n: ++repCalls }), { mayStore: async () => true });
    assert.equal(cachedKeyCount(), 1);
    const total = MAX_KEYS + 1000;
    const kinds = {
      'mayStore says no (an unconfirmed key)': { mayStore: async () => false },
      'mayStore fails': { mayStore: async () => { throw new Error('lookup down'); } },
      'the loader fails': { mayStore: async () => true, fail: true },
      'the answer is too big to hold': { mayStore: async () => true, big: true },
    };
    for (const [label, kind] of Object.entries(kinds)) {
      // The too-big answer is costly to build, and a few hundred prove the point on their own.
      for (let i = 0; i < (kind.big ? 300 : total); i += 1) {
        const load = async () => {
          if (kind.fail) throw new Error('flow down');
          return kind.big ? 'x'.repeat(MAX_ENTRY_BYTES + 1) : { i };
        };
        await readThrough('list', KEY(20_000 + i), load, { mayStore: kind.mayStore }).catch(() => {});
      }
      assert.equal(cachedKeyCount(), 1, `${label}: only the Rep link is held, no empty buckets`);
      assert.equal(cachedBytes() < 1000, true, `${label}: no bytes were left behind`);
    }
    assert.deepEqual(await readThrough('list', KEY(1), async () => ({ n: ++repCalls })), { n: 1 }, 'the Rep answer is still held');
    assert.equal(repCalls, 1);
  });

  test('a link whose last entry is dropped is removed, but one with another entry stays', async () => {
    await readThrough('list', KEY(5), async () => 'a', { mayStore: async () => true });
    await readThrough('earnings', KEY(5), async () => 'b', { mayStore: async () => true });
    assert.equal(cachedKeyCount(), 1);
    // The list is read again and fails: its entry goes, the earnings entry keeps the link.
    await readThrough('list', KEY(5), async () => { throw new Error('down'); }, { fresh: true }).catch(() => {});
    assert.equal(cachedKeyCount(), 1);
    await readThrough('earnings', KEY(5), async () => { throw new Error('down'); }, { fresh: true }).catch(() => {});
    assert.equal(cachedKeyCount(), 0);
    assert.equal(cachedBytes(), 0);
  });
});

describe('FLOW_CACHE_SECONDS', () => {
  const saved = process.env.FLOW_CACHE_SECONDS;
  afterEach(() => {
    if (saved === undefined) delete process.env.FLOW_CACHE_SECONDS;
    else process.env.FLOW_CACHE_SECONDS = saved;
  });

  test('unset or junk means the default; 0 turns it off; the top is five minutes', () => {
    delete process.env.FLOW_CACHE_SECONDS;
    assert.equal(cacheTtlMs(), DEFAULT_TTL_SECONDS * 1000);
    for (const junk of ['', 'abc', '-5', 'NaN']) {
      process.env.FLOW_CACHE_SECONDS = junk;
      assert.equal(cacheTtlMs(), DEFAULT_TTL_SECONDS * 1000, JSON.stringify(junk));
    }
    process.env.FLOW_CACHE_SECONDS = '0';
    assert.equal(cacheTtlMs(), 0);
    process.env.FLOW_CACHE_SECONDS = '90';
    assert.equal(cacheTtlMs(), 90_000);
    process.env.FLOW_CACHE_SECONDS = '99999';
    assert.equal(cacheTtlMs(), MAX_TTL_SECONDS * 1000);
  });
});
