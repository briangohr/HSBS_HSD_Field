// Decision 99: which PRs skip the browser test (src/lib/ci-scope.mjs). Docs-only PRs skip
// it; anything that can change the site, the tests or CI itself runs it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isSkippable, needsBrowserTest } from './ci-scope.mjs';

test('docs, flow copies, Claude skills and top-level Markdown are skippable', () => {
  for (const path of [
    'docs/claude-code/DECISIONS.md',
    'docs/field-flow-contract.md',
    'docs/field-roster.csv',
    'flows/README.md',
    'flows/HSBS 1F.json',
    '.claude/skills/bg-explain/SKILL.md',
    'AGENTS.md',
    'CLAUDE.md',
    'NOTES.md',
  ]) {
    assert.equal(isSkippable(path), true, path);
  }
});

test('site code, tests, scripts, assets, packages and CI are not skippable', () => {
  for (const path of [
    'src/pages/index.astro',
    'src/lib/field-flow.mjs',
    'src/lib/ci-scope.mjs',
    'scripts/e2e/refer.e2e.mjs',
    'collateral/README.md',
    'public/favicon.svg',
    'package.json',
    'package-lock.json',
    'astro.config.mjs',
    '.github/workflows/ci.yml',
    'src/docs/notes.md',
    'docsite/page.md',
    'README.MD',
    '"docs/caf\\303\\251.md"',
    '',
  ]) {
    assert.equal(isSkippable(path), false, JSON.stringify(path));
  }
});

test('a docs-only PR skips the browser test', () => {
  assert.equal(needsBrowserTest(['docs/claude-code/DECISIONS.md']), false);
  assert.equal(needsBrowserTest(['docs/a.md', 'flows/README.md', 'CLAUDE.md']), false);
});

test('one code file among docs runs the browser test', () => {
  assert.equal(needsBrowserTest(['docs/a.md', 'src/data/field.mjs']), true);
  assert.equal(needsBrowserTest(['CLAUDE.md', '.github/workflows/ci.yml']), true);
});

test('an empty or unreadable list runs the browser test', () => {
  assert.equal(needsBrowserTest([]), true);
  assert.equal(needsBrowserTest(undefined), true);
  assert.equal(needsBrowserTest('docs/a.md'), true);
});

test('the browser test and the site never read the skippable folders', () => {
  // If e2e or the build starts reading docs/, flows/ or .claude/, this list is wrong.
  const e2e = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
  const scripts = JSON.parse(e2e).scripts.e2e.split('&&').map((s) => s.trim().replace(/^node /, ''));
  assert.ok(scripts.length > 0, 'package.json has an e2e script');
  for (const file of scripts) {
    const code = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    const reads = code.match(/readFileSync\([^)]*['"`](?:\.\.\/)*(?:docs|flows|\.claude)\//g);
    assert.equal(reads, null, `${file} reads a skippable folder`);
  }
});
