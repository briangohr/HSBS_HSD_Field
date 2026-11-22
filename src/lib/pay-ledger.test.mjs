// TSM pay plan v3.3, Task 3: the site reads schema 1 and schema 2 ledger rows.
// Review focus 1: a schema 1 row reads exactly as today. Review focus 2: an adjustment
// whose parent is missing or Void is held out of Earned and shown as needing review.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { balance, checkLedger, signedDollars } from './pay-ledger.mjs';
import { moneyForReferrals, sanitizeLedger, sanitizeLedgerRow, summarizeEarnings } from './rep-earnings.mjs';
import { moneyView } from './rep-reads.mjs';
import { shapeTeam } from './rep-team.mjs';

const TODAY = '2026-11-22';
const v1 = (o) => ({ referralId: 'R1', practiceName: 'TEST Office', company: 'HealthFirst', event: 'Reached', amount: 100, earnedOn: '2026-11-21', status: 'Waiting', payeeRole: 'Rep', ...o });
const award = (o) => v1({ schemaVersion: 2, recordType: 'Award', awardKey: `${o?.referralId ?? 'R1'}|Reached|Rep`, eligibility: 'Eligible', ...o });
const adj = (o) => v1({ schemaVersion: 2, recordType: 'Adjustment', adjustmentId: `R1|Reached|Rep|Adj|${o?.id ?? 'g1'}`, parentAwardKey: 'R1|Reached|Rep', eligibility: 'Eligible', adjustmentReason: 'Partner corrected the office', earnedOn: '2026-11-22', ...o, id: undefined });
const sum = (raw) => summarizeEarnings(sanitizeLedger(raw), []);

// The P5b reconcile (pay sheet, 11/21): the TEST rep's 8 Waiting rep rows, $900, plus Void rows.
const P5B = [
  ...[12, 14, 18, 27, 28, 30].map((n) => v1({ referralId: `C${n}` })),
  v1({ referralId: 'C22', event: 'Signed', amount: 150 }),
  v1({ referralId: 'C26', event: 'Signed', amount: 150 }),
  v1({ referralId: 'C13', status: 'Void', voidReason: 'HealthFirst marked this lead as not qualified' }),
  v1({ referralId: 'C16', status: 'Void', voidReason: 'Already a customer' }),
];

describe('schema 1 reads exactly as today', () => {
  test('the P5b TEST rows give $900 earned, $900 awaiting, and no review words', () => {
    const s = sum(P5B);
    assert.deepEqual({ earned: s.earned, waiting: s.waiting, paid: s.paid, pendingReview: s.pendingReview }, { earned: 900, waiting: 900, paid: 0, pendingReview: 0 });
    for (const k of ['complete', 'needsReview', 'needsReviewCount', 'reviewText']) assert.equal(k in s, false, k);
  });

  test('a schema 1 row is an Award, Eligible unless Void, and never a problem for missing columns', () => {
    const rows = sanitizeLedger(P5B);
    assert.ok(rows.every((r) => r.schemaVersion === 1 && r.recordType === 'Award'));
    assert.deepEqual([...new Set(rows.map((r) => r.eligibility))].sort(), ['Eligible', 'Ineligible']);
    assert.deepEqual(checkLedger(rows).problems, []);
  });

  test('two schema 1 awards for one lead and event are not flagged (L5 is schema 2 only)', () => {
    assert.deepEqual(checkLedger(sanitizeLedger([v1({}), v1({ practiceName: 'Other' })])).problems, []);
  });
});

describe('schema 2 awards and adjustments', () => {
  test('awardKey and the schema 2 fields survive sanitizing', () => {
    const r = sanitizeLedgerRow(award({}));
    assert.equal(r?.awardKey, 'R1|Reached|Rep');
    assert.equal(r?.schemaVersion, 2);
    assert.equal(sanitizeLedgerRow(adj({}))?.parentAwardKey, 'R1|Reached|Rep');
  });

  test('a negative adjustment nets; a positive one adds', () => {
    assert.equal(sum([award({}), adj({ amount: -40 })]).earned, 60);
    assert.equal(sum([award({}), adj({ amount: 50 })]).earned, 150);
    assert.equal(sum([award({ status: 'Paid', paidOn: '2026-11-21' }), adj({ amount: -100 })]).earned, 0);
  });

  test('an adjustment line reads "<date>. <office>. Adjustment: <reason>. <+$n or -$n>."', () => {
    const line = sum([award({}), adj({ amount: -40 })]).lines.find((l) => l.what.startsWith('Adjustment'));
    assert.equal(line.label, 'Nov 22. TEST Office. Adjustment: Partner corrected the office. -$40. Awaiting payment.');
    assert.equal(line.amount, '-$40');
    assert.equal(signedDollars(50), '+$50');
  });

  test('an adjustment of 0, an award below 1, or a schema 2 row with no key is refused', () => {
    assert.equal(sanitizeLedgerRow(adj({ amount: 0 })), null);
    assert.equal(sanitizeLedgerRow(award({ amount: -5 })), null);
    assert.equal(sanitizeLedgerRow(award({ awardKey: '' })), null);
    assert.equal(sanitizeLedgerRow(adj({ parentAwardKey: '' })), null);
    assert.equal(sanitizeLedgerRow(award({ recordType: 'Bonus' })), null);
  });
});

