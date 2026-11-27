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
//   A save 7F answers with fewer saved than sent says how many did not save, and a zero
//   save says nothing saved, after the reload. More saved than sent is no clear answer.
// - A missing answer names the lead and posts nothing. A 422 reload names the lead and keeps
//   every typed answer. A save with no clear answer is resent with the same submissionId and
//   the same updates.
// - With PARTNER_DEAL_VALUE_ENABLED off, the page has no deal value field and the save body is
//   exactly as before, even when 7F sends a stored value. On, the field shows only on Demo
//   set, Proposal and Signed, pre-filled; "$25,000" is sent as 25000; the stored value left
//   as it is is sent blank; bad input names the lead and posts nothing.
// - With PARTNER_PARKED_ENABLED off, the page has no Set aside choice, no park field and no
//   "Parked until", even when 7F sends parkedUntil. On, every lead offers "Set aside for later
//   (Parked)" and a parked lead also offers "Pick it back up"; a park missing reason and name
//   names both and posts nothing; a full park sends the date, reason and name; a park with no
//   date shows "Saved as Closed Lost, no revisit date." after the reload.

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
    dealValue: '25000',
  },
  {
    // Moved on from a meeting: the case still holds the old Meeting Date.
    id: 38,
    ref: 'HSBS-F92',
    practice: 'TEST West Dental',
    contact: 'TEST Doctor',
    company: 'HealthFirst',
    introducedOn: eastern(-6),
    status: 'Trying to reach',
    talkedToDoctor: 'No, still trying',
    meetingDate: eastern(3),
    nextUpdateDue: eastern(5),
    missedUpdates: 0,
    // Parked until the revisit date (7F sends it; the page reads it only with the switch on).
    parkedUntil: eastern(5),
  },
  {
    // A Direct Dental lead the rep marked Group: 7F asks the office count.
    id: 39,
    ref: 'HSBS-F93',
    practice: 'TEST Group Dental',
    contact: 'TEST Office Manager',
    company: 'HS Staffing / Recruiting Services (including GoTu)',
    introducedOn: eastern(-2),
    status: '',
    talkedToDoctor: '',
    meetingDate: '',
    nextUpdateDue: eastern(2),
    missedUpdates: 0,
    askOffices: true,
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
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(await page.text(), 'Not found');
  const save = await postSave({ key: KEY, submissionId: crypto.randomUUID(), updates: [] });
  assert.equal(save.status, 404);
  assert.equal(bodies.length, 0);
});
killDev(dev);

// 2. Page on.
dev = await startDev({ REP_APP_ENABLED: 'true', PARTNER_PAGE_ENABLED: 'true', PARTNER_OFFICE_CHECK: 'true', PARTNER_FLOW_URL: FLOW_URL });

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
  // A meeting date shows only while the lead stands at a meeting.
  const card = (ref) => html.slice(html.indexOf(ref), html.indexOf('</li>', html.indexOf(ref)));
  assert.match(card('HSBS-F91'), /Stage<\/dt>\s*<dd[^>]*>Meeting set, meeting /);
  assert.match(card('HSBS-F91'), /Next update<\/dt>\s*<dd[^>]*>Overdue/);
  assert.match(card('HSBS-F92'), /Stage<\/dt>\s*<dd[^>]*>Not reached yet/);
  assert.match(card('HSBS-F90'), /Introduced<\/dt>\s*<dd[^>]*>[A-Z][a-z]{2} \d{1,2}, \d{4}/);
  assert.doesNotMatch(card('HSBS-F92'), /meeting [A-Z][a-z]{2} \d/);
});

const phone = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 } });

await check('deal value switch off: no field, no attribute, even with a stored value', async () => {
  const html = await (await fetch(`${BASE}/update/${KEY}`)).text();
  assert.doesNotMatch(html, /dealValue-|data-deal-value|Year 1 deal value/);
});

await check('parked switch off: no Set aside choice, no park field, even with parkedUntil', async () => {
  const html = await (await fetch(`${BASE}/update/${KEY}`)).text();
  assert.doesNotMatch(html, /parkDate-|parkReason-|parkedBy-|data-parked|Set aside|Parked until|Pick it back up|value="parked"|value="unpark"/);
});

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
    { id: 36, choice: 'meeting', talkedToDoctor: 'Yes', meetingDate: TOMORROW, signedDate: '', signedProduct: '', closedReason: '', note: 'TEST call booked', offices: '' },
  ]);
  await page.close();
});

