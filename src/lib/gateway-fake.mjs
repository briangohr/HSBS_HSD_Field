// In-memory stand-in for the gateway store port (lean rebuild). Same four operations as
// `gatewayStore` in gateway.mjs, same error kinds, plus fault injection so tests can break
// any call in the three ways a real call breaks. Test double only. Nothing imports it from
// a page or a route.
import { GatewayError } from './gateway.mjs';

/**
 * Fault modes:
 *   fail          the call does nothing and throws a clear 'failed'
 *   maybe_before  the call does nothing and throws 'maybe' (a timeout before the write)
 *   maybe_after   the call is done, then throws 'maybe' (a timeout after the write)
 * @typedef {{ op: 'read' | 'create' | 'patch' | 'send', list?: string, nth?: number, mode: 'fail' | 'maybe_before' | 'maybe_after' }} Fault
 */

/**
 * @param {{ lists?: Record<string, Record<string, unknown>[]>, faults?: Fault[], allowRecipients?: string[] }} [setup]
 */
export function createFakeStore({ lists = {}, faults = [], allowRecipients } = {}) {
  /** @type {Map<string, { id: number, version: number, fields: Record<string, unknown> }[]>} */
  const data = new Map();
  const nextId = new Map();
  for (const [name, rows] of Object.entries(lists)) {
    data.set(name, rows.map((fields, i) => ({ id: i + 1, version: 1, fields: { ...fields } })));
    nextId.set(name, rows.length + 1);
  }
  const rowsOf = (name) => {
    if (!data.has(name)) data.set(name, []);
    return /** @type {NonNullable<ReturnType<typeof data.get>>} */ (data.get(name));
  };
  const etag = (row) => `"${row.version}"`;

  /** @type {{ op: string, list?: string }[]} */
  const calls = [];
  /** @type {{ to: string[], cc: string[], replyTo: string, subject: string, html: string }[]} */
  const sent = [];
  const counts = new Map();
  let writes = 0;

  /** @returns {Fault['mode'] | null} */
  function faultFor(op, list) {
    const key = `${op}:${list ?? ''}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    const hit = faults.find((f) => f.op === op && (f.list === undefined || f.list === list) && (f.nth === undefined || f.nth === n));
    return hit ? hit.mode : null;
  }

  /** Run `act` with the fault for this call applied. */
  function run(op, list, act) {
    calls.push({ op, list });
    const mode = faultFor(op, list);
    if (mode === 'fail') throw new GatewayError('failed', { status: 400 });
    if (mode === 'maybe_before') throw new GatewayError(op === 'read' ? 'failed' : 'maybe');
    const out = act();
    if (mode === 'maybe_after') throw new GatewayError(op === 'read' ? 'failed' : 'maybe');
    return out;
  }

  // The column `ID` is the row id, like the real gateway.
  const matches = (row, where) =>
    where.every((c) => {
      const v = c.column === 'ID' ? row.id : (row.fields[c.column] ?? null);
      if (c.op === 'gt') return typeof v === 'number' && v > c.value;
      return c.op === 'eq' ? v === c.value : v !== c.value;
    });

  return {
    read: async ({ list, select = [], where = [], top = 100, skip = 0 }) =>
      run('read', list, () => {
        // Ascending ID order, like the real gateway.
        const hits = rowsOf(list).filter((r) => matches(r, where)).sort((a, b) => a.id - b.id);
        const page = hits.slice(skip, skip + top);
        const items = page.map((r) => ({
          id: r.id,
          etag: etag(r),
          fields: select.length ? Object.fromEntries(select.map((c) => [c, r.fields[c] ?? null])) : { ...r.fields },
        }));
        return { items, next: skip + top < hits.length ? skip + top : null };
      }),

    create: async ({ list, fields }) =>
      run('create', list, () => {
        const id = nextId.get(list) ?? 1;
        nextId.set(list, id + 1);
        const row = { id, version: 1, fields: { ...fields } };
        rowsOf(list).push(row);
        writes += 1;
        return { id, etag: etag(row) };
      }),

    patch: async ({ list, id, etag: given, fields }) =>
      run('patch', list, () => {
        const row = rowsOf(list).find((r) => r.id === id);
        if (!row) throw new GatewayError('failed', { status: 404 });
        if (given !== etag(row)) throw new GatewayError('stale', { status: 412 });
        Object.assign(row.fields, fields);
        row.version += 1;
        writes += 1;
        return { etag: etag(row) };
      }),

    send: async ({ to, cc = [], replyTo = '', subject, html }) =>
      run('send', undefined, () => {
        if (allowRecipients && ![...to, ...cc].every((a) => allowRecipients.includes(a))) {
          throw new GatewayError('not_allowed', { status: 403 });
        }
        sent.push({ to: [...to], cc: [...cc], replyTo, subject, html });
        writes += 1;
      }),

    /** What a test asserts on. */
    inspect: {
      calls,
      sent,
      get writes() {
        return writes;
      },
      rows: (list) => rowsOf(list).map((r) => ({ id: r.id, etag: etag(r), fields: { ...r.fields } })),
    },
  };
}
