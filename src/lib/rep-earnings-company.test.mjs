// Field two-track slice S5 (spec section 6 "Pay", section 10 row S5, decision 82): My
// Earnings and My Team with a company on every line, staffing words and amounts, and the
// three totals agreeing to the dollar. TEST rows only; nothing leaves the machine.
//
// Done-when, each a check here and in scripts/e2e/refer.e2e.mjs:
// 1. Earned, My Earnings and the ledger total agree to the dollar, per person and per team.
// 2. A TEST private practice reached and qualified shows $100.
// 3. A TEST group reached and qualified shows $200.
// 4. A reached case with no qualify answer shows no earned amount.
// 5. A TEST staffing sign shows $50 for the manager.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { moneyForReferrals, moneyLine, referralFacts, sanitizeLedger, sanitizeLedgerRow, summarizeEarnings } from './rep-earnings.mjs';
import {
  healthFirstTerms,
  parsePayPlan,
  parseStaffingPayPlan,
  payTerms,
  staffingNotYetLine,
  staffingPlanFromTerms,
} from './rep-pay-plan.mjs';
import { moneyView } from './rep-reads.mjs';
import { shapeTeam } from './rep-team.mjs';

const TODAY = '2026-11-20';
const HF = /** @type {import('./rep-pay-plan.mjs').PayPlan} */ (parsePayPlan('reached:100,manager:50'));
const ST = /** @type {import('./rep-pay-plan.mjs').StaffingPayPlan} */ (parseStaffingPayPlan('reached_private:100,reached_group:200,manager:50'));
const PLANS = { healthFirst: HF, staffing: ST };
const STAFFING_SOLUTIONS = 'HS Staffing / Recruiting Services (including GoTu)';

/** A TEST referral as 1F list sends it (sheet F6 keys on the line). */
const ref = (id, line, o = {}) => ({
  id,
  doctor: 'TEST Office Manager',
  practice: `TEST ${id}`,
  created: '2026-11-02',
  cases: [{ updated: '2026-11-05', ...line }],
  ...o,
});
const hfLine = (o = {}) => ({ company: 'HealthFirst', partnerStatus: 'Meeting set', ...o });
const stLine = (o = {}) => ({ company: STAFFING_SOLUTIONS, partnerStatus: 'Meeting set', practiceType: 'Private practice', ...o });
/** A TEST ledger row as 1F earnings sends it (sheet F6.4 adds `company`). */
const row = (referralId, o = {}) => ({
  referralId,
  practiceName: `TEST ${referralId}`,
  event: 'Reached',
  payeeRole: 'Rep',
  amount: 100,
  earnedOn: '2026-11-10',
  status: 'Waiting',
  paidOn: '',
  voidReason: '',
  disputed: false,
  ...o,
});
const sum = (list) => list.reduce((n, x) => n + x, 0);
const usdNumber = (text) => Number(String(text).replace(/[$,]/g, ''));
/** The ledger total by hand: Waiting plus Paid, never Pending review or Void (D11). */
const ledgerTotal = (rows) => sum(rows.filter((r) => r.status === 'Waiting' || r.status === 'Paid').map((r) => r.amount));

