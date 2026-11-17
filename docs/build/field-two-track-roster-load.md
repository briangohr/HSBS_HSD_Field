# Field two-track app: build sheet F5, the field roster load

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and the other team's exact list and column names are only in the old repo's copy.

**Hard gate. No row is loaded, on any list, until every gate in "Gates" below is met and
written in the build report. If any gate fails or cannot be checked, BB2 stops, loads
nothing, and reports which gate and why.**

Written 11/13/2026 by Claude for BB2, from the approved spec "Field two-track app: team
members and managers (v1)" (`docs/build/field-two-track-spec.md`, approved by Brian 11/13:
"approve the spec"). Section numbers (3, 6, 9, 13) and check names (M9, M25, M27) are that
spec's. This sheet builds the F5 row of spec section 9.

This is a build sheet. BB2 does it in SharePoint and Power Automate. It changes one flow,
HSBS 1R, and only if the live 1R lacks the Test rule (step R, the 1R Test repair), and it
turns Brian's daily gap check off and back on around the load. The only other Power
Automate work is the one-off load run in F5.3, which has no trigger anyone
else can call and sends no email. The repo never edits a flow. Sheets F1, F2 and F6 are in
`docs/build/field-two-track-flow-contracts.md`; F3, F4 and F7 are separate sheets.

Same house rules as `docs/build/rep-app-flow-contracts.md`: Referral Keys and flow URLs never
appear in the repo, a sheet, a build report, a log, a test note or a commit.

Builder: BB2 (decision 91).

Checked against BB2 step 1 facts v2 (11/13): R1, F3-0.4, F3-0.5, F3-0.6, F7-0.6, and the v2
decision 97 checks (3F's Test_mode reads the row's Test; no Test column on Service Cases).
Brian's 11/14 answer, decision 101 (a Service Cases Test column that 3F fills), closes S19.

## Stop-and-ask items (decision 89)

Brian's rule for build sheets (decision 89): after three fix rounds, with no P0 open, each
remaining review point is written in as a stop at the step it guards. At each one BB2
confirms what it says, or stops and asks Brian, before going past it.

| Item | Where | What BB2 confirms first |
|---|---|---|
| S1 (hard stop) | Step R, before check R4 and before "R: going live" steps 2 and 4 | G4 is confirmed: Test mail is skipped or sent only to the TEST inbox |
| S2 | Step R, "R: the change", steps 2 and 4 | Each Service Case's Test expression is the same as the Referrals one |
| S3 | "R: rollback" | No accepted (skipped) Test row remains, or `REP_APP_ENABLED` is off |
| S4 | Rollback step 8 | No deletion in rollback step 4 failed |
| S5 | F5.1, before the final dry run | Public registration (`/api/register`) is paused until the F5.4 reconcile is done |
| S6 | Rollback, the batch-row check (step 1) | Every batch row passes the whole predicate, not only Test = Yes; any row that fails any part stops the rollback and BB2 asks Brian |
| S7 | "BB2 records before loading", before F5.3 | A secure pre-load record holds the other team's roster and FSC Roster counts and each existing roster row's item ID and Modified value, so check 8 can compare; without it, check 8 is not run and BB2 asks |
| S8 | Check 9 | Every flow run the load or the import started has reached a terminal state before its actions are read; a run still going means BB2 waits, and asks if it does not finish |
| S9 | F5.2, the conforming-row rule | An accepted existing row's Rep Name matches the F5.2 expected name (the source roster name after the question 6 change, parenthetical dropped); a different name is a clash and BB2 asks |
| S10 | F5.4, accepting an existing Team Roster pair | The pair's Rep Name equals the expected name; a stale or different name is a clash and BB2 asks |
| S11 | Check 13, the order query | Before accepting the empty result, BB2 runs the query once against one controlled TEST FSC set up to violate it (then restores it) and sees it listed; if it is not listed, BB2 stops and asks |
| S12 | Check 6, the cross-roster key check, and every other read of a whole roster | The Get items read covers every row (Top Count 5000 or pagination on); a read that may be cut at 100 is not a pass |
| S13 | Rollback, the referral guard before any deletion | The lookup by Referring Rep Email covers every Referrals row (indexed column first, or ID windows with Top Count 5000); a read that may miss rows stops the rollback |
| S14 | Rollback step 8, after a deletion retry succeeds | Step 5 (turn off pairs) and the rollback check run again for every newly deleted rep before the batch is archived |
| S15 | After rollback, while any Test row the rollback keeps remains: every accepted row, and every row refused for a referral in rollback step 3 | `REP_APP_ENABLED` stays off, or step R stays in place, until each such row is removed or made safe; Brian turns the app back on only after BB2 confirms that in writing |
| S16 | F5.1, the dry run | The existing the other team's roster, FSC Roster and Rep Roster keys are compared with each other; any duplicate already there is a pre-load clash |
| S17 | F5.3, resuming a row with an open `intended` line and no row created | A fresh key is generated and checked for collisions before Create item is retried |
| S18 | Before any fresh load after a rollback | No Team Roster pair a rollback set to Active = No (rollback step 5) is left in place. If an inactive pair is left, BB2 stops and asks Brian before any fresh load |
| S19 | G3; step R steps 2 and 4, S2, checks R1 to R3; "BB2 records" item 7 | Step 1 facts (11/13): 1R makes no Service Case (fact R1), Service Cases has no Test column (v2 check 5), and 3F and HSBS 3 make the case without Test (fact F3-0.5). **Decided 11/14: decision 101** ("Add a Test column"). Service Cases gets a Test column (sheet F3, Part T), and 3F copies the Referrals row's Test onto each field or FSC case it makes. So G3's Service Case half is met by 3F's copy, not by 1R; step R repairs the Referrals Test only, and step R step 4, S2 and the scratch Service Cases list have nothing to act on. "R: stop instead of repairing" (second bullet) no longer stops step R |

## Order of work

1. "BB2 records before loading" (read only).
2. Step R, the 1R Test repair, if G3 finds the rule missing. It goes onto the live 1R in
   place ("R: going live") only with Brian's go, after its checks pass.
3. Sheet F4 built and checked (F5 waits for it; see G1).
4. Gates G1 to G5.
5. F5.1, the dry run. Then G6, Brian's go.
6. The gap check is turned off ("The gap check pause").
7. F5.2 to F5.5, the load.
8. TEST checks 1 to 13. Then the gap check goes back on, on Brian's word.
9. Go-live, person by person, is Brian's, in the top-down order under "Going live". It is
   not part of the load.

## Gates (all before any row is written)

