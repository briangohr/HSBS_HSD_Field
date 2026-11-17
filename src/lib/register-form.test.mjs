import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, test } from 'node:test';
import {
  ROLES,
  SENT_MESSAGE,
  normalizeMobile,
  registerPayload,
  roleLabel,
  sourceFor,
  validateRegistration,
} from './register-form.mjs';
import {
  RegisterConfigError,
  RegisterRefusedError,
  RegisterTimeoutError,
  RegisterWriteError,
  postRegistration,
  repAppEnabled,
} from './register-flow.mjs';

const good = {
  firstName: ' Test ',
  lastName: 'Rep',
  email: 'Test.Rep@HenrySchein.com',
  mobile: '(555) 010-1234',
  role: 'AE',
  managerName: 'Test Manager',
  managerEmail: 'test.manager@henryschein.com',
  branch: 'Columbus',
};

describe('sign-up form rules', () => {
  test('a complete Henry Schein sign-up passes and is cleaned', () => {
    const r = validateRegistration(good);
    assert.equal(r.ok, true);
    assert.equal(r.value.firstName, 'Test');
    assert.equal(r.value.email, 'test.rep@henryschein.com');
    assert.equal(r.value.mobile, '555-010-1234');
  });

  test('a non Henry Schein email is refused, for the rep and the manager', () => {
    for (const email of ['test.rep@gmail.com', 'test.rep@henryschein.com.evil.io', 'test.rep@sub.henryschein.com', 'henryschein.com']) {
      const r = validateRegistration({ ...good, email });
      assert.equal(r.ok, false, email);
      assert.ok(r.errors.email, email);
    }
    const m = validateRegistration({ ...good, managerEmail: 'boss@outlook.com' });
    assert.equal(m.ok, false);
    assert.ok(m.errors.managerEmail);
  });

  test('an AE may leave the manager blank (Brian, 11/14: decision 113)', () => {
    const r = validateRegistration({ ...good, role: 'AE', managerName: '', managerEmail: '' });
    assert.equal(r.ok, true);
    assert.equal(r.value.managerName, '');
    assert.equal(r.value.managerEmail, '');
    assert.equal(registerPayload(r.value, 'QR').managerEmail, '');
  });

  test('an AE who gives a manager still gets the manager checked', () => {
    const r = validateRegistration({ ...good, role: 'AE', managerName: '', managerEmail: 'boss@outlook.com' });
    assert.equal(r.ok, false);
    assert.ok(r.errors.managerEmail);
    assert.ok(r.errors.managerName, 'an email with no name is half a manager');
    const own = validateRegistration({ ...good, role: 'AE', managerEmail: 'test.rep@henryschein.com' });
    assert.match(own.errors.managerEmail, /can't be your own/);
  });

  test('every other role still needs a manager', () => {
    for (const role of ROLES.filter((x) => x !== 'AE')) {
      const r = validateRegistration({ ...good, role, managerName: '', managerEmail: '' });
      assert.equal(r.ok, false, role);
      assert.ok(r.errors.managerName && r.errors.managerEmail, role);
    }
  });

  test("the manager's email can't be the rep's own, in any letter case (D2)", () => {
    const r = validateRegistration({ ...good, managerEmail: 'TEST.REP@henryschein.com' });
    assert.equal(r.ok, false);
    assert.match(r.errors.managerEmail, /can't be your own/);
  });

  test('names: curly apostrophes become straight, and digits or symbols are refused (one rule with the confirm page)', () => {
    const r = validateRegistration({ ...good, lastName: 'O\u2019Neill', managerName: 'Ana D\u2019Souza-Ruiz' });
    assert.equal(r.ok, true);
    assert.equal(r.value.lastName, "O'Neill");
    assert.equal(r.value.managerName, "Ana D'Souza-Ruiz");
    for (const bad of ['Rep2', '<b>Rep</b>', 'Rep (Jr)', 'x@y']) {
      const b = validateRegistration({ ...good, lastName: bad });
      assert.equal(b.ok, false, bad);
      assert.ok(b.errors.lastName, bad);
    }
    assert.equal(validateRegistration({ ...good, firstName: 'Ren\u00e9e', lastName: 'M\u00fcller' }).ok, true);
  });

  test('every field is required, and each gets its own message', () => {
    const r = validateRegistration({});
    assert.equal(r.ok, false);
    assert.deepEqual(Object.keys(r.errors).sort(), ['branch', 'email', 'firstName', 'lastName', 'managerEmail', 'managerName', 'mobile', 'role']);
  });

  test('the role must be one of the seven roster choices', () => {
    assert.deepEqual(ROLES, ['AE', 'FSC', 'RM', 'ES', 'EST', 'HSFS', 'Other']);
    assert.equal(validateRegistration({ ...good, role: 'CEO' }).ok, false);
    // The field app offers no PVA choice, and refuses one posted around the page.
    assert.equal(validateRegistration({ ...good, role: 'PVA' }).ok, false);
    // Thrive Signature is a program, not a role (Brian, 11/17).
    assert.equal(validateRegistration({ ...good, role: 'Thrive Signature' }).ok, false);
    // The drop-down's words are never sent: RGM is a label, RM is what 1J stores.
    assert.equal(validateRegistration({ ...good, role: 'RGM' }).ok, false);
  });

  test('each new role is accepted, and RM shows as RGM', () => {
    for (const role of ['ES', 'EST', 'HSFS']) {
      assert.equal(validateRegistration({ ...good, role }).ok, true, role);
    }
    assert.equal(roleLabel('RM'), 'RGM');
    for (const role of ROLES.filter((r) => r !== 'RM')) assert.equal(roleLabel(role), role);
  });

  test('mobile takes 10 digits, with or without a leading 1', () => {
    assert.equal(normalizeMobile('1-555-010-1234'), '555-010-1234');
    assert.equal(normalizeMobile('555 0101'), '');
    assert.equal(normalizeMobile('+44 20 7946 0958'), '');
  });

  test('control characters and long values are trimmed, not passed on', () => {
    const r = validateRegistration({ ...good, branch: `North\u0000\n${'x'.repeat(200)}` });
    assert.equal(r.ok, true);
    assert.equal(r.value.branch.includes('\u0000'), false);
    assert.ok(r.value.branch.length <= 80);
  });

  test('the payload carries only checked fields and a known source', () => {
    const r = validateRegistration({ ...good, extra: 'ignored' });
    const body = registerPayload(r.value, 'QR');
    assert.deepEqual(Object.keys(body).sort(), ['action', 'branch', 'email', 'firstName', 'lastName', 'managerEmail', 'managerName', 'mobile', 'role', 'source']);
    assert.equal(body.action, 'register');
    assert.equal(registerPayload(r.value, 'Made up').source, 'Other');
  });

  test('?src maps to the Rep Roster Source choices', () => {
    assert.equal(sourceFor('qr'), 'QR');
    assert.equal(sourceFor('AE'), 'AE link');
    assert.equal(sourceFor('thrive'), 'Thrive Signature link');
    assert.equal(sourceFor(''), 'Other');
    assert.equal(sourceFor(undefined), 'Other');
  });

  test('the sent message is the spec wording and says nothing about who is registered', () => {
    assert.match(SENT_MESSAGE, /^Check your Henry Schein email\. Your personal link is there\./);
    assert.equal(/already|registered|new/i.test(SENT_MESSAGE), false);
  });
});

function listen(handler) {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      process.env.REGISTER_FLOW_URL = `http://127.0.0.1:${address.port}/flow`;
      resolve(server);
    });
  });
}
const close = (server) => new Promise((resolve) => server.close(resolve));

