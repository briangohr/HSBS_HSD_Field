// Browser test for the field app on /refer/<key>, JavaScript off and on.
// Run: npm run e2e (after the sign-up test). Starts a fake HSBS 1F on localhost
// (FIELD_FLOW_URL) and the Astro dev server; nothing leaves the machine. The fake 1F
// answers a lookup only for the Rep keys below, in the Rep Roster shape; any other key is
// 404 {"error":"unknown key"}.
//
// What must stay true (spec v3 section 2, D14):
// - A Rep key opens the field app only with REP_APP_ENABLED on. Off, /refer/<key> is a
//   plain-text 404, /api/referral, /api/referral-list, /api/team and /api/earnings answer
//   404, and nothing at all is posted to 1F (#52).
// - Without JavaScript, a referral never puts the office's details in the URL.
// - 1F gets the fixed spec values; no dollar amounts while REP_PAY_ENABLED is off.
// - Track My Referrals shows one compact row per office, newest first, each opening a
//   lead screen inside the app (Brian, 11/9): plain status words, a timeline, Back to
//   Track; 44px rows and no sideways scroll at 375px; keyboard and screen reader friendly.
// - Slice 4: with REP_PAY_ENABLED on, My Earnings and the money lines show the ledger's
//   amounts (Earned = Waiting + Paid); with it off, no dollar sign anywhere and
//   /api/earnings is 404.
// - Slice 5 (D18, Brian 11/9): My Team shows only for a Rep manager key and lists Brian's
//   Team Roster: full rows for signed-up reps, "[Name]. Not signed up yet." for the rest.
//   Nobody confirms anything: no Confirm, no Not my team, no manager card, and
//   /api/team-answer and /api/affirm-manager don't exist. A rep's referrals use the rep's
//   own rows and lead screen, never a contact, rep email or partner update.
// - Draft plan (REP_PAY_PLAN=signed:150,manager:50): every screen promises only the sign.
// - S2 (field two-track spec, section 4): with REP_APP_COMPANIES unset, every rep page
//   carries exactly one hidden company input and nothing about staffing; with junk in it,
//   the rep pages are the same HTML as with it unset. With HealthFirst,Staffing, Send
//   opens on a company choice, HealthFirst sends the same 1F body as unset, staffing opens
//   its own form (S3), and the server refuses a company that is off, two companies or none.
// - Issue #47: no rep page loads Web Analytics, since its URL is the credential.

import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium, devices } from 'playwright';
import { UNCLEAR_MESSAGE } from '../../src/lib/field-form.mjs';

const SITE_PORT = 4402;
const FLOW_PORT = 4403;
const BASE = `http://localhost:${SITE_PORT}`;
const REP_KEY = `RepTest_${'r'.repeat(24)}`;
// A Rep key 1F refuses on submit, as if the rep was disabled after opening the form.
const REP_GONE_KEY = `RepGone_${'g'.repeat(24)}`;
const PRIVATE = /North Side|001234|303-555|Office Manager/i;
// Slice 5 keys. Each manager key's lookup says isManager true.
const REP_MGR_KEY = `RepMgrTest_${'m'.repeat(24)}`;
// Slice S5 keys (field two-track spec section 6): a rep with HealthFirst and staffing
// rows, and the manager of that rep and one more.
const S5_REP_KEY = `RepS5Test_${'e'.repeat(24)}`;
const S5_MGR_KEY = `RepS5MgrTest_${'n'.repeat(24)}`;
const MANAGERS = new Set([REP_MGR_KEY, S5_MGR_KEY]);
// Planted in the fake team answer; none of it may reach a manager's page or /api/team.
const TEAM_PRIVATE =
  /Dr\. Secret|TEST Office Manager|303-555|dr\.secret|TEST secret|test\.rep@|test\.rep2@|test\.quiet@|gone\.rep@|ab12ab12|TEST Branch|RepTest_|\$777|\$999/;
// Words the rep journey must never show again (D18).
const CONFIRM_WORDS = /\bConfirm\b|Not my team|Waiting to confirm|your manager\?|team roster yet|approv/i;

const bodies = [];
// Rep keys the fake 1F marked opened (First Opened On, Status Active).
const activations = [];
let firstSubmissionId = '';
let earningsFail = false;
// Knob: the rep's own ledger rows, when a check needs the ledger to change between reads.
let repRowsNow = null;
let teamFail = false;
// 'reorder': TEST Quiet overtakes TEST Rep and TEST Rep gets a newer referral, so m0 and
// c0 name someone else. 'gone': TEST Rep is off the team. (My Team refresh, Codex P1.)
let teamSwap = '';
// Knobs for single checks: the list answer, and whether this manager has any award rows.
let listRows = null;
// S4: extra referrals planted on the first team member for the manager's view.
let teamExtra = [];
let noManagerRows = false;
const resetTeam = () => {
  teamFail = false;
  noManagerRows = false;
};
// YYYY-MM-DD, Eastern, n days before today, so the 7-day flag reads the same any day.
// n calendar days before today in Eastern time. Counted on the calendar, not as n * 24
// hours, so a daylight saving change in the last n days can't move it by one.
const daysAgo = (n) => {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
};

const REP_ROWS = [
  { referralId: 'TEST-1', practiceName: 'TEST South Park Dental', event: 'Reached', payeeRole: 'Rep', amount: 50, earnedOn: '2026-11-04', status: 'Waiting' },
  // D10: only a day-5 auto-reached award waits for review.
  { referralId: 'TEST-2', practiceName: 'TEST East Dental', event: 'Reached', payeeRole: 'Rep', amount: 50, earnedOn: '2026-11-06', status: 'Pending review' },
];
const LIST_ROW = {
  id: 'TEST-1',
  doctor: 'TEST Office Manager',
  practice: 'TEST South Park Dental',
  created: '2026-11-02',
  cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-04' }],
  history: [{ on: '2026-11-04', text: 'Meeting set' }],
};
// The 1F team answer (contracts, "team", D18), with forbidden fields planted.
const teamAnswer = () => ({
  team: [
    {
      signedUp: true,
      // Fields the contract no longer has; the site must ignore them.
      confirmed: true,
      paired: true,
      name: 'TEST Rep',
      email: 'test.rep@henryschein.com',
      role: 'AE',
      registeredOn: '2026-11-02',
      referralKey: 'RepTest_leak',
      referrals: [
        ...teamExtra,
        {
          ...LIST_ROW,
          doctorName: 'Dr. Secret',
          doctorPhone: '303-555-0177',
          doctorEmail: 'dr.secret@example.com',
          notes: 'TEST secret note',
          cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-04', detail: 'Talked with Dr. Secret' }],
          history: [
            { on: '2026-11-04', text: 'HealthFirst: Meeting set for Nov 6, 2026.' },
            { on: '2026-11-04', text: 'TEST secret history' },
          ],
          reached: true,
        },
      ],
      // The rep's own rows, plus a Manager row that must never count as the rep's.
      rows: [...REP_ROWS, { referralId: 'TEST-1', practiceName: 'TEST South Park Dental', event: 'Signed', payeeRole: 'Manager', amount: 777, earnedOn: '2026-11-05', status: 'Waiting' }],
    },
    {
      signedUp: true,
      name: 'TEST Quiet',
      email: 'test.quiet@henryschein.com',
      role: 'FSC',
      registeredOn: '2026-10-01',
      referrals: [],
      rows: [{ referralId: 'TEST-9', practiceName: 'TEST Old Dental', event: 'Reached', payeeRole: 'Rep', amount: 50, earnedOn: '2026-10-10', status: 'Paid', paidOn: '2026-10-20' }],
    },
    // On Brian's roster, no Rep Roster row yet. The contract sends only signedUp and name.
    {
      signedUp: false,
      name: 'TEST Rep2',
      email: 'test.rep2@henryschein.com',
      mobile: '303-555-0111',
      branch: 'TEST Branch',
      registeredOn: '2026-11-06',
      confirmToken: 'ab12'.repeat(16),
      paired: false,
      rows: [{ ...REP_ROWS[0], amount: 999 }],
      referrals: [LIST_ROW],
    },
  ],
  managerRows: noManagerRows
    ? []
    : [
        { referralId: 'TEST-1', practiceName: 'TEST South Park Dental', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: '2026-11-05', status: 'Waiting', repEmail: 'test.rep@henryschein.com' },
        { referralId: 'TEST-8', practiceName: 'TEST Gone Dental', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: '2026-10-15', status: 'Paid', paidOn: '2026-10-30', repEmail: 'gone.rep@henryschein.com' },
      ],
});
// Slice S5 fixture: the TEST rows on boards 5a and 5b. Sheet F6 keys on each list line
// (practiceType, qualified, notQualifiedReason, closedReason) and `company` on each ledger row.
const S5_STAFFING = 'HS Staffing / Recruiting Services (including GoTu)';
const s5Ref = (id, practice, line, o = {}) => ({ id, doctor: 'TEST Contact', practice, created: '2026-11-02', cases: [{ updated: '2026-11-08', ...line }], history: [], ...o });
const S5_REFS = [
  s5Ref('S5-G2', 'TEST Group Two', { company: S5_STAFFING, partnerStatus: 'Yes', practiceType: 'Group', qualified: 'Yes' }),
  s5Ref('S5-P3', 'TEST Practice Three', { company: S5_STAFFING, partnerStatus: 'Signed', practiceType: 'Private practice', qualified: 'Yes' }, { signed: true }),
  s5Ref('S5-H1', 'TEST Dental One', { company: 'HealthFirst', partnerStatus: 'Signed', qualified: 'Yes' }, { signed: true }),
  // Reached, and the partner has not answered "Does this lead qualify?" yet: no row.
  s5Ref('S5-H5', 'TEST Dental Five', { company: 'HealthFirst', partnerStatus: 'Yes', qualified: '' }),
  // Past first contact (a meeting is set) and still no qualify answer: reached for the promise.
  s5Ref('S5-H8', 'TEST Dental Eight', { company: 'HealthFirst', partnerStatus: 'Meeting set', qualified: '' }),
  s5Ref('S5-H7', 'TEST Dental Seven', { company: 'HealthFirst', partnerStatus: 'Not moving forward', qualified: 'No', notQualifiedReason: 'No permission to contact', closedReason: 'Not qualified' }),
  s5Ref('S5-S4', 'TEST Practice Four', { company: S5_STAFFING, partnerStatus: 'Not moving forward', practiceType: 'Private practice', qualified: 'No', notQualifiedReason: 'No permission to contact', closedReason: 'Not qualified' }),
];
const s5Row = (referralId, practiceName, o) => ({ referralId, practiceName, event: 'Reached', payeeRole: 'Rep', earnedOn: '2026-11-08', status: 'Waiting', paidOn: '', voidReason: '', disputed: false, ...o });
const S5_ROWS = [
  s5Row('S5-G2', 'TEST Group Two', { company: 'Staffing', practiceType: 'Group', amount: 200, earnedOn: '2026-11-09' }),
  s5Row('S5-P3', 'TEST Practice Three', { company: 'Staffing', practiceType: 'Private practice', amount: 100 }),
  // No Company: written before the column existed, so it is HealthFirst.
  s5Row('S5-H1', 'TEST Dental One', { amount: 100, earnedOn: '2026-11-07' }),
  s5Row('S5-H7', 'TEST Dental Seven', { company: 'HealthFirst', amount: 100, earnedOn: '2026-11-06', status: 'Void', voidReason: 'HealthFirst marked this lead as not qualified (no permission to contact)' }),
  s5Row('S5-S4', 'TEST Practice Four', { company: 'Staffing', practiceType: 'Private practice', amount: 100, earnedOn: '2026-11-05', status: 'Void', voidReason: 'Direct Dental marked this lead as not qualified (no permission to contact)' }),
  // An old day-5 auto-reached row (rep app v3, D10): shown, never counted in Earned.
  s5Row('S5-H9', 'TEST Dental Nine', { company: 'HealthFirst', amount: 100, earnedOn: '2026-11-04', status: 'Pending review' }),
  // Paid, then flagged by Brian (D3): stays Paid and in the total, and says Disputed.
  s5Row('S5-H6', 'TEST Dental Six', { company: 'HealthFirst', amount: 100, earnedOn: '2026-11-03', status: 'Paid', paidOn: '2026-11-12', disputed: true }),
];
const S5_TEAM = () => ({
  team: [
    { signedUp: true, name: 'TEST Rep One', email: 'test.s5rep1@henryschein.com', role: 'FSC', registeredOn: '2026-11-01', referrals: S5_REFS, rows: S5_ROWS },
    {
      signedUp: true,
      name: 'TEST Rep Two',
      email: 'test.s5rep2@henryschein.com',
      role: 'FSC',
      registeredOn: '2026-11-01',
      referrals: [s5Ref('S5-P8', 'TEST Practice Eight', { company: S5_STAFFING, partnerStatus: 'Signed', practiceType: 'Private practice', qualified: 'Yes' }, { signed: true })],
      rows: [s5Row('S5-P8', 'TEST Practice Eight', { company: 'Staffing', practiceType: 'Private practice', amount: 100 })],
    },
  ],
  managerRows: [
    { referralId: 'S5-H1', practiceName: 'TEST Dental One', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: '2026-11-10', status: 'Waiting', repEmail: 'test.s5rep1@henryschein.com' },
    { referralId: 'S5-P3', practiceName: 'TEST Practice Three', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: '2026-11-11', status: 'Waiting', repEmail: 'test.s5rep1@henryschein.com', company: 'Staffing' },
    { referralId: 'S5-P8', practiceName: 'TEST Practice Eight', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: '2026-11-12', status: 'Waiting', repEmail: 'test.s5rep2@henryschein.com', company: 'Staffing' },
  ],
});
const flow = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  bodies.push(body);
  const send = (status, obj) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(obj === undefined ? '' : JSON.stringify(obj));
  };
  // 1F's answer to a key the Rep Roster does not hold.
  const unknown = () => send(404, { error: 'unknown key' });
  if (body.action === 'lookup') {
    if (body.referralKey === REP_KEY || body.referralKey === REP_GONE_KEY) {
      // The 1F contract (#52): only a lookup with activate true may set First Opened On
      // and Status Active on the Rep Roster row; any other lookup is an unknown key.
      if (body.activate !== true) return unknown();
      activations.push(body.referralKey);
      // Old #49 manager fields, still sent by an older flow: the site ignores them (D18).
      return send(200, { role: 'Rep', repName: 'TEST Rep', repEmail: 'test.rep@henryschein.com', services: ['HealthFirst'], isManager: false, managerName: 'TEST Jane Smith', managerEmail: 'test.m2@henryschein.com', managerStatus: 'Unaffirmed' });
    }
    if (body.referralKey === REP_MGR_KEY) {
      // A Rep manager key is a Rep key: the same #52 gate.
      if (body.activate !== true) return unknown();
      activations.push(body.referralKey);
      return send(200, { role: 'Rep', repName: 'TEST Lead Rep', repEmail: 'test.lead@henryschein.com', services: ['HealthFirst'], isManager: true });
    }
    if (body.referralKey === S5_REP_KEY || body.referralKey === S5_MGR_KEY) {
      if (body.activate !== true) return unknown();
      const mgr = body.referralKey === S5_MGR_KEY;
      return send(200, { role: 'Rep', repName: mgr ? 'TEST Manager One' : 'TEST Rep One', repEmail: mgr ? 'test.s5mgr@henryschein.com' : 'test.s5rep1@henryschein.com', services: ['HealthFirst'], isManager: mgr });
    }
    return unknown();
  }
  if (body.action === 'team') {
    if (!MANAGERS.has(body.referralKey)) return unknown();
    if (body.referralKey === S5_MGR_KEY) return send(200, S5_TEAM());
    if (teamFail) return send(502);
    if (teamSwap) {
      const a = teamAnswer();
      const [rep, quiet, ...rest] = a.team;
      if (teamSwap === 'gone') return send(200, { ...a, team: [quiet, ...rest] });
      const row = (id, practice, created) => ({ ...LIST_ROW, id, practice, created, history: [{ on: created, text: 'Sent to HealthFirst' }] });
      quiet.referrals = [row('TEST-Q1', 'TEST Quiet One', '2026-11-03'), row('TEST-Q2', 'TEST Quiet Two', '2026-11-04')];
      rep.referrals = [row('TEST-NEW', 'TEST Newer Dental', '2026-11-06'), ...rep.referrals];
      return send(200, { ...a, team: [quiet, rep, ...rest] });
    }
    return send(200, teamAnswer());
  }
  if (body.action === 'submit') return body.referralKey === REP_GONE_KEY ? unknown() : send(200, { ok: true });
  if (body.action === 'earnings') {
    if (body.referralKey === S5_REP_KEY) return send(200, { rows: S5_ROWS });
    if (body.referralKey === S5_MGR_KEY) return send(200, { rows: [] });
    if (earningsFail) return send(502);
    return send(200, { rows: repRowsNow ?? REP_ROWS });
  }
  if (body.action === 'list') {
    if (body.referralKey === S5_REP_KEY) return send(200, { referrals: S5_REFS });
    if (body.referralKey === S5_MGR_KEY) return send(200, { referrals: [] });
    return send(200, { referrals: listRows ?? [LIST_ROW] });
  }
  return send(400);
});