| # | Gate | How BB2 knows it is met | If not |
|---|---|---|---|
| G1 | Check M27 passes (spec section 10), every part except its one post-load line ("Then the load itself is checked: every loaded row has Test = Yes"), which is TEST check 1 below. M27's award parts (the award row at Reached and Qualified, the staged go-live, the blank Company row and the Waiting row from before the qualify rule) need the SPIFF Ledger and HSBS 10 from sheet F4. They run once F4 is built, and **F5 waits for F4**: no row is loaded until every part of M27 except the post-load line has passed | BB2's M27 report, with the run history of 3F and 7B read for recipients | Stop. Load nothing |
| G2 | `AGENTS.md` rule 19 is reworded on `main` to allow RGMs and their FSCs on the Rep Roster, with the matching line in the old repo's other-team app contract (decision 67; spec section 11 item 2). Today (11/13) rule 19 still says a field person "is never added to the FSC or Rep roster" | Brian or Claude tells BB2 in writing that the PR is merged, with its number | Stop |
| G3 | The live 1R writes a Test rep's referral as a TEST row: a Rep app submit from a Rep Roster row with Test = Yes makes a Referrals row with Test = Yes and a Service Case with Test = Yes, whatever the rep's name, email and practice name are | BB2 reads the live 1R (read only) and writes in the build report the exact expression that sets Test on each new Referrals row and Service Case. If it reads the Rep Roster row's Test column for both rows, G3 is met. If it does not (for example it looks only for "TEST" in a name or email), BB2 builds step R, and G3 is met once step R is live. **Step 1 (11/13):** the FSC copy of 1R sets the Referrals Test from a practice or doctor name starting `TEST`, not from a roster Test column (fact F7-0.6), so that copy does not meet G3; it makes no Service Case (fact R1), and Service Cases has no Test column yet; decision 101 adds one that 3F fills from the Referrals row (S19), so G3's case half is checked on the case 3F makes. The 1R the rep app reaches is read under item 8 | Stop and report only if the live 1R differs in a way step R does not cover (see step R, "Stop instead of repairing") |
| G4 | Every flow that emails a referring rep skips a Test row, or sends it only to the TEST inbox the flows already use. At least 3F and 7B (partner updates to the rep), and any other flow that reads Referring Rep Email or a Rep Roster email and sends mail. Each must decide by the row's Test column, not by a name. **Step 1 (11/13):** 3F sends no rep receipt today (fact F3-0.4); since 11/13 its Test_mode reads the row's Test column and a Test row's mail goes only to its test path, Brian, with no CC (decision 97). HSBS 2, 2B and 3 skip a row with Test = Yes or `test` in the practice name (fact F3-0.6). 7B's Test rule is not yet recorded | BB2 lists each such flow by name in the build report, with the step that skips Test rows | Stop and report. Do not change any flow but 1R under this sheet |
| G5 | No flow sends mail, or writes anything, when a Rep Roster or Team Roster row is created or changed. That includes any welcome sender (Sheet 1 addendum v2) and any scheduled run that mails about people on the Rep Roster. The one known scheduled sender, Brian's daily gap check, is handled by "The gap check pause" below and does not fail G5 | BB2 lists every flow with a trigger on, or a scheduled read of, either list, and what each would do with a new row that has Test = Yes | Stop and report. Loading 590 rows into a list that a sender watches would be 590 live sends |
| G6 | The dry run (F5.1) passes and Brian gives the go in chat, in his own words, after seeing the dry run counts | The dry run report, and Brian's go quoted in the build report | Stop |

**The gap check pause.** Brian's daily gap check (`docs/build/rep-app-flow-contracts.md`, "The
daily gap check") emails Brian every non-Disabled Rep Roster row with no Active Team Roster
row. During the load it would list every row created before its pair is imported, and after
it the 30 RGMs, who get no pair. So:
1. After G6, before F5.3 starts, BB2 turns the gap check flow off (Turn off only; nothing in
   it is edited) and writes the time in the build report. If it cannot be turned off, stop.
2. It stays off through the load, the Team Roster import and reconcile, and TEST checks 1
   to 13. Check 9 confirms it had no run in that time.
3. After check 13 passes, BB2 tells Brian it is ready to turn back on, and that from then on
   it will list the 30 RGMs every day (to Brian only) because RGMs have no pair. BB2 turns
   it back on when Brian says so in writing, and writes the time in the build report.
   While it is off, Brian gets no gap check for anyone; the load and checks should run in
   one or two days.
4. If the load is rolled back while it is off, BB2 turns it back on after the rollback check
   (rollback step 7), with Brian's word.

Decision 67 (11/12) also asked that the rep app submit path hold a test person's referrals
to practice before anyone is loaded. That condition is replaced by the approved spec
(decision 74, 11/13, after 67): a Test rep's referral is a TEST row that sends nothing live,
and M27 checks it (conductor, 11/13). G1 and G3 are that condition now.

## Rules for every step

1. TEST rows only while testing, as in `docs/build/field-two-track-flow-contracts.md`, "Rules for
   every step". Decision 48 lets BB2 create TEST rows and delete them after.
2. No live sends. Nothing in this sheet emails anyone. The load writes rows only.
3. No new email recipients anywhere.
4. No secrets: no key, flow URL, token or password in the build report, the batch file, a
   run's visible output or a commit. No email address or phone number in the build report,
   the dry run report or the batch file either: name a person by source roster tab and row
   number only. The one file that holds emails is the Team Roster pair file (F5.4), which is
   the import itself; it lives only in `/HSBS_BOT/build/` and is never pasted into a report,
   a chat or a commit.
5. **Secure inputs and Secure outputs on every action that receives or emits roster data**,
   in the load run (F5.3) and in every check run: each read of the source roster, each Get
   items or filter on the other team's roster, FSC Roster, Rep Roster or Team Roster, each Compose,
   Condition, Select or variable that holds a name, email, phone or key, each Create item,
   and each write to the batch file. Run history then shows no contact data and no key.
6. Escape `'` as `''` in every Filter Query. Compare emails with `toLower`. Names on the
   roster carry apostrophes.
7. Never write to the other team's roster, the FSC Roster, Referrals, Service Cases or the SPIFF
   Ledger.
8. Never change a Rep Roster or Team Roster row that exists before the load.

## Words used in this sheet

- **The source roster** is the Henry Schein Dental Roster of September 16, 2026 (Dropbox
  `/HSBS_BOT/roster`), the file `src/data/field.mjs` and `src/data/teams.mjs` were built
  from (decision of 11/9: "The September 16 roster is the source"). Its AED RGM tab lists
  the RGMs, its Field Sales tab the Field Sales Consultants, its Equipment Sales tab the
  Equipment Specialists.
- **A row number** is the row in the source roster file as Excel numbers it, with the tab
  name. A person is named in any report by row number only.
- **The load date** is the date the first load run starts, as SharePoint shows it in the
  site's regional time zone. It is written once, as the first line of the batch file, and
  every later run (a resumed load) reads it from there. Every row in the batch carries that
  one date, whatever day a resumed run happens on.
