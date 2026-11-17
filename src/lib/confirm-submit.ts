// One server path for a manager's answer, used by /api/confirm (the page's script) and by
// /confirm/<token> itself when it receives a plain form POST (no JavaScript). Opening the
// page never calls this; only a button press does. Contract: docs/field-flow-contract.md.
// Not used by the rep journey at launch (D18); removable later. Callers check
// confirmEnabled() first, so with REP_CONFIRM_ENABLED unset this never runs.
import { keyLimited } from './http';
import {
  ConfirmUnknownError,
  ConfirmUsedError,
  RegisterConfigError,
  RegisterTimeoutError,
  answerConfirm,
  isConfirmToken,
} from './register-flow.mjs';

/** Per confirm link per 10 minutes. The IP counts toward this route's per-IP backstop. */
const TOKEN_LIMIT = 10;

export type ConfirmResult = {
  status: number;
  ok?: true;
  result?: 'confirmed' | 'declined';
  error?: string;
  timeout?: true;
};

export async function submitConfirm(token: unknown, answer: unknown, ip: string): Promise<ConfirmResult> {
  if (!isConfirmToken(token)) return { status: 404, error: 'This link does not work.' };
  if (answer !== 'yes' && answer !== 'no') return { status: 400, error: 'Invalid request body.' };
  if (keyLimited('confirm', token, ip, TOKEN_LIMIT)) {
    return { status: 429, error: 'Too many tries. Please wait a few minutes.' };
  }
  try {
    const result = await answerConfirm(token, answer);
    return { status: 200, ok: true, result };
  } catch (err) {
    if (err instanceof ConfirmUnknownError) return { status: 404, error: 'This link does not work.' };
    if (err instanceof ConfirmUsedError) return { status: 410, error: 'This link was already used or has expired.' };
    if (err instanceof RegisterConfigError) {
      console.error('confirm: REGISTER_FLOW_URL is not set');
      return { status: 503, error: 'This is not available right now.' };
    }
    if (err instanceof RegisterTimeoutError) {
      console.error('confirm: flow timed out');
      return { status: 504, timeout: true, error: 'This may have gone through. Open the link again in a few minutes to check.' };
    }
    console.error('confirm: flow failed', err instanceof Error && 'status' in err ? (err as { status: number }).status : 0);
    return { status: 502, error: 'This is not available right now.' };
  }
}
