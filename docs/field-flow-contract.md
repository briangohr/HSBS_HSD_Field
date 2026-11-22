# Field app: what the site sends and expects

The site side of the contract between this site and its three Power Automate flows. The
flow side (how 1F, 1J and 7F are built, step by step) lives in the build sheets in `docs/build/`
and on the Field Build Desk. When the two disagree, this doc wins and the sheet is fixed to
match. Ask Brian only when the gap changes what a real partner or rep receives or is paid.

Rules for all three flows: one HTTP trigger per flow, method POST, JSON in and JSON out. The
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
| `PARTNER_PAGE_ENABLED` | `/update/<key>` and `/api/partner-save`, exactly `true` (and `REP_APP_ENABLED`). Off: 404 and no 7F call | No |
| `PARTNER_FLOW_URL` | HSBS 7F Field partner (new site) trigger URL, `https` only | Yes |
| `REP_APP_COMPANIES` | Which companies Send offers: `HealthFirst`, `Staffing`, comma separated. Unset is HealthFirst only | No |
| `REP_PAY_ENABLED` | Dollar amounts on screens, exactly `true`. Off until Brian approves pay | No |
| `REP_PAY_PLAN` | HealthFirst pay plan words (`src/lib/rep-pay-plan.mjs`). Set to `reached:100,manager:50` (promo file) | No |
| `REP_PAY_PLAN_STAFFING` | Staffing pay plan words. Set 11/21/2026 to `reached_private:100,reached_group:100,manager:50` (flat $100). Brian 11/22: `reached_private:100,reached_group:200,manager:50` ($100 under 3 locations, $200 at 3 or more), set together with Ledger Settings (pay sheet "Pay baseline 11/22") | No |
| `REP_ASK_STATE` | The HealthFirst form asks for the practice's state and sends `practiceState`, exactly `true`. Off: no State field and no `practiceState` in the body | No |
| `REP_CONFIRM_ENABLED` | `/confirm/<token>`, exactly `true`. Off: 404 and no confirm call to 1J. Not used at launch. On: the 1J confirm actions below | No |
| `FLOW_CACHE_SECONDS` | Track and Earnings cache in seconds, default 45. 0 turns it off. Over 300 is read as 300; unset, empty, negative or not a number is 45. Unlike the other names, read with exact case only | No |
| `REGISTER_IP_LIMIT` | Sign-ups per IP per 10 minutes, per server instance, default 200 | No |
| `JOIN_RGMS` | The RGM pick list for `/join` (roster match, below), a JSON list of `{"region","name","email"}` built from the field roster. Unset, empty, any bad entry, more than 100 entries or the same region twice: the free-text form. One bad entry turns the whole list off | No, but it holds staff emails, so it lives only in Vercel env |

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
- In the free-text form, AE (decision 113), HSFS and Other may leave both manager
  fields blank. If either is filled, both are checked. With `JOIN_RGMS` set, see
  roster match below.
- `source` is `QR`, `AE link`, `Thrive Signature link` or `Other`, from `?src=` on `/join`.

### Roster match (`JOIN_RGMS` set)

Brian, 11/17: free-text manager and region boxes get filled in every possible way, so
people are matched to the field roster instead. With `JOIN_RGMS` set, `/join` asks for
first and last name, Henry Schein email, mobile, role and the person's RGM, picked from a
list. There are no manager name, manager email or branch boxes.

- The list shows each RGM as `Name (REGION)` and posts only the region code. The RGM's
  email never reaches the page.
- The body keeps its shape. `managerName` and `managerEmail` are the picked RGM's name
  and email as `JOIN_RGMS` spells them, and `branch` is the region code (for example `OR`).
- "Not listed, or I don't know" sends `managerName`, `managerEmail` and `branch` as `""`,
  for any role. HSFS and Other may also leave the pick empty for the same result.
  AE, FSC, RM, ES and EST must pick an RGM or choose "Not listed, or I don't know."