- **The batch** is every Rep Roster row the load run creates and every Team Roster row the
  pair file adds. **The batch file** is `/HSBS_BOT/build/F5_load_batch.csv` in Dropbox, one
  file for the whole load. It is only ever appended to. Its first line is `load date,<date>`.
  Every other line is `<state>,<list>,<item ID>,<source tab>,<row number>,<Role>`, where state
  is `intended` (written before a Rep Roster create, item ID blank), `created` (written after
  it, with the ID) or `imported` (a Team Roster pair, with the ID). No key, no email, no
  phone. A batch row is a line with an item ID. There is no Load Batch column on either list;
  the batch file is the batch (conductor, 11/13). **The load is complete** only when every
  `intended` line has a `created` line for the same tab and row, and every line of the pair
  file has an `imported` line.
- **An RGM's email** is the email on that RGM's AED RGM tab row, and it must equal, ignoring
  case, the `email` of the same RGM in `src/data/field.mjs`. **An FSC's manager email** is
  the RGM email on that FSC's Field Sales tab row. The spec matches managers by email, never
  by name (section 3: the roster spells two RGMs differently on different tabs). One
  settled exception, below: the Houston RGM's 7 FSCs.
- **A conforming row** is an existing Rep Roster row with this person's email that already
  meets every F5 value: Role `RM` for an RGM or `FSC` for an FSC, Services `HealthFirst`,
  Test = Yes, Status not `Disabled`, and a Referral Key of 24 to 128 URL-safe characters
  that no other row on the other team's roster, FSC Roster or Rep Roster shares.

## BB2 records before loading

1. G1 to G5 results, as the table above says.
2. The Rep Roster columns as they are live: exact names, types, which are required, and
   the choices on Role, Status and Source. `RM`, `FSC` and `Brian's roster` must be
   existing choices. If one is missing, stop and report (this sheet adds no choice).
3. The Team Roster columns as they are live, and how many rows it holds today.
4. How the live 1J makes a Referral Key (the method, never a key), so F5.3 makes keys the
   same way.
5. Which link the live 1J resends when an email is on two rosters (an RGM is on the other team's roster
   and, after this load, the Rep Roster; a pilot FSC is on the FSC Roster). This
   sheet changes nothing about it; Brian needs to know.
6. Whether the source roster's Field Sales tab has a column holding each FSC's RGM email,
   and its exact header. If it has none, stop and report: pairs are matched by email only.
7. For 1R (G3): the exact expression that sets Test on the new Referrals row and on each new
   Service Case for a Rep app submit, the name of the action that finds the Rep Roster row
   that owns the key, and whether that row's Test column is read anywhere in the submit.
   Recorded 11/13 for the FSC copy: Referrals Test comes from a practice or doctor name
   starting `TEST` (fact F7-0.6); no Service Case is made (fact R1). Since decision 101 the
   case's Test is copied from the Referrals row by 3F (S19).
8. Pre-build check, read only: which 1R the rep app submit reaches (by run history after a
   TEST call, never by URL; the FSC copy writes Source `FSC app` or the other team's app Source value only, fact
   F7-0.11), exported and read for item 7 before step R is built. Also 7B's Test rule for
   G4, from the 7B the partner save reaches.

## Step R: the 1R Test repair (only if G3 finds the rule missing)

Spec section 9, F5 row: "The sheet has BB2 confirm this from the live 1R and add it if it is
missing." This is that addition. If the live 1R already sets Test from the Rep Roster row's
Test column on both the Referrals row and each Service Case, skip step R.

### R: the change

Build and test on a copy of HSBS 1R first (steps 1 to 5, checks R0 to R5). The live 1R is
untouched until the copy passes and Brian says to go. Then the same edits go onto the live
1R **in place** ("R: going live"), so its HTTP trigger URL, which the site reads from
`REFERRAL_FLOW_URL`, does not change. A copy has its own trigger URL, so a copy can never be
"swapped in" without a site change.

1. In the submit branch for `referrerRole` `Rep`, right after the existing action that finds
   the Rep Roster row owning the key (recorded under item 7), add a Compose named
   `RepIsTest`: `equals(<that row's Test column>, true)`. A missing or empty value is false.
2. Add a Compose named `OldTest` holding exactly the expression 1R uses today for Test on the
   new Referrals row (recorded under item 7), unchanged.
3. On the Create item for the Referrals row, set Test to
   `or(outputs('OldTest'), outputs('RepIsTest'))`.
4. On each Create item for a Service Case made by this submit, set Test to the same
   expression, so the case always matches its Referrals row.

   **Stop item S2.** Before steps 2 and 4, BB2 compares each Service Case Create item's
   Test expression in the live 1R with the Referrals one (recorded under item 7). If every
   one is the same, go on. If any differs, stop and ask Brian: the repair would replace a
   case's own rule, and step 5 promises it only turns Test on.
5. Nothing else changes: not the other-team or FSC submit branches, not lookup, list, team or
   earnings, not the response, not any other column. The new expression can only turn Test
   on; it never turns off a row that today's rule marks Test.

### R: stop instead of repairing

Stop and report, building nothing, if the live 1R:
- has no action that finds the Rep Roster row owning the key in the Rep submit branch;
- has no Test column on Referrals or on Service Cases, or makes a Service Case somewhere
  other than this submit (so step 4 cannot reach it);
- sets Test on the Service Case from something other than an expression in the submit
  branch (for example a later flow), so the case could differ from its Referrals row.

### R: TEST checks (each is pass or fail)

The point of the repair is that the Rep Roster's Test flag alone makes the row a TEST row,
so the check row carries no other TEST signal. To keep that safe, the check never writes to
Referrals or Service Cases: the mail that could go live is sent by the flows that watch
those lists (3F, HSBS 2 and 3, 7B), not by 1R, so disabling send steps in a 1R copy would
not be enough. The check writes to two scratch lists that no flow watches instead.

**R0. Set up the check.** Nothing it writes reaches a sender; Brian's own daily gap check may list the check row, to Brian only.
1. G5 is read first: no flow sends on, or writes after, a new Rep Roster row. If G5 is not
   met, stop.
2. Make two new lists on the site, `F5 Check Referrals` and `F5 Check Service Cases`, each
   with the columns the repaired Create item actions write (Test included). They are new, so
   no flow has a trigger on them; BB2 confirms that in the build report.
3. Export the repaired 1R copy and make a second copy from it, `HSBS 1R repair check`. In it,
   and only in it: point the Create item for the Referrals row at `F5 Check Referrals`, and
   each Create item for a Service Case at `F5 Check Service Cases`; delete every Send email,
   Teams and HTTP action. Reads (the key lookup, the `submissionId` check) stay as they are.
4. Add one check row to the Rep Roster: Role `FSC`, Services `HealthFirst`, Test = Yes, a new
   key, and a Rep Name and Rep Email with no "TEST" in them (the email is a mailbox BB2
   controls, decision 48). The submit uses a practice name and contact name with no "TEST"
   in them either, and a made-up phone.

