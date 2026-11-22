#!/usr/bin/env node
// Agent driver for the HSBS field app. Runs the real Astro dev server against one local
// fake flow server that stands in for HSBS 1J (/1j), 1F (/1f) and 7F (/7f). TEST data only;
// nothing leaves the machine. Run from the repo root:
//
//   node .claude/skills/run-hsbs-hsd-field/driver.mjs up [NAME=value ...]   start (env overrides)
//   node .claude/skills/run-hsbs-hsd-field/driver.mjs keys                  print TEST links
//   node .claude/skills/run-hsbs-hsd-field/driver.mjs shot <path> <out.png> [--phone] [--nojs] [--nofull] [--tab=track|earnings|team]
//   node .claude/skills/run-hsbs-hsd-field/driver.mjs tour [outdir]         click through every screen
//   node .claude/skills/run-hsbs-hsd-field/driver.mjs bodies [action]       what the site posted to the fake flows
//   node .claude/skills/run-hsbs-hsd-field/driver.mjs down                  stop everything
//
// State (pids, logs, posted bodies) lives in $HSBS_RUN_DIR or /tmp/hsbs-field-run.

import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, openSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SITE_PORT = Number(process.env.HSBS_SITE_PORT || 4410);
const FLOW_PORT = Number(process.env.HSBS_FLOW_PORT || 4411);
const BASE = `http://localhost:${SITE_PORT}`;
const RUN = process.env.HSBS_RUN_DIR || '/tmp/hsbs-field-run';
const BODIES = join(RUN, 'bodies.jsonl');
const PIDS = join(RUN, 'pids.json');

// TEST keys. Shapes match isReferralKey (24-128 of A-Za-z0-9_-) and isPartnerKey (40 hex).
const KEYS = {
  rep: `RunRep_${'r'.repeat(24)}`,
  manager: `RunMgr_${'m'.repeat(24)}`,
  partner: 'a1'.repeat(20),
};

// Defaults: everything on, so every screen is reachable. Override with NAME=value on `up`.
const DEFAULT_ENV = {
  REP_APP_ENABLED: 'true',
  REP_PAY_ENABLED: 'true',
  REP_APP_COMPANIES: 'HealthFirst,Staffing',
  REP_ASK_STATE: 'true',
  PARTNER_PAGE_ENABLED: 'true',
  FIELD_FLOW_URL: `http://127.0.0.1:${FLOW_PORT}/1f`,
  REGISTER_FLOW_URL: `http://127.0.0.1:${FLOW_PORT}/1j`,
  PARTNER_FLOW_URL: `http://127.0.0.1:${FLOW_PORT}/7f`,
};