- Any pick must be on the list and cannot match the person's own email. An invalid
  pick returns 422.

What 1J does with it (Brian's live edit, written out on the Field Build Desk):

1. Both manager fields blank is allowed for every role. One blank and one filled is still
   refused.
2. Match to the Rep Roster by `email` first, then by `mobile` (`NNN-NNN-NNNN`, exact). A
   match resends that row's link **to the row's own Rep Email**, never to the typed one, and
   changes nothing on the row. So someone who types a colleague's mobile only sends the
   colleague their own link, under the Link Resends limit.
3. No match: a new Pending row as today, with the picked RGM as the manager hint.

The Team Roster still alone decides managers and pay (D18). The pick is a hint, as the
typed manager was.

Before any 1J call the site has two limits of its own, per server instance, over 10
minutes: `REGISTER_IP_LIMIT` sign-ups per IP, and 5 sends per email from one IP. Either
one answers 429 "Too many tries. Please wait a few minutes." and calls nothing. Only a
send 1J may have acted on counts toward the email limit: a missing flow URL, a refused
connection, a 4xx refusal, a 429 or a 5xx other than 504 gives its count back.

Answers the site reads:

| Answer | Site does |
|---|---|
| 200 `{"ok":true}` | Shows "Check your Henry Schein email." The same words for a new email, a repeat and one over 1J's Link Resends limit |
| 200 with any other body, or non-JSON | 502 "Sign-up is not available right now." The person may try again |
| 4xx other than 408 and 429 | 422, refused fields: "Check your Henry Schein email, then try again." (roster match) or "Check your Henry Schein email and your manager's, then try again." (free-text form) |
| 3xx, 408, 429, 5xx, dropped connection | 502 "Sign-up is not available right now." |
| No answer in 45 s | 504 "This may have gone through. Check your email in a few minutes before you try again." |
| `REGISTER_FLOW_URL` not set | 503 "Sign-up is not available right now." Nothing reached 1J |

### confirm-peek and confirm (`/confirm/<token>`, off)

Sent only with `REP_CONFIRM_ENABLED` on (off today, not used at launch, D18). The token is
64 lowercase hex characters; any other token is unknown before any call. Both wait 15 s.

```json
{ "action": "confirm-peek", "token": "<64 hex>" }
{ "action": "confirm", "token": "<64 hex>", "answer": "yes" }
```

- `confirm-peek` is read only, so a mail scanner opening the link confirms nothing.
  Success is 200 with `repName` set (`managerName` optional).
- `confirm` sends `answer` `yes` or `no`. Success is 200 with `{"ok":true}`.
- 404: "This link does not work." 410: "This link was already used or has expired."
  Anything else that is not 200 is a failed call: "This is not available right now."
- Under D18 neither answer grants or changes anything a screen or pay reads. Only the Team
  Roster decides managers.

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

- The site reads only the first 4,000 characters of the answer. A longer answer is cut
  there, does not parse, and reads as "This form is not available right now."
- Only `role: "Rep"` opens the app. A missing role or any other value is an unknown key.
- `repName` must be set, `repEmail` must look like an email and `services` must include
  `HealthFirst`, or the key is unknown.
- `isManager` counts only as the JSON boolean `true`. It shows the My Team tab; `team`
  is the real gate. 1F sets it from `Get_manager_rows` (Active Team Roster rows naming this
  person as manager, TEST rows dropped for a real caller), which needs Top Count 5,000 and
  Pagination on with a threshold of 5,001 (FT-1b, 11/22/2026). It was Top 500 with
  Pagination off. That cap could only matter if every row it read was dropped as TEST,
  but no read in 1F is left capped.
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
  On the page the State field is a type-ahead box: a couple of letters list the matching
  states from `US_STATES`, and picking one fills it in. Text that is not one state sends
  no state, so the send is refused the same way. With JavaScript off it is a plain list.
  Either way the body carries the same two-letter code.
- The site refuses, before any 1F call, a company that is off in `REP_APP_COMPANIES`, two
  companies, or none.
- Success is 200 with `{"ok":true}`, read in full. Anything else is not success.
- A retry reuses the same `submissionId`. The site also remembers a good send by key and
  id for 30 minutes and does not post it again.
- The wait is 55 seconds from the page (JavaScript on). With JavaScript off the form
  posts to `/refer/<key>`, which looks the key up first, so the submit waits 55 seconds
  minus the time the lookup took, never less than 5 seconds. Both stay under the 60 s
  function limit.
- 504 or no answer within that wait: "This is taking too long. It may already have gone
  through. Do not send it again. Email Brian at Brian.Gohr@henryschein.com."
  (`TIMEOUT_MESSAGE` in `src/lib/field-form.mjs`).
- 408, 429, 5xx, a 200 without `ok`, or a dropped connection: the site answers 502, "We
  did not get a clear answer. It may already have gone through. Do not send it again.
  Email Brian at Brian.Gohr@henryschein.com." (`UNCLEAR_MESSAGE`, same file).
  The row may exist, so these never say "did not send". The page keeps the same
  `submissionId` for any retry.
- `FIELD_FLOW_URL` not set: 503, "This referral did not send." Nothing reached 1F.
- Any 4xx except 408 and 429: "This link does not work."

### list

```json
{ "action": "list", "referralKey": "<key>" }
```

The site waits 20 s. Its answers for `list` and `earnings` are in "list and earnings
answers" below.

200 `{ "referrals": [ ... ] }`. The site keeps only display fields
(`sanitizeReferral` in `src/lib/track.mjs`): `title` or `id`, `doctorName` (or
`doctor`), `practiceName` (or `practice`), `sentOn` or `created`, `route` (`Partner`
only), `closed`, `signed`, and `lines` (or `cases`) with `company`, `status`, `detail`,
`updatedOn` and the stored choices `solutions`, `practiceType`, `qualified`,
`notQualifiedReason`, `closedReason`, and `history` with `on` and `text`. Anything else, an
echoed key included, is dropped. When `doctorName` and `doctor` are both sent,
`doctorName` wins unless it is blank. The same holds for `practiceName` and `practice`.

A referral needs only an id to be kept. A blank `doctorName` never drops it. The rep sees
the practice name, else the doctor name, else "Referral <id>" ("Referral HSBS-F12"). A
manager in `team` sees the practice name, else "Office", never the contact. The lead
screen shows "Contact:" only when both names are filled.

A line needs only `company` to be kept. 1F sends a line's status as `partnerStatus` (the
case's Partner Status), which is blank on a new case until the partner's first update,
because the 3F flows set Status, not Partner Status. Such a line reads "Sent to" its own
company ("Sent to Direct Dental"). Only a referral with no line at all reads "Sent to
HealthFirst".

Every row counts. The site sorts newest sent first and keeps all of them: Sent, In progress
and Signed are the true totals, and Track draws 50 rows at a time with "Show more". 1F reads
every referral and case line up to 5,000, and the site fails a read over 5,000. The two
referral reads (`Get_referrals_list_rep`, `Get_team_refs`) need Top Count 5,000 and
Pagination on with a threshold of 5,001, because with Pagination off SharePoint stops at the
Top Count (200 until FT-1) with no error. The threshold is one over the limit on purpose: a
rep with 5,001 referrals then reaches the site as 5,001 rows and fails the read, where a
threshold of 5,000 would hand the site a full-looking list of exactly 5,000. The case reads (`Get_cases_all_rep`,
`Get_cases_all_team`) take the same settings (Top Count 5,000, threshold 5,001), and the
site fails an answer with more than 5,000 case lines (`CASE_READ_MAX`).

**One case read, not one per referral (FT-4, 11/22/2026).** 1F used to read Service Cases
once per referral, one referral after another, at about 0.6 s each: 22 referrals took 15 to
20 s and 207 took about two minutes, so every Track, Earnings and My Team read at that size
timed out. 1F now reads a rep's cases once (`Get_cases_all_rep`, and `Get_cases_all_team`
once per team member) with the filter `Referral/Id ge <lowest referral id> and Referral/Id
le <highest>` on the indexed `Referral` column, keeps only lines whose referral is the
rep's own (`Mine_cases_rep` / `Mine_cases_team`), and sends them beside the referrals:

