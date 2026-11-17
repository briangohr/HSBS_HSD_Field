// Decides whether a PR needs the browser test (CI job e2e). Brian, 11/13/2026,
// decision 99: to save Actions minutes, a PR that only changes files the site and the
// browser test never read skips e2e. The checks job still runs on every PR and every push
// to main: the secret scan, the flow export check, and the unit tests, some of which read
// docs/.
//
// Skippable: anything under docs/, flows/ or .claude/, and Markdown files at the top level
// (AGENTS.md, CLAUDE.md, NOTES.md). Everything else needs e2e, and so does an empty or
// unreadable list: a mistake here runs the test rather than skipping it.

const SKIPPABLE_DIRS = ['docs/', 'flows/', '.claude/'];

export function isSkippable(path) {
  if (typeof path !== 'string' || path === '') return false;
  if (SKIPPABLE_DIRS.some((dir) => path.startsWith(dir))) return true;
  return !path.includes('/') && path.endsWith('.md');
}

export function needsBrowserTest(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return true;
  return !paths.every(isSkippable);
}
