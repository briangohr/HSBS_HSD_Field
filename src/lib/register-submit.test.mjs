import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { beforeEach, test } from 'node:test';
import { format } from 'node:util';
import { SENT_MESSAGE } from './register-form.mjs';
import { REGISTER_FIELDS, pickFields, submitRegistration } from './register-submit.ts';

const form = {
  firstName: 'TEST',
  lastName: 'Rep',
  email: 'test.rep@henryschein.com',
  mobile: '303-555-0100',
  role: 'AE',
  managerName: 'TEST Manager',
  managerEmail: 'test.manager@henryschein.com',
  branch: 'TEST Branch',
  src: 'qr',
};

const envKeys = ['REGISTER_FLOW_URL', 'REGISTER_IP_LIMIT', 'JOIN_RGMS'];
let testNumber = 0;
beforeEach((t) => {
  testNumber += 1;
  const saved = Object.entries(process.env).filter(([key]) => envKeys.includes(key.toUpperCase()));
  for (const [key] of saved) delete process.env[key];
  t.after(() => {
    for (const key of envKeys) delete process.env[key];
    for (const [key, value] of saved) process.env[key] = value;
  });
});

// A fresh TEST-NET address starts both rate buckets empty for each test.
function send(changes = {}) {
  return submitRegistration({ ...form, ...changes }, `203.0.113.${testNumber}`);
}

function answer(res, status) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(status === 200 ? '{"ok":true}' : '{}');
}

async function fakeFlow(t, reply = (res) => answer(res, 200)) {
  const flow = { calls: 0, url: '' };
  const server = createServer((req, res) => {
    req.resume();
    flow.calls += 1;
    reply(res, flow.calls);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
  });
  flow.url = `http://127.0.0.1:${server.address().port}/flow`;
  process.env.REGISTER_FLOW_URL = flow.url;
  return flow;
}

function shortenFlowTimeout(t) {
  const timeout = AbortSignal.timeout;
  t.mock.method(AbortSignal, 'timeout', () => timeout(300));
}

test('a successful flow returns the sent message', async (t) => {
  const flow = await fakeFlow(t);
  assert.deepEqual(await send(), { status: 200, ok: true, message: SENT_MESSAGE });
  assert.equal(flow.calls, 1);
});

test('an invalid form returns field errors without calling the flow', async (t) => {
  const flow = await fakeFlow(t);
  const result = await send({ firstName: '' });
  assert.equal(result.status, 422);
  assert.ok(result.errors?.firstName);
  assert.equal(flow.calls, 0);
});

test('the configured address limit is checked before form validation', async (t) => {
  process.env.REGISTER_IP_LIMIT = '1';
  const flow = await fakeFlow(t);
  assert.equal((await send()).status, 200);
  assert.equal((await send({ firstName: '' })).status, 429);
  assert.equal(flow.calls, 1);
});

test('the email limit blocks the sixth send from the same address', async (t) => {
  const flow = await fakeFlow(t);
  for (let i = 0; i < 5; i += 1) assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 429);
  assert.equal(flow.calls, 5);
  assert.equal((await send({ email: 'test.other@henryschein.com' })).status, 200);
});

for (const [name, flowStatus, submitStatus] of [
  ['a refusal returns one email attempt', 400, 422],
  ['a server failure returns one email attempt', 500, 502],
]) {
  test(name, async (t) => {
    const flow = await fakeFlow(t, (res, call) => answer(res, call === 5 ? flowStatus : 200));
    for (let i = 0; i < 4; i += 1) assert.equal((await send()).status, 200);
    assert.equal((await send()).status, submitStatus);
    assert.equal((await send()).status, 200);
    assert.equal((await send()).status, 429);
    assert.equal(flow.calls, 6);
  });
}

test('a timeout uses one email attempt', async (t) => {
  const flow = await fakeFlow(t, (res, call) => {
    if (call !== 5) answer(res, 200);
  });
  for (let i = 0; i < 4; i += 1) assert.equal((await send()).status, 200);
  shortenFlowTimeout(t);
  assert.equal((await send()).status, 504);
  assert.equal((await send()).status, 429);
  assert.equal(flow.calls, 5);
});

test('a flow refusal in roster mode asks the rep to check their email', async (t) => {
  process.env.JOIN_RGMS = JSON.stringify([
    { region: 'OR', name: 'TEST Manager', email: 'test.manager@henryschein.com' },
  ]);
  const flow = await fakeFlow(t, (res) => answer(res, 400));
  assert.deepEqual(await send({ rgm: 'OR' }), {
    status: 422,
    error: 'Check your Henry Schein email, then try again.',
  });
  assert.equal(flow.calls, 1);
});

test('a flow refusal in free text mode asks the rep to check both emails', async (t) => {
  const flow = await fakeFlow(t, (res) => answer(res, 400));
  assert.deepEqual(await send(), {
    status: 422,
    error: "Check your Henry Schein email and your manager's, then try again.",
  });
  assert.equal(flow.calls, 1);
});

test('an unset flow URL returns 503', async () => {
  assert.equal((await send()).status, 503);
});

test('a stalled flow returns 504 with the timeout flag', async (t) => {
  const flow = await fakeFlow(t, () => {});
  shortenFlowTimeout(t);
  const result = await send();
  assert.equal(result.status, 504);
  assert.equal(result.timeout, true);
  assert.equal(flow.calls, 1);
});

test('a flow server error returns 502', async (t) => {
  const flow = await fakeFlow(t, (res) => answer(res, 500));
  assert.equal((await send()).status, 502);
  assert.equal(flow.calls, 1);
});

test('submission logs omit the emails, mobile number and flow URL', async (t) => {
  const messages = [];
  for (const method of ['debug', 'info', 'log', 'warn', 'error']) {
    t.mock.method(console, method, (...args) => messages.push(format(...args)));
  }
  const flow = await fakeFlow(t, (res, call) => {
    if (call === 1) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ email: form.email, mobile: form.mobile, url: flow.url }));
    }
  });
  assert.equal((await send()).status, 502);
  shortenFlowTimeout(t);
  assert.equal((await send()).status, 504);
  delete process.env.REGISTER_FLOW_URL;
  assert.equal((await send()).status, 503);
  const logs = messages.join('\n');
  assert.equal(logs.includes(form.email), false, 'rep email');
  assert.equal(logs.includes(form.managerEmail), false, 'manager email');
  assert.equal(logs.includes(form.mobile), false, 'mobile number');
  assert.equal(logs.includes(flow.url), false, 'flow URL');
});

test('pickFields keeps only the registration fields', () => {
  const fields = Object.fromEntries(REGISTER_FIELDS.map((name) => [name, `TEST ${name}`]));
  const input = { ...fields, extra: 'TEST extra' };
  assert.deepEqual(pickFields((name) => input[name]), fields);
});
