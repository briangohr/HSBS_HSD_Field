// Small shared rules for the field app's forms: the link key and submission id shapes, the
// contact choices and the sending and timeout words. Plain JS so the page scripts and
// node --test can both import it. It does not know the flow URL and holds no keys.

/** URL-safe, at least 24 characters. A short slug is refused. */
export const isReferralKey = (key) => typeof key === 'string' && /^[A-Za-z0-9_-]{24,128}$/.test(key);

/** One id per form fill. Try again sends the same id. crypto.randomUUID() matches. */
export const isSubmissionId = (id) =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

/** How the doctor's office prefers to be reached. */
export const PREFERRED_CONTACTS = ['Call', 'Text', 'Email'];

/** Shown while the submit request is open. The flow can take the better part of a minute. */
export const SENDING_MESSAGE = 'Sending, this can take up to a minute';

/**
 * The flow may have created the row before our wait ended. Do not offer another send.
 * Brian Gohr's roster address.
 */
export const TIMEOUT_MESSAGE =
  'This is taking too long. It may already have gone through. Do not send it again. Email Brian at Brian.Gohr@henryschein.com.';

/** The browser waits longer than the server fetch so it can show the server's timeout answer. */
export const CLIENT_WAIT_MS = 65_000;

/** @param {unknown} name */
export function firstName(name) {
  const base = String(name ?? '').trim().split(',')[0] ?? '';
  return base.split(/\s+/).filter(Boolean)[0] ?? '';
}