describe('S5: every ledger row names its company; a blank Company is HealthFirst', () => {
  test('the company key and, on staffing rows only, the ledger row\'s own practice type', () => {
    assert.equal(sanitizeLedgerRow(row('A'))?.company, 'HealthFirst', 'no Company key at all (today\'s rows)');
    assert.equal(sanitizeLedgerRow(row('A', { company: '' }))?.company, 'HealthFirst');
    assert.equal(sanitizeLedgerRow(row('A', { company: 'HealthFirst' }))?.company, 'HealthFirst');
    assert.equal(sanitizeLedgerRow(row('A', { company: 'Staffing' }))?.company, 'Staffing');
    assert.equal(sanitizeLedgerRow(row('A', { company: STAFFING_SOLUTIONS }))?.company, 'Staffing', 'the Solutions value reads as its key');
    assert.equal(sanitizeLedgerRow(row('A', { company: 'Staffing', practiceType: 'Group' }))?.practiceType, 'Group');
    assert.equal(sanitizeLedgerRow(row('A', { company: 'Staffing', practiceType: 'Group (3 or more locations)' }))?.practiceType, '', 'a screen label is not a stored value');
    assert.equal(sanitizeLedgerRow(row('A', { company: 'HealthFirst', practiceType: 'Group' }))?.practiceType, '', 'no type on a HealthFirst row');
  });

  test('a row with no Company reads exactly as a HealthFirst row, on every screen', () => {
    const blank = [row('A'), row('B', { status: 'Paid', paidOn: '2026-11-12', amount: 50 }), row('C', { status: 'Void', voidReason: 'this office was referred to HealthFirst in the last 12 months' })];
    const named = blank.map((r) => ({ ...r, company: 'HealthFirst' }));
    const refs = ['A', 'B', 'C', 'D'].map((id) => ref(id, hfLine()));
    assert.deepEqual(moneyView(refs, blank, HF), moneyView(refs, named, HF));
    const team = (rows) => shapeTeam({ team: [{ signedUp: true, name: 'TEST Rep', email: 'test.rep@henryschein.com', referrals: refs, rows }], managerRows: [] }, HF, TODAY, { pay: true });
    assert.deepEqual(team(blank), team(named));
  });

  test('an unknown Company still counts in every total, named by nothing (a total always equals the ledger)', () => {
    const rows = sanitizeLedger([row('A', { company: 'Unitas' }), row('B')]);
    const s = summarizeEarnings(rows, [], PLANS);
    assert.equal(s.earned, 200);
    assert.equal(s.lines.find((l) => l.referralId === 'A')?.company, '');
  });
});

describe('S5 done-when 2 and 3: a TEST staffing case reached and qualified shows $100 or $200', () => {
  // HSBS 10 writes the Reached row at reached and qualified, its amount set from Award
  // Practice Type (decision 82). The screen shows that row's amount.
  const refs = [ref('P', stLine({ partnerStatus: 'Yes', qualified: 'Yes' })), ref('G', stLine({ partnerStatus: 'Yes', qualified: 'Yes', practiceType: 'Group' }))];
  const rows = sanitizeLedger([
    row('P', { company: 'Staffing', practiceType: 'Private practice', amount: 100 }),
    row('G', { company: 'Staffing', practiceType: 'Group', amount: 200 }),
  ]);

  test('My Earnings: the line, its company and practice type, in board 5a words', () => {
    const s = summarizeEarnings(rows, refs, PLANS);
    const p = s.lines.find((l) => l.referralId === 'P');
    const g = s.lines.find((l) => l.referralId === 'G');
    assert.deepEqual(
      { office: p?.office, amount: p?.amount, company: p?.company, what: p?.what, status: p?.status },
      { office: 'TEST P', amount: '$100', company: 'Direct Dental, Private practice', what: 'Direct Dental reached the customer', status: 'Earned, awaiting payment' },
    );
    assert.deepEqual(
      { amount: g?.amount, company: g?.company, what: g?.what },
      { amount: '$200', company: 'Direct Dental, Group', what: 'Direct Dental reached the customer' },
    );
    assert.equal(s.earned, 300);
    assert.equal(s.footer, "Earnings follow Direct Dental's updates.");
    for (const l of s.lines) assert.doesNotMatch(JSON.stringify(l), /HealthFirst/, 'a staffing line never says HealthFirst');
  });

  test('the lead screen money line is the row\'s amount', () => {
    const m = moneyForReferrals(refs, rows, TODAY, PLANS);
    assert.equal(m.lines.P, '$100 earned Nov 10.');
    assert.equal(m.lines.G, '$200 earned Nov 10.');
  });

  test('decision 82: the amount is the ledger row\'s, never the rep\'s pick or the case\'s type', () => {
    // The rep picked Group; the partner confirmed private practice, so HSBS 10 wrote $100.
    const picked = [ref('X', stLine({ partnerStatus: 'Yes', qualified: 'Yes', practiceType: 'Group' }))];
    const paid = sanitizeLedger([row('X', { company: 'Staffing', practiceType: 'Private practice', amount: 100 })]);
    const s = summarizeEarnings(paid, picked, PLANS);
    assert.equal(s.earned, 100);
    assert.equal(s.lines[0].amount, '$100');
    assert.equal(s.lines[0].company, 'Direct Dental, Private practice', 'the type named is the ledger row\'s');
    assert.equal(moneyForReferrals(picked, paid, TODAY, PLANS).lines.X, '$100 earned Nov 10.');
    // A ledger row with no type names none, whatever the case says.
    const untyped = sanitizeLedger([row('X', { company: 'Staffing', amount: 100 })]);
    assert.equal(summarizeEarnings(untyped, picked, PLANS).lines[0].company, 'Direct Dental');
  });

  test('a bad or unset staffing plan never hides the award (M12): amounts still show, nothing is promised', () => {
    for (const plans of [{ healthFirst: HF, staffing: null }, HF, null]) {
      const s = summarizeEarnings(rows, refs, plans);
      assert.equal(s.earned, 300);
      assert.deepEqual(s.lines.map((l) => l.amount).sort(), ['$100', '$200']);
      assert.equal(s.upTo, 0);
    }
  });
});

