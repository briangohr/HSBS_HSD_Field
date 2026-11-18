// Browser test for the rep app pages (/join, /confirm), JavaScript off and on.
// Run: npm run e2e
//
// Starts a fake HSBS 1J on localhost and the Astro dev server, then drives Chromium.
// Nothing leaves the machine: REGISTER_FLOW_URL points at the fake. CI runs this on
// every PR that changes more than docs (.github/workflows/ci.yml, job e2e; decision 99).
//
// What must stay true (spec v3 section 2, Codex and Brian's #42 findings):
// - With JavaScript off, a sign-up never puts the rep's details in the URL.
// - Errors show and typed values stay, with JavaScript off and on.
// - A good sign-up shows the sent message, and 1J gets exactly the contract body.
// - A 200 that isn't JSON {"ok":true} is not a success.
// - Opening a /confirm link never confirms (only a read-only peek). A button press
//   confirms once; the link then shows as used, with HTTP 410 (#51). A bad token never
//   reaches 1J.
// - With REP_APP_ENABLED off, /join, /api/register, /confirm and /api/confirm answer 404.
// - /confirm is not used at launch (D18): with REP_APP_ENABLED on and REP_CONFIRM_ENABLED
//   unset, /confirm (GET and POST) and /api/confirm answer 404 and no made-up token
//   reaches 1J. The confirm checks above run with REP_CONFIRM_ENABLED=true, so the #43
//   code keeps working if it is ever turned on.

import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium, devices } from 'playwright';

const SITE_PORT = 4400;
const FLOW_PORT = 4401;
const BASE = `http://localhost:${SITE_PORT}`;
const PERSONAL = /henryschein|555|test\.rep|test\.manager|mobile|email/i;

let flowMode = 'ok';
const flowBodies = [];
// Confirm tokens the fake knows, and whether each is used. One per JS mode.
const TOKENS = { off: 'a1'.repeat(32), on: 'b2'.repeat(32) };
const usedTokens = new Set();
const known = new Set(Object.values(TOKENS));
const flow = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  flowBodies.push(body);
  if (body.action === 'confirm-peek' || body.action === 'confirm') {
    if (!known.has(body.token)) {
      res.writeHead(404);
      res.end();
      return;
    }
    if (usedTokens.has(body.token)) {
      res.writeHead(410);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    if (body.action === 'confirm-peek') {
      res.end(JSON.stringify({ repName: 'Test Rep', managerName: 'Test Manager' }));
    } else {
      usedTokens.add(body.token);
      res.end('{"ok":true}');
    }
    return;
  }
  if (flowMode === 'html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html>Sign in</html>');
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end('{"ok":true}');
});

function stopDev() {
  try {
    execFileSync('npx', ['astro', 'dev', 'stop'], { stdio: 'ignore' });
  } catch {
    // not running
  }
}

