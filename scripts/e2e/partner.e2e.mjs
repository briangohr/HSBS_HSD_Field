// Browser test for the partner update page, /update/<key> (sheet PU, piece A).
// Run: npm run e2e. Starts a fake HSBS 7F on localhost (PARTNER_FLOW_URL) and the Astro dev
// server; nothing leaves the machine. Never a live flow.
//
// What must stay true:
// - With PARTNER_PAGE_ENABLED off (REP_APP_ENABLED on), /update/<key> is a plain 404,
//   /api/partner-save answers 404, and nothing is posted to 7F.
// - A key that is not 40 hex characters is 404 with no 7F call. An unknown key reads
//   "This link does not work." (404); an expired key the expired words (410).
// - The page lists open leads overdue first, with no phone, email or JDE, sets no-store and
//   noindex, and loads no analytics. No sideways scroll at 375px.
// - Save sends only touched leads, in the contract shape, and "Saved N updates." shows.
// - A missing answer names the lead and posts nothing. A 422 reload names the lead and keeps
//   every typed answer. A save with no clear answer is resent with the same submissionId and
//   the same updates.

import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium, devices } from 'playwright';

const SITE_PORT = 4404;
const FLOW_PORT = 4405;
const BASE = `http://localhost:${SITE_PORT}`;
const KEY = 'a1'.repeat(20);
const EXPIRED_KEY = 'e0'.repeat(20);
const UNKNOWN_KEY = 'f9'.repeat(20);
const PRIVATE = /303-555|001234|rep@example|doctor@example/;

const eastern = (n) => {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const TODAY = eastern(0);
const TOMORROW = eastern(1);

const LEADS = [
  {
    id: 36,
    ref: 'HSBS-F90',
    practice: 'TEST North Side Dental',
    contact: 'TEST Office Manager',
    company: 'HealthFirst',
    introducedOn: eastern(-3),
    status: '',
    talkedToDoctor: '',
    meetingDate: '',
    nextUpdateDue: eastern(1),
    missedUpdates: 0,
    doctorPhone: '303-555-0100',
    jde: '001234',
    repEmail: 'rep@example.com',
  },
  {
    id: 37,
    ref: 'HSBS-F91',
    practice: 'TEST East Dental',
    contact: 'TEST Doctor',
    company: 'HealthFirst',
    introducedOn: eastern(-6),
    status: 'Meeting set',
    talkedToDoctor: 'Yes',
    meetingDate: eastern(-1),
    nextUpdateDue: eastern(-1),
    missedUpdates: 1,
    doctorEmail: 'doctor@example.com',
  },
];

const bodies = [];
// Answers queued for the next saves; empty means 200 ok.
const saveReplies = [];
const flow = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  bodies.push(body);
  const send = (status, value) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(value === undefined ? '' : JSON.stringify(value));
  };
  if (body.key === EXPIRED_KEY) return send(410);
  if (body.key !== KEY) return send(404);
  if (body.action === 'leads') return send(200, { partner: 'TEST field partner', leads: LEADS });
  if (body.action === 'save') {
    const next = saveReplies.shift();
    if (next) return send(next[0], next[1]);
    return send(200, { ok: true, saved: body.updates.length });
  }
  return send(400);
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

const results = [];
const check = (label, fn) =>
  fn().then(
    () => results.push(['PASS', label]),
    (err) => results.push(['FAIL', `${label}: ${err.message}`]),
  );

