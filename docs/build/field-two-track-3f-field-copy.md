# Field two-track app: sheet 3F-F, HSBS 3F Field copy (the Sunday TEST build)

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and names in code quotes are live SharePoint and flow names.

Builder: BB2. Decision 119 (Brian, 11/14): "yes, all field pieces as copies, prove on
preview".

**This sheet alone governs the Sunday TEST build of the field 3F copy.** It replaces, for that
build, everything in sheet F3 (`docs/build/field-two-track-staffing-intro.md`) except the two parts
it names below: Part T and Part U's U1 and U2. F3's prerequisites (P1 to P4), Step 0's
baseline (fact 0.11), Part R, Part S, Part B (the staffing branch), U3, Part D and F3's
numbered checks are not used for this build. They come back, revised, for the staffing build
and for go-live.

## What the copy is

- **HSBS 3F Field copy** is a Save As of the live 3F. It sends the partner intro and makes the
  Service Case for a field app lead (Source `Rep app`).
- The live 3F is never edited. It takes only Source `FSC app` rows (F3 fact 0.1). The copy
  takes only Source `Rep app` rows, so no row can start both.
- Until Brian's go-live, the copy also takes only Test = Yes rows.
- For Sunday it runs only the HealthFirst path: a `Rep app` HealthFirst row runs down the path
  3F uses today (the B1 No side). The staffing branch comes after Sunday.
- It uses the existing HealthFirst Routing row. No Routing row is added or edited.

## Before you build (each is pass or fail)

1. **1F passes its 3a checks** (sheet 1F checks 1 to 6): field rows are written with
   RepPracticeType, and 1F's Test expression on the Referrals row is the name rule OR the Rep
   Roster row's Test, read from the 1F definition. No `FSC app` row is posted for this sheet.
2. **The other flows skip TEST rows.** Read HSBS 2, 2B and 3, change nothing, and record for
   each the saved condition that skips a Test = Yes row, with the step it sits in. If any of
   the three would act on a Test = Yes `Rep app` row, stop and report.
3. **The TEST HealthFirst partner row** is on Partner Links (decision 121).
4. **Step 0's record stands:** today's live 3F sends nothing for a `Rep app` row. That is the
   "before" for check 3. No baseline rows are posted.

## Build

1. Save As "HSBS 3F Field copy" from the live 3F. Confirm the live 3F has no new version.
2. In the copy only, set the trigger conditions to: Source `Rep app` (not `FSC app`), Route
   `Direct to partner`, Introduced On empty, the SystemEditAt rule exactly as the live 3F has
   it, and Test = Yes: `@equals(triggerOutputs()?['body/<Test internal name>'], true)`. Check
   each condition against the Trigger conditions row in
   `docs/claude-code/MS-LEARN-REFERENCES.md`. Keep the copy Off except while a check runs.
3. **Part T** (sheet F3): the Service Case create writes the row's Test onto the case
   (decision 101).
4. **Part U, U1 and U2 only** (sheet F3, decision 112): remember the three stamped columns,
   and put them back when no intro went out on the HealthFirst path. U3 belongs to the
   staffing branch and is built with it.
5. **The field intro (decisions 124 to 126, S2 ruled).** Send_intro names the rep (the row's
   rep name and email) as the referrer, with their roster position (decision 126: the Rep
   Roster Role for the Referring Rep Email; `RM` reads "RGM"; blank shows no label), not
   Referring FSC, and drops the line that says another person is
   copied. In production its To is Kara Reyher, the field team's HealthFirst contact
   (decision 125), not the Routing row's contact, the greeting is "Hi Kara,", and its CC is the rep and Brian. The
   Test-mode path is unchanged: everything goes to the TEST inbox only. Remove the `Tell_PVA` step from
   the copy. The Service Case's receiver name and email are Kara's too, from the same fixed
   contact, not the Routing row's (decisions 127 and 129; from go-live step 7b the Routing
   row names Kara too).
6. **Three tries, then stop and tell Brian (decision 131, S7 ruled).** Built after checks 1
   to 10 pass, as its own import.
   - Referrals gets one new Number column, `Intro Tries` (no default, not required). A new
     column only; no live flow reads it.
   - The copy's trigger gets one more condition: Intro Tries is under 3 (blank counts as 0).
   - On the "no intro went out" path: add 1 to the row's Intro Tries. On tries 1 and 2, wait 5
     minutes, then put the stamp back and write the new count, which starts the next try. On
     try 3, put the stamp back, write 3, send Brian one email (the referral ID, the practice,
     the partner and the error; subject starts `[TEST]` in Test mode; no other recipient), and
     end Failed. The trigger condition then keeps the row from starting again.
   - **Nothing can stop that email.** Keep the send action's error text in a variable inside
     the loop. When the variable is blank or missing, the email shows a fixed line instead
     (`if(empty(...), 'no error text', ...)`; `coalesce` alone passes a blank string through).
     Every step between the put-back and the email, and the email itself, runs after the step
     before it whether that step Succeeded, Failed, was Skipped or Timed out. The final Failed
     end runs after the email on all four outcomes too (Microsoft Learn, the run-after row in
     `docs/claude-code/MS-LEARN-REFERENCES.md`). On
     11/15 the first build hung the email off a Compose that failed, so the email was skipped
     and the run ended with no alert (desk report 005, check 12).
   - To try again after the cause is fixed, someone sets Intro Tries back to 0 on the row.
   - The "an intro went out or may have" path is unchanged: the stamp stays and nothing retries.
