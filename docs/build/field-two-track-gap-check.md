# Field two-track app: sheet GC, the field gap check

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and the other team's exact list and column names are only in the old repo's copy.

Builder: the bot Claude assigns on the desk (BB2, BB4 or BB5). Decision 132 (Brian, 11/15): "yes, spec the gap check".

## Why

The 3F Field copy sends the partner intro for a field lead. It can miss a lead: a lead that
arrives right around an import is never seen (runbook step 4), the copy can be Off, and a
lead can be parked after three failed tries with its one alert email lost (sheet 3F-F, check
12 on 11/15). In each case the lead sits on Referrals with no intro and nobody is told.

The gap check is the backstop. Every hour in the working day it looks for field leads that
still have no intro an hour after they arrived, and emails Brian the list. It fixes nothing
itself.

## What it is

- **A new flow, "HSBS Field gap check".** A scheduled cloud flow with a Recurrence trigger. It
  is not a copy of, and does not touch, "HSBS Daily gap check (TEST)" (BB1's, `FSC app` rows,
  6:00 PM).
- **It only reads and emails.** One Get items on Referrals and at most one email. It writes
  to no list, ever. A write to Referrals would start the 3F copy and, until Part S, HSBS 2,
  2B and 3.
- **One recipient.** The email goes to the Brian address the 3F copy's "intro not sent" alert
  already uses (sheet 3F-F, build step 6). No CC, no BCC, no other recipient. The address is
  never written in a file, a report or the desk.

## A lead is listed when all of these are true

1. Source is `Rep app`.
2. Route is `Direct to partner`.
3. Introduced On is blank.
4. It was created more than 60 minutes before the run. The copy's three tries take about 15
   minutes and pickup can take 5 (sheet 3F-F; runbook step 4), so 60 leaves room.
5. It was created at or after the **start time**: one fixed moment held in the flow, set to
   the minute BB2 first saves it. Rows from the build that were made before that moment are
   never listed.

Not part of the rule, on purpose:

- **Intro Tries.** A lead parked at 3 tries is listed like any other. That is the case the
  check exists for.
- **Test.** TEST rows and real rows are both listed, so nothing has to be changed at go-live.
  A flow that had to be switched from TEST to real could be left on TEST and watch no real
  lead (the same trap as runbook step 4).

The list repeats every run until the lead has an intro or the row is deleted. The flow keeps
no memory of what it already reported, because that would need a write.

## The email

- Sent only when at least one lead is listed. No leads, no email.
- Subject: `Field leads with no intro: <count>`. When every listed lead has Test = Yes, the
  subject starts `[TEST] `.
- Body, one line per lead, newest first: the referral ID, the practice name, the rep's name,
  when it was created (Eastern time), Intro Tries (`blank` when empty), and `TEST` when Test
  = Yes. No doctor phone, email or note.
- Then two fixed lines:
  - `Intro Tries 3: the copy stopped trying. Fix the cause, then set Intro Tries to 0.`
  - `Anything else: check the 3F Field copy is On, then edit the lead's Note once.`
- When the read returned as many rows as its Top Count, a last line:
  `The list may be cut short. Tell Claude.`

## Build

Each step names its row in `docs/claude-code/MS-LEARN-REFERENCES.md`. Check the row before
building the step. Read every internal name from the list or from a run's output, not from
this sheet. Record every saved expression in the report, as text.

1. **New scheduled cloud flow**, name "HSBS Field gap check" (the "Scheduled flow" row).
   - Frequency Day, Interval 1.
   - Time zone: Eastern Time (US and Canada).
   - At these hours: 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21. That is 15
     runs a day, the last at 9:00 PM.
   - At these minutes: 0.
   - Saving the flow or turning it On can start one run at once. That is expected. Read it
     like any other run.
2. **Get items on Referrals** (the "SharePoint Get items" row).
   - Filter Query, rules 1 and 2 only: `<Source> eq 'Rep app' and <Route> eq 'Direct to partner'`,
     with the two internal names filled in.
   - Order By: `Created desc`.
   - Top Count 500. No pagination: the list is far under 5,000 items.
   - The blank test for Introduced On is not in this filter. The Learn row covers text
     comparisons, not a blank date, so it is done in step 3.
