# Field two-track app: build sheet F4, the pay flow and the ledger per company

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and names in code quotes are live SharePoint and flow names.

> **Refreshed 11/21/2026 for the field site and real dollars on Dec 4.** Read "Field site
> refresh" below first. It wins over any older line in this sheet that still reads
> otherwise. If a step still reads two ways, stop and ask Brian.

> **11/22/2026: HSBS 10M replaces HSBS 10B and 10P.** Read "10M build record" below. F4.7
> and F4.8 are kept as history only.

> **11/22/2026 4:09 PM ET: TSM pay plan v3.4 is the pay plan of record.** Read "V3.4
> stabilization record" below first. It overrides M3 in the 10M build record: `RealPayoutsOn`
> is no longer retired. It becomes the one hard gate for every Real 10M mode (plan Task 2), and
> it stays No until Brian releases the first real payout. Both 10M flows are Off until then.

## V3.4 stabilization record (11/22/2026)

Brian posted "TSM Pay Stabilization and Acceptance Implementation Plan, v3.4" on 11/22/2026
3:58 PM ET ("V3.4"). It supersedes v3.3 for field pay. It keeps HSBS 10, 10S, 10D, 1F and 10M.
Its hard gate: no Real 10M mode (List, Resend, Forwarded or Paid) until plan Tasks 1 to 8 pass,
Codex has no open P0 or P1 on the exact heads and live packages, and Brian releases the first
real payout in writing. The plan's work order is Task 1 (this record), then Task 2 (10M reads
`RealPayoutsOn`), Task 3 (frozen manifest), Task 4 (ledger semantics and adjustments), Task 5
(fully paged 10D validation), Task 6 (dual reader and ordered activation), Task 7 (TEST failure
matrix), Task 8 (Power BI and RLS), Task 9 (first real payout). One task per thread.

### V1 Task 1: live baseline (read only, 11/22/2026 4:01 to 4:07 PM ET)

Read in the Claude app browser: SharePoint REST on `sites/HSBSField` and the Power Automate
export and details pages. No flow ran, no row changed, no email was sent.

| # | Item | Value at baseline |
|---|---|---|
| V1.1 | Repo | `origin/main` 9ec8736 (PR 52 merged after the plan's f1eb8b9; docs and site only, no pay change) |
| V1.2 | Ledger Settings | One row, Title `Live` (ID 1, ETag 14, modified 11/22 12:54 PM ET): LedgerTestOnly No, StaffingAwardsOn Yes, RealPayoutsOn No, HF_Qualified 100, HF_Signed 0, HF_Manager 50, ST_Qualified 100, ST_Qualified_Group 200, ST_Manager 50, PayoutDate `2026-11-30` |
| V1.3 | Vercel `hsbs-hsd-field` | REP_PAY_ENABLED true (Production), REP_APP_ENABLED true, REP_PAY_PLAN `reached:100,manager:50`, REP_PAY_PLAN_STAFFING `reached_private:100,reached_group:200,manager:50`, PARTNER_OFFICE_CHECK true |
| V1.4 | HSBS 10 Ledger writer (7dc8451c) | On. Live hash 481b5111cb1a78b8 = project files `pay-ledger/out/HSBS-10-Ledger-writer-NEW-SITE.zip`. Last run 3:21 PM ET Succeeded |
| V1.5 | HSBS 10S Ledger on case save (7cf1095c) | On. Last run 3:21 PM ET Succeeded (one Failed run 3:13 PM ET is the R9 fault test while HSBS 10 was Off; its error row 18 is resolved) |
| V1.6 | HSBS 10D Daily pass (9f844540) | On. Live hash 005e65625eb10dff; with the signed HSBS 10 address blanked e68dfe81dd1ab0bd = `retries/live-2026-11-22/HSBS-10D-Daily-pass-NEW-SITE.zip`. Last runs 7:00 AM ET and 3:14 PM ET Succeeded. Last pass `catch-up-19`, 5 cases, done 3:19 PM ET |
| V1.7 | HSBS 10M Payout by hand (42ab04aa) | On at baseline. Live hash 9944aff52c0a04a8 = `pay-ledger/out10m/HSBS-10M-Payout-by-hand-NEW-SITE.zip`. Last run 3:23 PM ET Succeeded (TEST, "nothing to pay") |
| V1.8 | HSBS 10M Monthly payout (388c3751) | On at baseline. Live hash dea3e7c9e08900a9 = `pay-ledger/out10m/HSBS-10M-Monthly-payout-NEW-SITE.zip`. No run yet. Next real action was Mon 11/30 10 AM ET |
| V1.9 | Ledger Run Errors | 19 rows, 0 open |
| V1.10 | SPIFF Ledger | 33 rows, IDs 1 to 34 (no ID 33), one page. Every row is TEST. **Real rows 0.** No row has Payout Batch, Sent On or Paid On. No Paid row. No Disputed row |
| V1.11 | Counts by Test x Status x Eligibility | TEST x Waiting x (no column): 16 rows, $1,250. TEST x Void x (no column): 17 rows, $1,600. Real: 0 rows, $0. Eligibility does not exist yet (Task 4 adds it), so every row reads blank |
| V1.12 | TEST detail by role, payer, event | Waiting: Rep Reached HealthFirst 8 / $700; Rep Signed HealthFirst 2 / $300; Manager Signed HealthFirst 4 / $200; Manager Reached HealthFirst 2 / $50 (2 legacy rows from 11/18). Void: Rep Reached HealthFirst 13 / $1,300; Rep Signed HealthFirst 1 / $150; Manager Signed HealthFirst 3 / $150. No Direct Dental row today |
| V1.13 | Fingerprints | Full row export sha256 1cb37a547114a462... (33 rows, ETags included). Financial fields (ID, keys, role, event, status, amount, dates, batch, Disputed, Test, payer, company, office check, void reason, Old ID) sha256 23490033230523a4... |

Drift from the plan's baseline table: the repo head moved to 9ec8736 (V1.1). Ledger Settings,
Vercel pay flags and flow states match it. SPIFF Ledger has no Eligibility column, no
Schema Version and no validation fields yet; plan Tasks 4 and 5 add them. 4 legacy schema 1
rows (IDs 1 to 4, Old ID 3 to 6) have no Award Key and amounts from an older plan ($50 rep,
$25 manager); all TEST. The stamp thread's LastWriter and Reason columns are not live yet.

### V2 Task 1: backups (11/22/2026 4:06 PM ET)

Kept in Brian's builder project files, outside git, under
`pay-ledger/rollback/v34-baseline/` (file hashes in `SHA256SUMS.txt` there):

- `packages/`: HSBS 10, HSBS 10D (signed address blanked, paste from live on import), both 10M.
  Each package's canonical hash equals the live export (V1.4, V1.6 to V1.8).
- `list-schemas.txt`: SPIFF Ledger, Ledger Settings (with the `Live` row values), Ledger Run
  Errors, Ledger Pass Log and Sign Log: every column's internal name, type, index, unique,
  required and choices.
- `spiff-ledger-rows.jsonl`: all 33 SPIFF Ledger rows with every column, ID, ETag, Created,
  Modified and version. Its compact JSON hash equals the live read (V1.13). It holds TEST
  payee addresses, so it never enters git or a handoff.

### V3 Task 1: containment live log (times ET)

| When | What | Before | After | Undo |
|---|---|---|---|---|
| 4:08:31 PM | "HSBS 10M Monthly payout (new site)" turned Off (details page, More, Turn off) | On | Off | Turn On (only after Task 2 is live and accepted, or Brian says so) |
| 4:08:57 PM | "HSBS 10M Payout by hand (new site)" turned Off | On | Off | Turn On |

`RealPayoutsOn` stays No (not touched). No Real List, Resend or Paid ran. The coordinator told
Brian first that the Mon 11/30 10 AM ET automatic list is paused until Task 2 is live.

### V4 Task 1: reconciliation (11/22/2026 4:10 PM ET)

| Check | Before (4:05 PM) | After (4:10 PM) | Result |
|---|---|---|---|
| SPIFF Ledger rows | 33 | 33 | Same |
| Full row hash (ETags included) | 1cb37a54... | 1cb37a54... | Same: no row changed |
| Ledger Settings | ETag 14, RealPayoutsOn No | ETag 14, RealPayoutsOn No | Same |
| Open Ledger Run Errors | 0 | 0 | Same |
| 10M hand definition hash | 9944aff52c0a04a8 | 9944aff52c0a04a8 | Same (Off changes state only) |
| 10M monthly definition hash | dea3e7c9e08900a9 | dea3e7c9e08900a9 | Same |
| Payout emails since 3:55 PM | none | none | No email (mail search; last 10M mail was TEST at 3:23 PM) |
| Real batch or real Paid row | none | none | Nothing to stop for |

Task 1 acceptance: both 10M flows Off, RealPayoutsOn No, no financial row changed, backups
complete, and the baseline accounts for all 33 ledger rows. Every live fact in V1 to V4 is
builder-recorded (Claude read it; Codex did not).

### V5 Task 2: `RealPayoutsOn` is the 10M hard stop (offline build, 11/22/2026 4:15 to 4:30 PM ET)

Thread "Make real-pay switch block payouts". Built on the stamp thread's generators
(`history-stamp/build/gen_10m.py` and `test_10m.py`, LastWriter included), not on
`pay-ledger/build`. Kept in Brian's builder project files under `pay-ledger/proof-v34/task2/`
(`build/`, `out/`, and the generator before the gate in `rollback/`). Nothing live changed in V5.

The guard, in both 10M flows:

- Ledger Settings is read with `$top=2` and now selects `RealPayoutsOn`. New compose
  `Real_switch` = exactly one `Live` row **and** `RealPayoutsOn` equals boolean `true`. A blank,
  `No`, a text value or two `Live` rows all read false. `Real_on` (exactly one `Live` row with
  LedgerTestOnly No) is kept.
- New step `Real_gate`, an If on `and(not(variables('isTest')), not(and(outputs('Real_on'),
  outputs('Real_switch'))))`. When true it writes one Ledger Run Errors row (Title
  `HSBS 10M real gate` or `HSBS 10M by hand real gate`, Step names the reason), mails Brian the
  failure notice (subject `HSBS payout: <flow> failed, real pay is off (RealPayoutsOn)`), and
  ends the run as Failed. It sits before the ledger read (`Get_ledger`), so a stopped Real run
  reads no ledger row for pay, stamps nothing, sends no list and writes no Paid.
- Monthly: the gate runs after the payout day check and `Set_batch`, so a normal day still ends
  quietly with no error row. It replaces the old `Real_off` refusal.
- By hand: the gate runs after the input checks (`Mode_ok`, `Kind_ok`, `Batch_ok`) and
  `Set_kind`, for every mode. Real means Kind `Real` for List, and a batch without `-TEST-` for
  Resend and Paid (a real row only ever gets a `PAY-yyyy-MM` batch, and `Kind_wrong` still
  refuses a Paid whose rows do not match the batch kind). The old `Real_off_hand` refusal is
  removed; the gate covers it.
- A failed Ledger Settings read fails the run before the gate, through the existing failure
  path: one error row, one failure mail, no list.
- TEST runs never need the switch.
- Mode `Forwarded` does not exist yet (plan Task 3 adds it). Today a Forwarded call, TEST or
  Real, is refused as an unknown mode with no read of the ledger and no write. Because the gate
  is mode-blind, Task 3's Forwarded is gated the moment it is added.
- Side effect, by design: a stopped Real run leaves an open Ledger Run Errors row, and an open
  error row holds every later list (TEST included) until Claude resolves it.

| Package | Before (stamp build) | After (gate) |
|---|---|---|
| HSBS 10M Monthly payout (new site) | e4d09170afaf4cd2 | 654ea1592f6706f8 |
| HSBS 10M Payout by hand (new site) | c29e5a6e1468506b | 81b33a4056a52f82 |
| HSBS 10 Ledger writer (unchanged, regenerated as a check) | b3a9654adfa77f33 | b3a9654adfa77f33 |

Hash rule: sha256 of `{triggers, actions}` with metadata, description and evaluatedRecurrence
stripped, first 16 hex (`retries/hash_packages.py`).

Offline tests (`python3 -I test_10m.py <out>`, the sim model, lazy and `SIM_EAGER=1`):

| Suite | Before the gate | After |
|---|---|---|
| test_10m.py | 93/110 on the stamp build (16 new gate checks and the reworded H19 fail) | 110/110 lazy, 110/110 eager |
| test_10.py | 108/108 | 108/108 lazy and eager |
| test_10d.py | 49/49 | 49/49 lazy and eager |
| lint_flow.py | 0 problems | 0 problems (10M monthly 142 actions, by hand 208) |

New checks: R1 (by hand Real List, Resend, Forwarded and Paid with RealPayoutsOn No, blank,
two `Live` rows, and the text `Yes`: no ledger write, no list mail, one error row and one
failure mail; Forwarded is refused as an unknown mode), R2 (monthly Real list on the payout
day, same four states), R3 (Ledger Settings read fails, by hand and monthly), R4 (switch No on
a normal day: monthly still ends quietly), R5 to R9 (switch No: TEST List, TEST Resend and TEST
Paid still work, TEST Forwarded is an unknown mode, no error row), R10 (switch Yes with one
`Live` row: Real List runs). H19 now expects the gate (Failed, one error row) for LedgerTestOnly
Yes. The older Real checks (M2 to M30, H16 to H18, P1 to P6) model a released switch
(`RealPayoutsOn` Yes) and still pass. N1: nesting stays within the Power Automate limit of 8.

## Field site refresh (11/21/2026)

Brian, 11/21/2026: "it should show real dollars. What I will need to create is a file for
each dedicated promotion that shows what the payot is like for instance in the case of HF
and DD, it's 100 of qualified lead and $50 to the manager".

| # | What | Before 11/21 | Now |
|---|---|---|---|
| R1 | Site | The shared site `HSBSPVAReferrals` | The field site, `sites/HSBSField`. Every list this sheet reads or writes is on it: Referrals, Service Cases, Rep Roster, Team Roster, Routing, SPIFF Ledger and the four lists F4.1 adds. HSBS 10, 10S, 10D, 10B and 10P read no other site and no other team's list |
| R2 | Who writes the partner's answers | 7B, with 7A listing open cases | HSBS 7F Field partner (new site) on a partner save, and 7H on a partner email reply. "Open" is a case 7F would list |
| R3 | Who reads the ledger for the site | 1R `earnings` and `team` | HSBS 1F (new site) `earnings` and `team`. Its package of 11/18 already reads `SPIFF Ledger` on the field site by name (Payee Email and Payee Role filter, Test rows only for a TEST caller) |
| R4 | Rep award event | Reached and Qualified (decision 65) | **Qualified is `Yes`.** 7F writes Qualified `Yes` only with Talked To Doctor `Yes` (choices `qualified`, `meeting`, `proposal`, `signed`), so a partner save pays exactly as before. Only a hand edit of Qualified alone differs, and it now pays. The ledger Event stays `Reached` and the key stays `<id>\|Reached\|Rep`, because the site reads only `Reached` and `Signed` |
| R5 | Rep amount | HealthFirst $100. Direct Dental $100 private practice, $200 group, by Award Practice Type | **Changed 11/22 (Brian, 11:30 AM ET: "$100 unless someone selects the multiple office selection in the app").** HealthFirst $100 flat (its form has no office choice). Direct Dental $100, or $200 when the Referrals row's Rep Practice Type (`RepPracticeType`, the rep's pick on the send, written by 1F) is `Group` (3 or more locations) **and** the partner confirmed 3 or more locations on the partner page (Service Cases `OfficeCountConfirmed` `Yes`, written by 7F on the save that qualifies the lead; Brian 11/22 12:10 PM ET, Matt Penny at Direct Dental owns the confirm). No or no answer: $100. Amounts come from Ledger Settings `ST_Qualified` and `ST_Qualified_Group`. Award Practice Type still sets nothing: rule G, lists X4 and X9, gate G3 and the decision 82 follow-up stay retired, and the ledger has no Practice Type column. (11/21 to 11/22 it was one flat $100 for both.) |
| R6 | Manager award | $50 at the sign | **$50 at the sign, unchanged** (Brian, 11/21, on the manager pay card: "When it signs"). Rule B as written |
| R7 | Where amounts live | Initialize variable steps in HSBS 10 | Number columns on the Ledger Settings `Live` row ("Amount settings"), filled from the promo file (`docs/build/field-promo-file.md`). A new promotion is one row edit, never a flow edit |
| R8 | 12 month look-back | Any source, the other team's app and the FSC app included | Field-site Referrals rows only, any source on that list |
| R9 | Column names | `Solutions` on the case, JDE | Service Cases `Service` (single choice) names the company. Referrals: `JDEAccount`, `Solutions` (multiple choice), `Source`, `PracticeName`, `CustomerName`, `Referring Rep Email`, `Test`. BB2 still records each exact name (record 4) |
| R10 | Signed | Status `Closed - Won` with Signed Date and Signed Product | Partner Status `Signed` or `Close won`, with Signed Date set. 7F's `signed` choice writes both |
| R11 | Site plan words | `REP_PAY_PLAN_STAFFING` `reached_private:100,reached_group:200,manager:50` | `reached_private:100,reached_group:200,manager:50` again since 11/22 (R5). It was `reached_private:100,reached_group:100,manager:50` from 11/21 to 11/22. HealthFirst stays `reached:100,manager:50` |

## 10M build record: monthly payout list (11/22/2026)

Brian, 11/22/2026 12:12 PM ET: "How hard could a payout run be, it's a once a month cut to
alexa with the names and emails of the TSM's who qualified based on the partner service case
updates". 12:31 PM ET: the list goes to Brian only, and he forwards it to Alexa.

**HSBS 10M replaces HSBS 10B and 10P (F4.7, F4.8), which are not built.** There is no batch per
payer, no list to HealthFirst or Matt Penny, no Payout Batches list and no payer confirmation
flow. Where F4.7, F4.8 or an older line names 10B or 10P, read 10M. Generator, offline tests and
packages: project files `pay-ledger/build/gen_10m.py`, `test_10m.py`, `pay-ledger/out10m/`.

