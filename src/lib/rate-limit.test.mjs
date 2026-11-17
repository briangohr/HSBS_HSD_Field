// Launch surge: up to 150 reps sign up and send a first referral at once, most behind one
// corporate or VPN address. The site limits by link key (or email), with a high per-IP
// backstop. Synthetic keys, emails and TEST-NET addresses only; nothing leaves the machine.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { IP_BACKSTOP, MAX_BUCKETS, ipBucket, journeyLimited, keyBucket, keyCounted, keyLimited, keyRefund, keyReserve, rateBuckets, rateLimited } from './http.ts';

const key = (i) => `Test_${'k'.repeat(24)}_${i}`;
const token = (i) => i.toString(16).padStart(64, '0');
let net = 0;
/** A fresh TEST-NET address per test, so tests never share a bucket. */
const freshIp = () => `203.0.113.${(net += 1)}`;

const saved = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});

describe('limits per link key, with a per-IP backstop', () => {
  test('the bucket holds a SHA-256 of the key, never the key', () => {
    const k = key(1);
    const b = keyBucket('referral', k);
    assert.match(b, /^referral:key:[0-9a-f]{32}$/);
    assert.equal(b.includes(k), false);
    assert.equal(keyBucket('referral', k), b, 'the same key always lands in the same bucket');
    assert.notEqual(keyBucket('referral', key(2)), b);
    assert.notEqual(keyBucket('referral-list', k), b, 'each route keeps its own count');
    assert.equal(ipBucket('referral', '203.0.113.9'), 'referral:ip:203.0.113.9');
  });

  test('one key is still capped at its own limit', () => {
    const ip = freshIp();
    const k = key(10);
    for (let i = 0; i < 30; i += 1) assert.equal(keyLimited('referral', k, ip, 30), false, `hit ${i + 1}`);
    assert.equal(keyLimited('referral', k, ip, 30), true, 'the 31st in 10 minutes is refused');
    assert.equal(keyLimited('referral', key(11), ip, 30), false, 'a second person on the same IP is not');
  });

  test('150 people with their own keys behind one IP are never limited', () => {
    const ip = freshIp();
    for (let i = 0; i < 150; i += 1) {
      for (let n = 0; n < 3; n += 1) assert.equal(keyLimited('referral', key(1000 + i), ip, 30), false, `person ${i}`);
    }
  });

  test('the per-IP backstop still caps one address cycling keys', () => {
    assert.ok(IP_BACKSTOP >= 600, 'high enough for a launch meeting behind one IP');
    const ip = freshIp();
    for (let i = 0; i < IP_BACKSTOP; i += 1) assert.equal(keyLimited('earnings', key(5000 + i), ip, 30), false);
    assert.equal(keyLimited('earnings', key(9999), ip, 30), true, 'one past the backstop is refused');
    assert.equal(keyLimited('earnings', key(9999), freshIp(), 30), false, 'another address is not');
  });

  test('one address cycling more keys than a map holds still gets exactly the backstop', () => {
    const ip = freshIp();
    const victimIp = freshIp();
    const victim = key(70_000);
    for (let i = 0; i < 30; i += 1) keyLimited('referral-list', victim, victimIp, 30);
    assert.equal(keyLimited('referral-list', victim, victimIp, 30), true, 'the victim key is at its cap');
    let passed = 0;
    for (let i = 0; i < 6000; i += 1) if (!keyLimited('referral-list', key(100_000 + i), ip, 30)) passed += 1;
    assert.equal(passed, IP_BACKSTOP);
    assert.equal(keyLimited('referral-list', key(999_999), ip, 30), true, 'that address is still limited');
    assert.equal(keyLimited('referral-list', victim, victimIp, 30), true, "an unrelated key's count is unchanged");
  });

  test('a refused address makes no key bucket', () => {
    const ip = freshIp();
    for (let i = 0; i < IP_BACKSTOP; i += 1) keyLimited('earnings', key(200_000 + i), ip, 30);
    const before = rateBuckets().length;
    for (let i = 0; i < 50; i += 1) assert.equal(keyLimited('earnings', key(300_000 + i), ip, 30), true);
    assert.equal(rateBuckets().length, before);
  });

  test('key churn never resets an address bucket, and each map stays bounded', () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) rateLimited(ipBucket('register', ip), 5);
    assert.equal(rateLimited(ipBucket('register', ip), 5), true, 'at its cap');
    for (let i = 0; i < MAX_BUCKETS + 5000; i += 1) keyCounted(keyBucket('referral-list', key(400_000 + i)), 30);
    assert.equal(rateLimited(ipBucket('register', ip), 5), true, 'still at its cap after the churn');
    assert.ok(rateBuckets().length <= 2 * MAX_BUCKETS);
  });

  test('no raw key, token or email is ever a bucket name', async () => {
    const ip = freshIp();
    const keys = [key(20), key(21)];
    for (const k of keys) keyLimited('referral', k, ip, 30);
    const t = token(77);
    keyLimited('confirm', t, ip, 10);
    const { submitRegistration } = await import('./register-submit.ts');
    delete process.env.REGISTER_FLOW_URL;
    const email = 'test.rawcheck@henryschein.com';
    await submitRegistration(signUp(email), ip);
    const names = rateBuckets().join('\n');
    for (const secret of [...keys, t, email]) assert.equal(names.includes(secret), false, 'raw value stored');
  });
});