await check('the page asks one question, grouped, with no talked-to-doctor question', async () => {
  const page = await phone.newPage();
  await open(page);
  assert.equal(await page.locator('input[name="talked-36"]').count(), 0);
  assert.equal(await page.locator('input[name="choice-36"][value="handback"]').count(), 0);
  const values = await page.$$eval('input[name="choice-36"]', (els) => els.map((e) => e.value));
  assert.deepEqual(values, ['qualified', 'trying', 'dq_noanswer', 'meeting', 'proposal', 'signed', 'lost']);
  assert.equal(await page.locator('input[name="nochange-36"]').count(), 1);
  const text = await page.textContent('li[data-id="36"]');
  assert.match(text, /Qualifying/);
  assert.match(text, /After qualified/);
  assert.match(text, /wants a demo/);
  assert.match(text, /Counts as this week's update\./);
  // A lead at Meeting set is qualified: the Qualifying group is frozen.
  const later = await page.$$eval('input[name="choice-37"]', (els) => els.map((e) => e.value));
  assert.deepEqual(later, ['meeting', 'proposal', 'signed', 'lost']);
  const text37 = await page.textContent('li[data-id="37"]');
  assert.match(text37, /Reached the customer \(done\)/);
  assert.match(text37, /Keeps it at Meeting set\./);
  // Trying to reach is not qualified yet: every choice is offered.
  assert.equal(await page.locator('input[name="choice-38"]').count(), 7);
  await page.close();
});

await check('Qualified sends Talked To Doctor Yes with no other field', async () => {
  bodies.length = 0;
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-36"][value="qualified"]');
  await Promise.all([page.waitForURL(/saved=1/), page.click('#pu-save')]);
  assert.deepEqual(saves()[0].updates, [
    { id: 36, choice: 'qualified', talkedToDoctor: 'Yes', meetingDate: '', signedDate: '', signedProduct: '', closedReason: '', note: '', offices: '' },
  ]);
  await page.close();
});

await check('a Group lead asks the office count on a qualifying choice; the answer is sent', async () => {
  bodies.length = 0;
  const page = await phone.newPage();
  await open(page);
  assert.equal(await page.locator('input[name="offices-36"]').count(), 0, 'a lead 7F did not flag asks nothing');
  assert.equal(await page.isVisible('input[name="offices-39"][value="yes"]'), false);
  await page.check('input[name="choice-39"][value="trying"]');
  assert.equal(await page.isVisible('input[name="offices-39"][value="yes"]'), false, 'trying does not ask');
  await page.check('input[name="choice-39"][value="qualified"]');
  assert.equal(await page.isVisible('input[name="offices-39"][value="yes"]'), true);
  assert.match(await page.textContent('li[data-id="39"]'), /Does it have 3 or more locations\?/);
  await page.click('#pu-save');
  await page.waitForTimeout(300);
  assert.match(await page.textContent('#pu-status'), /Lead HSBS-F93: check Office count\./);
  assert.equal(saves().length, 0, 'saved with no office count');
  await page.check('input[name="offices-39"][value="no"]');
  await Promise.all([page.waitForURL(/saved=1/), page.click('#pu-save')]);
  assert.deepEqual(saves()[0].updates, [
    { id: 39, choice: 'qualified', talkedToDoctor: 'Yes', meetingDate: '', signedDate: '', signedProduct: '', closedReason: '', note: '', offices: 'no' },
  ]);
  await page.close();
});

await check('No change sends no Talked To Doctor, so the stored answer stays', async () => {
  bodies.length = 0;
  const page = await phone.newPage();
  await open(page);
  // A stage picked first is cleared and greyed out when No change is ticked.
  await page.check('input[name="choice-37"][value="proposal"]');
  await page.check('input[name="nochange-37"]');
  assert.equal(await page.isChecked('input[name="choice-37"][value="proposal"]'), false);
  assert.equal(await page.isDisabled('input[name="choice-37"][value="proposal"]'), true);
  await page.uncheck('input[name="nochange-37"]');
  assert.equal(await page.isDisabled('input[name="choice-37"][value="proposal"]'), false);
  await page.check('input[name="nochange-37"]');
  await Promise.all([page.waitForURL(/saved=1/), page.click('#pu-save')]);
  assert.deepEqual(saves()[0].updates.map((u) => [u.id, u.choice, u.talkedToDoctor]), [[37, 'nochange', '']]);
  await page.close();
});

// Release A (Brian, 11/23/2026): one qualifying line, a sticky Save with a live count, a
// complete card folds to "Selected: X" with Change, a navy focus ring. The 7F body is unchanged.
const label = async (page) => (await page.textContent('#pu-save')).trim();
const isFolded = (page, id) => page.isVisible(`li[data-id="${id}"] [data-picked]`);

await check('Release A: one qualifying line per lead, no repeated hints, no pay words', async () => {
  const page = await phone.newPage();
  await open(page);
  for (const id of [36, 37, 38, 39]) {
    const t = await page.textContent(`li[data-id="${id}"]`);
    assert.equal((t.match(/Demo set, Proposal, and Signed count as reached and qualified\./g) ?? []).length, 1, `lead ${id}`);
  }
  const all = await page.textContent('#pu-form');
  assert.doesNotMatch(all, /Counts as reached and qualified/);
  assert.doesNotMatch(all, /\$\d/);
  await page.close();
});

await check('Release A: Save counts complete leads; a card folds when you move on; Change keeps every value', async () => {
  bodies.length = 0;
  const page = await phone.newPage();
  await open(page);
  assert.equal(await label(page), 'Save');
  assert.equal(await page.isDisabled('#pu-save'), true, 'nothing picked: Save is off');
  // Demo set needs its date: not complete, not counted, not folded, but Save turns on.
  await page.check('input[name="choice-36"][value="meeting"]');
  assert.equal(await label(page), 'Save');
  assert.equal(await page.isEnabled('#pu-save'), true);
  await page.fill('input[name="meetingDate-36"]', TOMORROW);
  assert.equal(await label(page), 'Save 1 update');
  await page.fill('input[name="note-36"]', 'TEST fold note');
  assert.equal(await isFolded(page, 36), false, 'no fold while still in the card');
  // Moving on to another lead folds 36.
  await page.check('input[name="choice-38"][value="trying"]');
  assert.equal(await isFolded(page, 36), true);
  assert.equal(await page.isVisible('input[name="note-36"]'), false);
  assert.equal((await page.textContent('li[data-id="36"] [data-picked-words]')).trim(), 'Selected: Demo set');
  assert.equal(await label(page), 'Save 2 updates');
  // Changing an answer counts the lead once.
  await page.check('input[name="choice-38"][value="qualified"]');
  assert.equal(await label(page), 'Save 2 updates');
  assert.equal(await isFolded(page, 38), false);
  // Direct Dental group lead: qualifying is not complete until the office answer.
  await page.check('input[name="choice-39"][value="qualified"]');
  assert.equal(await isFolded(page, 38), true);
  assert.equal(await label(page), 'Save 2 updates');
  assert.equal(await isFolded(page, 39), false);
  await page.check('input[name="offices-39"][value="yes"]');
  assert.equal(await label(page), 'Save 3 updates');
  // Change restores the card with every value.
  await page.click('li[data-id="36"] [data-change]');
  assert.equal(await isFolded(page, 36), false);
  assert.equal(await page.isChecked('input[name="choice-36"][value="meeting"]'), true);
  assert.equal(await page.inputValue('input[name="meetingDate-36"]'), TOMORROW);
  assert.equal(await page.inputValue('input[name="note-36"]'), 'TEST fold note');
  assert.equal(await isFolded(page, 39), true);
  assert.equal((await page.textContent('li[data-id="39"] [data-picked-words]')).trim(), 'Selected: Reached the customer');
  // Clearing an answer takes the lead out of the count.
  await page.check('input[name="nochange-37"]');
  assert.equal(await label(page), 'Save 4 updates');
  await page.uncheck('input[name="nochange-37"]');
  assert.equal(await label(page), 'Save 3 updates');
  // Folded cards save exactly what they hold.
  await Promise.all([page.waitForURL(/saved=3&of=3/), page.click('#pu-save')]);
  const sent = [...saves()[0].updates].sort((a, b) => a.id - b.id);
  assert.deepEqual(sent, [
    { id: 36, choice: 'meeting', talkedToDoctor: 'Yes', meetingDate: TOMORROW, signedDate: '', signedProduct: '', closedReason: '', note: 'TEST fold note', offices: '' },
    { id: 38, choice: 'qualified', talkedToDoctor: 'Yes', meetingDate: '', signedDate: '', signedProduct: '', closedReason: '', note: '', offices: '' },
    { id: 39, choice: 'qualified', talkedToDoctor: 'Yes', meetingDate: '', signedDate: '', signedProduct: '', closedReason: '', note: '', offices: 'yes' },
  ]);
  await page.close();
});

await check('Release A: keys never fold early, Tab out folds, focus ring is navy', async () => {
  const page = await phone.newPage();
  await open(page);
  await page.focus('input[name="choice-38"][value="qualified"]');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.isChecked('input[name="choice-38"][value="trying"]'), true);
  assert.equal(await isFolded(page, 38), false, 'arrowing through stages must not fold');
  const ring = await page.$eval('input[name="choice-38"][value="trying"]', (el) => getComputedStyle(el).outlineColor);
  assert.equal(ring, 'rgb(0, 47, 109)');
  for (let i = 0; i < 8; i += 1) {
    const inside = await page.evaluate(() => document.activeElement?.closest('li')?.dataset.id === '38');
    if (!inside) break;
    await page.keyboard.press('Tab');
  }
  assert.equal(await isFolded(page, 38), true, 'Tab out of a complete card folds it');
  // Back to the Change button by keyboard: it shows the same ring and reopens the card.
  await page.keyboard.press('Shift+Tab');
  const change = await page.evaluate(() => document.activeElement?.matches('[data-change]'));
  assert.equal(change, true, 'Shift+Tab lands on Change');
  assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor), 'rgb(0, 47, 109)');
  await page.keyboard.press('Enter');
  assert.equal(await isFolded(page, 38), false);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('value')), 'trying');
  await page.close();
});