describe('HSBS 1J client', { concurrency: false }, () => {
  const payload = registerPayload(validateRegistration(good).value, 'QR');

  test('posts JSON and resolves on 200', async () => {
    let seen;
    const server = await listen(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      seen = { type: req.headers['content-type'], body: JSON.parse(Buffer.concat(chunks).toString()) };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
    try {
      await postRegistration(payload);
      assert.equal(seen.type, 'application/json');
      assert.deepEqual(seen.body, payload);
    } finally {
      await close(server);
    }
  });

  test('a 4xx is a refusal; 202, 302 and 500 are failed sends', async () => {
    for (const [status, Err] of [[400, RegisterRefusedError], [202, RegisterWriteError], [302, RegisterWriteError], [500, RegisterWriteError]]) {
      const server = await listen((_req, res) => {
        res.writeHead(status, status === 302 ? { location: 'https://example.invalid/' } : {});
        res.end();
      });
      try {
        await assert.rejects(() => postRegistration(payload), (err) => err instanceof Err && err.status === status);
      } finally {
        await close(server);
      }
    }
  });

  test('a 200 without the JSON body {"ok":true} is a failed send, not a success', async () => {
    for (const [label, body] of [
      ['empty', ''],
      ['html', '<html><body>Sign in to continue</body></html>'],
      ['json without ok', '{"status":"done"}'],
      ['ok false', '{"ok":false}'],
      ['ok as a string', '{"ok":"true"}'],
    ]) {
      const server = await listen((_req, res) => {
        res.writeHead(200, { 'content-type': label === 'html' ? 'text/html' : 'application/json' });
        res.end(body);
      });
      try {
        await assert.rejects(() => postRegistration(payload), (err) => err instanceof RegisterWriteError && err.status === 200, label);
      } finally {
        await close(server);
      }
    }
  });

  test('a body that stalls after the 200 headers is a timeout, not a success', async () => {
    const server = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('{"ok":');
      // never finishes
    });
    try {
      await assert.rejects(() => postRegistration(payload, 300), RegisterTimeoutError);
    } finally {
      server.closeAllConnections?.();
      await close(server);
    }
  });

  test('a stalled flow times out without the URL in the error', async () => {
    const server = await listen(() => {});
    try {
      await assert.rejects(() => postRegistration(payload, 100), (err) => {
        assert.ok(err instanceof RegisterTimeoutError);
        assert.equal(String(err.message).includes('127.0.0.1'), false);
        return true;
      });
    } finally {
      server.closeAllConnections?.();
      await close(server);
    }
  });

  test('no URL, a plain http URL, or a URL with a password is a config error', async () => {
    const prior = process.env.REGISTER_FLOW_URL;
    try {
      for (const url of [undefined, 'http://example.com/flow', 'https://user:pass@example.com/flow', 'not a url']) {
        if (url === undefined) delete process.env.REGISTER_FLOW_URL;
        else process.env.REGISTER_FLOW_URL = url;
        await assert.rejects(() => postRegistration(payload), RegisterConfigError, String(url));
      }
    } finally {
      if (prior === undefined) delete process.env.REGISTER_FLOW_URL;
      else process.env.REGISTER_FLOW_URL = prior;
    }
  });

  test('REP_APP_ENABLED is off unless it is exactly "true" (D14)', () => {
    const prior = process.env.REP_APP_ENABLED;
    try {
      for (const v of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
        if (v === undefined) delete process.env.REP_APP_ENABLED;
        else process.env.REP_APP_ENABLED = v;
        assert.equal(repAppEnabled(), false, String(v));
      }
      process.env.REP_APP_ENABLED = 'true';
      assert.equal(repAppEnabled(), true);
    } finally {
      if (prior === undefined) delete process.env.REP_APP_ENABLED;
      else process.env.REP_APP_ENABLED = prior;
    }
  });
});

