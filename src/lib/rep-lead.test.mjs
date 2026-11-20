// Track's compact rows and the lead screen (Brian, 11/9; spec v3 section 2, tests 17
// and 18). Every word comes from what the 1F list already sends.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SIGNED_WORDS, historySteps, historyWords, leadViews, stepWords } from './rep-lead.mjs';
import { historyKinds, repFeed } from './rep-track.mjs';

const TODAY = '2026-11-20';
const row = (o = {}) => ({
  id: 'R1',
  doctorName: 'TEST Office Manager',
  practiceName: 'TEST North Side Dental',
  sentOn: '2026-11-03',
  lines: [{ company: 'HealthFirst', status: 'Sent', detail: '', updatedOn: '2026-11-03' }],
  history: [{ on: '2026-11-03', text: 'Sent to HealthFirst' }],
  ...o,
});
const withStatus = (status, o = {}) => row({ lines: [{ company: 'HealthFirst', status, detail: '', updatedOn: '2026-11-18' }], ...o });
const chipOf = (r) => leadViews([r], TODAY)[0].chip;

describe('status words (the spec table)', () => {
  test('each value the list sends reads in plain words', () => {
    const cases = [
      ['Sent', 'Sent to HealthFirst'],
      ['Not yet, still trying', 'HealthFirst is reaching out'],
      // No try yet: it never says HealthFirst is reaching out (review, 11/9; Brian to confirm).
      ["Not yet, haven't tried", 'Sent to HealthFirst'],
      ['Not yet, haven’t tried', 'Sent to HealthFirst'],
      // The label the partner page writes for that answer since 11/13.
      ['Not called yet', 'Sent to HealthFirst'],
      ['Trying to reach', 'HealthFirst is reaching out'],
      ['Yes', 'HealthFirst talked with the doctor'],
      ['Talked with the doctor', 'HealthFirst talked with the doctor'],
      ['Reached', 'HealthFirst talked with the doctor'],
      ['Reached the doctor', 'HealthFirst talked with the doctor'],
      ['Meeting held', 'HealthFirst talked with the doctor'],
      ['Complete', 'HealthFirst talked with the doctor'],
      ['Meeting set', 'Meeting set'],
      ['Scheduled', 'Meeting set'],
      ['Proposal or agreement sent', 'HealthFirst sent a proposal'],
      ['No change this week', 'HealthFirst is working on it'],
      ['Signed', SIGNED_WORDS],
      ['Won', SIGNED_WORDS],
      ['Closed - Won', SIGNED_WORDS],
      ['Not moving forward', 'Closed: not moving forward'],
      ['Closed - Lost', 'Closed: not moving forward'],
      ['Already a customer', 'Closed: already a customer'],
      ['Hand back to HSBS', 'Closed: handed back to HSBS'],
      ['Returned to HSBS', 'Closed: handed back to HSBS'],
      ['Held', 'Closed: handed back to HSBS'],
      ['Not a Fit', 'Closed: not a fit'],
      ['Closed', 'Closed'],
    ];
    for (const [status, words] of cases) assert.equal(chipOf(withStatus(status)), words, status);
    assert.equal(SIGNED_WORDS, 'Signed and billed');
  });

  test('no partner save yet reads "Sent to HealthFirst"', () => {
    assert.equal(chipOf(row({ lines: [] })), 'Sent to HealthFirst');
  });

  test('the signed and closed flags win over the line status', () => {
    assert.equal(chipOf(withStatus('Meeting set', { signed: true })), 'Signed and billed');
    assert.equal(chipOf(withStatus('Meeting set', { closed: true })), 'Closed');
    assert.equal(chipOf(withStatus('Already a customer', { closed: true })), 'Closed: already a customer');
  });

  test('a value outside the map shows its existing display words, never a blank', () => {
    assert.equal(chipOf(withStatus('Something new')), 'Something new');
    for (const status of ['Something new', 'Meeting set', 'Sent', 'x']) assert.ok(chipOf(withStatus(status)).length > 0, status);
  });

  test('the chip tone says open, signed or closed', () => {
    assert.deepEqual(
      ['Meeting set', 'Signed', 'Not moving forward', 'Already a customer'].map((s) => leadViews([withStatus(s)], TODAY)[0].tone),
      ['open', 'signed', 'closed', 'closed'],
    );
  });

  test('step words read a Status Log sentence with or without the partner name', () => {
    assert.equal(stepWords('HealthFirst: Signed'), SIGNED_WORDS);
    assert.equal(stepWords('Signed on Nov 14, 2026: kit plan'), SIGNED_WORDS);
    assert.equal(stepWords('Unitas: Talked with the doctor', 'Unitas'), 'Unitas talked with the doctor');
    assert.equal(stepWords('Last touch Nov 9, 2026'), '');
    assert.equal(historyWords('HealthFirst: Talked with the doctor on Nov 14, 2026. Signed on Nov 14, 2026: kit plan.'), 'HealthFirst talked with the doctor. Signed and billed');
    // The map knows none of it: the existing display words.
    assert.equal(historyWords('Handed back to HSBS by Brian'), 'Hand back to HSBS by Brian');
  });
});

