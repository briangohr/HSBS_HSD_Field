# Field two-track app: what remains after launch (BB2 start v2)

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and names in code quotes are live SharePoint and flow names.

Builder: BB2. Written 11/15/2026 by Claude for BB2 and Brian.
Status: draft for Brian's approval. Nothing here starts before launch runbook
(`docs/build/field-two-track-go-live.md`) steps 1 to 7 are done and Brian says the launch is done.
Runbook step 8, "People go live" (the roster load and sign-up), is carried out here: R3, R4
and R7. Runbook step 9 (the TEST clean-up) may run before R0, and R0 records whether it did.

This file puts every piece still to build after launch in one order. For each step it names
the sheet that governs, what must be true before the step starts, what "done" means, and what
to report. **The named sheet is the instruction.** This file never overrides a sheet. If the
two disagree, stop and ask Brian.

Scope: the TSM (Team Schein Member) field app for RGMs, FSCs and AEs, HealthFirst and Direct
Dental. The other team's path and the pilot FSC app are not in scope.

## Rules for all work

These are BB2 start v1's rules, still in force, plus the Microsoft Learn rule.

1. **Copies first.** Before you change a live flow, Save As a dated backup and turn the backup
   Off. Brian gives the go before any live change.
2. **TEST rows only.** Put TEST in the doctor's or practice name on every test row.
3. **Every test email goes to Brian only.** Add no recipients.
4. **Never paste a flow URL, Referral Key, Link Key or token** anywhere: chat, reports,
   Dropbox, email, run notes. Brian copies keys and URLs himself.
5. **Pick SharePoint columns from the dynamic content list.** Never type internal names from
   memory.
6. **Every flow name starts with "HSBS"**, so the reliability notice catches failed runs.
7. **Leave the website repo, Vercel and Salesforce untouched.**
8. **Microsoft Learn first.** Before you build a step, check its setting in the table in
   `docs/claude-code/MS-LEARN-REFERENCES.md`. Open Learn only for a setting the table does not
   cover, and name the page in your report.
9. **Ask BB1 first** before touching a flow BB1 owns: HSBS 1W, 2, 2B, 3, and 1J with its
   welcome sender.
10. **Stop and ask Brian** when a step does not match what you see. Every stop item in a sheet
    is a hard stop.
11. **After each step, send Brian the four-part report** (end of this file).

## Where things stand at launch

| Piece | State at launch | Step here |
|---|---|---|
| HSBS 1F Field app | Test copy, live at launch (runbook step 1 onward) | None |
| HSBS 3F Field copy, HealthFirst path | Test copy, live at launch | None |
| Field 7A and 7B copies | In the launch (decision 135) | None |
| HSBS Field gap check (sheet GC) | New launch piece (decision 132) | None |
| HSBS 1J sign-up and its welcome sender | Not recorded in the repo | R0 |
| Pay flows HSBS 10, 10S, 10D, 10M (10M replaces 10B and 10P, 11/22/2026) | 10, 10S, 10D live; 10M see the pay sheet 10M build record | R1a, R1b |
| Company on ledger rows in 1F (F6.4) | Not built | R2 |
| Roster load, 590 rows | Not built | R3 |
| Link delivery to loaded people | No sheet until now | R4 |
| 3F staffing branch | Not built | R5 |
| Send-on for hand backs (F7 Part D) | Not built; S8 open | R6 |
| Brian's switches and per-person go-live | Off | R7 |
| AEs | Not in the first load (decision 48) | R8 |

The launch pieces belong to the runbook and to PR #164. This file starts after runbook step 7.

## The steps, in order