describe('S5 done-when 4: a reached case with no qualify answer shows no earned amount', () => {
  test('HealthFirst: "$100 when HealthFirst confirms the lead qualifies." and $0 earned', () => {
    const refs = [ref('R', hfLine({ partnerStatus: 'Yes', qualified: '' }))];
    const view = moneyView(refs, [], HF, ST);
    assert.equal(view.money.lines.R, '$100 when HealthFirst confirms the lead qualifies.');
    assert.equal(view.summary.earned, 0);
    assert.equal(view.summary.lines.length, 0);
    assert.doesNotMatch(view.money.lines.R, /earned/);
    // The roll-up flag on a team row says reached too.
    assert.equal(moneyLine({}, [], HF, { company: 'HealthFirst', reached: true, qualified: '', practiceType: '' }), '$100 when HealthFirst confirms the lead qualifies.');
  });

  test('HealthFirst before anyone is reached, and once qualified but not yet reached', () => {
    assert.equal(moneyView([ref('N', hfLine({ partnerStatus: 'Not yet, still trying' }))], [], HF).money.lines.N, '$100 when HealthFirst reaches them and confirms the lead qualifies.');
    assert.equal(moneyView([ref('Q', hfLine({ partnerStatus: 'Not yet, still trying', qualified: 'Yes' }))], [], HF).money.lines.Q, '$100 when HealthFirst reaches them.');
  });

  test('staffing: the promise for the type on the case, and no earned amount', () => {
    const refs = [
      ref('P', stLine({ partnerStatus: 'Yes' })),
      ref('G', stLine({ partnerStatus: 'Yes', practiceType: 'Group' })),
      ref('B', stLine({ partnerStatus: 'Yes', practiceType: '' })),
    ];
    const view = moneyView(refs, [], HF, ST);
    assert.equal(view.money.lines.P, '$100 for a private practice when Direct Dental confirms the lead qualifies.');
    assert.equal(view.money.lines.G, '$200 for a group when Direct Dental confirms the lead qualifies.');
    assert.equal(view.money.lines.B, '$100 for a private practice, or $200 for a group, when Direct Dental confirms the lead qualifies.');
    assert.equal(view.summary.earned, 0);
    for (const line of Object.values(view.money.lines)) assert.doesNotMatch(line, /earned|HealthFirst/);
    // Not reached yet.
    assert.equal(staffingNotYetLine(ST, { practiceType: 'Group' }), '$200 for a group when Direct Dental reaches the customer and confirms the lead qualifies.');
  });

  test('no staffing plan, no staffing promise; a HealthFirst plan never words a staffing line', () => {
    const view = moneyView([ref('P', stLine({ partnerStatus: 'Yes' }))], [], HF, null);
    assert.equal(view.money.lines.P, '');
    assert.equal(view.summary.upTo, 0);
  });

  test('marked not qualified: closed, nothing promised', () => {
    const view = moneyView([ref('N', stLine({ partnerStatus: 'Yes', qualified: 'No', notQualifiedReason: 'No permission to contact' }))], [], HF, ST);
    assert.equal(view.money.lines.N, 'Closed before any pay was earned.');
    assert.equal(view.summary.upTo, 0);
  });
});