await check('Release A: sticky Save at 390x844 and desktop, never over the last card or an error', async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const page = await browser.newPage({ viewport });
    await open(page);
    const tall = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 10);
    if (tall) {
      const bottom = await page.$eval('.pu-savebar', (el) => el.getBoundingClientRect().bottom);
      assert.ok(Math.abs(bottom - viewport.height) <= 1, `${viewport.width}: bar pinned to the bottom (${bottom})`);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const end = await page.evaluate(() => ({
      last: document.querySelector('.pu-lead:last-child').getBoundingClientRect().bottom,
      bar: document.querySelector('.pu-savebar').getBoundingClientRect().top,
    }));
    assert.ok(end.last <= end.bar + 0.5, `${viewport.width}: last card ends ${end.last}, bar starts ${end.bar}`);
    // An error on the last lead scrolls clear of the bar.
    await page.check('.pu-lead:last-child input[value="signed"]');
    await page.click('#pu-save');
    await page.waitForTimeout(200);
    // The page puts the error in view itself (smooth scroll: give it time).
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')?.startsWith('signedDate-')), true, 'focus on the missing field');
    const err = await page.evaluate(() => ({
      err: document.querySelector('.pu-lead:last-child .pu-err').getBoundingClientRect().bottom,
      bar: document.querySelector('.pu-savebar').getBoundingClientRect().top,
    }));
    assert.ok(err.err <= err.bar + 0.5, `${viewport.width}: error ends ${err.err}, bar starts ${err.bar}`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(wide <= 0, `${viewport.width}: page is ${wide}px too wide`);
    await page.close();
  }
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

await check('a partial save says what did not save, after the reload', async () => {
  bodies.length = 0;
  saveReplies.push([200, { ok: true, saved: 1 }]);
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-36"][value="qualified"]');
  await page.check('input[name="nochange-37"]');
  await Promise.all([page.waitForURL(/saved=1&of=2/), page.click('#pu-save')]);
  await page.waitForLoadState('load');
  assert.equal(saves()[0].updates.length, 2);
  assert.equal(
    (await page.textContent('#pu-status'))?.trim(),
    'Saved 1 of 2 updates. 1 lead closed or changed while you worked and did not save. The list below is current.',
  );
  assert.doesNotMatch(await page.textContent('#pu-status'), /Saved 1 update\./);
  // The words show once: the address drops the counts, so a refresh does not repeat them.
  assert.equal(new URL(page.url()).search, '');
  await page.close();
});

await check('a zero save says nothing saved, after the reload', async () => {
  bodies.length = 0;
  saveReplies.push([200, { ok: true, saved: 0 }]);
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-36"][value="trying"]');
  await Promise.all([page.waitForURL(/saved=0&of=1/), page.click('#pu-save')]);
  await page.waitForLoadState('load');
  assert.equal(
    (await page.textContent('#pu-status'))?.trim(),
    'Nothing saved. This lead closed or changed while you worked. The list below is current.',
  );
  await page.close();
});

await check('more saved than sent is no clear answer: no reload, Save resends the same id', async () => {
  bodies.length = 0;
  saveReplies.push([200, { ok: true, saved: 2 }]);
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-36"][value="trying"]');
  await page.click('#pu-save');
  await page.waitForFunction(() => /taking too long/.test(document.getElementById('pu-status')?.textContent ?? ''));
  assert.doesNotMatch(page.url(), /saved=/);
  assert.equal(await page.isDisabled('input[name="note-36"]'), true, 'answers should lock until resent');
  await Promise.all([page.waitForURL(/saved=1&of=1/), page.click('#pu-save')]);
  const [first, second] = saves();
  assert.equal(second.submissionId, first.submissionId);
  const api = await postSave({ key: KEY, submissionId: crypto.randomUUID(), updates: [{ id: 36, choice: 'trying' }] });
  assert.equal(api.status, 200);
  saveReplies.push([200, { ok: true, saved: 5 }]);
  const over = await postSave({ key: KEY, submissionId: crypto.randomUUID(), updates: [{ id: 36, choice: 'trying' }] });
  assert.equal(over.status, 502);
  assert.equal((await over.json()).ok, undefined);
  await page.close();
});

await check('the saved message trusts only counts that add up', async () => {
  const words = async (search) => {
    const res = await fetch(`${BASE}/update/${KEY}${search}`);
    const html = await res.text();
    return (html.match(/<p id="pu-status"[^>]*>([^<]*)<\/p>/) ?? [])[1] ?? 'missing';
  };
  assert.equal(await words('?saved=2'), 'Saved 2 updates.');
  assert.equal(await words('?saved=2&of=2'), 'Saved 2 updates.');
  assert.match(await words('?saved=1&of=3'), /^Saved 1 of 3 updates\. 2 leads closed/);
  assert.match(await words('?saved=0&of=2'), /^Nothing saved\. These 2 leads/);
  for (const bad of ['?saved=0', '?saved=3&of=2', '?saved=1&of=0', '?saved=1&of=51', '?saved=x&of=2', '?saved=1.5&of=2', '?saved=-1&of=2', '?saved=&of=2']) {
    assert.equal(await words(bad), '', bad);
  }
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

if (process.env.PARTNER_SHOTS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await open(page);
  await page.addStyleTag({ content: '.pu-savebar { display: none !important; }' });
  await page.check('input[name="choice-37"][value="proposal"]');
  await page.locator('li[data-id="37"]').screenshot({ path: `${process.env.PARTNER_SHOTS}/deal-value-off.png` });
  await page.close();
}

killDev(dev);

// 3. Year 1 deal value on (Brian, 11/25/2026).
dev = await startDev({
  REP_APP_ENABLED: 'true',
  PARTNER_PAGE_ENABLED: 'true',
  PARTNER_OFFICE_CHECK: 'true',
  PARTNER_DEAL_VALUE_ENABLED: 'true',
  PARTNER_FLOW_URL: FLOW_URL,
});
const DEAL = 'input[name="dealValue-36"]';

await check('deal value: shown only on Demo set, Proposal and Signed, pre-filled from 7F', async () => {
  const page = await phone.newPage();
  await open(page);
  assert.equal(await page.isVisible(DEAL), false, 'hidden before a pick');
  for (const choice of ['trying', 'qualified', 'dq_noanswer', 'lost']) {
    await page.check(`input[name="choice-36"][value="${choice}"]`);
    assert.equal(await page.isVisible(DEAL), false, choice);
  }
  for (const choice of ['meeting', 'proposal', 'signed']) {
    await page.check(`input[name="choice-36"][value="${choice}"]`);
    assert.equal(await page.isVisible(DEAL), true, choice);
  }
  await page.check('input[name="nochange-36"]');
  assert.equal(await page.isVisible(DEAL), false, 'nochange');
  assert.match(await page.textContent('li[data-id="36"]'), /Year 1 deal value in dollars, your best guess \(optional\)/);
  assert.equal(await page.inputValue(DEAL), '');
  assert.equal(await page.inputValue('input[name="dealValue-37"]'), '25000');
  assert.equal(await page.getAttribute(DEAL, 'inputmode'), 'numeric');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(wide <= 0, `page is ${wide}px too wide`);
  await page.close();
});

await check('deal value: "$25,000" is sent as 25000; the stored value untouched is sent blank', async () => {
  bodies.length = 0;
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-36"][value="proposal"]');
  await page.fill(DEAL, '$25,000');
  await page.check('input[name="choice-37"][value="proposal"]');
  await page.check('input[name="choice-38"][value="meeting"]');
  await page.fill('input[name="meetingDate-38"]', TOMORROW);
  await page.fill('input[name="dealValue-38"]', '8000');
  await page.check('input[name="choice-38"][value="trying"]');
  await Promise.all([page.waitForURL(/saved=3&of=3/), page.click('#pu-save')]);
  const sent = [...saves()[0].updates].sort((a, b) => a.id - b.id);
  const blank = { talkedToDoctor: 'Yes', meetingDate: '', signedDate: '', signedProduct: '', closedReason: '', note: '', offices: '' };
  assert.deepEqual(sent, [
    { id: 36, choice: 'proposal', ...blank, dealValue: '25000' },
    { id: 37, choice: 'proposal', ...blank, dealValue: '' },
    { id: 38, choice: 'trying', ...blank, talkedToDoctor: 'Not yet, still trying', dealValue: '' },
  ]);
  await page.close();
});

await check('deal value: a changed stored value is sent; bad input names the lead and posts nothing', async () => {
  bodies.length = 0;
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-37"][value="signed"]');
  await page.fill('input[name="signedDate-37"]', TODAY);
  await page.fill('input[name="dealValue-37"]', '25k');
  assert.equal(await label(page), 'Save', 'bad value is not complete');
  await page.click('#pu-save');
  await page.waitForTimeout(300);
  assert.match(await page.textContent('#pu-status'), /Lead HSBS-F91: check Year 1 deal value\./);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'dealValue-37');
  assert.equal(saves().length, 0);
  await page.fill('input[name="dealValue-37"]', '30000');
  await Promise.all([page.waitForURL(/saved=1/), page.click('#pu-save')]);
  assert.equal(saves()[0].updates[0].dealValue, '30000');
  assert.equal(saves()[0].updates[0].signedDate, TODAY);
  await page.close();
});

if (process.env.PARTNER_SHOTS) {
  // Local screenshots for the wording review (not a test): PARTNER_SHOTS=<folder> npm run e2e.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await open(page);
  await page.addStyleTag({ content: '.pu-savebar { display: none !important; }' });
  await page.check('input[name="choice-37"][value="proposal"]');
  await page.locator('li[data-id="37"]').screenshot({ path: `${process.env.PARTNER_SHOTS}/deal-value-on.png` });
  await page.close();
}

killDev(dev);

// 4. Parked on (Brian, 11/26/2026; LTI-SHARED-001 r8, E20 to E22).
dev = await startDev({
  REP_APP_ENABLED: 'true',
  PARTNER_PAGE_ENABLED: 'true',
  PARTNER_OFFICE_CHECK: 'true',
  PARTNER_PARKED_ENABLED: 'true',
  PARTNER_FLOW_URL: FLOW_URL,
});
const PARK_DATE = 'input[name="parkDate-36"]';

await check('parked: every lead offers Parked, a parked lead also Pick it back up, fields only on Parked', async () => {
  const page = await phone.newPage();
  await open(page);
  assert.equal(await page.locator('input[name="choice-36"][value="parked"]').count(), 1);
  assert.equal(await page.locator('input[name="choice-36"][value="unpark"]').count(), 0);
  assert.equal(await page.locator('input[name="choice-38"][value="unpark"]').count(), 1);
  assert.match(await page.textContent('li[data-id="38"]'), /Not reached yet\. Parked until [A-Z][a-z]{2} \d{1,2}, \d{4}/);
  assert.match(await page.textContent('li[data-id="38"]'), /Keeps it parked until/);
  assert.doesNotMatch(await page.textContent('li[data-id="36"]'), /Parked until/);
  assert.equal(await page.isVisible(PARK_DATE), false, 'hidden before a pick');
  await page.check('input[name="choice-36"][value="proposal"]');
  assert.equal(await page.isVisible(PARK_DATE), false, 'proposal');
  await page.check('input[name="choice-36"][value="parked"]');
  assert.equal(await page.isVisible(PARK_DATE), true, 'parked');
  assert.equal(await page.getAttribute(PARK_DATE, 'min'), TOMORROW);
  assert.match(await page.textContent('li[data-id="36"]'), /a park with no revisit date saves as Closed lost/);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(wide <= 0, `page is ${wide}px too wide`);
  await page.close();
});

await check('parked: missing reason and name names both and posts nothing; a full park sends all three', async () => {
  bodies.length = 0;
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-36"][value="parked"]');
  await page.fill(PARK_DATE, eastern(14));
  assert.equal(await label(page), 'Save', 'a park with no reason is not complete');
  await page.click('#pu-save');
  await page.waitForTimeout(300);
  assert.match(await page.textContent('#pu-status'), /Lead HSBS-F90: check Reason for setting it aside and Your name\./);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'parkReason-36');
  assert.equal(saves().length, 0);
  await page.fill('input[name="parkReason-36"]', 'TEST office remodel');
  await page.fill('input[name="parkedBy-36"]', 'TEST Jane Partner');
  await page.check('input[name="choice-38"][value="unpark"]');
  await Promise.all([page.waitForURL(/saved=2&of=2$/), page.click('#pu-save')]);
  const sent = [...saves()[0].updates].sort((a, b) => a.id - b.id);
  const blank = { talkedToDoctor: '', meetingDate: '', signedDate: '', signedProduct: '', closedReason: '', note: '', offices: '' };
  assert.deepEqual(sent, [
    { id: 36, choice: 'parked', ...blank, parkDate: eastern(14), parkReason: 'TEST office remodel', parkedBy: 'TEST Jane Partner' },
    { id: 38, choice: 'unpark', ...blank, parkDate: '', parkReason: '', parkedBy: '' },
  ]);
  assert.match(await page.textContent('#pu-status'), /Saved 2 updates\./);
  assert.doesNotMatch(await page.textContent('#pu-status'), /Closed Lost/);
  await page.close();
});

await check('parked: no revisit date saves and says Saved as Closed Lost, no revisit date', async () => {
  bodies.length = 0;
  const page = await phone.newPage();
  await open(page);
  await page.check('input[name="choice-36"][value="parked"]');
  await page.fill('input[name="parkReason-36"]', 'TEST not sure when');
  await page.fill('input[name="parkedBy-36"]', 'TEST Jane Partner');
  await Promise.all([page.waitForURL(/saved=1&of=1&nd=1/), page.click('#pu-save')]);
  assert.equal(saves()[0].updates[0].parkDate, '');
  assert.match(await page.textContent('#pu-status'), /Saved 1 update\. Saved as Closed Lost, no revisit date\./);
  await page.close();
});

if (process.env.PARTNER_SHOTS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await open(page);
  await page.addStyleTag({ content: '.pu-savebar { display: none !important; }' });
  await page.check('input[name="choice-36"][value="parked"]');
  await page.locator('li[data-id="36"]').screenshot({ path: `${process.env.PARTNER_SHOTS}/parked-on.png` });
  await page.locator('li[data-id="38"]').screenshot({ path: `${process.env.PARTNER_SHOTS}/parked-lead.png` });
  await page.close();
}

killDev(dev);
await browser.close();
flow.close();

for (const [status, label] of results) console.log(`${status}  ${label}`);
const failed = results.filter(([s]) => s === 'FAIL').length;
console.log(failed ? `${failed} failed` : `all ${results.length} passed`);
process.exit(failed ? 1 : 0);
