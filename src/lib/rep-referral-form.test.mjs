import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, test } from 'node:test';
import {
  PAY_LINE,
  REP_CONSENT,
  repFlowPayload,
  repReceipt,
  repSendLabel,
  validateRepReferral,
} from './rep-referral-form.mjs';
import { repFeed } from './rep-track.mjs';

const good = {
  contactName: 'Test Office Manager',
  practiceName: 'TEST North Side Dental',
  jde: '001234',
  officePhone: '303-555-0100',
  email: '',
  preferredContact: 'Text',
  notes: '',
  permission: true,
};

describe('Rep app referral form (spec v3 section 2)', () => {
  test('a complete referral passes', () => {
    assert.deepEqual(validateRepReferral(good), { ok: true, errors: [] });
  });

  test('JDE, preferred contact and the office OK are required, as the spec says', () => {
    const fields = (r) => r.errors.map((e) => e.field).sort();
    assert.deepEqual(fields(validateRepReferral({ ...good, jde: '' })), ['jde']);
    assert.deepEqual(fields(validateRepReferral({ ...good, jde: '12a4' })), ['jde']);
    assert.deepEqual(fields(validateRepReferral({ ...good, preferredContact: '' })), ['preferredContact']);
    assert.deepEqual(fields(validateRepReferral({ ...good, permission: false })), ['permission']);
    assert.deepEqual(fields(validateRepReferral({})), ['contactName', 'jde', 'officePhone', 'permission', 'practiceName', 'preferredContact']);
  });

  test('email is optional but must look complete when given', () => {
    assert.equal(validateRepReferral({ ...good, email: 'office@example.com' }).ok, true);
    assert.equal(validateRepReferral({ ...good, email: 'office@' }).ok, false);
  });

  test('the send button walks through what is missing, ending in "Send to HealthFirst"', () => {
    assert.equal(repSendLabel({}), 'Pick how to reach them');
    assert.equal(repSendLabel({ preferredContact: 'Call' }), "Check the office's OK");
    assert.equal(repSendLabel({ preferredContact: 'Call', permission: true }), 'Enter the contact name');
    assert.equal(repSendLabel({ ...good, jde: '' }), 'Enter the JDE number');
    assert.equal(repSendLabel(good), 'Send to HealthFirst');
  });

  test('the 1F body has the spec values, keeps the JDE leading zero, and carries no rep identity', () => {
    const body = repFlowPayload({ ...good, notes: 'Ask for Kim' }, { referralKey: `Rk_${'a'.repeat(30)}`, submissionId: '11111111-1111-4111-8111-111111111111' });
    assert.deepEqual(body, {
      action: 'submit',
      referralKey: `Rk_${'a'.repeat(30)}`,
      submissionId: '11111111-1111-4111-8111-111111111111',
      leadType: 'Practice owner',
      doctorName: 'Test Office Manager',
      practiceName: 'TEST North Side Dental',
      officePhone: '303-555-0100',
      doctorCell: '',
      doctorEmail: '',
      jde: '001234',
      companies: ['HealthFirst'],
      needs: ['OSHA and HIPAA compliance'],
      contactFirst: false,
      preferredContact: 'Text',
      consentText: REP_CONSENT,
      notes: 'Ask for Kim',
      route: 'Partner',
      referrerRole: 'Rep',
      source: 'Rep app',
      status: 'Received',
    });
    assert.equal('repName' in body || 'repEmail' in body, false);
  });

  test('the receipt shows dollars only when pay is on, and promises no call-back time', () => {
    const off = repReceipt({ contactName: 'Kim', plan: null });
    assert.equal(off.title, 'Sent to HealthFirst');
    assert.equal(off.calls, "HealthFirst's team will call Kim.");
    assert.equal(off.money, '');
    assert.match(repReceipt({ contactName: 'Kim', plan: { reached: 50, signed: 100, manager: 50 } }).money, /\$50 when HealthFirst reaches Kim and confirms the lead qualifies, and \$100 more/);
    assert.match(PAY_LINE, /\$50.*\$100/);
  });
});