describe('S5: "Up to", the empty line and the footer, per company', () => {
  test('staffing counts the type on the case, the group amount when there is none, and stops at any Reached row', () => {
    const refs = [ref('P', stLine()), ref('G', stLine({ practiceType: 'Group' })), ref('B', stLine({ practiceType: '' })), ref('D', stLine())];
    const rows = sanitizeLedger([row('D', { company: 'Staffing', status: 'Void', voidReason: 'Direct Dental marked this lead as not qualified (no permission to contact)' })]);
    const s = summarizeEarnings(rows, refs, PLANS);
    assert.equal(s.upTo, 100 + 200 + 200);
    assert.equal(s.upToText, 'Up to $500 more if Direct Dental reaches your open referrals and confirms they qualify.');
  });

  test('mixed: one total, plain words; HealthFirst alone keeps its words', () => {
    const s = summarizeEarnings([], [ref('H', hfLine()), ref('P', stLine())], PLANS);
    assert.equal(s.upTo, 200);
    assert.equal(s.upToText, 'Up to $200 more from your open referrals.');
    assert.equal(summarizeEarnings([], [ref('H', hfLine())], PLANS).upToText, 'Up to $100 more if HealthFirst reaches your open referrals and confirms they qualify.');
  });

  test('the empty line and footer name staffing only for a rep with staffing', () => {
    const hfOnly = summarizeEarnings([], [ref('H', hfLine())], PLANS);
    assert.equal(hfOnly.emptyText, "$0 so far. Here's how you earn: $100 when HealthFirst reaches an office you sent and confirms the lead qualifies.");
    assert.equal(hfOnly.footer, "Earnings follow HealthFirst's updates.");
    const both = summarizeEarnings([], [ref('H', hfLine()), ref('P', stLine())], PLANS);
    assert.equal(
      both.emptyText,
      "$0 so far. Here's how you earn: $100 when HealthFirst reaches an office you sent and confirms the lead qualifies. $100 for a private practice, or $200 for a group, when Direct Dental reaches the customer and confirms the lead qualifies.",
    );
    assert.equal(both.footer, "Earnings follow HealthFirst's and Direct Dental's updates.");
  });
});