const stopDev = () => {
  try {
    execFileSync('npx', ['astro', 'dev', 'stop'], { stdio: 'ignore' });
  } catch {
    // not running
  }
};
async function startDev(env) {
  stopDev();
  const child = spawn('npx', ['astro', 'dev', '--port', String(SITE_PORT)], { env: { ...process.env, ...env }, stdio: 'ignore', detached: true });
  // This site has no home page, and every page is a 404 with REP_APP_ENABLED off, so the
  // server is up once it serves a public file.
  for (let i = 0; i < 90; i += 1) {
    try {
      if ((await fetch(`${BASE}/favicon.svg`)).status === 200) return child;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('dev server did not start');
}
const killDev = (child) => {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // gone
  }
  stopDev();
};

const results = [];
const check = (label, fn) => fn().then(() => results.push(['PASS', label]), (err) => results.push(['FAIL', `${label}: ${err.message}`]));

await new Promise((r) => flow.listen(FLOW_PORT, '127.0.0.1', r));
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const browser = await chromium.launch(launchOptions);
const env = {
  FIELD_FLOW_URL: `http://127.0.0.1:${FLOW_PORT}/flow`,
  REGISTER_FLOW_URL: `http://127.0.0.1:${FLOW_PORT}/flow`,
  REP_PAY_ENABLED: 'false',
};
const post = (path, body) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const count = (action) => bodies.filter((b) => b.action === action).length;
const HIDE_TOOLBAR = 'astro-dev-toolbar { display: none !important; }';
// One page's HTML with its key and the per-request UUIDs replaced, for byte comparison.
const normal = (html, key) =>
  html.split(key).join('KEY').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID');
const htmlOf = async (key) => {
  const res = await fetch(`${BASE}/refer/${key}`);
  return { status: res.status, html: await res.text() };
};
// S2 (field two-track spec, section 4): the 1F submit body from run 1 (REP_APP_COMPANIES
// unset), per JavaScript mode, compared with the body the company choice sends.
const classicBodies = {};
// S2: rep pages with REP_APP_COMPANIES unset, switch on and pay off, compared with the
// same pages with junk in REP_APP_COMPANIES. Each is [label, key, { status, html }].
const repPages = { off: [] };
// The one line S2 adds to the HealthFirst form, so the no-JavaScript post names its
// company (spec section 4, "One referral, one company").
// The dev server adds its source attributes after the value, so match up to the tag's end.
const COMPANY_INPUT = /<input type="hidden" name="company" value="HealthFirst"[^>]*>/g;
const companyInputs = (html) => (html.match(COMPANY_INPUT) ?? []).length;
// Issue #47: the Web Analytics loader, which must never be on a /refer/<key> page.
const ANALYTICS = /window\.va\b|vercel-insights|va\.vercel-scripts|_vercel\/insights/;
const REP_FORM_FIELDS = { contactName: 'TEST Office Manager', practiceName: 'TEST North Side Dental', officePhone: '303-555-0100', preferredContact: 'Text', permission: 'yes' };
// The no-JavaScript rep form post, as the browser sends it.
const repFormPost = async (key, fields) => {
  const res = await fetch(`${BASE}/refer/${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: BASE },
    body: new URLSearchParams({ app: 'rep', ...fields, submissionId: '66666666-6666-4666-8666-666666666666' }).toString(),
  });
  return { status: res.status, html: await res.text() };
};
// Every rep page S2 must leave as it is: both keys, and a refused and a good no-JS post.
const captureRepPages = async (withCompany) => {
  const company = withCompany ? { company: 'HealthFirst' } : {};
  const out = [];
  for (const key of [REP_KEY, REP_MGR_KEY]) out.push([`GET ${key.slice(0, 10)}`, key, await htmlOf(key)]);
  out.push(['POST missing JDE', REP_KEY, await repFormPost(REP_KEY, { ...company, ...REP_FORM_FIELDS, jde: '' })]);
  out.push(['POST good', REP_KEY, await repFormPost(REP_KEY, { ...company, ...REP_FORM_FIELDS, jde: '001234' })]);
  return out;
};

let dev = await startDev({ ...env, REP_APP_ENABLED: 'true' });
try {
  for (const js of [false, true]) {
    const tag = js ? 'JS on' : 'JS off';
    const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const fill = async (jde) => {
      await page.fill('[name=contactName]', 'TEST Office Manager');
      await page.fill('[name=practiceName]', 'TEST North Side Dental');
      await page.fill('[name=jde]', jde);
      await page.fill('[name=officePhone]', '303-555-0100');
      await page.check('[name=preferredContact][value=Text]');
      await page.check('[name=permission]');
    };
    const submit = async () => {
      await page.click('#rep-send-button');
      if (js) await page.waitForTimeout(1200);
      else await page.waitForLoadState('load');
    };

    await check(`${tag}: a Rep key opens the Rep app with "Sending as" and no dollar amounts`, async () => {
      activations.length = 0;
      bodies.length = 0;
      await page.goto(`${BASE}/refer/${REP_KEY}`);
      // Switch on: the lookup may open the Rep row (#52).
      assert.deepEqual(bodies.filter((b) => b.action === 'lookup'), [{ action: 'lookup', referralKey: REP_KEY, activate: true }]);
      assert.deepEqual(activations, [REP_KEY]);
      assert.equal(await page.textContent('.rep-who h1'), 'HealthFirst compliance referral');
      assert.equal(await page.textContent('.rep-who p'), 'Sending as TEST Rep.');
      assert.equal(/\$\d/.test(await page.textContent('#rep-app')), false);
    });

    await check(`${tag}: no manager card and no confirm anywhere, though 1F still sends old manager fields (D18)`, async () => {
      await page.waitForTimeout(300);
      const html = await page.content();
      assert.equal(CONFIRM_WORDS.test(await page.textContent('#rep-app')), false);
      assert.equal(/TEST Jane Smith|test\.m2@|rep-affirm|\/confirm/.test(html), false);
    });

    await check(`${tag}: a non-manager Rep has no My Team`, async () => {
      assert.equal(await page.locator('[data-tab=team]').count(), 0);
      assert.equal(await page.locator('#team-panel').count(), 0);
      assert.deepEqual(await page.locator('#rep-tabs button').allTextContents(), ['Send a Referral', 'Track My Referrals']);
    });

    await check(`${tag}: a missing JDE shows its error, sends nothing, and keeps the URL clean`, async () => {
      bodies.length = 0;
      await fill('');
      await submit();
      assert.match(await page.textContent('.rep-err[data-for=jde]'), /JDE/);
      assert.equal(bodies.filter((b) => b.action === 'submit').length, 0);
      assert.equal(PRIVATE.test(decodeURIComponent(page.url())), false, page.url());
    });

    await check(`${tag}: a good referral shows the receipt and sends the spec's fixed values`, async () => {
      bodies.length = 0;
      await page.fill('[name=jde]', '001234');
      if (!js) await page.check('[name=permission]');
      await submit();
      await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
      assert.equal(await page.textContent('#rep-receipt h2'), 'Sent to HealthFirst');
      assert.equal(PRIVATE.test(decodeURIComponent(page.url())), false, page.url());
      const sent = bodies.filter((b) => b.action === 'submit');
      assert.equal(sent.length, 1);
      const b = sent[0];
      assert.deepEqual(
        { companies: b.companies, needs: b.needs, route: b.route, referrerRole: b.referrerRole, source: b.source, jde: b.jde, consentText: b.consentText },
        { companies: ['HealthFirst'], needs: ['OSHA and HIPAA compliance'], route: 'Partner', referrerRole: 'Rep', source: 'Rep app', jde: '001234', consentText: 'The office agreed to a call from HealthFirst.' },
      );
      assert.equal('repName' in b || 'repEmail' in b, false);
      firstSubmissionId = b.submissionId;
      classicBodies[tag] = b;
    });

    if (js) {
      await check('JS on: Track shows one compact row per office and the Latest updates feed', async () => {
        bodies.length = 0;
        await page.click('#rep-track-this');
        await page.waitForSelector('.lead-row', { timeout: 10000 });
        assert.equal(await page.locator('#rep-track-list .lead-row').count(), 1);
        assert.equal(await page.textContent('.lead-row .lead-row__office'), 'TEST South Park Dental');
        assert.deepEqual(await page.locator('.lead-row .lead-row__meta > *').allTextContents(), ['Sent Nov 2', 'Meeting set']);
        // The row is a button, so it has button semantics for a screen reader and the keyboard.
        assert.equal(await page.getAttribute('.lead-row', 'type'), 'button');
        assert.match(await page.textContent('#rep-feed'), /TEST South Park Dental: Meeting set/);
        assert.equal(await page.textContent('[data-count=sent]'), '1');
        assert.equal(/\$\d/.test(await page.textContent('#rep-track')), false, 'no dollar amounts with pay off');
        assert.equal(await page.isVisible('[data-tab=earnings]'), false);
        await page.waitForTimeout(500);
        assert.equal(bodies.filter((b) => b.action === 'list').length, 1, 'one tap, one list call');
      });

      await check('JS on: a tap opens the lead screen in the app, focus on its heading, and Back to Track returns to the row', async () => {
        const url = page.url();
        bodies.length = 0;
        await page.click('.lead-row');
        await page.waitForSelector('#rep-lead:not([hidden])');
        assert.equal(await page.isVisible('#rep-track-main'), false);
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'rep-lead-title');
        assert.equal(await page.textContent('#rep-lead-title'), 'TEST South Park Dental');
        assert.deepEqual(await page.locator('#rep-lead-body .lead-sub').allTextContents(), ['Sent Nov 2. HealthFirst.', 'Contact: TEST Office Manager']);
        assert.equal(await page.textContent('#rep-lead-body .lead-now .lead-chip'), 'Meeting set');
        assert.deepEqual(await page.locator('#rep-lead-body .lead-steps li').allTextContents(), ['Nov 2 Sent to HealthFirst', 'Nov 4 Meeting set']);
        assert.equal(await page.textContent('#rep-lead-back'), 'Back to Track');
        // No new route and no key in a new URL: the screen is drawn from the list answer.
        assert.equal(page.url(), url);
        assert.equal(bodies.length, 0);
        await page.click('#rep-lead-back');
        assert.equal(await page.isVisible('#rep-lead'), false);
        assert.equal(await page.isVisible('#rep-track-main'), true);
        assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('lead-row')), true);
        // The keyboard: Enter opens it, Escape closes it.
        await page.keyboard.press('Enter');
        await page.waitForSelector('#rep-lead:not([hidden])');
        await page.keyboard.press('Escape');
        assert.equal(await page.isVisible('#rep-lead'), false);
        assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('lead-row')), true);
        // A feed line opens the same screen.
        await page.click('#rep-feed button >> text=Meeting set');
        await page.waitForSelector('#rep-lead:not([hidden])');
        assert.equal(await page.textContent('#rep-lead-title'), 'TEST South Park Dental');
        await page.click('#rep-lead-back');
      });

      await check("JS on: the phone's own Back closes the lead screen and stays on Track, with the same URL", async () => {
        const url = page.url();
        await page.click('.lead-row');
        await page.waitForSelector('#rep-lead:not([hidden])');
        assert.equal(page.url(), url);
        await page.goBack();
        await page.waitForSelector('#rep-lead', { state: 'hidden' });
        assert.equal(page.url(), url);
        assert.equal(await page.isVisible('#rep-track-main'), true);
        assert.equal(await page.isVisible('#rep-track'), true);
        assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('lead-row')), true);
        // Back to Track takes back the entry it added: the page is on its own entry again.
        await page.click('.lead-row');
        await page.waitForSelector('#rep-lead:not([hidden])');
        await page.click('#rep-lead-back');
        await page.waitForFunction(() => !(history.state && history.state.hsbsScreen));
        assert.equal(page.url(), url);
        assert.equal(await page.isVisible('#rep-track-main'), true);
      });

      // S4: Track words per company. The values 1F sends (sheet F6) read as words; the
      // partner's typed Not Qualified Note, planted on every row, shows nowhere.
      const S4_STAFF = 'HS Staffing / Recruiting Services (including GoTu)';
      const S4_NOTE = 'S4-TYPED-NOTE-NEVER-SHOWN';
      const s4Row = (id, practice, created, company, partnerStatus, extra = {}, caseExtra = {}) => ({
        id, doctor: 'TEST Front Desk', practice, created,
        cases: [{ company, partnerStatus, updated: daysAgo(1), notQualifiedNote: S4_NOTE, ...caseExtra }], history: [], notQualifiedNote: S4_NOTE, ...extra,
      });
      const s4Rows = () => [
        s4Row('TEST-31', 'TEST Dental Five', daysAgo(10), 'HealthFirst', 'Yes', {}, { qualified: '', notQualifiedReason: '', closedReason: '' }),
        s4Row('TEST-32', 'TEST Practice Six', daysAgo(11), S4_STAFF, 'Yes', {}, { practiceType: 'Group', qualified: '', notQualifiedReason: '', closedReason: '' }),
        s4Row('TEST-33', 'TEST Dental One', daysAgo(12), 'HealthFirst', 'Signed', { signed: true }, { qualified: 'Yes' }),
        s4Row('TEST-34', 'TEST Practice Three', daysAgo(13), S4_STAFF, 'Signed', { signed: true }, { practiceType: 'Private practice', qualified: 'Yes' }),
        s4Row('TEST-35', 'TEST Dental Seven', daysAgo(14), 'HealthFirst', 'Not moving forward', { closed: true }, { qualified: 'No', notQualifiedReason: 'No permission to contact', closedReason: 'Not qualified' }),
        s4Row('TEST-36', 'TEST Practice Four', daysAgo(15), S4_STAFF, 'Not moving forward', { closed: true }, { qualified: 'No', notQualifiedReason: 'Other', closedReason: 'Not qualified' }),
      ];
      await check('JS on: at 375px every step reads in plain words, newest first, rows 44px tall, no sideways scroll (test 17); S4: each company in its own words, the typed Not Qualified Note nowhere', async () => {
        const row = (id, practice, created, status, extra = {}) => ({ id, doctor: 'TEST Front Desk', practice, created, cases: [{ company: 'HealthFirst', partnerStatus: status, updated: created }], history: [], ...extra });
        listRows = [
          row('TEST-21', 'TEST A Very Long Practice Name Family and Cosmetic Dentistry of the Front Range', daysAgo(2), 'Sent'),
          row('TEST-22', 'TEST Reaching Dental', daysAgo(3), 'Not yet, still trying'),
          row('TEST-23', 'TEST Talked Dental', daysAgo(4), 'Yes'),
          row('TEST-24', 'TEST Signed Dental', daysAgo(5), 'Signed', { signed: true }),
          row('TEST-25', 'TEST Customer Dental', daysAgo(6), 'Already a customer', { closed: true }),
          row('TEST-26', 'TEST Quiet Dental', daysAgo(9), 'Meeting set'),
          ...s4Rows(),
        ];
        let listJson = '';
        const onResponse = async (res) => { if (res.url().endsWith('/api/referral-list')) listJson = await res.text().catch(() => ''); };
        page.on('response', onResponse);
        try {
          await page.setViewportSize({ width: 375, height: 740 });
          await page.click('#rep-refresh');
          await page.waitForFunction(() => document.querySelectorAll('#rep-track-list .lead-row').length === 12, null, { timeout: 10000 });
          const chips = await page.locator('#rep-track-list .lead-chip').allTextContents();
          assert.deepEqual(chips, ['Sent to HealthFirst', 'HealthFirst is reaching out', 'HealthFirst talked with the doctor', 'Signed and billed', 'Closed: already a customer', 'Meeting set',
            // S4: the rows from the values 1F sends (sheet F6), in each company's own words.
            'HealthFirst talked with the doctor', 'Direct Dental talked with the customer', 'Signed and billed', 'Signed', 'Closed: did not qualify (no permission to contact)', 'Closed: did not qualify']);
          assert.equal(await page.textContent('.lead-row >> nth=5 >> .lead-stale'), 'No update in 9 days.');
          assert.equal(await page.locator('#rep-track-list .lead-stale').count(), 1);
          const s4 = (await page.locator('#rep-track-list .lead-row').evaluateAll((els) => els.map((e) => [e.querySelector('.lead-row__office')?.textContent, e.querySelector('.lead-row__company')?.textContent, e.querySelector('.lead-chip')?.textContent]))).slice(6);
          assert.deepEqual(s4, [
            ['TEST Dental Five', 'HealthFirst', 'HealthFirst talked with the doctor'],
            ['TEST Practice Six', 'Direct Dental, Group', 'Direct Dental talked with the customer'],
            ['TEST Dental One', 'HealthFirst', 'Signed and billed'],
            ['TEST Practice Three', 'Direct Dental, Private practice', 'Signed'],
            ['TEST Dental Seven', 'HealthFirst', 'Closed: did not qualify (no permission to contact)'],
            ['TEST Practice Four', 'Direct Dental', 'Closed: did not qualify'],
          ]);
          const text = await page.textContent('#rep-track');
          assert.equal(/HS Staffing|Recruiting/.test(text), false, 'the Solutions value is never shown');
          await page.click('.lead-row >> nth=10');
          await page.waitForSelector('#rep-lead:not([hidden])');
          assert.match(await page.textContent('#rep-lead-body .lead-steps li:last-child'), /Closed: did not qualify \(no permission to contact\)$/);
          await page.click('#rep-lead-back');
          await page.click('.lead-row >> nth=7');
          await page.waitForSelector('#rep-lead:not([hidden])');
          assert.match(await page.locator('#rep-lead-body .lead-sub').first().textContent(), /^Sent .+\. Direct Dental\.$/);
          assert.equal(/HealthFirst/.test(await page.textContent('#rep-lead')), false, 'a staffing lead screen never says HealthFirst');
          assert.equal(/\$\d/.test(await page.textContent('#rep-lead')), false, 'no earned amount before the qualify answer');
          await page.click('#rep-lead-back');
          assert.ok(listJson, 'saw the list answer');
          assert.equal(listJson.includes(S4_NOTE), false, 'the typed note is not in /api/referral-list');
          assert.equal((await page.content()).includes(S4_NOTE), false, 'the typed note is not in the page');
          const heights = await page.locator('#rep-track-list .lead-row').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
          for (const h of heights) assert.ok(h >= 44, `row ${h}px`);
          // Latest updates lines open a lead screen too: full width, 44px, never a grey browser button.
          const feed = await page.locator('#rep-feed .rep-feed__item').evaluateAll((els) =>
            els.map((e) => { const s = getComputedStyle(e); return [e.getBoundingClientRect().height, e.getBoundingClientRect().width, s.backgroundColor, s.borderTopStyle]; }));
          assert.ok(feed.length > 0);
          const listWidth = await page.locator('#rep-feed').evaluate((e) => e.getBoundingClientRect().width);
          for (const [h, w, bg, top] of feed) {
            assert.ok(h >= 44, `feed line ${h}px`);
            assert.ok(Math.abs(w - listWidth) < 1, `feed line ${w}px of ${listWidth}px`);
            assert.equal(bg, 'rgba(0, 0, 0, 0)');
            assert.equal(top, 'none');
          }
          const refresh = await page.locator('#rep-refresh').evaluate((e) => e.getBoundingClientRect().height);
          assert.ok(refresh >= 44, `Refresh ${refresh}px`);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
          await page.click('.lead-row >> nth=3');
          await page.waitForSelector('#rep-lead:not([hidden])');
          assert.match(await page.textContent('#rep-lead-body .lead-steps li:last-child'), /Signed and billed$/);
          const back = await page.locator('#rep-lead-back').evaluate((e) => e.getBoundingClientRect().height);
          assert.ok(back >= 44, `Back ${back}px`);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll on the lead screen');
          await page.click('#rep-lead-back');
        } finally {
          page.off('response', onResponse);
          listRows = null;
          await page.setViewportSize(devices['iPhone 13'].viewport);
          await page.click('#rep-refresh');
          await page.waitForFunction(() => document.querySelectorAll('#rep-track-list .lead-row').length === 1, null, { timeout: 10000 });
        }
      });

      await check('S4: the manager sees the same words on the rep, and the typed note is in no /api/team answer', async () => {
        teamExtra = s4Rows().map((r) => ({ ...r, doctorName: r.doctor, practiceName: r.practice, sentOn: r.created }));
        try {
          const res = await post('/api/team', { referralKey: REP_MGR_KEY });
          const body = await res.text();
          assert.equal(res.status, 200);
          assert.equal(body.includes(S4_NOTE), false, 'the typed note is not in /api/team');
          assert.equal(/HS Staffing|Recruiting/.test(body), false);
          const cards = JSON.parse(body).team[0].cards;
          const by = Object.fromEntries(cards.map((c) => [c.office, [c.companyLine, c.chip]]));
          assert.deepEqual(by['TEST Dental Seven'], ['HealthFirst', 'Closed: did not qualify (no permission to contact)']);
          assert.deepEqual(by['TEST Practice Four'], ['Direct Dental', 'Closed: did not qualify']);
          assert.deepEqual(by['TEST Practice Six'], ['Direct Dental, Group', 'Direct Dental talked with the customer']);
          assert.deepEqual(by['TEST Dental Five'], ['HealthFirst', 'HealthFirst talked with the doctor']);
          assert.deepEqual(by['TEST Dental One'], ['HealthFirst', 'Signed and billed']);
          assert.deepEqual(by['TEST Practice Three'], ['Direct Dental, Private practice', 'Signed']);
        } finally {
          teamExtra = [];
        }
      });

      await check('JS on: back on Send, the form is blank and a second office sends with a new id', async () => {
        await page.click('[data-tab=send]');
        await page.waitForSelector('#rep-form', { state: 'visible' });
        assert.equal(await page.inputValue('[name=contactName]'), '');
        assert.equal(await page.inputValue('[name=jde]'), '');
        assert.equal(await page.isChecked('[name=permission]'), false);
        bodies.length = 0;
        await page.fill('[name=contactName]', 'TEST Front Desk');
        await page.fill('[name=practiceName]', 'TEST East Side Dental');
        await page.fill('[name=jde]', '005678');
        await page.fill('[name=officePhone]', '303-555-0199');
        await page.check('[name=preferredContact][value=Call]');
        await page.check('[name=permission]');
        await submit();
        await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
        const sent = bodies.filter((b) => b.action === 'submit');
        assert.equal(sent.length, 1, 'the second office must reach 1F');
        assert.equal(sent[0].jde, '005678');
        assert.notEqual(sent[0].submissionId, firstSubmissionId);
      });
    }

    await ctx.close();
  }
  // Slice 5, run 1 (app on, pay off).
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    let teamJson = null;
    page.on('response', async (res) => {
      if (res.url().endsWith('/api/team')) teamJson = await res.text().catch(() => null);
    });

    await check('My Team (Rep manager, pay off): one tap loads the team once and shows the rows', async () => {
      await page.goto(`${BASE}/refer/${REP_MGR_KEY}`);
      await page.addStyleTag({ content: HIDE_TOOLBAR });
      assert.deepEqual(await page.locator('#rep-tabs button').allTextContents(), ['Send a Referral', 'Track My Referrals', 'My Team']);
      assert.equal(await page.isVisible('[data-tab=team]'), true);
      assert.equal(await page.isVisible('#team-panel'), false);
      bodies.length = 0;
      await page.click('[data-tab=team]');
      await page.waitForSelector('.team-row', { timeout: 10000 });
      await page.waitForTimeout(400);
      assert.equal(count('team'), 1, 'one tap, one team call');
      assert.deepEqual(bodies.find((b) => b.action === 'team'), { action: 'team', referralKey: REP_MGR_KEY });
      assert.equal(await page.isVisible('#rep-send'), false);
      // Signed-up reps only: the rep not signed up yet adds nothing, whatever it carries.
      assert.deepEqual(await page.locator('[data-team-tile]').allTextContents(), ['1', '0']);
      const rows = await page.locator('.team-row').evaluateAll((els) => els.map((e) => Array.from(e.children).map((c) => c.textContent)));
      assert.deepEqual(rows, [
        ['TEST Rep. AE. Joined Nov 2.', '1 referral. 1 reached. 0 signed.', 'Last referral Nov 2.'],
        ['TEST Quiet. FSC. Joined Oct 1.', '0 referrals. 0 reached. 0 signed.', 'No referral yet.'],
      ]);
      assert.equal(await page.getAttribute('.team-row >> nth=1 >> span >> nth=2', 'class'), 'team-red');
    });

    await check('My Team: a rep on the roster who has not signed up shows "[Name]. Not signed up yet." and nothing else (D4, D18)', async () => {
      assert.deepEqual(await page.locator('#team-new li').allTextContents(), ['TEST Rep2. Not signed up yet.']);
      assert.equal(await page.locator('#team-new button, #team-new a').count(), 0);
      assert.equal(await page.locator('#team-new li > *').count(), 1);
    });

    await check('My Team: no Confirm, Not my team or waiting list anywhere (D18)', async () => {
      assert.equal(CONFIRM_WORDS.test(await page.textContent('#team-panel')), false);
      assert.equal(await page.locator('#team-panel button', { hasText: /Confirm|Not my team/ }).count(), 0);
      assert.equal(await page.locator('#team-waiting, #team-waiting-list, [data-answer]').count(), 0);
      assert.equal(/\/confirm|team-answer/.test(await page.content()), false);
    });

    await check('My Team: no contact, rep email, token or key in the page or /api/team, and no dollar sign with pay off', async () => {
      assert.ok(teamJson, 'saw the /api/team answer');
      assert.equal(TEAM_PRIVATE.test(teamJson), false, teamJson.match(TEAM_PRIVATE)?.[0]);
      assert.equal(teamJson.includes('$'), false);
      assert.equal(/"(money|earned|paid|own)"/.test(teamJson), false);
      assert.equal(/confirm|paired|waiting|"ref"/i.test(teamJson), false);
      assert.deepEqual(JSON.parse(teamJson).notSignedUp, [{ name: 'TEST Rep2' }]);
      const html = await page.content();
      assert.equal(TEAM_PRIVATE.test(html), false, html.match(TEAM_PRIVATE)?.[0]);
      assert.equal(/\$\d/.test(html), false);
    });

    let teamRowParts = [];
    await check("My Team: a rep's referrals use the rep's compact rows, and the lead screen opens and closes without the contact", async () => {
      await page.click('.team-row >> nth=0');
      await page.waitForSelector('#team-rep:not([hidden])');
      assert.equal(await page.textContent('#team-rep-title'), "TEST Rep's referrals");
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'team-rep-title');
      assert.equal(await page.locator('#team-rep-cards .lead-row').count(), 1);
      teamRowParts = await page.locator('#team-rep-cards .lead-row').evaluate((e) => [e.querySelector('.lead-row__office')?.textContent, ...Array.from(e.querySelectorAll('.lead-row__meta > *')).map((c) => c.textContent)]);
      assert.deepEqual(teamRowParts, ['TEST South Park Dental', 'Sent Nov 2', 'Meeting set']);
      await page.click('#team-rep-cards .lead-row');
      await page.waitForSelector('#team-lead:not([hidden])');
      assert.equal(await page.isVisible('#team-rep'), false);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'team-lead-title');
      assert.equal(await page.textContent('#team-lead-title'), 'TEST South Park Dental');
      assert.equal(await page.textContent('#team-lead-back'), "Back to TEST Rep's referrals");
      assert.deepEqual(await page.locator('#team-lead-body .lead-sub').allTextContents(), ['Sent Nov 2. HealthFirst.']);
      // Plain step words and dates only: the secret Status Log line is gone. The meeting
      // date the Status Log carries stays on the step.
      assert.deepEqual(await page.locator('#team-lead-body .lead-steps li').allTextContents(), ['Nov 2 Sent to HealthFirst', 'Nov 4 Meeting set for Nov 6']);
      const text = await page.textContent('#team-panel');
      assert.equal(TEAM_PRIVATE.test(text), false);
      assert.equal(/Contact|Latest from/.test(text), false);
      assert.equal(await page.locator('#team-lead .lead-money').count(), 0);
      await page.click('#team-lead-back');
      assert.equal(await page.isVisible('#team-lead'), false);
      assert.equal(await page.isVisible('#team-rep'), true);
      assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('lead-row')), true);
      // The phone's own Back steps back the same way: lead to rep, rep to team, same URL.
      const url = page.url();
      await page.click('#team-rep-cards .lead-row');
      await page.waitForSelector('#team-lead:not([hidden])');
      await page.goBack();
      await page.waitForSelector('#team-lead', { state: 'hidden' });
      assert.equal(await page.isVisible('#team-rep'), true);
      await page.goBack();
      await page.waitForSelector('#team-rep', { state: 'hidden' });
      assert.equal(await page.isVisible('#team-list'), true);
      assert.equal(page.url(), url);
      await page.click('.team-row >> nth=0');
      await page.waitForSelector('#team-rep:not([hidden])');
      await page.click('#team-back');
      assert.equal(await page.isVisible('#team-list'), true);
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-member')), 'm0');
      await page.click('.team-row >> nth=1');
      assert.equal(await page.textContent('#team-rep-cards'), "TEST hasn't sent a referral yet.");
      await page.click('#team-back');
    });

    await check("My Team: the rep's own Track shows the same row for that office", async () => {
      const p2 = await ctx.newPage();
      try {
        await p2.goto(`${BASE}/refer/${REP_KEY}`);
        await p2.addStyleTag({ content: HIDE_TOOLBAR });
        await p2.click('[data-tab=track]');
        await p2.waitForSelector('.lead-row', { timeout: 10000 });
        const own = await p2.locator('#rep-track-list .lead-row').evaluate((e) => [e.querySelector('.lead-row__office')?.textContent, ...Array.from(e.querySelectorAll('.lead-row__meta > *')).map((c) => c.textContent)]);
        assert.deepEqual(own, teamRowParts);
      } finally {
        await p2.close();
      }
    });

    await check('D18: /api/team-answer and /api/affirm-manager no longer exist, and post nothing to a flow', async () => {
      bodies.length = 0;
      for (const [path, body] of [
        ['/api/team-answer', { referralKey: REP_MGR_KEY, ref: '0'.repeat(32), answer: 'yes' }],
        ['/api/affirm-manager', { referralKey: REP_KEY, answer: 'yes', managerEmail: 'test.m2@henryschein.com' }],
      ]) {
        const res = await post(path, body);
        assert.equal(res.status, 404, path);
      }
      assert.equal(bodies.length, 0);
    });

    await check('no My Team for a non-manager Rep key, and no team call on load', async () => {
      for (const key of [REP_KEY]) {
        bodies.length = 0;
        await page.goto(`${BASE}/refer/${key}`);
        await page.waitForTimeout(300);
        assert.equal(await page.locator('[data-tab=team]').count(), 0, key);
        assert.equal(await page.locator('#team-panel, #team-tabs').count(), 0, key);
        assert.equal(count('team'), 0, key);
      }
    });

    await check('API: /api/team answers 404 for a non-manager key and a malformed key', async () => {
      const rep = await post('/api/team', { referralKey: REP_KEY });
      assert.equal(rep.status, 404);
      assert.equal((await rep.json()).none, true);
      assert.equal((await post('/api/team', { referralKey: 'short' })).status, 404);
    });

    await ctx.close();
  }

  await check('S2: REP_APP_COMPANIES unset, pay off: each rep page has one company input, nothing about staffing and no Web Analytics', async () => {
    repPages.off = await captureRepPages(true);
    for (const [label, , page] of repPages.off) {
      assert.equal(companyInputs(page.html), 1, `${label}: one company input`);
      assert.equal(page.html.replace(COMPANY_INPUT, '').includes('name="company"'), false, `${label}: no other company input`);
      assert.equal(/Direct Dental|Staffing|rep-pick|data-company/.test(page.html), false, `${label}: nothing about staffing`);
      assert.equal(ANALYTICS.test(page.html), false, `${label}: loads Web Analytics (#47)`);
    }
  });

  await check('switch on: a Rep key 1F refuses on submit says "This link does not work." with a 404', async () => {
    const api = await fetch(`${BASE}/api/referral`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app: 'rep', company: 'HealthFirst', referralKey: REP_GONE_KEY, submissionId: '55555555-5555-4555-8555-555555555555', contactName: 'TEST x', practiceName: 'TEST x', jde: '1', officePhone: '303-555-0100', preferredContact: 'Call', permission: true }),
    });
    assert.equal(api.status, 404);
    assert.equal((await api.json()).error, 'This link does not work.');
  });
} finally {
  killDev(dev);
}