describe('Rep app Latest updates feed', () => {
  const rows = [
    { id: 'R1', doctor: 'Ada', practice: 'North Side Dental', created: '2026-11-01', cases: [{ company: 'HealthFirst', partnerStatus: 'Meeting set', updated: '2026-11-03' }], history: [{ on: '2026-11-03', text: 'Meeting set' }, { on: '2026-11-02', text: 'Talked with the doctor' }] },
    { id: 'R2', doctor: 'Bo', practice: 'South Park Dental', created: '2026-11-18', cases: [{ company: 'HealthFirst', partnerStatus: 'Sent', updated: '2026-11-18' }], history: [{ on: '2026-11-18', text: 'Sent' }] },
  ];

  test('newest first across all referrals, with a stale line for a referral with no update in 7 days', () => {
    const feed = repFeed(rows, '2026-11-20');
    assert.deepEqual(feed.map((f) => f.on), ['2026-11-20', '2026-11-18', '2026-11-03', '2026-11-02']);
    assert.match(feed[0].label, /No update in 17 days on North Side Dental/);
    assert.equal(feed[0].referralId, 'R1');
    assert.match(feed[1].label, /^Nov 18\. South Park Dental: /);
  });

  test('a row without an id or a doctor never reaches the feed', () => {
    assert.deepEqual(repFeed([{ practice: 'X', history: [{ on: '2026-11-01', text: 'Sent' }] }], '2026-11-02'), []);
  });
});