**The checks.**
- R1. The check row (Test = Yes) posts a Rep app submit to `HSBS 1R repair check`. In the run
  history `OldTest` is false and `RepIsTest` is true. The `F5 Check Referrals` row and its
  `F5 Check Service Cases` row both have Test = Yes. If `OldTest` is true, the names still
  carry a signal today's rule reads: change them and run R1 again; R1 passes only on a run
  where `OldTest` is false.
- R2. The check row set to Test = No, same submit with a new `submissionId`: `RepIsTest` is
  false and both scratch rows have Test = No. The flag, and only the flag, moved the value.
- R3. BB2 compares the exports of the repaired copy and the check copy. The only differences
  are the list targets of the Create item actions and the deleted send actions. The Test
  expression on the Referrals row and on each Service Case is
  `or(outputs('OldTest'), outputs('RepIsTest'))` in both.
- **Stop item S1 (hard stop, before R4).** R4 and the "R: going live" baseline and
  post-change submits write to the real Referrals and Service Cases lists, which 3F, HSBS 2,
  HSBS 3 and 7B watch. Before any of them, G4 must be confirmed and written in the build
  report: each of those flows skips a Test row or sends it only to the TEST inbox. If G4 is
  not confirmed, do not run them on the real lists: run R4 on the check copy (scratch lists)
  instead, and stop and ask Brian before "R: going live".
- R4. On the repaired copy (real lists), a TEST other-team submit, a TEST FSC submit and a TEST Rep
  submit, each with TEST in the names, make rows exactly as the live 1R does (same columns,
  Test = Yes).
- R5. No email went out from any run above except where today's TEST rule sends it. The
  run history of 3F, HSBS 2, HSBS 3 and 7B shows no run started by a scratch list row.
- Afterwards: delete the check row from the Rep Roster, the scratch rows, both scratch
  lists, the check copy and the R4 TEST rows. The check row's key is never written anywhere
  but the Rep Roster.

### R: going live (in place)

1. **Backup.** Export the live 1R as it is now and save it to `/HSBS_BOT/build/` (never the
   repo). Write in the build report the four values step R changes, as they are now: the
   Referrals Test expression, each Service Case Test expression, and that `RepIsTest` and
   `OldTest` do not exist.
2. **Baseline.** Through the site (a protected preview or production, run by Brian or
   Claude), send one TEST Rep submit (TEST in every name), one TEST other-team submit and one TEST
   FSC submit. Record, by run ID, that each run landed on the live 1R and the Test value on
   each row it made.
3. **Change.** With Brian's go, open the live 1R and make exactly steps 1 to 4 of "R: the
   change", as tested on the copy. Save. The trigger is not touched, so its URL stays.
4. **Post-change check.** Repeat the three TEST submits of step 2 through the site. Each run
   lands on the live 1R (same flow, new run IDs), the Rep run shows `RepIsTest` true, every
   row has Test = Yes, and the other-team and FSC rows match the baseline column for column. No
   email went out except where today's TEST rule sends it.
5. Delete the TEST rows.

**If the live 1R cannot be edited in place** (BB2 says why in the build report), the one
allowed alternative is a single Vercel change, made by Brian: `REFERRAL_FLOW_URL` set to the
repaired copy's trigger URL, then a redeploy. Before it, Brian keeps the current value
outside the repo, the sheet and every report, as the rollback value. The step 2 baseline
runs before the change and the step 4 check after it, and the step 4 check must also show
every new run on the copy and none on the old 1R. `REFERRAL_FLOW_URL` serves other-team, FSC and
Rep keys alike, so the other-team and FSC checks are required. No other Vercel setting changes.

### R: rollback

Undo the change **in place**: on the live 1R, set each Test expression back to the value
recorded in "R: going live" step 1 and delete the `RepIsTest` and `OldTest` Composes, using
the backup export as the reference. Then repeat the step 2 baseline submits and compare.
(Under the Vercel alternative, Brian sets `REFERRAL_FLOW_URL` back to the value he kept and
redeploys, and the baseline submits must land on the old 1R.) **Never while any F5 row
exists with Test = Yes and `REP_APP_ENABLED` on**: a loaded person with a real name would
then write live rows. Roll back the load first (see "Rollback"), or Brian turns
`REP_APP_ENABLED` off first (with it off the site refuses every Rep submit).

**Stop item S3.** A rollback of the load keeps accepted (skipped) rows: they stay Test = Yes
with real names and were never Disabled. Before undoing step R, BB2 confirms that no
accepted row from this load is still on the Rep Roster with Test = Yes, or that Brian has
turned `REP_APP_ENABLED` off and said so in writing. If neither, stop and ask Brian; step R
stays.

## Who is loaded

| Group | Source tab | Loaded? | Role on the Rep Roster |
|---|---|---|---|
| The 30 RGMs in `src/data/field.mjs` | AED RGM | Yes, all 30 | `RM` (never "RGM") |
| The 560 Field Sales Consultants on those 30 teams, pilot FSCs included (T20) | Field Sales | Yes, all 560, unless one is held out below | `FSC` (never "Field Sales Consultant") |
| Equipment Specialists (109 under the 30 RGMs) | Equipment Sales | No (T15) | none |
| Area Executives | none in the repo | No. Not in the first load (decision 48, part; question 48 stays open for who they are) | none |
| Strategic Accounts and Digital Workflow staff | other tabs | No: they report to people who are not RGMs (spec section 3) | none |

Two settled points (conductor, 11/13):

- **Question 5 is answered by the repo.** `src/data/field.mjs` holds the Houston RGM's
  Henry Schein email (slug `mat-hechler`). His 7 FSCs (the 7 `src/data/teams.mjs` lists
  under that slug) load, paired to that email. On the source, if their Field Sales rows hold
  an RGM email, it must equal the `field.mjs` email (ignoring case); if the cell is blank,
  use the `field.mjs` email. Any other value: stop and report.
- **Question 6 is decided.** The two Field Sales names with a parenthesis (source rows 66 and
  145, as question 6 numbers them) load with the parenthetical dropped: remove the
  parenthesis, the words inside it and the space before it. The same name goes on the Rep
  Roster and the Team Roster. BB2 confirms both rows are Field Sales Consultant rows with a
  parenthesis in the name, and that no other Field Sales Consultant name on the source has
  one. If not, stop and report.

## Held out

Nobody is held out today for a name or an email. The rules stay, so that a source that does
not match the repo stops the load instead of loading a wrong row. A Field Sales Consultant
is held out, with no Rep Roster row and no Team Roster row from this load, when any of these
is true:

1. No email on the source row, or an email that does not end in `@henryschein.com`.
2. No mobile on the source row (decision queue question 10 is open; its default: "Rows
   without a mobile refused").
3. No manager match: the FSC's manager email (with the Houston exception above) is blank, or
   matches none of the 30 RGM emails.
4. The FSC's email is on two Field Sales rows.

An RGM is held out under rules 1 and 2 the same way.

**Clashes stop the load.** These are not held out; F5.1 stops and nothing is written:

- An existing Rep Roster row with the person's email that is not a conforming row (for
  example Test = No, Role `AE` or `Other`, Services without `HealthFirst`, Status
  `Disabled`, or a key that is missing, too short or shared). Rule 8 forbids changing it, and
  loading around it would leave that person outside F5's rules.