describe('S5 done-when 1: Earned, My Earnings and the ledger total agree to the dollar', () => {
  // A rep with HealthFirst and staffing rows in every status.
  const refs = [
    ref('H1', hfLine({ partnerStatus: 'Yes', qualified: 'Yes' })),
    ref('H2', hfLine({ partnerStatus: 'Signed' }), { signed: true }),
    ref('H3', hfLine({ partnerStatus: 'Not moving forward', qualified: 'No', notQualifiedReason: 'No permission to contact' })),
    ref('S1', stLine({ partnerStatus: 'Yes', qualified: 'Yes' })),
    ref('S2', stLine({ partnerStatus: 'Yes', qualified: 'Yes', practiceType: 'Group' })),
    ref('S3', stLine({ partnerStatus: 'Yes' })),
    ref('S4', stLine({ partnerStatus: 'Not moving forward', qualified: 'No', notQualifiedReason: 'No permission to contact' })),
  ];
  const raw = [
    row('H1'),
    row('H2', { status: 'Paid', paidOn: '2026-11-15' }),
    row('H3', { status: 'Void', voidReason: 'HealthFirst marked this lead as not qualified (no permission to contact)' }),
    row('S1', { company: 'Staffing', practiceType: 'Private practice', amount: 100 }),
    row('S2', { company: 'Staffing', practiceType: 'Group', amount: 200, status: 'Paid', paidOn: '2026-11-18', disputed: true }),
    row('S4', { company: 'Staffing', practiceType: 'Private practice', amount: 100, status: 'Void', voidReason: 'Direct Dental marked this lead as not qualified (no permission to contact)' }),
    row('H9', { status: 'Pending review', amount: 50 }),
  ];

  test('per person: the Track tile, My Earnings, its lines and the ledger are one number', () => {
    const view = moneyView(refs, raw, HF, ST);
    const total = ledgerTotal(raw);
    assert.equal(total, 500);
    assert.equal(view.summary.earned, total, 'the Earned tile (Track and My Earnings read the same summary)');
    assert.equal(view.summary.waiting + view.summary.paid, total, 'Earned = Waiting + Paid');
    const counted = view.summary.lines.filter((l) => l.status === 'Earned, awaiting payment' || /^Paid on /.test(l.status));
    assert.equal(sum(counted.map((l) => usdNumber(l.amount))), total, 'the lines that count add up to Earned');
    assert.equal(view.summary.lines.length, raw.length, 'one line per ledger row, Void and Pending review included');
    for (const l of view.summary.lines.filter((x) => /^Not paid/.test(x.status))) {
      assert.equal(l.amount, '', 'a Void line shows no amount');
      assert.equal(l.what, '', 'and nothing it was earned for');
    }
    assert.equal(view.summary.lines.find((l) => l.referralId === 'S4')?.company, 'Direct Dental', 'a Void staffing line names the company alone (board 5a)');
    // The two Void lines say why, in the partner's name.
    assert.deepEqual(view.summary.lines.filter((l) => /^Not paid/.test(l.status)).map((l) => l.status).sort(), [
      'Not paid: Direct Dental marked this lead as not qualified (no permission to contact).',
      'Not paid: HealthFirst marked this lead as not qualified (no permission to contact).',
    ]);
  });

  test('per team: the Team earned tile, each person and each person\'s lines are the ledger', () => {
    const other = [row('T1', { company: 'Staffing', practiceType: 'Private practice', amount: 100 })];
    const team = /** @type {any} */ (
      shapeTeam(
        {
          team: [
            { signedUp: true, name: 'TEST Rep One', email: 'test.rep1@henryschein.com', referrals: refs, rows: raw },
            { signedUp: true, name: 'TEST Rep Two', email: 'test.rep2@henryschein.com', referrals: [ref('T1', stLine({ partnerStatus: 'Signed' }), { signed: true })], rows: other },
          ],
          managerRows: [
            { referralId: 'H2', practiceName: 'TEST H2', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: '2026-11-15', status: 'Waiting', repEmail: 'test.rep1@henryschein.com' },
            { referralId: 'T1', practiceName: 'TEST T1', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: '2026-11-16', status: 'Waiting', repEmail: 'test.rep2@henryschein.com', company: 'Staffing' },
          ],
        },
        HF,
        TODAY,
        { pay: true, staffing: ST },
      )
    );
    const total = ledgerTotal(raw) + ledgerTotal(other);
    assert.equal(usdNumber(team.tiles.earned), total, 'Team earned');
    const byPerson = team.team.map((m) => usdNumber(/Total earned (\$[\d,]+)/.exec(m.money)?.[1]));
    assert.equal(sum(byPerson), total, 'the people add up to the tile');
    for (const m of team.team) {
      const earned = usdNumber(/Total earned (\$[\d,]+)/.exec(m.money)?.[1]);
      assert.equal(sum(m.awards.map((a) => usdNumber(a.amount))), earned, `${m.name}: the lines add up to the person`);
    }
    const one = team.team.find((m) => m.name === 'TEST Rep One');
    assert.equal(one.money, 'Total earned $500. Paid $300.');
    assert.equal(usdNumber(team.tiles.paid), 300);
    assert.deepEqual(one.awards.find((a) => a.office === 'TEST S2'), { office: 'TEST S2', company: 'Direct Dental, Group', amount: '$200' });
    assert.deepEqual(one.awards.find((a) => a.office === 'TEST H1'), { office: 'TEST H1', company: 'HealthFirst', amount: '$100' });
    // The same rep's own My Earnings is the same number.
    assert.equal(moneyView(refs, raw, HF, ST).summary.earned, usdNumber(/Total earned (\$[\d,]+)/.exec(one.money)?.[1]));
  });
});