// ---------- fake flow fixtures (TEST people only) ----------
const eastern = (n) => {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const STAFFING = 'HS Staffing / Recruiting Services (including GoTu)';
const ref = (id, practice, line, o = {}) => ({ id, doctor: 'TEST Contact', practice, created: eastern(-8), cases: [{ updated: eastern(-2), ...line }], history: [{ on: eastern(-2), text: `${line.company === STAFFING ? 'Direct Dental' : 'HealthFirst'}: ${line.partnerStatus}` }], ...o });
const REFERRALS = [
  ref('TEST-H1', 'TEST South Park Dental', { company: 'HealthFirst', partnerStatus: 'Meeting set', qualified: 'Yes' }),
  ref('TEST-H2', 'TEST East Dental', { company: 'HealthFirst', partnerStatus: 'Signed', qualified: 'Yes' }, { signed: true }),
  ref('TEST-S1', 'TEST Group Two', { company: STAFFING, partnerStatus: 'Yes', practiceType: 'Group', qualified: 'Yes' }),
];
const row = (referralId, practiceName, o) => ({ referralId, practiceName, event: 'Reached', payeeRole: 'Rep', earnedOn: eastern(-3), status: 'Waiting', paidOn: '', voidReason: '', disputed: false, amount: 100, ...o });
const ROWS = [
  row('TEST-H1', 'TEST South Park Dental', { company: 'HealthFirst' }),
  row('TEST-H2', 'TEST East Dental', { company: 'HealthFirst', status: 'Paid', paidOn: eastern(-1) }),
  row('TEST-S1', 'TEST Group Two', { company: 'Staffing', practiceType: 'Group' }),
];
const TEAM = {
  team: [
    { signedUp: true, name: 'TEST Rep', email: 'test.rep@henryschein.com', role: 'FSC', registeredOn: eastern(-20), referrals: REFERRALS, rows: ROWS },
    { signedUp: false, name: 'TEST Not Joined' },
  ],
  managerRows: [{ referralId: 'TEST-H2', practiceName: 'TEST East Dental', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: eastern(-1), status: 'Waiting', repEmail: 'test.rep@henryschein.com', company: 'HealthFirst' }],
};
const LEADS = [
  { id: 36, ref: 'HSBS-F90', practice: 'TEST North Side Dental', contact: 'TEST Office Manager', company: 'HealthFirst', introducedOn: eastern(-3), status: '', talkedToDoctor: '', meetingDate: '', nextUpdateDue: eastern(1), missedUpdates: 0 },
  { id: 37, ref: 'HSBS-F91', practice: 'TEST East Dental', contact: 'TEST Doctor', company: 'HealthFirst', introducedOn: eastern(-6), status: 'Meeting set', talkedToDoctor: 'Yes', meetingDate: eastern(-1), nextUpdateDue: eastern(-1), missedUpdates: 1 },
];

function answer(path, body) {
  const unknown = [404, { error: 'unknown key' }];
  if (path === '/1j') return [200, { ok: true }];
  if (path === '/7f') {
    if (body.key !== KEYS.partner) return [404];
    if (body.action === 'leads') return [200, { partner: 'TEST field partner', leads: LEADS }];
    if (body.action === 'save') return [200, { ok: true, saved: (body.updates || []).length }];
    return [400];
  }
  if (path !== '/1f') return [404];
  const k = body.referralKey;
  if (k !== KEYS.rep && k !== KEYS.manager) return unknown;
  const mgr = k === KEYS.manager;
  switch (body.action) {
    case 'lookup':
      // Contract #52: only a lookup with activate true is a good answer.
      if (body.activate !== true) return unknown;
      return [200, { role: 'Rep', repName: mgr ? 'TEST Manager' : 'TEST Rep', repEmail: mgr ? 'test.manager@henryschein.com' : 'test.rep@henryschein.com', services: ['HealthFirst'], isManager: mgr }];
    case 'submit':
      return [200, { ok: true }];
    case 'list':
      return [200, { referrals: mgr ? [] : REFERRALS }];
    case 'earnings':
      return [200, { rows: mgr ? [] : ROWS }];
    case 'team':
      return mgr ? [200, TEAM] : unknown;
    default:
      return [400];
  }
}

// ---------- commands ----------
const [cmd = 'help', ...args] = process.argv.slice(2);

async function waitUp(ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      // No home page, so a public file is the ready signal.
      if ((await fetch(`${BASE}/favicon.svg`)).status === 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function kill(pid) {
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {}
  }
}

async function up() {
  if (existsSync(PIDS)) await down(true);
  mkdirSync(RUN, { recursive: true });
  writeFileSync(BODIES, '');
  const overrides = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]));
  const env = { ...process.env, ...DEFAULT_ENV, ...overrides };
  const out = openSync(join(RUN, 'flow.log'), 'w');
  const flow = spawn(process.execPath, [resolve(process.argv[1]), 'flows'], { detached: true, stdio: ['ignore', out, out], env });
  const devLog = openSync(join(RUN, 'dev.log'), 'w');
  const dev = spawn('npx', ['astro', 'dev', '--port', String(SITE_PORT)], { detached: true, stdio: ['ignore', devLog, devLog], env });
  flow.unref();
  dev.unref();
  writeFileSync(PIDS, JSON.stringify({ flow: flow.pid, dev: dev.pid, env: { ...DEFAULT_ENV, ...overrides } }, null, 2));
  if (!(await waitUp())) {
    console.error(`dev server did not answer on ${BASE} in 90s; see ${join(RUN, 'dev.log')}`);
    process.exit(1);
  }
  console.log(`up: site ${BASE}, fake flows http://127.0.0.1:${FLOW_PORT} (/1j /1f /7f)`);
  console.log(`env: ${Object.entries({ ...DEFAULT_ENV, ...overrides }).filter(([n]) => !n.endsWith('_URL')).map(([n, v]) => `${n}=${v}`).join(' ')}`);
  keys();
}