- Two or more Rep Roster rows with one person's email, even if each is conforming.
- An existing Team Roster row with an FSC's email that names a different Manager Email, or has
  Active = No; or two or more Team Roster rows for one FSC.
- Any Rep Roster or Team Roster row, anywhere on either list, that holds the email of an
  Equipment Specialist on the source roster (F5.1 step 5a).

**If the dry run holds out anyone, or finds a clash, BB2 stops before loading** and reports
each row by tab and row number with the reason. Brian decides; the counts in check 2 change
only on his word.

## The load, step by step

### F5.1 Dry run (reads only, writes nothing)

**Stop item S5.** Anyone can post a Henry Schein email to `/api/register` while
`REP_APP_ENABLED` is on, and 1J then writes a Rep Roster row that this load would treat as a
clash. Before the final dry run, BB2 asks Brian to pause public registration (for example by
`REP_APP_ENABLED` off, which makes `/join` and `/api/register` answer 404) from the final dry
run until the F5.4 reconcile is done, and to say in writing when it is paused and when it is
back. Without that word, BB2 stops and asks.

1. Read the source roster: the AED RGM tab, the Field Sales tab and the Equipment Sales tab.
2. Build the RGM list: the 30 AED RGM rows. Check each one's email equals, ignoring case,
   the `email` of the entry with the same name in `src/data/field.mjs`. If not 30, or any
   one differs, stop and report.
3. Build the FSC list: every Field Sales row whose manager email is one of the 30 RGM emails
   (with the Houston exception), plus every Field Sales row that `src/data/teams.mjs` puts
   under one of the 30 RGMs. The two must be the same 560 rows; if not, stop and report.
   Apply "Held out" above. Apply the question 6 name rule.