describe('S5 done-when 5: a TEST staffing sign shows $50 for the manager', () => {
  const raw = {
    team: [{ signedUp: true, name: 'TEST Rep', email: 'test.rep@henryschein.com', referrals: [ref('S1', stLine({ partnerStatus: 'Signed' }), { signed: true })], rows: [row('S1', { company: 'Staffing', practiceType: 'Private practice' })] }],
    managerRows: [{ referralId: 'S1', practiceName: 'TEST S1', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: '2026-11-16', status: 'Waiting', repEmail: 'test.rep@henryschein.com', company: 'Staffing' }],
  };

  test('the manager line names Direct Dental and "signed", and the $50 is the manager\'s earned', () => {
    const team = /** @type {any} */ (shapeTeam(raw, HF, TODAY, { pay: true, staffing: ST }));
    assert.equal(team.own.sentence, "You've earned $50 from your team's signed offices. Paid $0. Awaiting payment $50.");
    assert.deepEqual(team.own.lines, ['Nov 16. TEST S1. Direct Dental, signed. TEST Rep. $50. Earned, awaiting payment.']);
    // The rep's $100 is the rep's; the manager's $50 never joins it.
    assert.equal(team.tiles.earned, '$100');
  });

  test('before any sign, the promise names each company\'s manager award', () => {
    const none = /** @type {any} */ (shapeTeam({ ...raw, managerRows: [] }, HF, TODAY, { pay: true, staffing: ST }));
    assert.equal(none.own.sentence, "You've earned $0 from your team's signed offices so far. You earn $50 each time an office your team sent signs.");
    const differ = /** @type {any} */ (shapeTeam({ ...raw, managerRows: [] }, HF, TODAY, { pay: true, staffing: { ...ST, manager: 75 } }));
    assert.equal(differ.own.sentence, "You've earned $0 from your team's signed offices so far. You earn $50 each time an office your team sent to HealthFirst signs, and $75 for Direct Dental.");
  });
});

describe('S5: the pay terms name the staffing plan', () => {
  test('unset staffing leaves the terms as before; set, it follows the HealthFirst part', () => {
    assert.equal(payTerms(true, HF), 'reached:100,manager:50');
    assert.equal(payTerms(true, HF, null), 'reached:100,manager:50');
    const terms = payTerms(true, HF, ST);
    assert.equal(terms, 'reached:100,manager:50;staffing=reached_private:100,reached_group:200,manager:50');
    assert.equal(payTerms(false, HF, ST), '', 'pay off');
    assert.equal(payTerms(true, null, ST), 'none;staffing=reached_private:100,reached_group:200,manager:50');
    assert.deepEqual(parsePayPlan(healthFirstTerms(terms)), HF, 'the page reads its HealthFirst plan from the first part');
    assert.deepEqual(staffingPlanFromTerms(terms), ST);
    assert.equal(staffingPlanFromTerms('reached:100,manager:50'), null);
  });

  test('moneyView answers with the terms it was worded from', () => {
    assert.equal(moneyView([], [], HF, ST).terms, payTerms(true, HF, ST));
    assert.equal(moneyView([], [], HF).terms, 'reached:100,manager:50');
  });
});

describe('S5: referral facts come from the list line, never the partner\'s note', () => {
  test('company, reached, qualified and the staffing type', () => {
    assert.deepEqual(referralFacts(ref('A', stLine({ partnerStatus: 'Yes', qualified: 'Yes', practiceType: 'Group', notQualifiedNote: 'TEST secret' }))), {
      company: 'Staffing',
      reached: true,
      qualified: 'Yes',
      practiceType: 'Group',
    });
    assert.deepEqual(referralFacts(ref('B', hfLine({ partnerStatus: 'Not yet, still trying', practiceType: 'Group' }))), { company: 'HealthFirst', reached: false, qualified: '', practiceType: '' });
    assert.deepEqual(referralFacts({ id: 'C', doctor: 'x' }), { company: 'HealthFirst', reached: false, qualified: '', practiceType: '' }, 'no line yet reads as HealthFirst, as before');
    assert.equal(referralFacts(ref('D', { company: 'Unitas', partnerStatus: 'Meeting set' })).company, '');
    assert.equal(referralFacts(ref('E', { company: 'Direct Dental', partnerStatus: 'Meeting set' })).company, 'Staffing');
    assert.equal(referralFacts(ref('F', { company: 'Other name', solutions: STAFFING_SOLUTIONS, partnerStatus: 'Meeting set' })).company, 'Staffing');
  });
});