describe('Track rows (test 17)', () => {
  test('one row per referral, newest sent first, with office, "Sent [date]" and the chip', () => {
    const leads = leadViews(
      [
        row({ id: 'A', practiceName: 'TEST Old Dental', sentOn: '2026-11-01' }),
        withStatus('Signed', { id: 'B', practiceName: 'TEST New Dental', sentOn: '2026-11-15' }),
        row({ id: 'C', practiceName: 'TEST Mid Dental', sentOn: '2026-11-10' }),
      ],
      TODAY,
    );
    assert.deepEqual(leads.map((l) => [l.office, l.sentLabel, l.chip]), [
      ['TEST New Dental', 'Sent Nov 15', 'Signed and billed'],
      ['TEST Mid Dental', 'Sent Nov 10', 'Sent to HealthFirst'],
      ['TEST Old Dental', 'Sent Nov 1', 'Sent to HealthFirst'],
    ]);
  });

  test('an open office with no update in 9 days shows "No update in 9 days."; a signed or closed one never does', () => {
    const open = row({ sentOn: '2026-11-11', lines: [{ company: 'HealthFirst', status: 'Meeting set', updatedOn: '2026-11-11' }], history: [] });
    assert.equal(leadViews([open], TODAY)[0].stale, 'No update in 9 days.');
    for (const status of ['Signed', 'Not moving forward', 'Already a customer']) {
      const r = row({ sentOn: '2026-11-01', lines: [{ company: 'HealthFirst', status, updatedOn: '2026-11-01' }], history: [] });
      assert.equal(leadViews([r], TODAY)[0].stale, '', status);
    }
  });

  test('the test 17 steps all show', () => {
    const words = ['Sent', 'Not yet, still trying', 'Yes', 'Signed', 'Already a customer'].map((s) => chipOf(withStatus(s)));
    assert.deepEqual(words, ['Sent to HealthFirst', 'HealthFirst is reaching out', 'HealthFirst talked with the doctor', 'Signed and billed', 'Closed: already a customer']);
  });
});

