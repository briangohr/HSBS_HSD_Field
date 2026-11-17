# Rep app: what the site sends and expects

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and names in code quotes are live SharePoint and flow names.

Written 11/8/2026 for the HealthFirst rep app (spec v3, `docs/build/healthfirst-rep-app-spec.md`).
Who builds (Brian, 11/8, latest): Claude builds the site. BB1 builds the SharePoint lists
and Power Automate flows from Claude's build sheets in Dropbox `/HSBS_BOT/build/` (read the
newest version of each sheet). Brian gives the go before any flow is turned on or sends
mail. The repo never edits flows.

Same rules as `docs/fsc-flow-contracts.md`: one HTTP trigger per flow, method POST,
`Content-Type: application/json`, and **200 only after the row exists**. Success is
HTTP 200 **with the JSON body `{"ok":true}`**. A 202, an empty 200, an HTML page, or a
body that stalls is a failed send, and the site says so. Flow URLs are Sensitive Vercel env values, never in the repo or a log.

This file grows one section per slice.

## HSBS 1J: register (slice 1, `/join`)

Env: `REGISTER_FLOW_URL` (Sensitive, Production and Preview). Gate: `REP_APP_ENABLED=true`.
With the gate off, `/join` and `/api/register` answer 404 and nothing is posted.

Move switch: `FIELD_JOIN_MOVED=true` (unset by default; `src/lib/field-join-move.mjs`).
With it on, `/join` forwards to the field app's own site,
`https://hsbs-hsd-field.vercel.app/join`, before the gate above is read, and posts nothing
to 1J. `/j` still lands on `/join?src=qr` first and is forwarded from there. Only `src`
carries over. GET and HEAD get 302; any other method gets 303, so a form POST is never
replayed to the other site. It is separate from `REP_APP_ENABLED`, which still runs
`/refer` here. Turn it on only after the field site's own production variables are set and
it has been redeployed. A variable change takes effect here only after a redeploy.

### Request

`/api/register` checks every field first (`src/lib/register-form.mjs`) and posts only
these keys:

```json
{
  "action": "register",
  "firstName": "Test",
  "lastName": "Rep",
  "email": "test.rep@henryschein.com",
  "mobile": "555-010-1234",
  "role": "AE",
  "managerName": "Test Manager",
  "managerEmail": "test.manager@henryschein.com",
  "branch": "Columbus",
  "source": "QR"
}
```

| Key | Rule | Rep Roster column |
|---|---|---|
| `firstName`, `lastName` | 1 to 60 characters: letters, spaces, apostrophes, periods, hyphens. Curly apostrophes arrive as straight ones | Rep Name (first and last) |
| `email` | Lowercase, ends in `@henryschein.com` | Rep Email (unique) |
| `mobile` | `NNN-NNN-NNNN` | Mobile |
| `role` | `AE`, `FSC`, `RM`, `ES`, `EST`, `HSFS`, `PVA` or `Other` (ES, EST and HSFS added 11/16; Thrive Signature removed 11/17, a program, not a role; the page shows `RM` as RGM and sends `RM`) | Role |
| `managerName` | 1 to 120 characters, same character rule as the rep's name. When `role` is `AE`, may be `""` together with `managerEmail` (decision 113) | Manager Name |
| `managerEmail` | Lowercase, ends in `@henryschein.com`, not equal to `email`. When `role` is `AE`, may be `""` together with `managerName` (decision 113) | Manager Email |
| `branch` | 1 to 80 characters | Branch |
| `source` | `QR`, `AE link`, `Thrive Signature link` or `Other` | Source |

The flow checks the email rules again. Don't trust the site alone.

### What 1J does

In this order (spec v3, section 3):

1. Refuse with **400**, writing nothing, when `email` or `managerEmail` doesn't end in
   `@henryschein.com`, or they're equal. **Exception (decision 113, Brian 11/14):** when
   `role` is `AE` and both `managerName` and `managerEmail` are `""`, don't refuse for the
   manager: the AE's manager is unknown today. Write both Manager columns blank. Brian adds
   the manager on the Team Roster when known. An AE who sends only one of the two is
   refused, as is any other role with a blank manager. TEST check: a TEST AE sign-up with
   both blank gets 200 and one Pending row with blank Manager Name and Manager Email; a
   TEST FSC sign-up with both blank gets 400 and no row.
2. The 10-minute limit lives in the **Link Resends** list (Email, unique; Last Sent).
   It covers every address, whatever roster it's on, and holds no keys.
3. If the email is on the `PVA Roster`, FSC Roster or Rep Roster: resend that person's
   existing link, unless Link Resends shows one went to that email in the last 10
   minutes. Update Last Sent when a link goes out. Never write to the `PVA Roster` or the FSC Roster.
   No new row. Answer **200** `{"ok":true}`.
   **A repeat sign-up never changes anything on an existing row, including the
   manager hint.** Anyone can type someone else's email into `/join`. The manager typed
   there decides nothing (D18), and a repeat still writes nothing. A rep never changes
   their own manager; Brian does, on the Team Roster (see "Changing a rep's manager" in
   slice 5).
4. Otherwise create one Rep Roster row: Status Pending, Services `HealthFirst`, a new
   Referral Key, Registered On now, Manager Emails Sent 0, Manager Name and Manager
   Email as sent (a hint for Brian, D18), no Confirm Token, and create or update its
   Link Resends row. Answer **200** `{"ok":true}` only after the row exists.
5. Send the welcome email with the personal link.
6. **Send no manager email**, at sign-up or later (Brian, 11/9, D18). Managers come
   from Brian's Team Roster, and nobody is asked to confirm. The manager fields are a
   hint: Brian's daily gap check shows them while the rep has no Active Team Roster row
   (see "The daily gap check" in slice 5). They never make anyone a manager, give anyone
   My Team, or decide pay.

Not built (D18): the Manager Affirmed, Confirm For, Send Manager Email and Needs Brian
columns from BB1 sheet 2 v3, Part A1. If a copy already has them, leave them blank.
Sheet 1's columns stay as they are.

A repeat sign-up, or one over the 10-minute limit, answers **200** like a new one, so
the page never reveals who is registered.

**TEST:** while the flow is a copy under test, every email goes to Brian only,
whatever the address on the row.

### Responses

| 1J answers | The site shows |
|---|---|
| 200 with `{"ok":true}` | "Check your Henry Schein email. Your personal link is there. Open it on your phone and tap Add to Home Screen." |
| 4xx (except 408 and 429) | "Check your Henry Schein email and your manager's, then try again." |
| 408 or 429 (Power Automate busy) | "Sign-up is not available right now." |
| No answer in 45 seconds | "This may have gone through. Check your email in a few minutes before you try again." |
| Anything else (202, 3xx, 5xx, an empty or non-JSON 200, a 200 without `"ok":true`, unset URL) | "Sign-up is not available right now." |