7. Nothing else changes in the copy.

## TEST checks (TEST `Rep app` rows, TEST in the practice name)

Never send an `FSC app` row. The copy never starts on one.

**TEST rows.** Checks 1 to 10 ran on rows sent through 1F, which proves the path from the app
to the intro. For checks 11 to 15, and for the secure-settings check under gate G8, a TEST row
may instead be made by hand on Referrals (decision 134, 11/15: posting to 1F needs its
address, which only Brian may enter, and 1F itself is proven by gate G1):

- Copy every column value from a row 1F wrote (A157), except: a new practice name starting
  `TEST`, a new Note, Test = Yes, and Introduced On, Next Update Due, Last Notified Status and
  Intro Tries left blank.
- Give each new row its own Submission ID and Referral ID, in the form sheet GC uses
  (`TEST-3F-C11-20261115` and `TEST-3F-C11`, one per check). Referrals refuses a second row
  with the same Submission ID, so a row copied whole from A157 is never saved.
- Read the saved row back: Source `Rep app`, Route `Direct to partner`, Test = Yes. Record its
  ID.
- Make it only after the copy has passed the turn-on rule (runbook step 4). Sheet GC's rows
  G1 and G2 follow that sheet's own recipe instead: there the copy is Off on purpose.
- The live 3F takes only `FSC app` rows, and HSBS 2, 2B and 3 skip Test = Yes rows, so no
  live flow acts on it.

1. **One flow per row.** One TEST HealthFirst row: the copy has one run, the live 3F has none.
2. **The case.** The row gets Introduced On set and exactly one Service Case, with Test = Yes.
3. **The intro.** It goes only to the TEST inbox. Record its subject, body, who it names as
   the referrer, every To, CC and BCC (as "TEST inbox" or "Brian", never an address), and any
   other email the run sent with its subject. It passes when the intro names the rep as the
   referrer, names no one but the rep as the sender, and no other email was sent (decision 124).
4. **No second intro.** The same row run again (any edit to it): no second intro, no second
   case.
5. **Stamp back (U1, U2).** In the copy only, change Send_intro's test-path To to an address
   the send action refuses (record the error text, not the address). Send one new TEST row
   through 1F. The run ends Failed with `Intro not sent; stamp put back`. Introduced On, Next
   Update Due and Last Notified Status read as before the run. No Service Case. No email
   reached anyone.
6. **Retry sends once.** Put the To back. The next run sends exactly one intro and makes
   exactly one Service Case, with Test = Yes. Then no further run starts for that row.
7. **One partner per row.** On every copy run, the partner loop ran exactly once. If it ran
   more than once for one row, stop and report.
8. **Success untouched.** On the check 1 run, the stamp stayed and neither the Condition's Yes
   side nor any put-back ran.
9. **No live email.** On every run above, every To, CC and BCC is the TEST inbox.
10. **Nothing else changed.** The live 3F, 7A, 7B, HSBS 9, HSBS 2, 2B and 3 have no new
    version. Routing has no new version. Partner Links has only the TEST HealthFirst partner
    row added. Service Cases has the Test column, default No (F3 Part T, T1). The existing
    cases are unchanged: blank and No both mean "not TEST" (T2, decision 114), so none is
    edited. Every new case from the checks above has Test = Yes.

**Gate for Sunday:** checks 1 to 10 pass.

### Checks for build step 6 (three tries)

Run with Send_intro's test-path To set to an address the send action refuses, on one new TEST
row. After each import, read the saved trigger conditions back and record them, then wait out
the turn-on rule (runbook step 4) before the row is made.

11. **Three tries.** Exactly three Failed runs for the row, about 5 minutes apart. After the
    third: Intro Tries reads 3, Introduced On, Next Update Due and Last Notified Status read
    as before the first run, and there is no Service Case.
12. **One email to Brian.** One email, only to the TEST inbox, after the third try and not
    before. Its subject starts `[TEST]` and it names the referral ID and the practice.
13. **It stops.** No fourth run in the next 10 minutes, and an edit to the row's Note starts
    no run.
14. **Try again.** Put the To back and set Intro Tries to 0 on the row: one intro, one Service
    Case with Test = Yes, and no further run.
15. **The success path is unchanged.** One more new TEST row with the To in place: checks 1, 2
    and 3 hold, and Intro Tries stays blank.

## Stop items

- **S2 and S6 (the intro's names, copies and extra emails): ruled 11/14, decision 124.** Brian:
  "yes, name the rep, drop the extra notice" (the `Tell_PVA` step). Build step 5 carries it.
- **S7 (endless retry): ruled 11/14, decision 131.** Brian: "yes, try 3 times then stop and
  email me". Seen in check 5: with no limit the copy tries again about every 30 seconds while
  it is On. Build step 6 and checks 11 to 15 carry the ruling. Until that import, turn the
  copy Off after each check.
- Every stop item is a hard stop. No live sends.

## Rollback

Turn the copy Off. Nothing live was changed, so there is nothing else to undo. TEST rows go in
the after-Sunday cleanup.

## Not in this sheet (after Sunday)

- The staffing branch (F3 Part B), with U3, Part R and its Routing row, and F3's staffing
  checks.
- Going live: Part S on HSBS 2, 2B and 3 (a live edit, on Brian's go), then remove the Test =
  Yes condition from the copy and turn it On. Build step 6 (three tries) must be in and its
  checks passed first.
