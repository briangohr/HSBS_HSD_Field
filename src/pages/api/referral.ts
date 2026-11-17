import type { APIRoute } from 'astro';
import { clientIp, json } from '../../lib/http';
import { repAppEnabled, repPayEnabled, repPayPlanFor, repPayTerms } from '../../lib/register-flow.mjs';
import { pickRepFields, submitRep } from '../../lib/rep-submit';
import { asStaffingPlan, staffingTerms } from '../../lib/rep-staffing-form.mjs';

// Field referral submit. The browser posts here. This function posts FIELD_FLOW_URL
// through submitRep (src/lib/rep-submit.ts). The flow URL is read from the environment and
// is never returned to the client. Only the field app's body (`app: "rep"`) is accepted.
// 60s is inside the Hobby plan maximum (300s). The flow fetch stops at 55s so this
// function can still answer. The adapter's shared server function uses the same ceiling.
// Off (404) unless REP_APP_ENABLED=true.
export const prerender = false;
export const maxDuration = 60;

const MAX_BODY = 16 * 1024;

export const POST: APIRoute = async (context) => {
  const { request } = context;
  if (!repAppEnabled()) return json({ error: 'Not found' }, 404);
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ error: 'Invalid content type.' }, 415);
  }

  let data: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'Request too large.' }, 413);
    data = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (data.app !== 'rep') return json({ error: 'Invalid request body.' }, 400);
  let ip: string;
  try {
    ip = context.clientAddress;
  } catch {
    ip = clientIp(request);
  }
  const body = data as Record<string, unknown>;
  const { status, ...rest } = await submitRep(body.referralKey, body.submissionId, pickRepFields((k) => body[k]), ip);
  // A good send names the pay terms the server holds now ('' with pay off), so the page
  // words its receipt promise only when they are the terms it was opened with (Codex P1s
  // on #113). The page's other answers carry the same marker; see payTerms.
  // A staffing send also names the staffing plan its receipt promise is worded from.
  if (rest.ok) {
    const staffing = body.company === 'Staffing' ? { staffingTerms: staffingTerms(repPayEnabled() ? asStaffingPlan(repPayPlanFor('Staffing')) : null) } : {};
    return json({ ...rest, terms: repPayTerms(), ...staffing }, status);
  }
  return json(rest, status);
};