| # | What | As built |
|---|---|---|
| M1 | Flows | "HSBS 10M Monthly payout (new site)": every day 10 AM Eastern (after 10D, which can hold an open catch-up row until about 9 AM). "HSBS 10M Payout by hand (new site)": manual, Mode `List`, `Resend` or `Paid`. Both trigger concurrency 1 |
| M2 | Payout day | Ledger Settings `PayoutDate` (Text, `YYYY-MM-DD`, the one setting) when it is a real date in the current Eastern month, else the last weekday of the month. November 2026: Mon 11/30. Any other day the scheduled run ends quietly. A `PayoutDate` in another month is ignored, so it never needs clearing |
| M3 | Real pay gate | A Real list needs exactly one `Live` row with LedgerTestOnly No (fail safe, as 10D). 10M does not read StaffingAwardsOn or RealPayoutsOn. **RealPayoutsOn is retired** with 10B and 10P: it stays No and no flow reads it. **Overridden 11/22/2026 by v3.4:** every Real 10M mode also needs RealPayoutsOn Yes (V5) |
| M4 | Freeze | No list while a Ledger Run Errors row is open (X1). Brian gets one email saying why, nothing is stamped, and the list is made by hand (Mode `List`, Kind `Real`) once the rows are resolved |
| M5 | Rows | SPIFF Ledger: Status `Waiting`, Disputed not Yes, Sent On blank (Payout Batch blank, or the batch of a row Alexa did not pay, M10), Test = the kind (a Real list never holds a TEST row and a TEST list never a real one, D8), Amount a whole number 1 to 1000, Payer matching Company (X12), Earned On (Eastern date) on or before the cutoff (the run date), and not on X17 (office match tested live as in 10D, unless Office Check is `Cleared`). Each Waiting row held out is named in the email with its reason |
| M6 | Batch ID | Real: `PAY-<yyyy-MM>`, one per month. A Real list whose batch already has rows is refused (Mode `Resend` sends the list again). TEST: `PAY-<yyyy-MM>-TEST-<ddHHmm>` |
| M7 | Stamp | Each row: Payout Batch = the batch ID and Sent On = today, one MERGE with `IF-MATCH` on the ETag from the read. A 412 (HSBS 10 changed it, for example a void) leaves the row out and names it. The one-writer rule holds by columns: HSBS 10 never writes Payout Batch, Sent On or Paid On, and 10M changes Status only from `Waiting` (or `Void`, see M10) to `Paid`, each time with `IF-MATCH`. **Sent On means the row was in the list email Brian got** (M8) |
| M8 | The list | Read back from the ledger by Payout Batch, so the email is always what is stamped. One email **to Brian only**: a table, `payout-<batch>.csv` for Alexa (one line per person: Name from Rep Roster, Email, Role, Total, Leads, HealthFirst, Direct Dental, Batch) and `payout-detail-<batch>.csv` for Brian (one line per row). A cell that starts with `=`, `+`, `-` or `@` gets a leading `'`. A row returned as not paid (M10) is left out of the totals and named. A row that is `Void` in the read-back is left out of the totals, named "void, left out of this list, will not be marked Paid", and has its Sent On cleared (MERGE with `IF-MATCH` on the ETag from the same read) before the email is built, so a later Paid never marks it Paid. If that clear fails (a 412 because HSBS 10 changed the row again), the run fails (M11) and sends no list; Mode `Resend` recovers. A row voided after the read-back was in the email as `Waiting` and keeps Sent On. A cleared void row keeps its Payout Batch and is never relisted (M5 needs Status `Waiting`). No customer name, phone or email. No mail to anyone else (D15, S9) |
| M9 | Resend | Mode `Resend` with a batch ID: the list again from a fresh read-back. It writes nothing except the M8 Sent On clear on a row that is now `Void`. A Real Resend says "Rows on an earlier list that are now void are left out. Forward only this list." This is the recovery when the list email fails after the stamp |
| M10 | Paid | Mode `Paid` with the batch ID, Paid On (`YYYY-MM-DD`, not after today, not before any row's Sent On or Earned On) and Not paid (Award Keys Alexa did not pay, blank when she paid all). Checks run before any write: a Not paid key that is not on this batch (as F4.8 check 6), a batch with no rows, or a row whose Test does not match the batch stops the run and changes nothing. Then each row, read fresh, with `IF-MATCH`: `Waiting` becomes `Paid` with Paid On; a Not paid `Waiting` row gets Sent On cleared and keeps its Payout Batch, so a retry still finds it on the batch and a later list carries it (its stamp then replaces the batch); a `Waiting` row with Sent On blank was returned by an earlier run and is never marked Paid by a retry; a `Void` row with Sent On blank was left out of the list Brian got (M8): it is never marked Paid, whether or not it is in Not paid, and when it is not in Not paid it is named "void, left out of the list, not marked Paid; if Alexa paid it anyway, tell Claude"; a `Void` row with Sent On set was in that list and voided after it, so when it was paid (not in Not paid) it becomes `Paid`, Disputed Yes, Dispute Note `voided after it was listed, then paid: ` and its Void Reason (money that moved is never hidden, D3); a `Paid` row with the same Paid On is left as it is. So a retry with the same inputs changes nothing done. Brian gets the counts. Claude runs it when Brian says Alexa paid. No flow and no hand step clears a row's Payout Batch, since this run finds rows by it (X13) |
| M11 | Failure | A failed run writes a Ledger Run Errors row (Step starts `HSBS 10M`) and emails Brian. Rows stamped before the failure keep their batch, and Mode `Resend` lists them |

### 10M live log (11/22/2026, times ET)

No prior flow, so nothing to back up. Pay switches untouched (LedgerTestOnly No, StaffingAwardsOn
Yes, RealPayoutsOn No, amounts unchanged).

| When | What | Undo |
|---|---|---|
| 12:54 PM | Ledger Settings: new column `PayoutDate` (Single line of text, 10). `Live` row PayoutDate blank to `2026-11-30` | Set it blank (same result). The column is read by 10M only |
| 1:00 PM | Imported "HSBS 10M Payout by hand (new site)" as new (package sha256 `f78c323f...2389`), Brian's SharePoint and Office 365 connections | Turn Off |
| 1:05 PM | Imported "HSBS 10M Monthly payout (new site)" as new (sha256 `22e64ca6...a3a1`) | Turn Off |
| 1:06 PM | Hand flow On | Turn Off |
| 1:08 PM | TEST List, Only keys `49\|Reached\|Rep`, `56\|Reached\|Rep`, `48\|Signed\|Manager`: exactly those 3 rows (Ids 12, 28, 15) got Payout Batch `PAY-2026-11-TEST-221308` and Sent On 11/22; the other 30 rows unchanged. One email to Brian only, "2 people, $250" (TEST rep $200 for 2 leads, TEST manager $50). `payout-<batch>.csv` opens in Excel with the right columns | Rows restored at 1:14 PM |
| 1:11 PM | TEST Resend of that batch: the same email again, no ledger write (Modified times unchanged) | None needed |
| 1:12 PM | TEST Paid, Paid On 2026-11-22, Not paid `56\|Reached\|Rep`: Ids 12 and 15 Paid with Paid On 11/22; Id 28 back to Waiting, Sent On cleared, batch kept. Email "Marked Paid: 2, Back to Waiting: 56\|Reached\|Rep" | Rows restored at 1:14 PM |
| 1:13 PM | Same Paid inputs again: no row changed. Email "Marked Paid: 0, Unchanged: 3" | None needed |
| 1:14 PM | Restored Ids 12, 15, 28 by REST MERGE: Status Waiting, Payout Batch, Sent On and Paid On blank (as before the proof). No ledger row holds a batch. No Ledger Run Errors row since noon | None needed |
| 1:15 PM | Monthly flow On. Its first list is Mon 11/30 10 AM; every other day it ends quietly. Today the ledger has no real row, so 11/30 sends Brian an empty-month note unless real rows arrive | Turn Off |

### 10M P0 fix live log: a void row left out of the email is never Paid (11/22/2026, times ET)

Codex P0 on PR 44: a row voided between the stamp and the read-back (or before a Resend) was left
out of the email totals but kept Sent On, so a Paid confirm with Not paid blank marked it Paid.
Fix as M8, M9 and M10 above. Offline: `test_10m.py` 74/74 (P1 to P13 and N1 new; 8 of the new checks
fail on the old build), also with SIM_EAGER=1; `test_10` 80/80, `test_10d` 49/49, lint 0. Backup:
`pay-ledger/rollback/p0-void-before/` (the packages imported at 1:00 and 1:05 PM; the live exports
at 1:30 PM matched them action for action). Pay switches and real rows untouched; the ledger held
no real row.

| When | What | Undo |
|---|---|---|
| 1:33 PM | First import of the hand flow refused by Power Automate: "nested at level 9 which exceeds the maximum nesting limit of 8". Nothing changed (live export after it still matched the backup). The void checks were flattened and `test_10m.py` N1 now checks the nesting limit | None needed |
| 1:36 PM | "HSBS 10M Payout by hand (new site)" imported as Update (top SharePoint connection, month-old Outlook connection). Package `out10m/HSBS-10M-Payout-by-hand-NEW-SITE.zip`, actions hash `054c064b5ce15519` | Import `rollback/p0-void-before/HSBS-10M-Payout-by-hand-NEW-SITE.zip` as Update, turn On |
| 1:39 PM | "HSBS 10M Monthly payout (new site)" imported as Update, same connections. Actions hash `811b70fb3eba8467` | Import `rollback/p0-void-before/HSBS-10M-Monthly-payout-NEW-SITE.zip` as Update, turn On |
| 1:40 PM | Hand flow On | Turn Off |
| 1:41 PM | TEST List, Only keys `49\|Reached\|Rep`, `56\|Reached\|Rep`, `48\|Signed\|Manager`: Ids 12, 15, 28 got Payout Batch `PAY-2026-11-TEST-221341` and Sent On 11/22. Email "2 people, $250", to Brian only | Rows restored at 1:44 PM |
| 1:42 PM | Id 28 voided by REST (Status Void, Void Reason "TEST 10M P0 proof") | Restored at 1:44 PM |
| 1:42 PM | TEST Resend: Id 28 Sent On cleared, batch kept; email "2 people, $150" names it "void, left out of this list, will not be marked Paid"; no other row written | Restored at 1:44 PM |
| 1:44 PM | TEST Paid, Paid On 2026-11-22, Not paid blank: Ids 12 and 15 Paid; Id 28 stays Void, Paid On blank, Disputed No, not written. Email "Marked Paid: 2", "Needs a look: 56\|Reached\|Rep (void, left out of the list, not marked Paid ...)" | Restored at 1:44 PM |
| 1:44 PM | Restored Ids 12, 15, 28 by REST MERGE: Status Waiting, Void Reason, Payout Batch, Sent On and Paid On blank (as before, `pay-ledger/proofP0/ledger_before_2026-11-22_1342ET.txt`). No ledger row holds a batch. No new Ledger Run Errors row | None needed |

Codex P0 on PR 47 (1:48 PM): X13 told Brian to clear Payout Batch on a void row, which would hide it from 10M `Paid` if Alexa paid it anyway. X13's drop-off rule now says nobody clears Payout Batch by hand, and M10 says no flow or hand step does. The 10D exceptions email only lists the row (its text never said to clear it), so no flow changed. `test_10m.py` 76/76 with X13a (batch kept: Paid, Disputed) and X13b (batch cleared: missed, stays Void).
| 1:46 PM | Monthly flow On. First list still Mon 11/30 10 AM | Turn Off |

## Multi-office build record: HSBS 10 group amount (11/22/2026)

Thread "Pay $200 for multi-office leads". Brian, 11/22 11:30 AM ET: "$100 unless someone selects
the multiple office selection in the app". Times ET.

- Field: the only multiple office choice in the app is `Group (3 or more locations)` on the
  Direct Dental form. 1F saves it as `Group` in Referrals `RepPracticeType`; 3F copies it to the
  Service Case. HSBS 10 reads the Referrals row (it never reads the request body or Award
  Practice Type). The HealthFirst form has no such choice, so HealthFirst never pays the group
  amount, even if a row says `Group`.
- HSBS 10 change (generator `gen_10.py` in the project files `pay-ledger/build/`): `Get_settings`
  selects `ST_Qualified_Group`; the amount check requires it 1 to 1000; `Get_ref` selects
  `RepPracticeType`; new step `Multi_office` = company `Staffing` and `RepPracticeType` = `Group`;
  `A_R` = `HF_Qualified` for HealthFirst, else `ST_Qualified_Group` when `Multi_office`, else
  `ST_Qualified`. Manager award unchanged ($50 at the sign). A row already written keeps its
  amount (D3). Offline: `test_10.py` 80 of 80 (9 new), `test_10d.py` 49 of 49, lint 0 problems.
- 11:37 AM: Ledger Settings column `ST_Qualified_Group` (Number) added; `Live` row set to 200.
- 11:43 AM: backup copy `HSBS 10 Ledger writer (new site) BACKUP 2026-11-22 before multi-office`
  (Off). Generator backup in `pay-ledger/rollback/multi-office-before/`.
- 11:44 AM: new package imported as Update, HSBS 10 turned On 11:45 AM. Six TEST-LOAD case saves
  (cases 84 to 89, Partner Status `Trying to reach`, no Qualified) landed in the 1 minute it was
  Off: Ledger Run Errors 12 to 17. They write no row under either version, so they were set
  Resolved Yes.
- TEST proof 11:46 to 11:48 AM: two TEST Direct Dental sends from Test Fieldsite through
  production `/api/referral` (F533 `Private practice`, F534 `Group`, both Test Yes; 3F sent each
  `[TEST]` intro to Brian only). Cases 116 and 117 saved `qualified` on the TEST partner page.
  SPIFF Ledger 36 `116|Reached|Rep` $100 and 35 `117|Reached|Rep` $200, both Waiting, Staffing,
  Direct Dental, Test Yes.
- 11:49 AM: Vercel `REP_PAY_PLAN_STAFFING` (production and preview) set to
  `reached_private:100,reached_group:200,manager:50`; production redeployed. Plan equality holds:
  100 / 200 / 50.
- Office count check (11/22, thread "Add Matt's office count check"): `Get_case` also selects
  `OfficeCountConfirmed`; `Multi_office` also needs it to be `Yes`. See "Office count build
  record" below.
- Undo: Ledger Settings `ST_Qualified_Group` back to 100 pays $100 for every staffing lead with
  no flow change. Full undo: import `rollback/multi-office-before/HSBS-10-Ledger-writer-NEW-SITE.zip`
  as Update (or swap in the backup copy), and set the Vercel value back to
  `reached_private:100,reached_group:100,manager:50` and redeploy.

## Writer stamp and pass log reason build record (11/22/2026)

Thread "Stamp writer and pay log reasons" (history check items G1 and G3, from
`build-desk/HISTORY_2026-11-22.md`). Times ET. Field only, TEST rows only. Pay amounts and rules
unchanged.

- Problem G1: every flow and every hand REST edit runs as Brian, so SharePoint version history
  cannot say which flow wrote a SPIFF Ledger or Field Notify Outbox change. A TEST restore by hand
  looked the same as a 10M Paid write.
- Problem G3: a Ledger Pass Log row said only `done`, so a case with no award and a case that
  wrote its rows looked the same.
- New Text columns: `LastWriter` (shown as Last Writer) on SPIFF Ledger and on Field Notify
  Outbox; `Reason` on Ledger Pass Log. No flow and no site route reads them.
- Writer stamp, set on every create or MERGE of those lists:
  - HSBS 10: `HSBS 10 run <run name>`, plus ` pass <passId>` on a 10D catch-up post
    (K_R, K_M, K_S creates, Void_row, Dispute_row).
  - 10M monthly: `HSBS 10M monthly run <run name> batch <batch>` (Stamp_row, Clear_row).
  - 10M by hand: `HSBS 10M by hand run <run name> batch <batch>` (Clear_row, Return_row,
    Pay_row, Pay_void_row).
  - 7F: `HSBS 7F run <run name>` (hand back Outbox create, claim, sent, retry).
  - 7N: `HSBS 7N run <run name>` (every Outbox state move; Partner Links LastAskSent unchanged).
  - A Claude hand edit of a ledger or Outbox row sets `hand: <thread title>`.
- Pass log reason: `Outcome` keeps `done`, `ended` or `failed`, because 10D reads it. `Reason`
  says what the run wrote or why it wrote nothing, at most 255 characters, for example
  `No row: not qualified yet (Qualified blank).`, `Wrote the rep qualified row (Waiting).`,
  `No change: the rep qualified row is already written (Void). No pay: <void reason>.`,
  `Voided a Waiting row. No pay: ...`, `Sign rows held: 2 or more Active Team Roster rows for
  this rep.`, `No row: Direct Dental awards are off.`, an ended run's stop (`The referral did
  not come from the rep app`), or `Failed at <steps>`. A 10S save still writes no pass row.
- Build: project files `history-stamp/` (generators `gen_10.py`, `gen_10m.py`; in-page patch
  `patch_stamp_inpage.js` for 7F and 7N). Offline: `test_10.py` 108/108 (18 new), `test_10m.py`
  78/78 (2 new), `test_10d.py` 49/49, 7F `test_7f_offices.py` 32/32 and `test_stamp.py` 7/7,
  `test_7n.py` 55/55 and `test_stamp.py` 10/10, lint 0 problems.
- Hashes (metadata, description and evaluatedRecurrence left out): HSBS 10 `481b5111cb1a78b8`
  to `b3a9654adfa77f33`; 10M monthly `dea3e7c9e08900a9` to `e4d09170afaf4cd2`; 10M by hand
  `9944aff52c0a04a8` to `c29e5a6e1468506b`; 7F `c90e37a29cf67af8` to `e3ebd40256a0d84e`; 7N
  `cd15fcabc042d121` to `ae679592487b3c5d`.
- 10M: no stamp-only import. The 10M real-pay gate build (thread "Make real-pay switch block
  payouts") is built on these generators and carries the stamp, so 10M is imported once, there.
  Both 10M flows are Off since 4:08 to 4:09 PM ET (pay plan v3.4) and stay Off.
- Live (run in the Claude app browser by thread "Capture pay baseline and pause 10M"):
  - 4:15 PM: columns added and read back: SPIFF Ledger `LastWriter`, Field Notify Outbox
    `LastWriter`, Ledger Pass Log `Reason` (Text, 255).
  - 4:19 PM: 7F live export `c90e37a29cf67af8` patched in page, imported as Update. 4:20 PM On,
    checker 0 errors, re-export `e3ebd40256a0d84e`.
  - 4:24 PM: 7N live export `cd15fcabc042d121` patched in page, imported as Update. 4:25 PM On,
    re-export `ae679592487b3c5d`.
  - 4:29 PM: HSBS 10 live export `481b5111cb1a78b8` patched to the generator build, imported as
    Update (Off about 27 seconds). 4:29 PM On, re-export `b3a9654adfa77f33`.
- TEST proof 4:31 to 4:38 PM, PASS: TEST HealthFirst send from Test Fieldsite (Referrals 702,
  Service Cases 284, Test Yes); `dq_noanswer` save through production `/api/partner-save` with
  the TEST partner key. SPIFF Ledger 54 `284|Reached|Rep` Void, LastWriter `HSBS 10 run ...`
  (so 10S still posts after the import). Outbox 27 Sent to the TEST partner row (Brian),
  LastWriter `HSBS 7F run ...`. 10D run by hand 4:32 PM: pass `catch-up-20`, Ledger Pass Log 99
  to 136 all carry Reason (case 284: "No change: the rep qualified row is already written
  (Void). No pay: HealthFirst marked this lead as not qualified (no answer after 4
  attempts)."). Open Ledger Run Errors 0. 7N wrote no row in the window (no fault forced), so
  its stamp is proven by hash and offline tests only. 4:38 PM recycled Referrals 702, Service
  Cases 284, SPIFF Ledger 54, Outbox 27; Pass Log rows kept. SPIFF Ledger after: 33 rows, all
  TEST, financial hash equal to the pay baseline taken before the change.
- Record with run IDs: project files `history-stamp/LIVE_RECORD_2026-11-22.md`.
- Undo: import the `history-stamp/rollback/` packages (or `pay-ledger/rollback/v34-baseline/`)
  as Update and turn the flow back to its state before. The columns can stay.

## No-answer close words build record (11/22/2026)

Thread "Fix no-answer close label on Earnings" (loops finding L1). Times ET. Field only, TEST
rows only.

- Problem: 7F closes a lead after the 4th Not reached yet save (and on `dq_noanswer`) with Not
  Qualified Reason `Other` and Not Qualified Note `Disqualified, no answer after 4 attempts`.
  HSBS 10 built the void reason from the reason only, so Earnings read "Not paid: HealthFirst
  marked this lead as not qualified (Other)."
- Fix in HSBS 10 only (7F, 10S, 10D, the site and 1F unchanged): `Get_case` also selects
  `Not_x0020_Qualified_x0020_Note`; `NQ_reason` is `no answer after 4 attempts` when the reason
  is `Other` and the note contains those words, else the stored reason as before (rule 3 under
  W11). A site-only fix was not possible: the site never sees the note.
- Generator: `pay-ledger/build/gen_10.py`; `test_10.py` 90/90 (4 new L1 checks: HealthFirst,
  Direct Dental, Other with another note keeps `(Other)`, a real reason wins), `test_10d.py`
  49/49, lint 0 problems.
- 2:37 PM: exported live HSBS 10, definition hash (metadata left out) `6e8a1c4c20343cad`, the
  office count build, so the backup below is exactly what was live. Patched in page with
  `pay-ledger/noanswer/patch_10_noanswer_inpage.js` (only the two inputs; live metadata ids
  kept): `481b5111cb1a78b8`, equal to the tested generator build.
- 2:39 PM: imported as Update onto HSBS 10 (top SharePoint connection). 2:40 PM: On. Ledger Run
  Errors stayed at 17 (no case save landed in the minute it was Off).
- TEST proof 2:41 to 2:43 PM, PASS: TEST HealthFirst send from Test Fieldsite through
  production `/api/referral` (F699, Test Yes; `[TEST]` intro to Brian only). Case 282 saved
  `trying` 4 times through production `/api/partner-save` with the TEST partner key, each 200.
  The 4th closed it: Not moving forward, Qualified No, reason `Other`, note
  `Disqualified, no answer after 4 attempts`, Closed Reason `Not qualified`. Outbox row 23 Sent
  to Brian (one `[TEST]` hand back). SPIFF Ledger 49 `282|Reached|Rep` Void, $100, Test Yes,
  reason `HealthFirst marked this lead as not qualified (no answer after 4 attempts)`.
  Production `/api/earnings` for Test Fieldsite: "TEST NOANSWER 1122 L1. HealthFirst. Not paid:
  HealthFirst marked this lead as not qualified (no answer after 4 attempts)."
- 2:44 PM: recycled Referrals 699, Service Cases 282, SPIFF Ledger 49, Field Notify Outbox 23
  (each checked first: Test Yes or the TEST case, no payout batch, Outbox Sent).
- Older TEST rows voided before this change keep `(Other)` (for example ledger 32, case 59).
  HSBS 10 does not rewrite the reason on a row that is already Void. No real lead has closed
  this way yet (the 4-try close went live 11/22 1:19 PM ET; first real partner asks Mon 11/23).
- 10D's X10 ("Not qualified, reason Other") still lists a no-answer close for 7 days, with its
  note. Unchanged here.
- Undo: import `pay-ledger/rollback/noanswer-before/HSBS-10-Ledger-writer-NEW-SITE.zip` as
  Update onto HSBS 10 (same definition as the live export, hash `6e8a1c4c20343cad`), turn On.
  Generator and tests backup in the same folder.

## P2 build record: HSBS 10 and 10S (11/21/2026)

Built by Claude in the thread "Build pay ledger writer" as importable packages, on Brian's
"ok, go" (11/21). Brian imports and turns on every flow. The packages and their generator
live in the project files (`pay-ledger/`), not in this repo, because they carry list ids and
Brian's work address. Where this record and an older line in this sheet differ, this record
wins for HSBS 10 and 10S.

| # | What | Built |
|---|---|---|
| B1 | Lists and columns (F4.1) | A one-time flow, HSBS 10 setup (new site), run once by Brian. It creates Ledger Settings (with the `Live` row at the build values), Sign Log, Ledger Run Errors, Ledger Pass Log (B9) and, if missing, the SPIFF Ledger. It adds only missing columns, never changes a column that exists, and adds the F4.1 indexes. It emails Brian what it made and every name or type that does not match. Payout Batches waits for P6 (10B) |
| B2 | Column names HSBS 10 reads and writes | SPIFF Ledger: `Award_x0020_Key` (unique), `Referral_x0020_ID`, `Service_x0020_Case_x0020_ID` (number), `Practice_x0020_Name`, `Rep_x0020_Email`, `Payee_x0020_Email`, `Payee_x0020_Role`, `Event`, `Amount`, `Earned_x0020_On`, `Status`, `Void_x0020_Reason`, `Disputed`, `Dispute_x0020_Note`, `Payout_x0020_Batch`, `Paid_x0020_On`, `Payer`, `Test`, `Company`, `Sent_x0020_On`, `Office_x0020_Check`. Ledger Settings: the names in "Shared switches" and "Amount settings". Sign Log: `Case_x0020_ID` (unique), `Started_x0020_On`, `Plan_x0020_Manager`, `Plan_x0020_Rep_x0020_Sign`, `Handled_x0020_On`. Ledger Run Errors: `Case_x0020_ID`, `Step`, `Failed_x0020_At`, `Resolved`. Service Cases and Referrals: the names in field-site memory and 7F (`Qualified`, `Not_x0020_Qualified_x0020_Reason`, `Closed_x0020_Reason`, `Partner_x0020_Status`, `Signed_x0020_Date`, `Service`, `Test`, `Referral`; `Source`, `Referring_x0020_Rep_x0020_Email`, `JDEAccount`, `PracticeName`, `CustomerName`, `Solutions`, `Test`, `Created`). Team Roster: `Title` is the rep email, `field_3` the manager email, `field_5` Active, as 1F reads them |
| B3 | Payer column | Text, not choice. 1F (new site) reads `Payer` as text and sends it to the site as `company`. A choice column would reach the site as an object |
| B4 | HSBS 10 answer | **202, not 200.** Power Automate refuses a Response action on a request trigger with concurrency control, and the one-writer rule needs concurrency 1. So HSBS 10 has no Response step and the caller gets 202 at once. This replaces every "answers 200 `{"ok":true}`" line in F4.3, F4.4 and F4.6. A 202 does not say the run finished: HSBS 10 records its own failures in Ledger Run Errors (Step starts `HSBS 10:`), and 10D learns that its runs finished from the Ledger Pass Log (B9). 10S counts any 2xx as sent and records a failed post itself (Step starts `HSBS 10S:`). Waiting runs: up to 100 |
| B5 | Forced failures | A failed settings check or a missing Referrals row fails the run on purpose (steps `Check_settings`, `Check_ref`), so it is recorded in Ledger Run Errors before any write |
| B6 | Trigger | 10S: "When an item is created or modified" on Service Cases, with a trigger condition so only `HealthFirst` and the staffing value start a run. It posts `{"caseId": <ID>}`. The HSBS 10 address is pasted into 10S's HTTP step by Brian, with Secure inputs on |
| B7 | Run record | Each HSBS 10 run ends with a `Result` step (company, TEST, no-pay reason, sign handled, roster conflict, manager) so a check reads one step |
| B9 | How 10D knows its posts finished | A 202 says only that HSBS 10 queued the run. So a 10D catch-up post also sends `passId` (`catch-up-<the catch-up row's ID>`). HSBS 10 writes one Ledger Pass Log row (`Pass_x0020_ID`, `Case_x0020_ID`, `Finished_x0020_At`, `Outcome`) at the end of every run that carries a `passId`: `done`, `ended` (an End step: not a company, not rep app, no rep, not TEST, no case) or `failed`. Since 11/22 the row also has `Reason` (what the run wrote, or why it wrote nothing). A run without `passId` (a 10S save) writes none. F4.6 step 1 counts these rows |
| B8 | Not built in P2 | 10D (P3, see the P3 build record), 10B and 10P (P6), Payout Batches (P6). Rule G and the X lists are not in HSBS 10 |

**Known follow-up for staffing (before `StaffingAwardsOn`).** 1F (new site) sends `Payer` as
the row's `company`. A staffing row's Payer is `Direct Dental`, which the site reads as an
unknown company, so the line shows no company name. Staffing awards stay off in P2. Fix 1F to
send `Company` before group S.

**Offline model.** The generator's test file runs HSBS 10's definition against a fake
SharePoint: 61 checks covering A3, A4, A7, H1 to H4, H6 to H15, H17, H26, H29, H33, H34, the
staffing switch, the M27 manager TEST rule and the Ledger Pass Log. All pass, with `if`, `and` and `or` evaluated
either lazily or eagerly. It is a model, not Power Automate; the live checks below still rule.

**Live checks in P2** (TEST rows only; partner saves through the TEST partner page):

| # | Sheet check | What | Pass |
|---|---|---|---|
| P2-1 | A1, A3 | The setup email | No problems; every list and column named in B2 exists |
| P2-2 | A3 | First HSBS 10 run | `Settings read` shows LedgerTestOnly Yes, StaffingAwardsOn No, RealPayoutsOn No, 100 / 0 / 50 / 100 / 50; trigger concurrency 1 |
| P2-3 | A4, A5 | Any non-TEST case save | Run ends at `End_not_test`; no write anywhere |
| P2-4 | H1 | TEST HealthFirst lead: `trying`, then `qualified` | No row, then one K_R Waiting $100, Company and Payer `HealthFirst`, Test Yes |
| P2-5 | H8, H9 or H10 | Same lead: `signed` | One K_M at $50 (Waiting to the TEST manager, or Void with the no-manager reason), Sign Log Handled On set, no second K_R |
| P2-6 | H3 | Second TEST lead: `dq_noanswer` | One K_R Void, reason `HealthFirst marked this lead as not qualified (...)` |
| P2-7 | H7 | Brian sets Qualified No on the P2-4 case | K_R and K_M Void with the same reason |
| P2-8 | H12 | Third TEST lead, same JDE as P2-4: `qualified` | K_R Void, reason `this office was referred to HealthFirst in the last 12 months` |
| P2-9 | A3, A7 | Brian blanks `HF_Manager`, then a TEST case is saved | Run fails before any write, one Ledger Run Errors row; restore 50, mark it resolved |
| P2-10 | A8 | Run history | HSBS 10 and 10S have no email step |

**Moved out of P2.** To P3 (10D): A3 for 10D, A6 (a save and the catch-up posting the same
case at once), H16, H18, H28, H35, and every "listed X.." part of a check. To P6 (10B, 10P):
A3 for 10B and 10P, H5 and H6 live (they need a TEST batch made Paid), H19 to H25, H27, H30
to H32, H36. The rest of group H runs live in P5 with the reconcile, against the offline model's
results.

Builder: BB2 (decision 91).

Checked against BB2 step 1 facts v2 (11/13): R2, R8, F3-0.5, F3-0.6, and the v2 decision 97
checks (3F's Test_mode reads the row's Test; no Test column on Service Cases). See "Step 1
facts" under "Stop rules".

**Read the live flows and lists first. Before building any step, BB2 reads (read only) the
SPIFF Ledger, every flow that reads or writes it, and every Service Cases, Referrals,
Rep Roster, Team Roster and Routing column this sheet names, and writes every "BB2 records
before building" line in the build report. If any stop rule holds, BB2 builds nothing and
reports which rule and why. This is money: where this sheet does not give a value, BB2
stops and asks. He never guesses.**

Written 11/13/2026 by Claude for BB2, from the approved spec "Field two-track app: team
members and managers (v1)" (`docs/build/field-two-track-spec.md`, approved by Brian 11/13:
"approve the spec"). Section numbers (4, 6, 9, 10, 13), check names (M1 to M27) and the
letters T and D are that spec's and rep app v3's (`docs/build/healthfirst-rep-app-spec.md`). This
sheet builds row F4 of spec section 9 and the F4 items of section 13. It also follows
`docs/build/rep-app-flow-contracts.md` ("HSBS 1R earnings", "Manager pay (HSBS 10)"), sheets F1,
F2 and F6 in `docs/build/field-two-track-flow-contracts.md`, `docs/threat-model.md` T9 to T11, the
plan keys in `src/lib/rep-pay-plan.mjs` (PR #113), and decisions 65, 73, 75, 76, 77, 82
and 84 (`docs/claude-code/DECISIONS.md`; 75 to 84 as recorded on PR #121).

This is a build sheet. BB2 builds it in Power Automate and SharePoint. The repo never edits
a flow. It never contains a flow URL, key, email address or phone number, and neither does
the build report.

## P3 build record: HSBS 10D (11/21/2026)

Built by Claude in the thread "Build daily pay pass" as one importable package that Brian imports,
"HSBS 10D Daily pass (new site)", from the same generator as P2 (`pay-ledger/` in the
project files). Where this record and an older line in F4.6 differ, this record wins for 10D.

| # | What | Built |
|---|---|---|
| D1 | Trigger | Recurrence, every day, 7:00 AM, Eastern Standard Time. Trigger concurrency 1, so a hand run and the 7 AM run never overlap |
| D2 | Settings | Same read and amount check as HSBS 10 (`Settings read` step). A bad row: one Ledger Run Errors row (Step `HSBS 10D: Check_settings`), no catch-up and no posts, the lists in safe mode (TEST only, staffing off), the email still goes, and the run ends Failed |
| D3 | Reads | Rep Roster, Service Cases (`HealthFirst` and the staffing value), Ledger, Sign Log, open Ledger Run Errors and Active Team Roster rows, each one Get items of up to 5,000. Referrals is read in 5,000-ID windows from 1 to the highest ID, every source (X17 needs the other rows), and step 1 keeps `Source` `Rep app` |
| D4 | Catch-up row | Ledger Run Errors, Title `HSBS 10D catch-up`, Step `catch-up <Eastern date>`, Case ID 0, Resolved No. Pass ID `catch-up-<row ID>` |
| D5 | Posts | Each rep app case (TEST only while `LedgerTestOnly`) to HSBS 10 with `caseId` and `passId`, one at a time. HTTP retry policy off; any 2xx is accepted. A 429 waits 30 s, up to 10 tries. Any other answer: a Ledger Run Errors row (`HSBS 10D: post to HSBS 10 answered <code>`), and the loop goes on. 5,000 or more cases read, or more than 5,000 to post: nothing is posted, an S12 row is written |
| D6 | Wait | Every minute, count Ledger Pass Log rows for the pass ID, at most 120 minutes. The catch-up row is marked Resolved Yes only when every window was read, every post was accepted, the count reached the accepted posts, and no row is `failed`. Else it stays open and X1 lists it |
| D7 | X3 clock (record 7) | The field-site Service Cases has no Talked On column (read 11/21). X3's clock starts at Last Partner Update; a reached case with no Last Partner Update is listed from the first day. Reached means Talked To Doctor `Yes` or Partner Status `Reached` |
| D8 | Open | A case is open while Closed Reason is blank and Partner Status is not one of 7F's closed words (record 5) |
| D9 | Five business days | Today (Eastern) minus 7 days, or minus 6 on a Saturday. Holidays are not skipped |
| D10 | X19 | Payout Batches does not exist yet (P6). X19 reads `None (the Payout Batches list is made with HSBS 10B)` until 10B adds the list and 10D reads it |
| D11 | Lines | List, Referral ID, case ID, company in words, practice name, rep email, then the list's extra. Ledger lines add the Award Key. No amounts; no customer name, phone or email; the X10 note word for word. `TEST ` prefix; while `LedgerTestOnly` the email opens with one line saying only TEST lines are listed |
| D12 | Failure | Every step sits in one scope. If it fails: a Ledger Run Errors row (Step `HSBS 10D: <steps>`) and a short email to Brian, then the run ends Failed |
| D13 | Import and HSBS 10 address | Brian imports the package, pastes HSBS 10's address into `Post_case` (copy button on HSBS 10's trigger), saves and turns 10D On, as he did for 10S. Secure inputs are on in the package. The address is never printed or stored |
| D14 | Text bodies (added 11/21 after the first live run) | Every SharePoint "Send an HTTP request" body is one JSON text with `@{...}` parts, not a JSON object. The new flow designer turns an object body into text when you Save, and then a value written as `"@utcNow()"` goes to SharePoint as the literal words and SharePoint answers 400 (first hand run 9:08 PM, `Create_catchup`). A text body reads the same before and after a Save. P5a moved HSBS 10 and 10S to the same form (see the P5a build record) |

**Offline model.** `test_10d.py` runs 10D with HSBS 10 behind its HTTP step: 47 checks
covering A3 and A6 for 10D, H16, H18 (X8 part), H28 (freeze line, open catch-up row), H35,
the first hand run on the TEST rows, 500, 429 and silent-run handling, and every list. All
pass with `if`, `and` and `or` evaluated lazily or eagerly. HSBS 10's 61 checks still pass.

**Live checks in P3** (TEST rows only):

| # | Sheet check | What | Pass |
|---|---|---|---|
| P3-1 | A3 | First hand run | `Settings read` shows the P2 values; trigger concurrency 1 |
| P3-2 | Step 1 | Same run | Posts every TEST rep app case (today 42, 43, 44); one Pass Log row each, `done` or `ended`; no new ledger row; catch-up row Resolved Yes |
| P3-3 | Step 3, H28 | The email | One email to Brian, subject `HSBS ledger exceptions <date>`; X1 starts with the freeze line; X10 lists case 44; no amount |
| P3-4 | A6 | A case saved while the pass posts it | One ledger row only |
| P3-5 | A3 | A blank amount, then a hand run | Error row `HSBS 10D: Check_settings`, no posts, email still sent; restore, mark resolved |

**P3 live results** (11/21, second hand run 9:24 PM ET; the 9:08 PM run hit the D14 bug and
left no rows):

- P3-1 pass. `Settings read` matched the Live row, `amountsOk` true; concurrency 1 from the package.
- P3-2 pass. Catch-up row `catch-up 2026-11-21` created, three Ledger Pass Log rows (cases 42,
  43, 44, `done`), no new ledger row, catch-up row Resolved Yes. Real cases not posted.
- P3-3 pass. One email to Brian, TEST-only opening line, X1 starts with the freeze line,
  X10 lists case 44, no amounts.
- P3-4 and P3-5 moved to P5b (TEST reconcile). Both are covered offline in `test_10d.py`.

## P5a build record: HSBS 10 and 10S safe to save (11/21/2026)

Built by Claude in the thread "Make pay flows safe to save", from the same generator.

| # | What | Built |
|---|---|---|
| T1 | Bodies | All 16 SharePoint write bodies in HSBS 10 and the one in 10S (`Record_post_failure`) are text bodies, as D14. Numbers (case ID, amount, sign log plan amounts) are written bare. Booleans that come from an expression (the ledger row's `Test`) are written as `true` or `false` through `if(...)`, because a boolean turned into text reads `True`, which is not JSON |
| T2 | Escaping | Text from people (practice name, a partner's not-qualified reason, emails) is escaped for JSON: backslash, double quote, CR, LF and tab. A raw quote or line break would make the whole body invalid and the write would fail. 10D keeps its live form (double quotes dropped) until its next import |
| T3 | Import | Both re-imported as Update over the same flows. HSBS 10's address did not change (10D's `Post_case` still matches it). 10S got the address again by the copy button, checked by yes/no tests only, and the clipboard was cleared |
| T4 | Saved in the designer | Both flows were opened and saved in the new designer after the import, then turned On, so the live definitions are the post-Save form |
| T5 | Rollback | The package before this change is kept in the project files (`pay-ledger/rollback/p5a-generator-before`). Import it as Update to undo, then paste the address into 10S again. Never Save the old package in the designer |

**Offline model.** `test_10.py` now has 71 checks (10 new): every SharePoint body in 10 and
10S is text with no bare `@` value; a practice name and a not-qualified reason holding a
quote, backslash, line break and tab are written unchanged; `Test`, `Amount` and the case
ID land as JSON true and numbers; a real case lands `Test` false; 10S posts the case ID and,
when HSBS 10 answers 500, writes one error row with the case ID and the answer code. The
two text-body checks fail on the old package. `test_10d.py` still passes 49 of 49.

**Live checks in P5a** (TEST rows only, 11/21 ET):

| # | What | Result |
|---|---|---|
| P5a-1 | 10S error-row step: HSBS 10 turned Off, TEST case 43 saved | Pass, 10:19 PM. 10S run Failed as designed; Ledger Run Errors row `HSBS 10S case 43`, Case ID 43, Step `HSBS 10S: post to HSBS 10 answered 400`, Resolved No. Marked Resolved Yes, HSBS 10 turned On again |
| P5a-2 | Write after a designer Save: TEST ledger row 8's Award Key renamed `44\|Reached\|Rep\|old-P5a` so the next save writes a fresh row, then TEST case 44 saved | Pass, 10:23 PM. 10S and HSBS 10 runs Succeeded; new ledger row `44\|Reached\|Rep`: Void, reason `HealthFirst marked this lead as not qualified (Other)`, Amount 100, Test Yes, Disputed No, case ID 44, Company and Payer HealthFirst. Same values as row 8 |

Row 8 (renamed key) and row 9 stay as TEST evidence. Ledger Run Errors 1 to 3 are all
Resolved Yes.

## P5b record: TEST reconcile, group H live (11/21/2026)

Run by Claude in the thread "Reconcile TEST pay rows", 10:32 to 11:16 PM ET, on TEST rows
only. Every result matches `sim.py` (`test_10.py` 71 of 71, `test_10d.py` 49 of 49) unless a
note says otherwise. LedgerTestOnly stayed Yes and `REP_PAY_ENABLED` stayed off in production
the whole time.

**How.** TEST leads were sent from the TEST rep (Rep Roster `Test Fieldsite`) through the
preview's `/api/referral`, and partner answers went through the preview's `/api/partner-save`
with the TEST partner key. Hand edits (the "Brian sets ..." steps) were SharePoint REST writes
from a page on the field site, which work now. HSBS 10D was run by hand from its flow page.
Lists were read by REST; the 10D email was read in Brian's mailbox.

**TEST data used.** Referrals 66 to 82 (`TEST P5b Office A` to `S`, JDE 999511 to 999523 and
999902), Service Cases 45 to 62 (case 60 was the H26 second case, now in the recycle bin),
ledger rows 10 to 31, Sign Log rows 2 to 9, Ledger Run Errors 4 to 10 (all Resolved Yes).
Team Roster rows 704 (`brian.gohr+field1118` to `brian.gohr+test.north`, Active Yes) and 705
(same rep to `brian.gohr+test.south`, Active No) are TEST pairs added for H9 and H29.

| # | Sheet check | Live result |
|---|---|---|
| P3-4 | 10D with a blank amount (`HF_Signed` blanked) | Pass, 10:35 PM. 10D run Failed in 12 s, Ledger Run Errors 4 `HSBS 10D settings`, Step `HSBS 10D: Check_settings`. No catch-up row, no post (Pass Log unchanged). The run still mailed Brian. Restored 0 at 10:36 PM, row 4 Resolved |
| P3-5 | 10D post that HSBS 10 answers with an error | Pass, 10:37 PM. HSBS 10 turned Off. 10D posted cases 42, 43, 44; each answer 400 was recorded (rows 6 to 8, Step `HSBS 10D: post to HSBS 10 answered 400`) and the loop went on to the next case. Catch-up row 5 stayed open; the run Succeeded and the email listed all four rows under X1. HSBS 10 On again 10:38 PM, rows 5 to 8 Resolved |
| H2 | Qualified Yes by hand with Talked To Doctor blank; Talked To Doctor Yes alone on another | Pass. Case 49: K_R Waiting $100 (row 12). Case 45: no row |
| H4 | `qualified`, then Qualified No with reason by hand | Pass. Case 46: K_R Waiting (row 13), then Void, `HealthFirst marked this lead as not qualified (No permission to contact)`; no K_M |
| H8 | Partner Status Signed and a Signed Date by hand with Qualified blank; `signed` through 7F on another | Pass. Case 45: no row, listed X6 (10:51 PM email). Case 48: K_R Waiting $100 and K_M Waiting $50 from one run (rows 14, 15, 3 s apart) |
| H9 | Sign for the TEST rep with one Active Team Roster row | Pass. Case 48: K_M Waiting $50, Payee `brian.gohr+test.north`, Test Yes, Sign Log Handled. Saving again and the 10:47 PM 10D pass wrote nothing new |
| H10 (tail) | Pair added after a no-manager sign, case saved | Pass. Case 42 saved after row 704 was added: nothing new (row 6 stays Void) |
| H11 | Closed Reason `Already a customer` before any award | Pass. Case 47: K_R Void `Already a customer` (row 16); no K_M |
| H13 | Earlier referral for the JDE naming HealthFirst and staffing, then a rep app case qualified and signed | Pass. Referral 80 (JDE 999523) set to both companies before case 61 existed. Case 61: K_R Void on create (row 17), then K_M Void (row 20), reason `this office was referred to HealthFirst in the last 12 months`. Its sign first hit the H29 roster conflict (row 705 was briefly Active) and wrote its K_M after the fix |
| H14 | Plan 0 / 150 / 50: H11 again, H13 again, a clean sign | Pass. Case 53 (Already a customer): no K_R. Case 62 (JDE 999523 again, signed): no K_R, K_M Void and K_S Void (rows 23, 24). Case 58 (clean sign): K_M Waiting $50 (row 21) then K_S Waiting $150 (row 22); Sign Log 50 / 150 |
| H15 | Referral Source changed by hand (to `Internal Jotform`), case signed, then Qualified No | Pass. Case 54: no row either time; 10D does not post it (step 1 keeps `Rep app`) |
| H17 | Hand back with a note after a Waiting K_R; hand back with no award | Pass. Case 49: K_R still Waiting $100, unchanged. Case 51: no row after the save or the 10D passes. (The batch half waits for 10B in P6) |
| H26 | Second TEST Service Case on the same referral and company | Pass. Case 60 added (Qualified Yes): no new row; X15 listed cases 46 and 60 (10:51 PM email). Case 46 then marked Qualified No: its K_R Void (H4). Case 60 sent to the recycle bin; X15 None at 11:14 PM |
| H29 | Two Active Team Roster rows at a sign, then one set Active No and the case saved | Pass. Case 55: K_R Waiting, Sign Log plan 50 / 0, Handled blank, no K_M or K_S, listed X18. After row 705 Active No and a save: K_M Waiting $50 to `brian.gohr+test.north` (row 19), Handled set, X18 None |
| H33 | Sign handled once | Pass. Case 48 signed under 100 / 0 / 50: one K_M, Sign Log 50 / 0, Handled. With `HF_Signed` 150, case 48 saved: no K_S. With `HF_Manager` 0, case 56 signed: Sign Log 0 / 0 Handled 7 s after start, no K_M; `HF_Manager` back to 50, case saved and the 11:11 PM 10D pass run: still no K_M |
| H34 | Sign not finished | Pass, with a note. The K_S write was made to fail by a temporary list validation on SPIFF Ledger (`=NOT(AND([Event]="Signed",[Payee Role]="Rep"))`), not a Terminate step, so no designer edit was needed. Case 57 under 0 / 150 / 50: K_M Waiting $50 (row 25), no K_S, Sign Log Handled blank. Validation removed at 11:05 PM: the write succeeded on its next retry, K_S Waiting $150 from the stored Plan Rep Sign (row 26), Handled set, no second K_M |

**Notes.**

- H34: SharePoint's validation refusal reaches the flow as 502 (BadGateway), which the
  connector's default retry policy retries. The run sat in `Create_K_S` retries for 11
  minutes and held HSBS 10's one-run queue until the validation was removed, so no Ledger
  Run Errors row was written and X1 / X20 were not seen live for this case. P2-9 already
  proved the error-row path live. Not a defect: a real SharePoint outage is the case the
  retry is for. Cancelling a run from the run page opens a browser confirm box that
  blocks the page; do it by hand, not from a driven browser.
- Plan switch: after `HF_Qualified` went back to 100, the next HSBS 10 run for each
  Qualified Yes case signed under `HF_Qualified` 0 wrote its missing K_R (rows 27, 29, 30,
  31 for cases 57, 53, 58, 62). That is the rule (the catch-up writes a missing K_R, H35)
  and why the freeze line says not to change a pay plan while anything is listed.
- Not run live, with reasons: H16, H18, H28 and H35 were moved to P3; H5, H6, H19 to H25,
  H27, H30 to H32 and H36 need HSBS 10B and 10P (P6). H17's batch half and H7's batch half
  wait for 10B too.

**Reconcile (11:16 PM).** SPIFF Ledger has 31 rows, all Test Yes. The TEST rep
(`brian.gohr+field1118`) has 27 rows: 8 Waiting rep rows totaling $900 (rows 12, 14, 18,
27, 28, 30 at $100; rows 22 and 26 at $150), no Paid rows, the rest Void. Each Waiting row
matches its check above. Manager rows Waiting for `brian.gohr+test.north`: 15, 19, 21, 25 at
$50 (plus old TEST row 3 at $25). Ledger Settings `Live` is back to 100 / 0 / 50 / 100 / 50,
LedgerTestOnly Yes, StaffingAwardsOn No, RealPayoutsOn No. No Ledger Run Errors row is open.
SPIFF Ledger has no validation formula.

**Earnings agree (11:20 PM).** On the preview of this PR's branch, with a branch-only
`REP_PAY_ENABLED=true` (production still off), `/api/earnings` for the TEST rep returned
Total earned $900, Awaiting payment $900, Paid $0, Pending review $0: the same as the ledger
sum above. The branch-only flag is deleted after this PR.

## P5c record: pay on in production (11/21/2026)

Run by Claude in the thread "Turn on real pay in production", TEST people only.

- `REP_PAY_ENABLED` changes only what `/api/earnings`, `/api/team` and the Earnings screens
  read and show (`repPayEnabled` in `src/lib/register-flow.mjs`). The site sends no mail, so
  turning pay on emails nobody.
- 11:21 PM ET: Vercel `hsbs-hsd-field` env `REP_PAY_ENABLED` = `true`, Production only.
  Preview has no general copy, so pay stays off on previews.
- 11:22 PM ET: production redeployed (commit 0024646), READY on `hsbs-hsd-field.vercel.app`.
  Smoke: `/j` 302 to `/join?src=qr`, `/join` 200, TEST rep `/refer/<key>` 200.
- TEST rep production `/api/earnings`: earned $900, awaiting $900, paid $0, pending review $0.
  Matches the P5b reconcile.
- Real reps read $0 earned, $0 awaiting, $0 paid, plus the plan promise. Every SPIFF Ledger row
  is Test Yes, and LedgerTestOnly Yes keeps HSBS 10 and 10D from writing a non-TEST row.
- LedgerTestOnly stays Yes until the Dec 4 release (build order step 6: Brian's go, groups G
  and S, and P2-3 on the first real save Monday 11/23).
- The two branch-only `REP_PAY_ENABLED` copies from P4 and P5b (`false`, Preview only, on
  merged branches) were removed in the Vercel dashboard on 11/22/2026 at 8:30 AM ET. Only the
  Production `true` copy remains.
- Undo: set `REP_PAY_ENABLED` to `false` (the app reads only exactly `true`), then redeploy
  production.

## Brian's decisions this sheet rests on (11/13)

**Gate G0: this sheet is not built until PR #121 is merged to `main`.** Decisions 75, 76,
77, 82 and 84 below are recorded in `docs/claude-code/DECISIONS.md` on PR #121, which is
not merged as this sheet is written. Until it is, BB2 builds nothing from this sheet and
says so in the build report. Brian or Claude tells BB2 in writing when #121 is merged,
with its merge commit.

| # | Decision, with Brian's words | What it means here |
|---|---|---|
| 65 | Pay needs reached and qualified, for both partners | **Replaced 11/21 (R4):** the award is written when Qualified is Yes. 7F sets Talked To Doctor Yes with every Qualified Yes |
| 73 | A group is 3 or more locations | Sets pay again since 11/22 (R5): the rep's `Group` pick pays `ST_Qualified_Group` ($200) |
| 75 | Matt Penny at Direct Dental gets the staffing payout list. Direct Dental pays the staffing awards (T13). His address goes into Routing in SharePoint, never into the repo. Brian: "Matt Penny for the payout list too" | The staffing payout batch is built here (F4.7). Its recipient is read from Routing |
| 76 | Katy knows staffing goes to field sales before 12/31, and staffing award pay is cleared as HealthFirst's was on 11/8. Brian: "Already cleared" | Nothing in this sheet waits on Katy |
| 77 | The manager and plan on file when the pay run handles a sign are the ones that count. Nothing is stamped at the sign. Brian: "Keep today's process" | The sign run reads the Team Roster and the amounts as they are when it runs (F4.4, rule B) |
| 82 (no longer gates pay, R5) | The partner confirms the practice type when answering "Does this lead qualify?". The partner page stops preselecting the rep's pick, and 7B stamps Award Practice Type only from that confirmation. Both land before F4 turns staffing awards on. Brian: "Yes, partner confirms it" | Staffing award creation sits behind `StaffingAwardsOn`, off by default, and stays off until that follow-up is live (gate G3) |
| 11/21 | Real dollars on Dec 4. HealthFirst and Direct Dental pay the rep $100 per qualified lead and the manager $50. One promo file per promotion. Brian's words are under "Field site refresh" | R4 to R7. Manager $50 at the sign (Brian's pick on the card, 11/21) |
| 90 | In the 12 month once-per-office check, TEST and real referrals never block each other: TEST rows check only against TEST rows, real only against real. Brian: "Never block each other" | W11 rule 1 |
| 84 (retired with rule G, R5) | A staffing case signed in the turn-on gap is fixed by Brian in SharePoint, setting Qualified and Award Practice Type together. Brian: "Yes, I fix it in SharePoint" | The blank Award Practice Type guard lists the case until he does (F4.4 rule G, list X4) |

## What this sheet builds

| Piece | What it is | Writes |
|---|---|---|
| SPIFF Ledger | On the field site. New column Company (Practice Type is not added, R5). Payer gains `Direct Dental`. Existing rows get Company and Payer filled once | F4.1, F4.2 |
| HSBS 10 | **The one ledger writer.** An HTTP flow that takes one Service Case ID, reads the case fresh, and writes or voids its ledger rows. One run at a time (trigger concurrency 1) | Ledger rows only |
| HSBS 10S | On a Service Case save (created or modified), sends that case's ID to HSBS 10 | Nothing |
| HSBS 10D | Every day at 7:00 AM Eastern: sends each rep app case to HSBS 10, then emails Brian the ledger exceptions | Nothing but its email to Brian |
| HSBS 10M | The monthly payout list to Brian, who forwards it to Alexa, and the hand flow that marks a confirmed batch Paid (10M build record). Replaces 10B and 10P | Payout Batch, Sent On, Status (to Paid) and Paid On on ledger rows, and the list email to Brian |

**Why one writer.** Every ledger write goes through HSBS 10, and HSBS 10 runs one request
at a time. A save and the daily run can never decide the same case at once, so two runs can
never both find "no row yet" and both write (T9). HSBS 10 reads every fact from SharePoint
itself: a caller sends only a case ID, so a stray or forged call can make HSBS 10 look at a
case, never set an answer, an amount or a payee (T10).

## Stop rules

BB2 checks each before building, and again before each go in "Build order" (S1 and S2 as
noted). If one holds, he builds or turns on nothing further and reports it.

| # | Stop when | Why |
|---|---|---|
| S0 | PR #121 is not merged to `main` (gate G0) | Decisions 75, 76, 77, 82 and 84 are not yet on `main` |
| S1 | Any flow other than the HSBS 10 this sheet builds (and 10M, by the columns in the 10M build record, M7) writes the SPIFF Ledger and is turned on | A second writer breaks the one-writer rule. Brian decides what happens to it |
| S2 | Before go-live (build order step 6): the SPIFF Ledger holds any row with Status `Paid` or `Pending review`, or any row with Test = No other than the TEST rows cleared by hand in checks H19 and H25. After go-live, only `Pending review` stops | No payout has run and HSBS 10 was never built (`docs/build/rep-app-flow-contracts.md`, "Open before pay goes live"). Such a row means something paid or wrote real money already |
| S3 | Award Key is not set to "Enforce unique values", and cannot be set because two rows share a key | The unique key is what stops a second row (D6) |
| S4 | Any flow has a trigger on the SPIFF Ledger | A ledger write would start it, and it might send mail |
| S5 | Service Cases on the field site is missing any of: Qualified, Not Qualified Reason, Closed Reason, or BB2 cannot name the exact Service Cases column for: `Service` (the company), Talked To Doctor, Partner Status, Signed Date, Last Partner Update, Test, and the `Referral` lookup to its Referrals row (R9, R10). Award Practice Type is not needed (R5) | HSBS 10 reads every one of them |
| S6 | Closed Reason is stored on Referrals, not on the Service Case (sheet F2, "BB2 records", item 2) | Two companies on one referral would share one reason |
| S7 | Referrals on the field site is missing, or BB2 cannot name exactly: Title (the referral ID, `HSBS-F<n>` or `HSBS-A<n>`), Source, Referring Rep Email, `JDEAccount` (text), PracticeName, CustomerName, Solutions, Introduced On, Test, Created, `RepPracticeType` (R5) | HSBS 10 reads every one of them |
| S8 | The HSBS 10 HTTP trigger cannot be set to a concurrency limit of 1 | The one-writer rule needs it |
| S9 | The address HSBS 10D or 10M would send Brian's mail to is not the Brian address a live HSBS flow already sends Brian-only mail to (for example the daily gap check) | No new recipient (`AGENTS.md`, check 2) |
| S10 | Routing has no entry holding the staffing payout list contact (decision 75), or it holds more than one address | Only Brian adds a recipient. BB2 never types an address into a flow, the sheet or the report |
| S11 | The live 3F HealthFirst (new site) or 3F Staffing (new site) decides a TEST row with a rule that marks a row Test when this sheet's "TEST case" rule (Words used) would not | A row that gets no live email because it is TEST must never earn real money |
| S12 | The daily catch-up in F4.6 would post more than 5,000 cases in one run | Ask Brian how to split it across days first; never skip a case |
| S13 | Any step needs a value this sheet does not give | Never guess on money |

**Step 1 facts (11/13) and Brian's answers (11/14).** On 11/13 S5 held for Test: Service
Cases had no Test column (v2 check 5), and neither 3F nor HSBS 3 writes Test on a case (fact
F3-0.5). **Decided: decision 101** ("Add a Test column"): sheet F3, Part T adds a Yes/No
Test column, default No, and 3F copies the Referrals row's Test onto each field or FSC case
it makes. "TEST case" (Words used) and exceptions X11 and X16 read that column, and pay
filters on it. S5 is checked again once Part T is built. On Closed Reason: 7B wrote none
anywhere (fact R2). **Decided: decision 102** ("Service Cases column"): the Closed Reason
column is on Service Cases (sheet F2, F2.4), written by 7B on a close of a field or FSC
case, so S6 does not hold once F2.4 is built. Every rep app case is a field case. S11 does
not hold since 11/13: 3F's Test_mode reads the Referrals row's Test (decision 97), which
"TEST case" already covers; before 11/13 it was the literal `true`.

## Rules for every step

1. Build each new flow turned off. Turn one on only at its step in "Build order".
2. TEST rows only while testing (decision 48): a Referrals row with Test = Yes, TEST in the
   practice name, a made-up contact, its Service Case under the TEST Partner link, sent by
   a TEST rep (Rep Roster Test = Yes). BB2 deletes TEST rows, cases and ledger rows when the
   checks are done and reported.
3. No live sends. Nothing in this sheet emails a rep, a manager, a partner or a customer.
   HSBS 10D and 10M email Brian only (10M replaces 10B and 10P, so no payout list goes to a
   payer). No dollar amount goes in any email to a rep or a manager (D15).
4. No new recipient beyond those two, and no address typed into a flow.
5. No secrets anywhere: no flow URL, key, token or password in a sheet, report, Status Log
   line, test note or commit. HSBS 10's trigger URL lives only in the HTTP steps of 10S and
   10D, with Secure inputs on.
6. Escape `'` as `''` in every Filter Query. Compare emails with `toLower` and trimmed.
7. Every Get items step has a Filter Query on an indexed column or a Top Count, and
   pagination where more than 100 items can come back. Nothing may fail past 5,000 items.
8. HSBS 10 never writes Service Cases, Referrals, the Rep Roster, the Team Roster or
   Routing. It writes ledger rows, Sign Log rows and Ledger Run Errors rows, nothing else.

## Words used in this sheet

- **The two companies.** One table ties every name together. Nothing else maps them.

  | Company key (ledger Company) | `Service` value on the case, exactly | Name in words (void reasons, lists) | Payer (ledger Payer) |
  |---|---|---|---|
  | `HealthFirst` | `HealthFirst` | HealthFirst | `HealthFirst` |
  | `Staffing` | `HS Staffing / Recruiting Services (including GoTu)` | Direct Dental | `Direct Dental` |

  A case whose company column holds any other value is not a company in this sheet, and
  HSBS 10 writes nothing for it.
- **A rep app case** is a HealthFirst or staffing Service Case whose Referrals row has
  Source exactly `Rep app`. Only a rep app case can have a ledger row (T24, M13).
- **The rep** is the Referrals row's Referring Rep Email, trimmed and lowercased.
- **Reached**: Talked To Doctor is exactly `Yes`.
- **Qualified**: Qualified is exactly `Yes`. **Not qualified**: Qualified is exactly `No`.
- **Signed** (R10): Partner Status is exactly `Signed` or `Close won`, and Signed Date is
  set. 7F's `signed` choice writes both, with Qualified Yes.
- **Open**: the case passes the test 7F uses to list it: its Partner Status is not one of
  7F's closed words (`Signed`, `Not moving forward`, `Hand back to HSBS`, `Close won`,
  `Close loss`, `Returned to HSBS`).
