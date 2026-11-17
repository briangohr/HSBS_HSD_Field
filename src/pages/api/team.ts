import type { APIRoute } from 'astro';
import { clientIp, journeyLimited, json } from '../../lib/http';
import {
  ReferralAppConfigError,
  ReferralAppTimeoutError,
  ReferralAppWriteError,
  ReferralKeyUnknownError,
  listTeam,
} from '../../lib/field-flow.mjs';
import { isReferralKey } from '../../lib/field-form.mjs';
import { repAppEnabled, repPayEnabled, repPayPlan, repStaffingPlan } from '../../lib/register-flow.mjs';
import { payTerms } from '../../lib/rep-pay-plan.mjs';
import { shapeTeam } from '../../lib/rep-team.mjs';

// My Team for the HealthFirst rep app (slice 5, D18). The browser posts the key; this
// function asks HSBS 1F for the team (Brian's Team Roster rows that name this person as
// the manager) and returns display values only (shapeTeam): no rep email, no key, and
// for a rep not signed up yet only the name. Read only. The flow's 404 is the real
// gate; no client isManager is read. Dollar amounts only while REP_PAY_ENABLED is on. Off (404) unless
// REP_APP_ENABLED=true (spec D14). Never logs the key, a name or an amount.
// Contract: docs/field-flow-contract.md.
export const prerender = false;

const MAX_BODY = 1024;

const answer = (body: unknown, status = 200) => {
  const res = json(body, status);
  res.headers.set('cache-control', 'no-store');
  return res;
};

export const POST: APIRoute = async (context) => {
  if (!repAppEnabled()) return answer({ error: 'Not found.' }, 404);
  const { request } = context;
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return answer({ error: 'Invalid content type.' }, 415);
  }
  let key: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return answer({ error: 'Request too large.' }, 413);
    key = JSON.parse(text)?.referralKey;
  } catch {
    return answer({ error: 'Invalid request body.' }, 400);
  }
  if (!isReferralKey(key)) return answer({ error: 'This link does not work.' }, 404);

  let ip: string;
  try {
    ip = context.clientAddress;
  } catch {
    ip = clientIp(request);
  }
  // 30 per key per 10 minutes plus the per-IP backstop, so a launch meeting of managers
  // behind one address isn't refused. The Rep app is always on past the gate above; the
  // switch is passed so this reads like the other shared routes.
  if (journeyLimited('team', String(key), ip, 30, repAppEnabled())) {
    return answer({ error: 'Too many tries. Please wait a few minutes.' }, 429);
  }

  try {
    const raw = await listTeam(String(key));
    // Pay on shows ledger amounts; the plan (null when it doesn't parse) words promises only.
    const pay = repPayEnabled();
    const plan = pay ? repPayPlan() : null;
    // The staffing plan words staffing promises only (slice S5); amounts are the ledger's.
    const staffing = pay ? repStaffingPlan() : null;
    // `terms` names the pay terms this answer was worded from (payTerms in rep-pay-plan.mjs),
    // so the page drops any promise it worded from other terms (Codex P1s on #113).
    return answer({ ...shapeTeam(raw, plan, undefined, { pay, staffing }), terms: payTerms(pay, plan, staffing) });
  } catch (err) {
    if (err instanceof ReferralKeyUnknownError) {
      return answer({ error: 'No one is on your team in the HSBS app right now.', none: true }, 404);
    }
    if (err instanceof ReferralAppConfigError) {
      console.error('team: FIELD_FLOW_URL is not set');
      return answer({ error: 'Your team did not load.' }, 503);
    }
    if (err instanceof ReferralAppTimeoutError) {
      console.error('team: flow timed out');
      return answer({ error: 'Your team did not load.' }, 504);
    }
    console.error('team: flow failed', err instanceof ReferralAppWriteError ? err.status : 0);
    return answer({ error: 'Your team did not load.' }, 502);
  }
};