dev = await startDev({ ...env, REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'true' });
try {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await check('pay on: the pay line shows under the header', async () => {
    await page.goto(`${BASE}/refer/${REP_KEY}`);
    // Astro's dev-only toolbar sits over the bottom tab bar in `astro dev`. Users never
    // see it; hide it so the test can tap the tabs.
    await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
    assert.match(await page.textContent('.rep-pay'), /\$50 when HealthFirst reaches the office and confirms the lead qualifies, and \$100 more when it signs/);
  });
  await check('pay on: Track shows the Earned tile, the lead screen the money line, and the feed "You earned"', async () => {
    await page.click('[data-tab=track]');
    await page.waitForSelector('.lead-row', { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('#rep-track [data-money=earned]')?.textContent === '$50', null, { timeout: 10000 });
    // The row stays compact: the money is on the lead screen.
    assert.equal(/\$\d/.test(await page.textContent('.lead-row')), false);
    await page.click('.lead-row');
    await page.waitForSelector('#rep-lead:not([hidden])');
    assert.equal(await page.textContent('#rep-lead .lead-money'), '$50 earned Nov 4. $100 more if they sign.');
    await page.click('#rep-lead-back');
    const items = await page.locator('#rep-feed li').allTextContents();
    const nov4 = items.filter((t) => t.startsWith('Nov 4.'));
    assert.deepEqual(nov4, ['Nov 4. TEST South Park Dental: Meeting set. You earned $50.'], 'one line per paying event');
  });
  await check('pay on: when earnings fail to load, the tiles show "--" and say so, never $0', async () => {
    earningsFail = true;
    try {
      await page.click('#rep-refresh');
      await page.waitForSelector('#rep-money-status:not([hidden])', { timeout: 10000 });
      assert.equal(await page.textContent('#rep-track [data-money=earned]'), '--');
      assert.equal(await page.textContent('#rep-track [data-money-paid]'), 'Paid --');
      await page.click('.lead-row');
      await page.waitForSelector('#rep-lead:not([hidden])');
      assert.equal(await page.locator('#rep-lead .lead-money').count(), 0);
      await page.click('#rep-lead-back');
      await page.click('[data-tab=earnings]');
      await page.waitForFunction(() => /did not load/.test(document.getElementById('rep-earnings-status')?.textContent ?? ''), null, { timeout: 10000 });
      assert.equal(await page.textContent('#rep-earnings [data-money=earned]'), '--');
      assert.equal(await page.isVisible('#rep-pending'), false);
    } finally {
      earningsFail = false;
    }
  });
  await check('pay on: My Earnings shows Earned $50, Waiting $50, Paid $0, $50 pending review, and one line per row', async () => {
    await page.click('[data-tab=earnings]');
    await page.waitForSelector('#rep-earnings-lines li', { timeout: 10000 });
    assert.equal(await page.textContent('#rep-earnings [data-money=earned]'), '$50');
    assert.equal(await page.textContent('#rep-earnings [data-money=waiting]'), '$50');
    assert.equal(await page.textContent('#rep-earnings [data-money=paid]'), '$0');
    assert.equal(await page.textContent('#rep-pending'), '$50 pending review.');
    assert.equal(await page.locator('#rep-earnings-lines li').count(), 2);
    const heights = await page.locator('#rep-earnings-lines .rep-feed__item').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    assert.equal(heights.length, 2);
    for (const h of heights) assert.ok(h >= 44, `earnings line ${h}px`);
  });
  await check('pay on: a My Earnings line opens that office\'s lead screen (test 18)', async () => {
    await page.click('#rep-earnings-lines button >> text=TEST South Park Dental');
    await page.waitForSelector('#rep-lead:not([hidden])', { timeout: 10000 });
    assert.equal(await page.isVisible('#rep-earnings'), false);
    assert.equal(await page.textContent('#rep-lead-title'), 'TEST South Park Dental');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'rep-lead-title');
    await page.click('#rep-lead-back');
    assert.equal(await page.isVisible('#rep-track-main'), true);
  });
  // Codex #77: the page and the server both hold answers for 45 seconds. A send must clear
  // the page's money, and the first read after it, on any screen, must skip the server's cache.
  const sendAnother = async (jde) => {
    await page.click('[data-tab=send]');
    await page.waitForSelector('#rep-form', { state: 'visible' });
    await page.fill('[name=contactName]', 'TEST Front Desk');
    await page.fill('[name=practiceName]', `TEST Dental ${jde}`);
    await page.fill('[name=jde]', jde);
    await page.fill('[name=officePhone]', '303-555-0199');
    await page.check('[name=preferredContact][value=Call]');
    await page.check('[name=permission]');
    await page.click('#rep-send-button');
    await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
  };
  const readsAfter = (reqs) => reqs.filter((r) => r.url.endsWith('/api/referral-list') || r.url.endsWith('/api/earnings'));
  await check('pay on: Earnings right after a send asks again, fresh, instead of showing the earlier figures', async () => {
    await page.click('[data-tab=track]');
    await page.waitForFunction(() => document.querySelector('#rep-track [data-money=earned]')?.textContent === '$50', null, { timeout: 10000 });
    const seen = [];
    const onRequest = (r) => seen.push({ url: r.url(), body: r.postData() ? JSON.parse(r.postData()) : null });
    page.on('request', onRequest);
    try {
      await sendAnother('007001');
      seen.length = 0;
      await page.click('[data-tab=earnings]');
      await page.waitForSelector('#rep-earnings-lines li', { timeout: 10000 });
      const reads = readsAfter(seen);
      assert.equal(reads.length, 1, JSON.stringify(reads));
      assert.ok(reads[0].url.endsWith('/api/earnings'), 'Earnings made its own request');
      assert.equal(reads[0].body.fresh, true, 'and it skipped the cache');
    } finally {
      page.off('request', onRequest);
    }
  });
  await check('pay on: Track right after a send (the receipt button, and a plain tab tap) asks fresh', async () => {
    for (const how of ['button', 'tab']) {
      const seen = [];
      const onRequest = (r) => seen.push({ url: r.url(), body: r.postData() ? JSON.parse(r.postData()) : null });
      page.on('request', onRequest);
      try {
        await sendAnother(how === 'button' ? '007002' : '007003');
        seen.length = 0;
        if (how === 'button') await page.click('#rep-track-this');
        else await page.click('[data-tab=track]');
        await page.waitForSelector('.lead-row', { timeout: 10000 });
        await page.waitForFunction(() => document.querySelector('#rep-track [data-money=earned]')?.textContent === '$50', null, { timeout: 10000 });
        const lists = seen.filter((r) => r.url.endsWith('/api/referral-list'));
        assert.equal(lists.length, 1, `${how}: ${JSON.stringify(lists)}`);
        assert.equal(lists[0].body.fresh, true, `${how}: the list request skipped the cache`);
      } finally {
        page.off('request', onRequest);
      }
    }
  });
  await check('pay on: when the ledger fails right after a send, Earnings still asks fresh once it is back (Codex #77)', async () => {
    const seen = [];
    const onRequest = (r) => seen.push({ url: r.url(), body: r.postData() ? JSON.parse(r.postData()) : null });
    page.on('request', onRequest);
    try {
      earningsFail = true;
      await sendAnother('007004');
      await page.click('#rep-track-this');
      await page.waitForSelector('.lead-row', { timeout: 10000 });
      await page.waitForSelector('#rep-money-status:not([hidden])', { timeout: 10000 });
      earningsFail = false;
      seen.length = 0;
      await page.click('[data-tab=earnings]');
      await page.waitForSelector('#rep-earnings-lines li', { timeout: 10000 });
      const reads = seen.filter((r) => r.url.endsWith('/api/earnings'));
      assert.equal(reads.length, 1, JSON.stringify(reads));
      assert.equal(reads[0].body.fresh, true, 'the money was never loaded fresh after the send, so it asks fresh');
    } finally {
      earningsFail = false;
      page.off('request', onRequest);
    }
  });
  // Codex #77 round 4 (P0): the Earnings tab reuses money loaded in the last 45 seconds, so a rep
  // can tap Refresh on Track, switch to Earnings, and have the fresh answer land there. The
  // tiles and the award lines must then come from the same, newer ledger.
  await check('pay on: a Track refresh that lands while Earnings is open redraws the tiles and the lines together (Codex #77)', async () => {
    const paidRows = [
      { ...REP_ROWS[0], status: 'Paid', paidOn: '2026-11-09' },
      REP_ROWS[1],
      { referralId: 'TEST-3', practiceName: 'TEST West Dental', event: 'Reached', payeeRole: 'Rep', amount: 50, earnedOn: '2026-11-08', status: 'Waiting' },
    ];
    let held = false;
    let open = () => {};
    const gate = new Promise((resolve) => (open = resolve));
    try {
      await page.click('[data-tab=track]');
      await page.waitForSelector('.lead-row', { timeout: 10000 });
      await page.waitForFunction(() => document.querySelector('#rep-track [data-money=earned]')?.textContent === '$50', null, { timeout: 10000 });
      // Hold the Refresh's answer in the browser, so the rep can switch tabs before it returns.
      await page.route('**/api/referral-list', async (route) => {
        held = true;
        await gate;
        await route.continue();
      });
      await page.click('#rep-refresh');
      for (let i = 0; i < 100 && !held; i += 1) await new Promise((r) => setTimeout(r, 20));
      assert.equal(held, true, 'the Refresh request is on its way');
      repRowsNow = paidRows; // what the ledger says by the time the Refresh is answered
      await page.click('[data-tab=earnings]');
      await page.waitForSelector('#rep-earnings-lines li', { timeout: 10000 });
      assert.equal(await page.locator('#rep-earnings-lines li').count(), 2, 'the money from before is shown while the Refresh is out');
      assert.equal(await page.textContent('#rep-earnings [data-money=paid]'), '$0');
      open();
      await page.waitForFunction(() => document.querySelector('#rep-earnings [data-money=paid]')?.textContent !== '$0', null, { timeout: 10000 });
      // No waiting: the lines are redrawn in the same step as the tiles.
      const shown = await page.evaluate(() => ({
        tiles: ['earned', 'waiting', 'paid'].map((k) => document.querySelector('#rep-earnings [data-money=' + k + ']')?.textContent),
        lines: [...document.querySelectorAll('#rep-earnings-lines li')].map((li) => li.querySelector('button')?.getAttribute('aria-label') ?? li.textContent),
        pending: document.getElementById('rep-pending')?.hidden ? null : document.getElementById('rep-pending')?.textContent,
      }));
      const expected = await page.evaluate(async (k) => {
        const res = await fetch('/api/earnings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referralKey: k, fresh: true }) });
        return res.json();
      }, REP_KEY);
      const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
      const sm = expected.summary;
      assert.deepEqual(shown.tiles, [usd(sm.earned), usd(sm.waiting), usd(sm.paid)], 'the tiles are the new ledger');
      assert.deepEqual(shown.lines, sm.lines.map((l) => l.label), 'and so are the award lines');
      assert.equal(shown.lines.length, 3, 'the third award is there');
      assert.equal(shown.pending, usd(sm.pendingReview) + ' pending review.');
      // The Track screen has caught up too.
      await page.click('[data-tab=track]');
      await page.waitForFunction((v) => document.querySelector('#rep-track [data-money-paid]')?.textContent === 'Paid ' + v, usd(sm.paid), { timeout: 10000 });
    } finally {
      open();
      repRowsNow = null;
      await page.unroute('**/api/referral-list').catch(() => {});
      // The server holds the last answer for 45 seconds; put the usual ledger back in its place.
      await page.evaluate(async (k) => {
        await fetch('/api/earnings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referralKey: k, fresh: true }) });
      }, REP_KEY);
    }
  });
  // Codex #77 round 9 (P1): while a Refresh is out, opening Earnings must not start an ordinary
  // money request of its own (it could reach an instance holding older money and, being later,
  // win). The money on the page is more than 45 seconds old here, so Earnings would ask.
  await check('pay on: Earnings opened while a Refresh is out waits for it and shows the same fresh money (Codex #77)', async () => {
    const paidRows = [
      { ...REP_ROWS[0], status: 'Paid', paidOn: '2026-11-09' },
      REP_ROWS[1],
      { referralId: 'TEST-3', practiceName: 'TEST West Dental', event: 'Reached', payeeRole: 'Rep', amount: 50, earnedOn: '2026-11-08', status: 'Waiting' },
    ];
    const earningsAsked = [];
    const onRequest = (r) => {
      if (r.url().endsWith('/api/earnings')) earningsAsked.push(r.postData() ? JSON.parse(r.postData()) : null);
    };
    let held = false;
    let open = () => {};
    const gate = new Promise((resolve) => (open = resolve));
    try {
      // The page already holds a loaded Track from the check before (this suite is near the
      // server's limit of 30 list requests per link), so no new list request is spent here.
      await page.click('[data-tab=track]');
      await page.waitForSelector('.lead-row', { timeout: 10000 });
      // The money on the page is now more than 45 seconds old.
      await page.evaluate(() => {
        const real = Date.now.bind(Date);
        Date.now = () => real() + 50_000;
      });
      await page.route('**/api/referral-list', async (route) => {
        held = true;
        await gate;
        await route.continue();
      });
      await page.click('#rep-refresh');
      for (let i = 0; i < 100 && !held; i += 1) await new Promise((r) => setTimeout(r, 20));
      assert.equal(held, true, 'the Refresh request is on its way');
      repRowsNow = paidRows;
      page.on('request', onRequest);
      await page.click('[data-tab=earnings]');
      await new Promise((r) => setTimeout(r, 400));
      assert.equal(await page.textContent('#rep-earnings-status'), 'Loading your earnings.', 'Earnings waits for the Refresh');
      open();
      await page.waitForFunction(() => document.querySelector('#rep-earnings [data-money=paid]')?.textContent === '$50', null, { timeout: 10000 });
      assert.equal(await page.locator('#rep-earnings-lines li').count(), 3, 'the lines are the fresh ledger too');
      for (const body of earningsAsked) assert.equal(body.fresh, true, 'an Earnings request, if one was made, asked fresh');
      assert.equal(earningsAsked.length, 0, 'Earnings drew from the Refresh and made no request of its own');
      const shown = await page.evaluate(() => ({
        earn: ['earned', 'waiting', 'paid'].map((k) => document.querySelector('#rep-earnings [data-money=' + k + ']')?.textContent),
        trackEarned: document.querySelector('#rep-track [data-money=earned]')?.textContent,
        trackPaid: document.querySelector('#rep-track [data-money-paid]')?.textContent,
      }));
      assert.equal(shown.trackEarned, shown.earn[0], 'Track and Earnings show the same earned money');
      assert.equal(shown.trackPaid, 'Paid ' + shown.earn[2], 'and the same paid money');
    } finally {
      open();
      page.off('request', onRequest);
      repRowsNow = null;
      await page.unroute('**/api/referral-list').catch(() => {});
      await page.evaluate(async (k) => {
        await fetch('/api/earnings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referralKey: k, fresh: true }) });
      }, REP_KEY);
    }
  });
  // Codex #77 round 5 (P0): an Earnings request that started first must not overwrite the money
  // a later Track refresh already installed, whichever answer comes back last.
  await check('pay on: a slow Earnings answer that lands after a Track refresh does not bring the older money back (Codex #77)', async () => {
    const paidRows = [
      { ...REP_ROWS[0], status: 'Paid', paidOn: '2026-11-09' },
      REP_ROWS[1],
      { referralId: 'TEST-3', practiceName: 'TEST West Dental', event: 'Reached', payeeRole: 'Rep', amount: 50, earnedOn: '2026-11-08', status: 'Waiting' },
    ];
    let held = false;
    let open = () => {};
    const gate = new Promise((resolve) => (open = resolve));
    try {
      await page.goto(`${BASE}/refer/${REP_KEY}`);
      await page.addStyleTag({ content: HIDE_TOOLBAR });
      // Earnings goes first: the ledger is read as it is now, and the answer is held back.
      let heldOne = false;
      await page.route('**/api/earnings', async (route) => {
        if (heldOne) return route.continue(); // only the first Earnings request is held
        heldOne = true;
        const answered = await route.fetch();
        held = true;
        await gate;
        await route.fulfill({ response: answered }).catch(() => {}); // the page may have moved on
      });
      await page.click('[data-tab=earnings]');
      for (let i = 0; i < 100 && !held; i += 1) await new Promise((r) => setTimeout(r, 20));
      assert.equal(held, true, 'the Earnings request has its answer and is waiting');
      // The ledger moves on, then the rep opens Track and presses Refresh. That finishes first.
      repRowsNow = paidRows;
      await page.click('[data-tab=track]');
      await page.waitForSelector('.lead-row', { timeout: 10000 });
      await page.click('#rep-refresh');
      await page.waitForFunction(() => document.querySelector('#rep-track [data-money-paid]')?.textContent === 'Paid $50', null, { timeout: 10000 });
      const expected = await page.evaluate(async (k) => {
        const res = await fetch('/api/earnings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referralKey: k, fresh: true }) });
        return res.json();
      }, REP_KEY);
      const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
      const sm = expected.summary;
      // Now the older Earnings answer comes back.
      open();
      await new Promise((r) => setTimeout(r, 400));
      const trackTiles = await page.evaluate(() => [document.querySelector('#rep-track [data-money=earned]')?.textContent, document.querySelector('#rep-track [data-money-paid]')?.textContent]);
      assert.deepEqual(trackTiles, [usd(sm.earned), 'Paid ' + usd(sm.paid)], 'the Track tiles stay on the newer ledger');
      await page.click('[data-tab=earnings]');
      await page.waitForSelector('#rep-earnings-lines li', { timeout: 10000 });
      const shown = await page.evaluate(() => ({
        tiles: ['earned', 'waiting', 'paid'].map((k) => document.querySelector('#rep-earnings [data-money=' + k + ']')?.textContent),
        lines: [...document.querySelectorAll('#rep-earnings-lines li')].map((li) => li.querySelector('button')?.getAttribute('aria-label') ?? li.textContent),
      }));
      assert.deepEqual(shown.tiles, [usd(sm.earned), usd(sm.waiting), usd(sm.paid)], 'the Earnings tiles are the newer ledger');
      assert.deepEqual(shown.lines, sm.lines.map((l) => l.label), 'and so are the award lines');
      assert.equal(shown.lines.length, 3, 'the third award is still there');
    } finally {
      open();
      repRowsNow = null;
      await page.unroute('**/api/earnings').catch(() => {});
      await page.evaluate(async (k) => {
        await fetch('/api/earnings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referralKey: k, fresh: true }) });
      }, REP_KEY);
    }
  });
  // Codex #77 round 6 (P0): Track's answer is one snapshot, the list and the money read together.
  // If Earnings finishes first with newer money, Track's older answer must not install its list
  // beside the newer money. The whole answer is dropped and Track reads again (or, when it is
  // not in view, the next time it opens). Track must end with the newer list AND the newer totals.
  for (const inView of [false, true]) {
    await check(`pay on: an older Track answer that returns after newer Earnings money is dropped whole, ${inView ? 'Track in view' : 'Track hidden'} (Codex #77)`, async () => {
      const paidRows = [
        { ...REP_ROWS[0], status: 'Paid', paidOn: '2026-11-09' },
        REP_ROWS[1],
        { referralId: 'TEST-3', practiceName: 'TEST West Dental', event: 'Reached', payeeRole: 'Rep', amount: 50, earnedOn: '2026-11-08', status: 'Waiting' },
      ];
      const newerList = [LIST_ROW, { ...LIST_ROW, id: 'TEST-3', practice: 'TEST West Dental', created: '2026-11-08' }];
      const readFresh = (k) =>
        page.evaluate(async (key) => {
          const list = await fetch('/api/referral-list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referralKey: key, feed: true, earnings: true, fresh: true }) });
          const earn = await fetch('/api/earnings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referralKey: key, fresh: true }) });
          return { list: await list.json(), earn: await earn.json() };
        }, k);
      let held = false;
      let open = () => {};
      const gate = new Promise((resolve) => (open = resolve));
      try {
        await page.goto(`${BASE}/refer/${REP_KEY}`);
        await page.addStyleTag({ content: HIDE_TOOLBAR });
        await readFresh(REP_KEY); // the server holds the usual ledger and list
        // Track's first load reads the older ledger and list, then the answer is held in the browser.
        let heldOne = false;
        await page.route('**/api/referral-list', async (route) => {
          if (heldOne) return route.continue(); // only the first Track request is held
          heldOne = true;
          const answered = await route.fetch();
          held = true;
          await gate;
          await route.fulfill({ response: answered }).catch(() => {}); // the page may have moved on
        });
        await page.click('[data-tab=track]');
        for (let i = 0; i < 100 && !held; i += 1) await new Promise((r) => setTimeout(r, 20));
        assert.equal(held, true, 'the first Track answer is read and waiting');
        // The ledger and the list move on. Earnings opens and finishes first with the newer money.
        repRowsNow = paidRows;
        listRows = newerList;
        const newer = await readFresh(REP_KEY);
        await page.click('[data-tab=earnings]');
        await page.waitForFunction(() => document.querySelectorAll('#rep-earnings-lines li').length === 3, null, { timeout: 10000 });
        if (inView) await page.click('[data-tab=track]'); // back on Track while its first answer is still out
        // Now the older Track answer comes back.
        open();
        await new Promise((r) => setTimeout(r, 400));
        if (!inView) await page.click('[data-tab=track]');
        await page.waitForFunction(() => document.querySelectorAll('#rep-track-list .lead-row').length === 2, null, { timeout: 10000 });
        const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
        const sm = newer.earn.summary;
        const shown = await page.evaluate(() => ({
          offices: [...document.querySelectorAll('#rep-track-list .lead-row__office')].map((e) => e.textContent),
          tiles: [document.querySelector('#rep-track [data-money=earned]')?.textContent, document.querySelector('#rep-track [data-money-paid]')?.textContent],
        }));
        assert.ok(shown.offices.includes('TEST West Dental'), 'the newer list row is there: ' + JSON.stringify(shown.offices));
        assert.deepEqual(shown.tiles, [usd(sm.earned), 'Paid ' + usd(sm.paid)], 'and the totals are the newer ledger');
        assert.equal(sm.paid, 50, 'the newer ledger has a paid award');
        // Earnings still shows the same newer money.
        await page.click('[data-tab=earnings]');
        assert.equal(await page.textContent('#rep-earnings [data-money=paid]'), usd(sm.paid));
        assert.equal(await page.locator('#rep-earnings-lines li').count(), 3);
      } finally {
        open();
        repRowsNow = null;
        listRows = null;
        await page.unroute('**/api/referral-list').catch(() => {});
        await readFresh(REP_KEY).catch(() => {});
      }
    });
  }
  // Codex #77 round 8 (P0): the Track list is valid only for the money it was read with. Track has
  // loaded, its money is older than 45 seconds, Earnings opens and installs newer money on its own.
  // Back on Track, the newer statuses and the newer totals must show together, for the cost of one
  // more list request. The second case has Track in view when the Earnings answer lands.
  for (const inView of [false, true]) {
    await check(`pay on: newer money installed by Earnings drops the loaded Track list, ${inView ? 'Track in view when it lands' : 'Track hidden'} (Codex #77)`, async () => {
      const paidRows = [
        { ...REP_ROWS[0], status: 'Paid', paidOn: '2026-11-09' },
        REP_ROWS[1],
        { referralId: 'TEST-3', practiceName: 'TEST West Dental', event: 'Reached', payeeRole: 'Rep', amount: 50, earnedOn: '2026-11-08', status: 'Waiting' },
      ];
      const newerList = [LIST_ROW, { ...LIST_ROW, id: 'TEST-3', practice: 'TEST West Dental', created: '2026-11-08' }];
      // One fresh list request (the server limits each link to 30 a window): it also refreshes the held money.
      const readFresh = (k) =>
        page.evaluate(async (key) => {
          const list = await fetch('/api/referral-list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referralKey: key, feed: true, earnings: true, fresh: true }) });
          return list.json();
        }, k);
      const seen = [];
      const onRequest = (r) => seen.push(r.url());
      let held = false;
      let open = () => {};
      const gate = new Promise((resolve) => (open = resolve));
      try {
        await page.goto(`${BASE}/refer/${REP_KEY}`);
        await page.addStyleTag({ content: HIDE_TOOLBAR });
        await page.click('[data-tab=track]');
        await page.waitForFunction(() => document.querySelectorAll('#rep-track-list .lead-row').length === 1, null, { timeout: 10000 });
        await page.waitForFunction(() => document.querySelector('#rep-track [data-money=earned]')?.textContent === '$50', null, { timeout: 10000 });
        // The money on the page is now more than 45 seconds old.
        await page.evaluate(() => {
          const real = Date.now.bind(Date);
          Date.now = () => real() + 50_000;
        });
        // The ledger and the list move on.
        repRowsNow = paidRows;
        listRows = newerList;
        const newer = await readFresh(REP_KEY);
        if (inView) {
          let heldOne = false;
          await page.route('**/api/earnings', async (route) => {
            if (heldOne) return route.continue();
            heldOne = true;
            const answered = await route.fetch();
            held = true;
            await gate;
            await route.fulfill({ response: answered }).catch(() => {});
          });
        }
        page.on('request', onRequest);
        await page.click('[data-tab=earnings]');
        if (inView) {
          for (let i = 0; i < 100 && !held; i += 1) await new Promise((r) => setTimeout(r, 20));
          assert.equal(held, true, 'the Earnings answer is read and waiting');
          await page.click('[data-tab=track]'); // back on Track, which still shows the older list
          assert.equal(await page.locator('#rep-track-list .lead-row').count(), 1, 'the older list is still up while Earnings is out');
          open();
        } else {
          await page.waitForFunction(() => document.querySelectorAll('#rep-earnings-lines li').length === 3, null, { timeout: 10000 });
          await page.click('[data-tab=track]');
        }
        await page.waitForFunction(() => document.querySelectorAll('#rep-track-list .lead-row').length === 2, null, { timeout: 10000 });
        const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
        const sm = newer.money.summary;
        assert.equal(sm.paid, 50, 'the newer ledger has a paid award');
        const shown = await page.evaluate(() => ({
          offices: [...document.querySelectorAll('#rep-track-list .lead-row__office')].map((e) => e.textContent),
          tiles: [document.querySelector('#rep-track [data-money=earned]')?.textContent, document.querySelector('#rep-track [data-money-paid]')?.textContent],
        }));
        assert.ok(shown.offices.includes('TEST West Dental'), 'the newer list row is there: ' + JSON.stringify(shown.offices));
        assert.deepEqual(shown.tiles, [usd(sm.earned), 'Paid ' + usd(sm.paid)], 'with the newer totals');
        await new Promise((r) => setTimeout(r, 300));
        assert.equal(seen.filter((u) => u.endsWith('/api/referral-list')).length, 1, 'one more list request, no more: ' + JSON.stringify(seen));
        assert.equal(seen.filter((u) => u.endsWith('/api/earnings')).length, 1, 'and one Earnings request');
        // Earnings still shows the same money.
        await page.click('[data-tab=earnings]');
        await page.waitForFunction(() => document.querySelectorAll('#rep-earnings-lines li').length === 3, null, { timeout: 10000 });
        assert.equal(await page.textContent('#rep-earnings [data-money=paid]'), usd(sm.paid));
      } finally {
        open();
        page.off('request', onRequest);
        repRowsNow = null;
        listRows = null;
        await page.unroute('**/api/earnings').catch(() => {});
        await page.goto(`${BASE}/refer/${REP_KEY}`).catch(() => {}); // drop the shifted clock
        await page.addStyleTag({ content: HIDE_TOOLBAR }).catch(() => {});
        await readFresh(REP_KEY).catch(() => {});
      }
    });
  }
  await check('pay on: My Team tiles sum the signed-up reps own rows, and the own-pay block lists each award', async () => {
    resetTeam();
    await page.goto(`${BASE}/refer/${REP_MGR_KEY}`);
    await page.addStyleTag({ content: HIDE_TOOLBAR });
    assert.deepEqual(await page.locator('#rep-tabs button').allTextContents(), ['Send', 'Track', 'Earnings', 'Team']);
    assert.match(await page.getAttribute('#rep-tabs', 'class'), /rep-tabs--4/);
    await page.click('[data-tab=team]');
    await page.waitForSelector('.team-row', { timeout: 10000 });
    // TEST Rep: $50 waiting (the pending review row does not count). TEST Quiet: $50 paid.
    assert.deepEqual(await page.locator('[data-team-tile]').allTextContents(), ['1', '0', '$100', '$50']);
    assert.equal(await page.textContent('#team-own-sentence'), "You've earned $100 from your team's signed offices. Paid $50. Waiting $50.");
    assert.equal(await page.locator('#team-own-note').count(), 0);
    assert.equal(CONFIRM_WORDS.test(await page.textContent('#team-panel')), false);
    await page.click('#team-own-toggle');
    assert.deepEqual(await page.locator('#team-own-lines li').allTextContents(), [
      'Nov 5. TEST South Park Dental. HealthFirst, signed. TEST Rep. $50. Earned, waiting to be paid.',
      'Oct 15. TEST Gone Dental. HealthFirst, signed. A former team member. $50. Paid on Oct 30.',
    ]);
    const money = await page.locator('.team-row .team-money').allTextContents();
    assert.deepEqual(money, ['Earned $50. Paid $0.', 'Earned $50. Paid $50.']);
    assert.equal(TEAM_PRIVATE.test(await page.content()), false);
  });

  await check("pay on: a rep's lead screen money line is the same line the rep sees on their own page", async () => {
    await page.click('.team-row >> nth=0');
    await page.waitForSelector('#team-rep:not([hidden])');
    await page.click('#team-rep-cards .lead-row');
    await page.waitForSelector('#team-lead:not([hidden])');
    const teamLine = await page.textContent('#team-lead .lead-money');
    await page.goto(`${BASE}/refer/${REP_KEY}`);
    await page.addStyleTag({ content: HIDE_TOOLBAR });
    await page.click('[data-tab=track]');
    await page.waitForSelector('.lead-row', { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('#rep-track [data-money=earned]')?.textContent === '$50', null, { timeout: 10000 });
    await page.click('.lead-row');
    await page.waitForSelector('#rep-lead .lead-money');
    assert.equal(teamLine, await page.textContent('#rep-lead .lead-money'));
    assert.equal(teamLine, '$50 earned Nov 4. $100 more if they sign.');
  });

  await check('pay on: when the team fails to load, every tile shows "--" and says so, never $0', async () => {
    await page.goto(`${BASE}/refer/${REP_MGR_KEY}`);
    await page.addStyleTag({ content: HIDE_TOOLBAR });
    await page.click('[data-tab=team]');
    await page.waitForSelector('.team-row', { timeout: 10000 });
    teamFail = true;
    try {
      await page.click('#team-refresh');
      await page.waitForFunction(() => /did not load/.test(document.getElementById('team-status')?.textContent ?? ''), null, { timeout: 10000 });
      assert.equal(await page.textContent('#team-status'), 'Your team did not load. Try again in a minute.');
      assert.deepEqual(await page.locator('[data-team-tile]').allTextContents(), ['--', '--', '--', '--']);
      assert.equal(/\$0/.test(await page.textContent('#team-panel')), false);
      assert.equal(await page.isVisible('#team-own'), false);
      assert.equal(await page.isVisible('#team-refresh'), true);
    } finally {
      teamFail = false;
    }
  });

  await check('My Team refresh keeps the same rep and office open, or goes back to the team list', async () => {
    await page.goto(`${BASE}/refer/${REP_MGR_KEY}`);
    await page.addStyleTag({ content: HIDE_TOOLBAR });
    await page.click('[data-tab=team]');
    await page.waitForSelector('.team-row', { timeout: 10000 });
    await page.locator('.team-row', { hasText: 'TEST Rep.' }).click();
    await page.waitForSelector('#team-rep:not([hidden]) .lead-row');
    await page.locator('#team-rep-cards .lead-row', { hasText: 'TEST South Park Dental' }).click();
    await page.waitForSelector('#team-lead:not([hidden])');
    try {
      teamSwap = 'reorder';
      await page.click('#team-refresh');
      await page.waitForFunction(() => document.querySelectorAll('.team-row').length > 0 && /TEST Quiet/.test(document.querySelector('.team-row')?.textContent ?? ''), null, { timeout: 10000 });
      assert.equal(await page.isVisible('#team-lead'), true);
      assert.equal(await page.textContent('#team-lead-title'), 'TEST South Park Dental');
      assert.equal(await page.textContent('#team-lead-back'), "Back to TEST Rep's referrals");
      await page.click('#team-lead-back');
      assert.equal(await page.textContent('#team-rep-title'), "TEST Rep's referrals");
      teamSwap = 'gone';
      await page.click('#team-refresh');
      await page.waitForFunction(() => !document.getElementById('team-list')?.hidden, null, { timeout: 10000 });
      assert.equal(await page.isVisible('#team-rep'), false);
      assert.equal(await page.isVisible('#team-lead'), false);
      assert.equal(/TEST Rep\./.test(await page.textContent('#team-rows')), false);
    } finally {
      teamSwap = '';
    }
  });

  await ctx.close();
  await check('S2: REP_APP_COMPANIES unset, pay on: each rep page has one company input and no Web Analytics', async () => {
    for (const [label, , page] of await captureRepPages(true)) {
      assert.equal(companyInputs(page.html), 1, `${label}: one company input`);
      assert.equal(ANALYTICS.test(page.html), false, `${label}: loads Web Analytics (#47)`);
    }
  });
} finally {
  killDev(dev);
}

// Brian's 11/9 draft plan (REP_PAY_PLAN=signed:150,manager:50; spec D15 and section 5,
// test 22): every promise is the sign award, and earned money still comes from the
// ledger, including the Reached row from the old plan.
dev = await startDev({ ...env, REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'signed:150,manager:50' });
try {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const noReachedPromise = async () => {
    const text = await page.textContent('body');
    assert.equal(/\$50 when HealthFirst reaches|when HealthFirst reaches/.test(text), false, 'no reached promise');
  };
  await check('draft plan: the pay line and the receipt promise only the $150 sign award', async () => {
    await page.goto(`${BASE}/refer/${REP_KEY}`);
    await page.addStyleTag({ content: HIDE_TOOLBAR });
    assert.equal(await page.textContent('.rep-pay'), 'You earn $150 when the office signs.');
    await page.fill('[name=contactName]', 'TEST Front Desk');
    await page.fill('[name=practiceName]', 'TEST Draft Dental');
    await page.fill('[name=jde]', '000150');
    await page.fill('[name=officePhone]', '303-555-0150');
    await page.check('[name=preferredContact][value=Call]');
    await page.check('[name=permission]');
    await page.click('#rep-send-button');
    await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
    assert.equal(await page.textContent('#rep-receipt-money'), "You'll earn $150 if the office signs.");
    await noReachedPromise();
  });
  await check('draft plan: the lead screen money line and "Up to" count only the sign award', async () => {
    await page.click('#rep-track-this');
    await page.waitForSelector('.lead-row', { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('#rep-track [data-money=earned]')?.textContent === '$50', null, { timeout: 10000 });
    await page.click('.lead-row');
    await page.waitForSelector('#rep-lead .lead-money');
    // The old plan's Reached row still counts; the promise is the sign only.
    assert.equal(await page.textContent('#rep-lead .lead-money'), '$50 earned Nov 4. $150 more if they sign.');
    await page.click('#rep-lead-back');
    await page.click('[data-tab=earnings]');
    await page.waitForSelector('#rep-upto:not([hidden])', { timeout: 10000 });
    // One open office, $150 for its sign; never the manager's $50 or a reached award.
    assert.equal(await page.textContent('#rep-upto'), 'Up to $150 more if your open referrals sign.');
    await noReachedPromise();
  });
  await check('draft plan: My Team says $50 per sign before the first award, and lists awards after', async () => {
    resetTeam();
    noManagerRows = true;
    try {
      await page.goto(`${BASE}/refer/${REP_MGR_KEY}`);
      await page.addStyleTag({ content: HIDE_TOOLBAR });
      await page.click('[data-tab=team]');
      await page.waitForSelector('#team-own:not([hidden])', { timeout: 10000 });
      assert.equal(await page.textContent('#team-own-sentence'), "You've earned $0 from your team's signed offices so far. You earn $50 each time an office your team sent signs.");
      assert.equal(CONFIRM_WORDS.test(await page.textContent('#team-panel')), false);
      await page.click('.team-row >> nth=0');
      await page.click('#team-rep-cards .lead-row');
      await page.waitForSelector('#team-lead .lead-money');
      assert.equal(await page.textContent('#team-lead .lead-money'), '$50 earned Nov 4. $150 more if they sign.');
      await noReachedPromise();
    } finally {
      noManagerRows = false;
    }
    await page.reload();
    await page.addStyleTag({ content: HIDE_TOOLBAR });
    await page.click('[data-tab=team]');
    await page.waitForSelector('#team-own:not([hidden])', { timeout: 10000 });
    assert.equal(await page.textContent('#team-own-sentence'), "You've earned $100 from your team's signed offices. Paid $50. Waiting $50.");
  });
  // Codex P1 on #113 (round 2): REP_PAY_PLAN changes while the tab is open. The answers
  // below stand in for a server that now holds other terms. Every promise the page worded
  // itself goes, the server's own words show, and the receipt promises nothing.
  await check('plan changed while the tab is open: the page drops its own promises and says to reload', async () => {
    const otherTerms = async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      // /api/earnings is the money view itself; /api/referral-list carries it as `money`.
      if (route.request().url().endsWith('/api/referral-list')) {
        if (body.money) body.money.terms = 'reached:100,manager:50';
      } else body.terms = 'reached:100,manager:50';
      await route.fulfill({ response: res, json: body });
    };
    try {
      await page.goto(`${BASE}/refer/${REP_KEY}`);
      await page.addStyleTag({ content: HIDE_TOOLBAR });
      assert.equal(await page.textContent('.rep-pay'), 'You earn $150 when the office signs.', 'the page opens on its own terms');
      await page.route('**/api/earnings', otherTerms);
      await page.route('**/api/referral-list', otherTerms);
      await page.route('**/api/referral', (route) => route.fulfill({ status: 200, json: { ok: true, terms: 'reached:100,manager:50' } }));
      await page.click('[data-tab=earnings]');
      await page.waitForFunction(() => document.querySelector('.rep-pay')?.textContent === 'Pay terms changed. Reload this page to see them.', null, { timeout: 10000 });
      await page.click('[data-tab=send]');
      await page.fill('[name=contactName]', 'TEST Front Desk');
      await page.fill('[name=practiceName]', 'TEST Changed Dental');
      await page.fill('[name=jde]', '000151');
      await page.fill('[name=officePhone]', '303-555-0151');
      await page.check('[name=preferredContact][value=Call]');
      await page.check('[name=permission]');
      await page.click('#rep-send-button');
      await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
      assert.equal(await page.isVisible('#rep-receipt-money'), false, 'no receipt promise from the old terms');
      assert.equal(await page.textContent('#rep-receipt-money'), '');
      assert.doesNotMatch(await page.textContent('body'), /You'll earn|You earn \$150/, 'no promise from the page plan anywhere');
    } finally {
      await page.unroute('**/api/earnings').catch(() => {});
      await page.unroute('**/api/referral-list').catch(() => {});
      await page.unroute('**/api/referral').catch(() => {});
    }
  });
  await check('plan changed, but a send names the same terms: the receipt keeps its promise', async () => {
    await page.goto(`${BASE}/refer/${REP_KEY}`);
    await page.addStyleTag({ content: HIDE_TOOLBAR });
    await page.route('**/api/referral', (route) => route.fulfill({ status: 200, json: { ok: true, terms: 'signed:150,manager:50' } }));
    try {
      await page.fill('[name=contactName]', 'TEST Front Desk');
      await page.fill('[name=practiceName]', 'TEST Same Dental');
      await page.fill('[name=jde]', '000152');
      await page.fill('[name=officePhone]', '303-555-0152');
      await page.check('[name=preferredContact][value=Call]');
      await page.check('[name=permission]');
      await page.click('#rep-send-button');
      await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
      assert.equal(await page.textContent('#rep-receipt-money'), "You'll earn $150 if the office signs.");
      assert.equal(await page.textContent('.rep-pay'), 'You earn $150 when the office signs.');
    } finally {
      await page.unroute('**/api/referral').catch(() => {});
    }
  });
  // Codex P1s on #113 (round 3): My Team's answer names its terms too, and pay switched off
  // reaches the page through the send and through Earnings' 404.
  await check('plan changed while the tab is open: My Team\'s answer drops the page\'s own promise too', async () => {
    resetTeam();
    await page.goto(`${BASE}/refer/${REP_MGR_KEY}`);
    await page.addStyleTag({ content: HIDE_TOOLBAR });
    assert.equal(await page.textContent('.rep-pay'), 'You earn $150 when the office signs.');
    await page.route('**/api/team', async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      assert.equal(body.terms, 'signed:150,manager:50', 'the real answer names the terms');
      await route.fulfill({ response: res, json: { ...body, terms: 'reached:100,manager:50' } });
    });
    try {
      await page.click('[data-tab=team]');
      await page.waitForFunction(() => document.querySelector('.rep-pay')?.textContent === 'Pay terms changed. Reload this page to see them.', null, { timeout: 10000 });
    } finally {
      await page.unroute('**/api/team').catch(() => {});
    }
  });
  await check('pay switched off while the tab is open: the receipt promises nothing, and Earnings says to reload', async () => {
    await page.goto(`${BASE}/refer/${REP_KEY}`);
    await page.addStyleTag({ content: HIDE_TOOLBAR });
    // Stand-ins for a server whose REP_PAY_ENABLED is now off: the same answers it gives.
    await page.route('**/api/referral', (route) => route.fulfill({ status: 200, json: { ok: true, terms: '' } }));
    try {
      await page.fill('[name=contactName]', 'TEST Front Desk');
      await page.fill('[name=practiceName]', 'TEST Off Dental');
      await page.fill('[name=jde]', '000153');
      await page.fill('[name=officePhone]', '303-555-0153');
      await page.check('[name=preferredContact][value=Call]');
      await page.check('[name=permission]');
      await page.click('#rep-send-button');
      await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
      assert.equal(await page.isVisible('#rep-receipt-money'), false, 'no receipt promise');
      assert.equal(await page.textContent('.rep-pay'), 'Pay terms changed. Reload this page to see them.');
    } finally {
      await page.unroute('**/api/referral').catch(() => {});
    }
    await page.goto(`${BASE}/refer/${REP_KEY}`);
    await page.addStyleTag({ content: HIDE_TOOLBAR });
    await page.route('**/api/earnings', (route) => route.fulfill({ status: 404, json: { error: 'Not found.', terms: '' } }));
    try {
      await page.click('[data-tab=earnings]');
      await page.waitForFunction(() => document.querySelector('.rep-pay')?.textContent === 'Pay terms changed. Reload this page to see them.', null, { timeout: 10000 });
    } finally {
      await page.unroute('**/api/earnings').catch(() => {});
    }
  });
  await ctx.close();
} finally {
  killDev(dev);
}

// Field two-track slice S5 (spec section 6 and section 10 row S5): Earnings and My Team
// with a company on each row, staffing words and amounts, and the three totals agreeing.
// Pay on with both plans set, as Brian's 11/11 HealthFirst plan and the staffing plan read.
dev = await startDev({
  ...env,
  REP_APP_ENABLED: 'true',
  REP_PAY_ENABLED: 'true',
  REP_PAY_PLAN: 'reached:100,manager:50',
  REP_PAY_PLAN_STAFFING: 'reached_private:100,reached_group:200,manager:50',
});
try {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const dollarsOf = (t) => Number(String(t).replace(/[^0-9]/g, '') || 'NaN');
  // The ledger total, counted here from the fixture rows: Waiting plus Paid (D11).
  const ledger = (rows) => rows.filter((r) => r.status === 'Waiting' || r.status === 'Paid').reduce((n, r) => n + r.amount, 0);
  const cards = () =>
    page.locator('#rep-earnings-lines button').evaluateAll((els) =>
      els.map((b) => ({
        office: b.querySelector('.rep-earn__top span')?.textContent ?? '',
        amount: b.querySelector('.rep-earn__amt')?.textContent ?? '',
        company: b.querySelector('.rep-earn__co')?.textContent ?? '',
        what: b.querySelector('.rep-earn__what')?.textContent ?? '',
        status: b.querySelector('.rep-earn__status')?.textContent ?? '',
      })),
    );
  try {
    await check('S5 done-when 1: Earned on Track, My Earnings and the ledger total agree to the dollar for a rep with HealthFirst and staffing rows', async () => {
      await page.goto(`${BASE}/refer/${S5_REP_KEY}`);
      await page.addStyleTag({ content: HIDE_TOOLBAR });
      assert.match(await page.getAttribute('#rep-app', 'data-pay-plan'), /;staffing=reached_private:100,reached_group:200,manager:50$/, 'the page names the staffing plan in its terms');
      await page.click('[data-tab=track]');
      await page.waitForSelector('.lead-row', { timeout: 10000 });
      await page.waitForFunction(() => /\d/.test(document.querySelector('#rep-track [data-money=earned]')?.textContent ?? ''), null, { timeout: 10000 });
      const track = dollarsOf(await page.textContent('#rep-track [data-money=earned]'));
      await page.click('[data-tab=earnings]');
      await page.waitForSelector('#rep-earnings-lines li', { timeout: 10000 });
      const earned = dollarsOf(await page.textContent('#rep-earnings [data-money=earned]'));
      const waiting = dollarsOf(await page.textContent('#rep-earnings [data-money=waiting]'));
      const paid = dollarsOf(await page.textContent('#rep-earnings [data-money=paid]'));
      const shown = await cards();
      // The lines that count in Earned: Waiting ("Earned, waiting to be paid") and Paid.
      const lineSum = shown.filter((c) => c.status === 'Earned, waiting to be paid' || /^Paid on /.test(c.status)).reduce((n, c) => n + dollarsOf(c.amount), 0);
      const total = ledger(S5_ROWS);
      assert.equal(total, 500);
      assert.deepEqual([track, earned, waiting + paid, lineSum], [total, total, total, total], 'Track tile, My Earnings tile, Waiting plus Paid, the lines');
      assert.equal(shown.length, S5_ROWS.length, 'one line per ledger row');
      assert.equal(await page.textContent('#rep-earnings-foot'), "Earnings follow HealthFirst's and Direct Dental's updates.");
      // Board 5a words for the two not-qualified rows: no amount, the reason in the partner's name.
      assert.deepEqual(
        shown.filter((c) => !c.amount).map((c) => [c.office, c.company, c.status]),
        [
          ['TEST Dental Seven', 'HealthFirst', 'Not paid: HealthFirst marked this lead as not qualified (no permission to contact).'],
          ['TEST Practice Four', 'Direct Dental', 'Not paid: Direct Dental marked this lead as not qualified (no permission to contact).'],
        ],
      );
      // A Void line's screen reader label says only what is shown (Codex P1 on #132).
      const voidLabels = await page.locator('#rep-earnings-lines button').evaluateAll((els) =>
        els.filter((b) => /^Not paid/.test(b.querySelector('.rep-earn__status')?.textContent ?? '')).map((b) => b.getAttribute('aria-label')),
      );
      assert.deepEqual(voidLabels, [
        'TEST Dental Seven. HealthFirst. Not paid: HealthFirst marked this lead as not qualified (no permission to contact).',
        'TEST Practice Four. Direct Dental. Not paid: Direct Dental marked this lead as not qualified (no permission to contact).',
      ]);
      // A disputed payment says so and stays in Paid (D3, spec section 6).
      assert.deepEqual(shown.find((c) => c.office === 'TEST Dental Six'), { office: 'TEST Dental Six', amount: '$100', company: 'HealthFirst', what: 'HealthFirst reached the office', status: 'Paid on Nov 12. Disputed' });
      assert.equal(paid, 100);
      // A row with no Company reads as HealthFirst, the same as one that says so.
      assert.deepEqual(shown.find((c) => c.office === 'TEST Dental One'), { office: 'TEST Dental One', amount: '$100', company: 'HealthFirst', what: 'HealthFirst reached the office', status: 'Earned, waiting to be paid' });
      const widths = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      assert.ok(widths[0] <= widths[1], `no sideways scroll: ${widths}`);
    });
    await check('S5 done-when 2: a TEST private practice reached and qualified shows $100', async () => {
      const shown = await cards();
      assert.deepEqual(shown.find((c) => c.office === 'TEST Practice Three'), {
        office: 'TEST Practice Three',
        amount: '$100',
        company: 'Direct Dental, Private practice',
        what: 'Direct Dental reached the customer',
        status: 'Earned, waiting to be paid',
      });
    });
    await check('S5 done-when 3: a TEST group reached and qualified shows $200, on My Earnings and its lead screen', async () => {
      const shown = await cards();
      assert.deepEqual(shown.find((c) => c.office === 'TEST Group Two'), {
        office: 'TEST Group Two',
        amount: '$200',
        company: 'Direct Dental, Group',
        what: 'Direct Dental reached the customer',
        status: 'Earned, waiting to be paid',
      });
      await page.click('#rep-earnings-lines button >> text=TEST Group Two');
      await page.waitForSelector('#rep-lead:not([hidden])', { timeout: 10000 });
      assert.equal(await page.textContent('#rep-lead .lead-money'), '$200 earned Nov 9.');
      assert.doesNotMatch(await page.textContent('#rep-lead'), /HealthFirst/, 'a staffing lead never says HealthFirst');
      await page.click('#rep-lead-back');
    });
    await check('S5 done-when 4: a reached case with no qualify answer shows no earned amount', async () => {
      await page.click('[data-tab=track]');
      await page.waitForSelector('.lead-row', { timeout: 10000 });
      await page.click('.lead-row >> text=TEST Dental Five');
      await page.waitForSelector('#rep-lead:not([hidden])', { timeout: 10000 });
      const line = await page.textContent('#rep-lead .lead-money');
      assert.equal(line, '$100 when HealthFirst confirms the lead qualifies.');
      assert.doesNotMatch(line, /earned/);
      await page.click('#rep-lead-back');
      await page.click('[data-tab=earnings]');
      await page.waitForSelector('#rep-earnings-lines li', { timeout: 10000 });
      assert.equal((await cards()).some((c) => c.office === 'TEST Dental Five'), false, 'no My Earnings line for it');
      // A meeting set proves contact: the same promise, never "earned" (Codex P1 on #132).
      await page.click('[data-tab=track]');
      await page.waitForSelector('.lead-row', { timeout: 10000 });
      await page.click('.lead-row >> text=TEST Dental Eight');
      await page.waitForSelector('#rep-lead:not([hidden])', { timeout: 10000 });
      assert.equal(await page.textContent('#rep-lead .lead-money'), '$100 when HealthFirst confirms the lead qualifies.');
      await page.click('#rep-lead-back');
    });
    await check('S5 done-when 5: a TEST staffing sign shows $50 for the manager, and My Team totals agree to the dollar', async () => {
      await page.goto(`${BASE}/refer/${S5_MGR_KEY}`);
      await page.addStyleTag({ content: HIDE_TOOLBAR });
      await page.click('[data-tab=team]');
      await page.waitForSelector('.team-row', { timeout: 10000 });
      const team = S5_TEAM();
      const total = team.team.reduce((n, m) => n + ledger(m.rows), 0);
      assert.equal(total, 600);
      const tile = dollarsOf(await page.textContent('[data-team-tile=earned]'));
      const people = (await page.locator('.team-row .team-money').allTextContents()).map((t) => dollarsOf(/Earned (\$[\d,]+)/.exec(t)?.[1]));
      const perPerson = await page.locator('.team-row').evaluateAll((rows) =>
        rows.map((r) => [...r.querySelectorAll('.team-award__amt')].reduce((n, a) => n + Number((a.textContent ?? '').replace(/[^0-9]/g, '')), 0)),
      );
      assert.equal(tile, total, 'Team earned is the ledger');
      assert.equal(people.reduce((n, x) => n + x, 0), total, 'each person adds up to the tile');
      assert.deepEqual(perPerson, people, "each person's lines add up to that person");
      const lines = await page.locator('.team-row >> nth=0').locator('.team-award').evaluateAll((els) => els.map((e) => e.textContent));
      assert.deepEqual(lines, ['TEST Group TwoDirect Dental, Group$200', 'TEST Practice ThreeDirect Dental, Private practice$100', 'TEST Dental OneHealthFirst$100', 'TEST Dental SixHealthFirst$100']);
      // The manager's own pay: $50 on each sign, one HealthFirst and two Direct Dental.
      assert.equal(await page.textContent('#team-own-sentence'), "You've earned $150 from your team's signed offices. Paid $0. Waiting $150.");
      await page.click('#team-own-toggle');
      const own = await page.locator('#team-own-lines li').allTextContents();
      assert.deepEqual(own, [
        'Nov 12. TEST Practice Eight. Direct Dental, signed. TEST Rep Two. $50. Earned, waiting to be paid.',
        'Nov 11. TEST Practice Three. Direct Dental, signed. TEST Rep One. $50. Earned, waiting to be paid.',
        'Nov 10. TEST Dental One. HealthFirst, signed. TEST Rep One. $50. Earned, waiting to be paid.',
      ]);
      assert.equal(CONFIRM_WORDS.test(await page.textContent('#team-panel')), false);
    });
  } finally {
    await ctx.close();
  }
} finally {
  killDev(dev);
}

// A REP_PAY_PLAN that doesn't parse: no promise anywhere, and the ledger amounts still show.
dev = await startDev({ ...env, REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'signed:lots' });
try {
  // Field two-track spec, slice S1: "An unparseable value promises no dollars anywhere
  // (ledger rows that exist still show their amounts)". Pay stays on; the plan is null.
  await check('bad plan: no promise anywhere, and ledger rows that exist still show their amounts', async () => {
    const html = await (await fetch(`${BASE}/refer/${REP_KEY}`)).text();
    assert.match(html, /HealthFirst compliance referral/);
    assert.match(html, /data-pay-plan="none"/);
    assert.match(html, /data-tab="earnings"/, 'My Earnings is there');
    assert.equal(/class="rep-pay"/.test(html), false, 'no pay line');
    assert.doesNotMatch(html, /You earn|You'll earn|when HealthFirst reaches|if they sign|if the office signs|Here's how you earn/);
    bodies.length = 0;
    const earn = await fetch(`${BASE}/api/earnings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referralKey: REP_KEY, fresh: true }) });
    assert.equal(earn.status, 200);
    assert.equal(bodies.filter((b) => b.action === 'earnings').length, 1);
    const view = await earn.json();
    // REP_ROWS: one Waiting $50 and one Pending review $50.
    assert.deepEqual([view.summary.earned, view.summary.waiting, view.summary.paid, view.summary.pendingReview], [50, 50, 0, 50]);
    assert.equal(view.summary.lines.length, 2);
    assert.equal(view.summary.upTo, 0);
    assert.equal(view.summary.upToText, '');
    assert.equal(view.terms, 'none');
    assert.equal(view.money.lines['TEST-1'], '$50 earned Nov 4.', 'the earned amount, no sign promise');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/refer/${REP_KEY}`);
      await page.addStyleTag({ content: HIDE_TOOLBAR });
      await page.click('[data-tab=earnings]');
      await page.waitForFunction(() => document.querySelector('#rep-earnings [data-money=earned]')?.textContent === '$50', null, { timeout: 10000 });
      assert.equal((await page.locator('#rep-earnings-lines li').allTextContents()).length, 2, 'both ledger rows show');
      assert.equal(await page.isVisible('#rep-upto'), false, 'no "Up to"');
      assert.equal(await page.textContent('#rep-pending'), '$50 pending review.');
      assert.doesNotMatch(await page.textContent('body'), /You earn|You'll earn|when HealthFirst reaches|if they sign|Up to \$|Pay terms changed/);
    } finally {
      await ctx.close();
    }
  });
} finally {
  killDev(dev);
}

// Switch off (REP_APP_ENABLED unset or not exactly "true"): every rep page and route is a
// 404, and nothing at all is posted to 1F, not even a lookup. REP_PAY_ENABLED is on, so
// each 404 here comes from REP_APP_ENABLED alone.
dev = await startDev({ ...env, REP_APP_ENABLED: 'false', REP_PAY_ENABLED: 'true' });
try {
  await check('switch off: a Rep key and a Rep manager key are a plain 404, and no lookup reaches 1F', async () => {
    activations.length = 0;
    bodies.length = 0;
    for (const key of [REP_KEY, REP_MGR_KEY]) {
      const res = await fetch(`${BASE}/refer/${key}`);
      assert.equal(res.status, 404, key);
      assert.match(res.headers.get('content-type') ?? '', /^text\/plain/, key);
      const text = await res.text();
      assert.equal(text, 'Not found', key);
      assert.equal(/team-panel|data-tab="team"|My Team|TEST Rep|TEST Lead Rep/.test(text), false, key);
    }
    // The no-JavaScript form post is refused the same way.
    const form = await repFormPost(REP_KEY, { company: 'HealthFirst', ...REP_FORM_FIELDS, jde: '001234' });
    assert.equal(form.status, 404);
    assert.equal(bodies.length, 0, 'nothing reached 1F');
    assert.deepEqual(activations, []);
  });

  await check('switch off: /api/referral, /api/referral-list, /api/team and /api/earnings answer 404, and nothing reaches 1F', async () => {
    activations.length = 0;
    bodies.length = 0;
    const referral = await post('/api/referral', { app: 'rep', company: 'HealthFirst', referralKey: REP_KEY, submissionId: '44444444-4444-4444-8444-444444444444', ...REP_FORM_FIELDS, jde: '001234', permission: true });
    assert.equal(referral.status, 404, '/api/referral');
    const list = await post('/api/referral-list', { referralKey: REP_KEY, feed: true });
    assert.equal(list.status, 404, '/api/referral-list');
    assert.equal(/TEST South Park Dental/.test(await list.text()), false);
    const team = await post('/api/team', { referralKey: REP_MGR_KEY });
    assert.equal(team.status, 404, '/api/team');
    const earn = await post('/api/earnings', { referralKey: REP_KEY });
    assert.equal(earn.status, 404, '/api/earnings');
    assert.equal(bodies.length, 0, 'nothing reached 1F');
    assert.deepEqual(activations, []);
  });

  await check('switch off: the removed routes stay gone, and nothing reaches 1F', async () => {
    bodies.length = 0;
    assert.equal((await post('/api/team-answer', { referralKey: REP_MGR_KEY, ref: '0'.repeat(32), answer: 'yes' })).status, 404);
    assert.equal((await post('/api/affirm-manager', { referralKey: REP_KEY, answer: 'yes' })).status, 404);
    assert.equal(bodies.length, 0);
  });
} finally {
  killDev(dev);
}

// S2, Codex P1 on #115: a refused send must say why where the rep can see it, with
// JavaScript off and on, in classic mode and with the company choice. Each case rewrites
// the real form's request on its way out, as an older page or a crafted post would send it.
const REFUSALS = [
  ['no company (a page loaded before the rule)', 409, 'This page is out of date. Reload it, then send again.', (f) => f.delete('company'), (j) => delete j.company],
  ['two companies', 400, 'Pick one company for this referral.', (f) => f.append('company', 'Staffing'), (j) => (j.company = ['HealthFirst', 'Staffing'])],
  ['a company that is not offered', 403, 'Referrals to this company are not open right now.', (f) => f.set('company', 'Unitas'), (j) => (j.company = 'Unitas')],
];
const refusalChecks = async (mode, gotoPath) => {
  for (const js of [false, true]) {
    for (const [label, status, words, editForm, editJson] of REFUSALS) {
      await check(`S2 ${mode}, ${js ? 'JS on' : 'JS off'}: ${label} is refused (${status}) and the words show`, async () => {
        const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        try {
          let seen = 0;
          await page.route(js ? '**/api/referral' : `**/refer/${REP_MGR_KEY}`, async (route) => {
            const req = route.request();
            if (req.method() !== 'POST') return route.continue();
            seen = 0;
            if (js) {
              const body = JSON.parse(req.postData() || '{}');
              editJson(body);
              return route.continue({ postData: JSON.stringify(body) });
            }
            const form = new URLSearchParams(req.postData() || '');
            editForm(form);
            return route.continue({ postData: form.toString() });
          });
          page.on('response', (res) => {
            if (res.request().method() === 'POST') seen = res.status();
          });
          await page.goto(`${BASE}${gotoPath(REP_MGR_KEY)}`);
          bodies.length = 0;
          await page.fill('[name=contactName]', 'TEST Office Manager');
          await page.fill('[name=practiceName]', 'TEST North Side Dental');
          await page.fill('[name=jde]', '001234');
          await page.fill('[name=officePhone]', '303-555-0100');
          await page.check('[name=preferredContact][value=Text]');
          await page.check('[name=permission]');
          await page.click('#rep-send-button');
          if (js) await page.waitForTimeout(1200);
          else await page.waitForLoadState('load');
          assert.equal(seen, status);
          const shown = page.getByText(words, { exact: true });
          assert.ok((await shown.count()) >= 1, 'the words are on the page');
          assert.equal(await shown.first().isVisible(), true, 'the words are visible');
          assert.equal(await page.isVisible('#rep-receipt'), false);
          assert.equal(count('submit'), 0, 'nothing reached 1F');
        } finally {
          await ctx.close();
        }
      });
    }
  }
};

// S2 (field two-track spec, section 4): REP_APP_COMPANIES=HealthFirst,Staffing. Send opens
// on a company choice; HealthFirst leads to today's form and sends the same 1F body as run 1;
// staffing has its own form (S3), and the server refuses a company that is off.
dev = await startDev({ ...env, REP_APP_ENABLED: 'true', REP_APP_COMPANIES: 'HealthFirst,Staffing' });
try {
  for (const js of [false, true]) {
    const tag = js ? 'JS on' : 'JS off';
    const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const apiBodies = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/api/referral') && req.method() === 'POST') apiBodies.push(JSON.parse(req.postData() || '{}'));
    });
    await check(`S2 ${tag}: Send opens on the company choice, HealthFirst and Direct Dental`, async () => {
      await page.goto(`${BASE}/refer/${REP_KEY}`);
      assert.equal(await page.textContent('.rep-who h1'), 'Send a referral');
      assert.equal(await page.textContent('.rep-who p'), 'Sending as TEST Rep.');
      assert.equal(await page.isVisible('#rep-pick'), true);
      assert.deepEqual((await page.locator('.rep-pick-company').allTextContents()).map((t) => t.trim()), ['HealthFirst', 'Direct Dental']);
      assert.equal(await page.isVisible('#rep-form'), false);
      assert.equal(await page.isVisible('#staffing-form'), false);
      assert.match(await page.title(), /^Send a referral \| TEST Rep$/);
      assert.equal(/\$\d/.test(await page.textContent('#rep-app')), false);
    });
    await check(`S2 ${tag}: Direct Dental opens its own form, sends nothing until used, and Pick another company returns`, async () => {
      bodies.length = 0;
      await page.click('.rep-pick-company[data-company=Staffing]');
      if (!js) await page.waitForLoadState('load');
      await page.waitForSelector('#staffing-form', { state: 'visible' });
      assert.equal(await page.isVisible('#rep-form'), false);
      assert.equal(count('submit'), 0);
      await page.click('[data-company-panel=Staffing] [data-pick-again]');
      if (!js) await page.waitForLoadState('load');
      assert.equal(await page.isVisible('#rep-pick'), true);
    });
    await check(`S2 ${tag}: HealthFirst opens today's form, and it sends the same 1F body as with the switch unset`, async () => {
      bodies.length = 0;
      apiBodies.length = 0;
      await page.click('.rep-pick-company[data-company=HealthFirst]');
      if (!js) await page.waitForLoadState('load');
      await page.waitForSelector('#rep-form', { state: 'visible' });
      assert.equal(await page.isVisible('#rep-pick'), false);
      assert.equal(await page.textContent('[data-company-panel=HealthFirst] h2'), 'HealthFirst compliance referral');
      assert.deepEqual(await page.locator('.rep-guide p').allTextContents(), [
        "Ask: Has the office done this year's OSHA and HIPAA training? Are the manuals current?",
        'If either answer is no, ask: Can HealthFirst call you to get it handled?',
        'If they say yes, send it.',
      ]);
      await page.fill('[name=contactName]', 'TEST Office Manager');
      await page.fill('[name=practiceName]', 'TEST North Side Dental');
      await page.fill('[name=jde]', '001234');
      await page.fill('[name=officePhone]', '303-555-0100');
      await page.check('[name=preferredContact][value=Text]');
      await page.check('[name=permission]');
      if (js) assert.equal(await page.textContent('#rep-send-button'), 'Send to HealthFirst');
      await page.click('#rep-send-button');
      if (!js) await page.waitForLoadState('load');
      await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
      assert.equal(await page.textContent('#rep-receipt h2'), 'Sent to HealthFirst');
      assert.equal(PRIVATE.test(decodeURIComponent(page.url())), false, page.url());
      const sent = bodies.filter((b) => b.action === 'submit');
      assert.equal(sent.length, 1);
      assert.ok(classicBodies[tag], 'run 1 saved the body');
      const { submissionId: a, ...ours } = sent[0];
      const { submissionId: b, ...classic } = classicBodies[tag];
      assert.deepEqual(ours, classic);
      assert.match(a, /^[0-9a-f-]{36}$/);
      // The page names exactly one company to the site; the key is never forwarded to 1F.
      if (js) {
        assert.equal(apiBodies.length, 1);
        assert.equal(apiBodies[0].company, 'HealthFirst');
        assert.equal('companies' in apiBodies[0], false);
      }
      assert.equal('company' in sent[0], false);
    });
    if (js) {
      await check('S2 JS on: Track still loads the referrals with the company choice on', async () => {
        await page.click('#rep-track-this');
        await page.waitForSelector('.lead-row', { timeout: 10000 });
        assert.equal(await page.locator('#rep-track-list .lead-row').count(), 1);
      });
    }
    await ctx.close();
  }

  await check('S2: direct posts naming staffing, both companies, or none are refused, and nothing reaches 1F', async () => {
    bodies.length = 0;
    const base = { app: 'rep', referralKey: REP_MGR_KEY, contactName: 'TEST Office Manager', practiceName: 'TEST North Side Dental', jde: '001234', officePhone: '303-555-0100', preferredContact: 'Text', permission: true };
    const cases = [
      [{ company: ['HealthFirst', 'Staffing'] }, 400],
      [{ company: 'HealthFirst', companies: ['HealthFirst', 'HS Staffing / Recruiting Services (including GoTu)'] }, 400],
      [{}, 409],
      [{ company: 'healthfirst' }, 403],
    ];
    for (const [extra, status] of cases) {
      const res = await post('/api/referral', { ...base, submissionId: crypto.randomUUID(), ...extra });
      assert.equal(res.status, status, JSON.stringify(extra));
    }
    // The no-JavaScript post: staffing, and two company fields.
    const res = await fetch(`${BASE}/refer/${REP_MGR_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: BASE },
      body: `app=rep&company=HealthFirst&company=Staffing&${new URLSearchParams({ ...REP_FORM_FIELDS, jde: '001234', submissionId: crypto.randomUUID() })}`,
    });
    assert.equal(res.status, 400);
    assert.equal(count('submit'), 0);
  });

  // S3 (field two-track spec, section 4 "Staffing form"), pay off, JavaScript off and on.
  const CONSENT = 'The customer gave permission for Direct Dental to contact them about staffing.*';
  const STAR = '* Direct Dental may void this referral if the customer did not give permission to be contacted about this service.';
  for (const js of [false, true]) {
    const tag = js ? 'JS on' : 'JS off';
    const fill = async (page, { type, permission }) => {
      await page.fill('#staffing-form [name=contactName]', 'TEST Contact');
      await page.fill('#staffing-form [name=practiceName]', 'TEST Dental Practice');
      await page.fill('#staffing-form [name=jde]', '1234');
      await page.fill('#staffing-form [name=officePhone]', '555-0100');
      await page.check('#staffing-form [name=preferredContact][value=Call]');
      if (type) await page.check(`#staffing-form [name=practiceType][value="${type}"]`);
      if (permission) await page.check('#staffing-form [name=permission]');
    };
    const open = async (browserCtx) => {
      const page = await browserCtx.newPage();
      await page.goto(`${BASE}/refer/${REP_KEY}?company=Staffing`);
      await page.waitForSelector('#staffing-form', { state: 'visible' });
      return page;
    };
    await check(`S3 ${tag}: the form shows the approved words, no dollars with pay off, and a blank practice type`, async () => {
      const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js, reducedMotion: 'reduce' });
      try {
        const page = await open(ctx);
        assert.equal(await page.textContent('#rs-title'), 'Staffing referral');
        assert.match(await page.textContent('[data-staffing]'), /Sending as TEST Rep\./);
        assert.equal(await page.textContent('[data-staffing-consent]'), CONSENT);
        assert.equal((await page.textContent('.rs-star')).trim(), STAR);
        assert.deepEqual((await page.locator('#staffing-form fieldset:nth-of-type(2) label').allTextContents()).map((t) => t.trim()), ['Private practice', 'Group (3 or more locations)']);
        assert.equal(await page.locator('#staffing-form [name=practiceType]:checked').count(), 0);
        assert.equal(await page.locator('[data-staffing-pay]').count(), 0);
        assert.equal(/\$\d|HealthFirst/.test(await page.textContent('[data-company-panel=Staffing]')), false);
        if (js) assert.equal(await page.textContent('#staffing-send-button'), 'Pick how to reach them');
      } finally {
        await ctx.close();
      }
    });
    await check(`S3 ${tag}: no practice type, or an unticked box, blocks the send and nothing reaches 1F`, async () => {
      const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js, reducedMotion: 'reduce' });
      try {
        const page = await open(ctx);
        bodies.length = 0;
        await fill(page, { type: '', permission: true });
        if (js) assert.equal(await page.textContent('#staffing-send-button'), 'Pick the practice type');
        await page.click('#staffing-send-button');
        if (!js) await page.waitForLoadState('load');
        await page.waitForSelector('#staffing-form [data-for=practiceType]:not(:empty)');
        assert.equal(await page.textContent('#staffing-form [data-for=practiceType]'), 'Pick the practice type.');
        assert.equal(count('submit'), 0);
        await ctx.clearCookies();
        const page2 = await open(ctx);
        await fill(page2, { type: 'Group', permission: false });
        if (js) assert.equal(await page2.textContent('#staffing-send-button'), "Check the customer's OK");
        await page2.click('#staffing-send-button');
        if (!js) await page2.waitForLoadState('load');
        await page2.waitForSelector('#staffing-form [data-for=permission]:not(:empty)');
        assert.equal(await page2.textContent('#staffing-form [data-for=permission]'), "Check the customer's OK.");
        assert.equal(count('submit'), 0);
      } finally {
        await ctx.close();
      }
    });
    await check(`S3 ${tag}: a good send posts needs Staffing, the consent on screen and the practice type; the receipt names Direct Dental`, async () => {
      const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js, reducedMotion: 'reduce' });
      try {
        const page = await open(ctx);
        bodies.length = 0;
        await fill(page, { type: 'Group', permission: true });
        const onScreen = (await page.textContent('[data-staffing-consent]')).trim();
        if (js) assert.equal(await page.textContent('#staffing-send-button'), 'Send to Direct Dental');
        await page.click('#staffing-send-button');
        if (!js) await page.waitForLoadState('load');
        await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
        const sent = bodies.filter((b) => b.action === 'submit');
        assert.equal(sent.length, 1);
        assert.deepEqual(sent[0].needs, ['Staffing']);
        assert.deepEqual(sent[0].companies, ['HS Staffing / Recruiting Services (including GoTu)']);
        assert.equal(sent[0].practiceType, 'Group');
        assert.equal(sent[0].consentText, onScreen);
        assert.equal(sent[0].consentText, CONSENT);
        assert.equal(sent[0].route, 'Partner');
        assert.equal('company' in sent[0], false);
        assert.equal(/OSHA|HIPAA|HealthFirst/.test(JSON.stringify(sent[0])), false);
        const receiptText = await page.textContent('#rep-receipt');
        assert.equal(await page.textContent('#rep-receipt h2'), 'Sent to Direct Dental');
        assert.equal(await page.textContent('#rep-receipt-calls'), "Direct Dental's team will call TEST Contact.");
        assert.equal(/HealthFirst/.test(receiptText), false, receiptText);
        // Pay is off: no dollar amount and no money line.
        assert.equal(/\$\d/.test(receiptText), false, receiptText);
        assert.equal(await page.isVisible('#rep-receipt-money'), false);
        assert.equal(PRIVATE.test(decodeURIComponent(page.url())), false, page.url());
      } finally {
        await ctx.close();
      }
    });
  }
  await check('S3 JS on: a double tap makes one row (one submit, one id)', async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/refer/${REP_KEY}?company=Staffing`);
      await page.waitForSelector('#staffing-form', { state: 'visible' });
      bodies.length = 0;
      await page.fill('#staffing-form [name=contactName]', 'TEST Contact');
      await page.fill('#staffing-form [name=practiceName]', 'TEST Dental Practice');
      await page.fill('#staffing-form [name=jde]', '1234');
      await page.fill('#staffing-form [name=officePhone]', '555-0100');
      await page.check('#staffing-form [name=preferredContact][value=Text]');
      await page.check('#staffing-form [name=practiceType][value="Private practice"]');
      await page.check('#staffing-form [name=permission]');
      await page.evaluate(() => {
        const f = document.getElementById('staffing-form');
        f.requestSubmit();
        f.requestSubmit();
        f.requestSubmit();
      });
      await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
      await page.waitForTimeout(300);
      assert.equal(count('submit'), 1);
    } finally {
      await ctx.close();
    }
  });
  await check('S3: a direct post of a bad practice type, or an unticked box, is refused and nothing reaches 1F', async () => {
    bodies.length = 0;
    const base = { app: 'rep', company: 'Staffing', referralKey: REP_MGR_KEY, contactName: 'TEST Contact', practiceName: 'TEST Dental Practice', jde: '1234', officePhone: '555-0100', preferredContact: 'Call', permission: true };
    for (const extra of [{}, { practiceType: 'Group (3 or more locations)' }, { practiceType: 'group' }, { practiceType: 'Group', permission: false }]) {
      const res = await post('/api/referral', { ...base, submissionId: crypto.randomUUID(), ...extra });
      assert.equal(res.status, 422, JSON.stringify(extra));
    }
    assert.equal(count('submit'), 0);
    const ok = await post('/api/referral', { ...base, submissionId: crypto.randomUUID(), practiceType: 'Private practice' });
    assert.equal(ok.status, 200);
    assert.deepEqual(bodies.find((b) => b.action === 'submit').needs, ['Staffing']);
  });
  await check('S3 JS on: a staffing send, then a HealthFirst send from the same page, both reach 1F (each form has its own id)', async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/refer/${REP_KEY}`);
      bodies.length = 0;
      const ids = await page.evaluate(() => [...document.querySelectorAll('[name=submissionId]')].map((e) => e.value));
      assert.equal(ids.length, 2);
      assert.notEqual(ids[0], ids[1]);
      await page.click('.rep-pick-company[data-company=Staffing]');
      await page.fill('#staffing-form [name=contactName]', 'TEST Contact');
      await page.fill('#staffing-form [name=practiceName]', 'TEST Dental Practice');
      await page.fill('#staffing-form [name=jde]', '1234');
      await page.fill('#staffing-form [name=officePhone]', '555-0100');
      await page.check('#staffing-form [name=preferredContact][value=Call]');
      await page.check('#staffing-form [name=practiceType][value=Group]');
      await page.check('#staffing-form [name=permission]');
      await page.click('#staffing-send-button');
      await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
      assert.equal(await page.textContent('#rep-receipt h2'), 'Sent to Direct Dental');
      // Back to the form without a reload: the Track tab, then Send.
      await page.click('[data-tab=track]');
      await page.click('[data-tab=send]');
      await page.waitForSelector('#rep-send', { state: 'visible' });
      await page.click('[data-company-panel=Staffing] [data-pick-again]');
      await page.click('.rep-pick-company[data-company=HealthFirst]');
      await page.fill('#rep-form [name=contactName]', 'TEST Office Manager');
      await page.fill('#rep-form [name=practiceName]', 'TEST North Side Dental');
      await page.fill('#rep-form [name=jde]', '001234');
      await page.fill('#rep-form [name=officePhone]', '303-555-0100');
      await page.check('#rep-form [name=preferredContact][value=Text]');
      await page.check('#rep-form [name=permission]');
      await page.click('#rep-send-button');
      await page.waitForFunction(() => document.querySelector('#rep-receipt h2')?.textContent === 'Sent to HealthFirst', null, { timeout: 10000 });
      const sent = bodies.filter((b) => b.action === 'submit');
      assert.equal(sent.length, 2);
      assert.notEqual(sent[0].submissionId, sent[1].submissionId);
      assert.deepEqual(sent.map((b) => b.needs[0]), ['Staffing', 'OSHA and HIPAA compliance']);
    } finally {
      await ctx.close();
    }
  });
  await refusalChecks('two companies on', (key) => `/refer/${key}?company=HealthFirst`);
} finally {
  killDev(dev);
}