describe('held out of Earned, shown as needing review', () => {
  test('an adjustment with no parent is a problem; the balance is incomplete', () => {
    const s = sum([award({}), adj({ parentAwardKey: 'R9|Reached|Rep', amount: 25 })]);
    assert.equal(s.earned, 100);
    assert.equal(s.complete, false);
    assert.equal(s.needsReviewCount, 1);
    assert.equal(s.reviewText, '1 amount needs review.');
    assert.equal(s.lines.find((l) => l.what.startsWith('Adjustment')).status, 'Needs review');
  });

  test('an adjustment on a Void award is held (L4)', () => {
    const { problems } = checkLedger(sanitizeLedger([award({ status: 'Void', eligibility: 'Ineligible' }), adj({ amount: 25 })]));
    assert.deepEqual(problems.map((p) => p.rule), ['L4']);
  });

  test('adjustments that take an award below $0 are all held (L3)', () => {
    const s = sum([award({}), adj({ id: 'a', amount: -60 }), adj({ id: 'b', amount: -60 })]);
    assert.equal(s.earned, 100);
    assert.equal(s.needsReviewCount, 2);
    assert.equal(s.reviewText, '2 amounts need review.');
  });

  test('two awards with one key (L1), or two schema 2 awards for one lead and event (L5), are held', () => {
    assert.deepEqual(checkLedger(sanitizeLedger([award({}), award({})])).problems.map((p) => p.rule), ['L1', 'L1']);
    const l5 = checkLedger(sanitizeLedger([award({}), award({ awardKey: 'hand-made' })])).problems.map((p) => p.rule);
    assert.deepEqual(l5, ['L5', 'L5']);
  });

  test('a Held row, a blank Eligibility, or Ineligible on a Waiting row is not Earned', () => {
    for (const o of [{ eligibility: 'Held' }, { eligibility: '' }, { eligibility: 'Ineligible' }]) {
      const s = sum([award(o)]);
      assert.equal(s.earned, 0, JSON.stringify(o));
      assert.equal(s.complete, false);
    }
  });

  test('balance counts only Eligible rows that pass', () => {
    const { rows, problems } = checkLedger(sanitizeLedger([award({}), award({ referralId: 'R2', eligibility: 'Held', amount: 30 })]));
    assert.deepEqual(balance(rows, problems), { earned: 100, waiting: 100, paid: 0, pendingReview: 0, needsReview: 30, needsReviewCount: 1, complete: false });
  });

  test("the Track card and feed never count a held row", () => {
    const rows = sanitizeLedger([award({ eligibility: 'Held' })]);
    const refs = [{ id: 'R1', practiceName: 'TEST Office', sentOn: '2026-11-15', lines: [{ company: 'HealthFirst', status: 'Trying to reach', updatedOn: '2026-11-21' }] }];
    const out = moneyForReferrals(refs, rows, TODAY, null);
    assert.match(out.lines.R1, /\$100 needs review\.$/);
    assert.equal(out.feed.some((f) => /You earned/.test(f.label)), false);
  });
});

describe('roles', () => {
  test('a role other than Rep or Manager never counts and is counted as needing review', () => {
    const view = moneyView([], [v1({}), v1({ referralId: 'R2', payeeRole: 'Advisor' })], undefined);
    assert.equal(view.summary.earned, 100);
    assert.equal(view.summary.needsReviewCount, 1);
    // A Manager row in a rep's list is dropped silently, as on main.
    assert.equal('needsReviewCount' in moneyView([], [v1({}), v1({ payeeRole: 'Manager', event: 'Signed' })], undefined).summary, false);
  });

  test("My Team names a held amount after the rep's total, never inside it", () => {
    const member = { signedUp: true, name: 'Test Rep', registeredOn: '2026-11-01', referrals: [], rows: [award({}), adj({ parentAwardKey: 'nope', amount: 20 })] };
    const out = shapeTeam({ team: [member], managerRows: [] }, undefined, TODAY);
    assert.equal(out.team[0].money, 'Total earned $100. Paid $0. 1 amount needs review.');
    assert.deepEqual(out.team[0].awards, [{ office: 'TEST Office', company: 'HealthFirst', amount: '$100' }]);
  });
});
