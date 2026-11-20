import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parsePayPlan } from './rep-pay-plan.mjs';
import { moneyForReferrals, sanitizeLedger, summarizeEarnings } from './rep-earnings.mjs';
import { ReferralAppWriteError } from './field-flow.mjs';
import { shapeTeam } from './rep-team.mjs';

const TODAY = '2026-11-20';
const V3 = parsePayPlan('reached:50,signed:100,manager:50');
const CLOSED_WON = parsePayPlan('signed:150');
const DRAFT = parsePayPlan('signed:150,manager:50');
const TOKEN = 'a'.repeat(64);

// Everything a manager must never see, planted on every kind of row.
const SECRET = {
  doctorName: 'Dr. Secret',
  doctorPhone: '303-555-0199',
  doctorEmail: 'secret.doctor@example.com',
  notes: 'Private note about the office',
  detail: 'Talked with Dr. Secret',
  history: 'History says Dr. Secret called',
  memberEmail: 'test.rep@henryschein.com',
  newEmail: 'test.rep2@henryschein.com',
  mobile: '303-555-0142',
  branch: 'Denver Branch',
  key: `Rk_${'q'.repeat(30)}`,
};

const referral = (o) => ({
  id: 'R1',
  doctorName: SECRET.doctorName,
  doctorPhone: SECRET.doctorPhone,
  doctorEmail: SECRET.doctorEmail,
  notes: SECRET.notes,
  practiceName: 'North Side Dental',
  sentOn: '2026-11-03',
  route: 'Partner',
  referralKey: SECRET.key,
  lines: [{ company: 'HealthFirst', status: 'Meeting set', detail: SECRET.detail, updatedOn: '2026-11-04' }],
  history: [{ on: '2026-11-03', text: SECRET.history }],
  reached: true,
  ...o,
});
const repRow = (o) => ({ referralId: 'R1', practiceName: 'North Side Dental', event: 'Reached', payeeRole: 'Rep', amount: 50, earnedOn: '2026-11-10', status: 'Waiting', ...o });
const mgrRow = (o) => ({ referralId: 'R2', practiceName: 'North Side Dental', event: 'Signed', payeeRole: 'Manager', amount: 50, earnedOn: '2026-11-14', status: 'Waiting', repEmail: SECRET.memberEmail, ...o });

function fixture(o = {}) {
  return {
    team: [
      {
        signedUp: true,
        name: 'Test Rep',
        email: SECRET.memberEmail,
        role: 'AE',
        registeredOn: '2026-11-02',
        mobile: SECRET.mobile,
        referralKey: SECRET.key,
        referrals: [
          referral({}),
          referral({ id: 'R2', sentOn: '2026-11-09', lines: [{ company: 'HealthFirst', status: 'Signed', detail: SECRET.detail, updatedOn: '2026-11-14' }], reached: false }),
          referral({ id: 'R3', practiceName: '', sentOn: '2026-11-05', reached: 'true' }),
        ],
        rows: [
          repRow({}),
          repRow({ referralId: 'R2', event: 'Signed', amount: 100, earnedOn: '2026-11-14', status: 'Paid', paidOn: '2026-11-18' }),
          // A manager row in a rep's rows never counts for the rep.
          mgrRow({ referralId: 'R1' }),
        ],
      },
      {
        signedUp: true,
        name: 'Quiet Rep',
        email: 'quiet.rep@henryschein.com',
        role: 'Ninja',
        registeredOn: '2026-11-06', // 14 days before TODAY
        referrals: [],
        rows: [],
      },
      {
        signedUp: true,
        name: 'New Rep',
        email: 'new.rep@henryschein.com',
        role: 'Manager',
        registeredOn: '2026-11-07', // 13 days before TODAY
        referrals: [],
        rows: [],
      },
      // Not signed up yet (D4, D18). The contract sends only signedUp and name; every
      // other field here is planted and must never reach the browser or count.
      {
        signedUp: false,
        name: 'TEST Rep2',
        email: SECRET.newEmail,
        mobile: SECRET.mobile,
        branch: SECRET.branch,
        registeredOn: '2026-11-06',
        confirmToken: TOKEN,
        confirmed: false,
        paired: false,
        referrals: [referral({ id: 'W1' })],
        rows: [repRow({ referralId: 'W1', amount: 999 })],
      },
      { signedUp: false, name: 'Old Rep' },
      { signedUp: false, name: 'Bad <Name>' },
    ],
    managerRows: [mgrRow({}), mgrRow({ earnedOn: '2026-11-15', repEmail: 'gone@henryschein.com', status: 'Paid', paidOn: '2026-11-30' }), mgrRow({ event: 'Reached' })],
    ...o,
  };
}

