# Field partner updates on the new site (sheet PU)

Written 11/20/2026 by Claude from a read-only trace of `sites/HSBSField`, the "(new site)"
flow packages and this repo. Field only. This sheet replaces pieces 1 and 2 of
`docs/plans/partner-update-window.md` and keeps that plan's decided rules (O1 to O8,
"How it works", T1 and T2). Where the two differ, this sheet wins.

The site never edits a flow, list or Vercel setting. Since 11/21/2026 Claude makes the live
changes itself (`CLAUDE.md`, Live changes): the build thread writes the code PR and the flow
packages, then imports, turns on and fills in. Brian signs in and gives the go for the first
email to a real partner.

## Why

Part 1 audit, 11/20: field partners get an intro and nothing after it.

- **Updates out:** no field flow asks a partner for an update. 0 asks sent.
- **Updates back:** no field partner page or save exists on the new site. The old
  "HSBS 7A Field copy" and "HSBS 7B Field copy" are Off and read the old site's lists.
  All 17 Service Cases have a blank Partner Status, so Track reads "Sent to" for every lead.
- **Email replies:** the Direct Dental contact answers by replying to the intro email. Two
  replies (11/19) sit only in Brian's inbox.

## What the trace found (11/20, read only)

| # | Fact | Evidence |
|---|---|---|
| 1 | Track already shows Partner Status. 1F `list` sends each case's `Partner_x0020_Status` as `partnerStatus` and `Modified` as `updated`. A save that writes Partner Status shows on Track with no site change. But Track reads `updated` (Modified) as the update date and for its 7-day stale line, so any flow write to a case (7G's miss count) would look like a partner update. Piece E fixes that | 1F (new site) package, `Select_cases_rep`; `src/lib/track.mjs` `sanitizeLine` |
| 2 | 1F `list` sends no note, history or meeting date. Track can show the status word and "Updated <date>" only | Same |
| 3 | Partner Status choices on Service Cases already hold every word Track knows: `Meeting set`, `Proposal or agreement sent`, `Signed`, `Not moving forward`, `Hand back to HSBS`, `No change this week`, plus older values | Service Cases field read, `src/lib/partner-status-words.mjs` `STAND_WORDS` |
| 4 | Service Cases has every column the save needs: Partner Status, Talked To Doctor (`Yes`, `Not yet, still trying`, `Not yet, haven't tried`), Last Touch, Last Partner Update, Partner Updated By, Missed Updates, Next Update Due, Meeting Date, Signed Date, Signed Product, Closed Reason (8 choices), Closed On, Hand Back Note, Status Log, Test, Referral (lookup) | Service Cases field read. No column to add |
| 5 | Partner Links exists on the new site (list `94dc32d9`) with Title, Email (`PartnerEmail`), CC Email (`CCEmail`), Services (multi choice), Link Key (`LinkKey`), Key Expires (`KeyExpires`), Active. It has 0 rows | List read |
| 6 | Every Service Case has a blank Next Update Due and Missed Updates 0. The due date 3F stamps lives on the Referrals row, not the case | Case read; 3F HealthFirst (new site) package, `Due_date` and `Mark_introduced` |
| 7 | 3F's due date skips weekends but not holidays (`Due_date` adds 2, 3 or 4 days by weekday) | 3F package |
| 8 | Intros go out from Brian's mailbox. A TEST referral (`Test` on) sends only to Brian. Partner replies arrive in Brian's inbox with the subject `RE: HSBS referral HSBS-F<n>: <practice> for <company>` | 3F package `Send_intro`, `Test_mode`; Brian's inbox, a reply of 11/19 |
| 9 | Field cases live only on `sites/HSBSField`. The old 7C and 7D read the old site's lists, so they cannot list or count a new-site case. O8 needs no filter | List IDs in the packages vs the old-site flows' site address |

Build thread read of the live lists, 11/20 (read only): internal names match the sheet
(`Status_x0020_Log`, `Missed_x0020_Updates`, `Hand_x0020_Back_x0020_Note` and so on).
Service Cases is list `248a4afc`. 12 referrals moved from the old site keep the title
`HSBS-A<n>`; new ones are `HSBS-F<n>`. So a ref is `HSBS-` plus letters and digits, and 7H's
subject filter must match both (part B).

Fact 9 closes trace questions 1, 2 and 4 of the plan for new-site cases. Question 3 is fact 6.

## The build

Three new flows and one site page, all on the new site, all field only. Nothing reuses an
old 7A, 7B, 7C or 7D, or any "FSC copy".

| # | Piece | What | Built by |
|---|---|---|---|
| A | Partner page | `/update/<key>` on this site, behind `PARTNER_PAGE_ENABLED` | Code PR |
| B | HSBS 7F Field partner (new site) | HTTP flow: `leads` and `save` for the page | Package |
| C | HSBS 7G Field daily ask (new site) | Weekdays 8:00 AM ET: count misses, email each partner its due leads, escalate to Brian at 2 misses | Package |
| D | HSBS 7H Field email reply capture (new site) | A partner's reply to an intro logs an update on the case | Package (Q1, Brian, 11/20: yes) |
| E | 1F (new site) list date | `updated` comes from Last Partner Update, not Modified | One paste-ready block per Select box |

Names: "7F" to "7H" are new numbers so no field flow shares a name with an old one.

### Settings both 7F and 7G carry

Two Compose steps, the same text in both flows. Changing one means changing both.

- `Window_days`: `2`
- `Holidays`: `["2026-11-26","2026-11-27","2026-12-24","2026-12-25","2027-01-01","2027-01-18"]`
  (O6; not checked against the Henry Schein list).

**Business days after a date.** Input: a date `d` (`yyyy-MM-dd`, Eastern) and `n`.
1. Select from `range(1, 15)`: `addDays(d, item(), 'yyyy-MM-dd')`.
2. Filter: `dayOfWeek(item())` is not 0 or 6, and `Holidays` does not contain `item()`.
3. Result: `body('Filter')[sub(n, 1)]`.

"Today" is always `convertFromUtc(utcNow(), 'Eastern Standard Time', 'yyyy-MM-dd')`.

### Reading Service Cases

Every "Get Service Cases" in 7F, 7G and 7H is a Get items with an OData filter that does
the Test test on the server (`Test eq 1` or `Test eq 0`), Pagination on in the action's
settings, threshold 5000. The open test is a Filter array step right after the read, not
part of the OData filter, because a SharePoint `ne` filter on a choice column can drop the
blank Partner Status that most open cases have (build thread, 11/20). No step uses a fixed
top count, so closed cases never crowd out open ones. If a read returns 5000
rows, the flow emails Brian `Field cases over 5000: raise the threshold` and stops before
writing. Today there are 17 cases.

### Writing a case (all three flows)

7F, 7G and 7H all write Service Cases, and their runs can overlap, so no write may rest on
a stale read. Every Service Case write in these flows, with no exception, is a "Send an
HTTP request to SharePoint" pair. That covers Status Log lines and tags, and also 7G's Next
Update Due and Missed Updates writes (C0 and C1) and 7H's update date:

1. GET the item right before the write, reading its `odata.etag` and current values.
2. Re-check the step's condition on that fresh copy, then MERGE the new values with header
   `IF-MATCH: <etag>`, built from the fresh copy (Status Log appended to the fresh log,
   Missed Updates = fresh count + 1). The conditions are: the `[s:...]` or `[esc:...]` tag,
   open, Test; for C0, Next Update Due still blank; for C1, Next Update Due still before
   today. If the condition no longer holds, skip the case with no write. So a 7F save that
   lands between 7G's read and its write (new due date, Missed Updates 0) is kept: C1 sees
   the new future due date and skips.
3. A 412 (someone wrote in between) goes back to 1, up to 3 tries. A third 412 fails the
   step: 7F answers 5xx (the page keeps the save for a retry), 7G and 7H fail the run so the
   run history shows it, and the next run picks the case up.

So no flow can erase another's Status Log line or tag.

### Words used

- **Field partner:** an Active Partner Links row on the new site. A row whose Title contains
  `TEST` is a TEST partner.
- **Its cases:** Service Cases whose Service is in the row's Services, whose Test matches the
  row (TEST partner: Test on; real partner: Test off), and whose Referral has Introduced On.
- **Open:** Partner Status is blank or not one of `Signed`, `Not moving forward`,
  `Hand back to HSBS`, `Close won`, `Close loss`, `Returned to HSBS`.
- **Due:** Next Update Due on or before today. A blank Next Update Due counts as
  `Created` + 2 business days (fact 6), so a case made yesterday is not due yet and every
  older open case is due on go-live day. This is O7 without a bulk edit.

## A. Partner page (code PR)

One PR. It adds a route, so it updates `CLAUDE.md` Scope and `docs/field-flow-contract.md`
in the same PR (a new flow, HSBS 7F, and `PARTNER_FLOW_URL`).

- **Route:** `/update/<key>`. `<key>` is the Partner Links Link Key, 40 hex characters.
  Anything else is 404 before any flow call.
- **Switch:** `PARTNER_PAGE_ENABLED` exactly `true`, and `REP_APP_ENABLED` exactly `true`.
  Otherwise the page and its APIs answer 404 and call nothing.
- **Env:** `PARTNER_FLOW_URL`, the 7F trigger, `https` only, secret, Vercel env only.
- **Module:** `src/lib/partner-flow.mjs` is the only module that posts to 7F. Same call rules
  as `field-flow.mjs`: no redirects, JSON in and out, 20 s for `leads`, 55 s for `save`.