describe('the lead screen (test 18)', () => {
  const full = row({
    lines: [{ company: 'HealthFirst', status: 'Signed', detail: 'Talked with the doctor on Nov 10, 2026. Signed on Nov 14, 2026: kit plan.', updatedOn: '2026-11-14' }],
    history: [
      { on: '2026-11-14', text: 'HealthFirst: Signed on Nov 14, 2026: kit plan.' },
      { on: '2026-11-03', text: 'Sent to HealthFirst' },
      { on: '2026-11-06', text: "HealthFirst: Not yet, haven't tried." },
      { on: '2026-11-07', text: 'HealthFirst: Not called yet.' },
      { on: '2026-11-08', text: 'HealthFirst: Not yet, still trying. Last try Nov 8, 2026 by call.' },
      { on: '2026-11-10', text: 'HealthFirst: Talked with the doctor on Nov 10, 2026. Meeting set for Nov 12, 2026.' },
      { on: '2026-11-11', text: 'HealthFirst: Called Dr. Secret at home' },
    ],
  });

  test('the rep sees office, sent date, company, contact, the timeline with dates, and the latest update', () => {
    const [lead] = leadViews([full], TODAY);
    assert.deepEqual(Object.keys(lead), ['id', 'office', 'sentLabel', 'company', 'chip', 'tone', 'stale', 'steps', 'contact', 'update']);
    assert.equal(lead.id, 'R1');
    assert.equal(lead.office, 'TEST North Side Dental');
    assert.equal(lead.sentLabel, 'Sent Nov 3');
    assert.equal(lead.company, 'HealthFirst');
    assert.equal(lead.contact, 'TEST Office Manager');
    assert.deepEqual(lead.steps, [
      { on: 'Nov 3', label: 'Sent to HealthFirst' },
      // "Not yet, haven't tried" (Nov 6) and "Not called yet" (Nov 7) are still "Sent to
      // HealthFirst": one line, the first date.
      { on: 'Nov 8', label: 'HealthFirst is reaching out' },
      { on: 'Nov 10', label: 'HealthFirst talked with the doctor' },
      // The meeting date the Status Log carries stays on the step.
      { on: 'Nov 10', label: 'Meeting set for Nov 12' },
      // The rep's own screen keeps a line the map doesn't know, in its display words.
      { on: 'Nov 11', label: 'HealthFirst: Called Dr. Secret at home' },
      { on: 'Nov 14', label: 'Signed and billed' },
    ]);
    assert.deepEqual(lead.update, { on: 'Nov 14', text: 'Talked with the doctor on Nov 10, 2026. Signed on Nov 14, 2026: kit plan.' });
  });

  test('a manager sees the same row and timeline words, with no contact, no update and no unknown log text', () => {
    const [rep] = leadViews([full], TODAY);
    const [mgr] = leadViews([full], TODAY, { team: true });
    assert.deepEqual(Object.keys(mgr), ['id', 'office', 'sentLabel', 'company', 'chip', 'tone', 'stale', 'steps']);
    assert.deepEqual([mgr.office, mgr.sentLabel, mgr.chip, mgr.tone], [rep.office, rep.sentLabel, rep.chip, rep.tone]);
    assert.deepEqual(mgr.steps, rep.steps.filter((s) => !s.label.includes('Secret')));
    assert.equal(/Secret|Office Manager|kit plan/.test(JSON.stringify(mgr)), false);
    // An office with no practice name is "Office" for a manager, never the contact.
    assert.equal(leadViews([row({ practiceName: '' })], TODAY, { team: true })[0].office, 'Office');
    assert.equal(leadViews([row({ practiceName: '' })], TODAY)[0].office, 'TEST Office Manager');
  });

  test('the timeline always ends where the chip says the office stands', () => {
    const [lead] = leadViews([withStatus('Proposal or agreement sent', { history: [] })], TODAY);
    assert.deepEqual(lead.steps, [
      { on: 'Nov 3', label: 'Sent to HealthFirst' },
      { on: 'Nov 18', label: 'HealthFirst sent a proposal' },
    ]);
    const [flagged] = leadViews([withStatus('Meeting set', { signed: true, history: [] })], TODAY);
    assert.equal(flagged.steps.at(-1).label, 'Signed and billed');
  });

  test('no update text means no update block; a row without an id or contact is dropped', () => {
    assert.equal('update' in leadViews([row({})], TODAY)[0], false);
    assert.deepEqual(leadViews([{ practiceName: 'x' }, null, 'x'], TODAY), []);
  });
});

describe('Latest updates speak the same plain words', () => {
  test('a signed line reads "Signed and billed", a talked line "HealthFirst talked with the doctor"', () => {
    const feed = repFeed(
      [
        row({
          lines: [{ company: 'HealthFirst', status: 'Signed', updatedOn: '2026-11-14' }],
          history: [
            { on: '2026-11-10', text: 'HealthFirst: Talked with the doctor' },
            { on: '2026-11-14', text: 'HealthFirst: Signed. Two-year kit plan.' },
          ],
        }),
      ],
      TODAY,
    );
    assert.deepEqual(feed.map((f) => f.label), ['Nov 14. TEST North Side Dental: Signed and billed.', 'Nov 10. TEST North Side Dental: HealthFirst talked with the doctor.']);
  });

  test('with pay off, every status line ends with a period, like the stale lines', () => {
    const feed = repFeed([row({ history: [{ on: '2026-11-03', text: 'Sent to HealthFirst' }, { on: '2026-11-05', text: 'HealthFirst: Meeting set for Nov 12, 2026.' }] })], TODAY);
    assert.deepEqual(feed.map((f) => f.label), [
      'Nov 20. No update in 17 days on TEST North Side Dental.',
      'Nov 5. TEST North Side Dental: Meeting set for Nov 12.',
      'Nov 3. TEST North Side Dental: Sent to HealthFirst.',
    ]);
    for (const f of feed) assert.match(f.label, /[.!?]$/);
  });
});