```json
{ "referrals": [ { "id": 12, "title": "HSBS-F12", "...": "..." } ],
  "cases": [ { "referralId": 12, "company": "HealthFirst", "...": "..." } ] }
```

Each line carries `referralId` (the Referrals item id) and the same fields as before. The
site puts each line back on its referral (`attachCases` in `src/lib/field-flow.mjs`), so
everything after the read sees the old shape. A line whose `referralId` matches no
referral in the answer, `cases` that is not a list, or more than 5,000 lines is a failed
read, never a line dropped. An answer with no top-level `cases` (lines already on each
referral) still reads as before. In `team`, each signed-up member carries its own `cases`
beside its `referrals`, and the site works out each referral's `reached` from its lines
(a line with `talkedToDoctor` "Yes") when 1F does not send it. Past 5,000 items in a list,
a filtered read needs its filter column indexed: Referrals `Referring_x0020_Rep_x0020_Email` and Service Cases `Referral`.
More than 5,000 referrals, or an answer over 4 MB, is a failed read ("Your referrals did not
load."), never a short list. The same holds for each member's referrals in `team` (inside
that answer's 2 MB limit).

**`updated` (sheet PU, piece E).** 1F (new site) sends a case's `updated` from Last Partner
Update, not Modified: `@coalesce(item()?['Last_x0020_Partner_x0020_Update'], '')` in
`Select_cases_rep` and `Select_cases_team`. Only a partner save (7F) or a partner reply
(7H) stamps it, so a flow's own write to a case (7G's miss count) never reads on Track as an
update. A blank `updated` falls back to `lastTouch`, then to the referral's sent date, as
before.