The site keeps no copy of the sign-up and logs none of its fields. It logs only "flow
failed" with the status code, or "timed out".

## HSBS 1J: confirm-peek and confirm (slice 2, `/confirm/<token>`): not used at launch

Brian, 11/9 (D18): not used by the rep journey at launch; removable later. Managers come
from Brian's Team Roster and nobody confirms, so 1J sends no manager email and writes no
Confirm Token, and nothing in the rep journey links to `/confirm`. The page
(`src/pages/confirm/[token].astro`), `/api/confirm` and `src/lib/confirm-submit.ts` from
#43 stay in the code, behind a second gate: the site answers 404 to GET and POST
`/confirm/<token>` and to `/api/confirm` before any 1J call unless
`REP_CONFIRM_ENABLED=true`, and that stays unset at launch. So at launch the site never
posts `confirm-peek` or `confirm`, whatever token a visitor makes up. This section records
what that code expects if the gate is ever turned on. BB1 builds nothing new for it. The same-day plan that
put a manager confirm in front of My Team and pay (the rep's affirm, the 410 rule on
Confirm For, the confirmed rule, the paired rule, Part G's Send Manager Email tick and the
Manager Mail Log) is superseded and not built.

Same flow and env as register (`REGISTER_FLOW_URL`), told apart by `action`. Gate: `REP_APP_ENABLED=true` and `REP_CONFIRM_ENABLED=true` (unset at launch).

- **A confirm grants nothing.** My Team, `isManager` and manager pay read only the Team
  Roster (slice 5, "Who manages whom"). If a 1J copy already has these actions, a yes
  may set Manager Confirmed on the row, which nothing reads. With the gate on and no
  token ever written, 1J answers 404, and the page says "This link does not work."
- The token is 64 lowercase hex characters. The site checks the shape
  (`^[0-9a-f]{64}$`) before it calls the flow, and never logs the token.

### confirm-peek (opening the page)

Read-only. Mail scanners open links, so this must never change a row.

```json
{ "action": "confirm-peek", "token": "<64 hex>" }
```

| 1J answers | When | Body |
|---|---|---|
| 200 | Token found, unused, not expired | `{ "repName": "Test Rep", "managerName": "Test Manager" }` |
| 404 | No row has this token | none |
| 410 | Used or past Confirm Expires | none |

Names follow the sign-up rule: letters, spaces, apostrophes, periods and hyphens, up to
120 characters. Curly apostrophes are read as straight ones, so O’Neill shows. Anything
else is treated as a failed call.

### confirm (a button press)

With JavaScript the page posts `/api/confirm`. Without it, each button is a plain form
POST back to `/confirm/<token>`. Both run the same server code and send 1J the same body.
Opening the link never sends `confirm`.

```json
{ "action": "confirm", "token": "<64 hex>", "answer": "yes" }
```

`answer` is `yes` or `no`. The peek has an IP limit of 30 per 10 minutes and the button press 10 per token per 10 minutes plus the per-IP backstop of 600, both only after the `REP_CONFIRM_ENABLED` 404 gate. Success is HTTP 200 with the JSON body `{"ok":true}`; a 200
without that body is a failed call.

| 1J answers | When |
|---|---|
| 200 `{"ok":true}` | Done. Answer only after the row is updated |
| 400 | `answer` is not yes or no |
| 404 | No row has this token |
| 410 | Used or expired |

**TEST:** every email from these steps goes to Brian only.

### What the page shows

#43 copy, not used at launch. A yes grants nothing (D18): My Team reads only the Team
Roster, whatever the page says.

| Result | Page |
|---|---|
| Gate off (at launch) | 404, "Not found" |
| Peek 200 | "Is [Rep] on your team?" with "Yes, [first name] is on my team" and "Not my team" |
| Yes, 200 | "Done. [Rep] is on your team." and where to find My Team |
| No, 200 | "Thanks. We'll ask [first name] to add the right manager." |
| 404, or a bad token shape | "This link does not work." |
| 410 | "This link was already used or has expired." |
| Timeout | "This may have gone through. Open the link again in a few minutes to check." |
| Anything else | "This is not available right now." |