// S3 with pay on and a staffing plan (REP_PAY_PLAN_STAFFING, from S1): the pay line and the
// receipt promise the amount for the practice type picked, JavaScript off and on; a bad
// staffing plan promises nothing and leaves HealthFirst's promise alone.
for (const [plan, label] of [['reached_private:100,reached_group:200,manager:50', 'plan set'], ['junk', 'bad plan']]) {
  dev = await startDev({ ...env, REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'true', REP_APP_COMPANIES: 'HealthFirst,Staffing', REP_PAY_PLAN_STAFFING: plan });
  try {
    for (const js of [false, true]) {
      for (const [type, dollars] of [['Private practice', '$100'], ['Group', '$200']]) {
        await check(`S3 pay on, ${label}, ${js ? 'JS on' : 'JS off'}: ${type} receipt and pay line`, async () => {
          const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js, reducedMotion: 'reduce' });
          try {
            const page = await ctx.newPage();
            await page.goto(`${BASE}/refer/${REP_KEY}?company=Staffing`);
            const pay = page.locator('[data-staffing-pay]');
            if (label === 'plan set') {
              assert.equal((await pay.textContent()).trim(), 'You earn $100 for a private practice, or $200 for a group with 3 or more locations, when Direct Dental reaches the customer and confirms the lead qualifies.');
            } else {
              assert.equal(await pay.count(), 0);
            }
            assert.equal(/HealthFirst/.test(await page.textContent('[data-company-panel=Staffing]')), false);
            await page.fill('#staffing-form [name=contactName]', 'TEST Contact');
            await page.fill('#staffing-form [name=practiceName]', 'TEST Dental Practice');
            await page.fill('#staffing-form [name=jde]', '1234');
            await page.fill('#staffing-form [name=officePhone]', '555-0100');
            await page.check('#staffing-form [name=preferredContact][value=Call]');
            await page.check(`#staffing-form [name=practiceType][value="${type}"]`);
            await page.check('#staffing-form [name=permission]');
            await page.click('#staffing-send-button');
            if (!js) await page.waitForLoadState('load');
            await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
            const text = await page.textContent('#rep-receipt');
            assert.equal(/HealthFirst/.test(text), false, text);
            assert.equal(await page.textContent('#rep-receipt h2'), 'Sent to Direct Dental');
            if (label === 'plan set') {
              assert.equal(await page.textContent('#rep-receipt-money'), `You'll earn ${dollars} when Direct Dental reaches TEST Contact and confirms the lead qualifies.`);
            } else {
              assert.equal(await page.isVisible('#rep-receipt-money'), false);
              assert.equal(/\$\d/.test(text), false, text);
            }
          } finally {
            await ctx.close();
          }
        });
      }
    }
    if (label === 'plan set') {
      const fillStaffing = async (page, type) => {
        await page.fill('#staffing-form [name=contactName]', 'TEST Contact');
        await page.fill('#staffing-form [name=practiceName]', 'TEST Dental Practice');
        await page.fill('#staffing-form [name=jde]', '1234');
        await page.fill('#staffing-form [name=officePhone]', '555-0100');
        await page.check('#staffing-form [name=preferredContact][value=Call]');
        await page.check(`#staffing-form [name=practiceType][value="${type}"]`);
        await page.check('#staffing-form [name=permission]');
      };
      await check('S3 pay on, JS on: a retry after a timeout resends what was first posted, and the receipt follows it ($100, not $200)', async () => {
        const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
        try {
          const page = await ctx.newPage();
          const posted = [];
          let first = true;
          await page.route('**/api/referral', async (route) => {
            const body = JSON.parse(route.request().postData() || '{}');
            if (body.company !== 'Staffing') return route.continue();
            posted.push(body);
            if (first) {
              first = false;
              return route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ timeout: true, error: 'Timed out.' }) });
            }
            return route.continue();
          });
          await page.goto(`${BASE}/refer/${REP_KEY}?company=Staffing`);
          bodies.length = 0;
          await fillStaffing(page, 'Private practice');
          await page.click('#staffing-send-button');
          await page.waitForFunction(() => !document.getElementById('staffing-alert').hidden);
          assert.equal(await page.isVisible('#rep-receipt'), false);
          // Changed since the first post; the retry must not carry it.
          await page.check('#staffing-form [name=practiceType][value=Group]');
          await page.fill('#staffing-form [name=contactName]', 'TEST Someone Else');
          await page.click('#staffing-send-button');
          await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
          assert.equal(posted.length, 2);
          assert.equal(posted[1].practiceType, 'Private practice');
          assert.equal(posted[1].contactName, 'TEST Contact');
          assert.equal(posted[1].submissionId, posted[0].submissionId);
          assert.equal(await page.textContent('#rep-receipt-money'), "You'll earn $100 when Direct Dental reaches TEST Contact and confirms the lead qualifies.");
          assert.equal(bodies.filter((b) => b.action === 'submit').length, 1);
        } finally {
          await ctx.close();
        }
      });
      await check('HealthFirst, JS on: a retry after a timeout resends what was first posted, and the receipt follows it', async () => {
        const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
        try {
          const page = await ctx.newPage();
          const posted = [];
          let first = true;
          await page.route('**/api/referral', async (route) => {
            const body = JSON.parse(route.request().postData() || '{}');
            if (body.company !== 'HealthFirst') return route.continue();
            posted.push(body);
            if (first) {
              first = false;
              return route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ timeout: true, error: 'Timed out.' }) });
            }
            return route.continue();
          });
          await page.goto(`${BASE}/refer/${REP_KEY}?company=HealthFirst`);
          bodies.length = 0;
          await page.fill('#rep-form [name=contactName]', 'TEST Office Manager');
          await page.fill('#rep-form [name=practiceName]', 'TEST North Side Dental');
          await page.fill('#rep-form [name=jde]', '001234');
          await page.fill('#rep-form [name=officePhone]', '303-555-0100');
          await page.check('#rep-form [name=preferredContact][value=Text]');
          await page.check('#rep-form [name=permission]');
          await page.click('#rep-send-button');
          await page.waitForFunction(() => !document.getElementById('rep-alert').hidden);
          assert.equal(await page.isVisible('#rep-receipt'), false);
          // Changed since the first post; the retry must not carry it.
          await page.fill('#rep-form [name=contactName]', 'TEST Someone Else');
          await page.fill('#rep-form [name=practiceName]', 'TEST Other Dental');
          await page.check('#rep-form [name=preferredContact][value=Call]');
          await page.click('#rep-send-button');
          await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
          assert.equal(posted.length, 2);
          assert.equal(posted[1].submissionId, posted[0].submissionId);
          assert.equal(posted[1].contactName, 'TEST Office Manager');
          assert.equal(posted[1].practiceName, 'TEST North Side Dental');
          assert.equal(posted[1].preferredContact, 'Text');
          const receipt = await page.textContent('#rep-receipt');
          assert.equal(receipt.includes('TEST Someone Else'), false, receipt);
          assert.equal(bodies.filter((b) => b.action === 'submit').length, 1);
          assert.equal(bodies.find((b) => b.action === 'submit')?.doctorName, 'TEST Office Manager');
        } finally {
          await ctx.close();
        }
      });
      await check('S3 pay on, JS on: the HealthFirst terms changing does not take away the staffing promise', async () => {
        const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
        try {
          const page = await ctx.newPage();
          await page.route('**/api/referral', async (route) => {
            const res = await route.fetch();
            const json = await res.json();
            // Only the HealthFirst part changes; the staffing part (slice S5) stays the server's.
            const at = typeof json.terms === 'string' ? json.terms.indexOf(';staffing=') : -1;
            await route.fulfill({ response: res, json: { ...json, terms: `reached:1,signed:2${at < 0 ? '' : json.terms.slice(at)}` } });
          });
          await page.goto(`${BASE}/refer/${REP_KEY}?company=Staffing`);
          await fillStaffing(page, 'Group');
          await page.click('#staffing-send-button');
          await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
          assert.equal(await page.textContent('#rep-receipt-money'), "You'll earn $200 when Direct Dental reaches TEST Contact and confirms the lead qualifies.");
        } finally {
          await ctx.close();
        }
      });
      // S5, Codex P1 on #132: REP_PAY_PLAN_STAFFING changes while the page is open. A Track
      // read answers with the new terms, so back on Send the staffing pay line shows the
      // reload words and no amount, and a staffing send words no dollar promise.
      await check('S5 pay on, JS on: a Track read with changed staffing terms drops the staffing promise on Send', async () => {
        const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
        try {
          const page = await ctx.newPage();
          const NEW = ';staffing=reached_private:150,reached_group:250,manager:50';
          const swap = (t) => (typeof t === 'string' && t.includes(';staffing=') ? t.slice(0, t.indexOf(';staffing=')) + NEW : t);
          let swapped = 0;
          await page.route('**/api/referral-list', async (route) => {
            const res = await route.fetch();
            const json = await res.json();
            if (json.money) json.money.terms = swap(json.money.terms);
            swapped += 1;
            await route.fulfill({ response: res, json: { ...json, terms: swap(json.terms) } });
          });
          await page.goto(`${BASE}/refer/${REP_KEY}?company=Staffing`);
          await page.addStyleTag({ content: HIDE_TOOLBAR });
          assert.match(await page.textContent('[data-staffing-pay]'), /\$100 for a private practice, or \$200 for a group/);
          await page.click('[data-tab=track]');
          await page.waitForSelector('.lead-row', { timeout: 10000 });
          assert.ok(swapped >= 1, 'the Track read went out');
          await page.click('[data-tab=send]');
          await page.waitForSelector('#staffing-form', { state: 'visible' });
          const line = (await page.textContent('[data-staffing-pay]')).trim();
          assert.equal(line, 'Pay terms changed. Reload this page to see them.');
          assert.equal(/\$\d/.test(await page.textContent('[data-company-panel=Staffing]')), false, 'no stale staffing amount on Send');
          await fillStaffing(page, 'Group');
          await page.click('#staffing-send-button');
          await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
          assert.equal(await page.isVisible('#rep-receipt-money'), false, 'no staffing receipt promise either');
        } finally {
          await ctx.close();
        }
      });
    }
  } finally {
    killDev(dev);
  }
}