const hasNoSecret = (out) => {
  const text = JSON.stringify(out);
  for (const v of [...Object.values(SECRET), TOKEN, 'quiet.rep@henryschein.com', 'gone@henryschein.com', 'confirmToken', 'confirmed', 'paired', 'email', 'Dr.', '"ref"', 'canAnswer', '"waiting"']) {
    assert.equal(text.includes(v), false, `leaked ${v}`);
  }
};

describe('My Team shaping (slice 5, D4, D16, D18)', () => {
  test('no secret leaves the server, with pay on or off', () => {
    for (const plan of [V3, CLOSED_WON, DRAFT, null]) hasNoSecret(shapeTeam(fixture(), plan, TODAY));
  });

  test('the answer has tiles, team, notSignedUp and (pay on) own; no waiting list and no confirm field', () => {
    assert.deepEqual(Object.keys(shapeTeam(fixture(), null, TODAY)), ['tiles', 'team', 'notSignedUp']);
    assert.deepEqual(Object.keys(shapeTeam(fixture(), V3, TODAY)), ['tiles', 'team', 'notSignedUp', 'own']);
    const text = JSON.stringify(shapeTeam(fixture(), V3, TODAY));
    // "confirms the lead qualifies" is a pay promise (field two-track spec section 6), not a manager confirm.
    assert.equal(/confirm(?!s the lead qualifies)|paired|approv|waiting to confirm|not my team/i.test(text), false, text);
  });

  test('a rep not signed up yet is exactly { name }, sorted by name; a name that fails the rule shows as "A team member"', () => {
    for (const plan of [V3, DRAFT, null]) {
      const { notSignedUp } = shapeTeam(fixture(), plan, TODAY);
      assert.deepEqual(notSignedUp, [{ name: 'A team member' }, { name: 'Old Rep' }, { name: 'TEST Rep2' }]);
      for (const n of notSignedUp) assert.deepEqual(Object.keys(n), ['name']);
    }
  });

  test('a roster name with a comma, parentheses or an ampersand never drops a rep from the list', () => {
    const team = ['Smith, John', 'Jo (Joey) Ruiz', 'A & B'].map((name) => ({ signedUp: false, name }));
    const { notSignedUp } = shapeTeam({ team, managerRows: [] }, null, TODAY);
    assert.deepEqual(notSignedUp, [{ name: 'A team member' }, { name: 'A team member' }, { name: 'A team member' }]);
    // The same name on a signed-up rep shows the same way.
    const signed = shapeTeam({ team: [{ signedUp: true, name: 'Smith, John', email: 'test.smith@henryschein.com', referrals: [] }], managerRows: [] }, null, TODAY);
    assert.equal(JSON.stringify(signed).includes('Smith, John'), false);
    assert.equal(JSON.stringify(signed).includes('A team member'), true);
  });

  test('tiles count signed-up reps only; a rep not signed up yet never counts, whatever it carries', () => {
    const out = shapeTeam(fixture(), V3, TODAY);
    assert.deepEqual(out.tiles, { referrals: 3, signed: 1, earned: '$150', paid: '$100' });
    assert.deepEqual(out.team.map((m) => m.name), ['Test Rep', 'New Rep', 'Quiet Rep']);
  });

  test('reached counts only reached === true, never a signed status', () => {
    const rep = shapeTeam(fixture(), V3, TODAY).team.find((m) => m.name === 'Test Rep');
    assert.equal(rep.counts, '3 referrals. 1 reached. 1 signed.');
    assert.equal(rep.head, 'Test Rep. AE. Joined Nov 2.');
    assert.equal(rep.money, 'Earned $150. Paid $100.');
    assert.equal(rep.last, 'Last referral Nov 9.');
    assert.equal(rep.nudge, false);
  });

  test('13 days with no referral is no nudge; 14 is "No referral yet."', () => {
    const team = shapeTeam(fixture(), null, TODAY).team;
    const quiet = team.find((m) => m.name === 'Quiet Rep');
    const fresh = team.find((m) => m.name === 'New Rep');
    assert.equal(quiet.nudge, true);
    assert.equal(quiet.last, 'No referral yet.');
    assert.equal(quiet.head, 'Quiet Rep. Joined Nov 6.'); // a role off the list is left out
    assert.equal(fresh.nudge, false);
    assert.equal(fresh.last, '');
    assert.equal(fresh.head, 'New Rep. Manager. Joined Nov 7.');
    assert.equal(fresh.counts, '0 referrals. 0 reached. 0 signed.');
  });

  test('one referral reads "1 referral"', () => {
    const raw = fixture();
    raw.team[0].referrals = raw.team[0].referrals.slice(0, 1);
    assert.match(shapeTeam(raw, null, TODAY).team[0].counts, /^1 referral\. /);
  });

  test('sort is most referrals first, then by name, and ids follow the order', () => {
    const team = shapeTeam(fixture(), null, TODAY).team;
    assert.deepEqual(team.map((m) => m.name), ['Test Rep', 'New Rep', 'Quiet Rep']);
    assert.deepEqual(team.map((m) => m.id), ['m0', 'm1', 'm2']);
  });

  test('pay off: no dollar sign, and no money, earned, paid or own key', () => {
    const out = shapeTeam(fixture(), null, TODAY);
    const text = JSON.stringify(out);
    assert.equal(text.includes('$'), false);
    assert.equal('own' in out, false);
    assert.deepEqual(Object.keys(out.tiles), ['referrals', 'signed']);
    for (const m of out.team) {
      assert.equal('money' in m, false);
      for (const c of m.cards) assert.equal('money' in c, false);
    }
    assert.equal(/"(money|earned|paid|own)"/.test(text), false);
  });

  test("a rep's referrals are the rep's own Track rows and lead screens, manager view (Brian, 11/9)", () => {
    const rep = shapeTeam(fixture(), V3, TODAY).team[0];
    assert.equal(rep.cards.length, 3);
    for (const c of rep.cards) {
      // No contact and no partner update on this tab, ever.
      assert.deepEqual(Object.keys(c), ['id', 'office', 'sentLabel', 'company', 'chip', 'tone', 'stale', 'steps', 'money']);
      for (const st of c.steps) assert.deepEqual(Object.keys(st), ['on', 'label']);
    }
    assert.deepEqual(rep.cards.map((c) => c.id), ['c0', 'c1', 'c2']);
    assert.deepEqual(rep.cards.map((c) => c.office), ['North Side Dental', 'Office', 'North Side Dental']);
    assert.deepEqual(rep.cards.map((c) => [c.sentLabel, c.chip, c.tone]), [
      ['Sent Nov 9', 'Signed and billed', 'signed'],
      ['Sent Nov 5', 'Meeting set', 'open'],
      ['Sent Nov 3', 'Meeting set', 'open'],
    ]);
    assert.equal(rep.cards[0].stale, '');
    assert.equal(rep.cards[2].stale, 'No update in 16 days.');
    // The Status Log line names the doctor and maps to no step: it is left out.
    assert.deepEqual(rep.cards[2].steps, [
      { on: 'Nov 3', label: 'Sent to HealthFirst' },
      { on: 'Nov 4', label: 'Meeting set' },
    ]);
    assert.deepEqual(rep.cards[0].steps, [
      { on: 'Nov 9', label: 'Sent to HealthFirst' },
      { on: 'Nov 14', label: 'Signed and billed' },
    ]);
  });

  test("a rep's lead screen uses the rep's own plain words; known Status Log lines show with their dates", () => {
    const raw = fixture();
    raw.team[0].referrals = [
      referral({
        lines: [{ company: 'HealthFirst', status: 'Not yet, still trying', detail: SECRET.detail, updatedOn: '2026-11-06' }],
        history: [
          { on: '2026-11-03', text: 'Sent to HealthFirst' },
          { on: '2026-11-06', text: 'HealthFirst: Not yet, still trying. Last try Nov 6, 2026 by call.' },
          { on: '2026-11-05', text: SECRET.history },
        ],
      }),
    ];
    const [card] = shapeTeam(raw, null, TODAY).team[0].cards;
    assert.equal(card.chip, 'HealthFirst is reaching out');
    assert.deepEqual(card.steps, [
      { on: 'Nov 3', label: 'Sent to HealthFirst' },
      { on: 'Nov 6', label: 'HealthFirst is reaching out' },
    ]);
    assert.equal('money' in card, false);
  });

  test("each card's money equals that rep's own moneyForReferrals, and manager rows never change it", () => {
    for (const plan of [V3, CLOSED_WON]) {
      const raw = fixture();
      const m = raw.team[0];
      const own = moneyForReferrals(m.referrals, sanitizeLedger(m.rows), TODAY, plan).lines;
      const sum = summarizeEarnings(sanitizeLedger(m.rows), m.referrals, plan);
      const rep = shapeTeam(raw, plan, TODAY).team[0];
      assert.deepEqual(rep.cards.map((c) => c.money), ['R2', 'R3', 'R1'].map((id) => own[id]));
      assert.equal(rep.money, `Earned $${sum.earned}. Paid $${sum.paid}.`);
      const more = fixture({ managerRows: [...fixture().managerRows, mgrRow({ amount: 500 })] });
      assert.equal(shapeTeam(more, plan, TODAY).team[0].money, rep.money);
      assert.equal(shapeTeam(more, plan, TODAY).tiles.earned, shapeTeam(raw, plan, TODAY).tiles.earned);
    }
  });

  test('own pay: sentence and lines with the rep name or a former member, and no note', () => {
    const { own } = shapeTeam(fixture(), V3, TODAY);
    assert.deepEqual(own, {
      sentence: "You've earned $100 from your team's signed offices. Paid $50. Waiting $50.",
      lines: [
        'Nov 15. North Side Dental. HealthFirst, signed. A former team member. $50. Paid on Nov 30.',
        'Nov 14. North Side Dental. HealthFirst, signed. Test Rep. $50. Earned, waiting to be paid.',
      ],
    });
  });

  test('manager pay (blocker 4): Pending review and Void rows add nothing; Void says why; a former member still counts', () => {
    const raw = fixture({
      managerRows: [
        // The sign run never writes Pending review (D18), but one still counts nothing.
        mgrRow({ referralId: 'R5', earnedOn: '2026-11-16', status: 'Pending review' }),
        // A later no-pay check voided it (D12, D7). The rep is on the team now, so it shows.
        mgrRow({ referralId: 'R6', earnedOn: '2026-11-17', status: 'Void', voidReason: 'this office was referred to HealthFirst in the last 12 months' }),
        // A rep who has since moved to another manager: the row stays, and counts.
        mgrRow({ referralId: 'R7', earnedOn: '2026-11-12', repEmail: 'moved.rep@henryschein.com', status: 'Paid', paidOn: '2026-11-19' }),
      ],
    });
    const { own } = shapeTeam(raw, V3, TODAY);
    assert.equal(own.sentence, "You've earned $50 from your team's signed offices. Paid $50. Waiting $0.");
    assert.deepEqual(own.lines, [
      'Nov 17. North Side Dental. HealthFirst, signed. Test Rep. $50. Not paid: this office was referred to HealthFirst in the last 12 months.',
      'Nov 16. North Side Dental. HealthFirst, signed. Test Rep. $50. Pending review.',
      'Nov 12. North Side Dental. HealthFirst, signed. A former team member. $50. Paid on Nov 19.',
    ]);
    // The rep's own tiles never move for a manager row of any status.
    assert.deepEqual(shapeTeam(raw, V3, TODAY).tiles, shapeTeam(fixture({ managerRows: [] }), V3, TODAY).tiles);
    assert.equal(JSON.stringify(own).includes('moved.rep'), false);
  });

  test('D4: a Void or Pending review row for a rep not on this team now shows no office; earned history still shows', () => {
    const notConfirmed = 'gone.rep@henryschein.com';
    const raw = fixture({
      managerRows: [
        mgrRow({ referralId: 'R8', earnedOn: '2026-11-18', repEmail: notConfirmed, practiceName: 'Hidden Dental', status: 'Void', voidReason: "not on this manager's team roster when the office signed" }),
        mgrRow({ referralId: 'R9', earnedOn: '2026-11-19', repEmail: notConfirmed, practiceName: 'Hidden Dental', status: 'Pending review' }),
        mgrRow({ referralId: 'R7', earnedOn: '2026-11-12', repEmail: notConfirmed, status: 'Paid', paidOn: '2026-11-19' }),
      ],
    });
    const { own } = shapeTeam(raw, V3, TODAY);
    assert.deepEqual(own.lines, ['Nov 12. North Side Dental. HealthFirst, signed. A former team member. $50. Paid on Nov 19.']);
    assert.equal(JSON.stringify(own).includes('Hidden Dental'), false);
    assert.equal(own.sentence, "You've earned $50 from your team's signed offices. Paid $50. Waiting $0.");
    // Only $0 rows for that rep: no lines, and the none-yet sentence.
    const onlyVoid = fixture({ managerRows: [raw.managerRows[0]] });
    assert.deepEqual(shapeTeam(onlyVoid, V3, TODAY).own.lines, []);
  });

  test('manager pay (blocker 4): a plan with no manager award and no manager rows shows no own-pay block', () => {
    for (const plan of [CLOSED_WON, parsePayPlan('reached:50,signed:100')]) {
      const out = shapeTeam(fixture({ managerRows: [] }), plan, TODAY);
      assert.equal('own' in out, false);
      assert.equal(/You've earned|manager pay/.test(JSON.stringify(out)), false);
    }
  });

  test('own pay: none yet says what each sign earns, with no approval field or note', () => {
    for (const plan of [V3, DRAFT, parsePayPlan('signed:150,manager:75')]) {
      const raw = fixture({ managerRows: [] });
      assert.equal('approved' in raw, false);
      const { own } = shapeTeam(raw, plan, TODAY);
      assert.deepEqual(own, {
        sentence: `You've earned $0 from your team's signed offices so far. You earn $${plan.manager} each time an office your team sent signs.`,
        lines: [],
      });
    }
    // A stray approved field from an older flow changes nothing.
    for (const approved of [false, true, 'no']) {
      assert.deepEqual(shapeTeam(fixture({ managerRows: [], approved }), V3, TODAY).own, shapeTeam(fixture({ managerRows: [] }), V3, TODAY).own);
      assert.deepEqual(shapeTeam(fixture({ approved }), V3, TODAY).own, shapeTeam(fixture(), V3, TODAY).own);
    }
    assert.equal(/approv/i.test(JSON.stringify(shapeTeam(fixture({ approved: false }), V3, TODAY))), false);
  });

  test('a plan with no manager award shows own pay only when there are manager rows', () => {
    assert.equal('own' in shapeTeam(fixture({ managerRows: [] }), CLOSED_WON, TODAY), false);
    const { own } = shapeTeam(fixture(), CLOSED_WON, TODAY);
    assert.match(own.sentence, /^You've earned \$100 /);
  });

  test('manager pay (D18): the no-manager Void row has a blank payee, so it never reaches a team read; if one did, it adds nothing', () => {
    const raw = fixture({
      managerRows: [mgrRow({ referralId: 'R8', earnedOn: '2026-11-18', status: 'Void', voidReason: 'no manager on the team roster when the office signed' })],
    });
    const { own } = shapeTeam(raw, DRAFT, TODAY);
    assert.equal(own.sentence, "You've earned $0 from your team's signed offices. Paid $0. Waiting $0.");
    assert.deepEqual(own.lines, ['Nov 18. North Side Dental. HealthFirst, signed. Test Rep. $50. Not paid: no manager on the team roster when the office signed.']);
  });

  test('draft plan (Brian, 11/9): My Team says $50 per sign, rows and tiles count only the ledger', () => {
    const none = shapeTeam(fixture({ managerRows: [] }), DRAFT, TODAY);
    assert.equal(none.own.sentence, "You've earned $0 from your team's signed offices so far. You earn $50 each time an office your team sent signs.");
    const out = shapeTeam(fixture(), DRAFT, TODAY);
    assert.deepEqual(out.tiles, shapeTeam(fixture(), V3, TODAY).tiles);
    const rep = out.team[0];
    // R3 is open with nothing earned: the draft plan promises only the sign.
    assert.equal(rep.cards[1].money, '$150 if they sign.');
    assert.equal(/reach/i.test(rep.cards.map((c) => c.money).join(' ')), false);
  });

  test('a signed-up rep with no referrals list, or no rows list with pay on, is a failed load, never $0', () => {
    const base = { signedUp: true, name: 'Test Rep', email: SECRET.memberEmail, registeredOn: '2026-10-01', referrals: [referral({})], rows: [repRow({ status: 'Paid', paidOn: '2026-11-18' })] };
    const fails = (m, plan) =>
      assert.throws(
        () => shapeTeam({ team: [m], managerRows: [] }, plan, TODAY),
        (err) => err instanceof ReferralAppWriteError && err.status === 200,
      );
    for (const bad of [null, undefined, 'x', {}]) {
      fails({ ...base, rows: bad }, V3);
      fails({ ...base, referrals: bad }, V3);
      fails({ ...base, referrals: bad }, null);
    }
    const { rows: _rows, ...noRows } = base;
    fails(noRows, V3);
    // With pay off the rows are never read, so a missing list is no failure.
    assert.equal(shapeTeam({ team: [noRows], managerRows: [] }, null, TODAY).team.length, 1);
    // A rep not signed up yet never carries either list.
    assert.deepEqual(shapeTeam({ team: [{ signedUp: false, name: 'TEST Rep2' }], managerRows: [] }, V3, TODAY).notSignedUp, [{ name: 'TEST Rep2' }]);
  });

  test('an entry whose signedUp is not a JSON boolean, a non-object entry, or a nameless new rep is a failed load', () => {
    const fails = (entry) =>
      assert.throws(
        () => shapeTeam({ team: [{ signedUp: true, name: 'Test Rep', referrals: [], rows: [] }, entry], managerRows: [] }, V3, TODAY),
        (err) => err instanceof ReferralAppWriteError && err.status === 200,
        JSON.stringify(entry),
      );
    for (const signedUp of [undefined, null, 'true', 'false', 1, 0]) fails({ signedUp, name: 'TEST Rep2' });
    // The old confirm shape is not a team entry any more.
    fails({ confirmed: true, name: 'Test Rep', referrals: [], rows: [] });
    for (const entry of [null, 1, 'a', []]) fails(entry);
    for (const name of [undefined, '', '   ', 42, null]) fails({ signedUp: false, name });
  });

  test('an answer with no team list shapes to an empty team (listTeam refuses it first)', () => {
    for (const raw of [null, undefined, 'x', [], {}, { team: 'x', managerRows: 'y' }, { team: [], managerRows: [null] }]) {
      const out = shapeTeam(raw, V3, TODAY);
      assert.deepEqual(out.tiles, { referrals: 0, signed: 0, earned: '$0', paid: '$0' });
      assert.deepEqual(out.team, []);
      assert.deepEqual(out.notSignedUp, []);
    }
  });

  test('over 200 members is a failed load, never a team cut short; every referral per member counts', () => {
    const rep = { signedUp: true, name: 'Test Rep', registeredOn: '2026-11-01', referrals: [], rows: [] };
    assert.equal(shapeTeam({ team: Array.from({ length: 200 }, () => rep), managerRows: [] }, null, TODAY).team.length, 200);
    // The 201st rep has paid money: cutting it would undercount Team earned and Team paid.
    const paid = { ...rep, name: 'Last Rep', referrals: [referral({ id: 'R9' })], rows: [repRow({ referralId: 'R9', status: 'Paid', paidOn: '2026-11-18' })] };
    const many = [...Array.from({ length: 200 }, () => ({ signedUp: false, name: 'TEST Rep2' })), paid];
    for (const plan of [V3, null]) {
      assert.throws(() => shapeTeam({ team: many, managerRows: [] }, plan, TODAY), (err) => err instanceof ReferralAppWriteError && err.status === 200);
    }
    const refs = Array.from({ length: 250 }, (_, i) => referral({ id: `R${i}` }));
    const out = shapeTeam({ team: [{ signedUp: true, name: 'Test Rep', registeredOn: '2026-11-01', referrals: refs, rows: [] }], managerRows: [] }, null, TODAY);
    assert.equal(out.team[0].cards.length, 250);
    assert.equal(out.tiles.referrals, 250);
  });
});