const signUp = (email) => ({
  firstName: 'Test',
  lastName: 'Rep',
  email,
  mobile: '(555) 010-1234',
  role: 'AE',
  managerName: 'Test Manager',
  managerEmail: 'test.manager@henryschein.com',
  branch: 'Columbus',
  src: 'qr',
});

describe('the rep journey behind one corporate IP', () => {
  test('sign-up: 150 people on one IP reach 1J; one email from one IP is capped at 5', async () => {
    const { submitRegistration } = await import('./register-submit.ts');
    delete process.env.REGISTER_FLOW_URL; // no flow: each one that gets past the limit is a 503
    const ip = freshIp();
    for (let i = 0; i < 150; i += 1) {
      const r = await submitRegistration(signUp(`test.surge${i}@henryschein.com`), ip);
      assert.equal(r.status, 503, `person ${i}`);
    }
    // The email cap counts sends 1J took (an unset URL no longer counts: Codex P1 on #71),
    // so these five reach a stand-in 1J that answers 200.
    const server = await listen('REGISTER_FLOW_URL', (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
    try {
      const same = 'test.repeat@henryschein.com';
      const mine = freshIp();
      for (let i = 0; i < 5; i += 1) assert.equal((await submitRegistration(signUp(same), mine)).status, 200);
      const sixth = await submitRegistration(signUp(same), mine);
      assert.equal(sixth.status, 429, 'the same email from the same address');
      assert.equal(sixth.error, 'Too many tries. Please wait a few minutes.');
      const owner = await submitRegistration(signUp(same), freshIp());
      assert.equal(owner.status, 200, 'someone else posting your email does not lock you out');
    } finally {
      await close(server);
    }
  });

  test('sign-up: one IP is capped at 200 by default, and REGISTER_IP_LIMIT overrides it', async () => {
    const { REGISTER_IP_DEFAULT, submitRegistration } = await import('./register-submit.ts');
    delete process.env.REGISTER_FLOW_URL;
    assert.equal(REGISTER_IP_DEFAULT, 200);
    const ip = freshIp();
    for (let i = 0; i < 200; i += 1) assert.equal((await submitRegistration(signUp(`test.cap${i}@henryschein.com`), ip)).status, 503);
    assert.equal((await submitRegistration(signUp('test.cap-over@henryschein.com'), ip)).status, 429, 'the 201st');
    process.env.REGISTER_IP_LIMIT = '3';
    const low = freshIp();
    for (let i = 0; i < 3; i += 1) assert.equal((await submitRegistration(signUp(`test.low${i}@henryschein.com`), low)).status, 503);
    assert.equal((await submitRegistration(signUp('test.low-over@henryschein.com'), low)).status, 429);
  });

  test('Rep submit: 150 keys on one IP pass the limiter; one key is capped at 30', async () => {
    process.env.REP_APP_ENABLED = 'true';
    const { submitRep } = await import('./rep-submit.ts');
    const ip = freshIp();
    const id = () => crypto.randomUUID();
    // Empty fields: past the limiter they are field errors (422), so no flow is needed.
    for (let i = 0; i < 150; i += 1) assert.equal((await submitRep(key(2000 + i), id(), { company: 'HealthFirst' }, ip)).status, 422, `person ${i}`);
    const k = key(3000);
    for (let i = 0; i < 30; i += 1) assert.equal((await submitRep(k, id(), { company: 'HealthFirst' }, ip)).status, 422);
    const over = await submitRep(k, id(), { company: 'HealthFirst' }, freshIp());
    assert.equal(over.status, 429);
    assert.equal(over.error, 'Too many requests. Please try again in a few minutes.');
  });

  test('manager confirm: many managers on one IP; one link is capped at 10', async () => {
    const { submitConfirm } = await import('./confirm-submit.ts');
    delete process.env.REGISTER_FLOW_URL; // no flow: past the limit is a 503
    const ip = freshIp();
    for (let i = 0; i < 60; i += 1) assert.equal((await submitConfirm(token(100 + i), 'yes', ip)).status, 503);
    const t = token(999);
    for (let i = 0; i < 10; i += 1) assert.equal((await submitConfirm(t, 'yes', ip)).status, 503);
    assert.equal((await submitConfirm(t, 'yes', freshIp())).status, 429);
  });
});

function listen(envName, handler) {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      process.env[envName] = `http://127.0.0.1:${server.address().port}/flow`;
      resolve(server);
    });
  });
}
const close = (server) => new Promise((resolve) => server.close(resolve));