// Codex round 1 on #132 (three P1s at 8fb5b78).
describe('S5 review: what a Void line says, contact past the first call, a disputed payment', () => {
  test('a Void line\'s screen reader label says only what is shown: office, company and why, no event and no dollars', () => {
    const rows = sanitizeLedger([
      row('V', { company: 'Staffing', practiceType: 'Group', amount: 200, status: 'Void', voidReason: 'Direct Dental marked this lead as not qualified (no permission to contact)' }),
      row('W', { status: 'Void', event: 'Signed', voidReason: 'this office was referred to HealthFirst in the last 12 months' }),
    ]);
    const lines = summarizeEarnings(rows, [], PLANS).lines;
    assert.deepEqual(
      lines.map((l) => l.label),
      [
        'TEST V. Direct Dental. Not paid: Direct Dental marked this lead as not qualified (no permission to contact).',
        'TEST W. HealthFirst. Not paid: this office was referred to HealthFirst in the last 12 months.',
      ],
    );
    for (const l of lines) {
      assert.doesNotMatch(l.label, /\$|reached|signed|Group/i, l.label);
      assert.equal(l.label, `${l.office}. ${l.company}. ${l.status}`, 'the label is the shown parts, nothing more');
    }
    // A line that pays still reads in full.
    assert.equal(summarizeEarnings(sanitizeLedger([row('P', { company: 'Staffing', practiceType: 'Group', amount: 200 })]), [], PLANS).lines[0].label, 'Nov 10. TEST P. Direct Dental, Group. Direct Dental reached the customer. $200. Earned, awaiting payment.');
  });

  test('every status past first contact counts as reached for the promise, for both companies', () => {
    for (const status of ['Meeting set', 'Meeting set for Nov 20, 2026', 'Proposal or agreement sent', 'Scheduled', 'Meeting held', 'Complete', 'Yes', 'Talked with the customer']) {
      const view = moneyView([ref('H', hfLine({ partnerStatus: status })), ref('S', stLine({ partnerStatus: status, practiceType: 'Group' }))], [], HF, ST);
      assert.equal(view.money.lines.H, '$100 when HealthFirst confirms the lead qualifies.', status);
      assert.equal(view.money.lines.S, '$200 for a group when Direct Dental confirms the lead qualifies.', status);
      assert.equal(referralFacts(ref('X', hfLine({ partnerStatus: status }))).reached, true, status);
    }
    for (const status of ['Signed', 'Won', 'Closed - Won', 'Close won']) assert.equal(referralFacts(ref('X', stLine({ partnerStatus: status }))).reached, true, status);
    // Not yet reached, or nothing proven: the full promise.
    for (const status of ['Sent', 'Not yet, still trying', "Not yet, haven't tried", 'No change this week']) {
      const view = moneyView([ref('H', hfLine({ partnerStatus: status })), ref('S', stLine({ partnerStatus: status }))], [], HF, ST);
      assert.equal(view.money.lines.H, '$100 when HealthFirst reaches them and confirms the lead qualifies.', status);
      assert.equal(view.money.lines.S, '$100 for a private practice when Direct Dental reaches the customer and confirms the lead qualifies.', status);
    }
  });

  test('a disputed Paid row says "Disputed" on every money line and stays in the Paid total (D3, spec section 6)', () => {
    const raw = [
      row('D', { company: 'Staffing', practiceType: 'Group', amount: 200, status: 'Paid', paidOn: '2026-11-18', disputed: true }),
      row('E', { status: 'Paid', paidOn: '2026-11-18' }),
    ];
    const refs = [ref('D', stLine({ partnerStatus: 'Yes', qualified: 'Yes', practiceType: 'Group' })), ref('E', hfLine({ partnerStatus: 'Yes', qualified: 'Yes' }))];
    const view = moneyView(refs, raw, HF, ST);
    assert.equal(view.summary.paid, 300, 'the disputed award stays in Paid');
    assert.equal(view.summary.earned, 300);
    const d = view.summary.lines.find((l) => l.referralId === 'D');
    const e = view.summary.lines.find((l) => l.referralId === 'E');
    assert.equal(d?.status, 'Paid on Nov 18. Disputed');
    assert.equal(d?.amount, '$200');
    assert.match(d?.label ?? '', /Paid on Nov 18\. Disputed\.$/);
    assert.equal(e?.status, 'Paid on Nov 18', 'an undisputed payment reads as before');
    assert.equal(view.money.lines.D, '$200 earned Nov 10. Paid $200 on Nov 18. Disputed.');
    assert.equal(view.money.lines.E, '$100 earned Nov 10. Paid $100 on Nov 18.');
    // A signed office with a disputed sign payment, on the lead screen.
    const signed = moneyForReferrals([ref('F', hfLine({ partnerStatus: 'Signed' }), { signed: true })], sanitizeLedger([row('F', { event: 'Signed', status: 'Paid', paidOn: '2026-11-19', disputed: true })]), TODAY, PLANS);
    assert.equal(signed.lines.F, '$100 earned. Paid $100 on Nov 19. Disputed.');
    // My Team: the person's line keeps its amount in Earned and Paid; the manager's line says Disputed.
    const team = /** @type {any} */ (
      shapeTeam(
        {
          team: [{ signedUp: true, name: 'TEST Rep', email: 'test.rep@henryschein.com', referrals: refs, rows: raw }],
          managerRows: [{ referralId: 'D', practiceName: 'TEST D', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: '2026-11-16', status: 'Paid', paidOn: '2026-11-20', disputed: true, repEmail: 'test.rep@henryschein.com', company: 'Staffing' }],
        },
        HF,
        TODAY,
        { pay: true, staffing: ST },
      )
    );
    assert.equal(team.tiles.paid, '$300');
    assert.equal(team.team[0].money, 'Total earned $300. Paid $300.');
    assert.deepEqual(team.own.lines, ['Nov 16. TEST D. Direct Dental, signed. TEST Rep. $50. Paid on Nov 20. Disputed.']);
    assert.equal(team.own.sentence, "You've earned $50 from your team's signed offices. Paid $50. Awaiting payment $0.");
  });
});

