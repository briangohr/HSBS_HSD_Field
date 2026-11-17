import type { APIRoute } from 'astro';
import { clientIp, json, keyLimited } from '../../lib/http';
import {
  ReferralAppConfigError,
  ReferralAppTimeoutError,
  ReferralAppWriteError,
  ReferralKeyUnknownError,
} from '../../lib/field-flow.mjs';
import { isReferralKey } from '../../lib/field-form.mjs';
import { repAppEnabled, repPayEnabled, repPayPlan, repStaffingPlan } from '../../lib/register-flow.mjs';
import { LedgerReadError, RepUnverifiedError, cachedSnapshot, confirmRep, moneyView } from '../../lib/rep-reads.mjs';

// My Earnings and the money lines for the HealthFirst rep app (slice 4). The browser
// posts the key; this function asks HSBS 1F for the rep's referrals and their own SPIFF
// Ledger rows together, and returns only display values. Off (404) unless
// REP_PAY_ENABLED and REP_APP_ENABLED are both on (spec D14). Never logs the key or
// any amount. Contract: docs/field-flow-contract.md.
export const prerender = false;

const MAX_BODY = 1024;

export const POST: APIRoute = async (context) => {
  // Pay off: 404, with the pay-off terms marker ('') so a page opened while pay was on
  // drops the promises it worded itself (Codex P1s on #113; payTerms in rep-pay-plan.mjs).
  if (!repPayEnabled()) return json({ error: 'Not found.', terms: '' }, 404);
  const { request } = context;
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ error: 'Invalid content type.' }, 415);
  }
  let key: unknown;
  let fresh = false;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'Request too large.' }, 413);
    const body = JSON.parse(text);
    key = body?.referralKey;
    fresh = body?.fresh === true; // the Refresh button skips the short cache (flow-cache.mjs)
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!isReferralKey(key)) return json({ error: 'This link does not work.' }, 404);

  let ip: string;
  try {
    ip = context.clientAddress;
  } catch {
    ip = clientIp(request);
  }
  if (keyLimited('earnings', String(key), ip, 30)) {
    return json({ error: 'Too many requests. Please try again in a few minutes.' }, 429);
  }

  try {
    const cache = repAppEnabled(); // the cache belongs to the rep app only
    let referrer: unknown;
    let warm = false;
    const seen = (r: unknown) => {
      referrer = r;
    };
    const onWarm = () => {
      warm = true;
    };
    const { referrals, ledger } = await cachedSnapshot(String(key), { fresh, cache, seen, onWarm });
    // Nothing is returned unless the 1F lookup confirms a Rep key (fails closed).
    await confirmRep(String(key), { referrer, warm, cache });
    // Pay is on. A plan that doesn't parse is null: the ledger amounts still show and
    // nothing is promised (field two-track spec, slice S1).
    // The staffing plan (REP_PAY_PLAN_STAFFING) words staffing promises only (slice S5).
    return json(moneyView(referrals, ledger, repPayPlan(), repStaffingPlan()));
  } catch (caught) {
    // A ledger-only failure is wrapped so the list route can keep its list; here it is the ledger's own error.
    const err = caught instanceof LedgerReadError ? caught.cause : caught;
    if (err instanceof ReferralKeyUnknownError) return json({ error: 'This link does not work.' }, 404);
    if (err instanceof RepUnverifiedError) return json({ error: 'Your earnings did not load.' }, 502);
    if (err instanceof ReferralAppConfigError) {
      console.error('earnings: FIELD_FLOW_URL is not set');
      return json({ error: 'Your earnings did not load.' }, 503);
    }
    if (err instanceof ReferralAppTimeoutError) {
      console.error('earnings: flow timed out');
      return json({ error: 'Your earnings did not load.' }, 504);
    }
    console.error('earnings: flow failed', err instanceof ReferralAppWriteError ? err.status : 0);
    return json({ error: 'Your earnings did not load.' }, 502);
  }
};