- **Headers:** `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, no analytics.
- **Rate limit:** per key with a per-IP backstop, as `/refer`.
- **What the page shows:** one card per open lead, oldest due first: reference
  (`HSBS-F<n>`), practice, doctor or contact name, company, date introduced, current status,
  and "Update due <date>" or "Overdue" when Missed Updates is above 0. No phone, email, JDE
  or rep detail. The partner has those in the intro.
- **What the partner answers per lead** (all optional per lead; only touched leads are sent).
  Changed 11/20/2026 (Brian, after the HealthFirst process call: qualified means reached
  within up to 4 attempts, knows the partner will follow up, and wants a demo). The page asks
  one question, no longer "Have you talked to the doctor?":
  1. "Where does it stand?" in two groups (Brian, 11/21 morning). Qualifying: Reached the
     customer (code `qualified`, hint "Knows you will follow up and wants a demo"), Not
     reached yet (`trying`, attempts 1 to 3 so far), Disqualified: no answer after 4 attempts
     (`dq_noanswer`). One Disqualified only: "Disqualified, not interested" is gone from the
     page (the save still takes `dq_notinterested` from an older tab). After qualified: Demo
     set, Proposal or agreement sent, Signed (Closed won), Not moving forward (Closed lost).
     Stored values unchanged. Once a lead is qualified (Partner Status Reached or any later
     step) the Qualifying group is frozen: "Reached the customer (done)", no buttons.
     No change this week is not a stage and not a section: a tick box under the list, for
     the weeks between steps (a demo set 2 weeks out). Ticked, it clears and greys the stage
     list and sends `nochange`; 7F leaves Partner Status as it is. Its hint names the stage
     the lead keeps. Hand back to HSBS is folded into Disqualified.
     Each lead card opens with the reference and practice, then one row each (Brian 11/21):
     Contact, Service, Introduced, Stage, Next update ("Due <date>", or "Overdue. Now due
     <date>" in red). Not reached yet carries the hint "Need help reaching them? Reply to the
     intro email." The page shows no rep email: 7F's lead read sends none.
  2. Demo set: demo date, required, today or later. Signed: signed date, required, not in
     the future; product, optional, up to 100 characters. Not moving forward: reason,
     required, one of `Chose another provider`, `Price`, `Timing`, `Not a fit`, `Other`.
  3. Note: optional, up to 300 characters, one line.
  The site sets Talked To Doctor from the choice. What 7F stores per choice is the table in
  `docs/field-flow-contract.md` (HSBS 7F, save). The words are placeholders until HealthFirst
  sends its Salesforce picklist (Tracy and Cat); swapping them is a text change in
  `STAND_CHOICES` and 7F's `Labels`. 7F patch: `build/patch_7f_status_list.py` in the
  project's partner-updates folder. Sections B4 to B6 below describe the first version; where
  they differ, the contract table wins.
- **One Save button** for the page. Success reads "Saved N updates." A refusal for one lead
  names that lead and keeps every typed answer.
- **Retry:** each save carries a `submissionId` (a UUID made when the partner presses Save).
  A save with no clear answer (timeout, dropped connection, 5xx) keeps that id and the exact
  fields first sent, so pressing Save again resends the same save, as `/refer` does.
- **Copy:** approved partner spellings, no HSPA, HSRA or NumbersIQ, no em dashes or arrows.
- **Tests:** unit tests for the body builder and answer reader; a browser test against a local
  fake 7F (list, save, a refusal, an unknown key, an expired key). Never a live flow.

### 7F contract

Every body carries `key`. Answers are JSON.

`leads`:

```json
{ "action": "leads", "key": "<40 hex>" }
```

200:

```json
{
  "partner": "HealthFirst",
  "leads": [
    {
      "id": 36,
      "ref": "HSBS-F90",
      "practice": "TEST North Side Dental",
      "contact": "TEST Office Manager",
      "company": "HealthFirst",
      "introducedOn": "2026-11-19",
      "status": "",
      "talkedToDoctor": "",
      "meetingDate": "",
      "nextUpdateDue": "2026-11-23",
      "missedUpdates": 0
    }
  ]
}
```

`save`:

```json
{
  "action": "save",
  "key": "<40 hex>",
  "submissionId": "11111111-1111-4111-8111-111111111111",
  "updates": [
    {
      "id": 36,
      "choice": "meeting",
      "talkedToDoctor": "Yes",
      "meetingDate": "2026-11-24",
      "signedDate": "",
      "signedProduct": "",
      "closedReason": "",
      "note": ""
    }
  ]
}
```

`choice` is one of `meeting`, `proposal`, `signed`, `lost`, `handback`, `nochange`. At most
50 updates per save.

| Answer | Meaning | Site shows |
|---|---|---|
| 200 `{"ok":true,"saved":n}` | Every update written, now or by an earlier try with the same `submissionId` | "Saved n updates." |
| 200 `{"ok":true,"saved":n}`, n below the updates sent (0 included) | 7F skipped a lead that closed or moved between its check and its write | "Saved n of m updates. ..." or "Nothing saved. ..." (contract, 7F answers) |
| 404 | Unknown key, inactive row, or more than one row with the key | "This link does not work." |
| 410 | Key Expires is past | "This link has expired. Use the link in your latest email." |
| 422 `{"error":"reload","id":36}` | The case is not this partner's, not open, or the wrong Test | "Lead HSBS-F90 changed. Reload the page." Nothing in that save was written |
| 422 `{"error":"bad_value","id":36}` | A required answer is missing or not an allowed value | Names the lead and the field |
| 408, 429, 5xx, timeout (55 s) | No clear answer | "This is taking too long. It may already have gone through. Press Save again; it will not save twice." |

7F checks every update before it writes any (two loops: check all, then write all), so a
422 from the check loop means nothing in that try was written.

**Saving twice is safe.** Every Status Log line a save writes ends with `[s:<submissionId>]`.
A case whose Status Log already holds this save's tag was written by an earlier try: 7F
skips it, sends no hand back email for it (step 6 sent it before the tag was written), and
counts it as saved. A retry after a lost answer
or a partial write therefore finishes the rest and answers 200. A retry is the only way the
same `submissionId` arrives twice.

## B. HSBS 7F Field partner (new site)

HTTP trigger, POST, schema from the contract above. No trigger concurrency: Power Automate refuses it on a Request trigger that has Response actions (import, 11/20). Overlapping runs are safe because every case write is etag-checked.

1. **Find the partner.** Get Partner Links items, filter `LinkKey eq '<key>' and Active eq 1`.
   Not exactly 1 row: 404. Key Expires before now: 410. `TestPartner` =
   `contains(Title, 'TEST')`.
2. **Switch on `action`.** Anything else: 400.
3. **`leads`:** Get Service Cases (Reading Service Cases) where Test equals `TestPartner`
   and the case is open. Filter array to its Services. For each, Get item on Referrals by the Referral
   lookup id: skip it when Introduced On is blank. Select the contract keys: `ref` from the
   Referrals Title, `practice` and `contact` from the Referrals row, `company` from Service,
   `status` from Partner Status, the rest from the case. `nextUpdateDue` uses the blank rule.
   Sort overdue first, then by due date. Answer 200.
4. **`save`, check loop:** refuse 422 `bad_value` with no `id` when `submissionId` is not a
   UUID. For each update, Get the case by `id`. When its Status Log contains
   `[s:<submissionId>]`, mark it done and skip the rest of the checks for it. Refuse 422
   `reload` when it is not one of this partner's open cases. Refuse 422 `bad_value` when: `choice` is not one
   of the six; `talkedToDoctor` is not one of the three choices on any choice but
   `nochange`; `meeting` has no `meetingDate` or one before today; `signed` has no
   `signedDate` or one after today; `lost` has a `closedReason` not in the six; `handback`
   has a blank `note`; `note` is over 300 characters or `signedProduct` over 100. When any
   case in the read already holds this save's tag, an earlier try wrote part of it: the two
   day rules (before today, after today) are skipped, so a resend after midnight finishes
   (Codex P1 on #14). The site leaves those two rules to the page and 7F for the same reason.
5. **`save`, write loop:** for each update not marked done: a `handback` sends its email
   first (step 6), then every update does Update item on Service Cases:

   | Column | Value |
   |---|---|
   | Partner Status | The choice's label (`STAND_WORDS`). `nochange` leaves it as it is |
   | Talked To Doctor | As sent, when sent |
   | Meeting Date | `meeting` only |
   | Signed Date, Signed Product | `signed` only |
   | Closed Reason | `lost` only |
   | Hand Back Note | `handback` only, the note |
   | Closed On | `signed`, `lost`, `handback`, when blank: today |
   | Last Touch, Last Partner Update | now |
   | Partner Updated By | Partner Links Title |
   | Missed Updates | 0 |
   | Next Update Due | `meeting`: 1 business day after the meeting date. `signed`, `lost`, `handback`, `dq_*`: cleared. `qualified`, `proposal`, and `nochange` on a qualified lead: the coming Friday (holiday Friday: next business day). Otherwise: today + `Window_days` business days (since 11/22/2026, cadence change) |
   | Status Log | Old text + new line `<today> <partner>: <label>. <note> [s:<submissionId>]` |

   Stage, Status and Pipeline Stage are not written.
6. **Hand back email:** for each `handback` not marked done, before its Update item, one
   email to Brian only, subject `Field lead handed back: <ref>`, body: partner, practice,
   note. If the email fails, the case is not written and 7F answers 5xx, so a retry sends it
   again. The tag is written only after the email went, so a tagged case never owes one. The
   one cost: if the email goes and the Update item then fails, the retry sends Brian a second
   copy. No other email. A save never mails the partner, the rep or anyone else.
7. **Answer** 200 `{"ok":true,"saved":<count>}`, the count of written plus done updates.

## C. HSBS 7G Field daily ask (new site)

Recurrence: weekdays, 8:00 AM, Eastern Standard Time (the `timeZone` setting, as the gap
check package does). First step: when today is on `Holidays`, Terminate (Succeeded).

**Page address.** Two Composes: `Prod_base` = `https://hsbs-hsd-field.vercel.app` and
`Preview_base` = the Vercel Preview address of the page PR's branch, which Brian pastes at
import (live step 4). A TEST row's email links to `Preview_base`, where the page is on during
testing; a real row's email links to `Prod_base`. So the TEST loop runs on the emailed link
without turning the page on in Production.

**TEST guard.** A Compose `Test_only`, `true` in the package. While it is `true`, every step
below reads only Service Cases with Test on and only Partner Links rows whose Title contains
`TEST`, so a run can neither mail a real partner nor change a real case. Brian sets it to
`false` at go-live (live step 8), the only edit the package needs.

0. **Set missing due dates.** Get Service Cases (Reading Service Cases). For each open case with Introduced
   On and a blank Next Update Due: write (Writing a case) Next Update Due = the later of today and `Created` +
   `Window_days` business days. From here on every open case has a stored due date. On
   go-live day every older case gets today, so it is listed today and first missed tomorrow
   (O7), and a case made yesterday keeps its own 2 business days.
1. **Count misses.** For each open case with Introduced On whose Next Update Due is before
   today, a write (Writing a case): Missed Updates + 1, Next Update Due = today + `Window_days` business days,
   or the coming Friday when the fresh copy is qualified (cadence change, 11/22/2026). A
   partner who never saves therefore gains one miss per missed window: the first business
   day after each due date, about every 2 business days, so 2 misses take about 4 business
   days (O4).
