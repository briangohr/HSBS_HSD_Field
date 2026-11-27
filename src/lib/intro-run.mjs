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
  MIN_AGE_SECONDS,
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
/** Stop starting referrals after this long. The deployed function stops at 60 seconds. */
export const BUDGET_MS = 25_000;
export const MAX_REFERRALS_PER_RUN = 25;
/** Rows one read returns. Spent rows are stepped past without work, so a page can be wide. */
const PAGE_ROWS = 500;
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

const PAGE = 100;
const MAX_PAGES = 20;
/**
 * Read up to MAX_PAGES pages from `skip`. `truncated` means rows remain past the last page.
 * @param {any} store
 */
async function readWindow(store, query, startSkip = 0) {
  const rows = [];
  let skip = startSkip;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { items, next } = await store.read({ ...query, top: PAGE, skip });
    rows.push(...items);
    if (next == null) return { rows, truncated: false };
    skip = next;
  }
  return { rows, truncated: true };
}

/** @param {any} store */
async function readAll(store, query) {
  return (await readWindow(store, query)).rows;
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
 * @returns {Promise<{ ok: true, skipped?: string, scanned: number, introduced: number, held: number, retried: number, alerts: number, deferred: number, dryRun: boolean, plan: Record<string, number> }>}
 */
export async function runIntro({ store, now = new Date(), dryRun = false, clock = Date.now }) {
  const nowMs = now.getTime();
  const startedAt = clock();
  const today = etDate(now);
  const out = { ok: /** @type {const} */ (true), scanned: 0, introduced: 0, held: 0, retried: 0, alerts: 0, deferred: 0, dryRun, plan: /** @type {Record<string, number>} */ ({}) };

  const settings = await readSettings(store);
  if (!settings.enabled) return { ...out, skipped: 'off' };

  let lock;
  if (!dryRun) {
    lock = await takeLock(store, nowMs);
    if (!lock) return { ...out, skipped: 'locked' };
  }
  // Where the last run stopped. Every run resumes after it, so no row waits behind stuck ones.
  const cursor = lock ? { lastId: lock.lastId } : await readCursor(store);
  try {
    await work();
  } finally {
    if (lock) {
      try {
        // The lock row also holds the cursor: CaseId is the last referral the job stepped past.
        await patchFresh(store, 'Field Send Log', lock, { Result: 'Free', LastTry: iso(nowMs), CaseId: cursor.lastId });
      } catch {
        // A lock left Held frees itself after LOCK_MINUTES.
      }
    }
  }
  return out;

  async function work() {
    const referralQuery = {
      list: 'Referrals',
      where: [
        { column: 'Source', op: 'eq', value: 'Rep app' },
        { column: 'Route', op: 'eq', value: 'Direct to partner' },
        { column: 'Introduced_x0020_On', op: 'eq', value: null },
      ],
    };
    // One bounded page after the cursor, in ID order. Nothing left after it: start from the top.
    const page = async (after) =>
      (await store.read({ ...referralQuery, where: [...referralQuery.where, { column: 'ID', op: 'gt', value: after }], top: PAGE_ROWS })).items;
    let referrals = await page(cursor.lastId);
    if (referrals.length === 0 && cursor.lastId > 0) {
      cursor.lastId = 0;
      referrals = await page(0);
    }
    const routing = new Map();
    for (const row of await readAll(store, { list: 'Routing' })) {
      const route = readRoute(row.fields);
      if (route.name) routing.set(route.name, route);
    }

    for (const [index, row] of referrals.entries()) {
      const ref = readReferral(row.id, row.fields);
      // IDs rise with creation time, so a referral too young to send means every later one is too.
      const createdMs = Date.parse(ref.created);
      if (!Number.isNaN(createdMs) && nowMs - createdMs < MIN_AGE_SECONDS * 1000) break;
      if (!isCandidate(ref, nowMs)) {
        cursor.lastId = row.id; // spent: step past it at no cost
        continue;
      }
      // Out of time or at the cap: leave the rest for the next run. Every step is safe to repeat.
      // The cursor stops here, so nothing after it is stepped past unseen.
      if (out.scanned >= MAX_REFERRALS_PER_RUN || clock() - startedAt >= BUDGET_MS) {
        out.deferred = referrals.slice(index).filter((r) => isCandidate(readReferral(r.id, r.fields), nowMs)).length;
        break;
      }
      cursor.lastId = row.id;
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
      else if (step.kind === 'alert_tries' && kase) await alertTries(ref, step, kase);
      else if (step.kind === 'alert_maybe' && kase) await alertMaybe(ref, step, kase, route);
    }

    // Plan again from what is now stored. The stamp goes last, and only when every known name is done.
    const touched = plan.names.some((step) => step.kind === 'send' || step.kind === 'patch_case');
    if (touched) {
      cases = await loadCases();
      logs = await readLogs(cases, routing);
      plan = planReferral(ref, { routing, cases, logs: logs.map, nowMs, today });
    }
    await stopRetriesIfSpent(row, plan);
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

  /** @returns {Promise<boolean>} true when the alert is known to have gone out (now or before) */
  async function alertOnce(key, subject, ref) {
    if (await findLog(store, key)) return true;
    // Send first, then write the row: a crash in between repeats an alert, never loses one.
    try {
      await store.send(alertMail(subject, ref));
    } catch {
      return false; // not delivered: the next run tries again
    }
    out.alerts += 1;
    try {
      await store.create({ list: 'Field Send Log', fields: { Title: key, Kind: 'alert', CaseId: 0, Result: 'Sent', Tries: 1, LastTry: iso(nowMs), Note: '' } });
    } catch {
      // Delivered, row not written: a repeat alert next run, never a lost one.
    }
    return true;
  }

  async function alertTries(ref, step, kase) {
    await alertOnce(`alerted:${kase.id}`, `HSBS intro not sent after ${MAX_TRIES} tries: ${step.name}`, ref);
  }

  /**
   * The referral-level Intro Tries cutoff takes the whole referral out of later runs, so set it only
   * when no partner still has work and every spent partner's alert is confirmed.
   */
  async function stopRetriesIfSpent(row, plan) {
    const spent = plan.names.filter((n) => n.kind === 'alert_tries');
    if (spent.length === 0) return;
    const open = plan.names.some((n) => ['create_case', 'send', 'wait', 'patch_case', 'alert_maybe'].includes(n.kind));
    if (open) return;
    for (const n of spent) if (!(await findLog(store, `alerted:${n.caseId}`))) return;
    try {
      await patchFresh(store, 'Referrals', row, { Intro_x0020_Tries: MAX_TRIES });
    } catch {
      // Every spent case already has its alert row, so a later run repeats nothing.
    }
  }

  async function alertMaybe(ref, step, kase, route) {
    // Same key the planner reads: held:<case> for an unroutable partner, intro:<case> otherwise.
    const log = await findLog(store, route?.routable === false ? heldKey(kase.id) : introKey(kase.id));
    if (!log || logRow(log)?.result === 'Alerted') return;
    if (!(await alertOnce(`maybe:${kase.id}`, `HSBS intro may or may not have gone out: ${step.name}. Check before sending again`, ref))) return;
    try {
      await patchFresh(store, 'Field Send Log', log, { Result: 'Alerted' });
    } catch {
      // The maybe row above already stops a second alert.
    }
  }

  function alertMail(subject, ref) {
    const html = ref
      ? `<p>Referral ${esc(ref.ref)}.</p><p>${esc(subject)}.</p><p>To try again, set Intro Tries to 0 on the referral and clear the Field Send Log row for the case.</p>`
      : `<p>${esc(subject)}.</p>`;
    return { to: [settings.mailOwner], cc: [], replyTo: settings.replyTo, subject: `${ref?.test ? '[TEST] ' : ''}${subject}`.slice(0, 300), html };
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
  const rows = await lockRows(store);
  const found = rows[0];
  if (!found) {
    let made;
    try {
      made = await store.create({
        list: 'Field Send Log',
        fields: { Title: 'lock:intro', Kind: 'lock', CaseId: 0, Result: 'Held', Tries: 0, LastTry: iso(nowMs), Note: '' },
      });
    } catch {
      return undefined;
    }
    // Two requests can both see no lock and both create one. The gateway does not enforce unique
    // titles, so the lowest id is the lock and every other creator backs off.
    const after = await lockRows(store).catch(() => []);
    if (after[0] && after[0].id !== made.id) {
      try {
        await store.patch({ list: 'Field Send Log', id: made.id, etag: made.etag, fields: { Result: 'Free', LastTry: iso(nowMs) } });
      } catch {
        // A spare lock row stays Held at most LOCK_MINUTES and is never the lowest id.
      }
      return undefined;
    }
    return { id: made.id, etag: made.etag, lastId: 0 };
  }
  const row = logRow(found);
  if (row.result === 'Held' && nowMs - row.lastTryMs < LOCK_MINUTES * 60_000) return undefined;
  try {
    // The etag makes this atomic: of two requests that both read it, one gets 412.
    const claimed = await store.patch({ list: 'Field Send Log', id: found.id, etag: found.etag, fields: { Result: 'Held', LastTry: iso(nowMs) } });
    return { id: found.id, etag: claimed.etag, ...cursorOf(found) };
  } catch {
    return undefined;
  }
}

/** The cursor kept on the lock row. Bad or missing numbers start from the top. */
function cursorOf(row) {
  const n = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
  return { lastId: n(row?.fields?.CaseId) };
}

/** Dry run reads the cursor without taking the lock. */
async function readCursor(store) {
  return cursorOf((await lockRows(store))[0]);
}

/** Every lock row, lowest id first. The lowest id is the lock. */
async function lockRows(store) {
  const { items } = await store.read({ list: 'Field Send Log', where: [{ column: 'Title', op: 'eq', value: 'lock:intro' }], top: 10 });
  return [...items].sort((x, y) => x.id - y.id);
}
