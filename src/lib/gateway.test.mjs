// The gateway client, counted at a fake gateway on localhost (lean rebuild, G0), and the
// in-memory store the job tests use. Success is only 200 {"ok":true} after the write or send. A
// write with no clear answer is "maybe": it may have happened, so a caller never resends it.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { GatewayError, LISTS, createRow, gatewayEnabled, gatewayStore, patchRow, readRows, sendMail } from './gateway.mjs';
import { createFakeStore } from './gateway-fake.mjs';

const SECRET = 'test-secret-0123456789';
let server;
let posts;
let headers;
let reply;
beforeEach(async () => {
  posts = [];
  headers = [];
  reply = () => [200, { ok: true }];
  server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    posts.push(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
    headers.push(req.headers);
    const [status, value, extra = {}] = reply();
    res.writeHead(status, { 'content-type': 'application/json', ...extra });
    res.end(typeof value === 'string' ? value : JSON.stringify(value));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.GATEWAY_FLOW_URL = `http://127.0.0.1:${server.address().port}/gw`;
  process.env.GATEWAY_SECRET = SECRET;
  process.env.REP_APP_ENABLED = 'true';
  process.env.GATEWAY_ENABLED = 'true';
});
afterEach(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  for (const k of ['GATEWAY_FLOW_URL', 'GATEWAY_SECRET', 'REP_APP_ENABLED', 'GATEWAY_ENABLED']) delete process.env[k];
});

const kind = (k) => (err) => err instanceof GatewayError && err.kind === k;
const MAIL = { to: ['partner@example.invalid'], subject: 'New referral', html: '<p>x</p>' };

describe('switches and config', () => {
  test('both switches must be exactly true, and nothing is posted when off', async () => {
    assert.equal(gatewayEnabled(), true);
    process.env.GATEWAY_ENABLED = 'yes';
    assert.equal(gatewayEnabled(), false);
    await assert.rejects(readRows({ list: 'Routing' }), kind('disabled'));
    process.env.GATEWAY_ENABLED = 'true';
    delete process.env.REP_APP_ENABLED;
    assert.equal(gatewayEnabled(), false);
    assert.equal(posts.length, 0);
  });

  test('no URL, a plain http URL, a URL with a password, or a short secret is config and posts nothing', async () => {
    for (const url of ['', 'http://example.com/gw', 'https://user:pw@example.com/gw']) {
      process.env.GATEWAY_FLOW_URL = url;
      await assert.rejects(readRows({ list: 'Routing' }), kind('config'));
    }
    process.env.GATEWAY_FLOW_URL = `http://127.0.0.1:${server.address().port}/gw`;
    process.env.GATEWAY_SECRET = 'short';
    await assert.rejects(readRows({ list: 'Routing' }), kind('config'));
    assert.equal(posts.length, 0);
  });

  test('the secret goes in a header, never in the body', async () => {
    reply = () => [200, { ok: true, items: [], next: null }];
    await readRows({ list: 'Routing' });
    assert.equal(headers[0]['x-gw-secret'], SECRET);
    assert.ok(!JSON.stringify(posts[0]).includes(SECRET));
  });
});

describe('what is refused before anything is posted', () => {
  test('a list outside the allowlist, and no delete op exists', async () => {
    await assert.rejects(readRows({ list: 'Partner Links' }), kind('bad_request'));
    await assert.rejects(createRow({ list: 'SPIFF Ledger', fields: { Title: 'x' } }), kind('bad_request'));
    assert.deepEqual(Object.keys(gatewayStore).sort(), ['create', 'patch', 'read', 'send']);
    assert.equal(LISTS.includes('Partner Links'), false);
    assert.equal(posts.length, 0);
  });

  test('bad paging, bad clauses, empty or nested fields, a bad id or etag', async () => {
    await assert.rejects(readRows({ list: 'Routing', top: 501 }), kind('bad_request'));
    await assert.rejects(readRows({ list: 'Routing', skip: 100 }), kind('bad_request'), 'no offset paging: SharePoint ignores $skip on list items');
    await assert.rejects(
      readRows({ list: 'Routing', where: [{ column: 'ID', op: 'gt', value: 1 }, { column: 'ID', op: 'gt', value: 2 }] }),
      kind('bad_request'),
    );
    await assert.rejects(readRows({ list: 'Routing', where: [{ column: 'Title', op: 'startswith', value: 'x' }] }), kind('bad_request'));
    await assert.rejects(readRows({ list: 'Routing', where: [{ column: 'Title', op: 'gt', value: 1 }] }), kind('bad_request'));
    await assert.rejects(readRows({ list: 'Routing', where: [{ column: 'ID', op: 'gt', value: 'x' }] }), kind('bad_request'));
    await assert.rejects(readRows({ list: 'Routing', where: [{ column: 'ID', op: 'gt', value: -1 }] }), kind('bad_request'));
    await assert.rejects(createRow({ list: 'Routing', fields: {} }), kind('bad_request'));
    await assert.rejects(createRow({ list: 'Routing', fields: { A: { nested: 1 } } }), kind('bad_request'));
    await assert.rejects(patchRow({ list: 'Routing', id: 0, etag: '"1"', fields: { A: 1 } }), kind('bad_request'));
    await assert.rejects(patchRow({ list: 'Routing', id: 3, etag: '', fields: { A: 1 } }), kind('bad_request'));
    assert.equal(posts.length, 0);
  });

  test('a mail needs a recipient, valid addresses, a one-line subject, and at most 20 addresses', async () => {
    await assert.rejects(sendMail({ ...MAIL, to: [] }), kind('bad_request'));
    await assert.rejects(sendMail({ ...MAIL, to: ['not an address'] }), kind('bad_request'));
    await assert.rejects(sendMail({ ...MAIL, to: ['a@example.invalid; b@example.invalid'] }), kind('bad_request'));
    await assert.rejects(sendMail({ ...MAIL, subject: 'two\nlines' }), kind('bad_request'));
    await assert.rejects(sendMail({ ...MAIL, subject: '' }), kind('bad_request'));
    await assert.rejects(sendMail({ ...MAIL, cc: Array.from({ length: 20 }, (_, i) => `c${i}@example.invalid`) }), kind('bad_request'));
    assert.equal(posts.length, 0);
  });
});

