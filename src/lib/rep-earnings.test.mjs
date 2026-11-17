import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, test } from 'node:test';
import {
  EMPTY_EARNINGS,
  dollars,
  managerPay,
  moneyForReferrals,
  moneyLine,
  sanitizeLedger,
  sanitizeLedgerRow,
  summarizeEarnings,
} from './rep-earnings.mjs';

const row = (o) => ({ referralId: 'R1', practiceName: 'North Side Dental', event: 'Reached', amount: 50, earnedOn: '2026-11-10', status: 'Waiting', payeeRole: 'Rep', ...o });
const ref = (o) => ({ id: 'R1', doctor: 'Ada', practice: 'North Side Dental', created: '2026-11-01', cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-10' }], ...o });

describe('ledger rows are checked, never guessed', () => {
  test('a good row passes', () => {
    assert.equal(sanitizeLedgerRow(row({}))?.amount, 50);
  });

  test('bad status, event, amount, date or a manager row is dropped', () => {
    for (const bad of [
      row({ status: 'Earned' }),
      row({ event: 'Called' }),
      row({ amount: -50 }),
      row({ amount: 0 }),
      row({ amount: 50.5 }),
      row({ amount: 5000 }),
      row({ amount: 'fifty' }),
      row({ earnedOn: 'yesterday' }),
      row({ referralId: '' }),
      row({ payeeRole: 'Manager' }),
      row({ status: 'Paid' }), // paid with no date
      null,
      'x',
    ]) {
      assert.equal(sanitizeLedgerRow(bad), null, JSON.stringify(bad));
    }
  });

  test('a Void row always carries a reason, even if 1F sent none', () => {
    assert.equal(sanitizeLedgerRow(row({ status: 'Void' })).voidReason, 'This award did not qualify');
    assert.equal(sanitizeLedgerRow(row({ status: 'Void', voidReason: 'Already a customer.. ' })).voidReason, 'Already a customer');
    assert.equal(moneyLine({}, sanitizeLedger([row({ status: 'Void', voidReason: 'Already a customer.' })])), 'Not paid: Already a customer.');
  });
});

describe('totals (D11: Earned = Waiting + Paid)', () => {
  const rows = sanitizeLedger([
    row({ status: 'Paid', paidOn: '2026-11-30' }),
    row({ referralId: 'R1', event: 'Signed', amount: 100, earnedOn: '2026-11-14', status: 'Waiting' }),
    row({ referralId: 'R2', practiceName: 'South Park Dental', status: 'Pending review', earnedOn: '2026-11-12' }),
    row({ referralId: 'R3', practiceName: 'East Dental', status: 'Void', voidReason: 'This office was referred to HealthFirst in the last 12 months.', earnedOn: '2026-11-11' }),
  ]);

  test('Pending review and Void are never in Earned', () => {
    const s = summarizeEarnings(rows, []);
    assert.deepEqual({ earned: s.earned, waiting: s.waiting, paid: s.paid, pendingReview: s.pendingReview }, { earned: 150, waiting: 100, paid: 50, pendingReview: 50 });
    assert.equal(s.earned, s.waiting + s.paid);
  });

  test('one line per row, newest first, status in words with the void reason', () => {
    const s = summarizeEarnings(rows, []);
    assert.deepEqual(s.lines.map((l) => l.referralId), ['R1', 'R2', 'R3', 'R1']);
    assert.match(s.lines[0].label, /^Nov 14\. North Side Dental\. HealthFirst\. Office signed\. \$100\. Earned, waiting to be paid\.$/);
    assert.match(s.lines[1].label, /Pending review\.$/);
    assert.match(s.lines[2].label, /Not paid: This office was referred to HealthFirst in the last 12 months\.$/);
    for (const l of s.lines) assert.equal(l.label.includes('..'), false, l.label);
    assert.match(s.lines[3].label, /Paid on Nov 30\.$/);
  });

  test('"Up to $X more" counts $100 per reached office not signed or closed', () => {
    const referrals = [ref({ id: 'R1' }), ref({ id: 'R2' }), ref({ id: 'R4', closed: true })];
    const reachedOnly = sanitizeLedger([
      row({ referralId: 'R1' }),
      row({ referralId: 'R2', status: 'Void', voidReason: 'x' }),
      row({ referralId: 'R4' }),
    ]);
    assert.equal(summarizeEarnings(reachedOnly, referrals).upTo, 100);
  });

  test('no rows: zero totals and the spec empty line exists', () => {
    const s = summarizeEarnings([], []);
    assert.deepEqual([s.earned, s.waiting, s.paid, s.pendingReview, s.upTo, s.lines.length], [0, 0, 0, 0, 0, 0]);
    assert.match(EMPTY_EARNINGS, /^\$0 so far\. Here's how you earn: \$50 when HealthFirst reaches/);
  });
});

describe('money line on each card (spec wording)', () => {
  const r = (o) => sanitizeLedger([row(o)]);

  test('sent, not reached yet', () => {
    assert.equal(moneyLine({}, []), '$50 when HealthFirst reaches them and confirms the lead qualifies. $100 more if they sign.');
  });
  test('reached', () => {
    assert.equal(moneyLine({}, r({})), '$50 earned Nov 10. $100 more if they sign.');
  });
  test('reached, auto, waiting for Brian (D10)', () => {
    assert.equal(moneyLine({}, r({ status: 'Pending review' })), "$50 pending review. HealthFirst hasn't confirmed contact yet.");
  });
  test('signed, part paid', () => {
    const rows = sanitizeLedger([row({ status: 'Paid', paidOn: '2026-11-30' }), row({ event: 'Signed', amount: 100, earnedOn: '2026-11-14' })]);
    assert.equal(moneyLine({ signed: true }, rows), '$150 earned. Paid $50 on Nov 30. $100 waiting to be paid.');
  });
  test("won't pay: the reason is always shown", () => {
    assert.equal(moneyLine({}, r({ status: 'Void', voidReason: 'This office was referred to HealthFirst in the last 12 months.' })), 'Not paid: This office was referred to HealthFirst in the last 12 months.');
  });
  test('closed with nothing earned says so, and a closed reached referral does not promise $100 more', () => {
    assert.equal(moneyLine({ closed: true }, []), 'Closed before any pay was earned.');
    assert.equal(moneyLine({ closed: true }, r({})), '$50 earned Nov 10.');
  });
  test('a paid award that is later disputed stays paid on the card (D3)', () => {
    const rows = sanitizeLedger([row({ status: 'Paid', paidOn: '2026-11-30', disputed: true })]);
    assert.equal(moneyLine({}, rows), '$50 earned Nov 10. Paid $50 on Nov 30. Disputed. $100 more if they sign.');
    assert.equal(summarizeEarnings(rows, []).paid, 50);
  });
});

describe('money for every card and the feed', () => {
  test('every referral gets a line; the feed has earned and paid events, not pending or void', () => {
    const rows = sanitizeLedger([
      row({ status: 'Paid', paidOn: '2026-11-30' }),
      row({ referralId: 'R2', status: 'Pending review' }),
      row({ referralId: 'R3', status: 'Void', voidReason: 'x' }),
    ]);
    const m = moneyForReferrals([ref({ id: 'R1' }), ref({ id: 'R2' }), ref({ id: 'R3' }), ref({ id: 'R5' })], rows);
    assert.deepEqual(Object.keys(m.lines).sort(), ['R1', 'R2', 'R3', 'R5']);
    assert.equal(m.lines.R5, '$50 when HealthFirst confirms the lead qualifies. $100 more if they sign.', 'Meeting set proves HealthFirst reached them (Codex P1 on #132)');
    assert.deepEqual(m.feed.map((f) => f.label).sort(), ['Nov 10. North Side Dental: HealthFirst reached the office. You earned $50.', 'Nov 30. Paid $50.']);
  });

  test('the Earned tile, My Earnings total and the ledger total agree to the dollar (test 14)', () => {
    const raw = [row({ status: 'Paid', paidOn: '2026-11-30' }), row({ event: 'Signed', amount: 100, status: 'Waiting' }), row({ referralId: 'R2', status: 'Pending review' })];
    const rows = sanitizeLedger(raw);
    const s = summarizeEarnings(rows, []);
    const ledgerTotal = rows.filter((x) => x.status === 'Waiting' || x.status === 'Paid').reduce((n, x) => n + x.amount, 0);
    assert.equal(s.earned, ledgerTotal);
    assert.equal(dollars(s.earned), '$150');
  });
});

function listen(handler) {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      process.env.FIELD_FLOW_URL = `http://127.0.0.1:${server.address().port}/flow`;
      // The field flow client posts nothing while the app is off.
      process.env.REP_APP_ENABLED = 'true';
      resolve(server);
    });
  });
}
const close = (server) => new Promise((resolve) => server.close(resolve));

