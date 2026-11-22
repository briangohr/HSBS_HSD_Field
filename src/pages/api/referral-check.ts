import type { APIRoute } from 'astro';
import { clientIp, journeyLimited, json } from '../../lib/http';
import { ReferralKeyUnknownError } from '../../lib/field-flow.mjs';
import { isReferralKey } from '../../lib/field-form.mjs';
import { repAppEnabled } from '../../lib/register-flow.mjs';
import { cachedReferrals, confirmRep } from '../../lib/rep-reads.mjs';
import { duplicateWarning, findOpenDuplicate } from '../../lib/rep-duplicate.mjs';

// Duplicate warning before Send (Brian, 11/21/2026; src/lib/rep-duplicate.mjs). The page
// posts the key, the company and the office it is about to send. This reads the rep's own
// 1F `list` (through the same short cache Track uses) and answers with a warning or none.
// It warns, never blocks, and writes nothing. Any failure answers `{ warning: "" }` with
// 200 except a bad key, so a slow or failed check never stops a send.
// Off (404) unless REP_APP_ENABLED=true.
export const prerender = false;

const MAX_BODY = 4 * 1024;

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
  if (!isReferralKey(data.referralKey)) return json({ error: 'This link does not work.' }, 404);

  let ip: string;
  try {
    ip = context.clientAddress;
  } catch {
    ip = clientIp(request);
  }
  // Over the limit: no check, no warning. The send itself has its own limit.
  if (journeyLimited('referral-check', String(data.referralKey), ip, 30, true)) return json({ warning: '' });

  const key = String(data.referralKey);
  try {
    let referrer: unknown;
    let warm = false;
    const referrals = await cachedReferrals(key, {
      seen: (r: unknown) => {
        referrer = r;
      },
      onWarm: () => {
        warm = true;
      },
    });
    // Nothing is read out unless the 1F lookup confirms a Rep key (fails closed).
    await confirmRep(key, { referrer, warm });
    const dup = findOpenDuplicate(referrals, { company: data.company, practiceName: data.practiceName, jde: data.jde });
    return json({ warning: dup ? duplicateWarning(dup) : '' });
  } catch (err) {
    if (err instanceof ReferralKeyUnknownError) return json({ error: 'This link does not work.' }, 404);
    // A timeout, a failed read or an unconfirmed key: no warning, and the send goes on to
    // /api/referral, which checks the key again.
    return json({ warning: '' });
  }
};
