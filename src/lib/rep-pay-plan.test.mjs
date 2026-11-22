import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { repPayEnabled, repPayPlan } from './register-flow.mjs';
import { moneyForReferrals, sanitizeLedger, summarizeEarnings } from './rep-earnings.mjs';
import {
  DEFAULT_PAY_PLAN,
  emptyEarnings,
  notYetLine,
  parsePayPlan,
  payLine,
  payPlanFrom,
  payPlanText,
  receiptMoney,
} from './rep-pay-plan.mjs';

const V3 = { reached: 50, signed: 100, manager: 50 };
const WON = { reached: 0, signed: 150, manager: 0 };

describe('REP_PAY_PLAN is read strictly', () => {
  test('the approved plan, closed won only, and closed won with a manager award', () => {
    assert.deepEqual(parsePayPlan(DEFAULT_PAY_PLAN), V3);
    assert.deepEqual(parsePayPlan('signed:150'), WON);
    assert.deepEqual(parsePayPlan(' Signed : 150 , manager:50 '), { reached: 0, signed: 150, manager: 50 });
  });

  test('unset or blank is the approved plan', () => {
    assert.deepEqual(payPlanFrom(undefined), V3);
    assert.deepEqual(payPlanFrom('  '), V3);
  });

  test('anything off is no plan at all, never a guess', () => {
    for (const bad of ['signed:0', 'signed:1001', 'signed:150.5', 'signed:-1', 'won:150', 'signed:100,signed:150', 'signed=150', 'signed:$150', 'signed:150;reached:50', 'garbage']) {
      assert.equal(parsePayPlan(bad), null, bad);
      assert.equal(payPlanFrom(bad), null, bad);
    }
  });

  test('the text form round trips', () => {
    for (const plan of [V3, WON, { reached: 0, signed: 150, manager: 50 }]) {
      assert.deepEqual(parsePayPlan(payPlanText(plan)), plan);
    }
  });
});

describe('every promise is worded from the plan', () => {
  test('the approved plan keeps the spec wording', () => {
    assert.equal(payLine(V3), 'You earn $50 when HealthFirst reaches the office and confirms the lead qualifies, and $100 more when it signs.');
    assert.equal(receiptMoney(V3, 'Kim'), "You'll earn $50 when HealthFirst reaches Kim and confirms the lead qualifies, and $100 more if the office signs.");
    assert.equal(emptyEarnings(V3), "$0 so far. Here's how you earn: $50 when HealthFirst reaches an office you sent and confirms the lead qualifies, $100 more when it signs.");
    assert.equal(notYetLine(V3), '$50 when HealthFirst reaches them and confirms the lead qualifies. $100 more if they sign.');
  });

  test('closed won only never promises a reached award', () => {
    for (const line of [payLine(WON), receiptMoney(WON, 'Kim'), emptyEarnings(WON), notYetLine(WON)]) {
      assert.equal(/reach/i.test(line), false, line);
      assert.match(line, /\$150/);
    }
  });
});