describe('HSBS 1F earnings client', { concurrency: false }, () => {
  const KEY = `Rk_${'e'.repeat(30)}`;
  test('posts action earnings with the key and returns rows', async () => {
    const { listEarnings } = await import('./field-flow.mjs');
    let seen;
    const server = await listen(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      seen = JSON.parse(Buffer.concat(chunks).toString());
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ rows: [row({})] }));
    });
    try {
      assert.equal((await listEarnings(KEY)).length, 1);
      assert.deepEqual(seen, { action: 'earnings', referralKey: KEY });
    } finally {
      await close(server);
    }
  });
  test('404 is an unknown key; a body without rows is a failure', async () => {
    const { listEarnings, ReferralKeyUnknownError, ReferralAppWriteError } = await import('./field-flow.mjs');
    for (const [status, body, Err] of [[404, '', ReferralKeyUnknownError], [200, '{"ok":true}', ReferralAppWriteError], [200, '<html>', ReferralAppWriteError]]) {
      const server = await listen((_req, res) => {
        res.writeHead(status);
        res.end(body);
      });
      try {
        await assert.rejects(() => listEarnings(KEY), Err);
      } finally {
        await close(server);
      }
    }
  });
});

describe('slice 4 review fixes', () => {
  const ledger = (...rows) => sanitizeLedger(rows);

  test('a voided Signed award shows its reason next to a paying row, and promises no more $100', () => {
    const rows = ledger(
      row({ status: 'Paid', paidOn: '2026-11-30' }),
      row({ event: 'Signed', amount: 100, status: 'Void', voidReason: 'Already a customer', earnedOn: '2026-11-14' }),
    );
    const line = moneyForReferrals([ref({ signed: true })], rows).lines.R1;
    assert.equal(line, '$50 earned Nov 10. Paid $50 on Nov 30. Not paid: Already a customer.');
    // Even when the referral itself isn't flagged signed, the voided Signed row settles it.
    assert.equal(moneyForReferrals([ref({})], rows).lines.R1, '$50 earned Nov 10. Paid $50 on Nov 30. Not paid: Already a customer.');
  });

  test('signed or closed from the line status counts the same as the flag, on the card and in "Up to"', () => {
    const rows = ledger(
      row({ referralId: 'A' }),
      row({ referralId: 'B' }),
      row({ referralId: 'C' }),
    );
    const refs = [
      ref({ id: 'A', cases: [{ company: 'HealthFirst', partnerStatus: 'Signed', updated: '2026-11-12' }] }),
      ref({ id: 'B', cases: [{ company: 'HealthFirst', partnerStatus: 'Not moving forward', updated: '2026-11-12' }] }),
      ref({ id: 'C' }),
    ];
    assert.equal(summarizeEarnings(rows, refs).upTo, 100, 'only C is still open');
    const lines = moneyForReferrals(refs, rows).lines;
    assert.equal(lines.A, '$50 earned Nov 10.');
    assert.equal(lines.B, '$50 earned Nov 10.');
    assert.equal(lines.C, '$50 earned Nov 10. $100 more if they sign.');
  });

  test('a signed office with no ledger rows yet is not told it can still earn', () => {
    assert.equal(moneyForReferrals([ref({ signed: true })], []).lines.R1, "Signed. Earnings follow HealthFirst's updates.");
  });

  test('a paying event is one feed line with the dollars on it', () => {
    const refs = [ref({ history: [{ on: '2026-11-10', text: 'Talked with the doctor' }] })];
    const feed = moneyForReferrals(refs, ledger(row({})), '2026-11-11').feed.filter((f) => f.referralId === 'R1' && f.on === '2026-11-10');
    assert.equal(feed.length, 1, JSON.stringify(feed));
    assert.equal(feed[0].label, 'Nov 10. North Side Dental: HealthFirst talked with the doctor. You earned $50.');
  });

  test('a payment with no status line that day still gets its own line', () => {
    const feed = moneyForReferrals([ref({ history: [] })], ledger(row({})), '2026-11-11').feed;
    assert.ok(feed.some((f) => f.label === 'Nov 10. North Side Dental: HealthFirst reached the office. You earned $50.'));
  });

  test('a timestamp or an impossible date drops the row instead of being cut to a day', () => {
    for (const earnedOn of ['2026-11-10T23:30:00Z', '2026-11-10 08:00', '2026-02-30', '2026-13-01']) {
      assert.equal(sanitizeLedgerRow(row({ earnedOn })), null, earnedOn);
    }
    assert.equal(sanitizeLedgerRow(row({ status: 'Paid', paidOn: '2026-11-30T05:00:00Z' })), null);
  });
});