describe("the partner's note is never read as a status", () => {
  // 7B writes "<partner>: <label>. <note>" (docs/field-flow-contract.md). Notes that start
  // with a status word must not add a step, a chip, a feed status or a money kind.
  const notes = [
    'Signed up for a kit demo next week',
    'Sent a voicemail',
    'Received their list',
    'Yes',
    'Yes, they want a call back',
    'Closed',
    'Closed the loop with the office manager',
    'Won them over on price',
    'Talked with the doctor briefly',
    'Meeting set up for later',
  ];
  for (const note of notes) {
    test(`"HealthFirst: Meeting set. ${note}" reads only "Meeting set"`, () => {
      const r = withStatus('Meeting set', { history: [{ on: '2026-11-03', text: 'Sent to HealthFirst' }, { on: '2026-11-05', text: `HealthFirst: Meeting set. ${note}.` }] });
      const [lead] = leadViews([r], TODAY);
      assert.equal(lead.chip, 'Meeting set');
      assert.deepEqual(lead.steps.map((s) => s.label), ['Sent to HealthFirst', 'Meeting set']);
      const [mgr] = leadViews([r], TODAY, { team: true });
      assert.deepEqual(mgr.steps.map((s) => s.label), ['Sent to HealthFirst', 'Meeting set']);
      assert.equal(historyWords(`HealthFirst: Meeting set. ${note}.`), 'Meeting set');
      const line = repFeed([r], TODAY).find((f) => f.on === '2026-11-05');
      assert.equal(line.label, 'Nov 5. TEST North Side Dental: Meeting set.');
      assert.deepEqual(line.kinds, ['status']);
    });
  }

  test('a later sentence counts only when it is a whole label the partner page writes', () => {
    assert.deepEqual(historySteps('HealthFirst: Not yet, still trying. Last try Nov 8, 2026 by call. Signed on Nov 14, 2026: kit plan.'), ['HealthFirst is reaching out', SIGNED_WORDS]);
    assert.deepEqual(historySteps('HealthFirst: Talked with the doctor on Nov 10, 2026. Meeting set for Nov 12, 2026.'), ['HealthFirst talked with the doctor', 'Meeting set for Nov 12']);
    // A reason after "Not moving forward" is the partner's own words.
    assert.deepEqual(historySteps('HealthFirst: Not yet, haven\'t tried. Not moving forward. Signed with another vendor.'), ['Sent to HealthFirst', 'Closed: not moving forward']);
    assert.deepEqual(historyKinds('HealthFirst: Meeting set. Signed up for a demo.'), ['status']);
    assert.deepEqual(historyKinds('HealthFirst: Not yet, still trying. Talked with the doctor briefly.'), ['status']);
    assert.deepEqual(historyKinds('HealthFirst: Not yet, still trying. Talked with the doctor on Nov 10, 2026.'), ['reached']);
  });

  test('reading stops after the second answer: a reason shaped like a label is not a status', () => {
    // Codex P1 on #58 (f95e244): this used to add "Signed and billed" and kind signed.
    const line = 'HealthFirst: Talked with the doctor on Nov 14, 2026. Not moving forward. Signed on Nov 14, 2026: another vendor.';
    assert.deepEqual(historySteps(line), ['HealthFirst talked with the doctor', 'Closed: not moving forward']);
    assert.deepEqual(historyKinds(line), ['reached']);
    const tried = 'HealthFirst: Not yet, still trying. Last try Nov 8, 2026 by call. Not moving forward. Meeting set for Nov 20, 2026.';
    assert.deepEqual(historySteps(tried), ['HealthFirst is reaching out', 'Closed: not moving forward']);
    assert.deepEqual(historySteps('HealthFirst: Not yet, haven\'t tried. Not moving forward. Talked with the doctor on Nov 2, 2026.'), ['Sent to HealthFirst', 'Closed: not moving forward']);
    const r = withStatus('Not moving forward', { history: [{ on: '2026-11-03', text: 'Sent to HealthFirst' }, { on: '2026-11-14', text: line }] });
    const [lead] = leadViews([r], TODAY);
    assert.ok(!lead.steps.some((s) => s.label === SIGNED_WORDS));
    const [mgr] = leadViews([r], TODAY, { team: true });
    assert.ok(!mgr.steps.some((s) => s.label === SIGNED_WORDS));
    assert.ok(!repFeed([r], TODAY).some((f) => f.kinds.includes('signed')));
  });
});