| Step | What | Sheet | Starts when | Done when |
|---|---|---|---|---|
| R0 | Status read, read only | This file | Runbook steps 1 to 7 done, Brian says launch is done | The R0 table is filled in |
| R1a | Pay flows: build and first checks | F4 `docs/build/field-two-track-pay-sheet.md` | R0 reported | F4 build order steps 1 to 5 done; groups A, H, G and S pass except the checks R1b holds |
| R2 | Company on ledger rows in 1F | F6, item F6.4, `docs/build/field-two-track-flow-contracts.md` | R1a done (the Company column exists) | F6.4 checks pass |
| R3 | Roster load | F5 `docs/build/field-two-track-roster-load.md` | R1a done (F5's "F4 built" gate), M27 passes | Dry run clean, load checks pass, 590 rows on test |
| R4 | Link delivery | LD `docs/build/field-two-track-link-delivery.md` | R3 done, R0 shows the welcome sender passing, Brian's answers on LD's decisions | LD checks pass on one TEST team |
| R5 | 3F staffing branch | F3 `docs/build/field-two-track-staffing-intro.md` | R0 reported | F3 checks pass and Matt Penny's address is on the "Rep app staffing" Routing row |
| R6 | Send-on for hand backs | F7 `docs/build/field-two-track-send-on.md` | Brian answers S8; R5 done for the staffing leg | F7 Part D checks pass, including M22 |
| R1b | Pay flows: the held checks | F4 | R5 and R6 done | S11 and every other held check pass, so groups A, H, G and S have all passed |
| R7 | Switches and go-lives | F2, F4, F5 and the runbook | The step each switch depends on is done | Brian's, one at a time |
| R8 | AEs | F5, run again for AEs | Brian names the AEs and their managers (decision 48) | AE rows loaded on test and paired |

R1a to R4 are one chain: the roster load waits for the pay flows to be built (F5 gate), and
link delivery waits for the load. R5 does not depend on that chain. BB2 may start R5 while
waiting on a Brian answer in R1a to R4, but runs only one step's builds at a time. R1b closes
the pay checks once R5 and R6 exist, and Ledger live in R7 waits for R1b.

## R0: status read (read only)

Change nothing. Turn nothing on or off. For each item, record what you see. Report it to
Brian as the R0 table. Steps R1a, R4 and R5 read this table before they start.

| Item | Record |
|---|---|
| HSBS 1J (the live one, and any copy) | Exists? On or Off? Date of the last run. Does it still contain a Send an email action? |
| HSBS 1J welcome sender | Exists? On or Off? Last run. TestMode value |
| HSBS 1J welcome alarm | Exists? On or Off? |
| Link Resends list | Has the columns Kind, Send Status, Send Tries and Send Note? How many rows are Pending? |
| Rep Roster | Has the column Welcome Sent On? |
| HSBS Daily gap check (TEST) | On or Off? Does it include the welcome lines (addendum v2.1, step 9)? |
| SPIFF Ledger | Any rows left from Sunday's seeded TEST check (decision 120 says delete them)? Any row with Status Paid or Pending review? |
| Pay switches | Is there a Ledger Settings list yet? If so, its three values |

The welcome sender design is BB1's sheet 1 addendum v2.1
(`/HSBS_BOT/build/2026-11-09_BB1_Build_Sheet_1_Addendum_Welcome_Sender_v2.1.md`). R0 only
records whether it was built. R4 says what happens if it was not.

## R1a: pay flows, build and first checks

- **Sheet:** F4, `docs/build/field-two-track-pay-sheet.md`. Build order steps 1 to 5, as written.
- **Before you start:** F4's stop rules S0 to S7. S0 is met (PR #121 is merged). If R0 found
  Sunday's seeded TEST rows still on the SPIFF Ledger, stop (S2) and ask Brian to delete them.
- **Switches:** LedgerTestOnly stays Yes and RealPayoutsOn stays No for all of R1a and R1b.
  StaffingAwardsOn is No except for F4 build order step 5's TEST cycle: with LedgerTestOnly
  still Yes, BB2 sets it Yes, runs group S, and sets it back to No (checks A3a and G1a). Only
  TEST cases can be written during that cycle. Turning staffing awards on for real is F4.9,
  in R7.
- **Before the step 5 cycle:** the field 7B copy must stamp Award Practice Type only from the
  partner's confirmation (decision 82; the site side, #136, is merged). Check it does first.
- **Held for R1b:** S11 (the pay part of M22) needs a lead handed back and sent on through F7,
  which is R6, and its staffing leg needs the 3F staffing branch, which is R5. Any other check
  that needs a case only R5 or R6 can make is held the same way. List each held check by
  number in the R1a report.
- **Done when:** build order steps 1 to 5 are done, and every check in groups A, H, G and S
  passes except the held ones. Report each check by its number.

## R1b: pay flows, the held checks

- **Starts when:** R5 and R6 are done.
- **Switches:** as in R1a. A held group S check runs inside another step 5 TEST cycle
  (StaffingAwardsOn Yes, then back to No), with LedgerTestOnly still Yes.
- **Done when:** every held check passes, so groups A, H, G and S have all passed. That is one
  of the conditions for Ledger live in R7.

## R2: Company on ledger rows in 1F

- **Sheet:** F6, item F6.4, in `docs/build/field-two-track-flow-contracts.md`.
- **Before you start:** the SPIFF Ledger's Company column from R1a exists.
- **Where:** in HSBS 1F only. Make a dated backup of 1F first. 1F is live after launch, so
  this change needs Brian's go before it is saved to the live flow.
- **Done when:** the F6.4 checks pass, and one TEST lookup, submit and list through 1F answer
  as before (no regression).

## R3: roster load

- **Sheet:** F5, `docs/build/field-two-track-roster-load.md`. Dry run first (F5.1), then the load
  (F5.3, F5.4), then its TEST checks.
- **Before you start:** F5's gates. F4 built (R1a), check M27 passes, rule 19 reworded (done).
  Gate G5: no flow sends mail or writes anything when a Rep Roster or Team Roster row is
  created or changed. The welcome sender reads Link Resends, not the rosters, so it does not
  break G5. Record that in the report.
- **Held out:** anyone with no email on the roster, and anyone whose display name is still an
  open question. Equipment Specialists and AEs are not loaded.
- **No email.** The load sends nothing to anyone. Links go out only in R4.
- **Done when:** the dry run is clean, every F5 check passes, and 590 rows are on test.

## R4: link delivery

- **Sheet:** LD, `docs/build/field-two-track-link-delivery.md` (new, written with this file).
- **Before you start:** R3 done. R0 shows the welcome sender built and its tests 1 to 9
  passed. Brian has answered LD's decisions (the welcome words, the mailbox, and the resend
  order for people on two rosters).