describe('read', () => {
  test('sends the structured query and returns id, etag and fields', async () => {
    reply = () => [200, { ok: true, items: [{ id: 4, etag: '"2"', fields: { Title: 'HealthFirst' } }], next: null }];
    const out = await readRows({ list: 'Routing', select: ['Title'], where: [{ column: 'Title', op: 'eq', value: 'HealthFirst' }], top: 1 });
    assert.deepEqual(out, { items: [{ id: 4, etag: '"2"', fields: { Title: 'HealthFirst' } }], next: null });
    assert.deepEqual(posts[0], {
      op: 'read',
      list: 'Routing',
      select: ['Title'],
      where: [{ column: 'Title', op: 'eq', value: 'HealthFirst' }],
      top: 1,
    });
  });

  test('pages by id: next is the last row id, and rows out of order or a wrong next is a failed read', async () => {
    const rows = [
      { id: 4, etag: '"1"', fields: {} },
      { id: 9, etag: '"1"', fields: {} },
    ];
    reply = () => [200, { ok: true, items: rows, next: 9 }];
    assert.equal((await readRows({ list: 'Routing', top: 2 })).next, 9);
    reply = () => [200, { ok: true, items: rows, next: 2 }];
    await assert.rejects(readRows({ list: 'Routing', top: 2 }), kind('failed'));
    reply = () => [200, { ok: true, items: [], next: 9 }];
    await assert.rejects(readRows({ list: 'Routing', top: 2 }), kind('failed'));
    reply = () => [200, { ok: true, items: [rows[1], rows[0]], next: null }];
    await assert.rejects(readRows({ list: 'Routing', top: 2 }), kind('failed'));
  });

  test('a bad row, over 500 rows, a 202 or non-JSON is a failed read, never a short list', async () => {
    reply = () => [200, { ok: true, items: [{ id: 'x', etag: '"1"', fields: {} }] }];
    await assert.rejects(readRows({ list: 'Routing' }), kind('failed'));
    reply = () => [200, { ok: true, items: Array.from({ length: 501 }, (_, i) => ({ id: i + 1, etag: '"1"', fields: {} })) }];
    await assert.rejects(readRows({ list: 'Routing' }), kind('failed'));
    reply = () => [202, { ok: true, items: [] }];
    await assert.rejects(readRows({ list: 'Routing' }), kind('failed'));
    reply = () => [200, 'not json'];
    await assert.rejects(readRows({ list: 'Routing' }), kind('failed'));
  });
});

