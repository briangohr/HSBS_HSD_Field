import type { APIRoute } from 'astro';
import { clientIp, journeyLimited, json } from '../../lib/http';
import { partnerPageEnabled } from '../../lib/partner-flow.mjs';
import { SAVE_WORDS, isPartnerKey } from '../../lib/partner-form.mjs';
import { partnerSave } from '../../lib/partner-save.mjs';

// Save for the partner update page, /update/<key> (sheet PU, piece A). The browser posts
// the key, a submissionId and the touched leads; this function checks them and posts one
// save to HSBS 7F (PARTNER_FLOW_URL). 7F is the real gate: it refuses a key that is not an
// Active Partner Links row and a lead that is not that partner's open lead. Off (404)
// unless PARTNER_PAGE_ENABLED and REP_APP_ENABLED are both exactly true. Never logs the key
// or a lead. Contract: docs/field-flow-contract.md, "HSBS 7F".
export const prerender = false;

const MAX_BODY = 64 * 1024;

const answer = (body: unknown, status = 200) => {
  const res = json(body, status);
  res.headers.set('cache-control', 'no-store');
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
};

export const POST: APIRoute = async (context) => {
  if (!partnerPageEnabled()) return answer({ error: 'Not found.' }, 404);
  const { request } = context;
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return answer({ error: 'Invalid content type.' }, 415);
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return answer({ error: 'Request too large.' }, 413);
    body = JSON.parse(text);
  } catch {
    return answer({ error: 'Invalid request body.' }, 400);
  }
  const key = body && typeof body === 'object' ? (body as Record<string, unknown>).key : undefined;
  if (!isPartnerKey(key)) return answer({ error: SAVE_WORDS.badLink }, 404);
  let ip: string;
  try {
    ip = context.clientAddress;
  } catch {
    ip = clientIp(request);
  }
  // 30 saves per key per 10 minutes, with the per-IP backstop, as /refer.
  if (journeyLimited('partner-save', String(key), ip, 30, true)) {
    return answer({ error: 'busy', message: SAVE_WORDS.busy }, 429);
  }
  const result = await partnerSave(body);
  return answer(result.body, result.status);
};