- **Award type**: retired 11/21 (R5). HSBS 10 never reads Award Practice Type. Since 11/22 it
  reads the Referrals row's `RepPracticeType` only to pick the staffing amount (R5). Where an older line below says "with a valid award type", read it as
  always true.
- **TEST case**: any of these holds: the Referrals row's Test is Yes; the Service Case's
  Test is Yes; the rep's Rep Roster row has Test = Yes; the Referrals PracticeName or
  CustomerName contains `TEST` in capitals (D8).
- **TEST person** (rep or manager): their Rep Roster row has Test = Yes, or `test` appears
  in their roster name or email in any letter case (`docs/build/rep-app-flow-contracts.md`,
  lookup step 1).
- **TEST pair**: a Team Roster row with `test` in both emails, in any letter case. It
  counts only when the rep is a TEST person.
- **Eastern date**: `convertFromUtc(utcNow(), 'Eastern Standard Time', 'yyyy-MM-dd')`.
- **Business day**: Monday to Friday, by Eastern date. "N business days after a date" counts
  weekdays strictly after that date. An intro on a Monday is five business days old on the
  next Monday.
- **The three keys** of a case with Service Case ID `<id>`:

  | Key | Award Key, exactly | Event | Payee Role |
  |---|---|---|---|
  | K_R | `<id>\|Reached\|Rep` | `Reached` | `Rep` |
  | K_M | `<id>\|Signed\|Manager` | `Signed` | `Manager` |
  | K_S | `<id>\|Signed\|Rep` | `Signed` | `Rep` |

  (`<id>` is the Service Case ID as Sheet 4 Part A defined Case ID; BB2 records it. The `\|`
  in this table is a plain `|`.)

