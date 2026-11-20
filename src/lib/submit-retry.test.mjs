// FT2 and FT7, site side (field MVP plan v1.2, R2 and R8). What the site can prove on a local
// fake 1F: a retry always carries the same submissionId and the exact body first posted, two
// sends of one submission at the same moment are one post, a failed answer is never
// remembered as sent, and a success is. The same id arriving at ANOTHER server instance is
// stopped only by 1F itself (its submissionId check); that is FT2 on TEST, flow side.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { ReferralAppTimeoutError, ReferralAppWriteError, submitReferral } from './field-flow.mjs';

const KEY = `retry_${'k'.repeat(30)}`;
let n = 0;
const id = () => `77777777-7777-4777-8777-${String(++n).padStart(12, '0')}`;
const payload = (submissionId) => ({ action: 'submit', referralKey: KEY, submissionId, practiceName: 'TEST Office', company: 'HealthFirst' });

/** A fake 1F that answers each post from `replies` in turn and records every body. */
function fakeFlow(replies) {
  const posts = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    posts.push(JSON.parse(Buffer.concat(chunks).toString()));
    const reply = replies[Math.min(posts.length - 1, replies.length - 1)];
    if (reply.delay) await new Promise((r) => setTimeout(r, reply.delay));
    if (reply.hang) return; // never answers: the site's own deadline decides
    res.writeHead(reply.status, { 'content-type': 'application/json' });
    res.end(reply.body ?? '');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      process.env.FIELD_FLOW_URL = `http://127.0.0.1:${server.address().port}/flow`;
      resolve({ server, posts });
    });
  });
}
const OK = { status: 200, body: '{"ok":true}' };

describe('FT2 and FT7, site side', { concurrency: false }, () => {
  const saved = { FIELD_FLOW_URL: process.env.FIELD_FLOW_URL, REP_APP_ENABLED: process.env.REP_APP_ENABLED };
  let flow;
  beforeEach(() => {
    process.env.REP_APP_ENABLED = 'true';
  });
  afterEach(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    if (flow) await new Promise((r) => { flow.server.closeAllConnections?.(); flow.server.close(r); });
    flow = null;
  });

  test('FT2: the same submission sent twice at the same moment is one post', async () => {
    flow = await fakeFlow([{ ...OK, delay: 150 }]);
    const p = payload(id());
    await Promise.all([submitReferral(p), submitReferral({ ...p })]);
    assert.equal(flow.posts.length, 1);
  });

  test('FT2: after a success, a retry posts nothing', async () => {
    flow = await fakeFlow([OK]);
    const p = payload(id());
    await submitReferral(p);
    await submitReferral(p);
    assert.equal(flow.posts.length, 1);
  });

  for (const [label, first, err] of [
    ['a timeout (no answer)', { hang: true }, ReferralAppTimeoutError],
    ['a 504', { status: 504 }, ReferralAppTimeoutError],
    ['a 429', { status: 429 }, ReferralAppWriteError],
    ['a 502 connector outage', { status: 502 }, ReferralAppWriteError],
    ['a malformed 200', { status: 200, body: '<html>' }, ReferralAppWriteError],
    ['a 202', { status: 202, body: '{"ok":true}' }, ReferralAppWriteError],
  ]) {
    test(`FT7: after ${label}, the retry resends the same id and body, and its success sticks`, async () => {
      flow = await fakeFlow([first, OK]);
      const p = payload(id());
      await assert.rejects(() => submitReferral(p, 300), err);
      await submitReferral(p);
      assert.equal(flow.posts.length, 2);
      assert.deepEqual(flow.posts[1], flow.posts[0]);
      await submitReferral(p); // now remembered: no third post
      assert.equal(flow.posts.length, 2);
    });
  }
});
