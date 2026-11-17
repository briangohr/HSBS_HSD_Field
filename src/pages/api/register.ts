import type { APIRoute } from 'astro';
import { clientIp, json } from '../../lib/http';
import { repAppEnabled } from '../../lib/register-flow.mjs';
import { pickFields, submitRegistration } from '../../lib/register-submit';

// Rep sign-up from the /join page script. Posts HSBS 1J through submitRegistration,
// the same path /join uses for a plain form POST. The flow URL is never returned to
// the browser, and nothing here logs the rep's details. Off (404) unless
// REP_APP_ENABLED=true. Spec: docs/field-flow-contract.md, section 2.
export const prerender = false;

const MAX_BODY = 4 * 1024;

export const POST: APIRoute = async (context) => {
  if (!repAppEnabled()) return json({ error: 'Not found.' }, 404);

  const { request } = context;
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ error: 'Invalid content type.' }, 415);
  }

  let data: Record<string, string>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'Request too large.' }, 413);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
    data = pickFields((k) => (parsed as Record<string, unknown>)[k]);
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  let ip: string;
  try {
    ip = context.clientAddress;
  } catch {
    ip = clientIp(request);
  }

  const { status, ...body } = await submitRegistration(data, ip);
  return json(body, status);
};