## BB2 records before building

1. Every flow that reads or writes the SPIFF Ledger, with its state (on or off), its
   trigger, and what it writes (S1, S4).
2. The SPIFF Ledger as it is live: every column with its exact name and type, the choices
   on Status, Event, Payee Role and Payer, whether Award Key enforces unique values, which
   columns are indexed, and the count of rows by Status and Test (S2, S3). If the list does
   not exist, say so: F4.1 creates it.
3. How Sheet 4 Part A defined Case ID (the Service Case item ID, or a text ID).
4. The exact Service Cases and Referrals column names in S5 and S7, the type of Solutions
   (text, single choice or multiple choice) and how a row naming two companies stores
   them, and how a Service Case links to its Referrals row.
5. The live 7F closed words, word for word ("Open" in Words used). From the 7F package of
   11/21: `Signed`, `Not moving forward`, `Hand back to HSBS`, `Close won`, `Close loss`,
   `Returned to HSBS`.
6. The live 3F HealthFirst (new site) and 3F Staffing (new site) TEST rule, word for word
   (S11). Recorded 11/13 for the old copies: `equals(triggerOutputs()?['body/Test'], true)`
   (decision 97).
7. Whether the field-site Service Cases has a Talked On date column. If not, X3's clock
   starts at Last Partner Update.
