# Field 7A and 7B copies: deal value and pipeline stages (sheet DV)

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and the other team's exact list and column names are only in the old repo's copy.

Builder: BB3, on the HSBS 7A Field copy and the HSBS 7B Field copy. Written 11/17/2026 by
Claude for BB3, from Brian's answers of 11/17 (decisions 158 to 160, `DECISIONS.md`).

This repo never edits a flow. BB3 builds this in Power Automate, on the copies, with TEST rows
only. Nothing in this sheet goes live until Brian says go in chat, one step at a time.

## Why

No partner could log a deal value or move a stage last week. Two things block it:

1. The site switches `PARTNER_DEAL_VALUE_ENABLED` and `PARTNER_STAGES_ENABLED` are set on no
   Vercel environment (read 11/17). The partner page shows no deal value field and no next
   step date, and the save body carries none of the keys.
2. The partner flows would drop them anyway. Today's FSC 7B, which the field 7B copy is built
   from, never writes Stage, Status or Pipeline Stage (desk report 008; sheet F2, "F2 at
   launch"). No doc on `main` records it writing Deal Value Year 1.

Brian's answers:

- **158:** keep Closed On. It is the close date Power BI reads, and no later save moves it.
- **159:** partner referrals follow the /join rollout path: one launch order for every partner
  and every sender (FSC, AE, RGM and the rest), flows first, then one switch.
- **160:** build deal value and stages into the field 7A and 7B copies, then move the partner
  page to them and turn the two switches on in one sitting. Today's 7A and 7B are not changed.

## Scope

- **Every case the copies serve.** After go-live runbook step 7 the copies carry every
  partner's page: other-team cases, `FSC app` and `Rep app` cases. Deal value and stages apply to
  all of them (decision 159). This sheet has no Source branch.
- **This changes one launch rule.** "F2 at launch", L6 says Pipeline Stage stays unwritten.
  This sheet makes the 7B copy write Pipeline Stage by the stage rule below. Stage and Status
  stay unwritten, as L6 says. It also extends L2's Closed On to every case (DV2).
- The save body and its rules are already written. They are in `docs/fsc-flow-contracts.md`,
  "Deal value" and "Pipeline stage and next step", and in `docs/partner-status-flow.md`,
  "Deal value". This sheet does not restate them differently. If a line here and those
  sections ever differ, those sections win and BB3 stops and asks.

## Before you build (read only, record each in the build report)

- **DV-0a. The Service Cases columns.** For each column below, record whether it exists, its
  internal name and its type:

  | Column | Type the contract names |
  |---|---|
  | Deal Value Year 1 | Currency, 0 decimal places, US dollars, not required, no default |
  | Deal Value Year 1 Updated | Date and Time |
  | Deal Value Type | Choice: `Set amount`, `Estimate`. Not required, no default |
  | Pipeline Stage | Choice: `Received`, `Introduced`, `Attempting contact`, `Connected`, `Meeting set`, `Proposal sent`, `Won`, `Lost`, `Handed back` |
  | Stage Entered On | Date |
  | First Attempt On, Connected On, Meeting Set On, Proposal Sent On, Closed On | Date |
  | Next Step Date | Date |
  | Attempts | Number |

  A missing column: add it exactly as the table says, before the first TEST check, and record
  what you added. Nothing reads a new blank column until the copies are on, so adding one
  changes no behavior. A column that exists with another type or other choices: stop and ask
  on the desk. Do not change it.
- **DV-0b. Pipeline Stage on open cases.** Count the open, non-test cases whose Pipeline
  Stage is blank, and the ones whose value is not one of the nine choices. A blank is fine:
  the first save with an answer writes the stage (stage rule, step 2 below). An unknown value
  goes to the desk before you build.
- **DV-0c.** Confirm the field 7B copy still has no trigger concurrency (decision 136), and
  that its 200 Response still runs after the update loop. This sheet must not change either.

## The change

### DV1. 7B copy: deal value

On each update, apply `DealValue` and `DealValueType` exactly as `docs/fsc-flow-contracts.md`,
"Deal value" says:

1. `DealValue` is 1 to 9 digits: write Deal Value Year 1 and set Deal Value Year 1 Updated to
   now, in the same Update item as the rest of the save. Add `Year 1 deal value $<amount>`
   to the Status Log line, and `(<type>)` after it when `DealValueType` is sent.
2. `DealValueType` is `Set amount` or `Estimate`: write Deal Value Type in the same Update
   item.
3. `""` or missing: leave the column as it is. Anything that is not digits: write neither
   deal value column, and save the rest of the update. Never refuse a save for deal value.
4. A Signed save with both keys `""` (a page loaded before the switch) saves as today.

### DV2. 7B copy: pipeline stage

On each update, apply `StageFromAnswers` by the stage rule in `docs/fsc-flow-contracts.md`,
"Pipeline stage and next step" (the site's copy of the rule is `nextPipelineStage` in
`src/lib/pipeline-stage.mjs`):

1. The stored stage is `Won`, `Lost` or `Handed back`: do not change it.
2. `StageFromAnswers` is `""` or missing: do not change it.
3. `StageFromAnswers` is `Won`, `Lost` or `Handed back`: write it.
4. The stored stage is blank: write `StageFromAnswers`.
5. Otherwise write it only when it is later in the list than the stored stage.

When the stage changes: set Stage Entered On to the Eastern save date, and add a Status Log
line `<date> Stage: <old> to <new>` (`blank` for an empty old stage). Then set the first-time
column for the new stage, only when that column is empty:

| New stage | Column | Value |
|---|---|---|
| Attempting contact | First Attempt On | `TalkedOn` |
| Connected | Connected On | `TalkedOn` |
| Meeting set | Meeting Set On | the save date |
| Proposal sent | Proposal Sent On | the save date |

**Closed On, on every close, whatever the stage keys.** Closed On does not wait for a stage
change. On any save that closes the case (Stand `Signed`, `Not moving forward` or `Hand back
to HSBS`, or old `choice` `won`, `lost` or `decline`), when Closed On is blank, write it in
the same Update item: `SignedDate` on a sign when it is sent, otherwise the Eastern save
date. A save with no `StageFromAnswers` (switches off, an old page, or a rollback) still
writes it. Once it holds a value, no save writes it again. This keeps "F2 at launch", L2 for
field cases and extends it to every case, with one change: a sign uses `SignedDate` (Claude,
under 139; decision 158 keeps the column).

Attempts: add 1 on every save whose `TalkedToDoctor` is `Not yet, still trying`.

### DV3. 7B copy: next step date

`NextStepDate` is `YYYY-MM-DD`: write Next Step Date. `""` or missing: leave it. On any save
that closes the case (Signed, Not moving forward, Hand back), clear Next Step Date.

Next Update Due keeps today's rules. D4 in the stages spec is still Brian's to decide.

### DV4. 7A copy: return what the page pre-fills

On each lead, add:

- `dealValue`: the case's Deal Value Year 1 as a string of digits (for example `"4500"`), or
  `""` when it is blank. Never a `$`, a comma or a decimal point.
- `nextStepDate`: the case's Next Step Date as `YYYY-MM-DD`, or `""` when it is blank.

Do not send Pipeline Stage or Deal Value Type to the partner page. Every other 7A key is
unchanged.

### Update item fields (Microsoft Learn row "SharePoint Update item")

Learn says Update item needs a value for every required field, taken from a fresh Get item
when a flow updates the same item more than once. This sheet adds no required field. For
the columns it adds, `""` or missing means keep the stored value, as everywhere in these
sheets: do not write a blank into Deal Value Year 1, Deal Value Type, Next Step Date or
Pipeline Stage. If the copy's Update item can't leave a field out for one save, branch so
only the keys that were sent are written, and record how it was built.

## The one sitting (decision 160)

Each line needs Brian's go in chat. In this order:

1. BB3 reports every TEST check below passed on the copies.
2. Go-live runbook step 7 (`docs/build/field-two-track-go-live.md`): production's
   `PARTNER_LEADS_FLOW_URL` and `PARTNER_SAVE_FLOW_URL` point at the copies. Run its checks.
3. Brian sets `PARTNER_STAGES_ENABLED=true` and `PARTNER_DEAL_VALUE_ENABLED=true` on
   production, then redeploys. Only the exact value `true` turns a switch on.
4. Check on production with the TEST partner link: the deal value field shows on a Meeting
   set lead; a TEST Meeting set save with a value of 4500 and a next step date answers 200;
   the case reads Deal Value Year 1 4500, Deal Value Type `Estimate`, Pipeline Stage
   `Meeting set` and that Next Step Date; and a reload shows 4500 and the date pre-filled.

**Rollback:** unset both switches and redeploy first (the page and the body go back to
today's). Then, only if needed, runbook step 7's rollback. Never put the partner addresses
back while either switch is on: the page would ask for values today's 7B drops. The copies keep what they stored. Nothing
reads a column that no save writes.

## TEST checks (TEST rows only; each is pass or fail)

Run through the preview pointed at the copies, with both switches on for the preview only.

1. **Deal value saves.** A Meeting set save with `DealValue` `4500`: Deal Value Year 1 is
   4500, Deal Value Year 1 Updated is set, Deal Value Type is `Estimate`, and the Status Log
   line ends with `Year 1 deal value $4500 (Estimate)`.
2. **A later value replaces it.** A second save with `7000`: the case reads 7000, and the
   Status Log keeps both lines.
3. **Blank keeps it.** A No change save with `DealValue` `""`: the case still reads 7000.
4. **A bad value saves the rest.** A save with `DealValue` `45.00` answers 200, writes no deal
   value column, and stores the rest of the update.
5. **A sign carries the type.** A Signed save with `7000` and `Set amount`: the case reads
   7000 `Set amount`, Pipeline Stage `Won`, Closed On = `SignedDate`, and Next Step Date is
   cleared.
6. **The stage moves forward only.** On an open case at `Meeting set`, a save whose
   `StageFromAnswers` is `Connected` leaves `Meeting set`. A save with `Proposal sent` moves
   it, sets Stage Entered On and Proposal Sent On to the save date, and adds one
   `Stage: Meeting set to Proposal sent` line.
7. **A closed stage holds.** On a `Lost` case, a stale tab's save with `Meeting set` leaves
   `Lost`.
8. **A blank stage fills.** On a case with a blank Pipeline Stage, a save with
   `Attempting contact` writes it, sets First Attempt On to `TalkedOn`, and adds 1 to
   Attempts.
9. **7A pre-fills.** 7A returns `dealValue` `"7000"` and the stored `nextStepDate` for the
   case from check 2, and `""` for both on a case with neither.
10. **Old pages still save.** A non-closing body with none of the four keys (switches off)
    saves exactly as the copy does today, and writes none of this sheet's columns.
10a. **A close with the switches off still dates it.** On an open TEST field case with Closed
    On blank, a Not moving forward save with no `StageFromAnswers` writes Closed On = the save
    date and leaves Pipeline Stage as it was. On a second, a Signed save with no
    `StageFromAnswers` and a `SignedDate` writes Closed On = that date. A later save on either
    case leaves Closed On as it is.
11. **One case of each path.** Checks 1 and 6 pass on a TEST other-team case, a TEST `FSC app`
    case and a TEST `Rep app` case.
12. **No new mail.** No run in checks 1 to 11 sent email to any address but the TEST inbox and
    Brian. The field case sends none (L3).

## What must not change

- Every rule in "F2 at launch" except the two named above (Pipeline Stage written; Closed On
  on every case's close, `SignedDate` on a sign).
- No email, recipient, subject or body. The redesigned status email with deal value and stage
  (`docs/partner-status-email-design.md`) is BB1's separate build.
- Next Update Due, 7C (Friday) and 7D (overdue) rules.
- The qualify question stays off (`PARTNER_QUALIFY_ENABLED` and `EnforceQualify`).
- Today's 7A and 7B, the flows production uses until step 7, are not edited.

## Not in this sheet

- A deal value measure on the Power BI Field Board. The Field Board spec has none today.
- Deal value in the Friday partner email.
- The redesigned status email.