- **If R0 found no welcome sender:** stop. Building it is BB1's addendum v2.1. Ask BB1, then
  Brian, who builds it. LD does not build a second sender.
- **Done when:** LD's checks pass on one TEST team. Real welcomes go out only as part of R7,
  one team at a time.

## R5: 3F staffing branch

- **Sheet:** F3, `docs/build/field-two-track-staffing-intro.md` (Part B, the staffing branch), on
  the 3F Field copy.
- **Before you start:** F3's prerequisites and stop items. S1, S3, S4 and S5 are decided
  (decisions 100, 103, 112 and 101). Brian types Matt Penny's address into the
  "Rep app staffing" Routing row himself. BB2 never types it and never reads it out.
- **Staffing stays off in the app.** `REP_APP_COMPANIES` stays HealthFirst only until Brian
  switches it in R7.
- **Done when:** the F3 checks pass on TEST rows, and a TEST HealthFirst row through the same
  copy still behaves as on launch day.

## R6: send-on for hand backs

- **Sheet:** F7, `docs/build/field-two-track-send-on.md`, Part D and its checks.
- **Before you start:** Brian answers stop item S8: where hand backs are listed for him. The
  field gap check from #164 (sheet GC) lists leads with no intro. It does not list hand backs,
  so S8 is still open.
