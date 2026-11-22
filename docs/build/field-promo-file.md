# Field pay: the promo file

Written 11/21/2026. Brian, 11/21: "What I will need to create is a file for each dedicated
promotion that shows what the payot is like for instance in the case of HF and DD, it's 100
of qualified lead and $50 to the manager".

A promo file is the one written record of what a pay promotion pays. HSBS 10 and the site
never read the file. Brian (or BB2 on his word) copies its numbers into the two places that
pay and promise, and both must match the file:

- the Ledger Settings `Live` row on the field site, which HSBS 10 reads (sheet F4, "Amount
  settings on the Ledger Settings row");
- `REP_PAY_PLAN` and `REP_PAY_PLAN_STAFFING` in Vercel, which word the promises on screen
  (`src/lib/rep-pay-plan.mjs`).

## The file

- One file per promotion, CSV, saved as UTF-8. Name: `<company>-<short-name>.csv`, all
  lowercase, words joined by `-`. Example: `healthfirst-launch.csv`.
- One header row and one data row. A promotion that covers two companies is two files, so
  each partner's terms stand alone.
- The approved copy lives in `docs/build/promos/` and is changed only by a PR Brian merges.
  It holds no names of people other than the approver, no email address, phone number, URL
  or key.

## Columns

Every column is required. Each check is pass or fail.

| Column | What | Check |
|---|---|---|
| Promotion | Short name | Not blank, 60 characters or fewer |
| Company | Ledger company key | Exactly `HealthFirst` or `Staffing` (`Staffing` is Direct Dental) |
| Partner | Name in words | Exactly `HealthFirst` or `Direct Dental`, matching Company |
| Start | First day the promotion pays | `YYYY-MM-DD`, or `go-live`: the day `LedgerTestOnly` goes false (sheet F4, build order step 6) |
| End | Last day | `YYYY-MM-DD` on or after Start, or `open`: runs until a newer file replaces it |
| Who earns | Who gets the rep award | `sender`: the person whose own app link sent the lead (any `/join` role) |
| Rep event | When the rep earns | `qualified` (Qualified is Yes) or `signed` |
| Rep amount | Dollars. With `group-3-plus`, the amount for a practice under 3 locations | Whole number, 1 to 1000 |
| Rep group amount | Dollars for a group of 3 or more locations | Whole number, 1 to 1000. Equals Rep amount with `flat` |
| Rep sign amount | Extra dollars to the rep at the sign | Whole number, 0 to 1000. 0 means none |
| Manager event | When the manager earns | `signed` or `none` |
| Manager amount | Dollars to the rep's manager on the Team Roster | Whole number, 1 to 1000 with `signed`; 0 with `none` |
| Practice type rule | Whether practice type changes pay | `flat`, or `group-3-plus` (Staffing only): Rep amount under 3 locations, Rep group amount at 3 or more, by the practice type the partner confirms (sheet F4, rule G and gate G3) |
| Cap per rep | Most awards one rep earns in the promotion | `none`, or a whole number |
| Payer | Who funds the awards | `HealthFirst` or `Direct Dental`, matching Company |
| Approved by | Who approved the terms | `Brian` |
| Approved on | Date of approval | `YYYY-MM-DD` |

A file with `signed` as Rep event, a manager event other than `signed` or `none`, a
practice type rule other than `flat` or `group-3-plus`, a cap other than `none`, or an End other than `open`
needs a sheet F4 change before it can pay. Sheet F4 builds only what today's files say.

## Where each number goes

| Promo file | Ledger Settings (HealthFirst file) | Ledger Settings (Staffing file) | Vercel, HealthFirst | Vercel, Staffing |
|---|---|---|---|---|
| Rep amount | `HF_Qualified` | `ST_QualifiedPrivate` | `reached:<n>` in `REP_PAY_PLAN` | `reached_private:<n>` in `REP_PAY_PLAN_STAFFING` |
| Rep group amount | not used | `ST_QualifiedGroup` | not used | `reached_group:<n>` in `REP_PAY_PLAN_STAFFING` |
| Rep sign amount | `HF_Signed` | must be 0 | `signed:<n>`, left out when 0 | none |
| Manager amount | `HF_Manager` | `ST_Manager` | `manager:<n>` | `manager:<n>` |

The two Vercel values for today's files: `REP_PAY_PLAN` `reached:100,manager:50` and
`REP_PAY_PLAN_STAFFING` `reached_private:100,reached_group:200,manager:50` (Brian, 11/22).
The live values still read the 11/21 flat `reached_private:100,reached_group:100,manager:50`
and one `ST_Qualified` until the 11/22 change goes live (sheet F4, "Pay baseline 11/22").

## Changing a promotion

1. Brian writes or edits the file and merges the PR.
2. Before any amount changes: the freeze check in sheet F4 ("The freeze") passes.
3. Ledger Settings and Vercel are changed together, to the file's numbers. Sheet F4's plan
   equality check compares them.
4. A row already written keeps its amount (D3). A new amount pays only rows written after
   the change.

## Today's files

| File | Company | Rep | Manager | Approved |
|---|---|---|---|---|
| `promos/healthfirst-launch.csv` | HealthFirst | $100 when qualified | $50 when signed | Brian, 11/21/2026 |
| `promos/direct-dental-launch.csv` | Staffing (Direct Dental) | When qualified: $100 under 3 locations, $200 at 3 or more | $50 when signed | Brian, 11/22/2026 (replaces the flat $100 of 11/21) |

Brian picked the manager event "When it signs" on 11/21/2026.

Brian picked the Direct Dental amount by locations on 11/22/2026 at 11:34 AM ET ("$100 /
$200 by locations"). It replaces the flat $100 of 11/21. Rows already written keep their
amount (D3).
