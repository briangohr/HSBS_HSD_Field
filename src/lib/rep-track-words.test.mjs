// Field two-track slice S4: Track and lead screen words per company, and the not
// qualified close read from stored values (spec section 5, sheet F6).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { leadViews, stepWords } from './rep-lead.mjs';
import { repFeed } from './rep-track.mjs';
import { decorateReferrals, sanitizeReferral } from './track.mjs';
import { moneyForReferrals } from './rep-earnings.mjs';
import { parsePayPlan } from './rep-pay-plan.mjs';
import { shapeTeam } from './rep-team.mjs';
import { REP_COMPANIES } from './rep-companies.mjs';

const TODAY = '2026-11-20';
const STAFF = REP_COMPANIES.find((c) => c.key === 'Staffing').solutions;
const NOTE = 'TYPED-NOTE-DO-NOT-SHOW the owner said call me never';

const hf = (status, o = {}, line = {}) => ({
  id: 'H1', doctorName: 'TEST Doc', practiceName: 'TEST Dental One', sentOn: '2026-11-03',
  lines: [{ company: 'HealthFirst', status, detail: '', updatedOn: '2026-11-18', ...line }],
  history: [{ on: '2026-11-03', text: 'Sent to HealthFirst' }], ...o,
});
const st = (status, o = {}, line = {}) => ({
  id: 'S1', doctorName: 'TEST Doc', practiceName: 'TEST Practice Six', sentOn: '2026-11-04',
  lines: [{ company: STAFF, status, detail: '', updatedOn: '2026-11-18', ...line }],
  history: [{ on: '2026-11-04', text: 'Sent to Direct Dental' }], ...o,
});
const chip = (r, opts) => leadViews([r], TODAY, opts)[0].chip;

describe('S4: words per company', () => {
  test('a staffing row never says HealthFirst, on any status, step, feed line or screen', () => {
    for (const status of ['Sent', "Not yet, haven't tried", 'Not yet, still trying', 'Yes', 'Meeting set', 'Proposal or agreement sent', 'No change this week', 'Signed', 'Not moving forward', 'Already a customer']) {
      const row = st(status, { signed: status === 'Signed', closed: /Not moving|customer/.test(status), history: [{ on: '2026-11-18', text: `Direct Dental: ${status}` }] });
      for (const team of [false, true]) {
        const [lead] = leadViews([row], TODAY, { team });
        assert.equal(/HealthFirst/.test(JSON.stringify(lead)), false, `${status} team=${team}`);
        assert.equal(lead.company, 'Direct Dental');
      }
      assert.equal(/HealthFirst/.test(JSON.stringify(repFeed([row], TODAY))), false, status);
    }
  });

  test('the staffing words are the spec table', () => {
    assert.equal(chip(st('Sent')), 'Sent to Direct Dental');
    assert.equal(chip(st('Not yet, still trying')), 'Direct Dental is reaching out');
    assert.equal(chip(st('Yes')), 'Direct Dental talked with the customer');
    assert.equal(chip(st('Meeting set')), 'Meeting set');
    assert.equal(chip(st('Proposal or agreement sent')), 'Direct Dental sent a proposal');
    assert.equal(chip(st('No change this week')), 'Direct Dental is working on it');
    assert.equal(chip(st('Signed', { signed: true })), 'Signed');
    assert.equal(chip(st('Already a customer', { closed: true })), 'Closed: already a customer');
    assert.equal(leadViews([st('Signed', { signed: true })], TODAY)[0].tone, 'signed');
  });

  test('a HealthFirst row reads word for word as on main, with or without staffing in the list', () => {
    const mixed = leadViews([hf('Yes', { id: 'H1' }), st('Yes'), hf('Signed', { id: 'H2', signed: true })], TODAY);
    const byId = Object.fromEntries(mixed.map((l) => [l.id, l.chip]));
    assert.equal(byId.H1, 'HealthFirst talked with the doctor');
    assert.equal(byId.H2, 'Signed and billed');
    assert.equal(byId.S1, 'Direct Dental talked with the customer');
    assert.deepEqual(leadViews([hf('Yes')], TODAY), leadViews([hf('Yes'), st('Yes')], TODAY).filter((l) => l.id === 'H1'));
    // The same HealthFirst row sent with the new values keeps its words.
    assert.equal(chip(hf('Yes', {}, { qualified: '', notQualifiedReason: '', closedReason: '' })), 'HealthFirst talked with the doctor');
    assert.equal(chip(hf('Signed', { signed: true }, { qualified: 'Yes' })), 'Signed and billed');
  });

  test('a row with none of the new values has no company line and the same keys as on main', () => {
    const [lead] = leadViews([hf('Yes')], TODAY);
    assert.equal('companyLine' in lead, false);
    assert.deepEqual(Object.keys(lead), ['id', 'office', 'sentLabel', 'company', 'chip', 'tone', 'stale', 'steps', 'contact']);
  });

  test('the company line: the company, and the practice type for staffing', () => {
    assert.equal(leadViews([hf('Yes', {}, { qualified: '' })], TODAY)[0].companyLine, 'HealthFirst');
    assert.equal(leadViews([st('Yes', {}, { practiceType: 'Private practice' })], TODAY)[0].companyLine, 'Direct Dental, Private practice');
    assert.equal(leadViews([st('Yes', {}, { practiceType: 'Group' })], TODAY)[0].companyLine, 'Direct Dental, Group');
    assert.equal(leadViews([st('Yes')], TODAY)[0].companyLine, 'Direct Dental');
    assert.equal(leadViews([st('Yes', {}, { practiceType: 'Nonsense' })], TODAY)[0].companyLine, 'Direct Dental');
  });

  test('a line that names staffing through `solutions` is staffing too', () => {
    const row = hf('Yes', {}, { company: 'Direct Dental line', solutions: STAFF });
    assert.equal(chip(row), 'Direct Dental talked with the customer');
  });
});

