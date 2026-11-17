import type { APIRoute } from 'astro';
import { decorateReferrals } from '../../lib/track.mjs';
import { clientIp, journeyLimited, json } from '../../lib/http';
import {
  ReferralAppConfigError,
  ReferralAppTimeoutError,
  ReferralAppWriteError,
  ReferralKeyUnknownError,
} from '../../lib/field-flow.mjs';
import { isReferralKey } from '../../lib/field-form.mjs';
import { repAppEnabled, repPayEnabled, repPayPlan, repStaffingPlan, repPayTerms } from '../../lib/register-flow.mjs';
import { payTerms } from '../../lib/rep-pay-plan.mjs';
import { LedgerReadError, RepUnverifiedError, cachedReferrals, cachedSnapshot, confirmRep, moneyView } from '../../lib/rep-reads.mjs';
import { leadViews } from '../../lib/rep-lead.mjs';
import { repFeed } from '../../lib/rep-track.mjs';

// Track My Referrals. The browser posts the key. This function posts
// { action: "list", referralKey } to FIELD_FLOW_URL and returns only the
// display fields. The key, the flow URL and any echoed secret stay here.
// Off (404) unless REP_APP_ENABLED=true.
export const prerender = false;

const MAX_BODY = 8 * 1024;

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
  if (journeyLimited('referral-list', String(data.referralKey), ip, 30, true)) {
    return json({ error: 'Too many requests. Please try again in a few minutes.' }, 429);
  }

  try {
    const key = String(data.referralKey);
    // Load (11/11): reads go through a 45 second cache (src/lib/flow-cache.mjs), and `fresh`
    // (Refresh, or Track right after a send) skips it. The feed screen can also ask for the
    // rep's money in the same request (`earnings`), so one Track open is one browser call.
    // A cold open (nothing held) is up to THREE flow runs, started together: the list, the
    // ledger and the role check that decides whether the answer may be held. A warm open is
    // zero. Nothing is returned until the lookup confirms a Rep key (confirmRep).
    // The ledger is a bonus: if it fails the list still answers, with money null.
    const fresh = data.fresh === true;
    const cache = true;
    const wantMoney = data.feed === true && data.earnings === true && repPayEnabled();
    // With money wanted, the list and the ledger are read and held as one snapshot, so the
    // two always come from the same moment. If the snapshot fails (the ledger is down, say),
    // the list is read on its own and the money is null: the tiles show "--", never a wrong
    // figure, and nothing half-fresh is held.
    // What the role check found, and whether the read came from memory, for confirmRep.
    let referrer: unknown;
    const seen = (r: unknown) => {
      referrer = r;
    };
    let warm = false;
    const onWarm = () => {
      warm = true;
    };
    const read = async () => {
      if (!wantMoney) return { referrals: await cachedReferrals(key, { fresh, cache, seen, onWarm }), ledger: null as unknown };
      try {
        return await cachedSnapshot(key, { fresh, cache, seen, onWarm });
      } catch (err) {
        if (!(err instanceof LedgerReadError)) throw err; // a bad link, a timeout: as it was
        // The list loaded and the ledger did not: use the list as it is (still three flow runs when cold).
        return { referrals: err.referrals, ledger: null as unknown };
      }
    };
    const { referrals, ledger } = await read();
    // Nothing is returned unless the 1F lookup confirms a Rep key (fails closed).
    await confirmRep(key, { referrer, warm, cache });
    // The Rep app asks for its "Latest updates" feed, and Track's compact rows and lead
    // screens (Brian, 11/9), drawn from these same rows. Other callers get today's shape.
    if (data.feed === true) {
      const view = { ...decorateReferrals(referrals), feed: repFeed(referrals), leads: leadViews(referrals) };
      // The rep app asks for money (`earnings`) when its page was drawn with pay on. Its
      // answer always names the pay terms the server holds now, money or not, so the page
      // can drop promises worded from terms that have changed (Codex P1s on #113).
      if (!wantMoney) return json(data.earnings === true ? { ...view, terms: repPayTerms() } : view);
      let money = null;
      // One read of the plan words the money and names its terms.
      const plan = repPayPlan();
      const staffing = repStaffingPlan();
      if (ledger) {
        try {
          // Pay is on. A plan that doesn't parse is null: amounts from the rows, no promise.
          money = moneyView(referrals, ledger, plan, staffing);
        } catch {
          money = null; // a bad ledger row: the tiles show "--", the list still loads
        }
      }
      return json({ ...view, money, terms: payTerms(true, plan, staffing) });
    }
    return json(decorateReferrals(referrals));
  } catch (err) {
    if (err instanceof RepUnverifiedError) return json({ error: 'Your referrals did not load.' }, 502);
    if (err instanceof ReferralAppConfigError) {
      console.error('referral list: FIELD_FLOW_URL is not set');
      return json({ error: 'Your referrals did not load.' }, 503);
    }
    if (err instanceof ReferralKeyUnknownError) return json({ error: 'This link does not work.' }, 404);
    if (err instanceof ReferralAppTimeoutError) {
      console.error('referral list: flow timed out');
      return json({ error: 'Your referrals did not load.' }, 504);
    }
    const status = err instanceof ReferralAppWriteError ? err.status : 0;
    console.error('referral list: flow failed', status);
    return json({ error: 'Your referrals did not load.' }, 502);
  }
};