describe('Power Automate busy (408, 429) under a surge', { concurrency: false }, () => {
  test('sign-up: 408 and 429 are "not available", other 4xx still a refusal', async () => {
    const { postRegistration, RegisterRefusedError, RegisterWriteError } = await import('./register-flow.mjs');
    for (const [status, Err] of [[408, RegisterWriteError], [429, RegisterWriteError], [400, RegisterRefusedError], [403, RegisterRefusedError]]) {
      const server = await listen('REGISTER_FLOW_URL', (_req, res) => {
        res.writeHead(status);
        res.end();
      });
      try {
        await assert.rejects(() => postRegistration({ action: 'register' }), (err) => err instanceof Err && err.status === status);
      } finally {
        await close(server);
      }
    }
  });

  test('lookup and list: a 429 is a failed read, never an unknown key', async () => {
    const flow = await import('./field-flow.mjs');
    const server = await listen('FIELD_FLOW_URL', (_req, res) => {
      res.writeHead(429);
      res.end();
    });
    try {
      process.env.REP_APP_ENABLED = 'true';
      for (const call of [flow.lookupReferral, flow.listReferrals, flow.listEarnings]) {
        await assert.rejects(() => call(key(1)), (err) => err instanceof flow.ReferralAppWriteError && err.status === 429);
      }
    } finally {
      await close(server);
    }
  });

  test('timeouts: sign-up 45s and Rep reads 20s, both inside the 60s function limit', async () => {
    const { REGISTER_TIMEOUT_MS } = await import('./register-flow.mjs');
    const { REP_LOOKUP_TIMEOUT_MS, SUBMIT_TIMEOUT_MS } = await import('./field-flow.mjs');
    assert.equal(REGISTER_TIMEOUT_MS, 45_000);
    assert.equal(REP_LOOKUP_TIMEOUT_MS, 20_000);
    for (const ms of [REGISTER_TIMEOUT_MS, REP_LOOKUP_TIMEOUT_MS, SUBMIT_TIMEOUT_MS]) assert.ok(ms <= 55_000, String(ms));
  });

  test('no-JavaScript submit: lookup and submit together stay under the 60s function limit', async () => {
    const { REP_LOOKUP_TIMEOUT_MS, SUBMIT_TIMEOUT_MS, submitBudgetMs } = await import('./field-flow.mjs');
    assert.equal(submitBudgetMs(0), SUBMIT_TIMEOUT_MS);
    for (const spent of [0, 1000, 8000, REP_LOOKUP_TIMEOUT_MS, REP_LOOKUP_TIMEOUT_MS + 2000]) {
      assert.ok(spent + submitBudgetMs(spent) < 60_000, `spent ${spent}`);
    }
    assert.equal(submitBudgetMs(10 * 60_000), 5000, 'a floor, so a submit is always tried');
  });
});