// Astro's dev-only toolbar sits over the Save button in `astro dev`; partners never see it.
const open = async (page) => {
  await page.goto(`${BASE}/update/${KEY}`);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
};
const saves = () => bodies.filter((b) => b.action === 'save');
const postSave = (body) =>
  fetch(`${BASE}/api/partner-save`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

await new Promise((r) => flow.listen(FLOW_PORT, '127.0.0.1', r));
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const browser = await chromium.launch(launchOptions);
const FLOW_URL = `http://127.0.0.1:${FLOW_PORT}/flow`;

// 1. Page off: plain 404 and no 7F call.
let dev = await startDev({ REP_APP_ENABLED: 'true', PARTNER_FLOW_URL: FLOW_URL });
await check('off: page and save are 404, nothing posted', async () => {
  const page = await fetch(`${BASE}/update/${KEY}`);
  assert.equal(page.status, 404);
  assert.equal(await page.text(), 'Not found');
  const save = await postSave({ key: KEY, submissionId: crypto.randomUUID(), updates: [] });
  assert.equal(save.status, 404);
  assert.equal(bodies.length, 0);
});
killDev(dev);

// 2. Page on.
dev = await startDev({ REP_APP_ENABLED: 'true', PARTNER_PAGE_ENABLED: 'true', PARTNER_FLOW_URL: FLOW_URL });

await check('bad, unknown and expired keys', async () => {
  const short = await fetch(`${BASE}/update/RepTest_${'r'.repeat(32)}`);
  assert.equal(short.status, 404);
  assert.match(await short.text(), /This link does not work\./);
  assert.equal(bodies.length, 0, 'a bad key shape reached 7F');
  const unknown = await fetch(`${BASE}/update/${UNKNOWN_KEY}`);
  assert.equal(unknown.status, 404);
  assert.match(await unknown.text(), /This link does not work\./);
  const expired = await fetch(`${BASE}/update/${EXPIRED_KEY}`);
  assert.equal(expired.status, 410);
  assert.match(await expired.text(), /This link has expired\. Use the link in your latest email\./);
  const badSave = await postSave({ key: 'x', submissionId: crypto.randomUUID(), updates: [] });
  assert.equal(badSave.status, 404);
});

await check('page lists leads overdue first, no private fields, no analytics, no-store', async () => {
  const res = await fetch(`${BASE}/update/${KEY}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  const html = await res.text();
  assert.doesNotMatch(html, PRIVATE);
  assert.doesNotMatch(html, /_vercel\/insights|va\.vercel-scripts|speed-insights/);
  // Copy rules on what a partner reads (dev mode inlines scripts and CSS comments).
  assert.doesNotMatch(html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ''), /\u2014|\u2192|HSPA|HSRA|NumbersIQ/);
  assert.ok(html.indexOf('HSBS-F91') < html.indexOf('HSBS-F90'), 'overdue lead is not first');
  assert.match(html, /Overdue/);
  assert.match(html, /Lead updates for TEST field partner/);
});

const phone = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 } });

await check('375px: no sideways scroll', async () => {
  const page = await phone.newPage();
  await open(page);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(wide <= 0, `page is ${wide}px too wide`);
  await page.close();
});

await check('a missing answer names the lead and posts nothing', async () => {
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-36"][value="signed"]');
  await page.click('#pu-save');
  await page.waitForTimeout(300);
  assert.match(await page.textContent('#pu-status'), /Lead HSBS-F90: check Signed date\./);
  assert.equal(saves().length, 0);
  await page.close();
});

await check('save sends only touched leads and shows Saved', async () => {
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-36"][value="meeting"]');
  assert.equal(await page.isVisible('input[name="meetingDate-36"]'), true);
  await page.fill('input[name="meetingDate-36"]', TOMORROW);
  await page.fill('input[name="note-36"]', 'TEST call booked');
  await Promise.all([page.waitForURL(/saved=1/), page.click('#pu-save')]);
  await page.waitForLoadState('load');
  assert.match(await page.textContent('#pu-status'), /Saved 1 update\./);
  const [save] = saves();
  assert.equal(save.key, KEY);
  assert.match(save.submissionId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(save.updates, [
    { id: 36, choice: 'meeting', talkedToDoctor: 'Yes', meetingDate: TOMORROW, signedDate: '', signedProduct: '', closedReason: '', note: 'TEST call booked' },
  ]);
  await page.close();
});

await check('the page asks one question, grouped, with no talked-to-doctor question', async () => {
  const page = await phone.newPage();
  await open(page);
  assert.equal(await page.locator('input[name="talked-36"]').count(), 0);
  assert.equal(await page.locator('input[name="choice-36"][value="handback"]').count(), 0);
  const values = await page.$$eval('input[name="choice-36"]', (els) => els.map((e) => e.value));
  assert.deepEqual(values, ['qualified', 'trying', 'dq_noanswer', 'dq_notinterested', 'meeting', 'proposal', 'signed', 'lost', 'nochange']);
  const text = await page.textContent('li[data-id="36"]');
  assert.match(text, /Qualifying/);
  assert.match(text, /After qualified/);
  assert.match(text, /wants a demo/);
  await page.close();
});

await check('Qualified sends Talked To Doctor Yes with no other field', async () => {
  bodies.length = 0;
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-36"][value="qualified"]');
  await Promise.all([page.waitForURL(/saved=1/), page.click('#pu-save')]);
  assert.deepEqual(saves()[0].updates, [
    { id: 36, choice: 'qualified', talkedToDoctor: 'Yes', meetingDate: '', signedDate: '', signedProduct: '', closedReason: '', note: '' },
  ]);
  await page.close();
});

await check('No change sends no Talked To Doctor, so the stored answer stays', async () => {
  bodies.length = 0;
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-37"][value="nochange"]');
  await Promise.all([page.waitForURL(/saved=1/), page.click('#pu-save')]);
  assert.deepEqual(saves()[0].updates.map((u) => [u.id, u.choice, u.talkedToDoctor]), [[37, 'nochange', '']]);
  await page.close();
});

await check('a 422 reload names the lead and keeps typed answers', async () => {
  bodies.length = 0;
  saveReplies.push([422, { error: 'reload', id: 37 }]);
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-37"][value="lost"]');
  await page.selectOption('select[name="closedReason-37"]', 'Price');
  await page.fill('input[name="note-37"]', 'TEST price note');
  await page.click('#pu-save');
  await page.waitForFunction(() => /changed/.test(document.getElementById('pu-status')?.textContent ?? ''));
  assert.match(await page.textContent('#pu-status'), /Lead HSBS-F91 changed\. Reload the page\./);
  assert.equal(await page.inputValue('input[name="note-37"]'), 'TEST price note');
  assert.equal(await page.inputValue('select[name="closedReason-37"]'), 'Price');
  assert.equal(await page.isEnabled('input[name="note-37"]'), true);
  await page.close();
});

await check('no clear answer: Save again resends the same id and updates', async () => {
  bodies.length = 0;
  saveReplies.push([503, undefined]);
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-36"][value="dq_noanswer"]');
  await page.fill('input[name="note-36"]', 'TEST note one');
  await page.click('#pu-save');
  await page.waitForFunction(() => /taking too long/.test(document.getElementById('pu-status')?.textContent ?? ''));
  assert.equal(await page.isDisabled('input[name="note-36"]'), true, 'answers should lock until resent');
  await Promise.all([page.waitForURL(/saved=1/), page.click('#pu-save')]);
  const [first, second] = saves();
  assert.ok(first && second, 'expected two save posts');
  assert.equal(second.submissionId, first.submissionId);
  assert.deepEqual(second.updates, first.updates);
  assert.equal(first.updates[0].note, 'TEST note one');
  await page.close();
});

await check('the save API leaves the day rules to 7F, so a resend after midnight reaches it', async () => {
  bodies.length = 0;
  const res = await postSave({
    key: KEY,
    submissionId: crypto.randomUUID(),
    updates: [{ id: 36, choice: 'meeting', talkedToDoctor: 'Yes', meetingDate: eastern(-1) }],
  });
  assert.equal(res.status, 200);
  assert.equal(saves().length, 1);
  const blank = await postSave({ key: KEY, submissionId: crypto.randomUUID(), updates: [{ id: 36, choice: 'meeting', talkedToDoctor: 'Yes' }] });
  assert.equal(blank.status, 422);
  assert.deepEqual(await blank.json(), { error: 'bad_value', id: 36, field: 'meetingDate' });
  assert.equal(saves().length, 1);
  assert.equal(TODAY.length, 10);
});

killDev(dev);
await browser.close();
flow.close();

for (const [status, label] of results) console.log(`${status}  ${label}`);
const failed = results.filter(([s]) => s === 'FAIL').length;
console.log(failed ? `${failed} failed` : `all ${results.length} passed`);
process.exit(failed ? 1 : 0);