describe('feed money joins real Status Log lines', () => {
  const ledger = (...rows) => sanitizeLedger(rows);

  test('"HealthFirst: Signed" takes the $100, and the same-day $50 goes on the talked line', () => {
    const refs = [
      ref({
        history: [
          { on: '2026-11-03', text: 'Sent to HealthFirst' },
          { on: '2026-11-14', text: 'HealthFirst: Talked with the doctor' },
          { on: '2026-11-14', text: 'HealthFirst: Signed. Two-year kit plan.' },
        ],
      }),
    ];
    const rows = ledger(row({ earnedOn: '2026-11-14' }), row({ event: 'Signed', amount: 100, earnedOn: '2026-11-14' }));
    const nov14 = moneyForReferrals(refs, rows, '2026-11-15').feed.filter((f) => f.on === '2026-11-14').map((f) => f.label);
    assert.equal(nov14.length, 2, JSON.stringify(nov14));
    // The feed speaks Track's plain words (Brian, 11/9): signed reads "Signed and billed".
    assert.ok(nov14.includes('Nov 14. North Side Dental: Signed and billed. You earned $100.'), JSON.stringify(nov14));
    assert.ok(nov14.includes('Nov 14. North Side Dental: HealthFirst talked with the doctor. You earned $50.'), JSON.stringify(nov14));
  });

  test('a Reached $50 never lands on a signed line', () => {
    const refs = [ref({ history: [{ on: '2026-11-14', text: 'HealthFirst: Signed' }] })];
    const feed = moneyForReferrals(refs, ledger(row({ earnedOn: '2026-11-14' })), '2026-11-15').feed;
    assert.ok(feed.some((f) => f.label === 'Nov 14. North Side Dental: Signed and billed.'), JSON.stringify(feed));
    assert.ok(feed.some((f) => f.label === 'Nov 14. North Side Dental: HealthFirst reached the office. You earned $50.'), JSON.stringify(feed));
  });
});