describe('S4: not qualified, read from the stored values', () => {
  for (const [name, make] of [['HealthFirst', hf], ['staffing', st]]) {
    test(`${name}: no permission to contact reads the spec words on the rep and manager views`, () => {
      const row = make('Not moving forward', { closed: true }, { qualified: 'No', notQualifiedReason: 'No permission to contact', closedReason: 'Not qualified' });
      for (const team of [false, true]) {
        const [lead] = leadViews([row], TODAY, { team });
        assert.equal(lead.chip, 'Closed: did not qualify (no permission to contact)');
        assert.equal(lead.tone, 'closed');
        assert.equal(lead.steps.at(-1).label, 'Closed: did not qualify (no permission to contact)');
      }
      assert.equal(decorateReferrals([row], TODAY).counts.closed, 1);
    });
    test(`${name}: it reads from the values even when the status text says something else`, () => {
      const row = make('Meeting set', {}, { qualified: 'No', notQualifiedReason: 'No permission to contact', closedReason: 'Not qualified' });
      assert.equal(chip(row), 'Closed: did not qualify (no permission to contact)');
    });
    test(`${name}: Qualified No alone, or with another stored close reason, never reads as not qualified`, () => {
      assert.equal(chip(make('Meeting set', {}, { qualified: 'No', notQualifiedReason: 'No permission to contact' })).includes('did not qualify'), false);
      const priced = make('Not moving forward', { closed: true }, { qualified: 'No', notQualifiedReason: 'No permission to contact', closedReason: 'Price' });
      assert.equal(chip(priced), 'Closed: price');
      assert.equal(decorateReferrals([make('Meeting set', {}, { qualified: 'No' })], TODAY).counts.closed, 0);
    });
  }

  test('only the known Other reads "did not qualify" with nothing in brackets; a blank or unknown reason reads plain Closed', () => {
    assert.equal(chip(hf('Not moving forward', { closed: true }, { qualified: 'No', notQualifiedReason: 'Other', closedReason: 'Not qualified' })), 'Closed: did not qualify');
    for (const reason of ['', 'Some new choice', 'no permission to contact', 42]) {
      const lead = leadViews([hf('Not moving forward', { closed: true }, { qualified: 'No', notQualifiedReason: reason, closedReason: 'Not qualified' })], TODAY)[0];
      assert.equal(lead.chip, 'Closed', String(reason));
      assert.equal(JSON.stringify(lead).includes('Some new choice'), false);
    }
  });

  test('the saved close event reads the not-qualified words once on the timeline, the chip and Latest updates', () => {
    const close = [{ on: '2026-11-03', text: 'Sent to HealthFirst' }, { on: '2026-11-18', text: 'HealthFirst: Not moving forward. Qualified No.' }];
    for (const [make, who] of [[hf, 'HealthFirst'], [st, 'Direct Dental']]) {
      const row = make('Not moving forward', { closed: true, history: close.map((h, i) => (i ? { ...h, text: `${who}: Not moving forward. Qualified No.` } : h)) }, { qualified: 'No', notQualifiedReason: 'No permission to contact', closedReason: 'Not qualified' });
      const words = 'Closed: did not qualify (no permission to contact)';
      for (const team of [false, true]) {
        const [lead] = leadViews([row], TODAY, { team });
        assert.equal(lead.steps.filter((s) => /^Closed/.test(s.label)).length, 1, `${who} team=${team}`);
        assert.equal(lead.steps.at(-1).label, words);
        assert.equal(JSON.stringify(lead).includes('not moving forward'), false);
      }
      const feed = repFeed([row], TODAY).map((f) => f.label);
      assert.ok(feed.some((l) => l.includes(words)), who);
      assert.equal(feed.some((l) => /not moving forward/i.test(l)), false, who);
    }
  });

  test('the saved close event takes the stored Closed Reason words too, once, on every surface', () => {
    const hist = [{ on: '2026-11-03', text: 'Sent to HealthFirst' }, { on: '2026-11-18', text: 'HealthFirst: Not moving forward. Price.' }];
    const row = hf('Not moving forward', { closed: true, history: hist }, { closedReason: 'Price' });
    for (const team of [false, true]) {
      const [lead] = leadViews([row], TODAY, { team });
      assert.deepEqual(lead.steps.filter((s) => /^Closed/.test(s.label)).map((s) => s.label), ['Closed: price']);
      assert.equal(lead.chip, 'Closed: price');
    }
    const feed = repFeed([row], TODAY).map((f) => f.label);
    assert.ok(feed.some((l) => l.includes('Closed: price')));
    assert.equal(feed.some((l) => /not moving forward/i.test(l)), false);
  });

  test('a multi-case referral stays open while another case is active; every case closed still closes it', () => {
    const multi = (second) => ({
      id: 'M1', doctorName: 'TEST Doc', practiceName: 'TEST Multi', sentOn: '2026-11-03',
      lines: [
        { company: 'HealthFirst', status: 'Not moving forward', updatedOn: '2026-11-18', qualified: 'No', notQualifiedReason: 'Other', closedReason: 'Not qualified' },
        { company: 'Unitas', status: second, updatedOn: '2026-11-18' },
      ],
      history: [],
    });
    assert.equal(decorateReferrals([multi('Meeting set')], TODAY).referrals[0].bucket, 'inProgress');
    assert.equal(decorateReferrals([multi('Not moving forward')], TODAY).referrals[0].bucket, 'closed');
    const old = multi('Meeting set');
    delete old.lines[0].qualified;
    assert.equal(decorateReferrals([old], TODAY).referrals[0].bucket, 'inProgress');
  });

  test('"Talked with the customer" is read only on a staffing row; a HealthFirst row parses as on main', () => {
    const log = (who) => [{ on: '2026-11-03', text: 'Sent' }, { on: '2026-11-10', text: `${who}: Talked with the customer on Nov 10, 2026. Meeting set for Nov 12, 2026.` }];
    const hfRow = leadViews([hf('Meeting set', { history: log('HealthFirst') })], TODAY)[0];
    const stRow = leadViews([st('Meeting set', { history: log('Direct Dental') })], TODAY)[0];
    assert.equal(hfRow.steps.some((s) => /talked with the customer/i.test(s.label)), false);
    assert.equal(stRow.steps.some((s) => s.label === 'Direct Dental talked with the customer'), true);
    assert.equal(stepWords('Talked with the customer', 'HealthFirst'), '');
  });

  test('a signed case keeps its signed words in the timeline even with Qualified No', () => {
    const row = hf('Signed', { signed: true, history: [{ on: '2026-11-18', text: 'HealthFirst: Signed on Nov 18, 2026: kit plan.' }] }, { qualified: 'No', notQualifiedReason: 'Other' });
    assert.equal(leadViews([row], TODAY)[0].steps.at(-1).label, 'Signed and billed');
  });

  test('a signed case stays signed even if Qualified is later changed to No', () => {
    assert.equal(chip(hf('Signed', { signed: true }, { qualified: 'No', notQualifiedReason: 'No permission to contact' })), 'Signed and billed');
  });

  test('the partner\'s typed note is ignored: it is on no row, screen, feed line or team card', () => {
    const rows = [
      hf('Not moving forward', { closed: true, notQualifiedNote: NOTE }, { qualified: 'No', notQualifiedReason: 'Other', notQualifiedNote: NOTE }),
      st('Not moving forward', { closed: true }, { qualified: 'No', notQualifiedReason: 'Other', notQualifiedNote: NOTE }),
    ];
    const team = shapeTeam(
      { team: [{ signedUp: true, name: 'T Rep', email: 't@x.com', role: 'AE', registeredOn: '2026-11-02', referrals: rows, rows: [] }], managerRows: [] },
      parsePayPlan('reached:100,manager:50'),
      TODAY,
    );
    const everything = JSON.stringify([
      decorateReferrals(rows, TODAY), leadViews(rows, TODAY), leadViews(rows, TODAY, { team: true }), repFeed(rows, TODAY),
      moneyForReferrals(rows, [], TODAY), team,
    ]);
    // The sanitizer drops it at the door, so no later screen can pick it up.
    for (const r of rows) assert.equal(JSON.stringify(sanitizeReferral(r)).includes('TYPED-NOTE'), false);
    assert.equal(everything.includes('TYPED-NOTE'), false);
    assert.equal(/owner said/.test(everything), false);
  });

  test('Closed Reason: a known one is words, an unknown one is plain Closed, never the raw text', () => {
    assert.equal(chip(hf('Closed', { closed: true }, { closedReason: 'Already a customer' })), 'Closed: already a customer');
    // Every Closed Reason 7B stores reads as "Closed: [reason]", on both companies.
    for (const [reason, words] of [['No response', 'Closed: no response'], ['Chose another provider', 'Closed: chose another provider'], ['Price', 'Closed: price'], ['Timing', 'Closed: timing'], ['Not a fit', 'Closed: not a fit'], ['Other', 'Closed: other']]) {
      assert.equal(chip(hf('Not moving forward', { closed: true }, { closedReason: reason })), words, reason);
      assert.equal(chip(st('Not moving forward', { closed: true }, { closedReason: reason }), { team: true }), words, reason);
    }
    // Not qualified without Qualified No is not a known close: plain Closed.
    assert.equal(chip(hf('Not moving forward', { closed: true }, { closedReason: 'Not qualified' })), 'Closed');
    const odd = leadViews([hf('Closed', { closed: true }, { closedReason: 'Moon phase' })], TODAY)[0];
    assert.equal(odd.chip, 'Closed');
    assert.equal(JSON.stringify(odd).includes('Moon phase'), false);
  });
});

describe('S4: no earned amount before the qualify answer', () => {
  test('a reached case with no qualify answer and no ledger row shows no earned amount, for either company', () => {
    const plan = parsePayPlan('reached:50,signed:100,manager:50');
    for (const row of [hf('Yes', {}, { qualified: '' }), st('Yes', {}, { qualified: '', practiceType: 'Group' })]) {
      const line = moneyForReferrals([row], [], TODAY, plan).lines[row.id];
      assert.equal(/earned/i.test(line), false, line);
      const [lead] = leadViews([row], TODAY);
      assert.equal(/\$\d/.test(JSON.stringify(lead)), false);
    }
  });
});