// S2: Staffing alone switches HealthFirst off. No HealthFirst form, a HealthFirst send is
// refused, and Track still works (the switch gates sending only, check M15).
dev = await startDev({ ...env, REP_APP_ENABLED: 'true', REP_APP_COMPANIES: 'Staffing' });
try {
  await check('S2 Staffing only: no HealthFirst form or choice, Track still loads, HealthFirst refused', async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(`${BASE}/refer/${REP_KEY}`);
      assert.equal(await page.locator('#rep-form').count(), 0);
      assert.equal(await page.locator('#rep-pick').count(), 0);
      assert.equal(await page.isVisible('#staffing-form'), true);
      await page.click('[data-tab=track]');
      await page.waitForSelector('.lead-row', { timeout: 10000 });
      assert.deepEqual(errors, []);
    } finally {
      await ctx.close();
    }
    bodies.length = 0;
    const res = await post('/api/referral', { app: 'rep', company: 'HealthFirst', referralKey: REP_KEY, submissionId: crypto.randomUUID(), ...REP_FORM_FIELDS, permission: true, jde: '001234' });
    assert.equal(res.status, 403);
    assert.equal(count('submit'), 0);
  });
  // Codex P1 on #125: with Staffing the only panel, a refused post from any other form (none
  // named, two, one not offered, or HealthFirst) still shows its words, JavaScript off and on.
  for (const js of [false, true]) {
    for (const [label, status, words, editForm, editJson] of [...REFUSALS, ['HealthFirst (switched off)', 403, 'Referrals to this company are not open right now.', (f) => f.set('company', 'HealthFirst'), (j) => (j.company = 'HealthFirst')]]) {
      await check(`S2 Staffing only, ${js ? 'JS on' : 'JS off'}: ${label} is refused (${status}) and the words show`, async () => {
        const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        try {
          let seen = 0;
          await page.route(js ? '**/api/referral' : `**/refer/${REP_KEY}`, async (route) => {
            const req = route.request();
            if (req.method() !== 'POST') return route.continue();
            if (js) {
              const body = JSON.parse(req.postData() || '{}');
              editJson(body);
              return route.continue({ postData: JSON.stringify(body) });
            }
            const form = new URLSearchParams(req.postData() || '');
            editForm(form);
            return route.continue({ postData: form.toString() });
          });
          page.on('response', (res) => {
            if (res.request().method() === 'POST') seen = res.status();
          });
          await page.goto(`${BASE}/refer/${REP_KEY}`);
          bodies.length = 0;
          await page.fill('#staffing-form [name=contactName]', 'TEST Contact');
          await page.fill('#staffing-form [name=practiceName]', 'TEST Dental Practice');
          await page.fill('#staffing-form [name=jde]', '1234');
          await page.fill('#staffing-form [name=officePhone]', '555-0100');
          await page.check('#staffing-form [name=preferredContact][value=Call]');
          await page.check('#staffing-form [name=practiceType][value=Group]');
          await page.check('#staffing-form [name=permission]');
          await page.click('#staffing-send-button');
          if (js) await page.waitForTimeout(1200);
          else await page.waitForLoadState('load');
          assert.equal(seen, status);
          const shown = page.getByText(words);
          assert.ok((await shown.count()) >= 1, 'the words are on the page');
          assert.equal(await shown.first().isVisible(), true, 'the words are visible');
          assert.equal(await page.isVisible('#staffing-form'), true);
          assert.equal(await page.isVisible('#rep-receipt'), false);
          assert.equal(count('submit'), 0, 'nothing reached 1F');
        } finally {
          await ctx.close();
        }
      });
    }
  }
} finally {
  killDev(dev);
}