**Last updated and What happens next (Brian, 11/21/2026).** The rep's lead screen shows two
lines under the chip, worked out on the server (`leadViews` in `src/lib/rep-lead.mjs`) from
what `list` already sends: "Last updated <date>." is the main line's `updated` (else
`lastTouch`, else the sent date, as above), and "What happens next: ..." follows the chip's
own words (`nextWords`), so it never disagrees with the chip and promises no time. A
manager's view (My Team) carries neither. No new flow field.

### Duplicate check (`/api/referral-check`, Brian 11/21/2026)

Before a new send, the page posts `{ referralKey, company, practiceName, jde }` to
`/api/referral-check`. The site reads the rep's own `list` (the same body and cache as
Track, and the same lookup that must confirm a Rep key) and answers 200
`{ "warning": "<words>" }`, or `{ "warning": "" }` for none. It sends nothing new to 1F and
writes nothing. It warns, never blocks: the page shows the words once, and Send again for
the same office sends it.

- A match is a referral still in progress whose line for the same company (HealthFirst or
  Staffing) is not closed, signed or closed as not qualified, with the same practice name
  (letter case, spaces and punctuation ignored, `&` read as `and`) or the same JDE (as text,
  so leading zeros count). A referral with no line yet counts as HealthFirst
  (`src/lib/rep-duplicate.mjs`).
- 1F `list` sends no JDE today, so only the name matches. The JDE match works, with no site
  change, once 1F adds `jde` to each list row (`Append_referral_rep`, a Referrals
  `JDEAccount` read). The JDE is read on the server only and is never in an answer.
- The check sees only this rep's own referrals, never another rep's.
- A bad key is 404 before any call, and a key the lookup refuses (or a role not `Rep`) is
  404. Any other failure, a timeout or the rate limit (30 per key per 10 minutes) answers no
  warning, so the send goes on to `/api/referral`, which checks the key again.
- The page starts the check when the practice name or JDE is filled in, and Send waits for
  it at most 5 seconds ("Checking"), then sends with no warning. A retry of a send with no
  clear answer is never checked. With JavaScript off there is no check.