describe('the link routes limit per key, with the per-IP backstop (Codex review of #71)', () => {
  test('journeyLimited with the switch off is a plain per-IP limit: the 31st request from one IP is refused', () => {
    for (const scope of ['referral', 'referral-list']) {
      const ip = freshIp();
      for (let i = 0; i < 30; i += 1) assert.equal(journeyLimited(scope, key(100 + i), ip, 30, false), false, `${scope} hit ${i + 1}`);
      assert.equal(journeyLimited(scope, key(200), ip, 30, false), true, `${scope}: the 31st is refused`);
      const held = rateBuckets();
      for (let i = 0; i < 30; i += 1) assert.equal(held.includes(keyBucket(scope, key(100 + i))), false, 'no per-key bucket with the switch off');
      assert.equal(held.includes(`${scope}:${ip}`), true, 'the per-IP bucket is used');
    }
  });

  test('with the switch on, 31 people on one IP all get through', () => {
    const ip = freshIp();
    for (let i = 0; i < 31; i += 1) assert.equal(journeyLimited('referral', key(300 + i), ip, 30, true), false, `person ${i + 1}`);
  });

  test('the list route limits per key; the submit route limits through submitRep only', () => {
    const list = readFileSync(new URL('../pages/api/referral-list.ts', import.meta.url), 'utf8');
    assert.equal((list.match(/journeyLimited\('referral-list', String\(data\.referralKey\), ip, 30, true\)/g) || []).length, 1);
    const submit = readFileSync(new URL('../pages/api/referral.ts', import.meta.url), 'utf8');
    assert.equal(/\b(keyLimited|journeyLimited|rateLimited)\(/.test(submit), false, 'the route itself calls no limiter');
    assert.equal((submit.match(/\bsubmitRep\(/g) || []).length, 1);
    const rep = readFileSync(new URL('./rep-submit.ts', import.meta.url), 'utf8');
    assert.equal((rep.match(/keyLimited\('referral', String\(referralKey\), ip, 30\)/g) || []).length, 1);
  });
});

/** One POST to /api/team, as a page script sends it. No flow: past the limiter is a 503. */
async function teamCall(referralKey, ip) {
  const { POST } = await import('../pages/api/team.ts');
  const res = await POST(/** @type {any} */ ({
    request: new Request('http://localhost/api/team', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ referralKey }),
    }),
    clientAddress: ip,
  }));
  return { status: res.status, body: await res.json() };
}

/** Run fn with console.error quiet: every call past the limiter logs the missing flow URL. */
async function quiet(fn) {
  const error = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = error;
  }
}