// Codex P1 on #125: REP_APP_COMPANIES changes between page load and post, JavaScript off.
// Pages load with both companies on. Switched to Staffing only, the HealthFirst page's post is
// refused (403) and says so above the open staffing form. Switched to HealthFirst only, the
// staffing page's post is refused the same way, and the HealthFirst form takes none of its
// fields or its consent. Nothing reaches 1F either time.
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: false, reducedMotion: 'reduce' });
  const OFF_WORDS = 'Referrals to this company are not open right now.';
  try {
    dev = await startDev({ ...env, REP_APP_ENABLED: 'true', REP_APP_COMPANIES: 'HealthFirst,Staffing' });
    let hfPage;
    let staffPage;
    try {
      hfPage = await ctx.newPage();
      await hfPage.goto(`${BASE}/refer/${REP_KEY}?company=HealthFirst`);
      await hfPage.fill('#rep-form [name=contactName]', 'TEST Office Manager');
      await hfPage.fill('#rep-form [name=practiceName]', 'TEST North Side Dental');
      await hfPage.fill('#rep-form [name=jde]', '001234');
      await hfPage.fill('#rep-form [name=officePhone]', '303-555-0100');
      await hfPage.check('#rep-form [name=preferredContact][value=Text]');
      await hfPage.check('#rep-form [name=permission]');
      staffPage = await ctx.newPage();
      await staffPage.goto(`${BASE}/refer/${REP_KEY}?company=Staffing`);
      await staffPage.fill('#staffing-form [name=contactName]', 'TEST Contact');
      await staffPage.fill('#staffing-form [name=practiceName]', 'TEST Dental Practice');
      await staffPage.fill('#staffing-form [name=jde]', '1234');
      await staffPage.fill('#staffing-form [name=officePhone]', '555-0100');
      await staffPage.check('#staffing-form [name=preferredContact][value=Call]');
      await staffPage.check('#staffing-form [name=practiceType][value=Group]');
      await staffPage.check('#staffing-form [name=permission]');
    } finally {
      killDev(dev);
    }
    const sendAfterSwitch = async (page, button) => {
      let seen = 0;
      page.on('response', (res) => {
        if (res.request().method() === 'POST') seen = res.status();
      });
      bodies.length = 0;
      await page.click(button);
      await page.waitForLoadState('load');
      return seen;
    };
    dev = await startDev({ ...env, REP_APP_ENABLED: 'true', REP_APP_COMPANIES: 'Staffing' });
    try {
      await check('S2 JS off: a HealthFirst page posted after the switch goes to Staffing only is refused, and the words show', async () => {
        assert.equal(await sendAfterSwitch(hfPage, '#rep-send-button'), 403);
        assert.equal(await hfPage.isVisible('#rep-refused'), true);
        assert.equal((await hfPage.textContent('#rep-refused')).trim(), `Your HealthFirst referral did not send. ${OFF_WORDS}`);
        assert.equal(await hfPage.isVisible('#staffing-form'), true);
        assert.equal(await hfPage.inputValue('#staffing-form [name=contactName]'), '');
        assert.equal(await hfPage.isChecked('#staffing-form [name=permission]'), false);
        assert.equal(await hfPage.isVisible('#rep-receipt'), false);
        assert.equal(PRIVATE.test(decodeURIComponent(hfPage.url())), false, hfPage.url());
        assert.equal(count('submit'), 0, 'nothing reached 1F');
      });
    } finally {
      killDev(dev);
    }
    dev = await startDev({ ...env, REP_APP_ENABLED: 'true', REP_APP_COMPANIES: 'HealthFirst' });
    try {
      await check('S2 JS off: a staffing page posted after the switch goes to HealthFirst only is refused, and the words show', async () => {
        assert.equal(await sendAfterSwitch(staffPage, '#staffing-send-button'), 403);
        assert.equal(await staffPage.isVisible('#rep-refused'), true);
        assert.equal((await staffPage.textContent('#rep-refused')).trim(), `Your Direct Dental referral did not send. ${OFF_WORDS}`);
        assert.equal(await staffPage.isVisible('#rep-form'), true);
        assert.equal(await staffPage.isVisible('#rep-alert'), false);
        assert.equal(await staffPage.inputValue('#rep-form [name=contactName]'), '');
        assert.equal(await staffPage.isChecked('#rep-form [name=permission]'), false);
        assert.equal(await staffPage.locator('#rep-form .rep-err:not(:empty)').count(), 0);
        assert.equal(await staffPage.isVisible('#rep-receipt'), false);
        assert.equal(count('submit'), 0, 'nothing reached 1F');
      });
    } finally {
      killDev(dev);
    }
  } finally {
    await ctx.close();
  }
}

