// Lean rebuild U1: the intro job. Takes a store (the four gateway operations, or the fake in
// tests) and does for every new referral what HSBS 3F HealthFirst and 3F Staffing do, in the
// order the build spec sets: case first, mail second, stamp last. Every decision is in
// intro-plan.mjs; this file only reads, writes and sends what the plan says.
//
// Safety rules, each pinned by a test:
//   - A mail is claimed in the Field Send Log before it is sent, and a mail with no clear
//     answer is never sent again. It becomes an alert for the owner.
//   - A retry does only what is missing. A case already Sent is never mailed again.
//   - One job at a time (a lock row). A lock older than 4 minutes is stale.
//   - The answer holds counts only. No name, address or id leaves this module.
//   - Dry run reads and plans. It writes and sends nothing.

import { etDate } from './field-rules.mjs';
import { buildIntroMail } from './intro-mail.mjs';
import {
  MAX_TRIES,
  heldKey,
  introKey,
  isCandidate,
  partnerNames,
  planReferral,
  readReferral,
  readRoute,
  unknownKey,
} from './intro-plan.mjs';

export const LOCK_MINUTES = 4;
/** Most referrals one run works, so a backlog cannot run past the function limit. */
export const MAX_REFERRALS_PER_RUN = 25;
const STALE_RETRIES = 3;
const SENT_DISPATCH = 'Sent delivery unverified';

const kindOf = (err) => (err && typeof err === 'object' && 'kind' in err ? String(err.kind) : 'failed');
const iso = (ms) => new Date(ms).toISOString();

/** Raised when the Field Settings rows the job needs are missing. */
export class IntroSettingsError extends Error {
  constructor() {
    super('intro: Field Settings rows missing');
    this.name = 'IntroSettingsError';
  }
}

/** @param {any} store */
async function readAll(store, query) {
  const out = [];
  let skip = 0;
  for (let page = 0; page < 20; page += 1) {
    const { items, next } = await store.read({ ...query, top: 100, skip });
    out.push(...items);
    if (next == null) return out;
    skip = next;
  }
  return out;
}

/** @param {any} store */
async function readSettings(store) {
  const rows = await readAll(store, { list: 'Field Settings' });
  const get = (key) => String(rows.find((r) => r.fields.Title === key)?.fields.Value ?? '').trim();
  const settings = {
    mailOwner: get('MailOwner'),
    introCc: get('IntroCc'),
    replyTo: get('IntroReplyTo'),
    signatureEmail: get('IntroSignatureEmail'),
    enabled: get('IntroEnabled').toLowerCase() !== 'no',
  };
  if (!settings.mailOwner || !settings.replyTo || !settings.signatureEmail) throw new IntroSettingsError();
  return settings;
}

const logRow = (row) =>
  row
    ? {
        id: row.id,
        etag: row.etag,
        result: String(row.fields.Result ?? ''),
        tries: Number.isSafeInteger(row.fields.Tries) ? row.fields.Tries : 0,
        lastTryMs: Date.parse(String(row.fields.LastTry ?? '')) || 0,
      }
    : undefined;

/** @param {any} store @param {string} key */
async function findLog(store, key) {
  const { items } = await store.read({ list: 'Field Send Log', where: [{ column: 'Title', op: 'eq', value: key }], top: 1 });
  return items[0];
}

/** Patch with the current etag, rereading and retrying when it went stale. */
async function patchFresh(store, list, row, fields) {
  let etag = row.etag;
  for (let attempt = 0; attempt < STALE_RETRIES; attempt += 1) {
    try {
      return await store.patch({ list, id: row.id, etag, fields });
    } catch (err) {
      if (kindOf(err) !== 'stale') throw err;
      const { items } = await store.read({ list, where: [{ column: 'ID', op: 'eq', value: row.id }], top: 1 });
      if (!items[0]) throw err;
      etag = items[0].etag;
    }
  }
  throw Object.assign(new Error('intro: etag stayed stale'), { kind: 'stale' });
}

/**
 * @param {{ store: any, now?: Date, dryRun?: boolean }} job
 * @returns {Promise<{ ok: true, skipped?: string, scanned: number, introduced: number, held: number, retried: number, alerts: number, dryRun: boolean, plan: Record<string, number> }>}
 */
