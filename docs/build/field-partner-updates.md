# Field partner updates on the new site (sheet PU)

Written 11/20/2026 by Claude from a read-only trace of `sites/HSBSField`, the "(new site)"
flow packages and this repo. Field only. This sheet replaces pieces 1 and 2 of
`docs/plans/partner-update-window.md` and keeps that plan's decided rules (O1 to O8,
"How it works", T1 and T2). Where the two differ, this sheet wins.

This repo never edits a flow, list or Vercel setting. Brian makes every live change. The
build thread writes the code PR and the flow packages; Brian imports, turns on and fills in.

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
the open and Test test on the server (`Test eq 1` or `Test eq 0`, and Partner Status not
one of the closed values), Pagination on in the action's settings, threshold 5000. No step
uses a fixed top count, so closed cases never crowd out open ones. If a read returns 5000
rows, the flow emails Brian `Field cases over 5000: raise the threshold` and stops before
writing. Today there are 17 cases.

### Writing a case (all three flows)

7F, 7G and 7H all write Service Cases, and their runs can overlap, so no write may rest on
a stale read. Every Service Case write that appends to Status Log or depends on a tag in it
is a "Send an HTTP request to SharePoint" pair:

1. GET the item right before the write, reading its `odata.etag` and current Status Log.
2. Re-check the step's condition on that fresh copy (the `[s:...]` or `[esc:...]` tag, open,
   Test), then MERGE the new values with header `IF-MATCH: <etag>`, Status Log built from the
   fresh copy.
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
- **What the partner answers per lead** (all optional per lead; only touched leads are sent):
  1. "Have you talked to the doctor?" `Yes`, `Not yet, still trying`, `Not yet, haven't tried`.
     Required on every choice except No change.
  2. "Where does it stand?" the six `STAND_CHOICES`.
  3. Meeting set: meeting date, required, today or later. Signed: signed date, required, not
     in the future; product, optional, up to 100 characters. Not moving forward: reason,
     required, one of `No response`, `Chose another provider`, `Price`, `Timing`,
     `Not a fit`, `Other`. Hand back to HSBS: note, required.
  4. Note: optional, up to 300 characters, one line.
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

HTTP trigger, POST, schema from the contract above. Trigger concurrency on, limit 1.

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
   has a blank `note`; `note` is over 300 characters or `signedProduct` over 100.
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
   | Next Update Due | `meeting`: 1 business day after the meeting date. `signed`, `lost`, `handback`: cleared. Otherwise: today + `Window_days` business days |
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
   On and a blank Next Update Due: write Next Update Due = the later of today and `Created` +
   `Window_days` business days. From here on every open case has a stored due date. On
   go-live day every older case gets today, so it is listed today and first missed tomorrow
   (O7), and a case made yesterday keeps its own 2 business days.
1. **Count misses.** For each open case with Introduced On whose Next Update Due is before
   today: Missed Updates + 1, Next Update Due = today + `Window_days` business days. A
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
   - a. Its cases that are open and due, or have Missed Updates above 0. None: skip the
     row. No email.
   - b. Key: when Link Key is blank or Key Expires is less than 3 days away, write a new key
     (`substring(concat(replace(guid(),'-',''), replace(guid(),'-','')), 0, 40)`) and Key
     Expires = now + 14 days. Otherwise keep it, so yesterday's link still opens.
   - c. One email. To: Email. CC: CC Email. A TEST partner: To Brian only, no CC, subject
     starts `[TEST] `. Subject: `Field leads due for an update: <n>`. Body: one line on the
     rhythm ("Please update each lead within 2 business days. One link covers all of
     them."), the link `<base>/update/<key>`, then a table, overdue
     first: ref, practice, introduced, last status, due date. Brian is not copied (O3).
4. Brian is copied on nothing else. No rep is emailed.

## D. HSBS 7H Field email reply capture (new site)

Trigger: Office 365 "When a new email arrives (V3)", Inbox, subject filter
`HSBS referral HSBS-F`. Runs on Brian's mailbox, the connection 3F already uses. It only
reads and writes SharePoint. It sends nothing.

1. Condition: the sender is not Brian, and the sender's address equals the Email or a
   CC Email of an Active Partner Links row. Otherwise Terminate (Succeeded).
2. Ref: the first `HSBS-F` followed by digits in the subject. None: Terminate.
3. Find the case: Service Cases whose Title starts with `<ref> |`, whose Service is in that
   partner's Services, and whose Test matches the row (TEST row: Test on; real row: Test
   off), as "Its cases" says. Not exactly 1, or not open: Terminate. So the TEST mailbox can
   never touch a real case.
4. Update the case: Last Partner Update = received time, Missed Updates 0, Next Update Due =
   today + `Window_days` business days, Partner Updated By = partner Title, Status Log new line
   `<today> <partner>: replied by email.` Partner Status is left as it is. The email body is
   not stored.

The reply resets the clock so the partner is not asked again for a lead they just answered.
Track shows "Updated <date>". The partner still picks a status on the page for Track to
show one.

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
   `Preview_base`. Leave it Off; run it by hand for the TEST checks.
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
- **PU-17 (overlapping writes).** On a TEST case, run the 7F write with an etag read before a
  hand edit to its Status Log (the build thread gives a TEST-only manual trigger for this).
  The MERGE gets 412, re-reads, and the case ends with both the hand edit and the save's
  tagged line.
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