describe('money under a closed-won plan', () => {
  const row = (o) => ({ referralId: 'R1', practiceName: 'North Side Dental', event: 'Signed', amount: 150, earnedOn: '2026-11-14', status: 'Waiting', payeeRole: 'Rep', ...o });
  const ref = (o) => ({ id: 'R1', doctor: 'Ada', practice: 'North Side Dental', created: '2026-11-01', cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-10' }], ...o });

  test('an open referral with nothing earned says what signing pays', () => {
    assert.equal(moneyForReferrals([ref({})], [], '2026-11-15', WON).lines.R1, '$150 if they sign.');
  });

  test('"Up to" counts every open referral, reached or not, and skips signed ones', () => {
    const refs = [ref({ id: 'A' }), ref({ id: 'B' }), ref({ id: 'C', signed: true })];
    assert.equal(summarizeEarnings([], refs, WON).upTo, 300);
    assert.equal(summarizeEarnings([], refs, V3).upTo, 0, 'the v3 plan counts reached offices only');
  });

  test('a signed award is earned the same way under either plan', () => {
    const rows = sanitizeLedger([row({})]);
    const won = moneyForReferrals([ref({ signed: true })], rows, '2026-11-15', WON).lines.R1;
    assert.equal(won, '$150 earned. $150 awaiting payment.');
    assert.equal(summarizeEarnings(rows, [], WON).earned, 150);
  });

  test('a Reached row from an earlier plan still counts after the switch (D3)', () => {
    const rows = sanitizeLedger([row({ event: 'Reached', amount: 50, earnedOn: '2026-11-10', status: 'Paid', paidOn: '2026-11-30' })]);
    assert.equal(summarizeEarnings(rows, [], WON).paid, 50);
    assert.equal(moneyForReferrals([ref({})], rows, '2026-12-01', WON).lines.R1, '$50 earned Nov 10. Paid $50 on Nov 30. $150 more if they sign.');
  });
});

describe('a bad REP_PAY_PLAN promises nothing, and pay stays on for ledger amounts', () => {
  const withEnv = (vars, fn) => {
    const prior = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
    Object.assign(process.env, vars);
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

  test('on with a good plan; with a bad one pay stays on and the plan is null (field two-track S1)', () => {
    withEnv({ REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'signed:150' }, () => {
      assert.equal(repPayEnabled(), true);
      assert.deepEqual(repPayPlan(), WON);
    });
    // "An unparseable value promises no dollars anywhere (ledger rows that exist still show
    // their amounts)": ledger amounts are gated on REP_PAY_ENABLED, promises on the plan.
    withEnv({ REP_APP_ENABLED: 'true', REP_PAY_ENABLED: 'true', REP_PAY_PLAN: 'signed:lots' }, () => {
      assert.equal(repPayEnabled(), true);
      assert.equal(repPayPlan(), null);
    });
  });
});

describe('a no-pay office promises nothing, under either plan', () => {
  const ref = (o) => ({ id: 'R1', doctor: 'Ada', practice: 'North Side Dental', created: '2026-11-01', cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-10' }], ...o });
  const voided = sanitizeLedger([
    { referralId: 'R1', practiceName: 'North Side Dental', event: 'Reached', amount: 50, earnedOn: '2026-11-10', status: 'Void', voidReason: 'this office was referred to HealthFirst in the last 12 months', payeeRole: 'Rep' },
  ]);
  for (const [name, plan] of [['default', V3], ['closed won', WON]]) {
    test(`${name}: "Up to" and the card agree on a Void-only office`, () => {
      assert.equal(summarizeEarnings(voided, [ref({})], plan).upTo, 0);
      assert.equal(moneyForReferrals([ref({})], voided, '2026-11-15', plan).lines.R1, 'Not paid: this office was referred to HealthFirst in the last 12 months.');
    });
  }
});

// Brian, 11/9: the draft plan is $150 on the sign and $50 to the manager, nothing on
// reaching (spec D15 and section 5, test 22; still needs Katy and Tracy). The code
// default stays the approved v3 plan until the docs change it.
describe('the draft plan, REP_PAY_PLAN=signed:150,manager:50 (Brian, 11/9)', () => {
  const DRAFT = parsePayPlan('signed:150,manager:50');
  const ref = (o) => ({ id: 'R1', doctor: 'Ada', practice: 'North Side Dental', created: '2026-11-01', cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-10' }], ...o });
  const row = (o) => ({ referralId: 'R1', practiceName: 'North Side Dental', event: 'Signed', amount: 150, earnedOn: '2026-11-14', status: 'Waiting', payeeRole: 'Rep', ...o });

  test('parses to $150 signed, $50 manager, no reached award, and the default is unchanged', () => {
    assert.deepEqual(DRAFT, { reached: 0, signed: 150, manager: 50 });
    assert.equal(payPlanText(DRAFT), 'signed:150,manager:50');
    assert.equal(DEFAULT_PAY_PLAN, 'reached:50,signed:100,manager:50');
  });

  test('every promise reads as spec section 5 says', () => {
    assert.equal(payLine(DRAFT), 'You earn $150 when the office signs.');
    assert.equal(receiptMoney(DRAFT, 'Kim'), "You'll earn $150 if the office signs.");
    assert.equal(emptyEarnings(DRAFT), "$0 so far. Here's how you earn: $150 when an office you sent signs.");
    assert.equal(notYetLine(DRAFT), '$150 if they sign.');
    for (const line of [payLine(DRAFT), receiptMoney(DRAFT, 'Kim'), emptyEarnings(DRAFT), notYetLine(DRAFT)]) {
      assert.equal(/reach|\$50/i.test(line), false, line);
    }
  });

  test('the lead screen money line: "$150 if they sign." before the sign, "$150 earned." after it', () => {
    assert.equal(moneyForReferrals([ref({})], [], '2026-11-15', DRAFT).lines.R1, '$150 if they sign.');
    const signed = moneyForReferrals([ref({ signed: true })], sanitizeLedger([row({})]), '2026-11-15', DRAFT).lines.R1;
    assert.equal(signed, '$150 earned. $150 awaiting payment.');
  });

  test('"Up to" counts only the $150 sign award, for every open office, reached or not', () => {
    const refs = [ref({ id: 'A' }), ref({ id: 'B', cases: [{ company: 'HealthFirst', partnerStatus: 'Sent', updated: '2026-11-01' }] }), ref({ id: 'C', signed: true }), ref({ id: 'D', closed: true })];
    // Two open offices: $300. Never the manager's $50, and never a reached award.
    assert.equal(summarizeEarnings([], refs, DRAFT).upTo, 300);
    // A signed award already earned settles that office.
    assert.equal(summarizeEarnings(sanitizeLedger([row({ referralId: 'A' })]), refs, DRAFT).upTo, 150);
  });

  test('a Reached row from the old plan still counts, and the card still promises only the sign', () => {
    const rows = sanitizeLedger([row({ event: 'Reached', amount: 50, earnedOn: '2026-11-10' })]);
    assert.equal(summarizeEarnings(rows, [], DRAFT).earned, 50);
    assert.equal(moneyForReferrals([ref({})], rows, '2026-11-15', DRAFT).lines.R1, '$50 earned Nov 10. $150 more if they sign.');
  });
});