describe('My Team: per key with the per-IP backstop, like /api/referral', { concurrency: false }, () => {
  test('31 managers on one IP all get through; one key is capped at 30', async () => {
    process.env.REP_APP_ENABLED = 'true';
    delete process.env.FIELD_FLOW_URL;
    await quiet(async () => {
      const ip = freshIp();
      for (let i = 0; i < 31; i += 1) assert.equal((await teamCall(key(6000 + i), ip)).status, 503, `manager ${i + 1}`);
      const k = key(6100);
      for (let i = 0; i < 30; i += 1) assert.equal((await teamCall(k, ip)).status, 503, `hit ${i + 1}`);
      const over = await teamCall(k, freshIp());
      assert.equal(over.status, 429, 'the 31st on one key, from any address');
      assert.equal(over.body.error, 'Too many tries. Please wait a few minutes.');
    });
  });

  test('the per-IP backstop still caps one address cycling keys', async () => {
    process.env.REP_APP_ENABLED = 'true';
    delete process.env.FIELD_FLOW_URL;
    await quiet(async () => {
      const ip = freshIp();
      for (let i = 0; i < IP_BACKSTOP; i += 1) assert.equal((await teamCall(key(7000 + i), ip)).status, 503);
      assert.equal((await teamCall(key(7999), ip)).status, 429, 'one past the backstop is refused');
      assert.equal((await teamCall(key(7999), freshIp())).status, 503, 'another address is not');
    });
  });

  test('switch off: the team scope keeps main\'s per-IP form, team:<ip> at 30', () => {
    const ip = freshIp();
    for (let i = 0; i < 30; i += 1) assert.equal(journeyLimited('team', key(8000 + i), ip, 30, false), false, `hit ${i + 1}`);
    assert.equal(journeyLimited('team', key(8100), ip, 30, false), true, 'the 31st from one IP, whatever the key');
    const held = rateBuckets();
    assert.equal(held.includes(`team:${ip}`), true, 'main\'s bucket name');
    for (let i = 0; i < 30; i += 1) assert.equal(held.includes(keyBucket('team', key(8000 + i))), false, 'no per-key bucket');
  });

  test('the route passes the switch to journeyLimited and calls no other limiter', () => {
    const src = readFileSync(new URL('../pages/api/team.ts', import.meta.url), 'utf8');
    assert.equal((src.match(/journeyLimited\('team', String\(key\), ip, 30, repAppEnabled\(\)\)/g) || []).length, 1);
    assert.equal(/\b(keyLimited|rateLimited)\(/.test(src), false);
    assert.ok(src.indexOf('if (!repAppEnabled())') < src.indexOf('journeyLimited('), 'the 404 gate comes first');
  });
});

describe('manager confirm: the REP_CONFIRM_ENABLED 404 comes before any limit or 1J call (D18)', { concurrency: false }, () => {
  test('/api/confirm with REP_CONFIRM_ENABLED unset: 404, no bucket, no 1J call', async () => {
    process.env.REP_APP_ENABLED = 'true';
    delete process.env.REP_CONFIRM_ENABLED;
    let calls = 0;
    const server = await listen('REGISTER_FLOW_URL', (_req, res) => {
      calls += 1;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
    try {
      const { POST } = await import('../pages/api/confirm.ts');
      const ip = freshIp();
      const before = rateBuckets().length;
      for (let i = 0; i < 3; i += 1) {
        const res = await POST(/** @type {any} */ ({
          request: new Request('http://localhost/api/confirm', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: token(500 + i), answer: 'yes' }),
          }),
          clientAddress: ip,
        }));
        assert.equal(res.status, 404);
      }
      assert.equal(rateBuckets().length, before, 'no limit counted');
      assert.equal(rateBuckets().includes(ipBucket('confirm', ip)), false);
      assert.equal(calls, 0, 'no 1J call');
    } finally {
      await close(server);
    }
  });

  test('both confirm paths check the gate before the limiter and the 1J call', () => {
    for (const [file, after] of [
      ['../pages/api/confirm.ts', ['submitConfirm(']],
      ['../pages/confirm/[token].astro', ['rateLimited(', 'peekConfirm(', 'submitConfirm(']],
    ]) {
      const src = readFileSync(new URL(file, import.meta.url), 'utf8');
      const gate = src.indexOf('if (!confirmEnabled())');
      assert.ok(gate > 0, `${file} has the gate`);
      for (const call of after) {
        const at = src.indexOf(call);
        assert.ok(at > gate, `${file}: ${call} comes after the gate`);
      }
    }
  });
});