8. Where Brian-only mail is sent from today and to which mailbox, named by flow, never by
   address (S9). The Routing entry for the staffing payout list contact, named by its row
   and column, never by address (S10). Whether Routing has a HealthFirst payout list
   contact (F4.7; Ask Brian A6).
9. How live flows put a failed run in front of Brian today, if any do (F4.4, failure). The
   Ledger Run Errors list is added either way.
10. How many Referrals rows have Source `Rep app`, split by Test, and the highest Referrals
    item ID (S12, F4.6).
11. Retired 11/21 (R5): decision 82's follow-up no longer gates pay.
12. Pre-build check, read only: a TEST `signed` save through 7F leaves Partner Status
    `Signed`, Signed Date set and Qualified Yes ("Signed" in Words used). Read it from one
    TEST case before HSBS 10's signed rule is built.
13. Whether the SPIFF Ledger exists on the field site. 1F (new site) reads it by name; if
    it is missing, F4.1 creates it there, never on the old site.

## What exists today (from the repo)

- **HSBS 10 is not built.** `docs/build/rep-app-flow-contracts.md`, "Open before pay goes live":
  "HSBS 10 is not built, and Sheet 4 is on hold". Brian allowed Sheet 4 Part A alone on
  11/9 (decision log: "the empty pay ledger list, no pay flow, no earnings action"), so the
  SPIFF Ledger may exist and be empty. Not in the repo copy: whether it does (record 2).
- **SPIFF Ledger columns** (rep app v3, section 3, "New flow: HSBS 10"): Award Key (unique:
  Case ID + Event + Payee Role, D6), Referral ID, Service Case ID, Practice Name, Rep Email,
  Payee Email, Payee Role (Rep, Manager), Event (Reached, Signed), Amount, Earned On, Status
  (Pending review, Waiting, Paid, Void), Void Reason, Disputed (yes/no), Dispute Note,
  Payout Batch, Paid On, Payer (HealthFirst), Test (yes/no). No Company and no Practice
  Type.
- **Who reads it:** 1F (new site) `earnings` and `team` (R3; `docs/field-flow-contract.md`), and the
  site, which drops any row whose amount is not a whole number 1 to 1000, whose event is
  not `Reached` or `Signed`, or whose dates are not `YYYY-MM-DD`
  (`src/lib/rep-earnings.mjs`, `sanitizeLedgerRow`). So every row this sheet writes, Void
  rows included, has a whole-dollar amount from 1 to 1000. The site adds the period after a
  Void Reason, so a Void Reason never ends in one.
- **Plan keys** (`src/lib/rep-pay-plan.mjs`): `REP_PAY_PLAN` is the HealthFirst plan,
  set in Vercel to `reached:100,manager:50`; `REP_PAY_PLAN_STAFFING` is set (11/21/2026
  9:35 PM ET, P4; changed 11/22) to `reached_private:100,reached_group:200,manager:50` (R11),
  all three parts required. With equal amounts the site names one amount and no practice type. The
  site's plan words promises only. HSBS 10 reads its own copy of the amounts from Ledger
  Settings (R7), and Brian changes both together from the promo file.
- **Sheets F1 and F2** (on `main`) add Practice Type, Award Practice Type, Qualified, Not
  Qualified Reason and Not Qualified Note to Service Cases, and the Closed Reason choices
  `Not qualified` and `Already a customer`. 7B writes no ledger row (F2, "what must not
  change"). Sheet F6 step F6.4 reads the ledger's Company, which this sheet adds.

## Shared switches: the Ledger Settings list

The three switches are **shared state, never a per-flow variable**, so every flow that acts
on one reads the same value. They live in one row of a new SharePoint list, Ledger Settings
(the field site, `sites/HSBSField`), Title `Live`, with these Yes/No columns and the
amount columns in "Amount settings":

| Column | Value at build | Read by | What it does |
|---|---|---|---|
| LedgerTestOnly | Yes | HSBS 10 (W7), HSBS 10D (step 1 filter and the lists) | While Yes, HSBS 10 acts only on a TEST case and writes nothing for any other, and 10D posts and lists TEST cases only |
| StaffingAwardsOn | No | HSBS 10 (W9), HSBS 10D (X5) | While No, HSBS 10 creates no ledger row for a staffing case (F4.4, step W9); rule V still voids or disputes one written while it was on. 10D lists X5 only while it is No. What turns it on: F4.9 |
| RealPayoutsOn | No | HSBS 10M, both flows (v3.4 Task 2, V5) | The hard stop for every Real 10M mode. While it is not exactly Yes on exactly one `Live` row, a Real List, Resend or Paid stops with one error row and one failure mail to Brian. Stays No until Brian releases the first real payout in writing |
| PayoutDate | blank (Text, added 11/22/2026) | HSBS 10M | The payout day, `YYYY-MM-DD`, used only when it is a real date in the current month; else the last weekday of the month (10M build record, M2). Not a pay switch: Claude changes it when Brian gives Alexa's cutoff |

- In this sheet, a switch "true" or "on" means Yes in this row, and "false" or "off" means
  No. Setting a switch always means editing this row, never a flow.
- **Every run reads the row fresh**, as its first step after the trigger (Get items, Title
  eq `Live`, Top Count 2), and shows the three switches and five amounts it read in a
  Compose step named `Settings read`. HSBS 10S reads none of them: it only forwards a case ID, and HSBS 10
  applies the switches.
- **Fail safe.** No row, two rows, or a blank value: the run uses LedgerTestOnly Yes,
  StaffingAwardsOn No, RealPayoutsOn No, and records a Ledger Run Errors row (X1).
- **Who changes it.** BB2 only, at its step in "Build order" or F4.9, on Brian's go in chat
  quoted in the build report. List permissions: BB2 and Brian may edit; every flow reads
  only. Nobody edits the row while an HSBS 10, 10D, 10B or 10P run is in progress.
- **How BB2 confirms the change took.** Right after each change: post one TEST case to HSBS
  10 (through 10S, by saving it), run 10D by hand, and run a 10B `New` dry run and a 10P on
  an empty or unknown batch (which stops at its checks). In each run's history the
  `Settings read` step shows the new value. BB2 writes the four run times and values in the
  build report. Any flow that shows the old value: set the row back and stop.

## Amount settings on the Ledger Settings row

Number columns on the Ledger Settings `Live` row (R7). HSBS 10 reads them fresh with the
switches. They are plain settings, not secrets. Their values come from the promo file
(`docs/build/field-promo-file.md`). BB2 or Brian changes one only on Brian's word in chat,
after the freeze check and the plan equality check (F4.4, "The freeze"), and the change is
written in the build report.

| Column | Value at build | What it does | Promo file |
|---|---|---|---|
| `HF_Qualified` | `100` | HealthFirst award to the rep when Qualified is Yes. Written as Event `Reached` (`reached` in `REP_PAY_PLAN`) | HealthFirst row, Rep award |
| `HF_Signed` | `0` | HealthFirst award to the rep at the sign (`signed`). 0 in this promotion | HealthFirst row, Rep sign award |
| `HF_Manager` | `50` | HealthFirst manager award at the sign (`manager`, R6) | HealthFirst row, Manager award |
| `ST_Qualified` | `100` | Direct Dental award to the rep when Qualified is Yes and the rep did not pick `Group` (R5). Written as Event `Reached` (`reached_private` in `REP_PAY_PLAN_STAFFING`) | Direct Dental row, Rep award |
| `ST_Qualified_Group` | `200` (added 11/22) | Direct Dental award to the rep when Qualified is Yes, the Referrals row's `RepPracticeType` is `Group` and the case's `OfficeCountConfirmed` is `Yes` (R5). Event `Reached` (`reached_group`) | Direct Dental row, Rep group amount |
| `ST_Manager` | `50` | Direct Dental manager award at the sign (`manager`, R6) | Direct Dental row, Manager award |

**Amount check, every run.** Each amount is a whole number from 0 to 1000; a blank reads
as a failed check, never as 0. `HF_Qualified` or `HF_Signed` is at least 1. A plan may pay
nothing at the sign: the Sign Log records that the sign was handled, so raising the plan
later never pays it (contract, "Open before pay goes live", item 2). `ST_Qualified` and
`ST_Qualified_Group` and `ST_Manager` are each 1 to 1000. Staffing has no award to the rep at the sign. If any of
this fails, the run fails before any write and records an X1 row.

## Build order

1. **Read and record** everything above. Check every stop rule.
2. **F4.1 and F4.2**: ledger columns, then the one-time fill. No flow writes the ledger
   during F4.2 (S1).
3. **Build HSBS 10, 10S, 10D, 10B and 10P**, all off, with the settings at their build
   values.
4. **Turn on HSBS 10, then 10S, then 10D, then 10B and 10P**, with `LedgerTestOnly` true,
   `StaffingAwardsOn` false and `RealPayoutsOn` false in the Ledger Settings row. So nothing can be
   sent to a payer and no Real batch can be marked Paid. 10B and 10P stay on from here:
   they run only when started by hand. Run the TEST checks in groups A, H and G.
5. **After groups A, H and G pass**, and only while `LedgerTestOnly` is true, BB2 sets
   `StaffingAwardsOn` true in the Ledger Settings row and runs group S. Only TEST cases can
   be written while `LedgerTestOnly` is true. He sets it back to false after group S. (The
   decision 82 wait is retired, R5.)
6. **Go live (Brian's go, in chat, quoted in the build report).** BB2 sets `LedgerTestOnly`
   false. Before that: every check in groups A, H, G and S passed; Brian has set
   `REP_PAY_PLAN` on the site to the same HealthFirst amounts as Ledger Settings (spec section 6),
   or said in chat that the mismatch is accepted; and the ledger holds no row with Test =
   No (S2). `StaffingAwardsOn` stays false.
6a. **Real payouts on (Brian's go, in chat, quoted; a separate go from step 6).** BB2 sets
   `RealPayoutsOn` true in the Ledger Settings row. Before that, Brian has named the HealthFirst
   payout contact or accepted the default (Ask Brian A6).
7. **Staffing awards on**: F4.9, a separate go.
8. Sheet F6 step F6.4 may be built once F4.1 is done.

At every step: no protected change (an amount setting in HSBS 10, a pay plan value, a
Team Roster pair) is made unless the freeze check passes right before it ("The freeze",
F4.4).

## F4.1 SPIFF Ledger columns

All lists in this step are on the field site (R1). If the SPIFF Ledger does not exist
there, create it with the rep app v3 columns ("What exists today") plus the ones below,
Award Key set to enforce unique values. If it exists, add:

| Column | Type | Choices, spelled exactly | Required | Default | Fill-in |
|---|---|---|---|---|---|
| Company | Choice (single, drop-down) | `HealthFirst`, `Staffing` | No | none | No |
| Sent On | Date only | none | No | none | No |
| Office Check | Choice (single, drop-down) | `Cleared` | No | none | No |
| LastWriter (shown as Last Writer, added 11/22) | Single line of text | none | No | none | No |

**Two new lists** on the same site, written only by the flows named:

| List | Columns | Written by |
|---|---|---|
| Sign Log | Case ID (number, unique, indexed), Started On (date and time, indexed), Plan Manager (number), Plan Rep Sign (number), Handled On (date and time, indexed) | HSBS 10 only (W16) |
| Ledger Settings | Title (`Live`, one row), LedgerTestOnly, StaffingAwardsOn, RealPayoutsOn (Yes/No), HF_Qualified, HF_Signed, HF_Manager, ST_Qualified, ST_Qualified_Group (added 11/22), ST_Manager (Number, 0 decimals) | BB2 or Brian, by hand ("Shared switches", "Amount settings") |
| Payout Batches | Batch ID (Title, unique), Payer (text), Kind (text: `TEST` or `Real`), Created On, Send Started On, Sent On, Confirmed On (date and time, Send Started On and Sent On indexed), Paid On (date), Send Run ID (text), Rows Sent (multiple lines, plain), Not Paid (multiple lines, plain) | HSBS 10B and 10P only; Brian may clear Send Started On by hand (F4.7) |

Payer: if it is a Choice column, add the choice `Direct Dental`, keeping `HealthFirst`. If it
is text, add nothing and record its type. Status keeps `Pending review` as a choice so the
site's reads do not change; this sheet never writes it.

Indexes (add any that are missing, record which already existed): Award Key, Service Case
ID, Status, Payer, Company, Payout Batch, Sent On, Office Check, Disputed, Test, Rep Email,
Payee Email.

On Referrals, Source, `JDEAccount` and Created must be indexed; on Service Cases,
`Service`, the `Referral` lookup, Qualified and Last Partner Update. Add any that are missing
(an index changes no data) and record it.

A blank Company reads as `HealthFirst` everywhere: in HSBS 10, 10B, 1F and the site (spec
section 6, "Ledger").

## F4.2 Fill Company and Payer on existing rows, once

With no flow writing the ledger (S1), for every existing row:

1. Company blank: set `HealthFirst`. Every row written before the column existed is
   HealthFirst (spec section 6).
2. Payer blank: set `HealthFirst`.
3. Change nothing else: Status, Amount, Paid On, Payout Batch, Payee Email, Test, Disputed
   and every other column stay as they are. Paid rows included (D3): only Company and Payer
   are filled.
4. Record the count of rows changed, and export the list (Award Key, Company, Payer, Status,
   Amount) before and after. The two exports differ only in Company and Payer.

## F4.3 HSBS 10S: on a Service Case save

1. Trigger: SharePoint "When an item is created or modified", Service Cases, on the field
   site (`sites/HSBSField`).
2. Condition: the case's `Service` is exactly `HealthFirst` or exactly
   `HS Staffing / Recruiting Services (including GoTu)`. Otherwise end, Succeeded.
3. HTTP POST to HSBS 10, body `{"caseId": <the item ID>}`, Secure inputs on. Wait for the
   answer. Anything other than 200 with `{"ok":true}`: record the failure (F4.4,
   "Failure") and end Failed.
4. 10S reads nothing else and writes nothing. Brian's own SharePoint edits to a case (a
   Qualified correction after a sign) are saves, so they reach HSBS 10 this way. So are
   7F and 7H writes, and 7G's miss count (HSBS 10 then finds nothing new).

## F4.4 HSBS 10: the ledger writer

**Trigger.** "When a HTTP request is received", method POST, schema
`{"type":"object","properties":{"caseId":{"type":"integer"}},"required":["caseId"]}`.
Concurrency control on, limit 1. Any other key in the body is ignored. HSBS 10 answers 200
`{"ok":true}` at the end of every run that finishes, whether or not it wrote anything.

Steps W1 to W17, in this order. "End" means: answer 200 `{"ok":true}` and write nothing
more in this run.

**W1 Settings.** Read the Ledger Settings row (fail safe as above), with its amount columns, then the amount check.

**W2 Read the case** by ID, fresh. Not found: end.

**W3 Company.** Map the case's `Service` through the company table. Not one of the two: end.

**W4 Read its Referrals row** through the case's link. Not found: fail the run.

**W5 Source.** Source is not exactly `Rep app`: end. A lead from any other source writes
nothing, for a rep or a manager, whatever its answers (T24, M13, M20). 1F (new site) writes
Source `Rep app` on every app send.

**W6 The rep.** The rep (Words used) is blank, or no Rep Roster row has that Rep Email:
end. It is listed (X14).

**W7 Test.** Work out "TEST case". If `LedgerTestOnly` is true and the case is not a TEST
case: end.

**W8 One case per referral and company.** If another Service Case links to the same
Referrals row with the same company: this run creates no row (W15 and W16 are skipped),
but W10 to W14 still run, so a row that already exists for this case is still voided or
disputed by rule V. Both cases are listed (X15). A rep app referral names one company
(sheet F1, F1.4), so this never holds unless data is wrong, and then no one is paid
twice.

**W9 Staffing switch.** Company is `Staffing` and `StaffingAwardsOn` is false: this run
creates no row (W15 and W16 are skipped), but W10 to W14 still run. So no staffing row is
ever written while the switch is off, and a staffing row written while it was on is still
voided or disputed by rule V if a no-pay reason appears later. Before the switch is first
turned on there are no staffing rows, so nothing happens. Cases that would earn are listed
(X5).

**W10 Read the answers** from the case: Qualified, Not qualified, Not Qualified Reason,
Closed Reason, Signed. Never Award Practice Type (R5), and never Not
Qualified Note.

**W11 No-pay test** (spec section 6, "A no-pay case pays nobody"). The case is no-pay when
any of these holds. The first that holds gives the reason, in this order:

1. **Same office, same company, in the last 12 months (D12, per company).** Get items on
   the field-site Referrals with `JDEAccount` equal to this row's (trimmed, compared as
   text, leading zeros kept). Keep a row only when all hold:
   - it is not this Referrals row;
   - its Solutions names this case's Solutions value exactly (one of its values, if it
     holds several: a row naming HealthFirst and staffing together counts for each, M17);
   - it was created before this row (Created earlier, or the same Created and a lower ID);
   - it was created on or after `addToTime(<this row's Created>, -12, 'Month')`;
   - it has the same TEST value as this case (decision 90: TEST and real referrals never
     block each other): the earlier row is TEST when its Test is Yes or its Practice Name
     or customer name contains `TEST` in capitals.

   Any source on the field-site Referrals counts (R8). No other site or team's list is
   read. A row with a blank JDE never matches, so a lead with no JDE never blocks (M14). An
   earlier row blocks even though it earned nothing itself. A HealthFirst row never blocks
   a staffing case, and the reverse (M4).
   Reason: `this office was referred to <Name in words> in the last 12 months`.
2. **Already a customer (D7).** Closed Reason is exactly `Already a customer`.
   Reason: `Already a customer`.
3. **Not qualified (T16).** Qualified is `No`. Reason:
   `<Name in words> marked this lead as not qualified (<Not Qualified Reason as stored>)`,
   for example `Direct Dental marked this lead as not qualified (No permission to contact)`.
   If the reason is blank (a hand edit), the reason ends after `not qualified`. One
   exception reads the note (L1, 11/22): when the reason is `Other` and Not Qualified Note
   contains `no answer after 4 attempts` (any case), the words in brackets are
   `no answer after 4 attempts`. That is how 7F stores a lead closed on the 4th
   Not reached yet save, or saved as `dq_noanswer`, so the rep reads
   `HealthFirst marked this lead as not qualified (no answer after 4 attempts)`, not
   `(Other)`. Any other `Other` keeps `(Other)`. A stored reason other than `Other` always
   wins over the note. The note never decides pay, only these words.