describe('codex review on #46', () => {
  const ledger = (...rows) => sanitizeLedger(rows);

  test('every ledger row counts, however many there are', () => {
    const many = Array.from({ length: 2001 }, (_, i) => row({ referralId: `R${i}` }));
    assert.equal(summarizeEarnings(sanitizeLedger(many), []).earned, 2001 * 50);
  });

  test('a partner update that reports talked and signed is one line carrying both awards', () => {
    const text = 'HealthFirst: Talked with the doctor on Nov 14, 2026. Signed on Nov 14, 2026: kit plan.';
    const refs = [ref({ history: [{ on: '2026-11-14', text }] })];
    const rows = ledger(row({ earnedOn: '2026-11-14' }), row({ event: 'Signed', amount: 100, earnedOn: '2026-11-14' }));
    const nov14 = moneyForReferrals(refs, rows, '2026-11-15').feed.filter((f) => f.on === '2026-11-14');
    assert.deepEqual(nov14.map((f) => f.label), ['Nov 14. North Side Dental: HealthFirst talked with the doctor. Signed and billed. You earned $150.']);
  });

  test('a paid Reached award says when it was paid on the card', () => {
    const rows = ledger(row({ status: 'Paid', paidOn: '2026-11-30' }));
    assert.equal(moneyForReferrals([ref({})], rows).lines.R1, '$50 earned Nov 10. Paid $50 on Nov 30. $100 more if they sign.');
  });
});

