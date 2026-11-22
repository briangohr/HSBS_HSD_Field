// G2 findings 9 and 12. A page whose URL carries a secret (Referral Key, Link Key,
// confirm token) sets no-store and noindex on every answer, the switch-off 404 included.
// The per-IP limit has no LEAD_RATE_LIMIT setting: every caller names its own limit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import { SECRET_URL_HEADERS, rateLimited, secretUrlNotFound } from './http.ts';

const saved = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});

describe('secret-URL pages', () => {
  test('the switch-off 404 is plain text with no-store and noindex', async () => {
    const res = secretUrlNotFound();
    assert.equal(res.status, 404);
    assert.equal(await res.text(), 'Not found');
    assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  });

  test('the shared headers are exactly no-store and noindex, nofollow', () => {
    assert.deepEqual({ ...SECRET_URL_HEADERS }, { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  });

  for (const [file, gate] of [
    ['../pages/refer/[key].astro', 'if (!repAppEnabled())'],
    ['../pages/update/[key].astro', 'if (!partnerPageEnabled())'],
    ['../pages/confirm/[token].astro', 'if (!confirmEnabled())'],
  ]) {
    test(`${file}: the switch-off answer is secretUrlNotFound`, () => {
      const src = readFileSync(new URL(file, import.meta.url), 'utf8');
      const at = src.indexOf(gate);
      assert.ok(at > 0, 'has the gate');
      assert.match(src.slice(at, at + 120), /return secretUrlNotFound\(\);/);
      assert.equal(src.includes("new Response('Not found'"), false, 'no bare 404 left');
    });
  }

  test('/confirm/<token> sets both headers before any state can return the page', () => {
    const src = readFileSync(new URL('../pages/confirm/[token].astro', import.meta.url), 'utf8');
    const set = src.indexOf('Object.entries(SECRET_URL_HEADERS)');
    assert.ok(set > 0, 'sets the shared headers');
    assert.ok(set < src.indexOf('peekConfirm('), 'before the 1J peek');
    assert.ok(set < src.indexOf('Astro.response.status'), 'before any status is chosen');
  });
});

describe('per-IP limit has no LEAD_RATE_LIMIT setting', () => {
  test('LEAD_RATE_LIMIT changes nothing; the caller limit holds', () => {
    process.env.LEAD_RATE_LIMIT = '1';
    const ip = 'g2-finding-9:203.0.113.200';
    for (let i = 0; i < 3; i += 1) assert.equal(rateLimited(ip, 3), false, `hit ${i + 1} of 3`);
    assert.equal(rateLimited(ip, 3), true, 'the fourth is over');
  });

  test('http.ts no longer reads LEAD_RATE_LIMIT', () => {
    const src = readFileSync(new URL('./http.ts', import.meta.url), 'utf8');
    assert.equal(src.includes('LEAD_RATE_LIMIT'), false);
  });
});