describe('writes', () => {
  test('create and patch answer only on 200 ok:true with the new etag', async () => {
    reply = () => [200, { ok: true, id: 9, etag: '"1"' }];
    assert.deepEqual(await createRow({ list: 'Service Cases', fields: { Title: 'HSBS-F1 | HealthFirst' } }), { id: 9, etag: '"1"' });
    reply = () => [200, { ok: true, etag: '"2"' }];
    assert.deepEqual(await patchRow({ list: 'Service Cases', id: 9, etag: '"1"', fields: { Status: 'Sent' } }), { etag: '"2"' });
    assert.equal(posts[1].etag, '"1"');
  });

  test('a stale etag is stale, not maybe', async () => {
    reply = () => [412, { ok: false, error: 'etag' }];
    await assert.rejects(patchRow({ list: 'Service Cases', id: 9, etag: '"1"', fields: { A: 1 } }), kind('stale'));
  });

  test('403 is not_allowed, 401 is config, 400 is a clear failed', async () => {
    reply = () => [403, { ok: false, error: 'recipient_not_allowed' }];
    await assert.rejects(sendMail(MAIL), kind('not_allowed'));
    reply = () => [401, {}];
    await assert.rejects(createRow({ list: 'Routing', fields: { A: 1 } }), kind('config'));
    reply = () => [400, { ok: false }];
    await assert.rejects(createRow({ list: 'Routing', fields: { A: 1 } }), kind('failed'));
  });

  test('a 202, a 5xx, a 429, a redirect, non-JSON, ok missing or no id is maybe', async () => {
    for (const r of [
      [202, { ok: true, id: 1, etag: '"1"' }],
      [500, { ok: false }],
      [429, {}],
      [302, {}, { location: 'https://example.invalid/' }],
      [200, 'not json'],
      [200, { id: 1, etag: '"1"' }],
      [200, { ok: true }],
    ]) {
      reply = () => r;
      await assert.rejects(createRow({ list: 'Routing', fields: { A: 1 } }), kind('maybe'));
    }
  });

  test('a mail with no clear answer is maybe, and a good one resolves', async () => {
    reply = () => [504, {}];
    await assert.rejects(sendMail(MAIL), kind('maybe'));
    reply = () => [200, { ok: true }];
    await sendMail({ ...MAIL, cc: ['rep@example.invalid'], replyTo: 'reply@example.invalid' });
    assert.deepEqual(posts.at(-1).cc, ['rep@example.invalid']);
  });

  test('a connection that drops is maybe on a write and failed on a read', async () => {
    await new Promise((r) => server.close(r));
    await assert.rejects(sendMail(MAIL), kind('maybe'));
    await assert.rejects(readRows({ list: 'Routing' }), kind('failed'));
  });

  test('the error never carries the URL or the secret', async () => {
    reply = () => [500, {}];
    const err = await createRow({ list: 'Routing', fields: { A: 1 } }).catch((e) => e);
    assert.ok(!JSON.stringify([err.message, err.name, err.kind, err.status]).includes('127.0.0.1'));
    assert.ok(!String(err.stack).includes(SECRET));
  });
});

describe('the fake store', () => {
  const setup = () => createFakeStore({ lists: { Routing: [{ Title: 'HealthFirst', Verified: true }, { Title: 'Unitas', Verified: false }] } });

  test('reads by clause, pages, and projects columns', async () => {
    const store = setup();
    const one = await store.read({ list: 'Routing', where: [{ column: 'Verified', op: 'eq', value: true }], select: ['Title'] });
    assert.deepEqual(one.items.map((r) => r.fields), [{ Title: 'HealthFirst' }]);
    const after = await store.read({ list: 'Routing', where: [{ column: 'ID', op: 'gt', value: 1 }] });
    assert.ok(after.items.every((r) => r.id > 1), 'gt on ID keeps later rows only');
    const page = await store.read({ list: 'Routing', top: 1 });
    assert.equal(page.next, 1, 'next is the last id of a full page');
    const rest = await store.read({ list: 'Routing', top: 1, where: [{ column: 'ID', op: 'gt', value: page.next }] });
    assert.deepEqual([rest.items.map((r) => r.id), rest.next], [[2], null]);
    await assert.rejects(store.read({ list: 'Routing', skip: 1 }), kind('bad_request'));
  });

  test('patch needs the current etag and a stale one changes nothing', async () => {
    const store = setup();
    const [row] = (await store.read({ list: 'Routing' })).items;
    const { etag } = await store.patch({ list: 'Routing', id: row.id, etag: row.etag, fields: { Verified: false } });
    await assert.rejects(store.patch({ list: 'Routing', id: row.id, etag: row.etag, fields: { Verified: true } }), kind('stale'));
    assert.equal(store.inspect.rows('Routing')[0].fields.Verified, false);
    assert.notEqual(etag, row.etag);
  });

  test('faults: fail does nothing, maybe_before does nothing, maybe_after is done', async () => {
    for (const [mode, rowsAfter, errKind] of [['fail', 0, 'failed'], ['maybe_before', 0, 'maybe'], ['maybe_after', 1, 'maybe']]) {
      const store = createFakeStore({ faults: [{ op: 'create', list: 'Field Send Log', nth: 1, mode }] });
      await assert.rejects(store.create({ list: 'Field Send Log', fields: { Title: 'k' } }), kind(errKind));
      assert.equal(store.inspect.rows('Field Send Log').length, rowsAfter, mode);
      if (mode !== 'maybe_after') await store.create({ list: 'Field Send Log', fields: { Title: 'k' } }); // nth 1 only
    }
  });

  test('send records the mail, and a recipient off the allow list is 403 with nothing recorded', async () => {
    const store = createFakeStore({ allowRecipients: ['ok@example.invalid'] });
    await store.send({ to: ['ok@example.invalid'], subject: 's', html: 'h' });
    await assert.rejects(store.send({ to: ['no@example.invalid'], subject: 's', html: 'h' }), kind('not_allowed'));
    assert.equal(store.inspect.sent.length, 1);
    assert.equal(store.inspect.writes, 1);
  });
});
