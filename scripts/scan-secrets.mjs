#!/usr/bin/env node
// Secret scan for CI and before a PR.
//
//   node scripts/scan-secrets.mjs                 every tracked file
//   node scripts/scan-secrets.mjs --diff <base>   only lines added since <base>,
//                                                 committed, staged or edited
//
// Exits 1 on a finding. Prints file, line and kind, never the value.
// CI runs the --diff form, so a key already in history does not block an
// unrelated PR. The full form is for an audit.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { scanLine, skipFile } from '../src/lib/secret-scan.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const gitObjects = new Map();
function isGitObject(hex) {
  if (!gitObjects.has(hex)) {
    try {
      execFileSync('git', ['cat-file', '-e', hex], { stdio: 'ignore' });
      gitObjects.set(hex, true);
    } catch {
      gitObjects.set(hex, false);
    }
  }
  return gitObjects.get(hex);
}

/** @type {{ file: string, line: number, kind: string, masked: string }[]} */
const findings = [];

function scan(file, lineNo, text) {
  for (const f of scanLine(text, { isGitObject })) findings.push({ file, line: lineNo, ...f });
}

// A file name reaches history as a path header, which the line scan never reads. A name that
// looks like a key is reported without printing it: the name is the secret.
let pathCount = 0;
function scanPath(path) {
  pathCount += 1;
  for (const f of scanLine(path.replace(/\t.*$/, ''), { isGitObject })) findings.push({ file: `(file name ${pathCount}, not shown)`, line: 0, ...f });
}

const args = process.argv.slice(2);
if (args[0] === '--diff') {
  let base = args[1] ?? '';
  // A first push to a branch has no "before" commit. Fall back to the parent.
  if (!base || /^0+$/.test(base)) base = 'HEAD~1';
  try {
    git('rev-parse', '--verify', `${base}^{commit}`);
  } catch {
    console.error(`scan-secrets: base ${base} is not a commit here. Fetch full history (fetch-depth: 0).`);
    process.exit(2);
  }
  // Against the working tree, not HEAD, so staged and edited files count before
  // they are committed. In CI the working tree is the commit, so it's the same.
  const diff = git('diff', '--unified=0', '--no-color', '--no-ext-diff', '--diff-filter=ACMR', base);
  let file = '';
  let lineNo = 0;
  for (const row of diff.split('\n')) {
    if (row.startsWith('+++ ')) {
      file = row.slice(4).replace(/^b\//, '');
      if (file !== '/dev/null') scanPath(file);
      continue;
    }
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      lineNo = Number(hunk[1]);
      continue;
    }
    if (row.startsWith('+') && file && file !== '/dev/null' && !skipFile(file)) {
      scan(file, lineNo, row.slice(1));
      lineNo += 1;
    }
  }
  console.log(`scan-secrets: checked lines added since ${base.slice(0, 12)}.`);
} else {
  const all = git('ls-files', '-z').split('\0').filter(Boolean);
  all.forEach(scanPath);
  const files = all.filter((f) => !skipFile(f));
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (text.includes('\0')) continue; // binary
    text.split('\n').forEach((row, i) => scan(file, i + 1, row));
  }
  console.log(`scan-secrets: checked ${files.length} tracked files.`);
}

if (findings.length) {
  console.error(`\nscan-secrets: ${findings.length} possible secret(s). Values are not printed.`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.kind}  ${f.masked}`);
  console.error(
    '\nMove real secrets to Vercel env or SharePoint, never the repo. If a value is not a secret,\n' +
      'add the comment `secret-scan: allow` on that line with the reason.',
  );
  process.exit(1);
}
console.log('scan-secrets: no secrets found.');