The page's HTTP status follows the result: 404 for a link that does not work and 410 for
one already used or expired (issue #51), on opening the link and on a no-JavaScript
button press alike.

## HSBS 1R for Rep keys (slice 3, `/refer/<key>`)

Same flow and env as the other team's app and the FSC app (`REFERRAL_FLOW_URL`). Gate: the site accepts
role `Rep` only while `REP_APP_ENABLED=true`. With it off, a Rep key shows "This link
does not work."

Move switch: `FIELD_REFER_MOVED=true` (unset by default; `src/lib/field-refer-move.mjs`).
With it on, opening `/refer/<key>` (GET or HEAD) for a key the lookup confirms as `Rep`
through HSBS 1F (`FIELD_FLOW_URL`) answers 302 to the same key on the field app's own
site, `https://hsbs-hsd-field.vercel.app/refer/<key>`, with `Cache-Control: no-store` and
no query. That site asks 1F only, so a `Rep` answer that came from 1R stays here. Every
other key, an unknown key (404) and a failed lookup (503) are served here exactly as with
the switch off. A POST is never forwarded: a form already open on this site still sends
here, once, and the API routes are unchanged. Forwarding needs `REP_APP_ENABLED=true` and
`FIELD_FLOW_URL` still set here, since the lookup decides it. Turn it on only after the
field site's own production variables are set and it has been redeployed.

### lookup

Request:

```json
{ "action": "lookup", "referralKey": "<key>", "activate": false }
```

`activate` is `true` only while `REP_APP_ENABLED=true` on the site, and `false` otherwise
(issue #52). Every lookup carries it: `/refer/<key>` and `/api/referral-list`, for other-team,
FSC and Rep keys alike. Check the `PVA Roster`, then the FSC Roster, then the Rep Roster.

- **`activate` false:** a Rep key answers **404** and writes nothing to the Rep Roster:
  no First Opened On, no Status change. Other-team and FSC answers are the same as with `true`.
- **`activate` true:** today's behavior, below.
- **`activate` missing** (an older caller): treat it as `false`.

A Rep hit with `activate` true answers **200**:

```json
{ "role": "Rep", "repName": "Test Rep", "repEmail": "test.rep@henryschein.com", "services": ["HealthFirst"], "isManager": false }
```

The site refuses the answer (identity miss, "This link does not work.") unless the name
is set, the email looks right and `services` includes `HealthFirst`. Status Disabled
answers 404. The first lookup with `activate` true sets First Opened On and Status Active;
a lookup with `activate` false never does. Never create a Referrals row on lookup.

The site still refuses a role `Rep` answer while the switch is off, so a 1R that has not
learned `activate` yet shows "This link does not work." But only the flow can keep the
Rep row untouched, so build this branch before turning the Rep app on anywhere.

A Rep answer carries no manager name, email or status (Brian, 11/9, D18): the app never
shows the rep the manager they typed on `/join`, and nothing asks them about it. If 1R
sends `managerName`, `managerEmail` or `managerStatus`, the site ignores them. Never send
a Confirm Token or anyone else's email. There is no `affirm-manager` action (not built,
D18).

### submit

The FSC submit body (`docs/fsc-flow-contracts.md`) with these fixed values. The page
can't change them; the server builds them (`src/lib/rep-referral-form.mjs`):

```json
{
  "action": "submit",
  "referralKey": "<Referral Key from the Rep Roster>",
  "submissionId": "11111111-1111-4111-8111-111111111111",
  "leadType": "Practice owner",
  "doctorName": "Test Office Manager",
  "practiceName": "TEST North Side Dental",
  "officePhone": "303-555-0100",
  "doctorCell": "",
  "doctorEmail": "",
  "jde": "001234",
  "companies": ["HealthFirst"],
  "needs": ["OSHA and HIPAA compliance"],
  "PVApermission": true,
  "contactFirst": false,
  "preferredContact": "Text",
  "consentText": "The office agreed to a call from HealthFirst.",
  "notes": "",
  "route": "Partner",
  "referrerRole": "Rep",
  "source": "Rep app",
  "status": "Received"
}
```

- `doctorName` holds the spec's **Contact name** (Customer Name). The person a rep talks
  to may be the office manager.
- **Identity comes from the roster.** Write Referring Rep and Referring Rep Email (new
  Referrals columns, D13) from the Rep Roster row that owns the key. The body carries no
  rep name or email.
- **Refuse a mismatch.** If `referrerRole` is `Rep` but the key is not on the Rep Roster
  (or is Disabled), answer 4xx and write nothing. An other-team or FSC key can't post as a Rep.
- **Success is 200 with `{"ok":true}`, only after the row exists.** The site requires
  that body for Rep submits. A repeat `submissionId` answers 200 `{"ok":true}` and makes
  no second row.
- Flows that fire on the new row follow spec v3 section 3, "Existing flows on a Rep row"
  (D1): HSBS 2 and 3 skip Source `Rep app`; 3F sends the HealthFirst intro and the rep's
  receipt; 7B updates go to the rep.

#### Which company: `REP_APP_COMPANIES` (field two-track spec, section 4; slice S2)

The site, not 1R, decides which companies a rep may send to. The 1R submit body above is
unchanged: it carries the company's Solutions value in `companies`, as today.

- **Company table** (`src/lib/rep-companies.mjs`, the only place they are tied together):
  key `HealthFirst` is Solutions `HealthFirst`, shown as HealthFirst; key `Staffing` is
  Solutions `HS Staffing / Recruiting Services (including GoTu)`, shown as Direct Dental.
- **`REP_APP_COMPANIES`** (Vercel env, not secret): a comma list of company keys. Each
  entry is trimmed and matched without regard to case; an unknown entry is dropped; repeats
  count once. Unset, empty, or nothing known left means `HealthFirst` only, which is the
  Send tab exactly as before. `Staffing` alone switches HealthFirst off.
- **It gates sending only.** Track, My Earnings and My Team never read it, so a referral
  or award that already exists stays on every screen when its company is switched off.
- **The page to the site.** A rep submit (`/api/referral` with `"app": "rep"`, or the
  no-JavaScript form post to `/refer/<key>`) carries `"company": "<key>"`. The HealthFirst
  form sends `"company": "HealthFirst"`. The site refuses, before any 1R call, so no row is
  made:
  - no company: 409, "This page is out of date. Reload it, then send again." (a page
    loaded before this rule);
  - two or more companies (a list in `company`, or any `companies` field): 400, "Pick one
    company for this referral.";
  - a key that is unknown, misspelled, switched off, or has no send form: 403, "Referrals
    to this company are not open right now."
  The key is never forwarded to 1R.
  On a no-JavaScript post, the refusal words always show. When the posted form is the open
  panel, they show in that form. Otherwise (none, two or an unknown company named, or
  `REP_APP_COMPANIES` changed between page load and post) they show above the Send tab,
  starting "Your <company> referral did not send." when a known company other than the
  open one was posted. The open form never takes another form's fields, errors or consent.
- **Staffing has a live send form (slice S3).** With `Staffing` listed in
  `REP_APP_COMPANIES`, the Send tab shows the Direct Dental form, and `REP_SENDERS` in
  `src/lib/rep-submit.ts` has a sender for it. Staffing not listed: 403 as above. The staffing
  submit body is the same as the HealthFirst one, with these values set by the site:
  - `companies`: `["HS Staffing / Recruiting Services (including GoTu)"]`;
  - `needs`: `["Staffing"]` (never "OSHA and HIPAA compliance");
  - `practiceType`: exactly `Private practice` or `Group`; anything else, or none, is
    refused 422 and nothing is sent. The screen label "Group (3 or more locations)" is
    display only and is never sent;
  - `consentText`: the words next to the permission box, word for word: "The customer gave
    permission for Direct Dental to contact them about staffing.*" An unticked box is
    refused 422;
  - `route` "Partner", `referrerRole` "Rep", `source` "Rep app", `PVApermission` true,
    `contactFirst` false. No one outside the field build is named. The rep's name and email still come from the Rep
    Roster row, never the request.
  A good staffing send answers `{"ok":true}`, with `terms` and `staffingTerms` named by the
  site (the staffing plan the receipt promise is worded from, `""` with pay off or no plan).
- **Staffing receipt.** "Sent to Direct Dental" and "Direct Dental's team will call
  <contact>." It never names HealthFirst, on the server-rendered page and in the script.
  With pay on and a staffing plan, a third line promises the Reached amount for the practice
  type picked ($100 Private practice, $200 Group at the approved plan); with pay off or no
  plan it carries no dollar amount. The promise depends only on `staffingTerms`, not on
  HealthFirst's `terms`.
- **Retry rule.** Each company form has its own `submissionId`. After a send with no clear
  answer (a timeout, a dropped connection, a 5xx), the page keeps the posted values and the
  id: the retry resends exactly what was first posted and the receipt is worded from those
  values, never from fields changed since. A clear answer, a success or a refusal, ends it.

### list

Unchanged shape. A Rep key returns the rows whose Referring Rep Email is that rep's
email, and nobody else's. The site may send `"feed": true` to its own API to get the
"Latest updates" feed; that is built on the site from the same rows, not sent to 1R.

While `REP_APP_ENABLED` is off, the site also runs a lookup alongside each list and
answers 404 if the lookup refuses the key, so a Rep key's rows never show with the
switch off. No flow change: the list answer still carries no role.

With `REP_APP_ENABLED` on, the site also posts the 1R `lookup` action beside every list or
earnings read that is not served from its 45 second memory. The list and
ledger answers carry no role, so the lookup says whether the key is a Rep's, and the answer
is held only for a confirmed Rep key. An other-team or FSC key, a failed lookup and a refused key
are answered and never held. Counted at 1R: a cold Track open is up to three posts (list,
ledger, lookup, started together); a warm open is none; an other-team or FSC list read is two (list
and lookup) and is never held; a Refresh or the first read after a send skips the memory and
costs the same three. The lookup is the action already described above, with `activate`
true. It needs no new flow field and no flow change.

Track's compact rows and the lead screen (Brian, 11/9; spec section 2) are drawn on the
page from this same answer: no new action, no new field and no new server route. The lead
screen opens inside the app, with no key in a new URL. The plain status words come from
the HealthFirst line's `status`, the `closed` and `signed` flags and `history`, mapped as
spec section 2 says ("Sent to HealthFirst", "HealthFirst is reaching out", "HealthFirst
talked with the doctor", "Signed and billed", "Closed: [reason]"). A value outside that
map shows its existing display words, never a blank. The 7-day flag is unchanged.

### What the Rep app shows

| Result | Page |
|---|---|
| Submit 200 with `{"ok":true}` | "Sent to HealthFirst." "HealthFirst's team will call [contact]." The money line only when `REP_PAY_ENABLED` is on. |
| 4xx on submit (except 408 and 429) | "This link does not work." (404) or the field errors |
| 408 or 429 on submit | "This referral did not send." A retry can work. |
| 408 or 429 on lookup | "This form is not available right now." (503), never "This link does not work." List and earnings say they did not load. |
| No lookup, list or earnings answer in 20 seconds | The same as a 408 or 429 on that call. (Other-team and FSC keys wait 8 seconds while `REP_APP_ENABLED` is off.) |
| No answer in 55 seconds | The same "may already have gone through" message as the other team's app and the FSC app, so the rep doesn't send it twice. A retry reuses the same `submissionId`. A request that arrives while the same `submissionId` is still sending waits only for its own time left, then gets this message; the first send carries on, and a retry after it finishes gets its success. |
| Anything else, including an empty or non-JSON 200 | "This referral did not send." |

No call-back time is promised until Brian answers spec section 9, question 3.

## HSBS 1R earnings (slice 4, My Earnings and money lines)

Same flow and env (`REFERRAL_FLOW_URL`). Gate: the site calls this, and shows any
dollar amount, only while both `REP_APP_ENABLED=true` and `REP_PAY_ENABLED=true` (D14).
With either off, `/api/earnings` answers 404 and no screen shows a dollar sign.

**Pay plan (D15).** `REP_PAY_PLAN` (Vercel env, not secret) says what each event pays:
`reached:50,signed:100,manager:50` (the default when unset) or closed won only, such as
`signed:150`. Brian's 11/9 draft was `signed:150,manager:50` ($150 on the sign, $50 to the
manager, nothing on reaching). **Brian's 11/11 plan is `reached:100,manager:50`: $100 to the rep
when HealthFirst reaches the office, $50 to the manager at closed won, nothing to the rep at the
sign (spec D15). Brian, 11/11: "yes on the payment." `REP_PAY_ENABLED` stays off until he turns it on.** At least one of `reached` or `signed` is required, so a plan with `reached` alone (such as
`reached:100` or `reached:100,manager:50`) or `signed` alone parses, and `manager:50` alone
does not; whole dollars 1 to 1000; nothing else is accepted. Under a plan that pays nothing
at the sign, no screen promises the rep anything at the sign, and "Up to $X more if
HealthFirst reaches your open referrals." counts the reached award for each open referral
with no Reached row of any status and no Signed row.
`REP_PAY_PLAN_STAFFING` (Vercel env, not secret) is the Staffing plan, all three parts
required: `reached_private:100,reached_group:200,manager:50` (field two-track spec,
section 6). It has no default. Unset or a value that doesn't parse means staffing shows no
dollar amounts; it never turns HealthFirst pay off.
A `REP_PAY_PLAN` that doesn't parse promises nothing anywhere, while pay stays on: no pay
line, no receipt money line, no "if they sign" or "when HealthFirst reaches" amount and no
"Up to" line, but `/api/earnings` still answers and every ledger row that exists shows its
amount, on My Earnings, Track and My Team (field two-track spec, slice S1: "ledger rows
that exist still show their amounts"; this replaces rep app v3's "turns every dollar
amount off"). Every answer the rep app page reads that carries money words or amounts
carries `terms`, the pay terms it was worded from: `''` with pay off, `none` with pay on
and no plan, else the plan as `REP_PAY_PLAN` text. With a staffing plan set and valid
(`REP_PAY_PLAN_STAFFING`), its text follows after `;staffing=` (for example
`reached:100,manager:50;staffing=reached_private:100,reached_group:200,manager:50`), so a
staffing plan change is a terms change too; unset or bad adds nothing (slice S5). They are: `/api/earnings` (its 200,
and the 404 it answers with pay off), `/api/referral-list` when the page asks for money
(`earnings: true`, at the top level and inside `money`), every good rep send on
`/api/referral`, and every `/api/team` answer that draws My Team (My Team hands the terms to
the page). The page holds the terms it was drawn with (`data-pay-plan`); when an answer's
differ, it replaces each promise it worded itself with "Pay terms changed. Reload this
page to see them." and words no new one. The "Up to" line
(`summary.upToText`) and the empty My Earnings line (`summary.emptyText`) come worded
from the server, from the plan that counted the amounts.
The plan words every promise. It never changes a total: the site counts the ledger
rows it gets, whatever event or amount they carry. HSBS 10 must write the same amounts.
No flow email to a rep or manager carries a dollar amount: the flows can't see the plan
or `REP_PAY_ENABLED`, so the app is the only place money shows.

### Request

```json
{ "action": "earnings", "referralKey": "<Rep key>" }
```

### What 1R returns

**200** with the rep's own SPIFF Ledger rows where Payee Email is the key's Rep Email and
Payee Role is `Rep`. The manager's rows are not here; they come back on `team` (see "HSBS 1R
team" below). Nobody else's rows. Rows with Test = yes go only to a TEST rep: a Rep Roster row
with Test = Yes, which 1J sets when the rep's name or email contains TEST (spec section
3, Rep Roster columns).

```json
{
  "rows": [
    {
      "referralId": "<Referrals Title, as the list action sends it>",
      "practiceName": "North Side Dental",
      "event": "Reached",
      "payeeRole": "Rep",
      "amount": 50,
      "earnedOn": "2026-11-10",
      "status": "Waiting",
      "paidOn": "",
      "voidReason": "",
      "disputed": false
    }
  ]
}
```

| Key | Rule |
|---|---|
| `referralId` | The same id the `list` action sends for that referral, so the page can join them |
| `event` | `Reached` or `Signed` |
| `amount` | Whole dollars, 1 to 1000 |
| `earnedOn`, `paidOn` | Exactly `YYYY-MM-DD`, Eastern, and a real date. A timestamp drops the row. `paidOn` is required when `status` is `Paid` |
| `status` | `Pending review`, `Waiting`, `Paid` or `Void` (D10, D11) |
| `voidReason` | Plain words, shown to the rep. Required in practice; the site shows "This award did not qualify" if it's blank |

**No pay is a Void row** (D12, Brian 11/8). A duplicate JDE or "Already a customer"
writes one Void row with `voidReason` (for a duplicate: "this office was referred to
HealthFirst in the last 12 months"). It never counts and never pays. Without it the
card would keep promising $50 and $100 for an office that can't pay.
| `disputed` | `true` only on a Paid row Brian flagged (D3). The rep still sees it as Paid, and in the Paid total; since slice S5 its money lines add "Disputed" ("Paid on Nov 18. Disputed"), as field two-track spec section 6 says |
| `company` | Field two-track slice S5, sheet F6.4: the ledger row's Company as the company key, `HealthFirst` or `Staffing`. Missing or `""` is HealthFirst (every row written before the column existed). A Solutions value is read as its key. Any other value still counts in every total and names no company |
| `practiceType` | Slice S5, sheet F6.4 item 4: on a staffing row, the ledger row's Practice Type as stored (`Private practice` or `Group`, written by HSBS 10 from Award Practice Type). The site only names it on the line; the amount is always `amount`. Missing, `""` or any other value names no type |

Unknown key, or not a Rep key: **404**. The site drops any row that breaks the rules
above rather than guess, so a bad row shows nothing instead of a wrong dollar amount.

### How the site counts (one module: `src/lib/rep-earnings.mjs`)

- **Earned = Waiting + Paid.** Pending review and Void are never counted (D10, D11).
- **Signed and closed** come from the list's flag or its line statuses, exactly as the
  Track tiles count them, so a card's money never disagrees with its tile.
- **Up to $X more** = the plan's sign award for each referral with no Signed row (void
  or not) that isn't closed or signed, and isn't a no-pay office (rows, all Void). Under a plan that pays on reaching, only
  referrals with a non-void Reached row count (spec section 2). **Under a plan with no sign
  award (Brian's 11/11 plan, `reached:100,manager:50`)** it is instead the plan's reached award
  for each referral that has **no Reached row of any status** (Waiting, Paid, Pending review
  or Void; a day-5 Pending review row already counts as "$X pending review", so it is never
  counted twice), no Signed row, and isn't closed, signed or a no-pay office.
- Every Track card gets a money line in the spec's words (slice 5 moves it to the
  office's lead screen, spec section 2). Every Void row shows "Not
  paid: [reason].", even next to rows that pay. "$N more if they sign" (the plan's sign award) shows only
  while the office can still sign. A paid award says when it was paid ("Paid $50 on
  Nov 30."). A Paid row stays paid, even if disputed (D3), and a disputed one says "Disputed". A Void line, on screen and for a screen reader, names only the office, the company and the reason: no event and no amount.
- The feed has one line per event: a Waiting or Paid award adds "You earned $N." to the
  status line for the same referral and day, or gets its own line if there is none.
  The Status Log line is read sentence by sentence, with or without "<partner>: " in
  front, so one partner update that reports talked and signed carries both awards as
  one total ("You earned $150.").
- Every ledger row the flow sends is counted. There is no row cap on the site.
  One "Paid $N" line per paid day. Pending review and Void rows aren't in the feed.
- If the earnings call fails, the dollar tiles show "--" and the page says "Your
  earnings did not load." It never shows a $0 that only means it didn't load.
- No pay schedule is promised until the Tuesday call. The footer says only "Earnings
  follow HealthFirst's updates." for a rep with HealthFirst only; with staffing rows or
  referrals it names Direct Dental too ("Earnings follow HealthFirst's and Direct Dental's
  updates.", or Direct Dental alone). A row or referral whose company the site does not know
  names no partner, so the footer reads "Earnings follow your partners' updates."
- **Per company (slice S5).** Each My Earnings line names its company, and a staffing line
  its ledger practice type ("Direct Dental, Group"). Each My Team person lists the rows that
  count in Earned, with company and amount, and each manager line reads "[company], signed".
  Promises come from the referral's own company plan: HealthFirst from `REP_PAY_PLAN`,
  staffing from `REP_PAY_PLAN_STAFFING`. A reached case with no qualify answer and no row
  reads "$100 when HealthFirst confirms the lead qualifies." and shows no earned amount; a
  status past first contact (Meeting set, Proposal or agreement sent, Signed) counts as
  reached for that wording, for both companies. "Up
  to" counts, for each open staffing referral with no Reached row, the private practice
  amount when the case says private practice and the group amount otherwise. Earned is
  always the rows, whatever the plans say.

## HSBS 1R for My Team (slice 5)

Same flow and env as the other 1R actions (`REFERRAL_FLOW_URL`), on the Rep copy until
Brian swaps it live. Spec v3 section 2 "My Team" and "Track My Referrals", section 3
"Team Roster" and "HSBS 1R changes", D4, D5, D16, D18, tests 11, 12 and 16 to 21.

**Brian, 11/9 (D18): managers come from Brian's Team Roster; no manager confirm.** This
replaces the same-day manager confirm and affirm plan (the #49 nomination, the affirm
card, the Manager Mail Log, Confirm For, the confirmed rule, the paired rule, Confirm and
Not my team on the tab) and D17's confirmed-and-paired pay rule. Nothing in this slice
asks anyone to confirm anything, and no manager gets an email from it.

Gate: everything here needs `REP_APP_ENABLED=true`. With it off, the site reads
`isManager` as false, renders no My Team tab, and `/api/team` answers 404 before it reads
the body. There is no `/api/team-answer` and no `/api/affirm-manager` (not built, D18).
The other team's pages and the FSC pages then match `main` byte for byte. Dollar amounts need
`REP_PAY_ENABLED` as well, as in slice 4.

### Team Roster (Brian's list)

A new list, **Team Roster** (site `HSBSPVAReferrals`), holds Brian's roster of managers
and the reps (FSCs, AEs and others) on their teams:

| Column | Type | Rule |
|---|---|---|
| Rep Email | Title, unique | Lowercased. One row per rep |
| Rep Name | text | As Brian's roster spells it. Shown to the manager, so they see a rep on their team who hasn't signed up yet |
| Manager Email | text | Lowercased. The manager this rep reports to on Brian's roster |
| Active | yes/no | Yes while the pairing is current. Brian sets No instead of deleting a row |
| Updated On | date | When Brian last changed the row |

Brian loads it from the roster he sends, and he alone edits it. Flows only read it, like
the other rosters. No flow and no user ever writes to Team Roster: not `/join`, not
1J, not 1R, not the site. TEST pairs (TEST in both emails) are for testing only. Team
Roster reads follow "Every filter" below.

### Who manages whom

One rule, read fresh in every run (D18):

- **A rep's manager** is the Manager Email on the Team Roster row with Rep Email =
  `toLower(the rep's email)` and Active = Yes. No such row: the rep has no manager.
  Nothing a rep types sets it, including the manager on `/join` (a hint only, see "The
  daily gap check").
- **isManager**: the caller's roster email is the Manager Email on at least one Active
  Team Roster row.
- **The team**: every Active Team Roster row whose Manager Email is the caller.
- **Manager pay**: the manager on the rep's Active row in the sign run (see "Manager
  pay").

There is no confirmed or unconfirmed state, no `paired` flag (every team row is paired by
definition), no confirm token and no approval step anywhere in it.

### Changing a rep's manager

Brian only (Brian, 11/9: managers don't change teams before year end; a roster update is
the only reason, and Brian handles it). He edits the rep's Team Roster row (a new Manager
Email and Updated On), or sets Active = No. Reps can't change their own manager, a repeat
sign-up never changes anything (register, step 3), and the rep app has no field for it.
Before he edits a rep's row, he clears any failed HSBS 10 run and any refused sign on
that rep's cases ("Manager pay", point 4). No email goes to either manager.

| What | Result |
|---|---|
| The former manager's My Team | The rep leaves it at once: every team read filters on the current Active rows |
| The new manager's My Team | The rep shows at once: a full row if they've signed up, otherwise "Not signed up yet." |
| Manager pay already written | Unchanged. See "Manager pay": a row is never moved or re-pointed |

### The daily gap check

Brian's daily gap check email (to Brian only) lists every non-Disabled Rep Roster row
with no Active Team Roster row, with the manager the rep typed on `/join` as a hint:
"[Rep] ([rep email]) has no manager on the team roster. At sign-up they named [Manager
Name] ([Manager Email])." It also lists any Active Team Roster row whose Manager Email is
the rep's own. Brian adds or fixes the pair before an office signs: a sign with no Active
row voids that sign's manager award for good ("Manager pay"). It is a daily read with no
new column. It sends nobody else anything, and the hint never sets a manager on its own.

### lookup: isManager on every role

Request unchanged. Every 200 answer gains `isManager`:

```json
{ "pvaName": "...", "pvaEmail": "...", "pvaSlug": "...", "isManager": true }
{ "role": "FSC", "fscName": "...", "fscEmail": "...", "pvaName": "...", "pvaEmail": "...", "pvaSlug": "...", "isManager": false }
{ "role": "Rep", "repName": "...", "repEmail": "...", "services": ["HealthFirst"], "isManager": false }
```

The flow:

1. **isManager** is true when at least one Team Roster row has Manager Email equal to
   `toLower(this person's roster email)` and Active = Yes (D18). TEST pairs count only
   for a TEST person (TEST in their roster name or email, or Rep Roster Test = Yes). The
   `PVA Roster` stores mixed-case emails, so `toLower` is required.
2. Set that Get items step's run-after to succeeded, failed and timed out, and default
   isManager to false. A slow read never turns a working other-team or FSC link into an error.
3. Never send a manager's email, a Confirm Token or anyone's key. Never write to the `PVA Roster`,
   the FSC Roster or the Team Roster.

The site:

- Counts only the JSON boolean `true`. A missing field, `"true"`, `1` or `null` is false,
  so today's answers keep working.

### team (new, read only)

```json
{ "action": "team", "referralKey": "<a key from the PVA Roster, FSC Roster or Rep Roster>" }
```

**200**:

```json
{
  "team": [
    {
      "signedUp": true,
      "name": "Test Rep",
      "email": "test.rep@henryschein.com",
      "role": "AE",
      "registeredOn": "2026-11-02",
      "referrals": [ "<each row exactly as the list action builds it, plus \"reached\": true or false>" ],
      "rows": [ "<exactly what the earnings action returns for this rep: Payee Role Rep>" ]
    },
    { "signedUp": false, "name": "TEST Rep2" }
  ],
  "managerRows": [ "<the earnings row shape, Payee Role Manager, plus \"repEmail\">" ]
}
```

| Key | Rule |
|---|---|
| `team` | One entry per Active Team Roster row whose Manager Email is this person ("Who manages whom"), except a rep whose Rep Roster row is Disabled, who is left out. TEST pairs count only for a TEST person, as in lookup step 1. Required; `[]` never happens, because none answers 404 |
| Signed-up rep (`signedUp` `true`) | The Team Roster's Rep Email has a Rep Roster row that isn't Disabled. `name` is the Team Roster's Rep Name (Brian's spelling), never the name typed on `/join`: anyone can sign up with someone else's email. `email`, `role` and `registeredOn` come from that Rep Roster row. `referrals` reuses the list branch for that rep (newest first, at most 200). `rows` reuses the earnings branch: every row, no cap, Test rows only for a TEST rep |
| `reached` | True only when Talked To Doctor has ever been Yes on the referral (the HSBS 8 "Reached the doctor" roll-up, spec section 6). A signed office with no talk recorded is not reached |
| Not signed up yet (`signedUp` `false`) | No Rep Roster row for the Team Roster's Rep Email yet. **Only** `signedUp` and `name` (the Team Roster's Rep Name) (D4). No email, mobile, branch, role, date, key, counts, referrals or rows. The site shows "[Name]. Not signed up yet." |
| No other keys | No `confirmed`, `paired`, `confirmToken` or approval field (D18). The site ignores any it gets |
| `managerRows` | SPIFF Ledger rows where Payee Email is this person and Payee Role is `Manager`. Same date and amount rules as earnings. Rows with Test = Yes only when this person is a TEST person (TEST in their roster name or email, or Rep Roster Test = Yes), so a real manager never sees an award from a TEST referral. Required; `[]` for none |
| Dates | Exactly `YYYY-MM-DD`, Eastern. Amounts as stored |

**404**, no body: unknown key, a Disabled Rep row, or no Active Team Roster row names this
person. No counts or totals in the answer: the site computes every number with the same
code the rep's own screen uses, so My Team can never disagree with the rep's Earned tile.
Read only: no writes and no email. Answer within 20 seconds (the site waits 25). Build
each object with a Select or Compose that names its keys; never pass a whole row.

The site treats anything else as a failed call and shows "Your team did not load." with
"--" tiles: any status other than 200 and 404 (a 400 or 429 from the flow is a failed call,
never "no team"), an empty or non-JSON 200, a 200 without `team` and `managerRows` arrays,
an entry whose `signedUp` isn't a JSON boolean, a not-signed-up entry without a name, a
signed-up entry without a `referrals` array (or, with pay on, a `rows` array), more than
200 team entries, or a body over 2,000,000 characters. It never shows part of a team or a
$0 that only means a field was missing.

### Who can see what (issue #57)

Every check runs on the caller's **current** Team Roster rows, read fresh on each
request. Nothing the browser sends, and nothing from an earlier read, grants access.

| Action | The check |
|---|---|
| team read (`/api/team`) | 1R filters Team Roster on Manager Email = `toLower(the caller's own roster email)` and Active = Yes. TEST pairs count only for a TEST person, as in lookup step 1. The caller's email comes from the roster row that owns the key, never from the request. A rep shows only while their Active row names the caller |
| A rep's referrals on the tab | Only from that fresh answer. The site never shows the contact name, phone, email, notes or the partner's free-text update on this tab |

So two unrelated managers can never see each other's reps, a Rep key reaches only its
own team and only when an Active Team Roster row names it, and a rep's `/join` hint never
reaches anyone's team. Team visibility rests only on Brian's roster, which no flow and no
user can write (threat model T5, T11). For a not-signed-up entry the site sends the
browser exactly `name`.

### Live TEST check of the team rule (S8)

The site's tests (`src/lib/team-route.test.mjs`, the S8 block) prove only the site's side:
`/api/team` sends 1R just the caller's own key, never widens or reuses 1R's answer, and
answers 404 when 1R does. They run against a fake 1R, so they cannot prove which rows the
live 1R `team` action returns. This check does. BB2 runs it against the live 1R, read only,
on TEST rows only, and writes each result in the build report as pass or fail.

**Needs (TEST rows only).** Brian adds these, since the Team Roster is his list: two TEST
managers, TEST North and TEST South, each with a Rep Roster row and key (TEST in the name,
Test = Yes); one Active TEST Team Roster pair under each (TEST North Rep under TEST North,
TEST South Rep under TEST South), each rep with its own Rep Roster row and key; and one TEST
rep, TEST Loner, with a Rep Roster row and key and no Team Roster row naming them, as rep or
as manager. So the check cannot pass on empty lists, each side also gets its own data, all
Test = Yes and in no payout batch: one TEST Referrals row (with its Service Case) sent from
each rep's link, TEST North Office from TEST North Rep and TEST South Office from TEST South
Rep; in the SPIFF Ledger, one Rep row for each rep's office (Payee Email the rep) and one
Manager row for each manager (Payee Email TEST North or TEST South). BB2 notes each row's
Referral ID and Award Key before the calls. Keys stay in SharePoint and never go in the build
report.

Post each body below to 1R, with the key in place of the name.

| # | Request | Pass | Fail |
|---|---|---|---|
| 1 | `{"action":"team","referralKey":"<TEST North key>"}` | 200. `team` holds exactly one entry, TEST North Rep. That entry's `referrals` is exactly TEST North Office (by Referral ID) and its `rows` exactly TEST North Rep's Rep row (by Award Key). `managerRows` is exactly TEST North's Manager row. No TEST South name, email, Referral ID or Award Key anywhere in the answer | Any TEST South name, email, Referral ID or Award Key in the answer, any seeded TEST North item missing, any extra item, or any status other than 200 |
| 2 | `{"action":"team","referralKey":"<TEST South key>"}` | 200. The same as check 1 with North and South swapped: exactly TEST South Rep, TEST South Office, TEST South Rep's Rep row and TEST South's Manager row, and nothing of TEST North's | As check 1, the other way round |
| 3 | `{"action":"team","referralKey":"<TEST North Rep key>"}` | 404, no body | Any 200, even with `"team": []` |
| 4 | `{"action":"team","referralKey":"<TEST Loner key>"}`, then the same with a made-up key of the right shape that no roster holds | 404, no body, both times | Any 200 |
| 5 | Check 1's body plus `"repKey":"<TEST South Rep key>"`, `"repEmail":"<TEST South Rep email>"` and `"managerEmail":"<TEST South email>"` | The same answer as check 1, item for item, nested `referrals`, `rows` and `managerRows` included | Any TEST South name, email or row, or a different team from check 1 |
| 6 | Check 3's body plus `"managerEmail":"<TEST North email>"` | 404, no body, as check 3 | Any 200 |
| 7 | The run history of every call above | Reads only: no item written and no email sent | Any write or any email |

The check passes only when all seven pass. A failure is P0 (`AGENTS.md`, Permissions):
stop, tell Brian, and leave My Team off until 1R is fixed and the check passes again.

### Manager pay (HSBS 10, issue #57)

Decided **once, in the run that handles the sign**, and never re-pointed afterwards.

HSBS 10 runs on every save and every day at 7 AM, and "Signed" is a state the case keeps,
so a later run sees the same sign again. The unique Award Key alone can't stop a later
run from writing a Manager row that the sign's own run didn't write (manager award 0 at
the sign, a transfer, then the plan raised). So the sign is handled once:

1. **The sign run.** The run that finds the case Signed **and none of the plan's sign
   rows yet** is the sign run: no `<Case ID>|Signed|Rep` row when the plan pays the rep at
   the sign, and, under Brian's 11/11 plan (`reached:100,manager:50`, which pays the rep
   nothing at the sign), no `<Case ID>|Signed|Manager` row ("manager row", Brian 11/11).
   Only the sign run decides the manager row. Any later run that finds that row already
   there writes no new Manager row, whatever the
   plan or the Team Roster say then. (A later run may still void a row that isn't Paid
   for a no-pay reason, D12 and D7.) A Rep Signed row written Void earlier for a no-pay
   reason counts the same way: the office pays no one, so no Manager row follows.
   Under the 11/11 plan the Manager row is always written in the sign run (Waiting, or Void
   when the rep has no Active manager, row 3 of the table below), so it is the record that
   the sign was handled.
