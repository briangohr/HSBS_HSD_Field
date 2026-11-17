// /api/team over a fake HSBS 1F that keeps a tiny Team Roster and Rep Roster (Brian,
// 11/9, D18; spec tests 11, 16 and 19).
//
// What these tests prove is the site's part only: /api/team posts exactly
// {action: 'team', referralKey} once per call, never adds a manager, email or hint of its
// own, reads 1F fresh each time, and shapes whatever 1F returns (notSignedUp, the 404
// words, a 502 on a bad entry). Which reps a key sees is 1F's rule, played here by the
// fake (teamFlow). The proof of that rule on the real flow is BB1 sheet 5 v1 tests 8 to
// 14, run on the 1F copy.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, test } from 'node:test';
import { POST as teamRoute } from '../pages/api/team.ts';

let ipCount = 0;
const freshIp = () => `10.1.0.${++ipCount}`;

/** A fake flow on a loopback port; FIELD_FLOW_URL is pointed at it. */
function listen(reply) {
  const posts = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    posts.push(body);
    const [status, value] = await reply(body);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(typeof value === 'string' ? value : JSON.stringify(value));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      process.env.FIELD_FLOW_URL = `http://127.0.0.1:${server.address().port}/flow`;
      resolve({ server, posts });
    });
  });
}
const close = ({ server }) =>
  new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(resolve);
  });

const saved = {};
const ENV = ['FIELD_FLOW_URL', 'REP_APP_ENABLED', 'REP_PAY_ENABLED', 'REP_PAY_PLAN'];
for (const k of ENV) saved[k] = process.env[k];
const restore = () => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
};

const KEYS = {
  a: `MgrA_${'a'.repeat(30)}`,
  b: `MgrB_${'b'.repeat(30)}`,
  rep: `RepNo_${'n'.repeat(30)}`,
  repMgr: `RepMgr_${'r'.repeat(30)}`,
};
const EMAIL = {
  [KEYS.a]: 'test.mgr.a@henryschein.com',
  [KEYS.b]: 'test.mgr.b@henryschein.com',
  [KEYS.rep]: 'test.plain.rep@henryschein.com',
  [KEYS.repMgr]: 'test.rep.lead@henryschein.com',
};

/** Brian's Team Roster and the Rep Roster, as the flow reads them. */
function rosters() {
  return {
    team: [
      { repEmail: 'test.alpha@henryschein.com', repName: 'TEST Alpha', managerEmail: EMAIL[KEYS.a], active: true },
      { repEmail: 'test.bravo@henryschein.com', repName: 'TEST Bravo', managerEmail: EMAIL[KEYS.b], active: true },
      { repEmail: 'test.new@henryschein.com', repName: 'TEST New Rep', managerEmail: EMAIL[KEYS.b], active: true },
      { repEmail: 'test.lr@henryschein.com', repName: 'TEST Lead Rep Team', managerEmail: EMAIL[KEYS.repMgr], active: true },
      { repEmail: 'test.old@henryschein.com', repName: 'TEST Old Pair', managerEmail: EMAIL[KEYS.a], active: false },
      { repEmail: 'test.off@henryschein.com', repName: 'TEST Disabled', managerEmail: EMAIL[KEYS.a], active: true },
    ],
    // The manager each rep typed on /join is only a hint (D18): it never decides a team.
    reps: [
      { email: 'test.alpha@henryschein.com', name: 'TEST Alpha', role: 'AE', registeredOn: '2026-11-06', typedManager: EMAIL[KEYS.b] },
      { email: 'test.bravo@henryschein.com', name: 'TEST Bravo', role: 'FSC', registeredOn: '2026-11-05', typedManager: EMAIL[KEYS.a] },
      { email: 'test.lr@henryschein.com', name: 'TEST Lead Rep Team', role: 'AE', registeredOn: '2026-11-04', typedManager: EMAIL[KEYS.repMgr] },
      { email: 'test.old@henryschein.com', name: 'TEST Old Pair', role: 'AE', registeredOn: '2026-10-01', typedManager: EMAIL[KEYS.a] },
      { email: 'test.off@henryschein.com', name: 'TEST Disabled', role: 'AE', registeredOn: '2026-10-02', typedManager: EMAIL[KEYS.a], disabled: true },
      { email: 'test.hint@henryschein.com', name: 'TEST Hint Only', role: 'AE', registeredOn: '2026-11-07', typedManager: EMAIL[KEYS.a] },
    ],
  };
}

/**
 * A stand-in for 1F "team" by the contract (the caller's email comes from the key, never
 * the request; a signed-up rep's name is the Team Roster's Rep Name). It plays the roster
 * rule so the site has answers to shape; it doesn't prove the rule.
 */