describe('HSBS 1J manager confirm', { concurrency: false }, () => {
  const TOKEN = 'a1'.repeat(32);

  test('the token is exactly 64 lowercase hex characters', async () => {
    const { isConfirmToken } = await import('./register-flow.mjs');
    assert.equal(isConfirmToken(TOKEN), true);
    for (const bad of ['A1'.repeat(32), 'a1'.repeat(31), `${'a1'.repeat(32)}0`, '../etc', '', null, 42]) {
      assert.equal(isConfirmToken(bad), false, String(bad));
    }
  });

  test('peek shows a name with a curly apostrophe, the same name sign-up accepts', async () => {
    const { peekConfirm } = await import('./register-flow.mjs');
    const server = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ repName: 'Pat O\u2019Neill', managerName: 'Ana D\u2019Souza-Ruiz' }));
    });
    try {
      assert.deepEqual(await peekConfirm(TOKEN), { repName: "Pat O'Neill", managerName: "Ana D'Souza-Ruiz" });
    } finally {
      await close(server);
    }
  });

  test('peek posts confirm-peek, reads names, and never sends an answer', async () => {
    const { peekConfirm } = await import('./register-flow.mjs');
    let seen;
    const server = await listen(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      seen = JSON.parse(Buffer.concat(chunks).toString());
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ repName: 'Test Rep', managerName: 'Test Manager' }));
    });
    try {
      assert.deepEqual(await peekConfirm(TOKEN), { repName: 'Test Rep', managerName: 'Test Manager' });
      assert.deepEqual(seen, { action: 'confirm-peek', token: TOKEN });
    } finally {
      await close(server);
    }
  });

  test('peek: 404 is unknown, 410 is used or expired, a bad body is a failure', async () => {
    const { peekConfirm, ConfirmUnknownError, ConfirmUsedError } = await import('./register-flow.mjs');
    for (const [status, body, Err] of [
      [404, '', ConfirmUnknownError],
      [410, '', ConfirmUsedError],
      [200, 'not json', RegisterWriteError],
      [200, JSON.stringify({ repName: '<script>' }), RegisterWriteError],
      [500, '', RegisterWriteError],
    ]) {
      const server = await listen((_req, res) => {
        res.writeHead(status);
        res.end(body);
      });
      try {
        await assert.rejects(() => peekConfirm(TOKEN), Err, `${status} ${body}`);
      } finally {
        await close(server);
      }
    }
  });

  test('a bad token never reaches the flow', async () => {
    const { peekConfirm, answerConfirm, ConfirmUnknownError } = await import('./register-flow.mjs');
    let hits = 0;
    const server = await listen((_req, res) => {
      hits += 1;
      res.writeHead(200);
      res.end('{}');
    });
    try {
      await assert.rejects(() => peekConfirm('nope'), ConfirmUnknownError);
      await assert.rejects(() => answerConfirm('nope', 'yes'), ConfirmUnknownError);
      assert.equal(hits, 0);
    } finally {
      await close(server);
    }
  });

  test('answer posts confirm with yes or no, and refuses anything else', async () => {
    const { answerConfirm } = await import('./register-flow.mjs');
    const seen = [];
    const server = await listen(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      seen.push(JSON.parse(Buffer.concat(chunks).toString()));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
    try {
      assert.equal(await answerConfirm(TOKEN, 'yes'), 'confirmed');
      assert.equal(await answerConfirm(TOKEN, 'no'), 'declined');
      await assert.rejects(() => answerConfirm(TOKEN, 'maybe'), RegisterRefusedError);
      assert.deepEqual(seen, [
        { action: 'confirm', token: TOKEN, answer: 'yes' },
        { action: 'confirm', token: TOKEN, answer: 'no' },
      ]);
    } finally {
      await close(server);
    }
  });

  test('a second answer on a used token is a 410, not a second confirm', async () => {
    const { answerConfirm, ConfirmUsedError } = await import('./register-flow.mjs');
    let used = false;
    const server = await listen((_req, res) => {
      res.writeHead(used ? 410 : 200, { 'content-type': 'application/json' });
      res.end(used ? '' : '{"ok":true}');
      used = true;
    });
    try {
      assert.equal(await answerConfirm(TOKEN, 'yes'), 'confirmed');
      await assert.rejects(() => answerConfirm(TOKEN, 'yes'), ConfirmUsedError);
    } finally {
      await close(server);
    }
  });
  test('confirm: a 200 without {"ok":true}, or a stalled body, is a failure, never a confirm', async () => {
    const { answerConfirm, peekConfirm } = await import('./register-flow.mjs');
    for (const [label, body] of [['empty', ''], ['html', '<html>Sign in</html>'], ['ok false', '{"ok":false}']]) {
      const server = await listen((_req, res) => {
        res.writeHead(200);
        res.end(body);
      });
      try {
        await assert.rejects(() => answerConfirm(TOKEN, 'yes'), RegisterWriteError, label);
      } finally {
        await close(server);
      }
    }
    for (const call of [() => answerConfirm(TOKEN, 'yes', 300), () => peekConfirm(TOKEN, 300)]) {
      const server = await listen((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.write('{"ok":');
      });
      try {
        await assert.rejects(call, RegisterTimeoutError);
      } finally {
        server.closeAllConnections?.();
        await close(server);
      }
    }
  });
});