describe('sign-up: a failed send does not use up the email allowance (Codex P1 on #71)', { concurrency: false }, () => {
  test('keyRefund takes back one hit, never goes below zero and never makes a bucket', () => {
    const name = keyBucket('register', 'test.refund@henryschein.com|203.0.113.250');
    const holds = [];
    for (let i = 0; i < 5; i += 1) holds.push(keyReserve(name, 5));
    assert.ok(holds.every(Boolean), 'five admitted');
    keyRefund(name, holds[2]);
    assert.ok(keyReserve(name, 5), 'one slot back after a refund');
    assert.equal(keyReserve(name, 5), null, 'and only one');
    const empty = keyBucket('register', 'test.refund-empty@henryschein.com|203.0.113.251');
    const only = keyReserve(empty, 1);
    for (let i = 0; i < 3; i += 1) keyRefund(empty, only);
    assert.ok(keyReserve(empty, 1));
    assert.equal(keyReserve(empty, 1), null, 'extra refunds did not bank credit');
    const missing = keyBucket('register', 'test.refund-none@henryschein.com|203.0.113.252');
    keyRefund(missing, only);
    assert.equal(rateBuckets().includes(missing), false);
    keyRefund(ipBucket('register', '203.0.113.253'), only);
    assert.equal(rateBuckets().includes(ipBucket('register', '203.0.113.253')), false, 'no address bucket either');
  });

  test('keyReserve: a refused request adds no count and holds nothing to give back', () => {
    const name = keyBucket('register', 'test.reserve-refused@henryschein.com|203.0.113.249');
    const first = keyReserve(name, 2);
    const second = keyReserve(name, 2);
    for (let i = 0; i < 10; i += 1) assert.equal(keyReserve(name, 2), null, `refused ${i + 1}`);
    keyRefund(name, second);
    assert.ok(keyReserve(name, 2), 'the refund freed the slot ten refusals did not fill');
    assert.equal(keyReserve(name, 2), null);
    keyRefund(name, first);
    keyRefund(name, first);
    assert.ok(keyReserve(name, 2), 'a second refund of one hold frees nothing more');
    assert.equal(keyReserve(name, 2), null);
  });

  test('keyRefund gives back exactly its own hold, and an expired hold is a no-op', async () => {
    const name = keyBucket('register', 'test.reserve-expired@henryschein.com|203.0.113.248');
    const old = keyReserve(name, 1, 150);
    assert.ok(old);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const fresh = keyReserve(name, 1, 150);
    assert.ok(fresh, 'admitted once the old hold expired');
    keyRefund(name, old);
    assert.equal(keyReserve(name, 1, 150), null, "refunding the expired hold did not take the fresh one's count");
    keyRefund(name, fresh);
    assert.ok(keyReserve(name, 1, 150), 'refunding the fresh hold frees its slot');
    assert.match(name, /^register:key:[0-9a-f]{32}$/, 'the bucket is a hash');
    assert.equal(rateBuckets().some((b) => b.includes('test.reserve-expired')), false);
  });

  test('keyCounted, used by send, list, earnings, team and confirm, still counts refused hits', async () => {
    const name = keyBucket('referral', key(77_777));
    assert.equal(keyCounted(name, 1, 300), false);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(keyCounted(name, 1, 300), true, 'refused, and the refusal is recorded');
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(keyCounted(name, 1, 300), true, 'the first hit has expired; the recorded refusal still counts');
  });

  test('notActedOn: only failures 1J definitely did not act on are given back', async () => {
    const { notActedOn } = await import('./register-submit.ts');
    const f = await import('./register-flow.mjs');
    assert.equal(notActedOn(new f.RegisterConfigError()), true);
    assert.equal(notActedOn(new f.RegisterRefusedError(400)), true, 'a refusal writes nothing and sends no email');
    assert.equal(notActedOn(new f.RegisterWriteError(0, true)), true, 'connection refused');
    for (const status of [429, 500, 502, 503]) assert.equal(notActedOn(new f.RegisterWriteError(status)), true, String(status));
    assert.equal(notActedOn(new f.RegisterTimeoutError()), false, 'a timeout may have gone through');
    assert.equal(notActedOn(new f.RegisterWriteError(0)), false, 'a dropped connection may have gone through');
    for (const status of [200, 202, 302, 408, 504]) assert.equal(notActedOn(new f.RegisterWriteError(status)), false, String(status));
    assert.equal(notActedOn(new Error('other')), false);
  });

  test('the same email and IP recover after five failed sends (1J 502)', async () => {
    const { submitRegistration } = await import('./register-submit.ts');
    let status = 502;
    let calls = 0;
    const server = await listen('REGISTER_FLOW_URL', (_req, res) => {
      calls += 1;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(status === 200 ? '{"ok":true}' : 'Bad Gateway');
    });
    try {
      const ip = freshIp();
      const email = 'test.recover@henryschein.com';
      for (let i = 0; i < 5; i += 1) assert.equal((await submitRegistration(signUp(email), ip)).status, 502, `send ${i + 1}`);
      status = 200;
      const sixth = await submitRegistration(signUp(email), ip);
      assert.equal(sixth.status, 200, 'the sixth reaches 1J once it is back');
      assert.equal(calls, 6, 'every send reached 1J');
    } finally {
      await close(server);
    }
  });

  test('busy, server errors, a refused connection and an unset URL never use up the allowance', async () => {
    const { submitRegistration } = await import('./register-submit.ts');
    for (const status of [500, 502, 503, 429, 400, 403]) {
      const server = await listen('REGISTER_FLOW_URL', (_req, res) => {
        res.writeHead(status);
        res.end();
      });
      try {
        const ip = freshIp();
        const email = `test.fail${status}@henryschein.com`;
        for (let i = 0; i < 8; i += 1) assert.notEqual((await submitRegistration(signUp(email), ip)).status, 429, `${status} send ${i + 1}`);
      } finally {
        await close(server);
      }
    }
    const refused = freshIp();
    await close(await listen('REGISTER_FLOW_URL', () => {})); // that port now refuses connections
    for (let i = 0; i < 8; i += 1) assert.equal((await submitRegistration(signUp('test.refused@henryschein.com'), refused)).status, 502);
    delete process.env.REGISTER_FLOW_URL;
    const unset = freshIp();
    for (let i = 0; i < 8; i += 1) assert.equal((await submitRegistration(signUp('test.unset@henryschein.com'), unset)).status, 503);
  });

  test('a send 1J may have acted on still counts: success, 408, 504 and a 200 without ok', async () => {
    const { submitRegistration } = await import('./register-submit.ts');
    for (const [status, body] of [[200, '{"ok":true}'], [408, ''], [504, ''], [200, '']]) {
      const server = await listen('REGISTER_FLOW_URL', (_req, res) => {
        res.writeHead(status);
        res.end(body);
      });
      try {
        const ip = freshIp();
        const email = `test.counted${status}${body ? 'ok' : ''}@henryschein.com`;
        for (let i = 0; i < 5; i += 1) assert.notEqual((await submitRegistration(signUp(email), ip)).status, 429, `${status} send ${i + 1}`);
        assert.equal((await submitRegistration(signUp(email), ip)).status, 429, `${status}: the sixth is refused`);
      } finally {
        await close(server);
      }
    }
  });

  test('the per-IP limit still counts every failed send', async () => {
    const { submitRegistration } = await import('./register-submit.ts');
    process.env.REGISTER_IP_LIMIT = '4';
    const server = await listen('REGISTER_FLOW_URL', (_req, res) => {
      res.writeHead(502);
      res.end();
    });
    try {
      const ip = freshIp();
      for (let i = 0; i < 4; i += 1) assert.equal((await submitRegistration(signUp('test.backstop@henryschein.com'), ip)).status, 502);
      assert.equal((await submitRegistration(signUp('test.backstop@henryschein.com'), ip)).status, 429, 'the fifth from that address');
    } finally {
      await close(server);
    }
  });
});