describe('slice 5: manager rows (My Team)', () => {
  const mrow = (o) => row({ payeeRole: 'Manager', event: 'Signed', repEmail: 'Test.Rep@henryschein.com', ...o });

  test('the default path still drops every Manager row, so My Earnings can never count one', () => {
    assert.equal(sanitizeLedgerRow(mrow({})), null);
    assert.equal(sanitizeLedgerRow(mrow({}), 'Rep'), null);
    assert.deepEqual(sanitizeLedger([mrow({}), mrow({ status: 'Paid', paidOn: '2026-11-30' })]), []);
    // The Rep path's output is unchanged: no repEmail key on a rep's own row.
    assert.deepEqual(Object.keys(sanitizeLedgerRow(row({ repEmail: 'x@henryschein.com' }))).sort(), [
      'amount', 'company', 'disputed', 'earnedOn', 'event', 'paidOn', 'practiceName', 'practiceType', 'referralId', 'status', 'voidReason',
    ]);
    const s = summarizeEarnings(sanitizeLedger([row({}), mrow({ amount: 50 })]), []);
    assert.equal(s.earned, 50);
  });

  test("sanitizeLedger(list, 'Manager') keeps only Manager Signed rows", () => {
    const kept = sanitizeLedger(
      [
        mrow({}),
        row({}),
        row({ payeeRole: undefined }),
        mrow({ event: 'Reached' }),
        mrow({ payeeRole: 'manager' }),
        mrow({ amount: 0 }),
        mrow({ status: 'Paid' }), // no paid date
      ],
      'Manager',
    );
    assert.equal(kept.length, 1);
    assert.equal(kept[0].repEmail, 'test.rep@henryschein.com');
    assert.equal(kept[0].event, 'Signed');
  });

  test('managerPay: Earned = Waiting + Paid, exact lines newest first, a former member, no upTo', () => {
    const rows = sanitizeLedger(
      [
        mrow({ earnedOn: '2026-11-14', status: 'Waiting' }),
        mrow({ earnedOn: '2026-11-13', status: 'Paid', paidOn: '2026-11-30' }),
        mrow({ earnedOn: '2026-11-12', practiceName: 'East Dental', status: 'Void', voidReason: 'this office was referred to HealthFirst in the last 12 months' }),
        mrow({ earnedOn: '2026-11-11', practiceName: '', status: 'Pending review' }),
        mrow({ earnedOn: '2026-11-10', repEmail: 'gone@henryschein.com', status: 'Waiting' }),
      ],
      'Manager',
    );
    const mp = managerPay(rows, new Map([['test.rep@henryschein.com', 'Test Rep']]));
    assert.deepEqual(Object.keys(mp).sort(), ['earned', 'lines', 'paid', 'pendingReview', 'waiting']);
    assert.equal('upTo' in mp, false);
    assert.deepEqual({ earned: mp.earned, waiting: mp.waiting, paid: mp.paid, pendingReview: mp.pendingReview }, { earned: 150, waiting: 100, paid: 50, pendingReview: 50 });
    assert.deepEqual(mp.lines.map((l) => l.label), [
      'Nov 14. North Side Dental. HealthFirst, signed. Test Rep. $50. Earned, waiting to be paid.',
      'Nov 13. North Side Dental. HealthFirst, signed. Test Rep. $50. Paid on Nov 30.',
      'Nov 12. East Dental. HealthFirst, signed. Test Rep. $50. Not paid: this office was referred to HealthFirst in the last 12 months.',
      'Nov 11. Office. HealthFirst, signed. Test Rep. $50. Pending review.',
      'Nov 10. North Side Dental. HealthFirst, signed. A former team member. $50. Earned, waiting to be paid.',
    ]);
    assert.equal(managerPay(rows, /** @type {any} */ (undefined)).lines[0].label.includes('A former team member'), true);
  });
});