export async function runIntro({ store, now = new Date(), dryRun = false }) {
  const nowMs = now.getTime();
  const today = etDate(now);
  const out = { ok: /** @type {const} */ (true), scanned: 0, introduced: 0, held: 0, retried: 0, alerts: 0, dryRun, plan: /** @type {Record<string, number>} */ ({}) };

  const settings = await readSettings(store);
  if (!settings.enabled) return { ...out, skipped: 'off' };

  let lock;
  if (!dryRun) {
    lock = await takeLock(store, nowMs);
    if (!lock) return { ...out, skipped: 'locked' };
  }
  try {
    await work();
  } finally {
    if (lock) {
      try {
        await patchFresh(store, 'Field Send Log', lock, { Result: 'Free', LastTry: iso(nowMs) });
      } catch {
        // A lock left Held frees itself after LOCK_MINUTES.
      }
    }
  }
  return out;

  async function work() {
    const referrals = await readAll(store, {
      list: 'Referrals',
      where: [
        { column: 'Source', op: 'eq', value: 'Rep app' },
        { column: 'Route', op: 'eq', value: 'Direct to partner' },
        { column: 'Introduced_x0020_On', op: 'eq', value: null },
      ],
    });
    const routing = new Map();
    for (const row of await readAll(store, { list: 'Routing' })) {
      const route = readRoute(row.fields);
      if (route.name) routing.set(route.name, route);
    }
    const candidates = referrals
      .map((row) => ({ row, ref: readReferral(row.id, row.fields) }))
      .filter(({ ref }) => isCandidate(ref, nowMs))
      .slice(0, MAX_REFERRALS_PER_RUN);

    for (const { row, ref } of candidates) {
      out.scanned += 1;
      try {
        await oneReferral(row, ref, routing);
      } catch {
        // One bad referral never stops the rest. The next run reads it again.
      }
    }
  }

  async function oneReferral(row, ref, routing) {
    const names = partnerNames(ref);
    /** @type {Map<string, { id: number, etag: string, sent: boolean }>} */
    let cases = new Map();
    const loadCases = async () => {
      const found = new Map();
      for (const name of names) {
        const { items } = await store.read({
          list: 'Service Cases',
          where: [{ column: 'Title', op: 'eq', value: caseTitle(ref, name) }],
          top: 1,
        });
        if (items[0]) found.set(name, { id: items[0].id, etag: items[0].etag, sent: items[0].fields.Dispatch === SENT_DISPATCH });
      }
      return found;
    };
    cases = await loadCases();
    let logs = await readLogs(cases, routing);
    let plan = planReferral(ref, { routing, cases, logs: logs.map, nowMs, today });

    // Create missing cases first, then plan again so the mail step sees them.
    let created = false;
    for (const step of plan.names) {
      if (step.kind !== 'create_case' || dryRun) continue;
      const route = routing.get(step.name);
      const made = await store.create({ list: 'Service Cases', fields: caseFields(ref, step.name, route, settings) });
      cases.set(step.name, { id: made.id, etag: made.etag, sent: false });
      created = true;
    }
    if (created) {
      logs = await readLogs(cases, routing);
      plan = planReferral(ref, { routing, cases, logs: logs.map, nowMs, today });
    }
    if (dryRun) {
      for (const step of plan.names) out.plan[step.kind] = (out.plan[step.kind] ?? 0) + 1;
      if (plan.stamp) out.plan.stamp = (out.plan.stamp ?? 0) + 1;
      return;
    }

    const referrerLabel = await roleOf(ref);
    for (const step of plan.names) {
      const route = routing.get(step.name);
      const kase = cases.get(step.name);
      if (step.kind === 'unknown_company') await alertOnce(unknownKey(ref.id, step.name, today), `HSBS intro: no Routing row for ${step.name}`, ref);
      else if (step.kind === 'send') await sendIntro({ ref, step, route, kase, referrerLabel, logs: logs.rows });
      else if (step.kind === 'patch_case' && kase) await markSent(kase);
      else if (step.kind === 'alert_tries' && kase) await alertTries(ref, step, kase, row);
      else if (step.kind === 'alert_maybe' && kase) await alertMaybe(ref, step, kase);
    }

    // Plan again from what is now stored. The stamp goes last, and only when every known name is done.
    const touched = plan.names.some((step) => step.kind === 'send' || step.kind === 'patch_case');
    if (touched) {
      cases = await loadCases();
      logs = await readLogs(cases, routing);
      plan = planReferral(ref, { routing, cases, logs: logs.map, nowMs, today });
    }
    if (plan.stamp) {
      await patchFresh(store, 'Referrals', row, {
        Introduced_x0020_On: plan.stamp.introducedOn,
        Next_x0020_Update_x0020_Due: plan.stamp.nextUpdateDue,
        Last_x0020_Notified_x0020_Status: plan.stamp.lastNotifiedStatus,
      });
      out.introduced += 1;
    }
  }

  async function readLogs(cases, routing) {
    const map = new Map();
    const rows = new Map();
    for (const [name, kase] of cases) {
      const key = routing.get(name)?.routable === false ? heldKey(kase.id) : introKey(kase.id);
      const found = await findLog(store, key);
      if (found) {
        map.set(key, logRow(found));
        rows.set(key, found);
      }
    }
    return { map, rows };
  }

  async function roleOf(ref) {
    if (!ref.repEmail) return '';
    try {
      const { items } = await store.read({ list: 'Rep Roster', where: [{ column: 'RepEmail', op: 'eq', value: ref.repEmail }], top: 1 });
      return String(items[0]?.fields.Role ?? '').trim();
    } catch {
      return '';
    }
  }

  async function markSent(kase) {
    await patchFresh(store, 'Service Cases', kase, { Status: 'Sent', Dispatch: SENT_DISPATCH });
  }

  async function sendIntro({ ref, step, route, kase, referrerLabel, logs }) {
    if (!kase) return;
    const key = route.routable ? introKey(kase.id) : heldKey(kase.id);
    const existing = logs.get(key);
    const tries = (existing ? logRow(existing).tries : 0) + 1;
    // Claim before sending. A claim that cannot be written means no mail.
    let claim;
    try {
      claim = existing
        ? await patchFresh(store, 'Field Send Log', existing, { Result: 'Claimed', Tries: tries, LastTry: iso(nowMs) })
        : await store.create({
            list: 'Field Send Log',
            fields: { Title: key, Kind: route.routable ? 'intro' : 'held', CaseId: kase.id, Result: 'Claimed', Tries: tries, LastTry: iso(nowMs), Note: '' },
          });
    } catch {
      return;
    }
    const row = existing ? { ...existing, etag: claim.etag } : { id: claim.id, etag: claim.etag };
    if (tries > 1) out.retried += 1;
    let result = 'Sent';
    let note = '';
    try {
      await store.send(buildIntroMail({ referral: ref, service: step.name, route, referrerLabel, settings }));
    } catch (err) {
      note = kindOf(err);
      result = note === 'maybe' ? 'Maybe' : 'Failed';
    }
    try {
      await patchFresh(store, 'Field Send Log', row, { Result: result, LastTry: iso(nowMs), Note: note });
    } catch {
      return; // the row stays Claimed: the plan reads that as a send with no clear answer
    }
    if (result !== 'Sent') return;
    if (route.routable) {
      await markSent(kase);
    } else {
      out.held += 1;
    }
  }

  async function alertOnce(key, subject, ref) {
    if (await findLog(store, key)) return;
    // Send first, then write the row: a crash in between repeats an alert, never loses one.
    try {
      await store.send(alertMail(subject, ref));
      out.alerts += 1;
      await store.create({ list: 'Field Send Log', fields: { Title: key, Kind: 'alert', CaseId: 0, Result: 'Sent', Tries: 1, LastTry: iso(nowMs), Note: '' } });
    } catch {
      // No row means the alert is tried again on the next run.
    }
  }

  async function alertTries(ref, step, kase, row) {
    const key = `alerted:${kase.id}`;
    if (await findLog(store, key)) return;
    await alertOnce(key, `HSBS intro not sent after ${MAX_TRIES} tries: ${step.name}`, ref);
    try {
      await patchFresh(store, 'Referrals', row, { Intro_x0020_Tries: MAX_TRIES });
    } catch {
      // The log row above already stops a second alert.
    }
  }

  async function alertMaybe(ref, step, kase) {
    const log = await findLog(store, introKey(kase.id));
    if (!log || logRow(log)?.result === 'Alerted') return;
    await alertOnce(`maybe:${kase.id}`, `HSBS intro may or may not have gone out: ${step.name}. Check before sending again`, ref);
    try {
      await patchFresh(store, 'Field Send Log', log, { Result: 'Alerted' });
    } catch {
      // The maybe row above already stops a second alert.
    }
  }

  function alertMail(subject, ref) {
    const html = `<p>Referral ${esc(ref.ref)}.</p><p>${esc(subject)}.</p><p>To try again, set Intro Tries to 0 on the referral and clear the Field Send Log row for the case.</p>`;
    return { to: [settings.mailOwner], cc: [], replyTo: settings.replyTo, subject: `${ref.test ? '[TEST] ' : ''}${subject}`.slice(0, 300), html };
  }
}

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Same Title 3F writes: the referral reference, a bar, the service. */
export const caseTitle = (ref, service) => `${ref.ref} | ${service}`;

