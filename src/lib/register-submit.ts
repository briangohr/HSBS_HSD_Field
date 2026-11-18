// One server path for a rep sign-up, used by /api/register (the page's script) and by
// /join itself when it receives a plain form POST (no JavaScript). Both get the same
// checks, the same limit and the same answer. Contract: docs/field-flow-contract.md.
import { env, ipBucket, keyBucket, keyRefund, keyReserve, rateLimited } from './http';
import {
  RegisterConfigError,
  RegisterRefusedError,
  RegisterTimeoutError,
  RegisterWriteError,
  postRegistration,
} from './register-flow.mjs';
import { SENT_MESSAGE, parseRgms, registerPayload, sourceFor, validateRegistration } from './register-form.mjs';

/** The RGM pick list from Vercel env; [] keeps the free-text form. */
export const joinRgms = () => parseRgms(env('JOIN_RGMS'));

/**
 * Per email from one address per 10 minutes, per server instance. A speed bump; 1J holds
 * the real limits (one link email per 10 minutes). Keyed on email plus IP, so nobody can
 * lock a colleague out by posting their address from somewhere else. Only sends 1J may
 * have acted on count (see notActedOn), so a 1J outage doesn't use up the allowance. A
 * send refused by this limit adds no count, and a failed send gives back only its own.
 */
const EMAIL_LIMIT = 5;

/**
 * True when the send should give its email count back: no flow URL, a refused
 * connection, a 4xx refusal of the fields, a 429 (busy, the run never started) or a 5xx
 * other than 504. A 502 can come after 1J wrote the row and queued the welcome (a run
 * that fails before its Response action); a retry then takes 1J's repeat path, which
 * Link Resends caps, so giving the count back still adds no row and floods no inbox.
 * A timeout, a 408, a 504, a 202, a dropped connection or a 200 without {"ok":true}
 * may have gone through, so those still count.
 */
export function notActedOn(err: unknown): boolean {
  if (err instanceof RegisterConfigError || err instanceof RegisterRefusedError) return true;
  if (!(err instanceof RegisterWriteError)) return false;
  const { status, notSent } = err as RegisterWriteError & { status: number; notSent: boolean };
  if (status === 0) return notSent === true;
  return status === 429 || (status >= 500 && status !== 504);
}

/**
 * Sign-ups per IP per 10 minutes, per server instance. Each distinct email is a 1J run, a
 * Rep Roster row and a welcome email, so this stays well under the rep routes' backstop.
 * 200 lets a 150-person launch meeting behind one corporate address sign up at once.
 * REGISTER_IP_LIMIT overrides it: raise it for a launch window, then set it back.
 */
export const REGISTER_IP_DEFAULT = 200;
const registerIpLimit = () => Number(env('REGISTER_IP_LIMIT')) || REGISTER_IP_DEFAULT;

export const REGISTER_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'mobile',
  'role',
  'managerName',
  'managerEmail',
  'branch',
  'rgm',
  'src',
] as const;

export type SubmitResult = {
  status: number;
  ok?: true;
  message?: string;
  errors?: Record<string, string>;
  error?: string;
  timeout?: true;
};

/** Pick only the known fields, as strings. */
export function pickFields(source: (k: string) => unknown): Record<string, string> {
  return Object.fromEntries(
    REGISTER_FIELDS.map((k) => {
      const v = source(k);
      return [k, typeof v === 'string' ? v : ''];
    }),
  );
}

export async function submitRegistration(data: Record<string, string>, ip: string): Promise<SubmitResult> {
  if (rateLimited(ipBucket('register', ip), registerIpLimit())) {
    return { status: 429, error: 'Too many tries. Please wait a few minutes.' };
  }
  const rgms = joinRgms();
  const result = validateRegistration(data, rgms);
  if (!result.ok) return { status: 422, errors: result.errors };
  // The bucket holds a hash of the email and IP, never the address.
  // A refused send adds no count; an admitted one holds its own, which only it gives back.
  const emailBucket = keyBucket('register', `${result.value.email}|${ip}`);
  const hold = keyReserve(emailBucket, EMAIL_LIMIT);
  if (!hold) {
    return { status: 429, error: 'Too many tries. Please wait a few minutes.' };
  }

  try {
    await postRegistration(registerPayload(result.value, sourceFor(data.src)));
  } catch (err) {
    // The per-IP count stays; only the email allowance is given back.
    if (notActedOn(err)) keyRefund(emailBucket, hold);
    if (err instanceof RegisterRefusedError) {
      return {
        status: 422,
        error: rgms.length
          ? 'Check your Henry Schein email, then try again.'
          : "Check your Henry Schein email and your manager's, then try again.",
      };
    }
    if (err instanceof RegisterConfigError) {
      console.error('register: REGISTER_FLOW_URL is not set');
      return { status: 503, error: 'Sign-up is not available right now.' };
    }
    if (err instanceof RegisterTimeoutError) {
      console.error('register: flow timed out');
      return {
        status: 504,
        timeout: true,
        error: 'This may have gone through. Check your email in a few minutes before you try again.',
      };
    }
    console.error('register: flow failed', err instanceof Error && 'status' in err ? (err as { status: number }).status : 0);
    return { status: 502, error: 'Sign-up is not available right now.' };
  }
  return { status: 200, ok: true, message: SENT_MESSAGE };
}
