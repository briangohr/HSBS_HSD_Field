// The request side of the intro job (lean rebuild U1): the switches, the secret, and the answer.
// `src/pages/api/jobs/intro.ts` is a thin wrapper. The timer flow posts here every few minutes
// with header X-Job-Secret. Off (404) unless REP_APP_ENABLED, GATEWAY_ENABLED and
// INTRO_CODE_ENABLED are all exactly true. INTRO_CODE_DRY_RUN=true plans and writes nothing.
// The answer holds counts only. This module never logs a name, an address or an id.

import { timingSafeEqual } from 'node:crypto';
import { gatewayEnabled, gatewayStore } from './gateway.mjs';
import { IntroSettingsError, runIntro } from './intro-run.mjs';

const env = (k) => (typeof process === 'undefined' ? undefined : process.env[k]);

export const introCodeEnabled = () => gatewayEnabled() && env('INTRO_CODE_ENABLED') === 'true';

/** Constant-time compare of the header with JOB_SECRET (at least 16 characters). */
export function jobSecretOk(given) {
  const secret = String(env('JOB_SECRET') ?? '');
  if (secret.length < 16 || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * @param {{ secret: string | null, store?: any, now?: Date }} req
 * @returns {Promise<{ status: number, body: Record<string, unknown> }>}
 */
export async function introJob({ secret, store = gatewayStore, now = new Date() }) {
  if (!introCodeEnabled()) return { status: 404, body: { error: 'Not found.' } };
  if (!jobSecretOk(secret)) return { status: 401, body: { error: 'unauthorized' } };
  try {
    return { status: 200, body: await runIntro({ store, now, dryRun: env('INTRO_CODE_DRY_RUN') === 'true' }) };
  } catch (err) {
    const kind = err instanceof IntroSettingsError ? 'settings' : err && typeof err === 'object' && 'kind' in err ? String(err.kind) : 'failed';
    console.error(`intro job: ${kind}`);
    return { status: 503, body: { ok: false, error: kind === 'settings' ? 'settings' : 'failed' } };
  }
}
