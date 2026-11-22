// My Earnings shows each lead as Pending or Confirmed (Brian 11/22). Pending: an open
// HealthFirst or Direct Dental lead the rep sent with no ledger row yet, read from the same
// referral list Track draws from. Confirmed: a Waiting ledger row. Pending never changes a
// total. TEST rows only; nothing leaves the machine.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CONFIRMED_WAITING, sanitizeLedger, summarizeEarnings } from './rep-earnings.mjs';
import { parsePayPlan, parseStaffingPayPlan } from './rep-pay-plan.mjs';
import { moneyView } from './rep-reads.mjs';

const HF = /** @type {import('./rep-pay-plan.mjs').PayPlan} */ (parsePayPlan('reached:100,manager:50'));
const ST = /** @type {import('./rep-pay-plan.mjs').StaffingPayPlan} */ (parseStaffingPayPlan('reached_private:100,reached_group:100,manager:50'));
const PLANS = { healthFirst: HF, staffing: ST };
const STAFFING_SOLUTIONS = 'HS Staffing / Recruiting Services (including GoTu)';

const ref = (id, line, o = {}) => ({
  id,
  doctor: 'TEST Office Manager',
  practice: `TEST ${id}`,
  created: '2026-11-02',
  cases: line ? [{ updated: '2026-11-05', ...line }] : [],
  ...o,
});
const hfLine = (o = {}) => ({ company: 'HealthFirst', partnerStatus: '', ...o });
const stLine = (o = {}) => ({ company: STAFFING_SOLUTIONS, partnerStatus: '', practiceType: 'Private practice', ...o });
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