2. **Whose eligibility:** the manager on the rep's Active Team Roster row when the sign
   run reads it ("Who manages whom"). Not the manager when the referral was sent, not a
   later one, and never the manager the rep typed on `/join`.
3. **No row with no plan award.** With the plan's manager award at 0 (`REP_PAY_PLAN`
   without `manager:`) in the sign run, write no Manager row, now or ever, for that case.
   Raising the plan later pays only signs after the change.
4. **Order inside the sign run:** decide and write the Manager row first (if the plan
   pays one), then the Rep Signed row. If the run fails between the two, the next run is
   still the sign run (no Rep Signed row yet), and the Manager key already there stops a
   second Manager row. Under the 11/11 plan there is no Rep Signed row, the Manager row is
   the only row and is written last, and a run that fails before it leaves the next run as
   the sign run. A failed run is in Brian's daily exceptions, and so is a sign the
   row guard refused (nothing written). Before Brian changes a rep's Team Roster row, he
   clears any failed HSBS 10 run and any refused sign (row guard) on that rep's cases, so
   a catch-up run never reads a pair that changed after the sign.
5. **Award Key** `<Case ID>|Signed|Manager`, Payee Role Manager, Rep Email = the rep. On a
   Waiting row, Payee Email = that manager. On the Void row, Payee Email is blank: the rep
   had no manager on the roster, so the row never reaches anyone's team read. Either way
   the row holds the key, so no later run can write one. The key is unique, so a repeat
   save and the daily run write nothing new (D6).