function caseFields(ref, service, route, settings) {
  return {
    Title: caseTitle(ref, service),
    ReferralId: ref.id,
    Owner: ref.ownerName,
    Receivername: route.routable ? route.contact : 'Not routed',
    Receiveremail: route.routable ? route.email : settings.mailOwner,
    Service: service,
    Status: 'Held',
    Dispatch: 'Not sent',
    Stage: 'New lead',
    Test: ref.test,
  };
}

/** Take the one-job lock. Undefined when another job holds it. */
async function takeLock(store, nowMs) {
  const found = await findLog(store, 'lock:intro');
  if (!found) {
    try {
      const made = await store.create({
        list: 'Field Send Log',
        fields: { Title: 'lock:intro', Kind: 'lock', CaseId: 0, Result: 'Held', Tries: 0, LastTry: iso(nowMs), Note: '' },
      });
      return { id: made.id, etag: made.etag };
    } catch {
      return undefined;
    }
  }
  const row = logRow(found);
  if (row.result === 'Held' && nowMs - row.lastTryMs < LOCK_MINUTES * 60_000) return undefined;
  try {
    const claimed = await store.patch({ list: 'Field Send Log', id: found.id, etag: found.etag, fields: { Result: 'Held', LastTry: iso(nowMs) } });
    return { id: found.id, etag: claimed.etag };
  } catch {
    return undefined;
  }
}
