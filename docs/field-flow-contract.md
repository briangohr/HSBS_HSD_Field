# Field app: what the site sends and expects

The site side of the contract between this site and its two Power Automate flows. The
flow side (how 1F and 1J are built, step by step) lives in the build sheets in `docs/build/`
and on the Field Build Desk. When the two disagree, stop and ask Brian.

Rules for both flows: one HTTP trigger per flow, method POST, JSON in and JSON out. The
trigger URLs are secrets in Vercel env and never reach the browser, a log or this repo.
The site follows no redirect (`redirect: manual`) and treats any 3xx as a failed call.
A loopback `http://127.0.0.1` or `http://localhost` URL is allowed only so local tests
can stand in for a flow.

## The switch

`REP_APP_ENABLED` must be exactly `true`. Unset or any other value: every page and API
route answers 404 and no flow is called.

## Environment

| Name | What | Secret |
|---|---|---|
| `REP_APP_ENABLED` | The switch above | No |
| `FIELD_FLOW_URL` | HSBS 1F trigger URL, `https` only | Yes |
| `REGISTER_FLOW_URL` | HSBS 1J trigger URL, `https` only | Yes |
| `REP_APP_COMPANIES` | Which companies Send offers: `HealthFirst`, `Staffing`, comma separated. Unset is HealthFirst only | No |
| `REP_PAY_ENABLED` | Dollar amounts on screens, exactly `true`. Off until Brian approves pay | No |
| `REP_PAY_PLAN` | HealthFirst pay plan words (`src/lib/rep-pay-plan.mjs`) | No |
| `REP_PAY_PLAN_STAFFING` | Staffing pay plan words | No |
| `REP_ASK_STATE` | The HealthFirst form asks for the practice's state and sends `practiceState`, exactly `true`. Off: no State field and no `practiceState` in the body | No |
| `REP_CONFIRM_ENABLED` | `/confirm/<token>`, exactly `true`. Off: not used at launch | No |
| `FLOW_CACHE_SECONDS` | Track and Earnings cache, 0 to 300, default 45. 0 turns it off | No |
| `REGISTER_IP_LIMIT` | Sign-ups per IP per window, default 200 | No |

## HSBS 1J: register (`/join`)

Request (built only from a validated form, `registerPayload` in
`src/lib/register-form.mjs`):

```json
{
  "action": "register",
  "firstName": "Test",
  "lastName": "Rep",
  "email": "test.rep@henryschein.com",
  "mobile": "303-555-0100",
  "role": "AE",
  "managerName": "Test Manager",
  "managerEmail": "test.manager@henryschein.com",
  "branch": "TEST Branch",
  "source": "QR"
}
```

- `role` is one of `AE`, `FSC`, `RM`, `ES`, `EST`, `HSFS`, `Other`.
  Thrive Signature is a program, not a role (Brian, 11/17); it stays only as a `source`.
  The page shows `RM` as RGM and sends `RM`.
- An AE may leave both manager fields blank (decision 113).
- `source` is `QR`, `AE link`, `Thrive Signature link` or `Other`, from `?src=` on `/join`.

Answers the site reads:

| Answer | Site does |
|---|---|
| 200 `{"ok":true}` | Shows "Check your Henry Schein email." The same words for a new email, a repeat and one over its limit |
| 200 with any other body, or non-JSON | Not sent; the person may try again |
| 4xx other than 408 and 429 | Refused fields; shows the error |
| 408, 429, 5xx, timeout (45s) | Not available right now; try again |

## HSBS 1F: the app (`/refer/<key>`)

One trigger, told apart by `action`. Every body carries the person's own `referralKey`
and nothing else that names them. Name and email always come from the Rep Roster row
that owns the key.

### lookup

```json
{ "action": "lookup", "referralKey": "<key>", "activate": true }
```

`activate` is always `true`: a lookup may set a Pending Rep Roster row to Active and stamp
First Opened On.

Success is 200 with:

```json
{ "role": "Rep", "repName": "Test Rep", "repEmail": "test.rep@henryschein.com", "services": ["HealthFirst"], "isManager": false }
```

- Only `role: "Rep"` opens the app. A missing role or any other value is an unknown key.
- `repName` must be set, `repEmail` must look like an email and `services` must include
  `HealthFirst`, or the key is unknown.
- `isManager` counts only as the JSON boolean `true`. It shows the My Team tab; `team`
  is the real gate.
- Any manager name, email or status 1F sends is ignored (D18).
- 404, 410 and any other 4xx except 408 and 429: "This link does not work." 408, 429,
  5xx and a timeout (20s): "This form is not available right now."

### submit

Two shapes, one per company (`src/lib/rep-referral-form.mjs`,
`src/lib/rep-staffing-form.mjs`). Every fixed value is set by the site, never the page:

