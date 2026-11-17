import type { APIRoute } from 'astro';
import { isReferralKey } from '../../../lib/field-form.mjs';
import { repAppEnabled } from '../../../lib/register-flow.mjs';

// One install manifest per personal link. start_url is that link, so the
// installed app opens this person's field app. It does not list any other key.
// Off (404) unless REP_APP_ENABLED=true.
export const prerender = false;

export const GET: APIRoute = ({ params }) => {
  const key = String(params.key ?? '');
  if (!repAppEnabled() || !isReferralKey(key)) {
    return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  }
  const start = `/refer/${key}`;
  const body = {
    id: start,
    name: 'HSBS Referral',
    short_name: 'HSBS Referral',
    description: 'Henry Schein Business Solutions referral',
    start_url: start,
    scope: '/refer/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#002f6d',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/manifest+json',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
};