function listen(handler) {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      process.env.FIELD_FLOW_URL = `http://127.0.0.1:${server.address().port}/flow`;
      resolve(server);
    });
  });
}
const close = (server) => new Promise((resolve) => server.close(resolve));
const KEY = `Rk_${'z'.repeat(30)}`;
const withEnv = async (vars, fn) => {
  const prior = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(prior)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

describe('HSBS 1F for Rep keys', { concurrency: false }, () => {
  const repAnswer = { role: 'Rep', repName: 'TEST Rep', repEmail: 'test.rep@henryschein.com', services: ['HealthFirst'], isManager: false };

  test('with REP_APP_ENABLED off nothing is posted and every key is unknown (D14)', async () => {
    const { lookupReferral, listReferrals, listEarnings, listTeam, submitReferral, ReferralKeyUnknownError } = await import('./field-flow.mjs');
    let posts = 0;
    const server = await listen((_req, res) => {
      posts += 1;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(repAnswer));
    });
    try {
      for (const value of [undefined, 'false', 'TRUE', '1']) {
        await withEnv({ REP_APP_ENABLED: value }, async () => {
          if (value === undefined) delete process.env.REP_APP_ENABLED;
          for (const read of [lookupReferral, listReferrals, listEarnings, listTeam]) {
            await assert.rejects(() => read(KEY), (err) => err instanceof ReferralKeyUnknownError && err.code === 'off');
          }
          await assert.rejects(
            () => submitReferral({ action: 'submit', referralKey: KEY, submissionId: '44444444-4444-4444-8444-444444444444' }),
            ReferralKeyUnknownError,
          );
        });
      }
      assert.equal(posts, 0);
    } finally {
      await close(server);
    }
  });

  test('a Rep key opens the app with the switch on', async () => {
    const { lookupReferral } = await import('./field-flow.mjs');
    const server = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(repAnswer));
    });
    try {
      await withEnv({ REP_APP_ENABLED: 'true' }, async () => {
        assert.deepEqual(await lookupReferral(KEY), { role: 'Rep', rep: { name: 'TEST Rep', email: 'test.rep@henryschein.com' }, isManager: false });
      });
    } finally {
      await close(server);
    }
  });

  test('one lookup is one post to FIELD_FLOW_URL, with activate true (#52)', async () => {
    const { lookupReferral } = await import('./field-flow.mjs');
    /** @type {unknown[]} */
    const seen = [];
    const server = await listen(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      seen.push({ url: req.url, body: JSON.parse(Buffer.concat(chunks).toString()) });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(repAnswer));
    });
    try {
      await withEnv({ REP_APP_ENABLED: 'true', REFERRAL_FLOW_URL: 'http://127.0.0.1:9/never' }, async () => {
        await lookupReferral(KEY);
      });
      assert.deepEqual(seen, [{ url: '/flow', body: { action: 'lookup', referralKey: KEY, activate: true } }]);
    } finally {
      await close(server);
    }
  });

  test('FIELD_FLOW_URL unset, not https or with a password is a config error, and nothing is posted', async () => {
    const { lookupReferral, ReferralAppConfigError } = await import('./field-flow.mjs');
    const prior = process.env.FIELD_FLOW_URL;
    try {
      for (const url of [undefined, '', 'http://example.com/flow', 'https://u:p@example.com/flow', 'not a url']) {
        await withEnv({ REP_APP_ENABLED: 'true' }, async () => {
          if (url === undefined) delete process.env.FIELD_FLOW_URL;
          else process.env.FIELD_FLOW_URL = url;
          await assert.rejects(() => lookupReferral(KEY), ReferralAppConfigError, String(url));
        });
      }
    } finally {
      if (prior === undefined) delete process.env.FIELD_FLOW_URL;
      else process.env.FIELD_FLOW_URL = prior;
    }
  });

  test('only role "Rep" opens the app: a missing, PVA, FSC or other role is an unknown key', async () => {
    const { lookupReferral, ReferralKeyUnknownError } = await import('./field-flow.mjs');
    let answer = {};
    const server = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(answer));
    });
    try {
      await withEnv({ REP_APP_ENABLED: 'true' }, async () => {
        const { role: _role, ...noRole } = repAnswer;
        for (const bad of [noRole, { ...repAnswer, role: 'PVA' }, { ...repAnswer, role: 'FSC' }, { ...repAnswer, role: 'rep' }, { ...repAnswer, role: 'Manager' }]) {
          answer = bad;
          await assert.rejects(() => lookupReferral(KEY), (err) => err instanceof ReferralKeyUnknownError && err.detail === 'role:bad', JSON.stringify(bad.role));
        }
      });
    } finally {
      await close(server);
    }
  });

  test('404 is an unknown key and 410 is an unknown key; 408, 429 and 5xx are failed reads', async () => {
    const { lookupReferral, ReferralKeyUnknownError, ReferralAppWriteError } = await import('./field-flow.mjs');
    let status = 404;
    const server = await listen((_req, res) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end('{"error":"unknown key"}');
    });
    try {
      await withEnv({ REP_APP_ENABLED: 'true' }, async () => {
        for (status of [404, 410, 400]) await assert.rejects(() => lookupReferral(KEY), ReferralKeyUnknownError, String(status));
        for (status of [408, 429, 500, 502]) await assert.rejects(() => lookupReferral(KEY), ReferralAppWriteError, String(status));
      });
    } finally {
      await close(server);
    }
  });

  test('a malformed key never reaches the flow', async () => {
    const { lookupReferral, ReferralKeyUnknownError } = await import('./field-flow.mjs');
    let posts = 0;
    const server = await listen((_req, res) => {
      posts += 1;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(repAnswer));
    });
    try {
      await withEnv({ REP_APP_ENABLED: 'true' }, async () => {
        for (const bad of ['', 'short', 'x'.repeat(129), `${'a'.repeat(30)}/..`]) {
          await assert.rejects(() => lookupReferral(bad), (err) => err instanceof ReferralKeyUnknownError && err.code === 'shape');
        }
      });
      assert.equal(posts, 0);
    } finally {
      await close(server);
    }
  });

  test('a Rep answer reads isManager strictly (slice 5)', async () => {
    const { lookupReferral } = await import('./field-flow.mjs');
    let answer = repAnswer;
    const server = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(answer));
    });
    try {
      await withEnv({ REP_APP_ENABLED: 'true' }, async () => {
        assert.equal((await lookupReferral(KEY)).isManager, false);
        answer = { ...repAnswer, isManager: true };
        assert.equal((await lookupReferral(KEY)).isManager, true);
        answer = { ...repAnswer, isManager: 'true' };
        assert.equal((await lookupReferral(KEY)).isManager, false);
      });
    } finally {
      await close(server);
    }
  });

  test('D18: manager fields 1F sends are ignored, and never break the link', async () => {
    const { lookupReferral } = await import('./field-flow.mjs');
    let answer = repAnswer;
    const server = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(answer));
    });
    try {
      await withEnv({ REP_APP_ENABLED: 'true' }, async () => {
        for (const extra of [
          { managerName: 'TEST Jane Smith', managerEmail: 'test.m2@henryschein.com', managerStatus: 'Unaffirmed' },
          { managerName: '<b>x</b>', managerEmail: 42, managerStatus: ['Confirmed'] },
          { confirmToken: 'a'.repeat(64) },
        ]) {
          answer = { ...repAnswer, ...extra };
          const out = await lookupReferral(KEY);
          assert.deepEqual(out, { role: 'Rep', rep: { name: 'TEST Rep', email: 'test.rep@henryschein.com' }, isManager: false }, JSON.stringify(extra));
        }
      });
    } finally {
      await close(server);
    }
  });

  test('a Rep answer without a name, a good email or HealthFirst is an identity miss', async () => {
    const { lookupReferral, ReferralKeyUnknownError } = await import('./field-flow.mjs');
    for (const bad of [{ ...repAnswer, repName: '' }, { ...repAnswer, repEmail: 'nope' }, { ...repAnswer, services: [] }]) {
      const server = await listen((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(bad));
      });
      try {
        await withEnv({ REP_APP_ENABLED: 'true' }, async () => {
          await assert.rejects(() => lookupReferral(KEY), ReferralKeyUnknownError);
        });
      } finally {
        await close(server);
      }
    }
  });

  test('a submit needs 200 with {"ok":true}; an empty, HTML or stalled 200 fails', async () => {
    const { submitReferral, ReferralAppWriteError, ReferralAppTimeoutError } = await import('./field-flow.mjs');
    const body = (id) => repFlowPayload(good, { referralKey: KEY, submissionId: id });
    let n = 0;
    const id = () => `22222222-2222-4222-8222-${String(++n).padStart(12, '0')}`;
    await withEnv({ REP_APP_ENABLED: 'true' }, async () => {
      for (const [label, resBody] of [['empty', ''], ['html', '<html>x</html>'], ['ok false', '{"ok":false}']]) {
        const server = await listen((_req, res) => {
          res.writeHead(200);
          res.end(resBody);
        });
        try {
          await assert.rejects(() => submitReferral(body(id())), ReferralAppWriteError, label);
        } finally {
          await close(server);
        }
      }
      const stall = await listen((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.write('{"ok":');
      });
      try {
        await assert.rejects(() => submitReferral(body(id()), 300), ReferralAppTimeoutError);
      } finally {
        stall.closeAllConnections?.();
        await close(stall);
      }
      const ok = await listen((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        await submitReferral(body(id()));
      } finally {
        await close(ok);
      }
    });
  });

  test('a retry with the same submissionId after a 200 posts nothing more; a new id posts again', async () => {
    const { submitReferral } = await import('./field-flow.mjs');
    let posts = 0;
    const server = await listen((_req, res) => {
      posts += 1;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
    try {
      await withEnv({ REP_APP_ENABLED: 'true' }, async () => {
        const same = repFlowPayload(good, { referralKey: KEY, submissionId: '55555555-5555-4555-8555-555555555555' });
        await submitReferral(same);
        await submitReferral(same);
        assert.equal(posts, 1);
        await submitReferral(repFlowPayload(good, { referralKey: KEY, submissionId: '55555555-5555-4555-8555-555555555556' }));
        assert.equal(posts, 2);
      });
    } finally {
      await close(server);
    }
  });
});