A hand back is not a no-pay reason (T22). No flow reads a typed note to decide pay.

**W12 Read the three rows.** Get items on the ledger with Award Key equal to K_R, K_M and
K_S, one each (Top Count 1). Keep each row's Status, Disputed, Payout Batch and its ETag
(`@odata.etag`).

**W13 Amounts for this case.**

| | HealthFirst | Staffing |
|---|---|---|
| Qualified award (A_R, Event `Reached`) | `HF_Qualified` | `ST_Qualified_Group` when the Referrals row's `RepPracticeType` is `Group` and the case's `OfficeCountConfirmed` is `Yes`, else `ST_Qualified` (R5) |
| Rep award at the sign (A_S) | `HF_Signed` | 0 |
| Manager award (A_M) | `HF_Manager` | `ST_Manager` |

The ledger has no Practice Type column (R5). A staffing Void row carries the same A_R amount
as a paid row would. It never counts and never pays.

**W14 Void or dispute existing rows (rule V).** Only when the case is no-pay. For each row
read in W12, by Award Key:

- Status `Waiting`: update it to Status `Void`, Void Reason = the no-pay reason. Nothing
  else on the row changes.
- Status `Paid` and Disputed not Yes: set Disputed = Yes and Dispute Note = the no-pay
  reason. Status, Paid On and Amount stay (D3). It is listed (X7).
- Status `Void`, or `Paid` and already Disputed: change nothing.

A row's reason is written once. A row already Void keeps the reason it has.

**Every update** in this sheet is a "Send an HTTP request to SharePoint" step, method POST,
headers `X-HTTP-Method: MERGE` and `IF-MATCH: <the ETag read in this run>`, body naming only
the columns changed. A 412 (the row changed since it was read) fails the run, and the case
is picked up again by the next save or by the 7 AM pass. Never update without the ETag, and
never retry with `IF-MATCH: *`.

**W15 The Reached row (rule R): the qualified lead award.** Only when no K_R row exists.
"Qualified" here means Qualified is exactly `Yes` (R4); Talked To Doctor is not read.

| When | Write K_R |
|---|---|
| The case is no-pay and A_R is at least 1 | Status `Void`, Void Reason = the no-pay reason, Amount A_R |
| The case is no-pay and A_R is 0 | Nothing. The case's closed reason is the record (M18, last part) |
| Not no-pay, Qualified, A_R at least 1 | Status `Waiting`, Amount A_R |
| Anything else (Qualified blank, Trying to reach) | Nothing |

So a duplicate gets its Void row on the first run that sees the case, before any partner
answer, and the rep sees "Not paid" from the start. Reached alone writes nothing (M16). No
time rule ever writes a row: there is no auto-reached award and no `Pending review` row,
for either company (T18, M19).

The award is written by the first run that finds Qualified Yes, whatever
else has happened to the case since: an award earned stands, so a case closed for another
reason (for example `Price`) or handed back after both answers still gets its Waiting row
(spec section 6, "Pay on a handed-back case"; M21). A run that is late pays the amount on
the Ledger Settings row when it runs; the freeze stops an amount change while a run is
pending.

**W16 The sign (rule B).** Spec section 6, "Manager pay", and the contract's "Manager pay
(HSBS 10)" points 1 to 8, with these two companies. The manager is paid at the sign
(R6, Brian 11/21: "When it signs"). A sign is handled once, and whether it
was handled is recorded in the **Sign Log** (F4.1), never worked out from which ledger rows
exist. So a later plan change can never add a sign row to a sign already handled, whatever
the plan paid at the time (including nothing). The Sign Log is a separate list, not a
ledger row: no zero-dollar row is ever written to the ledger (Brian, 11/11).

1. **Qualified is needed.** If Signed and Qualified is not Yes: write no sign row and no
   Sign Log row. It is listed (X6). HSBS 10 checks the case itself, whatever 7F allowed.
2. Retired 11/21 (rule G, R5).
3. **Read the case's Sign Log row** (Case ID = this case, Top Count 1, with its ETag). A
   case reaches steps 4 to 8 only when it is Signed and Qualified.
   - **Handled On is set:** the sign is handled. Write no sign row, now or ever, whatever
     the plan or the Team Roster say (contract point 1).
   - **No Sign Log row, and a K_M or K_S row already exists** (a row from before this
     sheet): create the Sign Log row with Handled On = now and the two plan amounts blank,
     and write no sign row.
   - **No Sign Log row and no sign row: this is the sign run.** Create the Sign Log row:
     Case ID, Started On = now, Plan Manager = A_M and Plan Rep Sign = A_S as this run
     reads them (decision 77: the plan on file when the pay run handles the sign), Handled
     On blank. Case ID is unique, so a second create fails and writes nothing more.
   - **A Sign Log row with Handled On blank: a sign run that did not finish** (it failed,
     or stopped on a roster conflict). Finish it with the amounts stored on that row, Plan
     Manager and Plan Rep Sign, never the current settings: those are the plan the original
     run used. Only rows that are missing are written.
4. **A Void Reached row counts as no-pay at the sign.** If K_R exists with Status `Void`,
   the sign is no-pay with K_R's Void Reason, even if the reason no longer holds (for
   example Brian later changed Qualified back to Yes). The office pays no one, so no
   Waiting sign row follows (contract point 1). HSBS 10 never turns a Void row back to
   Waiting; that correction is Brian's, by hand.
5. **Manager first** (contract point 4). When the Sign Log's Plan Manager is at least 1 and
   no K_M row exists, read the rep's Team Roster rows now (decision 77): Get items, Rep
   Email = the rep (`toLower`), Active = Yes, Top Count 2.
   - **Two rows: a roster conflict.** Write no K_M and no K_S. Leave Handled On blank: the
     sign is not handled yet. The case is listed (X18) until Brian leaves exactly one
     Active row for the rep; the next run (his edit to the case, or the 7 AM pass) finishes
     the sign with the stored plan. Fixing a conflict listed in X18 is the one Team Roster
     change the freeze allows for that rep, once X1 shows nothing for that rep's cases.
   - **No row:** no manager.
   - **One row:** the manager is that row's Manager Email, trimmed and lowercased, when it
     is not blank, it is not the rep, and the row is not a TEST pair, or it is a TEST pair
     and the rep is a TEST person. Otherwise: no manager.

   Then write K_M, Amount = Plan Manager:

   | Case | Status | Payee Email | Void Reason |
   |---|---|---|---|
   | No-pay, manager found | `Void` | the manager | the no-pay reason |
   | No-pay, no manager | `Void` | blank | the no-pay reason |
   | Not no-pay, manager found | `Waiting` | the manager | |
   | Not no-pay, no manager | `Void` | blank | `no manager on the team roster when the office signed` |

   No Manager row is ever `Pending review`. A manager's own referral has no manager award
   to themselves: the rep's own row naming the rep, or no Active row, is the "no manager"
   case above.
6. **Then the rep's sign row.** When Plan Rep Sign is at least 1 and no K_S row exists: K_S
   with Status `Void` and the no-pay reason when no-pay, else `Waiting`, Amount = Plan Rep
   Sign. Staffing never writes K_S (its Plan Rep Sign is 0).
7. **Mark it handled.** Only when every row the stored plan calls for exists (K_M when Plan
   Manager is at least 1, K_S when Plan Rep Sign is at least 1), set Handled On = now on the
   Sign Log row, with `IF-MATCH` on its ETag. With both stored amounts 0, that is at once:
   no sign row, now or ever. If the run fails before this step, the next run finishes the
   missing rows from the stored plan (step 3).
8. A Team Roster change after the sign run never adds, moves or re-points a Manager row
   (D18). A no-pay reason found later voids a Waiting Manager row, and disputes a Paid one,
   by rule V (M11, second and third orders).

**Rule G, the blank award type guard: retired 11/21 (R5).** The amount comes from the rep's
pick on the Referrals row (blank pays `ST_Qualified`), never Award Practice Type, so a blank
Award Practice Type holds nothing back. Do not build it.

**W17 Every row this run writes** carries these values. "Writes" means a Create item
whose Award Key is the row's key.

| Column | Value |
|---|---|
| Award Key | K_R, K_M or K_S |
| Referral ID | the Referrals row's Title |
| Service Case ID | the case's ID |
| Practice Name | the Referrals Practice Name |
| Rep Email | the rep |
| Payee Email | Rep rows: the rep. Manager rows: as rule B |
| Payee Role, Event | from the key table |
| Amount | as W13 to W16, a whole number 1 to 1000 |
| Earned On | the Eastern date of this run |
| Status, Void Reason | as rules R and B. Void Reason blank on a Waiting row |
| Disputed | No. Dispute Note blank |
| Payout Batch, Paid On | blank |
| Company | the company key |
| Payer | the Payer for that company from the company table |
| Test | Rep rows: Yes when the case is a TEST case, else No. Manager rows: Yes when the case is a TEST case or the manager is a TEST person, else No |

A Manager row that is Test only because its manager is a TEST person (the rep is live) is
kept out of real batches and listed (X11). When Brian sets that manager live, he clears Test
on that row by hand; it then batches like any other (spec section 6, "Ledger"; M27).

If a Create fails because the Award Key already exists, the run writes nothing more and
fails. With one writer this happens only if a row was added by hand.

**What HSBS 10 never does.** It never changes an existing row's Award Key, Amount, Payee
Email, Rep Email, Company, Payer, Test, Earned On, Payout Batch, Sent On,
Office Check or Paid On.
The only changes it makes to an existing row are Waiting to Void with a reason, and
Disputed with a note on a Paid row. It never marks a row Paid. It never deletes a row.

**The freeze (spec section 6, "Manager pay"; decision 77).** The sign run reads the Team
Roster and the amounts as they are when it runs, so a late run reads late data. So nobody
makes a **protected change** (a Team Roster pair added, changed or set inactive, a
`REP_PAY_PLAN` or `REP_PAY_PLAN_STAFFING` value, or an amount on the Ledger Settings row) unless the
**freeze check** passes right before it. The freeze check reads the live state, never the
last email:

1. Ledger Run Errors has no row with Resolved = No (a filtered view, read at that moment).
2. HSBS 10 and HSBS 10D have no run in progress or waiting (their run history, at that
   moment).
3. Today's HSBS 10D run has finished Succeeded, if it is past 7:00 AM Eastern (it marks its
   own catch-up row resolved only when every post was accepted and the Ledger Pass Log shows
   every run finished without failing; F4.6 step 1, P2 record B9).
4. **Plan equality** (before any amount change, and before StaffingAwardsOn is set Yes):
   Brian or Claude states in writing the site's `REP_PAY_PLAN` and `REP_PAY_PLAN_STAFFING`
   values (not secrets), and they equal the Ledger Settings amounts after the change:
   `reached:<HF_Qualified>,manager:<HF_Manager>` (plus `signed:<HF_Signed>` when it is not 0)
   and `reached_private:<ST_Qualified>,reached_group:<ST_Qualified_Group>,manager:<ST_Manager>`,
   each part's number equal, order ignored. Today that is `reached:100,manager:50` and
   `reached_private:100,reached_group:200,manager:50`. If they differ: **stop and ask Brian** (spec
   section 6: "Brian changes a plan in both places together"). BB2 writes both values in
   the build report.

If any part fails, the change waits: let the next save or the 7 AM pass run the case again,
see it succeed, mark the failure resolved, and run the freeze check again. BB2 runs it
before every amount setting change and writes the three results in the build report.
Brian's Team Roster edits follow the same check (the X1 section of the email says so, and
gives the name of the view).

**Failure.** Every step sits in one scope. A second scope runs after it fails or times out:
it records the failure (case ID, the step name, the time, never a key or a body) in a new
list, Ledger Run Errors (Case ID number, Step text, Failed At date and time, Resolved
yes/no, indexed on Resolved), which only HSBS 10, 10S and 10D create and only Brian or
BB2 marks resolved. (Record 9 says whether live flows have another place too; if they do,
both are written. The freeze check reads this list.) Then HSBS 10 answers 500 and ends Failed. No write
in a failed run is undone, and none needs to be: every write is keyed or ETag checked, so
the next run picks up where it stopped. **Retry:** a failed case is run again by its next
save or by the next 7 AM pass, never by hand-made ledger rows. Until that retry succeeds
and the failure is marked resolved, the freeze above holds: no Team Roster pair, pay plan
value or amount setting changes.

## F4.5 Pay rules in one table

For checking the build against the spec. Each line is rules R, B, V and G above.

| Case | Ledger result |
|---|---|
| Not rep app (Source is not `Rep app`) | No row, ever |
| Reached or trying, Qualified blank | No row |
| Qualified Yes, not no-pay | One K_R, Waiting, $100 (both companies) |
| Qualified No, no K_R yet, A_R at least 1 | One K_R, Void, not-qualified reason |
| Qualified No, K_R Waiting | K_R becomes Void |
| Qualified No, K_R Paid | K_R stays Paid, Disputed, listed |
| Already a customer, no K_R, A_R at least 1 | One K_R, Void, `Already a customer` |
| Duplicate, A_R at least 1 | One K_R, Void, from the first run |
| No-pay with A_R at 0 | No Reached row; the closed reason is the record |
| Signed and Qualified, not no-pay, no Sign Log row | Sign Log row with the plan read now; K_M Waiting (manager found) or Void (no manager); then K_S Waiting if Plan Rep Sign is at least 1; then Handled On |
| Sign Log Handled On set | No sign row, whatever the plan says now |
| Sign Log Handled On blank | Only the missing rows, from the stored plan |
| Signed, duplicate | K_M Void (and K_S Void if A_S is at least 1); nothing Waiting |
| Signed with Qualified not Yes | No sign row; listed |
| Brian sets Qualified No after the sign | Waiting rows Void, Paid rows Disputed; the case's status is not touched |
| Hand back | No row written, voided or changed |
| A save or daily run after the row exists | Nothing new |

## F4.6 HSBS 10D: the 7 AM pass and Brian's exceptions

**Trigger.** Recurrence, every day, 7:00 AM, time zone Eastern.

**Step 1, catch-up, every rep app case, no age limit.** First create a Ledger Run Errors
row, Step `catch-up <Eastern date>`, Resolved No. Mark it Resolved Yes at the end of step 1
only if every window was read, every post was accepted (any 2xx; HSBS 10 answers 202, P2
record B4), and every run has finished without failing (below); otherwise leave it open (it is
then listed in X1 and fails the freeze check). Then:

1. Read the highest Referrals item ID (Get items, order by ID descending, Top Count 1).
2. Walk ID windows from 1 to that ID, 5,000 IDs at a time: Get items on Referrals with
   `ID ge <start> and ID lt <start + 5000> and Source eq 'Rep app'`, Top Count 5000. Every
   rep app referral, whatever its age, is in exactly one window.
