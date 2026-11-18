// HealthFirst rep app sign-up (/join). Shared by the page and /api/register, so the
// browser and the server check the same rules. Spec: docs/field-flow-contract.md
// (v3, section 2). Contract: docs/field-flow-contract.md.
//
// Plain JS so the page script and node --test can both import it.

// The Rep Roster's Role choice values, as 1J stores them. HSFS, ES and EST were added on
// 11/16 (Brian: "add HSFS, ES, EST, FSC, RGM, AE", keeping the ones we have). The Role
// choices on the Rep Roster must hold each value before the page offers it. The field app
// has no PVA choice (Brian, 11/16: "The Field should have zero mention of PVA."). Thrive
// Signature came off on 11/17 (Brian: "Thrive Signature is a program, not a role."); the
// `thrive` source below stays, because it names the program's link, not a role.
export const ROLES = ['AE', 'FSC', 'RM', 'ES', 'EST', 'HSFS', 'Other'];

/** What the drop-down shows for a stored value. `RM` stays `RM` on the roster (decision 81). */
export const ROLE_LABELS = { RM: 'RGM' };
/** @param {string} role */
export const roleLabel = (role) => ROLE_LABELS[/** @type {keyof typeof ROLE_LABELS} */ (role)] ?? role;

/** Roles that may leave the manager blank at sign-up (decision 113). */
export const MANAGER_OPTIONAL_ROLES = ['AE'];

/** `?src=` on /join. The QR code goes to /j, which sends `qr`. */
export const SOURCES = { qr: 'QR', ae: 'AE link', thrive: 'Thrive Signature link' };
export const sourceFor = (src) => SOURCES[String(src ?? '').toLowerCase()] ?? 'Other';

/** The same words for a new email, a repeat and an email over its limit (spec D2). */
export const SENT_MESSAGE =
  'Check your Henry Schein email. Your personal link is there. Open it on your phone and tap Add to Home Screen.';