6. **Status at signing**, one rule (D18):

| In the sign run | Status | Void Reason | Payee Email |
|---|---|---|---|
| The rep has an Active Team Roster row, its Manager Email isn't blank, and its manager isn't the rep | Waiting (the plan's manager award) | | that manager |
| No Active Team Roster row for the rep (no row, or Active No), or its Manager Email is blank, or the row names the rep as their own manager | Void | no manager on the team roster when the office signed | blank |

   **The roster decides (Brian, 11/9, D18).** No Manager row is ever Pending review, and
   nothing is held for Brian. A later Team Roster change (a pair added, changed or set
   inactive) never adds, moves, releases or re-points a Manager row for a sign already
   handled. Adding a pair pays only offices that sign after it. A sign whose run failed
   or was refused isn't handled yet, so point 4 has Brian clear it before he edits that
   rep's Team Roster row.
7. **Transfers.** A later manager change never moves, re-points or re-creates an
   existing row. A new manager never gets credit for a sign before they were the
   manager: the sign run wrote the row for the manager at signing, wrote it Void, or
   wrote none because the plan paid no manager, and no later run writes one (point 1).
   A Team Roster edit takes effect at once, so a sign after it follows the new row.
8. **Paid rows are never changed** (D3), on a transfer, a void or a late answer.

The site shows the rows as they come: Waiting and Paid count, Pending review and Void
don't, a Void row reads "Not paid: [reason].", and a row for a rep no longer on the team
reads "A former team member" and still counts. In practice `managerRows` holds Waiting
and Paid rows only (no Manager row is Pending review, and a no-manager Void row has a
blank payee), plus a row a later no-pay check voided (D12, D7). A Void or Pending review
row shows only while its rep is on the caller's team now (D4): a rep who is gone never
shows an office through a row that pays nothing.

**Open before pay goes live (Brian, 11/9: the pay setup waits on Katy and Tracy and may
change, so these are recorded, not built).** HSBS 10 is not built, and Sheet 4 is on hold;
the draft plan's HSBS 10 variables were 0 / 150 / 50; the 11/11 plan's are 100 / 0 / 50 (spec D15).
1. **Late runs read late data** (Codex review of #57, P0). The sign run reads the Team
   Roster and the plan when it runs, not when the office signed. A queued, delayed or
   retried run can read a pair or a plan changed after the sign. Options on file: check
   each input against the time the case first became Signed (from version history) and
   send anything unverifiable to Brian; or decide eligibility at the referral; or accept
   the gap with a process rule. Brian picks one when pay is final.
2. **A manager award of 0 leaves no record across a failed sign run.** If the plan is
   raised before the retry, the retry can pay that sign. One fix: in a plan with no
   manager award, write a blank-payee Void Manager row, so the key records the decision.
3. **No held rows to migrate.** Nothing was built under the 11/9 option B, so no Manager
   row is Pending review today. If one ever exists, it stays for Brian and is released
   only to its recorded payee.
4. **Closed won under the 11/11 plan: decided (Brian, 11/11: "manager row").** The plan pays the rep nothing at the sign, so no Rep Signed row exists. The sign run is the run that finds the case Signed and no `<Case ID>|Signed|Manager` row, and the Void Signed row of a no-permission hand back becomes a Void Manager row on that key, so the hand back blocks the manager award the same way. No zero-dollar marker row. Sheet 4 and the hand-back rule in #69 are rewritten to this.

### Every filter

Escape `'` as `''` in every Filter Query, including every Team Roster read: Henry Schein
emails and names can carry an apostrophe. Compare emails with `toLower`.

### What the site shows

My Team, on Rep, FSC and other-team links with `isManager` true (JavaScript only, loaded on
first open):

| State | Shows |
|---|---|
| Loading | "Loading your team." |
| team 404 | "No one is on your team in the HSBS app right now." |
| Failed | Tiles "--", "Your team did not load. Try again in a minute." and Refresh. Never $0 |
| Tiles | Team referrals, Signed; with pay on, Team earned and Team paid. Signed-up reps only |
| Own pay (pay on, and the plan pays a manager or there are manager rows) | "You've earned $X from your team's signed offices. Paid $Y. Waiting $Z." and See each award. With no manager rows yet, the sentence "You earn $X each time an office your team sent signs." shows whenever the plan pays a manager |
| Team row | "Test Rep. AE. Joined Nov 2." / "3 referrals. 2 reached. 1 signed." / pay on: "Earned $150. Paid $50." / "Last referral Nov 9." |
| Not signed up yet | "[Rep name]. Not signed up yet." No button, no date and nothing else |
| No referral in 14 days | "No referral yet." (from Registered On, the sign-up date) |
| A rep's referrals | The same compact rows and lead screen the rep sees (spec section 2): office, sent date, the status chip in plain words, the stale flag, the timeline in plain step words with dates, and with pay on the same money line the rep sees. Never the contact name, phone, email, notes or the partner's free-text update |