// Codex round 2 on #132 (P1 at 3b719c5): a row whose Company the site does not know names
// no company, so the footer never says it follows HealthFirst's updates.
describe('S5 review: the footer for a company the site does not know', () => {
  const NEUTRAL = "Earnings follow your partners' updates.";
  test('an unknown Company row gets the neutral footer, alone or beside known ones', () => {
    for (const rows of [[row('U', { company: 'Unitas' })], [row('U', { company: 'Unitas' }), row('H')], [row('U', { company: 'Unitas' }), row('S', { company: 'Staffing' })]]) {
      assert.equal(summarizeEarnings(sanitizeLedger(rows), [], PLANS).footer, NEUTRAL, JSON.stringify(rows.map((r) => r.company)));
    }
    // A referral to a partner the site does not know, with no row yet, is the same.
    assert.equal(summarizeEarnings([], [ref('U', { company: 'Unitas', partnerStatus: 'Meeting set' })], PLANS).footer, NEUTRAL);
    // Its signed lead screen line says no partner's name either.
    assert.equal(moneyForReferrals([ref('U', { company: 'Unitas', partnerStatus: 'Signed' }, { signed: true })], [], TODAY, PLANS).lines.U, `Signed. ${NEUTRAL}`);
  });

  test('every row HealthFirst or blank, or nothing at all: the footer exactly as on main', () => {
    const MAIN = "Earnings follow HealthFirst's updates.";
    assert.equal(summarizeEarnings(sanitizeLedger([row('A'), row('B', { company: '' }), row('C', { company: 'HealthFirst' })]), [ref('A', hfLine())], PLANS).footer, MAIN);
    assert.equal(summarizeEarnings([], [], PLANS).footer, MAIN);
    assert.equal(summarizeEarnings([], [{ id: 'N', doctor: 'TEST' }], PLANS).footer, MAIN, 'a referral with no line yet is HealthFirst');
    assert.equal(moneyForReferrals([ref('H', hfLine({ partnerStatus: 'Signed' }), { signed: true })], [], TODAY, PLANS).lines.H, `Signed. ${MAIN}`);
  });
});
