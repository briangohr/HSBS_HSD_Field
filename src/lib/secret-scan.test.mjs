import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { looksLikeKey, mask, scanLine, skipFile } from './secret-scan.mjs';

// Fixtures are built at run time so this file never holds a key-shaped value.
// Hash-derived, so every run checks the same keys and the test cannot flake.
let seed = 0;
const referralKey = () => createHash('sha256').update(`hsbs-fixture-${(seed += 1)}`).digest('base64url');
const linkKey = () => randomBytes(20).toString('hex');

test('a referral key is caught in code, a test, or a doc', () => {
  for (let i = 0; i < 40; i += 1) {
    const key = referralKey();
    assert.equal(looksLikeKey(key), true, `missed a random 43-char key on try ${i}`);
    assert.equal(scanLine(`  key: '${key}',`).length, 1);
    assert.equal(scanLine(`Open https://hsps-lifecycle.vercel.app/refer/${key} on your phone.`).length, 1);
  }
});

test('a partner link key is caught, a commit hash in this repo is not', () => {
  const key = linkKey();
  assert.deepEqual(scanLine(`/leads/${key}`, { isGitObject: () => false }).map((f) => f.kind), ['partner link key (40 hex)']);
  assert.deepEqual(scanLine(`merge ${key}`, { isGitObject: () => true }), []);
});

test('a Power Automate trigger URL is caught', () => {
  const host = ['prod-12.eastus', 'logic', 'azure', 'com'].join('.');
  const line = `FIELD_FLOW_URL=https://${host}:443/workflows/abc/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers&sv=1.0&sig=${referralKey()}`;
  const kinds = scanLine(line).map((f) => f.kind);
  assert.ok(kinds.includes('flow URL'));
});

test('a signed query string alone is caught', () => {
  assert.deepEqual(scanLine(`fetch(url + '?sig=${'Ab3'.repeat(8)}')`).map((f) => f.kind), ['signed URL']);
});

test('common tokens are caught', () => {
  const pem = ['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' ');
  assert.ok(scanLine(pem).some((f) => f.kind === 'private key'));
  assert.ok(scanLine(`token = "${'ghp_'}${randomBytes(27).toString('base64url').replace(/[-_]/g, 'x')}"`).some((f) => f.kind === 'GitHub token'));
});

test('names, test stand-ins and the env file example are not secrets', () => {
  for (const line of [
    'export class ReferralAppTimeoutError extends Error {}',
    'const PARTNER_UPDATES_ENABLED_FOR_TESTING = true;',
    'partnerStatusVocabularyMappingForTrack',
    "const otherKey = 'c'.repeat(43);",
    "const repKey = `Rep_${'k'.repeat(21)}`;",
    'FIELD_FLOW_URL=',
    'hsbs-hsd-field-git-claude-happy-pa-eb95d2-brian-gohr-s-projects',
    "{ slug: 'pat-example', name: 'Pat Example', region: 'East', territory: 'MD; DC; VA: Northern' }",
    // Dated Dropbox spec names, as specs and docs quote them.
    'Source: Dropbox /HSBS_BOT/build/2026-11-07_HealthFirst_Rep_App_Spec_DRAFT_v2.md',
    'Replaces: 2026-11-07_HealthFirst_Rep_App_Spec_DRAFT.md (v1).',
    '/HSBS_BOT/build/2026-11-16_Field_App_Split_HANDOFF.md',
  ]) {
    assert.deepEqual(scanLine(line, { isGitObject: () => false }), [], line);
  }
});

test('a line marked secret-scan: allow is skipped', () => {
  assert.deepEqual(scanLine(`const sample = '${referralKey()}'; // secret-scan: allow (public sample id)`), []);
});

test('a finding never shows any character of the value', () => {
  const key = referralKey();
  const [finding] = scanLine(`key=${key}`);
  assert.equal(finding.masked, '(43 chars)');
  assert.equal(mask(key).includes(key.slice(0, 3)), false);
});

test('binary, lock and build files are skipped', () => {
  for (const path of ['package-lock.json', 'public/logos/pat-example.jpg', 'collateral/pdf/x.pdf', 'dist/client/index.html']) {
    assert.equal(skipFile(path), true, path);
  }
  assert.equal(skipFile('src/lib/field-flow.mjs'), false);
});