/**
 * A stand-in 1J that answers at once with `auto` when it is set, and otherwise holds each
 * request open until the test answers it by arrival order. arrived(n) fails after 3
 * seconds instead of hanging when a send never reaches it; shut() answers whatever is
 * still open so the server can close.
 */
async function heldFlow() {
  const arrivals = [];
  const waiters = [];
  const flow = {
    auto: null,
    count: () => arrivals.length,
    async arrived(n) {
      const deadline = Date.now() + 3000;
      while (arrivals.length < n) {
        const left = deadline - Date.now();
        if (left <= 0) assert.fail(`1J got ${arrivals.length} sends, expected ${n}`);
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, left);
          waiters.push(() => {
            clearTimeout(timer);
            resolve();
          });
        });
      }
    },
    async shut() {
      for (const res of arrivals) if (!res.writableEnded) res.end();
      flow.server.closeAllConnections();
      await close(flow.server);
    },
    answer(i, status) {
      const res = arrivals[i];
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(status === 200 ? '{"ok":true}' : '');
    },
  };
  flow.server = await listen('REGISTER_FLOW_URL', (req, res) => {
    req.resume();
    req.on('end', () => {
      arrivals.push(res);
      if (flow.auto !== null) flow.answer(arrivals.length - 1, flow.auto);
      for (const wake of waiters.splice(0)) wake();
    });
  });
  return flow;
}