### earnings

```json
{ "action": "earnings", "referralKey": "<key>" }
```

200 `{ "rows": [ ... ] }`: the person's own SPIFF Ledger rows, Payee Role `Rep`. The site
reads `referralId`, `practiceName`, `company`, `practiceType`, `event` (`Reached` or
`Signed`), `amount`, `status` (`Waiting`, `Paid`, `Pending review`, `Void`), `earnedOn`,
`paidOn`, `voidReason`, `disputed`, `payeeRole`. `/api/earnings` answers 404 while
`REP_PAY_ENABLED` is off. The site waits 20 s. More than 5,000 rows is a failed read
("Your earnings did not load."), never earnings cut short. 1F's `Get_ledger_rep` needs Top
Count 5,000 and Pagination on with a threshold of 5,001, for the reason given under list
(FT-1b, 11/22/2026).

### list and earnings answers

Both also need the lookup to confirm a Rep key (What must stay true, below). The words
are "Your referrals did not load." for Track and "Your earnings did not load." for
earnings.

| 1F answers | Site |
|---|---|
| 200 with `referrals` (list) or `rows` (earnings) as a list | Shows them |
| 4xx other than 408 and 429 | 404 "This link does not work." |
| 3xx, 408, 429, 5xx, a 200 without the list, or non-JSON | 502, did not load |
| No answer in 20 s | 504, did not load |
| `FIELD_FLOW_URL` not set | 503, did not load. Nothing reached 1F |

### team

```json
{ "action": "team", "referralKey": "<key>" }
```

200 `{ "team": [ ... ], "managerRows": [ ... ] }`: every Active Team Roster row whose
Manager Email is this person. Each member has `name`, `role`, `signedUp`, and when signed
up `email`, `registeredOn`, `referrals` and `rows`. `managerRows` are this person's own
ledger rows with Payee Role `Manager` and event `Signed`. The site drops a Manager row with
any other event, `Reached` included. Only 404 means "no team"; every other failure is
"Your team did not load." The site waits 25 s. More than 200 members, more than 5,000
`managerRows`, more than 5,000 `rows` for one member, or a body over 2,000,000 characters,
is a failed call, never a team cut short. 1F's `Get_team_rows` (Team Roster),
`Get_manager_ledger` and `Get_rep_ledger` (SPIFF Ledger) need Top Count 5,000 and
Pagination on with a threshold of 5,001, for the reason given under list (FT-1b,
11/22/2026). `Get_team_rows` was Top 200 with Pagination off, so a 201st member was dropped
with no error and the 200-member check could never fire. Since FT-4 (11/22/2026) 1F reads
the members 20 at a time (`Each_team_row` concurrency 20). Every Team Roster row adds
exactly one item to the answer (a Disabled rep adds a marker that 1F drops), and 1F answers
500 unless the count matches, so a member is never missing from a team that loaded. The raw answer stays on
the server; `src/lib/rep-team.mjs` shapes what the browser gets (no rep email, no key).

## HSBS 7F Field partner (`/update/<key>`)

The partner update page (sheet PU, `docs/build/field-partner-updates.md`, pieces A and B).
`<key>` is a Partner Links Link Key: 40 hex characters. Any other key is 404 before any
call. Every body carries `key` and nothing that names a person. 7F is the gate: it finds
exactly one Active Partner Links row with the key and lists or writes only that partner's
open cases, Test matching the row. `src/lib/partner-flow.mjs` is the only module that posts
to 7F. Waits: 20 s for `leads`, 55 s for `save`.

### leads

```json
{ "action": "leads", "key": "<40 hex>" }
```