- **The staffing leg** of check M22 runs only after R5 is done.
- **Done when:** the Part D checks pass, M22 included.

## R7: switches and go-lives (Brian's, one at a time)

Each line is Brian's go in chat, in a sitting of its own. BB2 does the flow side when the line
says so. Nothing here is batched.

| Switch | What it does | Starts when | Order rule |
|---|---|---|---|
| Ledger live: `LedgerTestOnly` false (F4 build order step 6) | HSBS 10 handles real cases, not only TEST ones | R1b done, and F4 step 6's conditions: groups A, H, G and S passed, `REP_PAY_PLAN` matches HSBS 10 (or Brian accepts the mismatch), no ledger row with Test = No | Before the first person goes live, so their cases are handled. Before `StaffingAwardsOn` (F4.9 gate G2) |
| Pay on screens: `REP_PAY_ENABLED` | Dollar amounts show on Track, Earnings and My Team | Ledger live | Brian's go |
| Qualify question: `PARTNER_QUALIFY_ENABLED`, then `EnforceQualify` | The partner page asks "Does this lead qualify?", then 7B refuses a sign without it | Brian's go (decision 96) | F2's order. The site switch and EnforceQualify go on in the same sitting |
| Staffing in the app: `REP_APP_COMPANIES` = `HealthFirst,Staffing` | Direct Dental shows on the Send tab | R5 done | Claude recommends after the qualify question: without it no staffing lead can be marked qualified, so none can earn. Brian's call |
| `StaffingAwardsOn` | HSBS 10 writes staffing awards | Ledger live, and the 7B confirmation check in R1a passed | F4.9, with its gates G1 to G6 |
| `RealPayoutsOn` (F4 build order step 6a) | Real payout batches can be sent and marked Paid | Ledger live, and Brian has named the HealthFirst payout contact or accepted the default | A separate go from Ledger live. Each batch is still Brian's go |
| Test = No, per person | A person goes live | R3 done and Ledger live | F5 "Going live": the manager first, the order check before and after each sitting |
| Welcomes, per team | That team gets their links | The team is live | LD: managers first, one team per run |

## R8: AEs

When Brian names which AEs get the app and who manages each one (decision 48), run F5 again for
AE rows only: the same dry run, keys, Team Roster pairs and checks, Role `AE`. Until then an AE
gets a link only by QR sign-up at `/join`.

## Brian's decisions, in the order they block

Claude asks these one at a time, and only when the step that needs the answer is next.

1. **Welcome words for pre-loaded people, and the mailbox they come from** (decision 9, and the
   rep app spec's open item 1). Blocks R4.
2. **Resend order for people on two rosters.** An RGM on the `PVA Roster`, or a pilot FSC on the
   FSC Roster, who signs up at `/join` gets their old link resent, because the resend reads the
   `PVA Roster` and the FSC Roster first. LD has the choices. Blocks R4 for those people.
3. **S8: where hand backs are listed.** Blocks R6.
4. **Which AEs, and their managers** (decision 48). Blocks R8.

One more thing for Brian, not a decision: decision numbers now collide. PR #164 records 134,
135 and 136 as decided, while `DECISIONS.md` on `main` lists 134 to 137 as open CI questions.
The two should be renumbered before #164 merges.

## Report after each step

Four short parts. No URLs, keys or tokens.

1. **Built:** lists, columns, rows and flows, by name.
2. **Tests:** n of n PASS. For each FAIL, what you saw.
3. **Different from the sheet:** anything in SharePoint or Power Automate that did not match,
   and what you did.
4. **Questions for Brian.**

## What this file does not change

- No sheet. Each step points to its sheet, and the sheet governs.
- The launch runbook and PR #164's launch pieces.
- `docs/claude-code/BB2-BUILD-LIST.md`. It gets a pointer to this file after #164 merges, so
  the two PRs do not edit the same lines.