describe('My Earnings: Pending and Confirmed', () => {
  test('an open HealthFirst lead with no ledger row reads Pending, with no amount', () => {
    const s = summarizeEarnings([], [ref('H1', hfLine())], PLANS);
    assert.equal(s.lines.length, 0);
    assert.deepEqual(s.pendingLines, [
      {
        referralId: 'H1',
        on: '2026-11-02',
        label: 'Sent Nov 2. TEST H1. HealthFirst. Pending. $100 when HealthFirst reaches them and confirms the lead qualifies.',
        office: 'TEST H1',
        amount: '',
        company: 'HealthFirst',
        what: '',
        status: 'Pending. $100 when HealthFirst reaches them and confirms the lead qualifies.',
      },
    ]);
    assert.deepEqual([s.earned, s.waiting, s.paid, s.pendingReview], [0, 0, 0, 0], 'Pending never changes a total');
  });

  test('a lead with no Service Case yet is HealthFirst Pending, as Track reads it', () => {
    const s = summarizeEarnings([], [ref('N1', null)], PLANS);
    assert.equal(s.pendingLines[0].company, 'HealthFirst');
    assert.match(s.pendingLines[0].status, /^Pending\. /);
  });

  test('a Direct Dental lead reads Pending in staffing words, never HealthFirst', () => {
    const s = summarizeEarnings([], [ref('D1', stLine())], PLANS);
    assert.equal(s.pendingLines.length, 1);
    assert.equal(s.pendingLines[0].company, 'Direct Dental');
    assert.match(s.pendingLines[0].status, /^Pending\. \$100 .*when Direct Dental reaches the customer and confirms the lead qualifies\.$/);
    assert.doesNotMatch(JSON.stringify(s.pendingLines), /HealthFirst/);
  });

  test('a Direct Dental Pending line follows the plan and the practice type the rep picked ($200 group)', () => {
    const plans = { healthFirst: HF, staffing: parseStaffingPayPlan('reached_private:100,reached_group:200,manager:50') };
    const refs = [
      ref('G', stLine({ practiceType: 'Group' })),
      ref('P', stLine({ practiceType: 'Private practice' })),
      ref('U', stLine({ practiceType: '' })),
      ref('H', hfLine()),
    ];
    const by = Object.fromEntries(summarizeEarnings([], refs, plans).pendingLines.map((l) => [l.referralId, [l.company, l.status]]));
    assert.deepEqual(by.G, ['Direct Dental', 'Pending. $200 for a group when Direct Dental reaches the customer and confirms the lead qualifies.']);
    assert.deepEqual(by.P, ['Direct Dental', 'Pending. $100 for a private practice when Direct Dental reaches the customer and confirms the lead qualifies.']);
    assert.deepEqual(by.U, ['Direct Dental', 'Pending. $100 for a private practice, or $200 for a group, when Direct Dental reaches the customer and confirms the lead qualifies.']);
    assert.deepEqual(by.H, ['HealthFirst', 'Pending. $100 when HealthFirst reaches them and confirms the lead qualifies.']);
  });

  test('reached but not yet marked qualified still reads Pending, worded from the Track status', () => {
    const s = summarizeEarnings([], [ref('H2', hfLine({ partnerStatus: 'Meeting set' }))], PLANS);
    assert.equal(s.pendingLines[0].status, 'Pending. $100 when HealthFirst confirms the lead qualifies.');
  });

  test('a Waiting row reads Confirmed and the lead is not also Pending', () => {
    const rows = sanitizeLedger([row('H3')]);
    const s = summarizeEarnings(rows, [ref('H3', hfLine({ partnerStatus: 'Meeting set', qualified: 'Yes' }))], PLANS);
    assert.equal(s.pendingLines.length, 0);
    assert.equal(s.lines.length, 1);
    assert.equal(s.lines[0].status, CONFIRMED_WAITING);
    assert.equal(s.lines[0].status, 'Confirmed, awaiting payment');
    assert.equal(s.lines[0].amount, '$100');
    assert.deepEqual([s.earned, s.waiting, s.paid], [100, 100, 0]);
  });

  test('a lead with a row of any status has only that line (Pending review, Void, Paid)', () => {
    const rows = sanitizeLedger([
      row('A', { status: 'Pending review' }),
      row('B', { status: 'Void', voidReason: 'Already a customer' }),
      row('C', { status: 'Paid', paidOn: '2026-11-30' }),
    ]);
    const refs = ['A', 'B', 'C'].map((id) => ref(id, hfLine()));
    const s = summarizeEarnings(rows, refs, PLANS);
    assert.equal(s.pendingLines.length, 0);
    assert.deepEqual(s.lines.map((l) => l.status), ['Pending review', 'Not paid: Already a customer.', 'Paid on Nov 30']);
  });

  test('closed, signed, not qualified and other-partner leads are never Pending', () => {
    const refs = [
      ref('X1', hfLine({ partnerStatus: 'Not moving forward', qualified: 'No' })),
      ref('X2', hfLine(), { closed: true }),
      ref('X3', hfLine(), { signed: true }),
      ref('X4', hfLine({ qualified: 'No' })),
      ref('X5', { company: 'Some Other Partner', partnerStatus: '' }),
    ];
    assert.deepEqual(summarizeEarnings([], refs, PLANS).pendingLines, []);
  });

  test('Pending lines are newest sent first, and name the doctor when there is no practice', () => {
    const refs = [
      ref('P1', hfLine(), { created: '2026-11-03' }),
      ref('P2', stLine(), { created: '2026-11-20' }),
      ref('P3', hfLine(), { created: '2026-11-10', practice: '' }),
    ];
    const s = summarizeEarnings([], refs, PLANS);
    assert.deepEqual(s.pendingLines.map((l) => l.referralId), ['P2', 'P3', 'P1']);
    assert.equal(s.pendingLines[1].office, 'TEST Office Manager');
  });

  test('no plan: Pending says who it waits on, with no amount', () => {
    const s = summarizeEarnings([], [ref('Q1', hfLine())], null);
    assert.equal(s.pendingLines[0].status, 'Pending. Waiting on HealthFirst to confirm the lead qualifies.');
    assert.doesNotMatch(s.pendingLines[0].label, /\$/);
  });

  test('/api/earnings carries the Pending lines (moneyView), from the reads it already makes', () => {
    const view = moneyView([ref('R', hfLine())], [], HF, ST);
    assert.equal(view.summary.lines.length, 0);
    assert.equal(view.summary.pendingLines.length, 1);
    assert.equal(view.money.lines.R, '$100 when HealthFirst reaches them and confirms the lead qualifies.', 'Track card words unchanged');
  });
});