3. **Filter array `Keep_listed`**: the rows that meet rules 3, 4 and 5 (the "Filter array,
   Select and join" and "Expressions for dates and blanks" rows).
   - From: `body('Get_items')?['value']` (use the real name of the step 2 action).
   - Edit in advanced mode, one expression:
     `@and(empty(item()?['<Introduced On>']), less(ticks(item()?['Created']), ticks(addMinutes(utcNow(), -60))), greaterOrEquals(ticks(item()?['Created']), ticks('<start time>')))`
   - The start time is typed as a fixed UTC timestamp ending in `Z`, for example
     `2026-11-15T19:30:00Z`. Record it in the report in UTC and in Eastern. It is never an
     expression.
4. **Condition `Any_listed`**: `greater(length(body('Keep_listed')), 0)`. The No branch is
   empty, so the run ends Succeeded and sends nothing. Steps 5 to 7 go in the Yes branch.
5. **Filter array `Real_listed`**: From `body('Keep_listed')`, advanced mode:
   `@not(equals(item()?['Test'], true))`. It holds the listed leads that are not TEST. It
   only decides the subject.
6. **Select `Lead_lines`**: From `body('Keep_listed')`, map in text mode (one value, not
   key and value):
   `concat(item()?['<Referral ID>'], ' | ', coalesce(item()?['<Practice Name>'], ''), ' | ', coalesce(item()?['<Referring Rep>'], ''), ' | ', convertTimeZone(item()?['Created'], 'UTC', 'Eastern Standard Time', 'M/d h:mm tt'), ' | Intro Tries ', if(equals(item()?['<Intro Tries>'], null), 'blank', string(item()?['<Intro Tries>'])), if(equals(item()?['Test'], true), ' | TEST', ''))`
   - Intro Tries is a number, and `empty()` doesn't take a number, so the blank test is
     `equals(..., null)`. The Eastern zone name follows daylight saving time; don't
     subtract a fixed 5 hours.
7. **Send an email (V2)**, the one email:
   - To: Brian's address as the 3F copy's alert uses it. No CC, no BCC.
   - Subject: `concat(if(equals(length(body('Real_listed')), 0), '[TEST] ', ''), 'Field leads with no intro: ', string(length(body('Keep_listed'))))`
   - Body: `join(body('Lead_lines'), '<br>')`, then the two fixed lines from "The email",
     then `if(greaterOrEquals(length(body('Get_items')?['value']), 500), 'The list may be cut short. Tell Claude.', '')`.
   - The rows come out newest first because step 2 orders by `Created desc`.
8. **If the Get items or the email fails, the run ends Failed.** Add no step that hides a
   failure. A Failed run is what the weekly check looks for.
9. **Secure inputs and outputs** (the "Secure inputs and outputs" row) on every step that
   carries lead data: the Get items, `Keep_listed`, `Real_listed`, `Lead_lines` and the
   email. Turn on both settings where the step offers both, and Secure inputs where it
   offers only that. Record what each step offered. Turned on between checks 5 and 6, as
   the checks say.
10. Nothing else. The flow holds exactly: the Recurrence trigger, Get items, `Keep_listed`,
    `Any_listed`, `Real_listed`, `Lead_lines` and the email. No trigger condition, no
    concurrency setting, no write.

## TEST rows G1 and G2

Two TEST rows are made by hand on Referrals for the checks (Claude's call under Brian's
standing go for 11/15; decision 134).

- **Before making them:** the 3F copy is the finished one: sheet 3F-F build step 6 is
  imported, its saved trigger conditions were read back with the Intro Tries under 3 test
  in them, 3F-F checks 11 to 15 passed (gate G5), and its intro To is restored (v5.2). The
  Intro Tries column exists on Referrals. The 3F copy is **Off**, and stays Off until check
  5. Agree the hour with BB3 on the desk first, because BB3's own checks need the copy On.
- **G1:** copy every column value from a row 1F wrote (A157), except: practice name
  `TEST GC G1 Dental`, Note `TEST GC G1 - ignore`, Test = Yes, Submission ID
  `TEST-GC-G1-20261115`, Referral ID (Title) `TEST-GC-G1`, and Introduced On, Next Update
  Due, Last Notified Status and Intro Tries left blank. Submission ID is unique on Referrals,
  so a copied one is refused (BB5, 11/15). Any other column refused as a duplicate gets A157's
  value with ` TEST GC G1` added; record which.
- **G2:** the same, with practice name `TEST GC G2 Dental`, Note `TEST GC G2 - ignore`,
  Submission ID `TEST-GC-G2-20261115`, Referral ID `TEST-GC-G2`, and Intro Tries = 3.
- Read each saved row back: Source `Rep app`, Route `Direct to partner`, Test = Yes. Record
  its ID and its Created time.
- The live 3F takes only `FSC app` rows, and HSBS 2, 2B and 3 skip Test = Yes rows, so no
  live flow acts on them.

This is not the 3F-F rule "make the row only after the turn-on rule". Here the copy is Off on
purpose.

## TEST checks (each is pass or fail)

The flow is **On** for the checks: a flow that is Off can't be run by hand (the "Scheduled
flow" row). Run it by hand with Test, Manually, Run flow. A scheduled run that falls inside
the checks passes when it lists exactly the G rows that were more than 60 minutes old at
its start time and had no Introduced On.

**On any failed check, or any wait longer than one hour mark, turn the flow Off first, then
report.** Turn it On again only to rerun the check. Otherwise a stuck G row means a `[TEST]`
email to Brian every hour.

Before the checks, record how many `Rep app` rows on Referrals have Introduced On blank and
were created before the start time (the old build rows), and confirm none was created after
it.

1. **Nothing to report.** Before G1 and G2 are made: the run ends Succeeded and sends no
   email. Record how many rows the Get items returned and how many the Filter array kept (0).
2. **Too young.** Make G1 and G2. Run within 30 minutes: no email.
3. **Listed after an hour.** Run again once G1 and G2 are more than 60 minutes old: one
   email, listing exactly G1 and G2. G1 shows Intro Tries `blank`, G2 shows 3. The subject
   starts `[TEST] `. Each created time matches the row's Created, in Eastern time.
   3a. Read the saved subject expression back as text: it matches build step 7 exactly.
   (No TEST run can show a real lead, so this is how the "not every lead is TEST" case is
   proven before launch.)
4. **One recipient.** On that run the email has one To, no CC and no BCC (recorded as
   "Brian", never the address).
5. **An intro clears it.** Have the 3F copy turned On (BB3, on the desk), wait out the
   turn-on rule (runbook step 4), and edit G1's Note. G1 may get its intro at turn-on
   without the edit; either is fine. After G1 has Introduced On set, run again: the email
   lists G2 only. The 3F copy stays On through check 7.
6. **After secure settings (build step 9).** Run again: the run ends Succeeded, the email
   step ran once, and every step listed in build step 9 shows hidden inputs and outputs.
   Claude reads that email in the TEST inbox and confirms it lists G2 only.
7. **Resetting a parked lead clears it.** With the copy still On, set G2's Intro Tries to 0.
   After G2 has Introduced On set (one intro, to the TEST inbox only), run again: no email.
   Turn the copy Off, or leave it as BB3 says on the desk.
8. **Old rows and other sources stay out.** No run above listed a row created before the
   start time, or a row whose Source is not `Rep app`. If the count of old rows recorded
   before the checks was 0, write "not proven" for the old-rows half.
9. **It wrote nothing.** G1 and G2 show no change to Modified from any gap check run, and no
   run of the 3F copy, HSBS 2, 2B or 3 started at a gap check run's time.
10. **The schedule.** Read the saved trigger back and record it: frequency, interval, the 15
    hours, minute 0, the time zone. One scheduled run is listed in the 28-day run history at
    an hour mark between 7 AM and 9 PM Eastern, and its start time reads that Eastern hour.
11. **Nothing else changed.** No other flow has a new version. No list has a new column.
12. **Left Off and clean.** Turn the flow Off. No `Rep app` row created after the start time
    is left with Introduced On blank. The flow goes On again only at runbook step 4, on
    Brian's go.

Delete nothing. G1 and G2 both have their intro by the end, so neither is listed again. They
go in the runbook's step 9 cleanup.

## At go-live

The runbook (`docs/build/field-two-track-go-live.md`) turns this flow On in step 4, with the 3F
copy. Nothing in the flow changes at go-live: no condition is removed and nothing is
re-imported.

## Rollback

Turn the flow Off. It wrote nothing, so there is nothing else to undo.

## Known limits

- **Hourly, 7 AM to 9 PM Eastern.** A lead that arrives after 8 PM is first reported at
  7 AM the next day.
- **It repeats.** A lead that stays stuck is in every hourly email until it is fixed. A TEST
  row left without an intro after the start time does the same, so none is left (check 12,
  and runbook step 4).
- **A quiet inbox does not prove the flow is alive.** It sends nothing when there is nothing
  to report. The weekly check reads its run history: a run each hour, none Failed.
- **The newest 500 field leads.** The read takes the newest 500 `Rep app` leads routed
  Direct to partner, with or without an intro. A lead older than those is not looked at, and
  the email says the list may be cut short. Before the list of field leads nears 500, the
  blank test moves into the read, with a Learn row for it. Past 4,000 items on Referrals the
  read also needs an index and pagination, with the other reads in the runbook's "Not in this
  launch".
- **Staffing leads.** When staffing is turned on in the app, a staffing `Rep app` lead is
  listed too if it has no intro after an hour. That is right once the staffing branch of the
  3F copy is built; until then staffing leads are not sent at all (gate G9).
