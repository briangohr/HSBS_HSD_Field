# Field two-track app: build sheet 1F, HSBS 1F Field app

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and the other team's exact list and column names are only in the old repo's copy.

Builder: BB2. Decisions 117 and 119 (Brian, 11/14: "yes, split it now" and "yes, all field
pieces as copies, prove on preview").

HSBS 1F is the field app's own flow, for RGM, FSC and AE keys on the Rep Roster. It is a new
flow, saved from "HSBS 1R Rep build copy 116" with every non-Rep step deleted. Nothing that
runs today changes: the live 1R, the 1R FSC copy, the 116 copy and every flow outside the field build are not
edited, deleted or turned off.

The request and answer shapes are the Rep ones in `docs/build/rep-app-flow-contracts.md` (slice 3
lookup, submit and list; slice 4 earnings; slice 5 team) and sheets F1 and F6 in
`docs/build/field-two-track-flow-contracts.md`. This sheet says what 1F holds and how it is checked.

## What 1F holds

1. The same HTTP trigger and request schema as the 116 copy, including the optional
   `practiceType` (F1.3). 1F gets its own web address.
2. Get_rep on the Rep Roster: `ReferralKey eq '<key>' and Status ne 'Disabled'`.
3. Role is `Rep`. Key known means Get_rep found a row.
4. Get_rep failing or timing out answers 500. Nothing else depends on it.
5. An unknown or Disabled key answers 404 `{"error":"unknown key"}` for every action and
   writes nothing.
6. A switch on `action`: `lookup`, `submit`, `list`, `team`, `earnings`. Any other action
   answers 400 `{"error":"missing or invalid fields"}`.
7. Submit writes one Referrals row: Source `Rep app`, Route `Direct to partner` (decision
   100), Referring Rep and Referring Rep Email, `practiceType` into RepPracticeType (F1.4),
   and Test = the name rule OR the Rep Roster row's Test. That meets G3 in sheet F5, so
   step R is not built. A repeated `submissionId` answers 200 with the first row and writes
   nothing.
8. Secure inputs and Secure outputs on the trigger, Get_rep and every step that holds the
   key or a roster row. Turned on last, after every check below passes, because they hide
   the run details the checks read.

## Build order

1. Save the 116 copy as "HSBS 1F Field app". Confirm the live 1R and the 116 copy are
   unchanged.
2. In 1F only, delete every step that is not on the Rep path, and make items 3 to 6 above.
3. 3a: rerun the submit and list checks (1 to 6 below).
4. 3b: lookup and activate (check 7).
5. 3c: team (check 8), then earnings (check 9).
6. Secure inputs and outputs (item 8), then check 10.
7. Export 1F, cleaned per `flows/README.md`, for Claude to commit.

1F is On only while a check runs, then Off. Its web address goes to Brian, never into chat
or the repo. Brian sets it as the preview's own `REFERRAL_FLOW_URL`, scoped to the preview
branch, once checks 1 to 10 pass. (History: that was the old site, `hsps-lifecycle`. On this
site the 1F address is `FIELD_FLOW_URL` only; `src/lib/field-flow.mjs` reads nothing else.)

## TEST checks (each is pass or fail)

1. A TEST rep sends a HealthFirst referral. One Referrals row as item 7, Test = Yes.
2. A TEST rep sends staffing with practiceType `Private practice`, then `Group`. Each row
   has RepPracticeType set.
3. Staffing with no practiceType or another value answers 400 and writes nothing.
4. The same `submissionId` twice gives one row.
5. List returns the rep's own rows only, with the F6.1 and F6.2 keys.
6. With the TEST rep set to Disabled, submit and list answer 404 and write nothing. Set it
   back afterwards.
7. Lookup: a TEST rep key answers 200 with its own fields and `isManager`. A Pending rep
   becomes Active. An unknown key answers 404.
8. Team: the S8 check in `docs/build/rep-app-flow-contracts.md` ("Live TEST check of the team
   rule"), run on 1F. It needs Brian's TEST team rows.
9. Earnings: slice 4 on TEST ledger rows typed by hand into the SPIFF Ledger (decision 120).
   Each rep sees only their own rows; the RGM sees the team's rows and their own.
10. After item 8, one TEST submit and one TEST list answer as before.

Also R1 (a Test = Yes rep with no TEST in any name makes a Test = Yes row) and R5 (no email
from any run). No live sends. Every stop item is a hard stop.
