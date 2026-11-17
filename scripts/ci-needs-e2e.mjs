// Prints e2e=true or e2e=false for GitHub Actions ($GITHUB_OUTPUT), from the files a PR
// changes against its base commit. Used by the checks job in .github/workflows/ci.yml
// (decision 99). Any failure prints e2e=true: when in doubt, run the browser test.
//
// Run: node scripts/ci-needs-e2e.mjs <base-commit-sha>
import { execFileSync } from 'node:child_process';
import { needsBrowserTest } from '../src/lib/ci-scope.mjs';

const base = process.argv[2] || '';
let paths = [];
try {
  if (!/^[0-9a-f]{7,64}$/i.test(base)) throw new Error(`no usable base commit ("${base}")`);
  const out = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', base, 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  paths = out.split('\0').filter(Boolean);
} catch (err) {
  console.error(`ci-needs-e2e: ${err.message.split('\n')[0]}; running the browser test`);
  paths = [];
}

const e2e = needsBrowserTest(paths);
for (const path of paths.slice(0, 50)) console.error(`  ${path}`);
if (paths.length > 50) console.error(`  ...and ${paths.length - 50} more`);
console.error(`ci-needs-e2e: ${paths.length} changed file(s); browser test ${e2e ? 'needed' : 'skipped'}`);
console.log(`e2e=${e2e}`);