export const HS_EMAIL = /^[A-Za-z0-9._%+'-]+@henryschein\.com$/i;

const clean = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/**
 * One rule for people's names, at sign-up and when 1J sends a name back to show
 * (confirm page). Letters, marks, spaces, apostrophes, periods and hyphens, 1 to 120.
 * Curly apostrophes become straight ones first, so O’Neill and O'Neill match.
 */
export const NAME = /^[\p{L}\p{M}' .-]{1,120}$/u;
export function normalizeName(v) {
  return String(v ?? '')
    .replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
export const cleanName = (v) => {
  const s = normalizeName(v);
  return NAME.test(s) ? s : '';
};

/** 10-digit US mobile, with or without a leading 1 and any punctuation. */
export function normalizeMobile(v) {
  let digits = String(v ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : '';
}

/**
 * Roster match (Brian, 11/17: "those fields will create a nightmare"). The RGM pick list
 * comes from `JOIN_RGMS` in Vercel env, built from the field roster: one entry per region,
 * `{ "region": "OR", "name": "<RGM name>", "email": "<RGM email>" }`. The page shows each
 * RGM by name and region and sends only the region code; the emails stay on the server.
 * Set: /join asks for no manager name, manager email or branch. Unset or invalid: the
 * free-text form as before. 1J matches a sign-up to the roster by email or mobile and
 * takes the manager from the roster, so the pick is only a hint for people not on it.
 *
 * @typedef {{ region: string, name: string, email: string }} Rgm
 */
export const REGION = /^[A-Z]{2,3}$/;

/**
 * The RGM list from `JOIN_RGMS`, or [] when it is unset or any entry is wrong. One bad
 * entry turns the whole list off, so a typo never shows a half list.
 * @param {unknown} raw
 * @returns {Rgm[]}
 */
export function parseRgms(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  let list;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list) || list.length === 0 || list.length > 100) return [];
  /** @type {Rgm[]} */
  const out = [];
  const seen = new Set();
  for (const e of list) {
    if (!e || typeof e !== 'object') return [];
    const region = String(e.region ?? '').trim().toUpperCase();
    const name = normalizeName(e.name);
    const email = String(e.email ?? '').trim().toLowerCase();
    if (!REGION.test(region) || seen.has(region) || !NAME.test(name) || !HS_EMAIL.test(email)) return [];
    seen.add(region);
    out.push({ region, name, email });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** What the pick list shows for one RGM. */
export const rgmLabel = (/** @type {Rgm} */ r) => `${r.name} (${r.region})`;

/** The pick list's value for "my manager is not listed". */
export const RGM_NOT_LISTED = 'none';

/**
 * @param {Record<string, unknown>} input
 * @param {Rgm[]} [rgms] the RGM list; non-empty means the roster-match form
 * @returns {{ ok: true, value: Registration } | { ok: false, errors: Record<string, string> }}
 *
 * @typedef {{ firstName: string, lastName: string, email: string, mobile: string, role: string,
 *   managerName: string, managerEmail: string, branch: string }} Registration
 */
export function validateRegistration(input, rgms = []) {
  if (rgms.length) return validateRosterRegistration(input, rgms);
  const value = {
    firstName: normalizeName(clean(input.firstName, 60)),
    lastName: normalizeName(clean(input.lastName, 60)),
    email: clean(input.email, 120).toLowerCase(),
    mobile: normalizeMobile(input.mobile),
    role: clean(input.role, 30),
    managerName: normalizeName(clean(input.managerName, 120)),
    managerEmail: clean(input.managerEmail, 120).toLowerCase(),
    branch: clean(input.branch, 80),
  };
  /** @type {Record<string, string>} */
  const errors = {};
  if (!value.firstName) errors.firstName = 'Add your first name.';
  else if (!NAME.test(value.firstName)) errors.firstName = 'Use letters, spaces, hyphens and apostrophes only.';
  if (!value.lastName) errors.lastName = 'Add your last name.';
  else if (!NAME.test(value.lastName)) errors.lastName = 'Use letters, spaces, hyphens and apostrophes only.';
  if (!HS_EMAIL.test(value.email)) errors.email = 'Use your Henry Schein email (ends in @henryschein.com).';
  if (!value.mobile) errors.mobile = 'Add a 10-digit mobile number.';
  if (!ROLES.includes(value.role)) errors.role = 'Pick your role.';
  // Decision 113 (Brian, 11/14): an AE's manager is unknown today, so an AE may leave both
  // manager fields blank. Brian adds the manager on the Team Roster later (D18: this is
  // only a hint). A manager an AE does give is checked like anyone's.
  const managerOptional = MANAGER_OPTIONAL_ROLES.includes(value.role) && !value.managerName && !value.managerEmail;
  if (!managerOptional) {
    if (!value.managerName) errors.managerName = "Add your manager's name.";
    else if (!NAME.test(value.managerName)) errors.managerName = 'Use letters, spaces, hyphens and apostrophes only.';
    if (!HS_EMAIL.test(value.managerEmail)) {
      errors.managerEmail = "Use your manager's Henry Schein email (ends in @henryschein.com).";
    } else if (value.managerEmail === value.email) {
      errors.managerEmail = "Your manager's email can't be your own.";
    }
  }
  if (!value.branch) errors.branch = 'Add your branch or territory.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/**
 * The roster-match form: name, email, mobile, role and an RGM picked from the list. The
 * picked RGM's roster name and email go to 1J as the manager hint, and the region code as
 * `branch`, so the body keeps its shape. "Not listed" sends both manager fields and
 * branch blank, for any role.
 * @param {Record<string, unknown>} input
 * @param {Rgm[]} rgms
 */
function validateRosterRegistration(input, rgms) {
  const pick = clean(input.rgm, 10);
  const rgm = rgms.find((r) => r.region === pick);
  const value = {
    firstName: normalizeName(clean(input.firstName, 60)),
    lastName: normalizeName(clean(input.lastName, 60)),
    email: clean(input.email, 120).toLowerCase(),
    mobile: normalizeMobile(input.mobile),
    role: clean(input.role, 30),
    managerName: rgm?.name ?? '',
    managerEmail: rgm?.email ?? '',
    branch: rgm?.region ?? '',
  };
  /** @type {Record<string, string>} */
  const errors = {};
  if (!value.firstName) errors.firstName = 'Add your first name.';
  else if (!NAME.test(value.firstName)) errors.firstName = 'Use letters, spaces, hyphens and apostrophes only.';
  if (!value.lastName) errors.lastName = 'Add your last name.';
  else if (!NAME.test(value.lastName)) errors.lastName = 'Use letters, spaces, hyphens and apostrophes only.';
  if (!HS_EMAIL.test(value.email)) errors.email = 'Use your Henry Schein email (ends in @henryschein.com).';
  if (!value.mobile) errors.mobile = 'Add a 10-digit mobile number.';
  if (!ROLES.includes(value.role)) errors.role = 'Pick your role.';
  if (!rgm && pick !== RGM_NOT_LISTED) errors.rgm = 'Pick your RGM, or pick Not listed.';
  else if (rgm && rgm.email && rgm.email === value.email) errors.rgm = 'Pick the RGM you report to, or pick Not listed.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/**
 * The body /api/register posts to HSBS 1J. Built only from a validated registration,
 * so nothing the browser sent goes through unchecked.
 * @param {Registration} value
 * @param {string} source one of the SOURCES values, or 'Other'
 */
export function registerPayload(value, source) {
  return {
    action: 'register',
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
    mobile: value.mobile,
    role: value.role,
    managerName: value.managerName,
    managerEmail: value.managerEmail,
    branch: value.branch,
    source: Object.values(SOURCES).includes(source) ? source : 'Other',
  };
}
