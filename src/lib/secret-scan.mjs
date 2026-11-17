// Finds secrets before they reach the repo: referral keys, partner link keys,
// Power Automate flow URLs and common tokens. Used by scripts/scan-secrets.mjs
// in CI. A finding never prints the value, only where it is and how long.
//
// A line can opt out with the comment `secret-scan: allow`. Use it only for a
// value that is not a secret, and say why on the same line.

/** Power Automate and Logic Apps trigger URLs carry their signature in the query. */
const FLOW_URL = /https?:\/\/[^\s'"`]*(?:logic\.azure\.com|\.api\.powerplatform\.com|\.environment\.api\.powerplatform\.com)[^\s'"`]*/i;
const SIGNED_QUERY = /[?&]sig=[A-Za-z0-9%_-]{16,}/;

const TOKEN_PATTERNS = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['AWS key', /\bAKIA[0-9A-Z]{16}\b/],
  ['API key', /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['bearer token', /\bBearer\s+[A-Za-z0-9._~+/-]{24,}={0,2}/],
];

/** A partner Link Key is 40 lowercase hex characters (KEY_PATTERN in partner-flow.ts). */
const HEX40 = /\b[0-9a-f]{40}\b/g;
/** A Referral Key is 24 to 128 URL-safe characters (isReferralKey in field-form.mjs). */
const URL_SAFE_RUN = /[A-Za-z0-9_-]{24,128}/g;

const ALLOW = /secret-scan:\s*allow/;

/** Bits per character. Exported for tests and tuning. */
export function entropy(text) {
  const counts = new Map();
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const n of counts.values()) {
    const p = n / text.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/**
 * True when a run looks generated rather than written: mixed case and digits,
 * many distinct characters, high entropy, and not a readable identifier.
 */
export function looksLikeKey(run) {
  if (run.length < 24) return false;
  if (!/[A-Z]/.test(run) || !/[a-z]/.test(run) || !/[0-9]/.test(run)) return false;
  // A random key over 64 symbols repeats few characters. Count distinct ones
  // against what a random string of this length would have.
  const expected = 64 * (1 - (63 / 64) ** run.length);
  if (new Set(run).size < 0.7 * expected) return false;
  if (readableShare(run) >= 0.8) return false;
  return true;
}

/**
 * Share of characters that sit in readable tokens. Names, dated file names and
 * identifiers split into words, years, acronyms and versions ("2026", "Spec",
 * "DRAFT", "v2"). Measured on random 43-character keys: about 4 in 10,000 reach 0.8, so
 * treating 0.8 or more as a name misses very few real keys. A random key splits into short fragments that read as nothing.
 */
export function readableShare(run) {
  const tokens = run
    .replace(/(^|[_-])v[0-9]{1,2}(?=$|[_-])/g, '$1VER') // v2, v3 as one readable token
    .split(/[_-]+|(?<=[a-z])(?=[A-Z])|(?<=[A-Za-z])(?=[0-9])|(?<=[0-9])(?=[A-Za-z])|(?<=[A-Z])(?=[A-Z][a-z])/)
    .filter(Boolean);
  if (tokens.length < 2) return 0;
  const readable = (t) =>
    /^[0-9]{2,4}$/.test(t) || // year, month, day
    /^[A-Z]{2,10}$/.test(t) || // acronym or caps word: HSBS, DRAFT, HANDOFF, VER
    /^[A-Z]?[a-z]{3,}$/.test(t); // word: Spec, referral
  const chars = tokens.filter(readable).reduce((n, t) => n + t.length, 0);
  return chars / tokens.reduce((n, t) => n + t.length, 0);
}

/** Shows the size of a value, never any of its characters. */
export function mask(value) {
  return `(${value.length} chars)`;
}

/**
 * @param {string} line
 * @param {{ isGitObject?: (hex: string) => boolean }} [opts]
 * @returns {{ kind: string, masked: string }[]}
 */
export function scanLine(line, opts = {}) {
  if (ALLOW.test(line)) return [];
  /** @type {{ kind: string, masked: string }[]} */
  const found = [];

  const flow = line.match(FLOW_URL);
  if (flow) found.push({ kind: 'flow URL', masked: mask(flow[0]) });
  else if (SIGNED_QUERY.test(line)) found.push({ kind: 'signed URL', masked: mask(line.match(SIGNED_QUERY)[0]) });

  for (const [kind, pattern] of TOKEN_PATTERNS) {
    const m = line.match(pattern);
    if (m) found.push({ kind, masked: mask(m[0]) });
  }

  for (const m of line.matchAll(HEX40)) {
    // Commit hashes in docs are fine. A link key is not a commit in this repo.
    if (opts.isGitObject?.(m[0])) continue;
    found.push({ kind: 'partner link key (40 hex)', masked: mask(m[0]) });
  }

  for (const m of line.matchAll(URL_SAFE_RUN)) {
    if (/^[0-9a-f]+$/.test(m[0])) continue; // hex is handled above
    if (looksLikeKey(m[0])) found.push({ kind: 'referral key or token', masked: mask(m[0]) });
  }

  return found;
}

/** Files never worth scanning: lockfiles, fonts, images, PDFs, generated output. */
export function skipFile(path) {
  return (
    /(^|\/)package-lock\.json$/.test(path) ||
    /\.(png|jpe?g|gif|webp|ico|pdf|zip|woff2?|ttf|otf|xlsx|docx|pptx)$/i.test(path) ||
    /^(dist|node_modules|\.astro|\.vercel)\//.test(path)
  );
}