```json
{
  "action": "submit",
  "referralKey": "<key>",
  "submissionId": "<uuid>",
  "leadType": "Practice owner",
  "doctorName": "TEST Office Manager",
  "practiceName": "TEST North Side Dental",
  "officePhone": "303-555-0100",
  "doctorCell": "",
  "doctorEmail": "",
  "jde": "001234",
  "companies": ["HealthFirst"],
  "needs": ["OSHA and HIPAA compliance"],
  "PVApermission": true,
  "contactFirst": false,
  "preferredContact": "Call",
  "consentText": "<the consent sentence the rep ticked>",
  "notes": "",
  "route": "Partner",
  "referrerRole": "Rep",
  "source": "Rep app",
  "status": "Received"
}
```

- A staffing send has `companies: ["HS Staffing / Recruiting Services (including GoTu)"]`,
  `needs: ["Staffing"]`, its own consent sentence, and `practiceType` (`Private practice` or
  `Group`).
- With `REP_ASK_STATE` on, a HealthFirst send also carries `practiceState`: the practice's
  state as a two-letter USPS code, one of the 50 states or `DC` (`US_STATES` in
  `src/lib/rep-referral-form.mjs`). It is required; a missing or unknown code is refused
  with 422 before any 1F call. HealthFirst splits its reps by state. A staffing send never
  carries it. Turn the switch on only after 1F stores the field.
- `PVApermission` is a column name 1F maps today. It stays until 1F stops reading it;
  removing it is a 1F change first.
- The site refuses, before any 1F call, a company that is off in `REP_APP_COMPANIES`, two
  companies, or none.
- Success is 200 with `{"ok":true}`, read in full. Anything else is not sent.
- A retry reuses the same `submissionId`. The site also remembers a good send by key and
  id for 30 minutes and does not post it again.
- 504 or no answer in 55 seconds: "This is taking too long. It may already have gone
  through. Do not send it again."
- Any 4xx except 408 and 429: "This link does not work."

### list

```json
{ "action": "list", "referralKey": "<key>" }
```

200 `{ "referrals": [ ... ] }`. The site keeps only display fields
(`sanitizeReferral` in `src/lib/track.mjs`): `title` or `id`, `doctorName`,
`practiceName`, `sentOn` or `created`, `route` (`Partner` only), `closed`, `signed`, and
`lines` (or `cases`) with `company`, `status`, `detail`, `updatedOn` and the stored choices
`solutions`, `practiceType`, `qualified`, `notQualifiedReason`, `closedReason`, and
`history` with `on` and `text`. Anything else, an echoed key included, is dropped.

### earnings

```json
{ "action": "earnings", "referralKey": "<key>" }
```

200 `{ "rows": [ ... ] }`: the person's own SPIFF Ledger rows, Payee Role `Rep`. The site
reads `referralId`, `practiceName`, `company`, `practiceType`, `event` (`Reached` or
`Signed`), `amount`, `status` (`Waiting`, `Paid`, `Pending review`, `Void`), `earnedOn`,
`paidOn`, `voidReason`, `disputed`, `payeeRole`. `/api/earnings` answers 404 while
`REP_PAY_ENABLED` is off.

### team

```json
{ "action": "team", "referralKey": "<key>" }
```

200 `{ "team": [ ... ], "managerRows": [ ... ] }`: every Active Team Roster row whose
Manager Email is this person. Each member has `name`, `role`, `signedUp`, and when signed
up `email`, `registeredOn`, `referrals` and `rows`. `managerRows` are this person's own
ledger rows with Payee Role `Manager`. Only 404 means "no team"; every other failure is
"Your team did not load." More than 200 members, or a body over 2 MB, is a failed call,
never a team cut short. The raw answer stays on the server; `src/lib/rep-team.mjs` shapes
what the browser gets (no rep email, no key).

## What must stay true

- The key is a secret in the URL. Pages that carry it set `Cache-Control: no-store`,
  `X-Robots-Tag: noindex, nofollow` and load no analytics.
- Track and Earnings return rows only for a key the lookup confirms as a Rep. A key the
  lookup refuses gets 404 and a failed lookup gets 502, even when `list` or `earnings`
  answered (`confirmRep` in `src/lib/rep-reads.mjs`).
- The Track and Earnings cache holds an answer only after the lookup confirms a Rep key;
  errors are never held, and a send clears that key's entries.
- A send with no clear answer (a timeout, a dropped connection, a 5xx) keeps its
  `submissionId` and the exact fields first posted, so a retry resends the same referral.
- Rate limits are per key with a per-IP backstop, so many people behind one office IP are
  never limited, while one key or one address cycling keys is.
- No key, flow URL, email or office detail is ever logged.