async function down(quiet) {
  if (existsSync(PIDS)) {
    const p = JSON.parse(readFileSync(PIDS, 'utf8'));
    kill(p.flow);
    kill(p.dev);
    rmSync(PIDS);
  }
  try {
    execFileSync('npx', ['astro', 'dev', 'stop'], { stdio: 'ignore' });
  } catch {}
  if (!quiet) console.log('down');
}

function keys() {
  console.log(`join:     ${BASE}/join`);
  console.log(`rep:      ${BASE}/refer/${KEYS.rep}`);
  console.log(`manager:  ${BASE}/refer/${KEYS.manager}`);
  console.log(`partner:  ${BASE}/update/${KEYS.partner}`);
}

function flows() {
  createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    } catch {}
    appendFileSync(BODIES, JSON.stringify({ at: new Date().toISOString(), path: req.url, body }) + '\n');
    const [status, obj] = answer(req.url, body);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(obj === undefined ? '' : JSON.stringify(obj));
  }).listen(FLOW_PORT, '127.0.0.1', () => console.log(`fake flows on ${FLOW_PORT}`));
}

function bodies() {
  if (!existsSync(BODIES)) return console.log('(no bodies file; run up first)');
  const want = args[0];
  for (const line of readFileSync(BODIES, 'utf8').split('\n').filter(Boolean)) {
    const b = JSON.parse(line);
    if (!want || b.body.action === want || b.path === want) console.log(line);
  }
}

async function browser() {
  const { chromium, devices } = await import('playwright');
  return { chromium, devices, b: await chromium.launch() };
}

async function newPage(b, devices, { phone = false, js = true } = {}) {
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'], javaScriptEnabled: js } : { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, javaScriptEnabled: js });
  const page = await ctx.newPage();
  // Astro's dev-only toolbar sits over the bottom tab bar and the partner Save button, eats
  // clicks, and shows in screenshots. Users never see it. Hide it after every load.
  // With JavaScript off the toolbar never renders, and addStyleTag hangs forever: skip it.
  page.hsbsJs = js;
  if (js) page.on('load', () => page.addStyleTag({ content: HIDE_TOOLBAR }).catch(() => {}));
  return page;
}
const HIDE_TOOLBAR = 'astro-dev-toolbar { display: none !important; }';
async function go(page, url) {
  const res = await page.goto(url, { waitUntil: 'networkidle' });
  if (page.hsbsJs) await page.addStyleTag({ content: HIDE_TOOLBAR }).catch(() => {});
  return res;
}

async function openTab(page, tab) {
  await page.click(`#rep-tabs [data-tab=${tab}]`);
  await page.waitForTimeout(1500); // track, earnings and team load from the fake 1F on first open
}

async function shot() {
  const [path, out] = args.filter((a) => !a.startsWith('--'));
  if (!path || !out) throw new Error('usage: shot <path> <out.png> [--phone] [--nojs] [--tab=track]');
  const { devices, b } = await browser();
  const page = await newPage(b, devices, { phone: args.includes('--phone'), js: !args.includes('--nojs') });
  const res = await go(page, BASE + path);
  const tab = args.find((a) => a.startsWith('--tab='))?.slice(6);
  if (tab) await openTab(page, tab);
  // The bottom tab bar is position:fixed, so a full-page shot paints it mid-page. --nofull = viewport only.
  await page.screenshot({ path: out, fullPage: !args.includes('--nofull') });
  console.log(`${res.status()} ${path} -> ${out}`);
  await b.close();
}