describe('/api/referral-list: the Rep app gets its rows and lead screens from the same list', { concurrency: false }, () => {
  const KEY = `RepLead_${'l'.repeat(24)}`;
  test('feed: true adds leads; every other caller gets the same shape as before', async () => {
    const { createServer } = await import('node:http');
    const { POST } = await import('../pages/api/referral-list.ts');
    const posts = [];
    const server = createServer(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      posts.push(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      if (body.action === 'lookup') {
        res.end(JSON.stringify({ role: 'Rep', repName: 'TEST Rep', repEmail: 'test.rep@example.com', services: ['HealthFirst'], isManager: false }));
        return;
      }
      res.end(JSON.stringify({ referrals: [withStatus('Meeting set')] }));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const prior = { url: process.env.FIELD_FLOW_URL, app: process.env.REP_APP_ENABLED, cache: process.env.FLOW_CACHE_SECONDS };
    process.env.FIELD_FLOW_URL = `http://127.0.0.1:${server.address().port}/flow`;
    process.env.REP_APP_ENABLED = 'true';
    // This test counts flow posts per call, so the short read cache (flow-cache.mjs; counted
    // in track-load.test.mjs) is off here.
    process.env.FLOW_CACHE_SECONDS = '0';
    let ip = 0;
    const call = async (body) => {
      const res = await POST(/** @type {any} */ ({
        request: new Request('http://localhost/api/referral-list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
        clientAddress: `10.2.0.${++ip}`,
      }));
      return res.json();
    };
    try {
      const plain = await call({ referralKey: KEY });
      assert.deepEqual(Object.keys(plain), ['counts', 'referrals']);
      const rep = await call({ referralKey: KEY, feed: true });
      assert.deepEqual(Object.keys(rep), ['counts', 'referrals', 'feed', 'leads']);
      assert.deepEqual(rep.leads.map((l) => [l.office, l.chip]), [['TEST North Side Dental', 'Meeting set']]);
      // One list call each: no new action, no new field asked of the flow.
      // (With the cache off the route asks the lookup once per read to confirm the key; that
      // is not a new field asked of the list.)
      assert.deepEqual(posts.filter((p) => p.action === 'list'), [{ action: 'list', referralKey: KEY }, { action: 'list', referralKey: KEY }]);
    } finally {
      for (const [k, v] of [['FIELD_FLOW_URL', prior.url], ['REP_APP_ENABLED', prior.app], ['FLOW_CACHE_SECONDS', prior.cache]]) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      server.closeAllConnections?.();
      await new Promise((r) => server.close(r));
    }
  });
});

// Morgan, 11/18: a Direct Dental send read "Sent to HealthFirst" on Track. The 3F flows
// make the Service Case with Status set and Partner Status blank, so the 1F list line
// carries the company and no status until the partner's first update. The line still
// names the company, so Track must speak for it.
describe('a new case with no partner status yet', () => {
  const STAFFING = 'HS Staffing / Recruiting Services (including GoTu)';
  const fresh = (company) => ({
    id: 'R9',
    doctor: 'TEST Office Manager',
    practice: 'TEST South Side Dental',
    created: '2026-11-18T15:00:00Z',
    cases: [{ company, partnerStatus: null, lastTouch: null, updated: '2026-11-18T15:05:00Z', qualified: '', notQualifiedReason: '', closedReason: '', practiceType: '' }],
  });

  test('a Direct Dental case reads "Sent to Direct Dental", never HealthFirst', () => {
    const [lead] = leadViews([fresh(STAFFING)], TODAY);
    assert.equal(lead.chip, 'Sent to Direct Dental');
    assert.equal(lead.company, 'Direct Dental');
    assert.equal(lead.tone, 'open');
    assert.deepEqual(lead.steps.map((s) => s.label), ['Sent to Direct Dental']);
    assert.ok(!JSON.stringify(lead).includes('HealthFirst'));
  });

  test('a HealthFirst case reads "Sent to HealthFirst", as before', () => {
    const [lead] = leadViews([fresh('HealthFirst')], TODAY);
    assert.equal(lead.chip, 'Sent to HealthFirst');
    assert.deepEqual(lead.steps.map((s) => s.label), ['Sent to HealthFirst']);
  });

  test('the manager view says the same', () => {
    const [lead] = leadViews([fresh(STAFFING)], TODAY, { team: true });
    assert.equal(lead.chip, 'Sent to Direct Dental');
  });

  test('a line with no company is still dropped', () => {
    const r = fresh(STAFFING);
    r.cases[0].company = null;
    assert.equal(leadViews([r], TODAY)[0].chip, 'Sent to HealthFirst');
  });
});