4. Read the Rep Roster, matching by `toLower` email. For each person in the RGM or FSC list:
   no row means a row to create; exactly one row, and it is conforming, means **accepted**
   (no new row, the existing row untouched, listed by row number as "already on the Rep
   Roster, conforming"); one row that is not conforming, or two or more rows, is a clash.
5. Read the Team Roster, matching Rep Email by `toLower`. For **each FSC in the list,
   accepted ones included**: no row means a new pair; exactly one row, with the same Manager
   Email and Active = Yes, means **already paired** (left as is); two or more rows for that
   FSC (Active or not), or one row with another Manager Email or Active = No, is a clash.
5a. Read the whole Rep Roster and the whole Team Roster (Rep Email and Manager Email) for
   every Equipment Sales tab email under the 30 RGMs. Any match is a clash (M25: no
   Equipment Specialist has a row).
6. Read the other team's roster, FSC Roster and Rep Roster keys inside the run only to check new keys
   against them in F5.3. Never write them out.
7. Write the dry run report: the counts read, to create (loaded), accepted (skipped), held out, already paired
   and new pairs, by team (table below), and every held-out, accepted and clash row by tab
   and row number with its reason. Counts must add up: RGM rows plus FSC rows plus
   Equipment Specialist rows read equals RGMs to create plus FSCs to create plus accepted
   (skipped) plus held out plus Equipment Specialists not loaded.
8. Any clash or any held-out row: stop and report. Otherwise send the report to Brian through
   the conductor and wait for G6.

### F5.2 What each new Rep Roster row holds

| Column | RGM row | FSC row | Where the rule comes from |
|---|---|---|---|
| Rep Name | The entry's `name` in `src/data/field.mjs` (first names as in the email, for example Dave, Jen, Mat) | First and last name as the source row spells it, with the question 6 rule applied | Conductor, 11/13 |
| Rep Email | The AED RGM row email, lowercased | The Field Sales row email, lowercased | 1J stores it lowercased; Team Roster matches with `toLower` |
| Role | `RM` | `FSC` | Spec section 9, F5 row |
| Referral Key | New, from F5.3 | New, from F5.3 | Spec section 3 |
| Services | `HealthFirst` | `HealthFirst` | Spec section 9: the key lookup requires it; the company switch, not Services, decides what a rep can send |
| Test | Yes | Yes | Spec section 9. Only Brian sets No, under "Going live" |
| Registered On | The load date | The load date | Spec check M25; My Team's "No referral yet" counts 14 days from it |
| Status | `Pending` | `Pending` | Same as a new 1J row (`docs/build/rep-app-flow-contracts.md`, 1J step 4). The first lookup with `activate` true sets Active |
| First Opened On | Blank | Blank | Same as 1J |
| Source | `Brian's roster` | `Brian's roster` | Decided 11/9: "Source is Brian's roster" |
| Manager Emails Sent | 0 | 0 | Same as 1J |
| Confirm Token | Blank | Blank | Same as 1J (D18) |
| Mobile | The cell on the source row, as `NNN-NNN-NNNN` | Same | "Held out" rule 2 (question 10) |
| Manager Name, Manager Email, Branch | Blank | Blank | Conductor, 11/13. The Team Roster alone decides the manager (D18) |

If a column the table leaves blank is required on the live list, stop and report.

### F5.3 Keys and the load run

1. Build the load as one manually started run (for example a flow named "HSBS F5 load",
   manual trigger only, no HTTP trigger, no email or Teams action), with Secure inputs and
   Secure outputs as rule 5 says.
2. For each person to create, make a new Referral Key the way the live 1J does (recorded
   under "BB2 records", item 4). It must be 24 to 128 URL-safe characters. Check it against
   every key on the other team's roster, FSC Roster and Rep Roster and against every key made earlier
   in the run; on a match, make another. A pilot FSC's FSC Roster key and an RGM's the other team's roster
   key are never reused or copied.
3. Create the Rep Roster rows from F5.2, RGMs first, then FSCs. For each person the dry run
   marked "to create", in this order:
   1. Look the email up on the Rep Roster (`toLower`).
   2. **Zero rows:** append `intended,Rep Roster,,<tab>,<row>,<Role>` to the batch file,
      then Create item, then append `created,Rep Roster,<new item ID>,<tab>,<row>,<Role>`.
   3. **Exactly one row, and it is conforming:** someone else made it since the dry run (for
      example a sign-up on `/join`). It is accepted, logged as accepted, and gets no batch
      line.
   4. **Two or more rows, or one row that is not conforming:** a clash. The run stops.
4. Concurrency 1 on the loop, so the uniqueness check and the create never race.
5. **Starting and resuming.** At its start the run looks for
   `/HSBS_BOT/build/F5_load_batch.csv`. If it is not there, this is the first run: it writes
   the file with the line `load date,<today>` and uses today as the load date. If it is
   there, this is a resumed run: it reads the load date from the first line and uses it for
   Registered On, never today's date, and appends to the same file. BB2 writes in the build
   report the date of each run and the load date it used.
6. **Resuming after a stop.** If any step fails, the run stops and BB2 reports. A resumed run
   uses the same dry run list and first settles every open line, then carries on with the
   people that have no line:
   - A person with `intended` and `created` lines is done: skipped, not counted again.
   - A person with an `intended` line and no `created` line stopped between the two
     appends. Look the email up on the Rep Roster. Zero rows: the create never happened, so
     do step 3.2's Create item and `created` append. Exactly one row with Source
     `Brian's roster` and Registered On equal to the batch's load date, and conforming:
     this load made it before the second append, so append its `created` line. Anything
     else: a clash, stop.
   - This is exact because a row is never created without an `intended` line written first,
     an accepted row never gets one, and a row someone else made carries another Source
     (1J writes QR, AE link, Thrive Signature link or Other) and its own Registered On.
   - Nothing is made twice, and the batch file stays the one record of the load.

### F5.4 Team Roster pairs

The Team Roster contract stands: Brian loads it and alone edits it
(`docs/build/rep-app-flow-contracts.md`, "Team Roster"; decision 40). **BB2 builds the pair file
and Brian imports it**, or tells BB2 in his own words to import it.

1. After F5.3, BB2 writes `/HSBS_BOT/build/F5_team_pairs.csv`: one line for each
   FSC in the list, **created and accepted alike**, that has no Team Roster row yet.

   | Column | Value |
   |---|---|
   | Rep Email | The FSC's email, lowercased |
   | Rep Name | As the source row spells it, with the question 6 rule applied |
   | Manager Email | The FSC's manager email, lowercased: one of the 30 RGM emails |
   | Active | Yes |
   | Updated On | The load date (from the batch file) |

2. No line for an RGM. An RGM's own manager is an Area Executive, and AEs are not loaded.
   Brian's daily gap check will list the 30 RGMs as having no Active Team Roster row; that
   is expected.
3. No line for an FSC already paired, and none for a held-out person.
4. The pair file is frozen once written: it is never regenerated, even if an import fails
   part way.
5. Brian imports the file.
6. **Reconcile, and resume it as often as needed.** BB2 runs a reconcile (Secure outputs on)
   for every line of the pair file: read the Team Roster for that Rep Email (`toLower`).
   - Exactly one row, with the same Manager Email, Active = Yes and Updated On equal to the
     load date: if the batch file has no `imported` line for it, append
     `imported,Team Roster,<item ID>,<tab>,<row>,FSC`, with the FSC's tab and row number
     from the dry run list.
   - Zero rows: not imported yet. BB2 writes those lines to
     `/HSBS_BOT/build/F5_team_pairs_remaining.csv` for Brian to import, then reconciles again.
   - Anything else: a clash, stop and report.
   The load is not complete, and the TEST checks do not start, until every pair file line
   has an `imported` line.
7. An existing Team Roster row is never changed (rule 8).

### F5.5 Left in place

- Every row on the other team's roster, the 30 RGM rows included. Each RGM's old link still opens the field
  app (spec section 3; check M9). They are retired only by a later sheet, after Brian says
  the new app is staying.
- Every FSC Roster row. A pilot FSC keeps the pilot link and also gets the new Rep Roster
  row (T20).
- Every Rep Roster and Team Roster row that existed before the load, accepted rows included.

## Expected counts by team

From `src/data/teams.mjs` (built from the source roster). "FSCs to load" is the people the
load covers on each team: each is either loaded (a row this load creates) or skipped (an
accepted existing row). A difference on any line is a stop.

| RGM (`field.mjs` slug) | FSCs on the source | FSCs to load | Equipment Specialists (not loaded) |
|---|---|---|---|
| harris-lieberman | 15 | 15 | 4 |
| nicole-galayda | 19 | 19 | 4 |
| heidi-sirney | 14 | 14 | 4 |
| todd-carter | 23 | 23 | 4 |
| ben-guinn | 23 | 23 | 5 |
| john-hyden | 9 | 9 | 3 |
| stefan-zollinger | 23 | 23 | 2 |
| nick-peterson | 15 | 15 | 2 |
| mat-hechler | 7 | 7 | 2 |
| mark-decker | 19 | 19 | 3 |
| nick-brownfield | 22 | 22 | 5 |
| sarah-baldelli | 19 | 19 | 5 |
| courtney-robinson | 28 | 28 | 5 |
| kevin-korengel | 24 | 24 | 6 |
| tarah-lamour | 18 | 18 | 3 |
| robert-hummer | 16 | 16 | 3 |
| zac-caffentzis | 21 | 21 | 4 |
| jen-mullen | 16 | 16 | 2 |
| julia-hunter | 13 | 13 | 3 |
| hetal-raythattha | 16 | 16 | 3 |
| kevin-crawford | 17 | 17 | 5 |
| monica-kostorowski | 21 | 21 | 3 |
| lauren-welsh | 17 | 17 | 4 |
| dave-dressel | 16 | 16 | 4 |
| christian-fehling | 21 | 21 | 3 |
| mark-sutherland | 21 | 21 | 5 |
| brad-fine | 26 | 26 | 5 |
| daniele-pace | 16 | 16 | 2 |
| greg-kovach | 23 | 23 | 6 |
| nelson-wyllie | 22 | 22 | 0 |
| **Total** | **560** | **560** | **109** |

Rows read: 30 RGMs, 560 FSCs and 109 Equipment Specialists, 699 in all. **An accepted row is
counted as skipped, not loaded** (M25: "the counts in, loaded, held out and skipped add up
to the source total"). So: loaded (rows this load created) plus skipped (accepted rows)
equals 590, the people covered; plus 0 held out; plus 109 Equipment Specialists not loaded,
also counted as skipped, makes 699. Today the expected skipped count among the 590 is
whatever the dry run finds; it is reported, not assumed. On the Rep Roster after the load:
590 rows for these people (30 `RM` and 560 `FSC`), one each. On the Team Roster: 560 Active
pairs, new plus already paired.

## What must not change

- No flow but 1R (step R, and only if needed), and no flow setting but the gap check pause.
  No Vercel setting, except `REFERRAL_FLOW_URL` under step R's one alternative, by Brian.
  `REP_APP_ENABLED`, `REP_PAY_ENABLED` and `REP_APP_COMPANIES` are Brian's switches; BB2
  never touches them. Brian may turn `REP_APP_ENABLED` off himself under stop item S5 or a
  rollback.
- No email to anyone, during or after the load. No welcome goes out. A welcome or link
  email to loaded people is a later step that needs Brian's go.
- the other team's roster, FSC Roster, Referrals, Service Cases and the SPIFF Ledger: no row added,
  changed or deleted by the load.
- No loaded person is set to Test = No by BB2. Brian does that, under "Going live".

Note for Brian, not a change: once the pairs are Active, 1R's lookup reports `isManager`
true for each RGM on every one of their links, the old the other team's roster link included, because
manager status comes only from the Team Roster on every role (D18). With `REP_APP_ENABLED`
off nothing shows. With it on, an RGM's old field app link shows the live My Team, as
Harris's does today.

## TEST checks (each is pass or fail)

Checks 1 to 9 read only, after the load. None calls 1R with `activate` true, which would
stamp First Opened On and set a person Active. None sends anything. Check 10 runs before
check 11, and on a different RGM.

1. **Every loaded row is on test** (M27, its post-load line). Every Rep Roster row in the
   batch file has Test = Yes. Every skipped (accepted) row has Test = Yes too, since only a
   conforming row is accepted.
2. **Counts match the roster** (M25). The Rep Roster holds exactly one row for each of the 30
   RGMs (Role `RM`) and one for each of the 560 FSCs (Role `FSC`), matched by email: 590
   rows. Loaded (`created` lines in the batch file) plus skipped (accepted) equals 590, and
   the per-team counts equal the "FSCs to load" column above. Loaded, skipped (accepted and
   Equipment Specialists) and held out (0) add up to the source total (699).
3. **Nobody is held out and nothing clashed** (M25). The report lists no held-out row and no
   clash. If Brian ever approved a hold-out, each held-out row number is in the output with
   its reason and has no row from this load.
4. **No Equipment Specialist and no AE** (M25, T15, decision 48). No Equipment Sales tab
   email has any row on the Rep Roster or the Team Roster, in the batch or not. No row in the batch has Role
   `AE`.
5. **Every pair resolves** (M25). Every one of the 560 FSCs, created or accepted, has
   exactly one Active Team Roster row. Its Manager Email equals, by `toLower`, the Rep Email
   of a Rep Roster row with Role `RM` for one of the 30, and that RGM is the FSC's RGM on the
   source roster (the Houston 7 to the `field.mjs` email). No Active Team Roster row in the
   batch names a manager outside the 30. No RGM has a Team Roster row from the batch.
6. **Keys are unique** (M25). No two rows on the other team's roster, FSC Roster and Rep Roster
   together share a Referral Key. Every new key is 24 to 128 URL-safe characters. (Run in a
   flow with Secure outputs on; the report says only pass or fail and the count.)
7. **Services and Registered On** (M25, with its Registered On assertion). M25's "every
   loaded row" is every Rep Roster row this load created, the `created,Rep Roster` lines
   (Team Roster `imported` lines are checked in check 5, not here). Every such row has
   Services `HealthFirst`, and Registered On equal to the load date; one with Registered On
   blank or a different date fails. Every such row has Status
   `Pending`, First Opened On blank and Source `Brian's roster`, except the one link opened
   in check 11. A skipped (accepted) row is not a loaded row: it keeps its own Registered On
   and is not checked for it, and it is counted under skipped in check 2.
8. **Nothing else changed.** The other team's roster and FSC Roster have the same row count as before
   the load, and no item on either has a Modified time after the load started. The Rep
   Roster and Team Roster rows that existed before the load, accepted rows included, have
   the same Modified time as before.
9. **Nothing was sent or written.** The gap check flow had no run between the times BB2
   turned it off and on ("The gap check pause"). Every run of a flow listed under G4 or G5 that the load
   or the import started sent nothing and wrote nothing: in its run history no send action
   (email, Teams, HTTP) and no create, update or delete action succeeded. A run that started
   and ended without one, as G5 allows, passes. The load run has no email or Teams action.
10. **M9.** Pick an RGM whose new Rep Roster row has Status `Pending` and First Opened On
    blank, and who is not the person Brian names for check 11. On a site build with
    `REP_APP_ENABLED` off (a preview Brian sets, run by Brian or Claude; BB2 changes no
    Vercel setting): that RGM's new key answers "This link does not work", and the RGM's old
    link opens the field app exactly as on `main`. Afterwards that row still has Status
    `Pending` and First Opened On blank (the site sends `activate` false while the switch is
    off).
11. **One loaded link opens the app** (M25). Run only after check 10. One loaded link, the
    one Brian names, is opened with `REP_APP_ENABLED` on, and the rep app opens with the name
    on its row. Opening it stamps First Opened On and sets that person Active; that is
    expected for this one row. Until Brian names someone, this check stays open and is not
    run (conductor, 11/13).
12. **No secrets.** The build report, the dry run report and the batch file contain no key,
    no flow URL, no email address and no phone number. The run history of the load run and
    every check run shows no contact data (rule 5).
13. **No order break** (decision 83). The go-live order check under "Going live" lists
    nobody: every row is still Test = Yes.

## Going live (Brian, after the load; not part of the load)

A person goes live only when Brian sets their Test value to No (spec section 9). Go-live runs
top down (decision 83; spec section 6, "Ledger"): **a manager goes live before or with their
team, never after**, so a live rep always has a live manager.

1. Brian goes live one team at a time. For each team: first the RGM's Rep Roster row, Test =
   No. Then, in the same sitting or later, any of that RGM's FSCs.
2. An FSC's row may be set to No only when the Rep Roster row whose Rep Email is the Manager
   Email on that FSC's Active Team Roster row already has Test = No. An FSC with no Active
   Team Roster row is not set live.
3. **The order check.** BB2 builds it as part of this sheet, before check 13, as a read-only
   query (a SharePoint view or a run with Secure outputs on). It sends nothing. It lists, by
   Rep Roster item ID, every Rep Roster row with Role `FSC` and Test = No where any of these
   is true:
   - it has no Active Team Roster row (Rep Email by `toLower`);
   - it has two or more Active Team Roster rows;
   - its Active row's Manager Email matches no Rep Roster row;
   - the Rep Roster row its Active row names as manager has Test = Yes.

   Brian runs it before and after each go-live sitting. It must list nobody. If it lists
   anyone, Brian sets that FSC back to Test = Yes, or fixes the pair or sets the manager
   live, before he goes on.
4. Setting an RGM back to Test = Yes while any FSC on their team is Test = No breaks the
   order. Brian sets the team's FSCs back first.
5. If the order is ever broken anyway, the spec's backstop applies: the manager's award row
   on that referral is a Test row, out of real batches and on Brian's exceptions (M27
   staged go-live checks this on TEST rows). The order check is what keeps it from
   happening.

## Rollback (deletes by load batch)

Only Brian starts a rollback. Every step below checks first and changes after.

0. **Record only writes that may already have happened. Never create or import anything to
   finish the load.** If the load was not complete:
   - For each `intended` line with no `created` line: look the email up on the Rep Roster.
     Exactly one row with Source `Brian's roster`, Registered On equal to the load date and
     conforming: append its `created` line (this load made it). Zero rows: append
     `abandoned,Rep Roster,,<tab>,<row>,<Role>` and do nothing else. Anything else: stop and
     ask Brian.
   - For each pair file line with no `imported` line: look the Rep Email up on the Team
     Roster. Exactly one row with the same Manager Email, Active = Yes and Updated On equal
     to the load date: append its `imported` line. Zero rows: nothing was imported for it;
     leave it. Anything else: stop and ask Brian.
   - People with no line at all were never touched and are left alone. The remaining file
     is not imported.
1. **Check every Rep Roster batch row first, before changing anything.** A row passes the
   first check when it has Test = Yes, Source `Brian's roster` and Registered On the load
   date. Write each row's Status as it is now to the build report (by item ID). A row with
   Test = No: stop and ask Brian, that person may be live.
2. **Turn the keys off before the referral check, so no submit can land between the check
   and the delete.** BB2 sets Status = `Disabled` on every row that passed step 1. With
   Disabled, 1R answers 404 to a lookup and refuses a Rep submit, writing nothing
   (`docs/build/rep-app-flow-contracts.md`, "HSBS 1R for Rep keys": "If `referrerRole` is `Rep` but
   the key is not on the Rep Roster (or is Disabled), answer 4xx and write nothing"). BB2
   confirms it: (a) the live 1R's Rep submit branch refuses a Disabled key (read only, named
   in the build report); (b) every one of those rows reads back as Disabled; (c) 1R's run
   history shows no run still in progress that started before the last Disabled write. If
   (a) is not so, BB2 stops and asks Brian to turn `REP_APP_ENABLED` off in Production
   instead; Brian does it and tells BB2 in writing, and BB2 waits for that before step 3.
3. **Referral check.** A row is refused when any Referrals row has a Referring Rep Email
   equal, by `toLower`, to its Rep Email. BB2 sets each refused row's Status back to the
   value recorded in step 1, and stops to ask Brian about it. The others pass.
4. **Rep Roster:** delete each row that passed step 3. Record each deletion that succeeded. A
   refused row, or a deletion that failed, is left in place (a failed one stays Disabled)
   and reported.
5. **Team Roster, only after step 4:** for each `imported` Team Roster row whose Rep Email
   belongs to a Rep Roster row deleted in step 4, Brian sets Active = No and Updated On to
   the rollback date (or tells BB2 to). The contract says "Brian sets No instead of deleting
   a row". A pair whose Rep Roster row was refused or not deleted keeps Active = Yes. A pair
   the batch added for an accepted FSC keeps Active = Yes and is listed for Brian, since
   that person's Rep Roster row was never part of the batch.
6. Nothing else is touched: rows that existed before the load, the other team's roster, the FSC
   Roster, Referrals, Service Cases and the ledger.
7. Check: no Rep Roster item deleted in step 4 exists; every Team Roster row set No in step
   5 has Active = No; every refused or accepted person still has their Rep Roster row, with
   the Status it had before the rollback, and every refused or accepted FSC still has an
   Active pair (an RGM has no pair, so an accepted RGM keeps only its Rep Roster row); the other team's roster and FSC Roster
   are as before; every RGM's old link still opens the field app. Then "The gap check
   pause" step 4.
8. **Stop item S4.** If any deletion in step 4 failed, do not rename anything: retry each
   failed deletion; if one still fails, stop and ask Brian, and keep the batch file as it
   is. Only when no deletion failed, rename the batch file and the pair files to end in
   `_rolled_back_<rollback date>.csv`, so a later load starts as a first run with its own
   load date (F5.3 step 5).
9. Roll back step R (1R) only after this rollback, as "R: rollback" says. If Brian turned
   `REP_APP_ENABLED` off in step 2, he decides when it goes back on.

## Settled 11/13 (conductor, from the review of the first draft)

| # | Question | Answer written into the sheet |
|---|---|---|
| 1 | Does M27 replace decision 67's practice hold? | Yes. The approved spec (decision 74, after 67) makes a Test rep's referral a TEST row that sends nothing live, and M27 checks it. Gates, note under the table |
| 2 | Load before M27's ledger parts? | No. F5 waits for F4; M27's ledger parts run once F4 is built. G1 |
| 3 | Question 5 (Houston RGM's email) | Answered by `src/data/field.mjs`; his 7 FSCs load. "Who is loaded" |
| 4 | Who writes the Team Roster pairs | BB2 builds the pair file, Brian imports it or tells BB2 to. F5.4 |
| 5 | Columns the spec does not set | RGM Rep Name from `field.mjs`; Mobile per question 10's default; Manager Name, Manager Email and Branch blank. F5.2 |
| 6 | Which link M25 opens | None until Brian names one. Check 11 |
| 7 | Team Roster on rollback | Active = No. Rollback step 5 |
| 8 | A Load Batch column | No; the batch file is the batch. "Words used" |
| | Question 6 (names with a parenthesis) | Decided: load with the parenthetical dropped. "Who is loaded" |
| | Area Executives | None in the first load (decision 48, part) |
| | Go-live order | Top down (decision 83). "Going live" |
| | 1R missing the Test rule | Repaired in this sheet, as the spec's F5 row says. Step R |

## Spec clause to sheet step

| Spec clause (section 9, F5 row, unless named) | Sheet step or check |
|---|---|
| Rep Roster rows, each with a new key | F5.2, F5.3; check 6 |
| Role `RM` for each RGM, `FSC` for each FSC; never "RGM" or "Field Sales Consultant" | "Who is loaded", F5.2; check 2 |
| The 30 RGMs and every FSC on their teams, pilot FSCs included (T20) | "Who is loaded", F5.1 steps 2 and 3, F5.5; check 2 |
| No Equipment Specialist (T15) | "Who is loaded"; check 4 |
| No AE (decision 48) | "Who is loaded"; check 4 |
| Held out: no email, or an open display name question (questions 5 and 6, both settled) | "Who is loaded", "Held out"; F5.1; check 3 |
| Team Roster pairs matched by email | "Words used", F5.4; check 5 |
| Test = Yes and Services `HealthFirst` on every row | F5.2; checks 1 and 7 |
| Registered On set to the load date (M25) | F5.2; check 7 |
| A Test rep's referral is a TEST row; 1R writes Test = Yes on Referrals and the Service Case | G3; step R |
| Every flow that emails a referring rep, 3F and 7B included, skips a Test row | G4 |
| BB2 confirms this from the live 1R and adds it if it is missing | G3; step R and its checks R1 to R5 and rollback |
| A person goes live only when Brian sets Test = No | "Going live"; check 1 |
| Section 6: go-live runs top down (decision 83) | "Going live"; check 13 |
| No field person loaded until M27 passes and AGENTS rule 19 is reworded (T19) | G1, G2 |
| Existing rows on the other team's roster (RGMs) and FSC Roster rows (pilot FSCs) left in place | F5.5; check 8 |
| Section 3: switching off must restore today | Check 10 (M9) |
| Section 3: 1R finds a person by key, so links do not collide | F5.3 step 2; check 6 |
| Section 13: releasing a manager's Test row after go-live (M27) | G1; "Going live" step 5 |
| M25 | Checks 2 to 7 and 11 |
| M27 | G1 and check 1 |
| M9 | Check 10 |