// S2: junk in REP_APP_COMPANIES (odd case, spaces, unknown keys, empty entries) leaves the
// rep page exactly as with it unset, and HealthFirst still sends.
dev = await startDev({ ...env, REP_APP_ENABLED: 'true', REP_APP_COMPANIES: ' healthfirst ,Unitas,,Stafing ' });
try {
  await check('S2 junk REP_APP_COMPANIES: the rep pages are the same HTML as with it unset', async () => {
    const pages = await captureRepPages(true);
    assert.equal(pages.length, repPages.off.length);
    pages.forEach(([label, key, page], i) => {
      assert.equal(page.status, repPages.off[i][2].status, label);
      assert.equal(normal(page.html, key), normal(repPages.off[i][2].html, key), label);
    });
  });
  await refusalChecks('classic (junk REP_APP_COMPANIES, so HealthFirst only)', (key) => `/refer/${key}`);
} finally {
  killDev(dev);
}


// REP_ASK_STATE (HealthFirst splits its reps by state): the HealthFirst form asks for the
// practice's state, refuses a send without it, and 1F gets the code as practiceState. With
// JavaScript off the server does the same check.
dev = await startDev({ ...env, REP_APP_ENABLED: 'true', REP_ASK_STATE: 'true' });
try {
  for (const js of [false, true]) {
    const tag = js ? 'JS on' : 'JS off';
    const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: js, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const submit = async () => {
      await page.click('#rep-send-button');
      if (js) await page.waitForTimeout(1200);
      else await page.waitForLoadState('load');
    };
    try {
      await check(`REP_ASK_STATE ${tag}: no state shows its error and sends nothing; a picked state reaches 1F`, async () => {
        bodies.length = 0;
        await page.goto(`${BASE}/refer/${REP_KEY}`);
        assert.equal(await page.locator('#rep-form select[name=practiceState] option').count(), 52);
        await page.fill('[name=contactName]', 'TEST Office Manager');
        await page.fill('[name=practiceName]', 'TEST North Side Dental');
        await page.fill('[name=jde]', '001234');
        await page.fill('[name=officePhone]', '303-555-0100');
        await page.check('[name=preferredContact][value=Text]');
        await page.check('[name=permission]');
        if (js) assert.equal((await page.textContent('#rep-send-button')).trim(), 'Pick the state');
        await submit();
        assert.match(await page.textContent('.rep-err[data-for=practiceState]'), /state/);
        assert.equal(count('submit'), 0, 'nothing reached 1F');
        if (js) {
          // The list gives way to the type-ahead box, which sets the same field.
          assert.equal(await page.isVisible('#rep-form select[name=practiceState]'), false);
          const box = page.locator('#rep-form [data-state-input]');
          assert.equal(await box.getAttribute('id'), 'rep-state');
          await box.fill('Colorad0');
          assert.equal(await page.isVisible('#rep-state-list'), false, 'no match, no list');
          await page.click('[name=jde]');
          assert.equal(await page.inputValue('#rep-form select[name=practiceState]'), '', 'text that is not a state picks none');
          assert.equal((await page.textContent('#rep-send-button')).trim(), 'Pick the state');
          await box.fill('');
          await box.pressSequentially('co');
          const options = (await page.locator('#rep-state-list [role=option]').allTextContents()).map((t) => t.trim());
          assert.deepEqual(options, ['ColoradoCO', 'ConnecticutCT', 'District of ColumbiaDC']);
          await box.press('ArrowDown');
          await box.press('ArrowUp');
          await box.press('Enter');
          assert.equal(await box.inputValue(), 'Colorado');
          assert.equal(await page.isVisible('#rep-state-list'), false);
          assert.equal(await page.inputValue('#rep-form select[name=practiceState]'), 'CO');
          assert.equal(count('submit'), 0, 'Enter on a suggestion picks it and sends nothing');
        } else {
          await page.selectOption('[name=practiceState]', 'CO');
          await page.check('[name=permission]');
        }
        if (js) assert.equal((await page.textContent('#rep-send-button')).trim(), 'Send to HealthFirst');
        await submit();
        await page.waitForSelector('#rep-receipt:not([hidden])', { timeout: 10000 });
        const sent = bodies.filter((b) => b.action === 'submit');
        assert.equal(sent.length, 1);
        assert.equal(sent[0].practiceState, 'CO');
      });
    } finally {
      await ctx.close();
    }
  }
  // Codex P1 on #7: a retry after a timeout puts the first post back, so the State box
  // must show the state that retry sends, not one picked since.
  await check('REP_ASK_STATE JS on: a retry after a timeout puts the State box back to the state it sends', async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    try {
      const page = await ctx.newPage();
      const posted = [];
      await page.route('**/api/referral', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        posted.push(body);
        if (posted.length === 1) {
          return route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ timeout: true, error: 'Timed out.' }) });
        }
        return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'This referral did not send.' }) });
      });
      await page.goto(`${BASE}/refer/${REP_KEY}`);
      await page.fill('[name=contactName]', 'TEST Office Manager');
      await page.fill('[name=practiceName]', 'TEST North Side Dental');
      await page.fill('[name=jde]', '001234');
      await page.fill('[name=officePhone]', '303-555-0100');
      await page.check('[name=preferredContact][value=Text]');
      await page.check('[name=permission]');
      const box = page.locator('#rep-form [data-state-input]');
      await box.fill('Colorado');
      await page.click('#rep-send-button');
      await page.waitForFunction(() => !document.getElementById('rep-alert').hidden);
      await box.fill('California');
      await page.click('[name=jde]');
      assert.equal(await page.inputValue('#rep-form select[name=practiceState]'), 'CA');
      await page.click('#rep-send-button');
      await page.waitForFunction(() => document.getElementById('rep-alert').textContent === 'This referral did not send.');
      assert.equal(posted.length, 2);
      assert.equal(posted[1].practiceState, 'CO');
      assert.equal(await box.inputValue(), 'Colorado', 'the box shows the state that was sent');
      assert.equal(await page.inputValue('#rep-form select[name=practiceState]'), 'CO');
    } finally {
      await ctx.close();
    }
  });
  // G2 drift audit: a 5xx with no body or a dropped connection may have saved the row,
  // so the page never says "did not send" for it.
  await check('a 502 with no body or a dropped connection says it may already have gone through', async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    try {
      const page = await ctx.newPage();
      let n = 0;
      await page.route('**/api/referral', async (route) => {
        n += 1;
        if (n === 1) return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' });
        return route.abort('connectionreset');
      });
      await page.goto(`${BASE}/refer/${REP_KEY}`);
      await page.fill('[name=contactName]', 'TEST Office Manager');
      await page.fill('[name=practiceName]', 'TEST North Side Dental');
      await page.fill('[name=jde]', '001234');
      await page.fill('[name=officePhone]', '303-555-0100');
      await page.check('[name=preferredContact][value=Text]');
      await page.check('[name=permission]');
      const box = page.locator('#rep-form [data-state-input]');
      if (await box.count()) await box.fill('Colorado');
      await page.click('#rep-send-button');
      await page.waitForFunction((words) => document.getElementById('rep-alert').textContent === words, UNCLEAR_MESSAGE);
      await page.click('#rep-send-button');
      await page.waitForFunction(() => !document.getElementById('rep-send-button').disabled);
      assert.equal(n, 2);
      assert.equal((await page.textContent('#rep-alert')).trim(), UNCLEAR_MESSAGE);
    } finally {
      await ctx.close();
    }
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
