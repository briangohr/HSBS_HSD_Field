import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// The field app (TSM app) for AEs, FSCs and RGMs: /join (sign-up), /refer/<key> (each
// person's own app link) and /update/<key> (a field partner's lead updates), with their
// API routes. Every page and route except /j answers 404 unless REP_APP_ENABLED=true.
// The site talks to three Power Automate flows only: HSBS 1J (sign-up, REGISTER_FLOW_URL),
// HSBS 1F (the app, FIELD_FLOW_URL) and HSBS 7F Field partner (the update page,
// PARTNER_FLOW_URL). Their URLs live in Vercel env.

// Sign-up QR code. /join itself answers 404 until REP_APP_ENABLED=true, so this short link
// is safe to ship before launch.
const repLinks = {
  '/j': { status: 302, destination: '/join?src=qr' },
};

export default defineConfig({
  output: 'static',
  redirects: { ...repLinks },
  // Web Analytics is NOT injected by the adapter: that would put the loader on
  // /refer/<key> and /confirm/<token>, whose URLs are credentials (issue #47). /join loads
  // it through src/components/Analytics.astro.
  // maxDuration 60: Astro emits one server function for every on-demand route. A referral
  // submit waits up to 55s for HSBS 1F and needs a few seconds to answer after that.
  adapter: vercel({ maxDuration: 60 }),
});