3. While `LedgerTestOnly` is true, keep only rows that make a TEST case.
4. For each, find its HealthFirst and staffing Service Cases and post each case ID to HSBS
   10 as 10S does, adding `"passId": "catch-up-<the catch-up row's ID>"` (Apply to each,
   concurrency 1). A post that is not accepted is recorded and the loop goes on. A 429
   (HSBS 10's queue of 100 waiting runs is full) waits 30 seconds and posts again, up to
   10 times. More than 5,000 cases in all: stop (S12).
5. **Wait for the runs to finish** (P2 record B9). Until the Ledger Pass Log holds one row
   for this pass ID per accepted post, wait 1 minute and count again, for at most 120
   minutes. Every row `done` or `ended`: the pass finished. Any row `failed`, or a count
   still short at 120 minutes: the catch-up row stays open. Step 2 starts only after this
   step ends, either way.

HSBS 10 writes nothing for a case whose rows are already right, so a full pass is safe.
This picks up a failed run, a save the trigger missed, and every rep app case the first
time `LedgerTestOnly` goes false (spec section 6: "The rule applies to every case with no
Reached row at that moment").

**Step 2, the lists.** Built after step 1, so they read the ledger as the catch-up left it.
Each line names the list, the Referral ID, the case ID, the company in words, the practice
name and the rep's email, plus what that list adds. No customer phone or email, no
customer name and no Not Qualified Note except on X10. No dollar amount on any line (Brian
reads the amount on the row). A line for a TEST case or row starts with `TEST `. While
`LedgerTestOnly` is true, only TEST lines are listed.

| # | List | A case or row is on it when | It drops off when |
|---|---|---|---|
| X1 | Failed or pending runs | A Ledger Run Errors row with Resolved No (a failed run, or a catch-up pass that did not finish). The section starts with the line `Do not change a Team Roster pair or a pay plan while anything is listed here, or before the freeze check passes.` | Brian marks it resolved after a successful retry |
| X2 | Silent partner: no answer to question 1 (T18) | Rep app, open, Talked To Doctor blank, and five business days or more after Introduced On (Ask Brian A2) | The partner answers question 1, or the case is no longer open |
| X3 | Silent partner: reached, no qualify answer (T18) | Rep app, open, Reached, Qualified blank, and five business days or more after Talked On, or Last Partner Update where there is no Talked On (record 7; Ask Brian A3) | The partner answers Qualified, or the case is no longer open |
| X4 | Retired 11/21 (rule G, R5) | Not built | |
| X5 | Staffing awards off | Rep app, staffing, Qualified Yes, while `StaffingAwardsOn` is false | `StaffingAwardsOn` is true |
| X6 | Signed without Qualified | Rep app, and Partner Status `Signed` or `Close won`, and (Qualified is not Yes, or Signed Date is blank), and no Sign Log row with Handled On set. This is the spec's "every signed case with Qualified blank" list for the turn-on gap (sheet F2, build order step 7), for rep app cases (Ask Brian A2) | The answers are filled (Brian, in SharePoint) and the sign row is written |
| X7 | Disputed paid award | A ledger row with Status `Paid` and Disputed Yes. The line adds the Award Key and the Dispute Note | Never; Brian reads it each day (rep app v3: "disputed paid awards") |
| X8 | Waiting award with no qualify answer | Rep app, open, a Waiting K_R, Qualified blank (a row written before the qualify rule; spec section 6, M27) | The partner answers Qualified |
| X9 | Retired 11/21 (R5): the partner's practice type never changes an amount | Not built | |
| X10 | Not qualified, reason Other | A HealthFirst or staffing case, any source, Qualified No, reason `Other`. The line adds the Not Qualified Note word for word | Seven days after Last Partner Update (Ask Brian A5) |
| X11 | Live rep, Test manager | A K_M row with Test Yes whose manager is a TEST person, on a case whose Referrals Test, Service Case Test and rep's Rep Roster Test are all No (a non-TEST case by its columns; a `TEST` practice name alone does not make it TEST here, which is how check H19 runs). The line adds the Award Key | Brian clears Test on the row |
| X12 | Payer does not match Company | A ledger row whose Payer is blank, or does not match its Company by the company table (blank Company reads `HealthFirst`). The line adds the Award Key | It is fixed by hand |
| X13 | Voided after joining a batch | A row with Status `Void` and Payout Batch set and Paid On blank. The line adds the Award Key and the batch | 10M `Paid` on its batch marks it `Paid` (Disputed, so it moves to X7) because Alexa paid it. **Nobody clears its Payout Batch by hand**: 10M `Paid` finds the row by it, and a cleared row Alexa paid would stay `Void` with the money hidden (M10, test X13b). 10M already leaves a void row out of the list it sends (M8). A void row Alexa did not pay, or that 10M left out of the list, stays listed; Brian reads it, as X7 |
| X14 | Rep not on the Rep Roster | Rep app case whose Referring Rep Email is blank or has no Rep Roster row | The rep has a row |
| X15 | Two cases for one referral and company | W8 | The data is fixed |
| X17 | Possible repeat office under another JDE | A Waiting row whose Office Check is blank, on a rep app case that is an **office match**: its field-site Referrals PracticeName, trimmed and compared without regard to letter case, matches an earlier Referrals row for the same company, with the same TEST value (decision 90), created in the 12 months before it, with a different or blank JDE. The line adds both Referral IDs and the Award Key. No row is voided by a flow for it: the JDE the rep typed is not checked against any source, so Brian decides. A row on X17 is held out of every batch (F4.7) | Brian sets Office Check `Cleared` on the row (it may then be batched), or voids it by hand with a reason, or the row is no longer Waiting |
| X19 | Payout send not finished | A Payout Batches record with Send Started On set and Sent On blank, for a run that has ended. The line adds the batch ID, the Send Run ID and the Award Keys with Sent On set, and the two ways out: if that run's send email step Succeeded, run 10B `Finish`; if not, clear the send by hand (F4.7) | 10B `Finish` sets Sent On, or Brian clears the send by hand |
| X20 | Sign not finished | A Sign Log row with Handled On blank, Started On before today, that is not on X18 | The next run marks it handled |
| X18 | Team Roster conflict at a sign | A Sign Log row with Handled On blank whose rep has two or more Active Team Roster rows (rule B, step 5) | Brian leaves exactly one Active row, and the next run writes the sign row |
| X16 | Test by name only | A ledger row with Test Yes whose case is TEST only because of `TEST` in a name (Referrals Test, Service Case Test and the rep's Rep Roster Test are all No). A real office with TEST in its name would otherwise go unpaid unseen | Never; Brian decides |

The hand-back list is sheet F7's, and the daily gap check is Sheet 1's. Both stay where
they are; this email sits beside them.

**Step 3, the email.** One email, subject `HSBS ledger exceptions <Eastern date>`, to Brian
only (S9), sent every day, with each list under its name and `None` under an empty one.
It is sent from the mailbox Brian's existing daily mail uses.

## F4.7 HSBS 10B: payout batch, one payer at a time

> Not built. Replaced 11/22/2026 by HSBS 10M (10M build record). Kept as history.

Spec section 6 ("one payout batch per payer"), rep app v3 "Payout, step by step", decisions
62 and 75. Trigger: manual (instant). Trigger concurrency 1, so two batch runs never
overlap. Run-only permission: Brian. BB2 runs it as the flow owner while testing, TEST
batches and dry runs only.

**Its switch, RealPayoutsOn** (Ledger Settings, read fresh at the start of every run;
No at build). While No, 10B refuses a `Send` run with Dry run No on a `Real` batch, so nothing is ever sent
to a payer. A `New` run of either kind, every dry run, and a `Send` of a `-TEST` batch
(which goes to Brian only) still work. BB2 sets it Yes only at build order step 6a, on
Brian's go, and No first on any rollback.

**The batch record.** Every batch has one row in the Payout Batches list (F4.1): Batch ID
(Title, unique), Payer, Kind, Created On, Send Started On, Rows Sent (the Award Keys sent,
comma separated), Sent On, Confirmed On, Paid On, Not Paid (Award Keys). The record, not
the ledger rows, says whether and what a batch sent. Only 10B and 10P write it; Brian may
clear Send Started On by hand (X19).

**The row columns it uses**, added in F4.1: Sent On (Date only) and Office Check (Choice,
`Cleared`). Only 10B writes Sent On, and only 10P clears it (F4.8, unpaid rows). Only Brian
writes Office Check.

**Batch ID.** `<payer part>-<yyyyMMdd>-<HHmm>` from the Eastern date and time, plus `-TEST`
on a TEST batch. The payer part is `HealthFirst` or `DirectDental`. A batch ID is valid
only when it matches exactly `^(HealthFirst|DirectDental)-[0-9]{8}-[0-9]{4}(-TEST)?$` and
has a batch record whose Payer and Kind agree with it. From a valid ID: the payer is
`HealthFirst` or `Direct Dental`, and the kind is `TEST` when it ends in `-TEST`, else
`Real`. **A batch ID is used once:** the record's Title is unique, so a second `New` run in
the same minute fails to create its record and stamps nothing; Brian runs it again a minute
later.

**Held out of every batch** (a row is never stamped or sent while any holds): Status is not
`Waiting`; Disputed is Yes; Sent On is set; the row is on X17 (an office match with Office
Check blank, tested live at the run, not read from the email); Payer and Company do not
match by the company table (X12).

**Inputs:**

| Input | Type | Values |
|---|---|---|
| Mode | Text | Exactly `New`, `Send` or `Finish`. Anything else: stop, nothing read or written |
| Payer | Text | `New` only: exactly `HealthFirst` or `Direct Dental`. Anything else: stop. Ignored in `Send` |
| Kind | Text | `New` only: exactly `TEST` or `Real`. Ignored in `Send` |
| Dry run | Yes/No | `New`: Yes lists what would be stamped and writes nothing (no record). `Send`: Yes runs checks 1 and 3 to 8 on any valid batch and emails Brian only what would be sent; nothing goes to a payer and nothing is written |
| Batch | Text | `Send` and `Finish`: a valid batch ID. Ignored in `New` |

**Mode `New`.**

1. Make the batch ID from the Payer and Kind inputs.
2. Rows: Status `Waiting`, Payout Batch blank, not held out (above), Payer = the input,
   Company matching that Payer (a blank Company matches `HealthFirst` only), Amount a whole
   number 1 to 1000, and Test = Yes when Kind is `TEST`, Test = No when Kind is `Real`. A
   Real batch never holds a Test row, and a TEST batch never holds a real one (D8). A
   staffing row is never in a HealthFirst batch, and a HealthFirst row is never in a
   Direct Dental batch (M7). No rows: stop, and email Brian that the batch is empty.
3. Dry run Yes: email Brian the list (below) headed `DRY RUN` and stop.
4. Create the batch record (Batch ID, Payer, Kind, Created On). If the create fails (the ID
   is taken): stop, nothing stamped.
5. For each row (Apply to each, concurrency 1): set Payout Batch = the batch ID, with
   `IF-MATCH` on its ETag. A 412 leaves that row out and lists it in the summary.
6. Email Brian the list: one line per payee (payee email and the Rep Roster name if there
   is one, the number of awards, the total), and under each payee one line per row (Award
   Key, office, event, amount, Earned On). Then the batch total, which is the sum of the
   listed rows. No customer contact detail. Brian checks it against the exceptions email
   (rep app v3, step 2), X13 and X17 included.

**Mode `Send`.** On Brian's go, after his check. Checks 1 to 8 run before anything is sent
or written. If any fails, the whole run stops: nothing is sent, nothing changes, and Brian
is emailed which check failed.

1. Batch is not blank and is a valid batch ID.
2. Dry run No and kind `Real`: `RealPayoutsOn` is true. A `-TEST` batch runs every step
   below, but step 12 sends it to Brian only, never to a payer (rep app v3: "A TEST batch
   ... with Brian as the only recipient").
3. The batch record's Send Started On and Sent On are blank. (A batch is sent once.)
4. Read every row with Payout Batch = Batch. There is at least one.
5. Every row has the same Payer, the payer the batch ID names, and a Company that matches
   it.
6. Every row's Test matches the kind (No for `Real`).
7. No row has Sent On set, and no row has Status `Paid`.
8. No row is on X17 (tested live).

Then, with Dry run No:

9. **Claim the send.** Set the record's Send Started On = now, with `IF-MATCH` on its ETag.
   A 412: stop, send nothing.
10. **Reread and claim each row, right before the email.** Read each row of the batch again
    (fresh, with its ETag). A row that is no longer `Waiting`, or now fails check 5, 6 or 8,
    is dropped and named to Brian. For each row kept, set Sent On = today's Eastern date
    with `IF-MATCH` on the ETag just read. A 412 (HSBS 10 changed it in between, for
    example a void) drops that row: it is not on the list. **This ETag write is the lock
    between 10B and HSBS 10:** a void that lands before it makes the stamp fail and the row
    leaves the list; a void that comes after it is a void after the send, which 10P
    reconciles (F4.8). No `Waiting` row kept: stop, send nothing, and Brian clears Send
    Started On by hand (X19).
11. **Record what is sent.** Set the record's Rows Sent = the Award Keys stamped in step 10,
    and Send Run ID = this run's ID (`workflow()?['run']?['name']`).
12. **Send** the list (as in `New`, step 6, for exactly the Rows Sent, with their total).
    A `-TEST` batch: Brian only. A `Real` batch, by the payer derived from the batch:
    `Direct Dental`, the staffing
    payout list contact read from Routing at run time (decision 75; S10); `HealthFirst`,
    the HealthFirst payout list contact in Routing if Brian has had one added, else Brian
    only (Ask Brian A6). Brian is copied. No other recipient.
13. Only after the email step succeeds: set the record's Sent On = now (the update step
    keeps Power Automate's default retry policy).
14. Then read each row on Rows Sent again. Any row no longer `Waiting` (voided after its
    stamp) is named to Brian in a separate email the same minute, so he can tell the payer
    before payment; 10P records it whatever the payer does (F4.8).

**If the run stops after step 9 and before step 13**, the record has Send Started On and no
Sent On, and it is listed (X19). The batch is never sent again, and 10P refuses it, until
one of these two is done:

- **The email did not go out.** Brian opens the 10B run named in Send Run ID. If the send
  email step did not run or did not succeed, he clears Send Started On, Send Run ID, Rows
  Sent and the rows' Sent On by hand. The batch can then be sent again.
- **The email went out, only the last stamp failed.** If that run's history shows the send
  email step Succeeded, Brian runs 10B in Mode `Finish` with that Batch. `Finish` never
  sends anything. It checks: the record has Send Started On, Rows Sent and Send Run ID,
  and Sent On is blank; every row on Rows Sent has Sent On set. Then Brian answers the
  run's one question, "The send email step of run <Send Run ID> shows Succeeded" (Yes or
  No), and only on Yes it sets the record's Sent On = Send Started On (no later than the
  email itself, so 10P's date check stays true). On No, or any failed check, it changes
  nothing.

A failure can leave a list unsent, never sent twice, and never marked Paid unsent.

10B never marks a row Paid.

## F4.8 HSBS 10P: record the payer's confirmation

> Not built. Replaced 11/22/2026 by HSBS 10M Mode `Paid` (10M build record, M10). Kept as history.

Trigger: manual, after the payer confirms payment ("Nothing is marked Paid without a
confirmed payout", `AGENTS.md`). Trigger concurrency 1. Run-only permission: Brian; BB2 runs
TEST batches while testing. Switch RealPayoutsOn (Ledger Settings, read fresh at the
start of every run): while No, 10P refuses a `Real` batch. Inputs:

| Input | Type | Values |
|---|---|---|
| Batch | Text | A valid batch ID (F4.7) |
| Paid On | Text | The payer's confirmed payment date, `YYYY-MM-DD` |
| Not paid | Text | Blank when the payer confirms it paid every row on the sent list. Otherwise a comma list of the Award Keys on the sent list that the payer says it did not pay |

**The sent list.** The record's Rows Sent: exactly what the list carried. For a `TEST`
batch that was never sent (Rows Sent blank): on the first confirmation, the Award Keys of
the rows with Payout Batch = Batch and Status `Waiting`, which 10P writes to the record's
Rows Sent before any row changes; on a retry, the Rows Sent already stored.

**Checks.** All run before any row is changed. If any fails, the run stops, changes
nothing, and emails Brian which check failed. A blank Batch never selects anything.

1. Batch is not blank and is a valid batch ID. Its kind and payer come from the ID. A
   `Real` batch: `RealPayoutsOn` is true.
2. Paid On is a real date in `YYYY-MM-DD` form and not after today's Eastern date.
3. A `Real` batch: the record's Sent On is set and Rows Sent is not blank. A Real row is
   never marked Paid before it was sent.
4. The sent list is not empty. Each of its Award Keys is a ledger row whose Payer is the
   payer the ID names, with a Company that matches it, and whose Test matches the kind.
5. Paid On is on or after the Earned On of every row on the sent list, and, for a `Real`
   batch, on or after the record's Sent On.
6. Each Award Key in Not paid is on the sent list.
7. **Retry.** If the record's Confirmed On is already set, this is a retry: Paid On must
   equal the stored Paid On and Not paid must hold exactly the stored Not Paid keys (order
   and spaces ignored). Anything else stops the run: a second, different confirmation is
   Brian's to sort by hand.

**Then:**

8. On the first confirmation, write the record's Confirmed On = now, Paid On and Not Paid,
   with `IF-MATCH` on its ETag, before any row changes. A retry leaves the record as it is.
9. For each Award Key on the sent list (Apply to each, concurrency 1), read the row fresh
   and apply this table, each update with `IF-MATCH` on its ETag. A 412 is named to Brian
   and that row is left for a retry with the same inputs.

| The row now | Key not in Not paid (the payer paid it) | Key in Not paid |
|---|---|---|
| `Waiting`, Payout Batch = Batch | Status `Paid`, Paid On = the input | Payout Batch and Sent On cleared: the row is Waiting and unbatched, so a later batch can carry it |
| `Waiting`, Payout Batch blank or another batch | Not possible on a first run; stop for that row and name it to Brian | Already returned by an earlier run of this confirmation: no change |
| `Void` (voided after it was sent) | Status `Paid`, Paid On = the input, Disputed Yes, Dispute Note `voided after it was sent, then paid: ` and its Void Reason. Listed X7. Money that moved is never hidden (D3) | No change: it stays Void, and no money moved |
| `Paid`, Paid On = the input | No change (done by an earlier run of this confirmation) | Stop for that row and name it to Brian |
| `Paid`, another Paid On | Stop for that row and name it to Brian | Stop for that row and name it to Brian |

A retry with the same inputs therefore finishes what an earlier run left, and changes
nothing that run already did. A row voided before the send was never on the sent list, so
10P never touches it.

Then email Brian the counts: marked Paid, paid after a void (with their Award Keys),
returned to Waiting, unchanged, and any row named. 10P never changes a row that is not on
the sent list. It never sends a statement to a rep or a manager: the payout statement is a
later sheet (rep app v3, section 5).

## F4.9 `StaffingAwardsOn`: what turns it on

Off by default (`false`). While off, HSBS 10 creates no staffing row (rule V still voids
or disputes one written while it was on), and X5 lists every staffing case that would
earn. BB2 sets it to `true` on the live HSBS 10 only
when every gate holds, each written in the build report:

| Gate | What | How BB2 knows |
|---|---|---|
| G1 | Every check in groups A, H, G and S passed | The build report |
| G2 | `LedgerTestOnly` is already false (go-live step 6 done) | The flow's settings |
| G3 | Retired 11/21 (R5): the amount follows the rep's pick (Brian, 11/22), so no partner confirmation is needed | |
| G4 | No live (not TEST) rep app staffing case has Qualified Yes yet. The natural order is that this switch goes on before, or together with, `Staffing` in the site's `REP_APP_COMPANIES`, so no real staffing lead exists yet. If one does: stop and Ask Brian A7 | A Get items count, in the build report |
| G5 | Brian's go in chat, in his own words, quoted in the build report | |
| G6 | The plan equality check (freeze check part 4) passes for the staffing plan | The two values in the build report |

Decision 75 (the staffing payout contact) and decision 76 (Brian, 11/13: "Already
cleared") are answered, so neither holds it up, once gate G0 holds. Turning it off again stops new
staffing rows. Rows already written stay (an award earned stands), and are still voided
or disputed if a no-pay reason appears.

## A ledger row, as the site and 1F read it

The 1F (new site) `earnings` row, for a Direct Dental qualified lead award (Event
`Reached`, R4):

```json
{
  "referralId": "HSBS-F60",
  "practiceName": "TEST North Side Dental",
  "event": "Reached",
  "payeeRole": "Rep",
  "amount": 100,
  "earnedOn": "2026-11-14",
  "status": "Waiting",
  "paidOn": "",
  "voidReason": "",
  "disputed": false,
  "company": "Staffing"
}
```

## What must not change

**For HealthFirst today.**

- 1F, 1J, 3F, 7F, 7G, 7H and every other field flow are not edited by this sheet. HSBS 10
  reads the field-site Service Cases and Referrals and never writes them.
- The Award Key shape (Case ID + Event + Payee Role, D6), the events `Reached` and
  `Signed`, the roles `Rep` and `Manager`, the statuses, and the 1F `earnings` and `team`
  answers.
- Amounts are the promo file's: HealthFirst 100 / 0 / 50, Direct Dental 100 / 50 (R5, R7).
- Manager pay is D18 and the contract's points 1 to 8: decided once, in the sign run, for
  the manager on the rep's Active Team Roster row as that run reads it (decision 77). No
  Manager row is Pending review. A roster change never re-points a row.
- Paid is never clawed back (D3). A Paid row only gains Disputed and a note.
- No email to a rep or manager, and no dollar amount in one (D15). `REP_PAY_ENABLED` stays
  off until Brian turns it on.
- Existing ledger rows keep every value except a blank Company or Payer, filled once
  (F4.2).
- What changes for HealthFirst on purpose, from the spec and 11/21: the award needs
  Qualified Yes (T17 and R4, replacing "paid at reached"); auto-reached and Pending review are
  retired (T18); a not-qualified answer voids; a hand back no longer voids for "No
  permission" (T22). A Reached row that already exists when this goes live stands.

**For every other partner and source.** No Unitas, eAssist, Practice Booster, WeCare or
other case is read past W3, and no row is written for any source but `Rep app`.

## TEST checks (TEST rows only; each is pass or fail)

"No row" means a ledger Get items on the case's three Award Keys returns nothing. "Listed"
means the next HSBS 10D email (BB2 may run 10D by hand) has the line. To test five-business-
day lists without waiting, BB2 may set Introduced On or Talked On on a TEST case to a date
seven business days back. Each "save" is a partner save on the TEST partner page
(`/update/<key>` with a TEST Partner Links row, through 7F) unless a check says Brian edits
SharePoint. Choice names are 7F's (`docs/field-flow-contract.md`, 7F save).

### Group A: the build (staffing off)

- A1. The field-site ledger has Company with exactly the choices in F4.1, and Sent
  On (date), each not required, no default; Payer has `HealthFirst` and `Direct Dental`; Award Key enforces
  unique values; the F4.1 indexes exist.
- A2. F4.2's before and after exports differ only in Company and Payer; every row has
  Company and Payer set; no row's Status, Amount or Paid On changed.
- A3. The Ledger Settings row reads LedgerTestOnly Yes, StaffingAwardsOn No, RealPayoutsOn
  No, and the `Settings read` step of a run of HSBS 10, 10D, 10B and 10P shows those
  values. Deleting the row makes each fall back to the same safe values and record an X1
  row; put it back. The six amounts read `HF_Qualified` 100, `HF_Signed` 0, `HF_Manager`
  50, `ST_Qualified` 100, `ST_Qualified_Group` 200 (HSBS 10 only, 11/22), `ST_Manager` 50. Blanking one makes the next run fail before any
  write; put it back. HSBS 10's trigger concurrency reads 1.
- A3a. (One switch, every flow) BB2 sets StaffingAwardsOn Yes in the row for group S and
  confirms it in the `Settings read` step of HSBS 10 and 10D: a TEST staffing case saved
  `qualified` gets its K_R, and the next 10D email no longer lists it on X5. Set back to
  No after group S: both flows show No.
- A4. A non-TEST case saved during testing: the HSBS 10 run history shows it ended at W7
  and wrote nothing.
- A5. HSBS 10's run history for every check below shows no write to Service Cases,
  Referrals, the Rep Roster, the Team Roster or Routing.
- A6. Two posts of the same TEST case ID to HSBS 10 at the same moment (a temporary instant
  flow BB2 deletes afterwards) on a case that is Qualified Yes: exactly one K_R
  row.
- A7. Setting `HF_Qualified` to 0 and `HF_Signed` to 0 on the row makes the next run fail
  before any write; restoring them passes.
- A8. No email from any HSBS 10 flow reached anyone but Brian during groups A, H and G (run
  history of every Send email step).

### Group H: HealthFirst (staffing off)

- H1. (M16) A `trying` save: no row. Then a `qualified` save: one K_R, Waiting, $100,
  Company `HealthFirst`, Payer `HealthFirst`, Test Yes. The rep's lead screen showed no
  earned amount before (site, slice S5).
- H2. (R4) Brian sets Qualified Yes in SharePoint on a TEST case with Talked To Doctor
  blank: one K_R, Waiting, $100. Brian sets Talked To Doctor `Yes` alone on another: no row.
- H3. (M16) First answer `dq_noanswer`: Qualified No, reason `Other`: one K_R, Void, $100,
  Void Reason `HealthFirst marked this lead as not qualified (Other)`. Nothing is ever
  Waiting for the case.
- H4. (M10) A `qualified` save (K_R Waiting), then Brian sets Qualified No with a reason in
  SharePoint: K_R is Void with that reason, and no K_M exists.
- H5. (M11, first order) A K_R that a TEST batch and 10P made Paid; then Qualified No: K_R
  stays Paid, Disputed Yes, Dispute Note the reason, listed X7; no Waiting K_M exists.
- H6. (M11, second order) Reached, Qualified, Signed; K_R and K_M Paid by a TEST batch.
  Brian sets Qualified No with a reason in SharePoint: both rows Paid and Disputed, both
  listed X7; Partner Status, Pipeline Stage and Closed Reason unchanged.
- H7. (M11, third order) Reached, Qualified, Signed, both rows Waiting. Brian sets
  Qualified No in SharePoint: both Void with the same reason; a TEST batch afterwards holds
  neither.
- H8. (M24) Brian sets Partner Status `Signed` and a Signed Date in SharePoint on a TEST
  case with Qualified blank: no row, listed X6. A `signed` save through 7F on another
  (Qualified Yes with it): one K_R and one K_M, both Waiting, from one run.
- H9. (M6 for HealthFirst, D18) A sign for a TEST rep with an Active Team Roster row: one
  K_M, Waiting, $50, Payee Email that manager. Saving again and a 10D run write nothing
  new.
- H10. A sign for a TEST rep with no Active row: one K_M, Void, `no manager on the team
  roster when the office signed`, Payee Email blank. Brian then adds the pair and saves the
  case: nothing new is written.
- H11. (M18) Brian sets Closed Reason `Already a customer` before any award: one K_R,
  Void, `Already a customer`. The case is closed and off the partner page; no K_M.
- H12. (M14) A TEST rep app lead to HealthFirst for a JDE, then a second for the same JDE
  within 12 months, qualified and signed: on the second, K_R Void and K_M Void, reason
  `this office was referred to HealthFirst in the last 12 months`; nothing Waiting. A TEST
  lead with the same practice name and no JDE blocks nothing.
- H13. (M17, HealthFirst half) An earlier TEST field-site Referrals row naming HealthFirst
  and staffing for a JDE; a rep app HealthFirst case for that JDE, qualified and signed:
  K_R Void and K_M Void.
- H14. (M18, last part) With `HF_Qualified` 0, `HF_Signed` 150, `HF_Manager` 50 on the row,
  H11 and H13 are run again: no K_R is written for either; H13's sign writes K_M Void and
  K_S Void. A clean case signed under this plan writes K_M Waiting $50 first, then K_S
  Waiting $150. Restore 100 / 0 / 50 afterwards.
- H15. (M13, M20) A TEST Referrals row whose Source BB2 set by hand to anything but
  `Rep app`, with a HealthFirst case qualified and signed: no row. The same row marked
  Qualified No: no row.
- H16. (M19) A TEST case with no answer to question 1 five business days after Introduced
  On: listed X2, no row, no Pending review row ever. A second case, Reached, Qualified blank,
  five business days after Talked On: listed X3, no row. The partner answers Qualified Yes:
  K_R Waiting, and the case leaves X3.
- H17. (M21) A case with a Waiting K_R is handed back with a note: K_R still Waiting and
  unchanged; a TEST HealthFirst batch run afterwards holds it. A case handed back with no
  award: no row after the save, after a 10D run, or ever.
- H18. (M27, ledger part) A pre-existing TEST row with Company blank batches in a TEST
  HealthFirst batch. A Waiting K_R on a case with Qualified blank (made by setting Qualified
  blank by hand on a TEST case after its row) stays Waiting after a 10D run and is listed
  X8.
- H19. (M27, staged go-live) A TEST rep (Rep Roster Test No for this check) with a TEST
  manager still Test Yes; a referral with TEST in the practice name, qualified and
  signed: K_M Test Yes, listed X11, in no batch. A Real dry run for HealthFirst does not
  list it. The manager is set Test No and Brian clears Test on that row: a Real dry run now
  lists it once, and it was in no batch before. Reset the FSC and manager to Test Yes.
- H20. (M8) Every row from groups H and S has Test Yes; 1F `earnings` for the TEST rep and
  `team` for the TEST manager return them; a Real dry run for each payer lists none of
  them; no TEST row has a Payout Batch that does not end in `-TEST`.
- H21. (Batch and void race) A Waiting TEST row stamped in a TEST batch, then Qualified
  No: the row is Void and listed X13; 10P on that batch leaves it Void and names it to
  Brian.
- H22. (Payer) HSBS 10B `New` with Payer `Staffing` or `healthfirst` stamps nothing. A
  `Send` run with Dry run No on a `Real` batch stops at check 2 (RealPayoutsOn No) and
  sends and writes nothing. On a `-TEST` batch it runs and goes to Brian only (H31).
- H23. (Batch input) 10P with Batch blank, with `HealthFirst-2026`, and with a well-formed
  ID no row carries: each stops, changes nothing, and names the failed check to Brian, and
  no unbatched Waiting row changes. 10P with Paid On blank, a future date, or a date before
  a row's Earned On: the same.
- H24. (Mixed batch) In a TEST HealthFirst batch of two rows, BB2 edits one row's Payer to
  `Direct Dental` by hand. 10P on that batch stops before any change: both rows stay
  Waiting. A `Send` dry run on it stops at check 4. BB2 sets the Payer back; then a row's
  Test edited to No: 10P stops at check 5 and the `Send` dry run at check 6. Set it back.
- H25. (Sent once) The H19 row, cleared to Test No, is put in a Real HealthFirst batch. 10P
  on it stops at check 1 (`RealPayoutsOn` false). A `Send` with Dry run No stops at check 2.
  A `Send` dry run passes and emails Brian only. BB2 sets the record's Send Started On by
  hand: a second dry run stops at check 3, and the batch is listed X19. No `Real` batch is
  ever sent with Dry run No in testing.
- H26. (W8) A TEST case with a Waiting K_R; BB2 adds a second TEST Service Case linked to
  the same Referrals row and company. Both are listed X15, and no new row is written. The
  partner marks the first case Qualified No: its K_R is Void. Delete the second case.
- H27. (X17 and the hold) A rep app TEST lead to HealthFirst, then a second for the same
  practice name with a different JDE within 12 months, reached and qualified: the second
  has a Waiting K_R, listed X17, and no row is voided. A TEST HealthFirst `New` batch (and
  its dry run) leaves that row out. After seven days it is still listed. Brian sets Office
  Check `Cleared`: it leaves X17 and the next TEST batch holds it. A second such pair,
  where Brian voids the row by hand: it leaves X17 and is in no batch.
- H28. (The freeze) The X1 section of the exceptions email starts with the freeze line.
  A forced HSBS 10 failure (A7) makes an open Ledger Run Errors row; the freeze check run
  then fails at part 1, though no email has gone out since. After a successful run and the
  row marked resolved, it passes. A 10D catch-up stopped part way (BB2 cancels the run)
  leaves its catch-up row open, and the freeze check fails.
- H29. (Roster conflict) A TEST rep given two Active Team Roster rows (BB2 makes the second
  TEST pair by hand), and a sign: a Sign Log row with the plan, Handled On blank, no K_M
  and no K_S, listed X18. Brian sets one row Active No and saves the case: one K_M, Waiting,
  $50 from the stored Plan Manager, to the remaining manager; Handled On set; X18 drops
  it.
- H30. (Batch ID used once) Two TEST HealthFirst `New` runs started in the same minute: the
  second fails to create its record and stamps nothing.
- H31. (Confirmation and retry) A TEST batch of three Waiting rows is sent (`Send`, Dry run
  No; it goes to Brian only): its record has Send Started On, Rows Sent (the three keys)
  and Sent On, and each row has Sent On. Row 2's case is then marked Qualified No: row 2 is
  Void, listed X13. 10P with a Paid On before the record's Sent On stops at check 5. 10P
  with row 3's key in Not paid: row 1 Paid; row 2 Paid, Disputed Yes, Dispute Note starting
  `voided after it was sent, then paid`, listed X7; row 3 Waiting with Payout Batch and
  Sent On blank. The same 10P run again, same inputs: it succeeds and changes nothing. 10P
  again with Not paid blank: stops at check 7, nothing changes. A key that is not on the
  sent list in Not paid, on a new batch: stops at check 6.
- H32. (Send lock) A TEST batch of three Waiting rows. Before `Send`, row 1's case is
  marked Qualified No (row 1 Void): `Send` drops it, and it is not in Rows Sent or the
  email. With a temporary 60 second Delay added after the reread in step 10, a second TEST
  batch is sent, and during the delay row 2's case is marked Qualified No: the Sent On
  stamp on row 2 fails (412), row 2 is not in Rows Sent or the email, and has no Sent On.
  Remove the Delay.
- H33. (Sign handled once) A TEST HealthFirst sign under 100 / 0 / 50: one K_M, and a Sign
  Log row with Plan Manager 50, Plan Rep Sign 0, Handled On set. After the freeze check,
  BB2 sets `HF_Signed` to 150 on the row; the case is saved and 10D runs: no K_S. Then `HF_Manager` 0
  and a new TEST sign: Sign Log Handled On set at once, no sign row; `HF_Manager` back to
  50, the case saved and 10D run: still no K_M. Restore 100 / 0 / 50.
- H34. (Sign not finished) With `HF_Signed` 150, a temporary Terminate (Failed) step right
  after the K_M create, and a TEST sign: K_M Waiting, no K_S, Sign Log Handled On blank,
  listed X1 and, the next day, X20. The step removed, the case saved: one K_S, Waiting,
  $150 (the stored Plan Rep Sign), no second K_M, Handled On set. Restore `HF_Signed` 0
  after the freeze check passes.
- H36. (Send recovery) A TEST batch is sent with a temporary Terminate (Failed) step added
  right before step 13: the email reaches Brian, the record has Send Started On, Rows Sent
  and Send Run ID but no Sent On, and it is listed X19 with the run ID. 10P on it stops at
  check 3. 10B `Finish` answered No changes nothing. 10B `Finish` answered Yes, after the
  named run shows the send email step Succeeded: Sent On = Send Started On, no email is
  sent, and X19 drops it. A second `Finish` stops (Sent On is set). A second batch with the
  Terminate step before step 12 (no email): X19, and clearing the send by hand lets a later
  `Send` go out once. Remove the Terminate step.
- H35. (Catch-up, every age) A TEST rep app case whose Referrals row is more than 400 days
  old by Created (or the lowest-ID TEST rep app row there is) and that is Qualified Yes
  with no K_R because HSBS 10S was off when it was saved: the next 10D pass
  writes its K_R. The 10D run history shows every ID window from 1 to the highest ID read.

### Group G: the staffing guard and switch (staffing off)

- G1. A TEST staffing case saved `qualified` (staffing off): no row of any kind; listed X5. Marked Qualified No on another: no Void row. A duplicate
  staffing pair: no row.
- G1a. (Switch off after on; run after group S) A TEST staffing case with a Waiting K_R from
  group S. `StaffingAwardsOn` is set false, then the partner marks it Qualified No: K_R is
  Void with the reason, and no new row is written.
- G2. Retired 11/21 (rule G, R5).
- G3. A TEST staffing case with Partner Status `Signed` and a Signed Date set by Brian in
  SharePoint, Qualified blank: no row, listed X6. Brian sets Qualified Yes: X6 drops it,
  and with staffing off it is on X5 and still has no row.

### Group S: staffing (only after build order step 5's condition; `StaffingAwardsOn` true, `LedgerTestOnly` true)

- S1. (R5) A TEST staffing case saved `qualified`: one K_R, Waiting, $100, Company
  `Staffing`, Payer `Direct Dental`.
- S2. (R5, 11/22) Two TEST staffing cases, Rep Practice Type `Private practice` and `Group`:
  K_R $100 and $200. Blank: $100. PASS live 11/22 (multi-office build record).
- S3. (R5) A practice type change after the K_R row exists never changes its amount (D3).
- S4. (M4) Same JDE to HealthFirst, then to staffing: the staffing case earns. The reverse
  on another JDE: the HealthFirst case earns.
- S5. (M5) Same JDE to staffing twice within 12 months: the second has one K_R, Void,
  `this office was referred to Direct Dental in the last 12 months`, from its first run,
  before any answer; the first keeps its award. The second is then reached, qualified and
  signed: K_M Void with the same reason; no Waiting row for it.
- S6. (M6) A staffing sign: one K_M, Waiting, $50, to the manager on the rep's Active Team
  Roster row. Saving again writes none. No K_S is ever written for staffing.
- S7. (M7) A TEST batch for `HealthFirst` holds only HealthFirst rows and no staffing row; a
  TEST batch for `Direct Dental` holds only staffing rows. One TEST staffing row with its
  Payer edited by hand to `HealthFirst` is in neither batch and is listed X12; set it back.
- S8. (M8) As H20, for the staffing rows.
- S9. (M10, M11, M16, M24, M17, M14, M19, M21 for staffing) H3 to H8, H12, H13, H16 and H17
  run on staffing cases, with `Direct Dental` in the reasons and the staffing amounts.
- S10. (M18 for staffing) Closed `Already a customer` before any award: K_R Void, $100, in
  no batch.
- S11. (M22, pay part) A HealthFirst rep app TEST lead handed back and sent on to staffing
  by sheet F7: the staffing case, qualified, has one K_R, $100,
  Company `Staffing`, for the original rep; the HealthFirst case has no row. The reverse
  direction the same. Each is a Test row in no Real dry run.
- S12. (Staffing on) A signed gap case (G3) where Brian sets Qualified Yes: one run writes
  K_R and K_M.
- S13. (M12, second order) With the site's `REP_PAY_PLAN_STAFFING` unset, a staffing case
  saved `qualified` still gets its K_R from the Ledger Settings amounts.

### Go-live checks (no TEST data needed)

- L1. After go-live: LedgerTestOnly No, StaffingAwardsOn No, RealPayoutsOn No until step
  6a, read from the Ledger Settings row and confirmed in each flow's `Settings read` step
  ("How BB2 confirms the change took"); amounts as A3.
- L2. After F4.9: StaffingAwardsOn Yes, confirmed the same way, and gates G1 to G6 in the
  build report.

After the checks, BB2 deletes the TEST rows, cases and ledger rows he made, and the
temporary flow from A6.

## Rollback

0. `RealPayoutsOn` to No in the Ledger Settings row.
1. `StaffingAwardsOn` to false, if it was turned on. HSBS 10 still voids staffing rows.
2. `LedgerTestOnly` to true. From here HSBS 10 no longer voids a real row when a no-pay
   reason appears, so Brian runs no Real batch (HSBS 10B) until HSBS 10 is back on with
   `LedgerTestOnly` false and a 10D pass has run.
3. Turn off HSBS 10D, then HSBS 10S, then HSBS 10. 10B and 10P stay on with
   RealPayoutsOn No. A payer's confirmation of a list sent before the rollback is recorded
   with 10P after Brian's go to set RealPayoutsOn Yes for that run, and No again after.
4. Ledger rows already written stay as they are: an award earned stands, a Paid row is never
   changed (D3), and no non-TEST row is ever deleted. A batch stamped but not sent may have
   its Payout Batch cleared by Brian by hand.
5. The Company column stays; a blank Company reads `HealthFirst`, and 1F
   and the site read it that way. Ledger Run Errors, Sign Log and Payout Batches stay:
   a handled sign stays handled, and a batch record still says what was sent.

## Spec clause to sheet step

| Spec clause | Step | Check |
|---|---|---|
| 9 F4: Company on the ledger | F4.1, F4.2, W17 | A1, A2, S1 |
| 9 F4 and 11/21: per-company amounts, from the promo file | Amount settings, W13 | A3, S1, S2 |
| 11/22 (R5): staffing $200 when the rep picked `Group`, else $100 | W10, W13 | S1, S2, S3 |
| 6 and 11/21 (R4): Qualified Yes, both companies | W15 | H1, H2, S9 |
| 6 (T18): no auto-reached award; two silent-partner lists | W15, X2, X3 | H16 |
| 6: not-qualified void; Paid stays Paid and Disputed | W11, W14, W15 | H3 to H7 |
| 6 (D12): 12 month look-back per company, any source, by JDE | W11 | H12, H13, S4, S5 |
| 6: no-pay case pays nobody, manager included | W11, W16 | H12, S5 |
| 6: a Void Reached row only where the plan has a reached award | W15 | H14 |
| 6: manager pay at the sign, D18, decision 77 | W16 | H9, H10, S6 |
| 6: HSBS 10 checks Qualified before a Manager row | W16 rule B.1 | H8, G3 |
| 9 F4: Payer per company; one batch per payer | Company table, F4.7 | S7, H22 |
| 75: staffing payout list to the Routing contact | F4.7 Send | S7, H22, H24, H25 |
| Nothing is marked Paid without a confirmed payout; a batch is sent once | F4.7 Send, F4.8 | H23 to H25 |
| 6: no Team Roster or plan change while a failed or pending run is listed | F4.4 "The freeze", X1 | H28 |
| 9 F4: staffing awards held behind a setting | W9, F4.9 | G1, G1a, L2 |
| 6: Rep app only (T24) | W5 | H15 |
| 6 (D8): TEST rows earn, never in a real batch | W17, F4.7 | H20, S8 |
| 6: live rep with a Test manager | W17, X11 | H19 |
| 6: hand back changes no pay | W11 | H17 |
| 6: blank Company reads HealthFirst | F4.1 | H18 |
| 13: releasing a manager's Test row after go-live | X11, F4.7 | H19 |
| T9: no double row | Trigger concurrency 1, unique Award Key, ETag | A6 |
| Manager pay needs exactly one Active Team Roster row | W16 step 5, X18 | H29 |
| A sign is handled once, by a marker that does not depend on the plan | W16 steps 3 and 7, Sign Log | H33, H34 |
| Catch-up covers every rep app case, whatever its age | F4.6 step 1 | H35 |
| A send claims each row by ETag; a confirmation retry with the same inputs finishes | F4.7 steps 9 to 14, F4.8 | H31, H32 |
| A send whose email went out but whose last stamp failed is finished without sending again | F4.7 `Finish`, X19 | H36 |
| The switches are one shared row every flow reads | "Shared switches" | A3, A3a, L1, L2 |
| Site plans equal HSBS 10's amounts before a change or staffing on | Freeze check part 4, G6 | Build report |
| Money that moved after a void is recorded, never hidden | F4.8 | H31 |
| 12 month check, TEST and real apart (decision 90) | W11 rule 1 | H12, S5 |

## Ask Brian

Each has a safe default that the build follows until he answers. Ask one at a time.

- **A1. Settled by decision 90** (Brian, 11/13: "Never block each other"): in the 12 month
  look-back TEST rows check only against TEST rows, and real only against real.
- **A2. Ask Brian:** The two silent-partner lists (X2, X3) and the "signed without both
  answers" list (X6) cover rep app cases only. Do you also want field page, other-team, FSC app and
  Salesforce cases on them? (Sheet F2's wording says every signed HealthFirst or staffing
  case with Qualified blank, which would list every HealthFirst case signed before the
  change.) Safe default: rep app cases only, since only they can pay.
- **A3. Ask Brian:** For "reached, no qualify answer for five business days", the clock
  starts at the date the partner gave for talking (Talked On). OK? Safe default: Talked On;
  a reached case with no Talked On is listed from the first day.
- **A4. Retired 11/21** (R5): a staffing row carries `ST_Qualified`, or `ST_Qualified_Group` for a `Group` pick (11/22).
- **A5. Ask Brian:** How long should the information lines (X9, a type changed after its
  award; X10, a not-qualified "Other" note) stay on the daily email? Safe default: seven
  days from the partner's last update.
- **A6. Ask Brian:** Who at HealthFirst receives the HealthFirst payout list, and when is
  the payout date? (Open since rep app v3, "from the Tuesday call".) Safe default: HSBS 10B
  sends HealthFirst lists to you only, and you forward them; it runs only when you run it.
- **A8. Settled 11/21** (Brian, on the manager pay card: "When it signs"): the manager's
  $50 pays at the sign, rule B as written.
- **A7. Ask Brian (only if gate G4 finds live staffing cases):** If live staffing cases were
  reached and qualified while staffing awards were off, do they earn when it turns on?
  Safe default: `StaffingAwardsOn` stays off until you answer.