async function startDev(env) {
  stopDev();
  const child = spawn('npx', ['astro', 'dev', '--port', String(SITE_PORT)], {
    env: { ...process.env, ...env },
    stdio: 'ignore',
    detached: true,
  });
  // This site has no home page, and every page is a 404 with REP_APP_ENABLED off, so the
  // server is up once it serves a public file.
  for (let i = 0; i < 90; i += 1) {
    try {
      const res = await fetch(`${BASE}/favicon.svg`);
      if (res.status === 200) return child;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('dev server did not start');
}

function killDev(child) {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // already gone
  }
  stopDev();
}

async function fillForm(page, email) {
  const fields = {
    firstName: 'Test',
    lastName: 'Rep',
    email,
    mobile: '555 010 1234',
    managerName: 'Test Manager',
    managerEmail: 'test.manager@henryschein.com',
    branch: 'Columbus',
  };
  for (const [name, value] of Object.entries(fields)) await page.fill(`[name=${name}]`, value);
  await page.selectOption('[name=role]', 'AE');
}

async function submit(page, js) {
  await page.click('#join-send');
  if (js) await page.waitForTimeout(1000);
  else await page.waitForLoadState('load');
}

const results = [];
const check = (label, fn) =>
  fn().then(
    () => results.push(['PASS', label]),
    (err) => results.push(['FAIL', `${label}: ${err.message}`]),
  );

await new Promise((r) => flow.listen(FLOW_PORT, '127.0.0.1', r));
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const browser = await chromium.launch(launchOptions);

let dev = await startDev({ REP_APP_ENABLED: 'true', REP_CONFIRM_ENABLED: 'true', REGISTER_FLOW_URL: `http://127.0.0.1:${FLOW_PORT}/flow` });
try {
  for (const js of [false, true]) {
    const tag = js ? 'JS on' : 'JS off';
    // reducedMotion: the site's smooth scrolling otherwise keeps the button moving
    // while Playwright scrolls to it.
    const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js, reducedMotion: 'reduce' });
    const page = await ctx.newPage();

    await check(`${tag}: /j opens the sign-up page`, async () => {
      await page.goto(`${BASE}/j`);
      assert.equal(new URL(page.url()).pathname, '/join');
      assert.equal(await page.textContent('h1'), 'Set up your HSBS app.');
    });

    await check(`${tag}: a non Henry Schein email shows its error, keeps typed values, and puts nothing in the URL`, async () => {
      flowBodies.length = 0;
      await fillForm(page, 'test.rep@gmail.com');
      await submit(page, js);
      assert.match(await page.textContent('[data-for=email]'), /Henry Schein email/);
      assert.equal(await page.inputValue('[name=managerEmail]'), 'test.manager@henryschein.com');
      assert.equal(PERSONAL.test(decodeURIComponent(page.url())), false, page.url());
      assert.equal(flowBodies.length, 0, 'a bad sign-up must not reach 1J');
    });

    await check(`${tag}: a good sign-up shows the sent message, keeps the URL clean, and sends the contract body`, async () => {
      flowBodies.length = 0;
      await page.fill('[name=email]', 'test.rep@henryschein.com');
      await submit(page, js);
      await page.waitForSelector('#join-sent:not([hidden])', { timeout: 10000 });
      assert.equal(PERSONAL.test(decodeURIComponent(page.url())), false, page.url());
      assert.equal(flowBodies.length, 1);
      assert.deepEqual(flowBodies[0], {
        action: 'register',
        firstName: 'Test',
        lastName: 'Rep',
        email: 'test.rep@henryschein.com',
        mobile: '555-010-1234',
        role: 'AE',
        managerName: 'Test Manager',
        managerEmail: 'test.manager@henryschein.com',
        branch: 'Columbus',
        source: 'QR',
      });
    });

    await check(`${tag}: a 200 that isn't JSON {"ok":true} is shown as a failure`, async () => {
      flowMode = 'html';
      try {
        await page.goto(`${BASE}/join`);
        await fillForm(page, 'test.rep@henryschein.com');
        await submit(page, js);
        assert.equal(await page.isVisible('#join-sent'), false);
        assert.match(await page.textContent('#join-alert'), /not available/);
      } finally {
        flowMode = 'ok';
      }
    });

    await check(`${tag}: opening a confirm link only peeks; it never confirms`, async () => {
      flowBodies.length = 0;
      await page.goto(`${BASE}/confirm/${js ? TOKENS.on : TOKENS.off}`);
      assert.equal(await page.textContent('#cf-ask h1'), 'Is Test Rep on your team?');
      assert.deepEqual(flowBodies.map((b) => b.action), ['confirm-peek']);
    });

    await check(`${tag}: Yes confirms once, and the link then shows as used`, async () => {
      flowBodies.length = 0;
      await page.click('button[data-answer=yes]');
      if (js) await page.waitForSelector('#cf-yes-done:not([hidden])', { timeout: 10000 });
      else await page.waitForLoadState('load');
      assert.equal(await page.textContent('#cf-yes-done h1'), 'Done. Test Rep is on your team.');
      assert.equal(await page.isVisible('#cf-yes-done'), true);
      assert.equal(flowBodies.filter((b) => b.action === 'confirm' && b.answer === 'yes').length, 1);
      const again = await page.goto(`${BASE}/confirm/${js ? TOKENS.on : TOKENS.off}`);
      // #51: a used or expired link answers HTTP 410, not 200.
      assert.equal(again.status(), 410);
      assert.equal(await page.textContent('h1'), 'This link was already used or has expired.');
    });

    await check(`${tag}: a no-JavaScript answer on a used link is also HTTP 410 and sends no second confirm`, async () => {
      flowBodies.length = 0;
      const res = await fetch(`${BASE}/confirm/${js ? TOKENS.on : TOKENS.off}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', origin: BASE },
        body: 'answer=yes',
      });
      assert.equal(res.status, 410);
      assert.match(await res.text(), /This link was already used or has expired/);
      assert.deepEqual(flowBodies.map((b) => b.action), ['confirm-peek']);
    });

    await check(`${tag}: a malformed confirm token shows "does not work" and never reaches 1J`, async () => {
      flowBodies.length = 0;
      const res = await page.goto(`${BASE}/confirm/not-a-token`);
      assert.equal(res.status(), 404);
      assert.equal(await page.textContent('h1'), 'This link does not work.');
      assert.equal(flowBodies.length, 0);
    });

    await ctx.close();
  }
} finally {
  killDev(dev);
}

dev = await startDev({ REP_APP_ENABLED: 'true', REGISTER_FLOW_URL: `http://127.0.0.1:${FLOW_PORT}/flow` });
try {
  await check('launch (app on, REP_CONFIRM_ENABLED unset): /confirm and /api/confirm answer 404 and no token reaches 1J; /join still works', async () => {
    flowBodies.length = 0;
    for (const token of [TOKENS.off, TOKENS.on, 'c3'.repeat(32)]) {
      assert.equal((await fetch(`${BASE}/confirm/${token}`)).status, 404, token);
      const form = await fetch(`${BASE}/confirm/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', origin: BASE },
        body: 'answer=yes',
      });
      assert.equal(form.status, 404, token);
      const api = await fetch(`${BASE}/api/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, answer: 'yes' }),
      });
      assert.equal(api.status, 404, token);
    }
    assert.equal(flowBodies.length, 0, JSON.stringify(flowBodies));
    assert.equal((await fetch(`${BASE}/join`)).status, 200);
  });
} finally {
  killDev(dev);
}

// Roster match (Brian, 11/17): with JOIN_RGMS set, /join shows an RGM pick list in place of
// the manager and branch boxes. The page shows names and region codes only; the RGM
// email goes to 1J from the server.
const TEST_RGMS = [
  { region: 'TA', name: 'Test Rgm Alpha', email: 'test.rgm.alpha@henryschein.com' },
  { region: 'TB', name: 'Test Rgm Bravo', email: 'test.rgm.bravo@henryschein.com' },
];
dev = await startDev({ REP_APP_ENABLED: 'true', REGISTER_FLOW_URL: `http://127.0.0.1:${FLOW_PORT}/flow`, JOIN_RGMS: JSON.stringify(TEST_RGMS) });
try {
  for (const js of [false, true]) {
    const tag = js ? 'JS on' : 'JS off';
    const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const fillRoster = async (rgm) => {
      for (const [name, value] of Object.entries({ firstName: 'Test', lastName: 'Rep', email: 'test.rep@henryschein.com', mobile: '555 010 1234' })) {
        await page.fill(`[name=${name}]`, value);
      }
      await page.selectOption('[name=role]', 'FSC');
      if (rgm) await page.selectOption('[name=rgm]', rgm);
    };

    await check(`${tag}: roster form shows the RGM list, no manager or branch boxes, and no RGM email`, async () => {
      await page.goto(`${BASE}/join?src=qr`);
      assert.equal(await page.locator('[name=managerName], [name=managerEmail], [name=branch]').count(), 0);
      const labels = await page.locator('[name=rgm] option').allTextContents();
      assert.deepEqual(labels, ['Pick one', 'Test Rgm Alpha (TA)', 'Test Rgm Bravo (TB)', "Not listed, or I don't know"]);
      assert.equal((await page.content()).includes('test.rgm.'), false, 'an RGM email reached the page');
    });

    await check(`${tag}: roster form refuses a sign-up with no RGM picked, and nothing reaches 1J`, async () => {
      flowBodies.length = 0;
      await fillRoster('');
      await submit(page, js);
      assert.match(await page.textContent('[data-for=rgm]'), /Pick your RGM/);
      assert.equal(flowBodies.length, 0);
    });

    await check(`${tag}: picking an RGM sends that RGM's roster name, email and region in the same body shape`, async () => {
      flowBodies.length = 0;
      await page.goto(`${BASE}/join?src=qr`);
      await fillRoster('TB');
      await submit(page, js);
      await page.waitForSelector('#join-sent:not([hidden])', { timeout: 10000 });
      assert.equal(PERSONAL.test(decodeURIComponent(page.url())), false, page.url());
      assert.deepEqual(flowBodies, [
        {
          action: 'register',
          firstName: 'Test',
          lastName: 'Rep',
          email: 'test.rep@henryschein.com',
          mobile: '555-010-1234',
          role: 'FSC',
          managerName: 'Test Rgm Bravo',
          managerEmail: 'test.rgm.bravo@henryschein.com',
          branch: 'TB',
          source: 'QR',
        },
      ]);
    });

    await check(`${tag}: "Not listed" sends the manager and branch blank, for any role`, async () => {
      flowBodies.length = 0;
      await page.goto(`${BASE}/join?src=qr`);
      await fillRoster('none');
      await submit(page, js);
      await page.waitForSelector('#join-sent:not([hidden])', { timeout: 10000 });
      assert.equal(flowBodies.length, 1);
      assert.equal(flowBodies[0].role, 'FSC');
      assert.equal(flowBodies[0].managerName, '');
      assert.equal(flowBodies[0].managerEmail, '');
      assert.equal(flowBodies[0].branch, '');
    });

    await ctx.close();
  }
} finally {
  killDev(dev);
}

dev = await startDev({ REP_APP_ENABLED: 'false', REGISTER_FLOW_URL: `http://127.0.0.1:${FLOW_PORT}/flow` });
try {
  await check('switch off: /join, /api/register, /confirm and /api/confirm answer 404 and nothing reaches 1J', async () => {
    flowBodies.length = 0;
    assert.equal((await fetch(`${BASE}/join`)).status, 404);
    assert.equal((await fetch(`${BASE}/confirm/${'c3'.repeat(32)}`)).status, 404);
    for (const path of ['/api/register', '/api/confirm']) {
      const api = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'c3'.repeat(32), answer: 'yes' }),
      });
      assert.equal(api.status, 404, path);
    }
    assert.equal(flowBodies.length, 0);
  });
} finally {
  killDev(dev);
}

await browser.close();
flow.close();

for (const [status, label] of results) console.log(`${status}  ${label}`);
const failed = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