async function tour() {
  const dir = resolve(args[0] || join(RUN, 'shots'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(BODIES, ''); // counts at the end are for this tour only
  const { devices, b } = await browser();
  const page = await newPage(b, devices, { phone: true });
  const snap = async (name) => {
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
    console.log(`${name}: ${join(dir, `${name}.png`)}`);
  };

  // 1. Sign-up. 1J gets the body; the page shows the sent message.
  await go(page, `${BASE}/join`);
  await snap('01-join');
  for (const [n, v] of Object.entries({ firstName: 'Test', lastName: 'Rep', email: 'test.rep@henryschein.com', mobile: '555 010 1234', managerName: 'Test Manager', managerEmail: 'test.manager@henryschein.com', branch: 'Columbus' })) await page.fill(`[name=${n}]`, v);
  await page.selectOption('[name=role]', 'AE');
  await page.click('#join-send');
  await page.waitForTimeout(1500);
  await snap('02-join-sent');

  // 2. Rep app: company choice, HealthFirst send, receipt.
  await go(page, `${BASE}/refer/${KEYS.rep}`);
  await snap('03-rep-send');
  const hf = page.locator('a[href*="company=HealthFirst"], button:has-text("HealthFirst")').first();
  if (await hf.count()) {
    await hf.click();
    await page.waitForTimeout(500);
  }
  await page.fill('[name=contactName]', 'TEST Office Manager');
  await page.fill('[name=practiceName]', 'TEST North Side Dental');
  await page.fill('[name=jde]', '001234');
  await page.fill('[name=officePhone]', '303-555-0100');
  // REP_ASK_STATE=true: with JS on, the <select name=practiceState> is hidden behind a
  // typeahead (#rep-form [data-state-input]); type, then click the suggestion.
  const stateBox = page.locator('#rep-form [data-state-input]');
  if (await stateBox.isVisible().catch(() => false)) {
    await stateBox.pressSequentially('Ohio');
    await page.click('#rep-state-list [role=option] >> nth=0');
  } else if (await page.locator('[name=practiceState]').count()) await page.selectOption('[name=practiceState]', 'OH');
  await page.check('[name=preferredContact][value=Text]');
  if (!(await page.isChecked('[name=permission]'))) await page.check('[name=permission]');
  await snap('04-rep-filled');
  await page.click('#rep-send-button');
  await page.waitForTimeout(2500);
  await snap('05-rep-receipt');

  // 3. Track, Earnings.
  await go(page, `${BASE}/refer/${KEYS.rep}`);
  await openTab(page, 'track');
  await snap('06-rep-track');
  if (await page.locator('#rep-tabs [data-tab=earnings]').count()) {
    await openTab(page, 'earnings');
    await snap('07-rep-earnings');
  }

  // 4. Manager: My Team.
  await go(page, `${BASE}/refer/${KEYS.manager}`);
  if (await page.locator('#rep-tabs [data-tab=team]').count()) {
    await openTab(page, 'team');
    await snap('08-manager-team');
  }

  // 5. Partner update page: pick Meeting set on the first lead, save.
  const pr = await go(page, `${BASE}/update/${KEYS.partner}`);
  if (pr.status() === 200) {
    await snap('09-partner');
    await page.check('input[name="choice-36"][value="meeting"]');
    await page.fill('input[name="meetingDate-36"]', eastern(1));
    await Promise.all([page.waitForURL(/saved=1/, { timeout: 15000 }).catch(() => {}), page.click('#pu-save')]);
    await snap('10-partner-saved');
  }
  await b.close();
  const posted = existsSync(BODIES) ? readFileSync(BODIES, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const count = (p, a) => posted.filter((x) => x.path === p && (!a || x.body.action === a)).length;
  console.log(`posted: 1j=${count('/1j')} 1f submit=${count('/1f', 'submit')} list=${count('/1f', 'list')} earnings=${count('/1f', 'earnings')} team=${count('/1f', 'team')} 7f save=${count('/7f', 'save')}`);
}

const cmds = { up, down: () => down(false), keys, flows, bodies, shot, tour };
if (!cmds[cmd]) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 13).join('\n'));
  process.exit(cmd === 'help' ? 0 : 1);
}
await cmds[cmd]();