describe('sign-up: overlapping sends refund their own count (Codex P1 re-check on #71)', { concurrency: false }, () => {
  test('a send refused while another is open does not take that one\'s refund', async () => {
    const { submitRegistration } = await import('./register-submit.ts');
    const flow = await heldFlow();
    try {
      const ip = freshIp();
      const email = 'test.overlap@henryschein.com';
      flow.auto = 200;
      for (let i = 0; i < 4; i += 1) assert.equal((await submitRegistration(signUp(email), ip)).status, 200, `send ${i + 1}`);
      flow.auto = null;
      const fifth = submitRegistration(signUp(email), ip);
      await flow.arrived(5);
      const sixth = await submitRegistration(signUp(email), ip);
      assert.equal(sixth.status, 429, 'the sixth is refused while the fifth is open');
      assert.equal(flow.count(), 5, 'the sixth never reached 1J');
      flow.answer(4, 502);
      assert.equal((await fifth).status, 502, 'the fifth fails');
      flow.auto = 200;
      const next = await submitRegistration(signUp(email), ip);
      assert.equal(next.status, 200, 'the next valid send gets its slot back');
      assert.equal(flow.count(), 6, 'and reaches 1J');
      assert.equal((await submitRegistration(signUp(email), ip)).status, 429, 'then the allowance is used up');
      assert.equal(flow.count(), 6);
    } finally {
      await flow.shut();
    }
  });

  test('several open sends with mixed outcomes each give back only their own count', async () => {
    const { submitRegistration } = await import('./register-submit.ts');
    const flow = await heldFlow();
    try {
      const ip = freshIp();
      const email = 'test.overlap-mixed@henryschein.com';
      const send = () => submitRegistration(signUp(email), ip);
      flow.auto = 200;
      assert.equal((await send()).status, 200, 'one send 1J took'); // counts: 1
      flow.auto = null;
      const a = send();
      const b = send();
      const c = send();
      const d = send();
      await flow.arrived(5); // counts: 5, all open
      for (let i = 0; i < 2; i += 1) assert.equal((await send()).status, 429, `refused ${i + 1} while four are open`);
      assert.equal(flow.count(), 5);
      flow.answer(3, 503); // c: not acted on, gives its count back
      assert.equal((await c).status, 502);
      const e = send(); // takes the slot c gave back
      await flow.arrived(6);
      assert.equal((await send()).status, 429, 'full again while d and e are open');
      flow.answer(1, 502); // a: gives its count back
      assert.equal((await a).status, 502);
      flow.answer(4, 504); // d: may have acted, still counts
      assert.equal((await d).status, 502);
      flow.answer(2, 200); // b: counts
      assert.equal((await b).status, 200);
      flow.answer(5, 200); // e: counts
      assert.equal((await e).status, 200);
      // Held now: the first send, b, d and e. One slot is left.
      flow.auto = 200;
      assert.equal((await send()).status, 200, 'the slot a gave back');
      assert.equal(flow.count(), 7);
      assert.equal((await send()).status, 429, 'and no more');
      assert.equal(flow.count(), 7, 'the refused send never reached 1J');
    } finally {
      await flow.shut();
    }
  });
});
