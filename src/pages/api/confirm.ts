import type { APIRoute } from 'astro';
import { clientIp, json } from '../../lib/http';
import { confirmEnabled } from '../../lib/register-flow.mjs';
import { submitConfirm } from '../../lib/confirm-submit';

// The manager's answer from the /confirm/<token> page script. Only a button press posts
// here; opening the link never does, so a mail scanner that follows the link confirms
// nothing. Same path as the page's no-JavaScript form (submitConfirm). Never logs the
// token. Spec v3 D9. Not used by the rep journey at launch (D18): no token is issued, so
// this answers 404 before any 1J call unless REP_APP_ENABLED and REP_CONFIRM_ENABLED are
// both "true" (REP_CONFIRM_ENABLED stays unset at launch). Removable later.
export const prerender = false;

const MAX_BODY = 1024;

export const POST: APIRoute = async (context) => {
  if (!confirmEnabled()) return json({ error: 'Not found.' }, 404);

  const { request } = context;
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ error: 'Invalid content type.' }, 415);
  }

  let token: unknown;
  let answer: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'Request too large.' }, 413);
    const parsed = JSON.parse(text);
    token = parsed?.token;
    answer = parsed?.answer;
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  let ip: string;
  try {
    ip = context.clientAddress;
  } catch {
    ip = clientIp(request);
  }

  const { status, ...body } = await submitConfirm(token, answer, ip);
  return json(body, status);
};
