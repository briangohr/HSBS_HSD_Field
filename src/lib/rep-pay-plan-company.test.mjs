// Slice S1 of the field two-track spec (section 6 "Pay"): a HealthFirst plan with no sign
// award, and a pay plan per company. The tests in rep-pay-plan.test.mjs stay as they are.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { repPayEnabled, repPayPlan, repPayPlanFor, repPayTerms, repPromisePlan } from './register-flow.mjs';
import { shapeTeam } from './rep-team.mjs';
import { moneyForReferrals, sanitizeLedger, summarizeEarnings } from './rep-earnings.mjs';
import { moneyView } from './rep-reads.mjs';
import {
  PAY_COMPANIES,
  emptyEarnings,
  notYetLine,
  parsePayPlan,
  parseStaffingPayPlan,
  payLine,
  payPlanFor,
  payPlanText,
  receiptMoney,
  signTail,
  staffingNotYetLine,
  staffingUpTo,
  upToLine,
  NO_PLAN_TERMS,
  TERMS_CHANGED,
  payTerms,
} from './rep-pay-plan.mjs';

const REACHED = { reached: 100, signed: 0, manager: 50 };
const STAFFING = { reachedPrivate: 100, reachedGroup: 200, manager: 50 };

const withEnv = (vars, fn) => {
  const prior = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const quiet = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = quiet;
    for (const [k, v] of Object.entries(prior)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

describe('HealthFirst 11/11 plan, REP_PAY_PLAN=reached:100,manager:50', () => {
  test('parses, with no sign award', () => {
    assert.deepEqual(parsePayPlan('reached:100,manager:50'), REACHED);
    assert.deepEqual(parsePayPlan(' Manager : 50 , reached:100 '), REACHED);
    assert.equal(payPlanText(REACHED), 'reached:100,manager:50');
    assert.deepEqual(parsePayPlan(payPlanText(REACHED)), REACHED);
  });

  test('a plan still needs a rep award; nothing has to be paid at the sign', () => {
    for (const bad of ['manager:50', 'reached:0,manager:50', 'reached:100,manager:0', 'reached:100,manager:1001']) {
      assert.equal(parsePayPlan(bad), null, bad);
    }
  });
});

// Rep app v3 check 23: "With the plan set to `reached:100` alone, no manager row is written".
describe('a reached-only plan, REP_PAY_PLAN=reached:100', () => {
  const ALONE = { reached: 100, signed: 0, manager: 0 };

  test('parses, with no sign award and no manager award', () => {
    assert.deepEqual(parsePayPlan('reached:100'), ALONE);
    assert.deepEqual(parsePayPlan('reached:50'), { reached: 50, signed: 0, manager: 0 });
    assert.equal(payPlanText(ALONE), 'reached:100');
    assert.deepEqual(parsePayPlan(payPlanText(ALONE)), ALONE);
  });

  test('every promise reads right and promises nothing at the sign', () => {
    assert.equal(payLine(ALONE), 'You earn $100 when HealthFirst reaches the office and confirms the lead qualifies.');
    assert.equal(receiptMoney(ALONE, 'Kim'), "You'll earn $100 when HealthFirst reaches Kim and confirms the lead qualifies.");
    assert.equal(emptyEarnings(ALONE), "$0 so far. Here's how you earn: $100 when HealthFirst reaches an office you sent and confirms the lead qualifies.");
    assert.equal(notYetLine(ALONE), '$100 when HealthFirst reaches them and confirms the lead qualifies.');
    assert.equal(signTail(ALONE), '');
    for (const line of [payLine(ALONE), receiptMoney(ALONE, 'Kim'), emptyEarnings(ALONE), notYetLine(ALONE)]) {
      assert.equal(/sign|\$0(?! so far)/i.test(line), false, line);
    }
  });

  test('the lead screen and "Up to" promise nothing at the sign', () => {
    const ref = { id: 'R1', doctor: 'Ada', practice: 'North Side Dental', created: '2026-11-01', cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-10' }] };
    const rows = sanitizeLedger([{ referralId: 'R1', practiceName: 'North Side Dental', event: 'Reached', amount: 100, earnedOn: '2026-11-10', status: 'Waiting', payeeRole: 'Rep' }]);
    assert.equal(moneyForReferrals([ref], [], '2026-11-15', ALONE).lines.R1, '$100 when HealthFirst confirms the lead qualifies.');
    assert.equal(moneyForReferrals([ref], rows, '2026-11-15', ALONE).lines.R1, '$100 earned Nov 10.');
    assert.equal(summarizeEarnings(rows, [ref], ALONE).upTo, 0);
  });
});

describe('HealthFirst 11/11 plan, wording', () => {

  test('no promise words a $0 sign award', () => {
    assert.equal(payLine(REACHED), 'You earn $100 when HealthFirst reaches the office and confirms the lead qualifies.');
    assert.equal(receiptMoney(REACHED, 'Kim'), "You'll earn $100 when HealthFirst reaches Kim and confirms the lead qualifies.");
    assert.equal(emptyEarnings(REACHED), "$0 so far. Here's how you earn: $100 when HealthFirst reaches an office you sent and confirms the lead qualifies.");
    assert.equal(notYetLine(REACHED), '$100 when HealthFirst reaches them and confirms the lead qualifies.');
    assert.equal(signTail(REACHED), '');
    for (const line of [payLine(REACHED), receiptMoney(REACHED, 'Kim'), emptyEarnings(REACHED), notYetLine(REACHED)]) {
      assert.equal(/sign|\$50|\$0(?! so far)/i.test(line), false, line);
    }
  });

  test('money lines and "Up to" from the ledger, never a $0 sign promise', () => {
    const ref = { id: 'R1', doctor: 'Ada', practice: 'North Side Dental', created: '2026-11-01', cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-10' }] };
    const rows = sanitizeLedger([{ referralId: 'R1', practiceName: 'North Side Dental', event: 'Reached', amount: 100, earnedOn: '2026-11-10', status: 'Waiting', payeeRole: 'Rep' }]);
    assert.equal(moneyForReferrals([ref], [], '2026-11-15', REACHED).lines.R1, '$100 when HealthFirst confirms the lead qualifies.');
    assert.equal(moneyForReferrals([ref], rows, '2026-11-15', REACHED).lines.R1, '$100 earned Nov 10.');
    const sum = summarizeEarnings(rows, [ref], REACHED);
    assert.equal(sum.earned, 100);
    assert.equal(sum.upTo, 0);
  });

  test('set in REP_PAY_PLAN, pay turns on with it', () => {
    withEnv({ REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'reached:100,manager:50' }, () => {
      assert.equal(repPayEnabled(), true);
      assert.deepEqual(repPayPlan(), REACHED);
      assert.deepEqual(repPayPlanFor('HealthFirst'), REACHED);
    });
  });
});

describe('Staffing plan, REP_PAY_PLAN_STAFFING', () => {
  test('parses the three amounts', () => {
    assert.deepEqual(parseStaffingPayPlan('reached_private:100,reached_group:200,manager:50'), STAFFING);
    assert.deepEqual(parseStaffingPayPlan(' manager:50 , Reached_Group : 200,reached_private:100 '), STAFFING);
  });

  test('a missing key, a non-number, a negative or junk is no plan', () => {
    for (const bad of [
      'reached_private:100,reached_group:200',
      'reached_private:100,manager:50',
      'reached_group:200,manager:50',
      'reached_private:lots,reached_group:200,manager:50',
      'reached_private:100,reached_group:-200,manager:50',
      'reached_private:100,reached_group:200,manager:0',
      'reached_private:100,reached_group:200,manager:1001',
      'reached_private:100.5,reached_group:200,manager:50',
      'reached_private:100,reached_group:200,manager:50,signed:100',
      'reached_private:100,reached_private:100,reached_group:200,manager:50',
      'reached:100,manager:50',
      'reached_private=100,reached_group=200,manager=50',
      'garbage',
      '',
      undefined,
      null,
      42,
    ]) {
      assert.equal(parseStaffingPayPlan(bad), null, String(bad));
    }
  });
});

describe('the Dec 4 plans: HealthFirst and Direct Dental each pay $100 per qualified lead (Brian 11/21, pay sheet R11)', () => {
  const HF = parsePayPlan('reached:100,manager:50');
  const FLAT = parseStaffingPayPlan('reached_private:100,reached_group:100,manager:50');

  test('both values parse as set in Vercel', () => {
    assert.deepEqual(HF, { reached: 100, signed: 0, manager: 50 });
    assert.deepEqual(FLAT, { reachedPrivate: 100, reachedGroup: 100, manager: 50 });
  });

  test('a flat staffing plan names one amount and no practice type, whatever the case says', () => {
    const line = '$100 when Direct Dental reaches the customer and confirms the lead qualifies.';
    for (const practiceType of ['', 'Group', 'Private practice']) assert.equal(staffingNotYetLine(FLAT, { practiceType }), line, practiceType);
    assert.equal(staffingNotYetLine(FLAT, { reached: true, practiceType: 'Group' }), '$100 when Direct Dental confirms the lead qualifies.');
    assert.equal(staffingUpTo(FLAT, 'Group'), 100);
    assert.equal(staffingUpTo(FLAT, 'Private practice'), 100);
  });

  test('the empty My Earnings line reads one amount per company', () => {
    assert.equal(
      emptyEarnings(HF, FLAT),
      "$0 so far. Here's how you earn: $100 when HealthFirst reaches an office you sent and confirms the lead qualifies. $100 when Direct Dental reaches the customer and confirms the lead qualifies.",
    );
  });

  test('a plan that still pays by type keeps naming the type', () => {
    assert.equal(
      staffingNotYetLine(STAFFING, {}),
      '$100 for a private practice, or $200 for a group, when Direct Dental reaches the customer and confirms the lead qualifies.',
    );
    assert.equal(staffingNotYetLine(STAFFING, { practiceType: 'Group' }), '$200 for a group when Direct Dental reaches the customer and confirms the lead qualifies.');
  });
});

describe('a plan per company', () => {
  test('the company keys are exactly HealthFirst and Staffing', () => {
    assert.deepEqual(PAY_COMPANIES, ['HealthFirst', 'Staffing']);
  });

  test('HealthFirst reads REP_PAY_PLAN as before; unset is the v3 plan', () => {
    assert.deepEqual(payPlanFor('HealthFirst', { REP_PAY_PLAN: undefined }), { reached: 50, signed: 100, manager: 50 });
    assert.deepEqual(payPlanFor('HealthFirst', { REP_PAY_PLAN: 'reached:100,manager:50' }), REACHED);
    assert.equal(payPlanFor('HealthFirst', { REP_PAY_PLAN: 'signed:lots' }), null);
  });

  test('Staffing reads REP_PAY_PLAN_STAFFING; unset or bad is no plan, never a default', () => {
    assert.deepEqual(payPlanFor('Staffing', { REP_PAY_PLAN_STAFFING: 'reached_private:100,reached_group:200,manager:50' }), STAFFING);
    assert.equal(payPlanFor('Staffing', {}), null);
    assert.equal(payPlanFor('Staffing', { REP_PAY_PLAN_STAFFING: '  ' }), null);
    assert.equal(payPlanFor('Staffing', { REP_PAY_PLAN_STAFFING: 'reached_private:100' }), null);
    // The HealthFirst setting never stands in for staffing.
    assert.equal(payPlanFor('Staffing', { REP_PAY_PLAN: 'reached:100,manager:50' }), null);
  });

  test('a company with no plan defined has none', () => {
    for (const company of ['Unitas', 'healthfirst', 'staffing', '', undefined]) {
      assert.equal(payPlanFor(company, { REP_PAY_PLAN: 'reached:100,manager:50', REP_PAY_PLAN_STAFFING: 'reached_private:100,reached_group:200,manager:50' }), null, String(company));
    }
  });

  test('a bad staffing plan turns off staffing only, never HealthFirst pay', () => {
    withEnv({ REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'reached:100,manager:50', REP_PAY_PLAN_STAFFING: 'junk' }, () => {
      assert.equal(repPayEnabled(), true);
      assert.deepEqual(repPayPlanFor('HealthFirst'), REACHED);
      assert.equal(repPayPlanFor('Staffing'), null);
    });
    withEnv({ REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'true', REP_PAY_PLAN: undefined, REP_PAY_PLAN_STAFFING: 'reached_private:100,reached_group:200,manager:50' }, () => {
      assert.deepEqual(repPayPlanFor('Staffing'), STAFFING);
      assert.deepEqual(repPayPlanFor(), repPayPlan(), 'the default company is HealthFirst');
    });
  });
});

// "Up to $X more" with NO Reached row supplied (rep app v3 spec section 5 and check 23).
describe('"Up to" counts what an open referral can still earn under the plan', () => {
  const ref = (o) => ({ id: 'R1', doctor: 'Ada', practice: 'North Side Dental', created: '2026-11-01', cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-10' }], ...o });
  const row = (o) => ({ referralId: 'A', practiceName: 'North Side Dental', event: 'Reached', amount: 100, earnedOn: '2026-11-10', status: 'Waiting', payeeRole: 'Rep', ...o });
  const open = [ref({ id: 'A' }), ref({ id: 'B' })];
  const settled = [ref({ id: 'C', signed: true }), ref({ id: 'D', closed: true })];

  test('reached only: the reached award for each open referral with no Reached row', () => {
    assert.equal(summarizeEarnings([], [...open, ...settled], parsePayPlan('reached:100')).upTo, 200);
    assert.equal(summarizeEarnings([], [...open, ...settled], REACHED).upTo, 200, 'the 11/11 plan: the manager award never counts');
    // A Reached row of any status settles that referral, so a Pending review row is not counted twice.
    for (const status of ['Waiting', 'Paid', 'Pending review', 'Void']) {
      const extra = status === 'Paid' ? { paidOn: '2026-11-12' } : status === 'Void' ? { voidReason: 'no pay' } : {};
      assert.equal(summarizeEarnings(sanitizeLedger([row({ status, ...extra })]), open, REACHED).upTo, 100, status);
    }
    // A Signed row of any kind settles it too.
    assert.equal(summarizeEarnings(sanitizeLedger([row({ event: 'Signed', status: 'Void', voidReason: 'no pay' })]), open, REACHED).upTo, 100);
  });

  test('signed only: the sign award for each open referral, reached or not (unchanged)', () => {
    assert.equal(summarizeEarnings([], [...open, ...settled], parsePayPlan('signed:150')).upTo, 300);
    assert.equal(summarizeEarnings([], [...open, ...settled], parsePayPlan('signed:150,manager:50')).upTo, 300);
  });

  test('reached and signed: the sign award for reached offices only, as spec section 5 says (unchanged)', () => {
    const V3 = parsePayPlan('reached:50,signed:100,manager:50');
    assert.equal(summarizeEarnings([], [...open, ...settled], V3).upTo, 0);
    assert.equal(summarizeEarnings(sanitizeLedger([row({ amount: 50 })]), open, V3).upTo, 100);
  });

  test('the "Up to" line is worded from the plan', () => {
    assert.equal(upToLine(REACHED, 200), 'Up to $200 more if HealthFirst reaches your open referrals and confirms they qualify.');
    assert.equal(upToLine(parsePayPlan('reached:100'), 100), 'Up to $100 more if HealthFirst reaches your open referrals and confirms they qualify.');
    assert.equal(upToLine(parsePayPlan('signed:150'), 300), 'Up to $300 more if your open referrals sign.');
    assert.equal(upToLine(parsePayPlan('reached:50,signed:100,manager:50'), 100), 'Up to $100 more if your open referrals sign.');
  });

  test('a staffing plan is not a HealthFirst plan: it promises nothing here, never NaN', () => {
    assert.equal(summarizeEarnings([], open, /** @type {any} */ (STAFFING)).upTo, 0);
  });
});

// Codex P1 on PR #113: the "Up to" amount and its words must come from one plan. The amount
// is counted on the server from the plan it holds now; a page opened before REP_PAY_PLAN
// changed must not word it from the plan baked into its HTML.
describe('"Up to" is worded by the server, from the plan that counted it', () => {
  const ref = (o) => ({ id: 'R1', doctor: 'Ada', practice: 'North Side Dental', created: '2026-11-01', cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-10' }], ...o });
  const open = [ref({ id: 'A' }), ref({ id: 'B' })];

  test('the summary carries the line for its own amount, under each plan', () => {
    const cases = [
      [parsePayPlan('reached:100'), 'Up to $200 more if HealthFirst reaches your open referrals and confirms they qualify.'],
      [REACHED, 'Up to $200 more if HealthFirst reaches your open referrals and confirms they qualify.'],
      [parsePayPlan('signed:150'), 'Up to $300 more if your open referrals sign.'],
      [parsePayPlan('signed:150,manager:50'), 'Up to $300 more if your open referrals sign.'],
    ];
    for (const [plan, line] of cases) {
      const view = moneyView(open, [], plan);
      assert.equal(view.summary.upToText, line, payPlanText(plan));
      assert.equal(view.summary.upToText, upToLine(plan, view.summary.upTo), 'same plan for amount and words');
    }
  });

  test('nothing to promise: no line', () => {
    assert.equal(moneyView(open, [], parsePayPlan('reached:50,signed:100,manager:50')).summary.upToText, '');
    assert.equal(moneyView([], [], REACHED).summary.upToText, '');
    assert.equal(summarizeEarnings([], open, /** @type {any} */ (STAFFING)).upToText, '');
  });

  test('the plan in the page never words the line: My Earnings shows the server text', () => {
    const src = readFileSync(new URL('../components/RepReferral.astro', import.meta.url), 'utf8');
    const script = src.slice(src.indexOf('<script>'));
    assert.equal(/upToLine\s*\(/.test(script), false, 'the browser script words no "Up to" line itself');
    assert.match(script, /upTo\.textContent = sm\.upToText/);
  });
});

// Codex P1 on #113 (round 2) and slice S1's done-when: "An unparseable value promises no
// dollars anywhere (ledger rows that exist still show their amounts)".
describe('a bad REP_PAY_PLAN promises nothing, and ledger amounts still show', () => {
  const ref = (o) => ({ id: 'A', doctor: 'Ada', practice: 'North Side Dental', created: '2026-11-01', cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-10' }], ...o });
  const row = (o) => ({ referralId: 'A', practiceName: 'North Side Dental', event: 'Reached', amount: 100, earnedOn: '2026-11-10', status: 'Waiting', payeeRole: 'Rep', ...o });
  const referrals = [ref({}), ref({ id: 'B' })];
  const ledger = [row({}), row({ referralId: 'B', amount: 50, status: 'Paid', paidOn: '2026-11-12' })];
  const PROMISE = /when HealthFirst reaches|if they sign|more if|Here's how you earn|Up to/;

  test('pay stays on, the promise plan is null, and the terms say so', () => {
    withEnv({ REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'signed:lots' }, () => {
      assert.equal(repPayEnabled(), true, 'the ledger gate stays on');
      assert.equal(repPayPlan(), null);
      assert.equal(repPromisePlan(), null);
      assert.equal(repPayTerms(), NO_PLAN_TERMS);
    });
    withEnv({ REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'reached:100,manager:50' }, () => {
      assert.deepEqual(repPromisePlan(), REACHED);
      assert.equal(repPayTerms(), 'reached:100,manager:50');
    });
    withEnv({ REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'false', REP_PAY_PLAN: 'signed:lots' }, () => {
      assert.equal(repPayEnabled(), false);
      assert.equal(repPromisePlan(), null);
      assert.equal(repPayTerms(), '', 'pay off');
    });
  });

  test('My Earnings and Track: every row shows its amount, nothing is promised', () => {
    const view = moneyView(referrals, ledger, null);
    assert.equal(view.summary.earned, 150);
    assert.equal(view.summary.waiting, 100);
    assert.equal(view.summary.paid, 50);
    assert.equal(view.summary.lines.length, 2);
    assert.equal(view.summary.upTo, 0);
    assert.equal(view.summary.upToText, '');
    assert.equal(view.summary.emptyText, '$0 so far.');
    assert.equal(view.money.lines.A, '$100 earned Nov 10.');
    assert.equal(view.money.lines.B, '$50 earned Nov 10. Paid $50 on Nov 12.');
    assert.equal(view.terms, NO_PLAN_TERMS);
    // An open office with no row has no promise line at all.
    assert.equal(moneyView([ref({ id: 'C' })], [], null).money.lines.C, '');
    for (const text of [...Object.values(view.money.lines), view.summary.upToText, view.summary.emptyText]) assert.doesNotMatch(text, PROMISE);
  });

  test('the v3 default stays the default when no plan is passed, and its terms say so', () => {
    const view = moneyView(referrals, ledger, undefined);
    assert.equal(view.terms, 'reached:50,signed:100,manager:50');
    assert.equal(view.money.lines.A, '$100 earned Nov 10. $100 more if they sign.');
  });

  test('My Team: amounts from the rows, no "You earn $X each time" promise', () => {
    const raw = {
      team: [{ signedUp: true, name: 'Test Rep', email: 'test.rep@henryschein.com', role: 'AE', registeredOn: '2026-11-02', referrals, rows: ledger }],
      managerRows: [{ referralId: 'A', practiceName: 'North Side Dental', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: '2026-11-14', status: 'Waiting', repEmail: 'test.rep@henryschein.com' }],
    };
    const team = /** @type {any} */ (shapeTeam(raw, null, '2026-11-20', { pay: true }));
    assert.deepEqual(team.tiles, { referrals: 2, signed: 0, earned: '$150', paid: '$50' });
    assert.equal(team.team[0].money, 'Total earned $150. Paid $50.');
    assert.equal(team.own.sentence, "You've earned $50 from your team's signed offices. Paid $0. Awaiting payment $50.");
    // No manager rows yet, no plan: nothing to promise, so no own block.
    const none = /** @type {any} */ (shapeTeam({ ...raw, managerRows: [] }, null, '2026-11-20', { pay: true }));
    assert.equal('own' in none, false);
    assert.doesNotMatch(JSON.stringify(none), PROMISE);
    // Pay off is still (raw, null): no money key anywhere.
    assert.deepEqual(Object.keys(shapeTeam(raw, null, '2026-11-20')), ['tiles', 'team', 'notSignedUp']);
  });

  test('the page: pay comes from REP_PAY_ENABLED, promises from the plan', () => {
    const page = readFileSync(new URL('../pages/refer/[key].astro', import.meta.url), 'utf8');
    assert.match(page, /pay=\{repPayEnabled\(\)\}\s*payPlan=\{repPromisePlan\(\)\}/);
    const earnings = readFileSync(new URL('../pages/api/earnings.ts', import.meta.url), 'utf8');
    assert.match(earnings, /moneyView\(referrals, ledger, repPayPlan\(\), repStaffingPlan\(\)\)/, 'no "?? undefined": a null plan never becomes the v3 default');
    const list = readFileSync(new URL('../pages/api/referral-list.ts', import.meta.url), 'utf8');
    assert.match(list, /const plan = repPayPlan\(\);[\s\S]*moneyView\(referrals, ledger, plan, staffing\)/);
  });
});

// Codex P1 on #113 (round 2): no promise the page worded itself stays up beside newer terms.
describe('the page drops its own promises when the server terms have changed', () => {
  test('payTerms: pay off, no plan, a plan', () => {
    assert.equal(payTerms(false, REACHED), '');
    assert.equal(payTerms(true, null), NO_PLAN_TERMS);
    assert.equal(payTerms(true, REACHED), 'reached:100,manager:50');
    assert.equal(TERMS_CHANGED, 'Pay terms changed. Reload this page to see them.');
  });

  test('the script compares every money answer and every good send with its own terms', () => {
    const src = readFileSync(new URL('../components/RepReferral.astro', import.meta.url), 'utf8');
    const script = src.slice(src.indexOf('<script>'));
    assert.match(src, /data-pay-plan=\{payTerms\(payEnabled, payPlan, sPlan\)\}/);
    assert.match(script, /if \(m\) noteTerms\(m\.terms\);\s*money = m;/, 'every installed money answer');
    assert.match(script, /noteTerms\(body\.terms\);\s*showSent\(repReceipt\(\{ contactName: fields\.contactName, plan: termsStale \? null : payPlan \}\)\)/, 'the receipt');
    assert.match(script, /noteStaffingTerms\(body\.staffingTerms\);[\s\S]*?plan: payEnabled && !staffingStale \? sPlan : null/, 'the staffing receipt');
    assert.match(script, /'\.rep-pay, \.rep-company-pay'\)\.forEach\(\(el\) => \(el\.textContent = TERMS_CHANGED\)\)/, 'the pay lines');
    assert.match(script, /status\.textContent = typeof sm\.emptyText === 'string' \? sm\.emptyText/, 'the empty Earnings line comes from the server');
  });

  test('a good rep send names the terms, pay on or off', () => {
    const route = readFileSync(new URL('../pages/api/referral.ts', import.meta.url), 'utf8');
    assert.match(route, /return json\(\{ \.\.\.rest, terms: repPayTerms\(\), \.\.\.staffing \}, status\);/);
  });
});
