import type { APIRoute } from 'astro';
import { introJob } from '../../../lib/intro-job.mjs';

// The intro job (lean rebuild U1). A timer flow posts here with header X-Job-Secret. It reads new
// Referrals through the HSBS GW gateway, creates the Service Cases, sends the intro mail and
// stamps the referral. Off (404) unless REP_APP_ENABLED, GATEWAY_ENABLED and INTRO_CODE_ENABLED are
// all exactly true. Answers counts only. Contract: docs/field-flow-contract.md, "HSBS GW".
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { status, body } = await introJob({ secret: request.headers.get('x-job-secret') });
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
};