2. **Escalate.** The escalation key of a case is `[esc:<Last Partner Update as yyyy-MM-dd,
   or never>]`. Open cases with Missed Updates 2 or more whose Status Log does not contain
   their key: one email to Brian listing them (ref, practice, partner, misses). Test cases go
   in the same email marked `[TEST]`. Only after the email succeeds, each listed case gets a
   Status Log line `<today> escalated to Brian <key>`. If the email fails, no line is
   written, so the next run lists those cases again. A new partner save changes Last Partner
   Update and so the key, so the same case can escalate again after 2 more misses. Nothing to
   list: no email.
3. **For each Active Partner Links row:**
   - a. Its cases that are open and due, or not qualified with Missed Updates above 0. A
     qualified lead (cadence change, 11/22/2026) is listed only when it is due, so a missed
     Friday shows once on its next Friday, not on every daily ask. None: skip the row. No
     email.
   - b. Key: when Link Key is blank or Key Expires is less than 3 days away, write a new key
     (`substring(concat(replace(guid(),'-',''), replace(guid(),'-','')), 0, 40)`) and Key
     Expires = now + 14 days. Otherwise keep it, so yesterday's link still opens.
   - c. One email. To: Email. CC: CC Email. A TEST partner: To Brian only, no CC, subject
     starts `[TEST] `. Subject: `Field leads due for an update: <n>`. Body: one line on the
     rhythm ("Please update leads you have not reached yet within 2 business days, and
     qualified leads each Friday. One link covers all of them."), the link `<base>/update/<key>`, then a table, overdue
     first: ref, practice, introduced, last status, due date. Brian is not copied (O3).
4. Brian is copied on nothing else. No rep is emailed.

## D. HSBS 7H Field email reply capture (new site)

Trigger: Office 365 "When a new email arrives (V3)", Inbox, subject filter
`HSBS referral HSBS-`, so refs `HSBS-A<n>` (moved from the old site) and `HSBS-F<n>` both match. Runs on Brian's mailbox, the connection 3F already uses. It only
reads and writes SharePoint. It sends nothing.

1. Condition: the sender is not Brian, and the sender's address equals the Email or a
   CC Email of an Active Partner Links row. Otherwise Terminate (Succeeded).
2. Ref: the word right after `HSBS referral ` in the subject, cut at the first `:` or space. It must be
   `HSBS-A` or `HSBS-F` followed by digits only. Anything else: Terminate. The ref is checked
   before it goes into the OData filter, so a subject cannot change the filter.
3. Find the case: Service Cases whose Title starts with `<ref> |`, whose Service is in that
   partner's Services, and whose Test matches the row (TEST row: Test on; real row: Test
   off), as "Its cases" says. Not exactly 1, or not open: Terminate. So the TEST mailbox can
   never touch a real case.
4. Update the case: Last Partner Update = received time, Missed Updates 0, Next Update Due =
   today + `Window_days` business days (the coming Friday for a qualified lead), Partner Updated By = partner Title, Status Log new line
   `<today> <partner>: replied by email. [r:<received yyyyMMddHHmmss>]`. A fresh copy that already
   holds that tag is done, so a resubmitted run writes nothing twice. Partner Status is left as it is. The email body is
   not stored.

The reply resets the clock so the partner is not asked again for a lead they just answered.
Track shows "Updated <date>". The partner still picks a status on the page for Track to
show one.

## E. Field Notify Outbox and HSBS 7N Field notify retry (new site, FT-2a)

Built 11/21 to 11/22/2026 by Claude (fix thread FT-2). Field only. TEST only until Brian
gives written OK for real retries.

**Why.** A hand back email (7F) or a partner ask (7G) that fails to send was lost. The
Outbox holds each notification so one flow can retry it.

**List "Field Notify Outbox"** on `sites/HSBSField`. Columns: Title (shown as Notify Id,
indexed, unique), NotifyKind (Hand back, Partner ask), CaseId, PartnerRow, MailTo, MailCc,
MailSubject, MailBody, State (indexed, default Pending: Pending, Sending, Sent, Parked,
Expired, Cleared), Tries (default 0), NextTry (indexed), LastError, SentOn, Expires, Test
(default No), ClaimedOn. Partner Links gained a DateTime column LastAskSent.

**Flow "HSBS 7N Field notify retry (new site)".** Recurrence every 30 minutes, 7:00 AM to
9:30 PM ET, one run at a time. No HTTP trigger. Each run:

1. Resets a row stuck in Sending for more than 15 minutes to Pending.
2. Reads Pending rows that are due (NextTry blank or past) or past Expires, 50 per run.
3. An expired row goes to Expired with no send. Otherwise it claims the row (Sending, with
   IF-MATCH on its etag), sends the stored To, CC, Subject and Body unchanged, and marks it
   Sent. A Partner ask that sends stamps that row's LastAskSent.
4. A failed send adds a try and sets NextTry to now plus 30 minutes times tries. At 5 tries
   the row is Parked. A Cleared row never sends.
5. Brian gets one digest email listing each row parked or expired in the run, titled
   `Field notify retry: <n> parked or expired` (`[TEST] ` first while `Test_only` is true).

**TEST guard.** Compose `Test_only` is `true`. While it is, 7N reads only Test Yes rows. A
Test Yes row may mail only Brian (To is Brian, or a value with no `@` as the TEST fault
switch; CC blank or Brian). Any other address parks the row with no send, whatever
`Test_only` says.