function teamFlow(r) {
  return (body) => {
    if (body.action !== 'team') return [400, ''];
    const email = EMAIL[body.referralKey];
    const rows = r.team.filter((t) => email && t.active && t.managerEmail === email);
    const team = [];
    for (const t of rows) {
      const rep = r.reps.find((x) => x.email === t.repEmail);
      if (rep?.disabled) continue;
      team.push(
        rep
          ? { signedUp: true, name: t.repName, email: rep.email, role: rep.role, registeredOn: rep.registeredOn, referrals: [], rows: [] }
          : { signedUp: false, name: t.repName },
      );
    }
    return team.length ? [200, { team, managerRows: [] }] : [404, ''];
  };
}

/** The site posted exactly action and key, once per call, in order. */
const postedOnly = (flow, ...keys) =>
  assert.deepEqual(flow.posts, keys.map((referralKey) => ({ action: 'team', referralKey })));

const callTeam = async (key) => {
  const res = await teamRoute(/** @type {any} */ ({
    request: new Request('http://localhost/api/team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referralKey: key }) }),
    clientAddress: freshIp(),
  }));
  return { status: res.status, body: await res.json() };
};

describe('/api/team: the site posts only the key and shapes what 1F returns (D18)', { concurrency: false }, () => {
  test.afterEach(restore);

  test('each key gets the team 1F returns for it, with no email or hint; the site posts only action and key', async () => {
    process.env.REP_APP_ENABLED = 'true';
    const flow = await listen(teamFlow(rosters()));
    try {
      const a = await callTeam(KEYS.a);
      const b = await callTeam(KEYS.b);
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      assert.deepEqual(a.body.team.map((m) => m.name), ['TEST Alpha']);
      assert.deepEqual(a.body.notSignedUp, []);
      assert.deepEqual(b.body.team.map((m) => m.name), ['TEST Bravo']);
      assert.deepEqual(b.body.notSignedUp, [{ name: 'TEST New Rep' }]);
      const text = JSON.stringify([a.body, b.body]);
      // No email, no rep whose /join hint named this manager, no Disabled or inactive rep.
      for (const leak of ['henryschein.com', 'TEST Hint Only', 'TEST Disabled', 'TEST Old Pair']) assert.equal(text.includes(leak), false, leak);
      assert.equal(/confirm|paired|waiting|"ref"/i.test(text), false, text);
      postedOnly(flow, KEYS.a, KEYS.b);
    } finally {
      await close(flow);
    }
  });

  test('a rep not signed up yet reaches the browser as exactly { name }', async () => {
    process.env.REP_APP_ENABLED = 'true';
    const r = rosters();
    const flow = await listen((body) => {
      const [status, value] = teamFlow(r)(body);
      // Fields the contract forbids, planted on the new rep's entry.
      if (status === 200) for (const m of value.team) if (!m.signedUp) Object.assign(m, { email: 'test.new@henryschein.com', registeredOn: '2026-11-08', confirmToken: 'c'.repeat(64), paired: true });
      return [status, value];
    });
    try {
      const { status, body } = await callTeam(KEYS.b);
      assert.equal(status, 200);
      assert.deepEqual(body.notSignedUp, [{ name: 'TEST New Rep' }]);
      assert.equal(JSON.stringify(body).includes('c'.repeat(16)), false);
      assert.equal(body.tiles.referrals, 0);
      postedOnly(flow, KEYS.b);
    } finally {
      await close(flow);
    }
  });

  test('a 1F 404 shows "No one is on your team"; the site sends no /join hint or manager field', async () => {
    process.env.REP_APP_ENABLED = 'true';
    const r = rosters();
    r.reps.push({ email: 'test.typer@henryschein.com', name: 'TEST Typer', role: 'AE', registeredOn: '2026-11-08', typedManager: EMAIL[KEYS.rep] });
    const flow = await listen(teamFlow(r));
    try {
      const api = await callTeam(KEYS.rep);
      assert.equal(api.status, 404);
      assert.deepEqual(api.body, { error: 'No one is on your team in the HSBS app right now.', none: true });
      postedOnly(flow, KEYS.rep);
    } finally {
      await close(flow);
    }
  });

  test('a Rep key is posted and shaped like any other key', async () => {
    process.env.REP_APP_ENABLED = 'true';
    const flow = await listen(teamFlow(rosters()));
    try {
      const { status, body } = await callTeam(KEYS.repMgr);
      assert.equal(status, 200);
      assert.deepEqual(body.team.map((m) => m.head), ['TEST Lead Rep Team. AE. Joined Nov 4.']);
      assert.deepEqual(body.notSignedUp, []);
      postedOnly(flow, KEYS.repMgr);
    } finally {
      await close(flow);
    }
  });

  test('every call reads 1F fresh: when 1F\'s answer changes (Brian moves a rep), the next call shows it', async () => {
    process.env.REP_APP_ENABLED = 'true';
    const r = rosters();
    const flow = await listen(teamFlow(r));
    try {
      assert.deepEqual((await callTeam(KEYS.a)).body.team.map((m) => m.name), ['TEST Alpha']);
      r.team[0].managerEmail = EMAIL[KEYS.b];
      // A has no Active row left: 404, "No one is on your team".
      assert.equal((await callTeam(KEYS.a)).status, 404);
      assert.deepEqual((await callTeam(KEYS.b)).body.team.map((m) => m.name).sort(), ['TEST Alpha', 'TEST Bravo']);
      // Brian sets the row to Active No: the rep leaves B's team too.
      r.team[0].active = false;
      assert.deepEqual((await callTeam(KEYS.b)).body.team.map((m) => m.name), ['TEST Bravo']);
      postedOnly(flow, KEYS.a, KEYS.a, KEYS.b, KEYS.b);
    } finally {
      await close(flow);
    }
  });

  test('when 1F starts sending a rep as signed up, the site shows a full row, not "Not signed up yet"', async () => {
    process.env.REP_APP_ENABLED = 'true';
    const r = rosters();
    const flow = await listen(teamFlow(r));
    try {
      assert.deepEqual((await callTeam(KEYS.b)).body.notSignedUp, [{ name: 'TEST New Rep' }]);
      r.reps.push({ email: 'test.new@henryschein.com', name: 'TEST New Rep', role: 'AE', registeredOn: '2026-11-09', typedManager: '' });
      const { body } = await callTeam(KEYS.b);
      assert.deepEqual(body.notSignedUp, []);
      assert.deepEqual(body.team.map((m) => m.name).sort(), ['TEST Bravo', 'TEST New Rep']);
      postedOnly(flow, KEYS.b, KEYS.b);
    } finally {
      await close(flow);
    }
  });

  test('a bad entry from the flow is a failed load (502), never part of a team', async () => {
    process.env.REP_APP_ENABLED = 'true';
    for (const entry of [{ confirmed: true, name: 'TEST Old Shape', referrals: [], rows: [] }, { signedUp: 'true', name: 'X' }, { signedUp: false }]) {
      const flow = await listen(() => [200, { team: [entry], managerRows: [] }]);
      const quiet = console.error;
      console.error = () => {};
      try {
        const { status, body } = await callTeam(KEYS.a);
        assert.equal(status, 502, JSON.stringify(entry));
        assert.deepEqual(body, { error: 'Your team did not load.' });
      } finally {
        console.error = quiet;
        await close(flow);
      }
    }
  });

  test('with REP_APP_ENABLED off, /api/team is 404 and calls no flow', async () => {
    delete process.env.REP_APP_ENABLED;
    const flow = await listen(teamFlow(rosters()));
    try {
      const { status } = await callTeam(KEYS.a);
      assert.equal(status, 404);
      assert.equal(flow.posts.length, 0);
    } finally {
      await close(flow);
    }
  });
});

// Slice S8 of the field two-track spec (section 10), site side only. These tests run the
// real route (/api/team, then listTeam's HTTP post to 1F) against a fake 1F, so they prove
// what the site does: it sends 1F only the caller's own key, it never widens or reuses
// what 1F returns, and it answers 404 when 1F says the key has no team. They do not prove
// 1F's own rule (which Team Roster rows a key gets): the fake plays that rule. That is
// checked live, on TEST rows, by "Live TEST check of the team rule (S8)" in
// docs/field-flow-contract.md.
//
// The fake here is careless on purpose: besides the roster rule, it trusts anything else
// in the request that names a manager or a rep (an email, a rep's key, a referral id).
// The site never gives it that chance: /api/team posts only {action: 'team',
// referralKey}, with the caller's own key. So if the site ever forwarded a field from the
// browser, or read a rep's key in place of the caller's, the other manager's rep would
// show up in the answer and these tests fail, not only the posted-body check.
describe('S8, site side: /api/team sends only the caller\'s key, never widens 1F\'s answer, and answers 404 for a non-manager', { concurrency: false }, () => {
  test.afterEach(restore);

  const K = {
    north: `S8MgrNorth_${'n'.repeat(30)}`,
    south: `S8MgrSouth_${'s'.repeat(30)}`,
    // Team members' own keys: each is on a manager's team, and manages no one.
    northRep: `S8RepNorth_${'e'.repeat(30)}`,
    southRep: `S8RepSouth_${'w'.repeat(30)}`,
    // On the Rep Roster, on nobody's team and nobody's manager.
    loner: `S8RepLoner_${'l'.repeat(30)}`,
    // A well formed key that no roster holds.
    stranger: `S8Unknown_${'u'.repeat(30)}`,
  };
  const MAIL = {
    [K.north]: 'test.s8.north@henryschein.com',
    [K.south]: 'test.s8.south@henryschein.com',
    [K.northRep]: 'test.s8.north.rep@henryschein.com',
    [K.southRep]: 'test.s8.south.rep@henryschein.com',
    [K.loner]: 'test.s8.loner@henryschein.com',
  };
  const referral = (id, practice) => ({
    id,
    doctor: 'TEST Office Manager',
    practice,
    created: '2026-11-02',
    cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-04' }],
    history: [{ on: '2026-11-04', text: 'Meeting set' }],
    reached: true,
  });
  // Brian's Team Roster and the Rep Roster for the two TEST managers.
  const ROSTER = {
    team: [
      { repEmail: MAIL[K.northRep], repName: 'TEST North Rep', managerEmail: MAIL[K.north], active: true },
      { repEmail: 'test.s8.north.new@henryschein.com', repName: 'TEST North New', managerEmail: MAIL[K.north], active: true },
      { repEmail: MAIL[K.southRep], repName: 'TEST South Rep', managerEmail: MAIL[K.south], active: true },
      { repEmail: 'test.s8.south.new@henryschein.com', repName: 'TEST South New', managerEmail: MAIL[K.south], active: true },
    ],
    reps: [
      { key: K.northRep, email: MAIL[K.northRep], role: 'FSC', registeredOn: '2026-11-01', referrals: [referral('TEST-S8-N1', 'TEST North Dental')] },
      { key: K.southRep, email: MAIL[K.southRep], role: 'FSC', registeredOn: '2026-11-01', referrals: [referral('TEST-S8-S1', 'TEST South Dental'), referral('TEST-S8-S2', 'TEST South Ortho')] },
      { key: K.loner, email: MAIL[K.loner], role: 'AE', registeredOn: '2026-11-01', referrals: [] },
    ],
  };
  // Everything that belongs to the south team, and must never reach the north manager.
  const SOUTH = /TEST South|TEST-S8-S|test\.s8\.south/;
  const NORTH = /TEST North|TEST-S8-N|test\.s8\.north/;

  const entry = (t) => {
    const rep = ROSTER.reps.find((x) => x.email === t.repEmail);
    return rep
      ? { signedUp: true, name: t.repName, email: rep.email, role: rep.role, registeredOn: rep.registeredOn, referrals: rep.referrals, rows: [] }
      : { signedUp: false, name: t.repName };
  };
  /** 1F "team" by the roster rule, plus the careless extras described above. */
  const carelessFlow = (body) => {
    if (body.action !== 'team') return [400, ''];
    let caller = MAIL[body.referralKey];
    if (typeof body.managerEmail === 'string') caller = body.managerEmail;
    const team = ROSTER.team.filter((t) => caller && t.active && t.managerEmail === caller).map(entry);
    // Any rep the request names by key, email or referral id is added, as a flow that
    // trusted the browser would.
    const named = Object.entries(body).filter(([k]) => k !== 'action' && k !== 'referralKey').flatMap(([, v]) => [v].flat());
    for (const t of ROSTER.team) {
      const rep = ROSTER.reps.find((x) => x.email === t.repEmail);
      const hit = named.some((v) => v === t.repEmail || (rep && (v === rep.key || rep.referrals.some((r) => r.id === v))));
      if (hit && !team.some((m) => m.name === t.repName)) team.push(entry(t));
    }
    return team.length ? [200, { team, managerRows: [] }] : [404, ''];
  };

  const call = async (body) => {
    const res = await teamRoute(/** @type {any} */ ({
      request: new Request('http://localhost/api/team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      clientAddress: freshIp(),
    }));
    return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json() };
  };
  const names = (body) => [...body.team.map((m) => m.name), ...body.notSignedUp.map((m) => `${m.name} (not signed up)`)];
  const offices = (body) => body.team.flatMap((m) => m.cards.map((c) => c.office));
  const NONE = { error: 'No one is on your team in the HSBS app right now.', none: true };

  test('two TEST managers: the site asks 1F with each caller\'s own key and shows only that answer, never another caller\'s', async () => {
    process.env.REP_APP_ENABLED = 'true';
    const flow = await listen(carelessFlow);
    try {
      // Interleaved, so an answer kept from one call could not pass for the next.
      const north = await call({ referralKey: K.north });
      const south = await call({ referralKey: K.south });
      const northAgain = await call({ referralKey: K.north });
      for (const r of [north, south, northAgain]) {
        assert.equal(r.status, 200);
        // No shared cache may hand one manager's team to the next caller.
        assert.equal(r.cache, 'no-store');
      }
      assert.deepEqual(names(north.body), ['TEST North Rep', 'TEST North New (not signed up)']);
      assert.deepEqual(offices(north.body), ['TEST North Dental']);
      assert.deepEqual(north.body.tiles, { referrals: 1, signed: 0 });
      assert.deepEqual(names(south.body), ['TEST South Rep', 'TEST South New (not signed up)']);
      assert.deepEqual(offices(south.body).sort(), ['TEST South Dental', 'TEST South Ortho']);
      assert.deepEqual(south.body.tiles, { referrals: 2, signed: 0 });
      assert.deepEqual(northAgain.body, north.body);
      assert.equal(SOUTH.test(JSON.stringify(north.body)), false, 'south data on the north team');
      assert.equal(NORTH.test(JSON.stringify(south.body)), false, 'north data on the south team');
      postedOnly(flow, K.north, K.south, K.north);
    } finally {
      await close(flow);
    }
  });

  test("a manager key that names another team's rep (key, id or email): the site sends 1F only the caller's key, so the team is not widened", async () => {
    process.env.REP_APP_ENABLED = 'true';
    const flow = await listen(carelessFlow);
    // The browser's ids are m0 and c0; the rest are the real values a manager could guess
    // or learn: the rep's key, the rep's email, a referral id, the other manager's email.
    const tries = [
      { repKey: K.southRep },
      { key: K.southRep },
      { memberKey: K.southRep, referralKeys: [K.north, K.southRep] },
      { repId: 'm0', id: 'm0', cardId: 'c0' },
      { referralId: 'TEST-S8-S1', ids: ['TEST-S8-S1', 'TEST-S8-S2'] },
      { repEmail: MAIL[K.southRep], email: MAIL[K.southRep] },
      { managerEmail: MAIL[K.south] },
    ];
    try {
      for (const extra of tries) {
        const label = Object.keys(extra).join(',');
        const r = await call({ referralKey: K.north, ...extra });
        assert.equal(r.status, 200, label);
        assert.deepEqual(names(r.body), ['TEST North Rep', 'TEST North New (not signed up)'], label);
        assert.deepEqual(offices(r.body), ['TEST North Dental'], label);
        assert.equal(SOUTH.test(JSON.stringify(r.body)), false, label);
      }
      // Only the caller's own key ever reached 1F, and nothing else from the request.
      postedOnly(flow, ...tries.map(() => K.north));
      // A key field holding more than one key is not a key: 404, and 1F is not called.
      const many = await call({ referralKey: [K.north, K.southRep] });
      assert.equal(many.status, 404);
      assert.equal(SOUTH.test(JSON.stringify(many.body)), false);
      assert.equal(flow.posts.length, tries.length);
    } finally {
      await close(flow);
    }
  });

  test('a team member key: when 1F answers 404 the site answers 404, even when the request names the member\'s manager', async () => {
    process.env.REP_APP_ENABLED = 'true';
    const flow = await listen(carelessFlow);
    try {
      for (const [key, manager] of [[K.northRep, K.north], [K.southRep, K.south]]) {
        const plain = await call({ referralKey: key });
        assert.equal(plain.status, 404);
        assert.deepEqual(plain.body, NONE);
        const asking = await call({ referralKey: key, managerEmail: MAIL[manager], repKey: manager });
        assert.equal(asking.status, 404);
        assert.deepEqual(asking.body, NONE);
      }
      postedOnly(flow, K.northRep, K.northRep, K.southRep, K.southRep);
    } finally {
      await close(flow);
    }
  });

  test('a key on no team: when 1F answers 404 the site answers the same 404 as for a team member', async () => {
    process.env.REP_APP_ENABLED = 'true';
    const flow = await listen(carelessFlow);
    try {
      const member = await call({ referralKey: K.northRep });
      const loner = await call({ referralKey: K.loner });
      const stranger = await call({ referralKey: K.stranger });
      for (const r of [member, loner, stranger]) {
        assert.equal(r.status, 404);
        assert.equal(r.cache, 'no-store');
        assert.deepEqual(r.body, NONE);
      }
      postedOnly(flow, K.northRep, K.loner, K.stranger);
    } finally {
      await close(flow);
    }
  });
});