200 `{ "partner": "<Partner Links Title>", "leads": [ ... ] }`. Each lead: `id` (Service
Cases item id), `ref` (the Referrals Title: `HSBS-F<n>`, or `HSBS-A<n>` for the 12 moved
from the old site), `practice`, `contact`, `company`, `introducedOn`,
`status` (Partner Status), `talkedToDoctor`, `meetingDate`, `nextUpdateDue`,
`missedUpdates`. Dates are `yyyy-MM-dd`. The site keeps only these (`readLead`); anything
else, a phone, email or JDE included, is dropped. A lead with a bad `id` or `ref` is
dropped. More than 500 leads is a failed read. The page sorts overdue (Missed Updates above
0) first, then by due date.

### save

```json
{
  "action": "save",
  "key": "<40 hex>",
  "submissionId": "<uuid>",
  "updates": [
    { "id": 36, "choice": "meeting", "talkedToDoctor": "Yes", "meetingDate": "2026-11-24",
      "signedDate": "", "signedProduct": "", "closedReason": "", "note": "" }
  ]
}
```

1 to 50 updates, each lead once, only the leads the partner touched. `choice` is one of
`trying`, `qualified`, `dq_noanswer`, `dq_notinterested`, `meeting`, `proposal`, `signed`,
`lost`, `nochange` (`STAND_CHOICES`, one list since 11/20/2026: qualify first, then the
deal). Since 11/21/2026 the page no longer offers `dq_notinterested` (one Disqualified
only); the save still takes it, and 7F still stores it as below. `nochange` is a tick box
under the stage list on the page, not a stage. The site checks every update first (`checkUpdate` in `src/lib/partner-form.mjs`) and
sends fields that don't belong to the choice blank. The page no longer asks "Have you talked
to the doctor?": the site sets `talkedToDoctor` from the choice (`TALKED_FOR`): `Not yet,
still trying` for `trying` and `dq_noanswer`, blank for `nochange`, `Yes` for the rest. `meeting` (page label "Demo set") needs a `meetingDate` today or
later; `signed` a `signedDate` not after today, `signedProduct` up to 100; `lost` a
`closedReason` of the five (`No response` is the `dq_noanswer` choice now); `note` is
optional, one line, up to 300. Today is Eastern time. The two day rules (meeting today or
later, signed not after today) are checked by the page and by 7F, not by
`/api/partner-save`, so a resend after midnight still reaches 7F's tag check. 7F skips the
day rules on a save whose tag it already holds on any of its cases.

A page loaded before 11/20/2026 still sends its own `talkedToDoctor` answer. An update that
carries one gets the old rules, so an open tab or a retry of a partly written save still
reaches 7F: `talkedToDoctor` must be one of the three Talked To Doctor choices and is sent
as is; `choice` is one of `meeting`, `proposal`, `signed`, `lost`, `handback`, `nochange`;
`handback` needs a note; `lost` also takes `No response`. 7F accepts all of these. The new
page never sends `talkedToDoctor` or `handback`.

What 7F stores per choice (the words are placeholders until HealthFirst sends its
Salesforce picklist; every stored value is an existing column choice):

| choice | Partner Status | Qualified | Closes the lead | Email to Brian |
|---|---|---|---|---|
| `qualified` | Reached | Yes | no | no |
| `trying` | Trying to reach | unchanged | no | no |
| `dq_noanswer`, `dq_notinterested` | Not moving forward | No, Not Qualified Reason `Other`, Not Qualified Note the label, Closed Reason `Not qualified` | yes | "Field lead disqualified: <ref>" |
| `meeting`, `proposal`, `signed` | Meeting set, Proposal or agreement sent, Signed | Yes | `signed` only | no |
| `lost` | Not moving forward | unchanged, Closed Reason as sent | yes | no |
| `nochange` | unchanged | unchanged | no | no |

The Status Log line uses the page label ("Qualified", "Disqualified, not interested", "Demo
set"). Track reads those labels (`stepWords` in `src/lib/rep-lead.mjs`): "HealthFirst
qualified the lead", "Closed: did not qualify", "Meeting set". A closed lead leaves the
page; Qualified Yes with Reached is what the pay promise reads as reached and qualified.

| 7F answers | Site |
|---|---|
| 200 `{"ok":true,"saved":n}`, n equal to the updates sent | Success, "Saved n updates." Nothing else is success: a 202, a 200 without `ok` true and a whole `saved`, or non-JSON is no clear answer |
| 200 `{"ok":true,"saved":n}`, n from 1 to one below the updates sent | Partial: 7F skipped a lead that closed or moved between its check and its write. "Saved n of m updates. k leads closed or changed while you worked and did not save. The list below is current." |
| 200 `{"ok":true,"saved":0}` | Nothing saved: "Nothing saved. This lead (These m leads) closed or changed while you worked. The list below is current." |
| 200 with `saved` above the updates sent | Breaks the contract. The site answers 502 and treats it as no clear answer, so Save resends the same `submissionId` |
| 404 | "This link does not work." |
| 410 (Key Expires past or blank) | "This link has expired. Use the link in your latest email." |
| 422 `{"error":"reload","id":n}` | "Lead HSBS-F<n> changed. Reload the page." Nothing was written |
| 422 `{"error":"bad_value","id":n}` | Names the lead. Nothing was written |
| 3xx, 408, 429, 5xx, timeout | "This is taking too long. It may already have gone through. Press Save again; it will not save twice." |

`/api/partner-save` answers the page 200 `{"ok":true,"saved":n,"sent":m,"partial":bool,"message":"..."}`;
`sent` and `partial` are the site's own fields, so 7F is unchanged. After a save the page
reloads with `?saved=<n>&of=<m>`, so partial and zero words survive the reload, then drops
the counts from the address so a refresh does not repeat them. A count pair that does not
add up (`saved` above `of`, `of` outside 1 to 50, not whole numbers) shows no words. A page
opened before this change reloads with `?saved=<n>` alone, read as a full save.

A save with no clear answer keeps its `submissionId` and the exact updates; the answers
lock and Save resends them. 7F tags each Status Log line `[s:<submissionId>]` and skips a
case that already holds the tag, so a resend writes nothing twice.

### Field Notify Outbox and HSBS 7N (no site change)

The site never reads or writes the Field Notify Outbox list and never calls HSBS 7N. 7N is a
scheduled flow that retries failed field notifications from that list (sheet PU, piece E).
No request or answer in this contract changes. Since 11/22/2026 (FT-2b) 7F writes a
disqualify hand back to the Outbox and sends it from there. The `save` answers are the same.
A failed send still answers 200. A failed Outbox lookup or row create answers 503, which the
site already treats as no clear answer: the page resends the same `submissionId`, 7F finds
the case already written, and makes the Outbox row then. FT-2c (7G asks) will add Outbox
writes inside 7G and updates this note if anything changes.

## What must stay true

- The key (Referral Key or Partner Links Link Key) is a secret in the URL, and so is the
  `/confirm/<token>` token. Pages that carry one (`/refer/<key>`, `/update/<key>`,
  `/confirm/<token>`) set `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow` on
  every answer, the 404 they give with their switch off included, and load no analytics.
- Track and Earnings return rows only for a key the lookup confirms as a Rep. A key the
  lookup refuses gets 404 and a failed lookup gets 502, even when `list` or `earnings`
  answered (`confirmRep` in `src/lib/rep-reads.mjs`).
- The Track and Earnings cache holds an answer only after the lookup confirms a Rep key;
  errors are never held. A send clears that key's entries only after 1F answers 200
  `{"ok":true}`, and only on the server instance that handled it. A send that timed out
  but was written, or a read on another instance, can show the older list for up to
  `FLOW_CACHE_SECONDS` (45 s by default). Track right after a send and the Refresh button
  read fresh.
- A send with no clear answer (a timeout, a dropped connection, a 5xx) keeps its
  `submissionId` and the exact fields first posted, so a retry resends the same referral.
- Rate limits are per key with a per-IP backstop, so many people behind one office IP are
  never limited, while one key or one address cycling keys is.
- No key, flow URL, email or office detail is ever logged.