**7F hand backs (FT-2b, live 11/22/2026).** A disqualify save (`dq_noanswer`,
`dq_notinterested`, or an old page's `handback`) now goes through the Outbox:

1. The hand back email moved out of the case write. A failed or skipped case write sends
   nothing. The note runs after the case is written (or is already done on a page retry).
2. Notify Id is `dq:<case id>:<submissionId>`. 7F looks it up by Title. If a row exists, in
   any State, 7F does nothing more: 7N owns retries.
3. No row: 7F creates it (Hand back, Pending, Tries 0, Test from the TEST partner row or the
   case). A 500 `SPDuplicateValuesFoundException` from a racing resend counts as exists. Then
   it claims the row (Sending, IF-MATCH on its etag) and sends once. Sent: Sent, SentOn,
   Tries 1. Failed: Pending, Tries 1, LastError (250 characters), NextTry now plus 30
   minutes. A 412 or other failed claim sends nothing; 7N picks the row up.
4. A failed send never fails the save. A failed Outbox lookup, referral read or create (other
   than the duplicate) answers 503 `write_failed`; the page resends the same `submissionId`,
   finds the case done, and makes the row then.
5. To is always Brian. Only a TEST row whose Partner Links PartnerEmail has no `@` uses that
   value, as the TEST fault switch. Subject and body are unchanged (`[TEST] ` on TEST rows).

Built by `partner-updates/build/patch_7f_outbox.py` on the live 7F export, checked with
`lint_flow.py` (0 problems) and `test_7f_outbox.py` (51/51) before import.

**Still to build.** FT-2c: 7G writes one Outbox row per partner ask (only after Monday
11/23's 8 AM ET run is read back).

**Live change record (ET).**

- 11/21, before the proof runs: list and LastAskSent column added; 7N v1, then v2, imported.
- 11/21 11:45 and 11:46 PM: 7N v2 runs Succeeded on TEST rows 1 to 12. Proved: one send then
  Sent with no resend; a fault backs off and the retry sends once fixed; 5 tries parks; a
  Cleared row never sends; an expired row goes to Expired; a Partner ask stamps LastAskSent;
  a stuck claim resets; a TEST row to anyone but Brian parks; a Test No row is untouched.
- v2 never sent the digest: `if()` evaluates both branches, so `formatNumber(null)` failed and
  the closing compose hid it. v3 wraps nullable values in `coalesce`.
- 11/22 12:20 AM: v3 imported (Update) and turned On. TEST run 12:23 AM: row L parked at 5
  tries and row M expired, but the run Failed and sent no digest. `empty()` on a Number column
  (CaseId, PartnerRow) throws in Logic Apps, so the digest line was never added.
- 11/22 12:30 AM: v4 imported and turned On. It tests those columns with `equals(x, null)`. The
  model (`sim.py`) now fails on `empty()` of a number, so this cannot slip through again.
- 11/22 12:31 AM: TEST run Succeeded. Rows L2 (Parked, 5 tries) and M2 (Expired); exactly one
  email to Brian, `[TEST] Field notify retry: 2 parked or expired`. Test No row G untouched.
- 11/22 8:30 AM (FT-2b): exported live 7F. Its triggers and actions match the PR 20 build, so
  that package is saved as the rollback `partner-updates/ft2/rollback/HSBS-7F-before-outbox.zip`.
- 11/22 8:43 AM: patched 7F imported (Update) onto HSBS 7F Field partner (new site), same
  connections. 8:44 AM: turned On. The production page's saves still reach 7F, so the trigger
  URL in Vercel is unchanged.
- 11/22 8:46 AM, E1: TEST Partner Links row 1 PartnerEmail set to a value with no `@`. A TEST
  `dq_noanswer` save on Case 59 (HSBS-F80) answered 200 `{"ok":true}`. Outbox row 17 Pending,
  Tries 1, LastError set, NextTry plus 30 minutes. No email.
- 11/22 8:47 AM, E2: the same save again (same `submissionId`) answered 200. Still one row,
  one Status Log line, Tries 1.
- 11/22 8:48 AM, E3: PartnerEmail and row 17 MailTo set back to Brian, NextTry made due, 7N
  run by hand. Exactly one email, `[TEST] Field lead disqualified: HSBS-F80`. Row 17 Sent.
- 11/22 8:49 AM: clean TEST `dq_noanswer` save on Case 52 (HSBS-F76) with the fault off. 7F
  sent one email right away. Row 18 Sent, Tries 1.
- 11/22 8:59 AM, E4: the next scheduled 7N run Succeeded and sent nothing. Rows 17 and 18 stayed
  Sent (Tries 2 and 1). TEST Partner Links row 1 PartnerEmail ends as Brian.
- E5 (5 tries parks, Cleared never sends) was proven on 7N in FT-2a and is unchanged.

**Undo.** 7N: turn it Off. Earlier definitions are in the project files under
`partner-updates/ft2/rollback/` (v1, v2 and v3 as imported). 7F: re-import
`partner-updates/ft2/rollback/HSBS-7F-before-outbox.zip` as Update onto HSBS 7F Field partner
(new site), turn it On (imports arrive Off), then do one TEST save to confirm the trigger URL.
That brings back the old direct hand back email.

## F. 7F speed at 50 leads (FT-5, 11/22/2026)

**Why.** T4c (`proof-runs/HANDOFF_T4c.md`) found 7F too slow at partner scale. A 50-lead
`trying` save answered the site 504 at 55.7 s (7F took about 6 minutes; every loop ran one
lead at a time), and the leads read answered 503 at 20 s with about 55 open leads. The site
waits 55 s for a save. Monday 11/23 8 AM ET is the first real partner ask.

**What changed in 7F (no site change, no answer change).**

1. Leads: one Referrals read for all open leads (ID range) instead of one per lead.
   `Each_lead` runs 50 at a time with a Query. Every lead appends one item (a skip marker when
   it has no intro), and the answer is 503 unless the item count equals the open lead count.
2. Save, check: one Referrals read for the posted cases. `Check_each` runs 50 at a time with a
   Query. The unused variables (tries, writeState, doneIds, savedCount) are gone, so no loop
   sets a per-lead variable.
3. Save, write: `Write_each` runs 50 at a time (saves cap at 50, so one wave). The 412 retry
   Until reads its own `Try_state` Compose. After the loop 7F reads the posted cases again and
   answers 200 `{"ok":true,"saved":n}` only when no posted case that is still open and ours
   lacks the tag; n is the posted cases that carry the tag. Otherwise 503 `write_failed`.
4. Save, fewer steps per lead (part 4). Power Automate pays for every action in a loop, run or
   skipped. Part 3 still had about 40 per lead, most of them skipped, so a resend that wrote
   nothing took 24 s inside the loop. Now:
   - `Work` (a Query) sends only posted leads whose case lacks this save's tag into the loop,
     so a resend runs no write iterations.
   - The merge body is built for all leads before the loop by Selects (one action each, not
     one per lead): `W_base`, `W_due` (next business day after the meeting date, the same 15
     days as before), `P_all` (the old `M_all` without Status Log, plus the log line), then
     `P_status` to `P_qual` (the same field drops as `M_status` to `M_qual`).
   - In the loop: Get_fresh, Fresh_state, Should_write, Merge, Try_state (inside the 412
     Until) and Write_result. Merge adds the Status Log from the fresh read and drops Closed
     On unless the case closes now and has none, the same as the old `M_body`.
   - The hand back note moved to its own loop, `HB_each` (50 at a time), after `Write_each`,
     over the hand back and disqualify leads only. It reads the case fresh and queues the
     Outbox row only when this save's tag is on the case, as before.

Unchanged: the tag `[s:<submissionId>]`, the 422 rules, the merge fields and IF-MATCH, pay
fields, the Outbox Notify Id, and every answer's shape. Built by the patch scripts in the
project files (`partner-updates/speed/`, part 4 in `speed/part4/patch_7f_p4.mjs`), each run on
the live 7F export and checked by the offline model test (old 7F against new, loops forward
and reversed, faults injected): 53 of 53 pass for part 4.

**Live change record (ET), all on TEST rows and the TEST partner row.**

| When | What | Result |
|---|---|---|
| 11/22 12:21 PM | Parts 1 and 2 imported (Update) and On | Leads, 55 open: 200 in 10.7 to 12.0 s (was 503 at 20 s). Save 50 `trying`: 504 at 55.4 s, all 50 written right; resend 200 in 34.1 s |
| 11/22 12:41 PM | Part 3: `Write_each` 20 to 50 at a time | Save 50: 200 in 54.0 s (1 s margin). Resend 200 in 34.0 s |
| 11/22 12:58 PM | Part 4: steps per lead cut, done leads skipped, hand back in its own loop. Live export matched the part 3 build before the change | Leads, 5 open: 200 in 8.2 s. Save 50 `trying` (cases 218 to 267): **200 saved 50 in 25.0 s**. Resend same body: 200 saved 50 in 14.8 s, no case modified after the first save |

Part 4 read back: 50 of 50 cases carry one tag from one `submissionId`, Partner Status "Trying
to reach", Qualified and Closed On blank. Field Notify Outbox, SPIFF Ledger, Ledger Run Errors
and Sign Log gained no rows. Cases 64 and 65 untouched. All 50 TEST cases and 50 TEST
referrals went to the recycle bin after each part.

**Undo.** Import the saved package as Update onto HSBS 7F Field partner (new site), turn it On
(imports arrive Off), then one TEST leads read. Part 4 only:
`partner-updates/speed/rollback/HSBS-7F-before-part4.zip`. Part 3 only:
`speed/rollback/HSBS-7F-before-part3.zip`. All of FT-5: `speed/rollback/HSBS-7F-before-speed.zip`.

**Next 7F change.** The Friday cadence patch (PR 43) must be rebuilt on a fresh export of
this 7F, not on an older package.

## What the site, 1F and 3F keep

- 3F HealthFirst and 3F Staffing: no change. The site: no change (fact 1).
- **E. 1F (new site), one change.** In `Select_cases_rep` and `Select_cases_team`, the
  `updated` value becomes `@coalesce(item()?['Last_x0020_Partner_x0020_Update'], '')` in place
  of `@item()?['Modified']`. Only a partner save (7F) or a partner reply (7H) stamps Last
  Partner Update, so 7G's miss count and due-date writes never read on Track as an update. A
  case with no partner update sends `""`; the site then falls back to `lastTouch` (also only
  stamped by 7F) and then to the referral's sent date, so "No update in N days" counts from
  the send, as today. The build PR records this in `docs/field-flow-contract.md`, `list`.
  Rollback: paste `@item()?['Modified']` back.
- The 7-day "No update in N days" line on Track stays (O5).
- Later, not in this build: 1F sends the case's last Status Log line as `detail`, so Track
  shows the partner's note. That is a 1F and contract change of its own; it must drop the
  `[s:...]` and `[esc:...]` tags before sending the line.

## Brian's live steps, in order

Each one is a paste-ready block or a package from the build thread, with a direct link.

1. Partner Links on `sites/HSBSField`: add 3 rows, Link Key blank.
   `TEST field partner` (Active on, Email: Brian, CC Email: a second mailbox Brian controls
   that is not his work address, used only as the TEST reply sender for PU-9; Services:
   HealthFirst and the staffing service). 7G mails a TEST row To Brian only with no CC, so
   the CC Email never gets mail; `HealthFirst` (Active **off**, Email and CC as the 3F HealthFirst intro sends
   today, Services: HealthFirst); `Direct Dental` (Active **off**, Email as the Routing row,
   Services: the staffing service). The real rows stay off until step 8, so no TEST run, page
   or reply capture can reach a real partner.
2. Import 7F. Turn it On. Copy its trigger URL into Vercel `PARTNER_FLOW_URL` (Preview first).
3. Approve and merge the page PR. Set `PARTNER_PAGE_ENABLED=true` on Preview.
4. Import 7G with `Test_only` `true`, and paste the page PR's Preview address into
   `Preview_base` (the package already holds the Preview address used for part A). Turn it On:
   with `Test_only` `true` its 8:00 AM runs touch only Test cases and mail only Brian. Run it by
   hand (Run) for the TEST checks.
5. Import 7H and turn it On.
6. Paste piece E into 1F (new site), both Select boxes, and save with 0 errors. 1F stays On;
   the change is safe for the live Track.
7. Run every check below on Preview with TEST rows.
8. Only after all pass: `PARTNER_PAGE_ENABLED=true` and `PARTNER_FLOW_URL` on Production; turn
   the HealthFirst and Direct Dental rows Active on; set 7G's `Test_only` to `false`; turn 7G
   On. Its first 8:00 AM run sends each real partner one full list (O7).
9. Send the two-line partner note (Claude drafts, Brian sends) the same day.

Imports arrive Off: turn each On when its step says so.

## TEST checks (TEST rows only; each pass or fail)

Use the TEST rep and the TEST field partner. Mail may go only to Brian.

- **PU-1 (T1, the loop).** A TEST send makes a TEST case. A manual 7G run emails Brian
  `[TEST] Field leads due for an update` with that lead once it is due (or after setting its
  Next Update Due to today). The emailed link points at the Preview address and opens the page and lists the lead. Save Meeting set
  with tomorrow's date: Partner Status `Meeting set`, Meeting Date, Last Partner Update and
  Next Update Due (1 business day after the meeting) are on the case, and the TEST rep's
  Track shows "Meeting set" and "Updated <today>".
- **PU-2 (T2 a, the window).** Cases saved No change on these dates get these due dates:
  Mon 11/30 to Wed 12/2; Fri 12/4 to Tue 12/8; Wed 11/25 to Tue 12/1. Check with the
  business-day steps run by hand on each date.
- **PU-3 (T2 b, c).** A manual 7G run lists only due or overdue TEST leads, overdue first. A
  TEST partner with nothing due gets no email.
- **PU-4 (T2 d).** The link from the previous run still opens the page.
- **PU-5 (T2 f).** A TEST case with Next Update Due yesterday: the run lists it first, with
  Missed Updates 1 and a new due date 2 business days out. Unsaved, it is listed again on the
  next business day.
- **PU-6 (escalation).** A TEST case taken to 2 misses gets exactly one email to Brian.
- **PU-7 (closes).** Not moving forward with `Price`: Closed Reason `Price`, Closed On today,
  Next Update Due blank, the lead leaves the page. Signed with a date: Signed Date, Closed On.
  Hand back with `TEST note one`: Hand Back Note, one email to Brian only.
- **PU-8 (refusals).** A changed key: "This link does not work." An expired key: the
  expired words. A case closed in another tab: "Reload the page", nothing written.
- **PU-9 (reply capture).** Brian forwards a `[TEST] HSBS referral HSBS-F<n>` intro to the
  TEST row's CC Email mailbox and replies from there to his work address, keeping the
  subject. 7H stamps Last Partner Update and the Status Log line on that TEST case and
  changes no Partner Status. A reply from Brian's own address, or from any address not on an
  Active row, changes nothing. A reply from the TEST mailbox to a real (Test off) intro
  changes nothing on that case.
- **PU-10 (no other mail).** No run in PU-1 to PU-17 mailed anyone but Brian, and no real
  case's Missed Updates, Next Update Due or Status Log changed.
- **PU-14 (Track date).** After a manual 7G run that adds a miss to a TEST case, the TEST
  rep's Track shows no new "Updated" date for it. After a 7F save on it, Track shows "Updated
  <today>".
- **PU-11 (retry).** Post the same TEST save twice with one `submissionId` (a Hand back and a
  Meeting set): both answer 200 `saved` 2, each case has one Status Log line with the tag,
  and Brian gets one hand back email, not two.
- **PU-12 (unanswered lead).** A TEST case with a blank Next Update Due and `Created` 3
  business days ago. Run 1 stores today as its due date and lists it, Missed Updates 0. With
  no save, run 2 on the next business day gives Missed Updates 1 and a due date 2 business
  days out. Run 3 on the first business day after that due date gives Missed Updates 2 and
  one escalation email. A run between those two dates adds no miss. To test in one sitting,
  set the case's Next Update Due to yesterday before runs 2 and 3.
- **PU-15 (escalation resumes).** After PU-6, delete the `escalated to Brian` line from
  that TEST case's Status Log (as if the email had failed). The next manual run emails Brian
  about it once and writes the line again. The run after that does not email about it.
- **PU-16 (reads).** In 7F, 7G and 7H every Get items on Service Cases has an OData filter
  and Pagination on at 5000, and no Top Count. Checked in each action's settings.
- **PU-17 (overlapping writes).** A flow run cannot be paused between its etag read and its
  MERGE, so this check has two halves (part B, 11/20). Server: on a TEST case, read the item
  and keep its etag, hand edit its Status Log, then send a MERGE with the old etag. SharePoint
  answers 412 and the hand edit stays (Claude in Brian's Chrome with his go-ahead, TEST case
  only). Flows: in 7F, 7G (C0, C1, escalation line) and 7H, every Service Case write is a
  `Write_until` loop whose GET runs on every try, whose re-check reads only that fresh copy,
  and whose MERGE sends that copy's etag in `IF-MATCH`; a 412 retries, anything else fails
  the run. Checked in each package. Together these show a 7G C1 write that loses to a 7F
  save re-reads, sees the new due date and skips.
- **PU-13 (TEST guard).** With `Test_only` `true` and the real rows off, a manual 7G run
  touches only Test cases and mails only Brian.

## Rollback

- Page: set `PARTNER_PAGE_ENABLED` off. The page and APIs answer 404. Nothing else reads it.
- 7G: turn Off. No more asks. Cases keep their due dates; nothing else reads them.
- 7F: turn Off. The page shows "not available". 7H: turn Off.
- 1F: paste `@item()?['Modified']` back into both Select boxes (piece E).
- No other existing flow, and no list column or row, is changed by this build except Partner
  Links rows and the Service Case columns listed in B5, C0, C1 and D4.

## Estimate for the build thread

13M to 22M tokens, about 3 to 4 hours of clock time. Brian: about 30 clicks (3 rows,
3 imports, 2 env vars on 2 environments, one merge, the TEST checks on the page, since
`vercel.app` pages are filled by Brian). Split if it passes 20M: page PR first, flows second.

## Decided

- Q1, Brian, 11/20: a partner's email reply to an intro counts as an update (piece D). It reads Brian's inbox and sends nothing.

## Cadence change: Friday for qualified leads, 4 tries close (11/22/2026)

Brian, 11/22/2026 12:17 PM ET: each partner updates its own leads. A lead in qualification is
asked every 2 business days. Not reached yet stays on that cycle. A qualified lead moves to
the Friday update and is not asked every 2 business days until it closes won or lost. Four
Not reached yet updates close the lead right away. "4 times" is read as 4 partner saves that
say Not reached yet (about 8 business days), matching the page's "Attempts 1 to 3 so far".

- "Qualified" in the flows: Qualified Yes, or Partner Status Reached, Meeting set, Meeting
  held, or Proposal or agreement sent.
- "The coming Friday": the first Friday after today (a Friday save goes to next Friday), or
  the next business day when that Friday is on `Holidays` (11/27, 12/25, 1/1 this season).
- 7F save: Next Update Due as in the B table above. A `trying` save on an unqualified lead
  with 3 earlier ": Trying to reach." lines is stored as `dq_noanswer` (the contract, HSBS 7F).
- 7G: count misses as in C step 1; an overdue qualified lead is listed only when due; the
  rhythm line names both cycles. 7H: as in D step 4.
- Demo set keeps 1 business day after the demo, so the first update after a demo is the day
  after it, then Fridays.
- "Qualified Yes" is read from the Qualified choice column. 7F and 7G read cases with the
  SharePoint connector, which gives a choice as `{"Value": ...}`, so they read
  `Qualified?['Value']`; 7H reads the case by REST, which gives plain text.
- Build files: `/mnt/project-files/partner-updates/cadence/`. 7F: `p4/patch_cadence_inpage.js`
  (the same code runs in node through `p4/build_cadence.mjs` and in the export page), rebuilt
  on the FT-5 part 4 shape: the per-lead work is three Selects before the write loop, none in
  it (`C_qual`, `C_close`, `Eff_updates`), and every later step reads `Eff_updates` instead
  of the posted updates, so the auto close reaches the hand back loop on the server whatever
  the page offers. Model tests `p4/test_7f_cadence_p4.py` and the FT-5 part 4 suite. 7G and
  7H: `gen_7g_7h.py`, model test `test_7g_7h_cadence.py`.
- Next 7F change after this one: Matt's Group office-count check before the $200 (memory
  GROUP CHECK). Build it on the export taken after this import (7F hash 86b2c0fa67a77dc7).

### Live change record (Sun 11/22/2026, ET)

| Time | What |
|---|---|
| 1:12 PM | Exported live 7F: canonical hash e520b115c1295412 (FT-5 part 4), matches the part 4 build. Rollback `cadence/rollback/HSBS-7F-before-cadence.zip` (that definition). |
| 1:13 PM | Patched in the export page with `p4/patch_cadence_inpage.js`: 86b2c0fa67a77dc7, the same hash as the model-tested node build. Model tests: cadence 38 of 38; FT-5 part 4 suite old vs new differs only in the intended qualified due date (11/25 to 11/30) and the meaningless "reads cut" line. |
| 1:16 PM | Imported as Update onto HSBS 7F Field partner (new site), top SharePoint and top Outlook connections. 1:19 PM turned On. Flow checker 0 errors, 0 warnings. |
| 1:20 PM | TEST proof on 4 TEST cases (270 to 273, TEST field partner key, prod `/api/partner-save`), one save: 200 saved 4 in 16 s. Case 270 (3 earlier tries, unqualified) `trying`: Not moving forward, Qualified No, Closed Reason Not qualified, due cleared, line "Disqualified, no answer after 4 attempts. Closed on the 4th Not reached yet update."; Outbox row `dq:270:<sid>` Sent, To Brian only, subject `[TEST] Field lead disqualified: ...`. Case 271 `qualified`: Reached, due Mon 11/30 (Friday 11/27 is a holiday, rolled). Case 272 `trying`: due Tue 11/24 (2 business days). Case 273 (Qualified Yes, status Trying to reach, 3 earlier tries) `trying`: stays open, due 11/24, so the Qualified choice read works live. |
| 1:21 PM | Resend of the same save: 200 saved 4, no case modified, Outbox unchanged. A `nochange` save on 271 (qualified): due 11/30; on 272: due 11/24. |
| 1:23 PM | Ledger: the qualified TEST saves wrote only TEST rows (SPIFF Ledger 37, 38, 39, all Test Yes: 273 and 271 Waiting $100, 270 Void "not qualified"). Ledger Run Errors and Sign Log unchanged. Recycled the 3 TEST ledger rows, 4 TEST cases and 4 TEST referrals; remaining 0. Cases 64 and 65 untouched. |
| 1:30 PM | Exported live 7H: same as the old generator output except Power Automate's own `@string('')` to `""` rewrite. Rollback `cadence/rollback/HSBS-7H-before-cadence.zip`. |
| 1:33 PM | 7H patched in page to the new generator's actions (hash 59ec6b268769c4a1 = new build with that same rewrite), imported as Update, top connections. 1:35 PM turned On. Flow checker 0 errors, 0 warnings. Live 7H proof waits for a real or TEST partner reply; the model test covers it (Reached and Meeting set to 11/30, Trying to reach to 11/25). |

7G is not changed yet. It imports after the Monday 11/23 8 AM ET run is read back, never
between 7:45 and 8:30 AM ET, and never runs by hand. The 7G generator now reads
`Qualified?['Value']` from the connector (fixed 11/22 1:28 PM ET; tests 13 of 13).

Undo: 7F, import `rollback/HSBS-7F-before-cadence.zip` as Update onto 7F, turn On, read TEST
leads. 7H, import `rollback/HSBS-7H-before-cadence.zip` as Update onto 7H, turn On. Site:
revert the hint line in `src/lib/partner-status-words.mjs`.


## Office count check for Direct Dental Group leads (11/22/2026)

Brian, 11/22 12:10 PM ET: before a Direct Dental Group lead pays the rep $200, the partner
confirms the office count. Matt Penny (Direct Dental) owns that confirm. Groups are rare.
Thread "Add Matt's office count check". Times ET.

Design (the smallest safe change):

- 7F `leads`: each lead gains `askOffices`, true only for a Direct Dental lead whose Referrals
  row says `RepPracticeType` `Group` and that is not qualified yet.
- Partner page (behind `PARTNER_OFFICE_CHECK`): on such a lead, picking Reached the customer,
  Demo set, Proposal or Signed shows "The rep marked this practice as a group. Does it have 3
  or more locations?" Yes or No. The page will not save without an answer.
- 7F `save`: `offices` `yes`, `no` or blank (else 422). On the save that first qualifies a
  Direct Dental Group lead, 7F writes Service Cases `OfficeCountConfirmed` `Yes` or `No` in
  the same MERGE as Qualified Yes. Ignored on any other lead or save.
- HSBS 10: `Multi_office` also needs `OfficeCountConfirmed` `Yes`. No, or no answer, pays $100.
- Why no answer pays $100 and not a "Pending extra $100": HSBS 10 writes the qualified award
  once and never changes its amount (D3). A pending extra needs a new ledger row type and a
  1F Earnings change. $100 never overpays, and groups are rare, so a later fix by hand is
  cheap. The amount still comes only from trusted fields: the rep's pick on the Referrals row
  (1F) and the case column (7F), never a browser body.

Files (project files `partner-updates/offices/`): `patch_offices_inpage.js` (node:
`build_offices.mjs <live def> <out def>`), `test_7f_offices.py` 32/32 (live 86b2c0fa vs
patched). The cadence suite and the FT-5 suite on the patched def differ only by the new
`askOffices` field (and FT-5's known "reads cut" check). Lint: only the known Write_until note.
HSBS 10: `pay-ledger/build/gen_10.py` (Get_case, Multi_office), `test_10.py` 86/86 (new
office count cases fail on the old def), `test_10d.py` 49/49, lint 0. Generator diff vs the
live package: only Get_case and Multi_office.

### Live change record (Sun 11/22/2026, ET)

- About 2:15 PM: Service Cases column `OfficeCountConfirmed` (Text, 10) added on the field site.
- 2:19 PM: live 7F exported in Browser 1 (378c6cd4), hash 86b2c0fa67a77dc7 (the cadence
  build). Undo package `partner-updates/offices/rollback/HSBS-7F-before-offices.zip`.
- 2:21 PM: patched in page, hash 68e75b34c51600dc (same as the tested build), imported as
  Update onto HSBS 7F Field partner (new site), top SharePoint and Outlook connections. On
  2:22 PM. Flow checker 0 errors, 0 warnings. TEST partner page read 200 on production.
- 2:24 PM: live HSBS 10 Ledger writer exported, canonical hash (metadata left out) 8f0b4c47ed13649d,
  the same as `pay-ledger/rollback/offices-before/HSBS-10-Ledger-writer-NEW-SITE.zip` (the
  multi-office package), which is the undo. Patched in page (Get_case selects
  `OfficeCountConfirmed`; Multi_office needs it `Yes`), hash 6e8a1c4c20343cad, the same as the
  tested generator output. Imported as Update 2:26 PM, On 2:27 PM, flow checker 0 and 0.
- 2:28 PM: Vercel `PARTNER_OFFICE_CHECK=true` (production and preview). Production code
  reads it only after this PR merges.
- TEST proof, PASS (2:29 to 2:31 PM): two TEST Direct Dental sends from Test Fieldsite through
  production `/api/referral`, both `Group` (F697, F698; 3F sent each `[TEST]` intro to Brian
  only). On the TEST partner page (PR 49 preview, switch on), both leads came back with
  `askOffices` true and no other lead did. Picking Reached the customer showed the question;
  Save with no answer said "Lead HSBS-F697: check Office count." and posted nothing. F697 Yes
  and F698 No saved ("Saved 2 updates."); after the reload neither asks again. Cases 280 and
  281: Qualified Yes, Reached, `OfficeCountConfirmed` Yes and No. SPIFF Ledger 47
  `280|Reached|Rep` $200 and 48 `281|Reached|Rep` $100, both Waiting, Staffing, Direct
  Dental, Test Yes. No new Ledger Run Errors.
- 2:32 PM: recycled ledger 47 and 48, cases 280 and 281, referrals 697 and 698 (site recycle
  bin).
- Undo 7F: import `rollback/HSBS-7F-before-offices.zip` as Update, turn On. The column can stay.
- Undo HSBS 10: import `pay-ledger/rollback/offices-before/HSBS-10-Ledger-writer-NEW-SITE.zip`
  as Update, turn On. Quick undo of the question alone: `PARTNER_OFFICE_CHECK` off (then no
  Group lead earns $200 until it is back on, or HSBS 10 is rolled back).
