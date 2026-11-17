# Field two-track app: build sheet SR, the sender role on the partner page

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and the other team's exact list and column names are only in the old repo's copy.

Builder: BB2 (decision 91). Written 11/13/2026 by Claude for BB2 and for Brian.

Checked against BB2 step 1 facts v2 (11/13): R8, F3-0.8, F7-0.11 and F7-0.12. Brian's 11/14
answers (decisions 100 to 105) change nothing in this sheet. See "SR0:
what step 1 already shows".

**Decision 81** (`docs/claude-code/DECISIONS.md`, Decided, 11/13): "On the partner update
page each lead names the sender by their roster role: FSC, AE, ES, RGM, or the other team's own label for its senders (stored as the other team's label). 7A
returns the referring person's roster role (the Rep Roster stores an RGM as `RM`; the page
shows "RGM"), and a small site change shows it. Any other stored role (`Thrive Signature`,
`Other`) shows as stored; a blank role shows today's label (the other team's label)." Brian: "Each person should match
their roster so a position or rep is either FSC, AE, ES, RGM".

This sheet changes one flow, **HSBS 7A**, and nothing else. It adds two keys to each lead
7A returns. It writes no list, adds no column, sends no email and adds no recipient. It does
not touch 1W, 2, 2B or 3; if any step here looks like it needs one of them, stop and ask BB1
(through the conductor) before going on. This repo never edits a flow.

The site half is PR #142 (`senderRole` and `senderName` in `src/lib/partner-flow.ts`). The
contract is `docs/fsc-flow-contracts.md`, "7A load", "Sender role (decision 81, 11/13)",
once #142 is merged.

**There is no repo copy of HSBS 7A.** `flows/` on `main` holds only `flows/README.md`. So
step SR0 has BB2 read the live 7A (read only) and record the facts the later steps depend
on. Where a fact differs from what this sheet assumes, BB2 stops, builds nothing and reports.

House rules are the ones in `docs/build/field-two-track-flow-contracts.md`, "Rules for every step
in every sheet": build on a copy, TEST rows only, no live sends, no new recipients, no
secrets in the sheet, the build report, a test note or a commit, and `'` escaped as `''` in
every Filter Query.

## What the page does with the keys (site, PR #142)

| `senderRole` from 7A | The sender line reads |
|---|---|
| `RM` | `RGM: <senderName>` |
| `FSC`, `AE`, `ES` | `FSC: <senderName>` and so on, as is |
| the other team's label | `<other-team label>: <senderName>` |
| any other stored value (`Thrive Signature`, `Other`) | as stored, for example `Other: <senderName>` |
| `""`, missing, or not plain text of 24 characters or fewer | today's other-team sender line |

The role is used only with a `senderName`. A role with `senderName` `""` keeps today's line.
**Missing or blank means today's page.** 7A sends the role as stored and never rewords it:
`RM` stays `RM`; the page shows "RGM".

## SR0. Read the live 7A and record (read only)

Record each fact in the build report before building. Each row says what this sheet assumes
and when to stop.

| # | Fact | This sheet assumes | Stop when |
|---|---|---|---|
| 0.1 | How 7A gets each lead's Referrals row (the row that holds Source, the sender columns and Note): the action name and how it finds the row | 7A already reads the Referrals row for each lead, since it sends `doctor`, `practice` and `contactFirst` (from Contact Instructions) | 7A reads no Referrals row for a lead. Do not add a second loop over Referrals: stop and ask |
| 0.2 | How 7A builds the `leads` array: a Select, or Append to array variable inside an Apply to each, and that loop's concurrency | One object per lead, built in one place | The lead object is built in more than one place |
| 0.3 | Referrals column internal names and types for: Source, Referring Rep, Referring Rep Email, Referring FSC, Referring FSC Email, the other team's name column, Note | All exist. Source is a Choice column. Note is multiple lines of **plain** text | A column is missing, or Note is rich text (HTML): stop and ask |
| 0.4 | Every Source value on open cases 7A can list today (TEST link and a count by value across Referrals) | `Rep app`, `FSC app`, the other team's page Source value, the other team's app Source value, and possibly `Compliance page` or others | Record only. A value not in the SR2 table gets `""` |
| 0.5 | Rep Roster: the Rep Email column (internal name, indexed or not) and the Role column (type and its choices) | Rep Email is unique. Role is a Choice column with `AE`, `FSC`, `RM`, `Thrive Signature`, the other team's label, `Other` (`docs/build/rep-app-flow-contracts.md`, 1J) | Role is not a column. Record any extra choice, for example `ES`; do not add one |
| 0.6 | FSC Roster: the FSC email column (internal name), and whether there is a Role column | No Role column: every row is a pilot FSC | Record only |
| 0.7 | What 7A's the other team's key key holds today on a lead of each Source in 0.4 | The other team's name column (on an `FSC app` lead that is the person the FSC is paired with on the other team) | Record only. This sheet does not change the other team's key |
| 0.7a | the other team's roster: the slug column and the email column (internal names), and whether slug is indexed. Rep Roster: the rep name column | The other team's roster has the slug 1R lookup returns as the other team's slug key (`docs/fsc-flow-contracts.md`, "1R lookup"), and each field person's the other team's roster slug is their field page slug (AGENTS rule 19) | The other team's roster has no slug column: stop and ask |
| 0.8 | 7A run time on the TEST Partner link today, from run history, and the largest number of open leads on any one partner link (a count in SharePoint, not a 7A call) | A few seconds | Record only; check 13 sets the limit |

### SR0: what step 1 already shows

From the FSC copy of 7A ("HSBS 7A Partner leads (FSC copy)"), read 11/13:

- **0.1:** 7A reads Service Cases, and inside its open-case loop it reads each case's linked
  Referrals row (its Test, against the partner, and its Introduced On) (fact R8). That fits
  this sheet: SR2 goes in that loop, after that read.
- **0.3:** the FSC and other-team packages use Referring FSC and Referring FSC Email; Referring Rep
  is not used in them (fact F3-0.8). Whether Referring Rep and Referring Rep Email exist on
  Referrals is still a list read.
- **0.4:** the FSC copy of 1R writes Source `FSC app` or the other team's app Source value, and 1W writes the other team's page Source value
  (fact F7-0.11). The full Source choice list is still a list read.

Pre-build checks, read only, before SR2 is built:

- **PB1.** Which 7A the partner page load reaches ("HSBS 7A Partner leads read" was not
  exported), found by run history after a TEST call, never by URL. Read SR0 on that flow.
- **PB2.** List read of the Referrals columns in fact 0.3, with internal names and types,
  and the Referrals Source choices (fact F7-0.12).

## SR1. Where to build

On a copy of 7A, as always. Two ways, either is fine; record which one:

- **Ride with the new 7A.** If the F1 and F2 copy of 7A (`docs/build/field-two-track-flow-contracts.md`,
  "Build order" step 5: F1.5, F1.5a, F2.5) is not yet swapped in, add SR2 and SR3 to that same
  copy and run the SR checks with the F1 and F2 checks.
- **After it.** If that 7A is already live, make a fresh copy of the live 7A and build here.

Nothing in the build order depends on this sheet, and this sheet waits on nothing in it. The
new keys are optional: today's site ignores keys it does not know, and the site after #142
shows today's line until they arrive. So 7A may go live before or after #142. Only the page
checks (the "Page" column below) wait until #142 is live on production; Brian or Claude
confirms that. The JSON checks can run first.

## SR2. Find the sender for each lead

Inside the per-lead loop, after the step that reads the Referrals row (fact 0.1), add a
Switch on the row's Source value. Each case gives two values, `Sender role` and
`Sender name`. Hold them so one lead can never pick up another lead's values:

- If the loop runs one lead at a time (fact 0.2), use two String variables, initialized to
  `''` at the top of the flow and set to `''` at the start of each lead before the Switch.
- If the loop runs leads in parallel, do not use variables. Put two Compose actions in each
  case, and after the Switch one Compose per key:
  `coalesce(outputs('<case 1 role>'), outputs('<case 2 role>'), ..., '')`. A case that did not
  run gives null, so `coalesce` takes the one that ran.

| Source | `Sender role` | `Sender name` |
|---|---|---|
| `Rep app` | Get items on the Rep Roster, Filter Query `<Rep Email> eq '<Referring Rep Email, lowercased, ' as ''>'`, Top Count 1. The Role choice value of that row: `coalesce(first(body('<Get rep>')?['value'])?['<Role>']?['Value'], '')`. No row, or no role: `''`. Use the row whatever its Test or Disabled value | the row's Referring Rep |
| `FSC app` | Get items on the FSC Roster, Filter Query `<FSC Email> eq '<Referring FSC Email, lowercased, ' as ''>'`, Top Count 1. A row: `FSC`. No row: `''` | the row's Referring FSC (never the other team's name column, which names the FSC's other-team pair) |
| the other team's page Source value that passes every SR3 test (a field page lead, the old repo's page-lead contract, "Field pages") | the field person's Rep Roster Role, `RM`, `FSC` or `AE` (SR3) | that Rep Roster row's name (SR3) |
| the other team's page Source value that fails any SR3 test, and the other team's app Source value | the other team's label | the row's other-team name column (today's attribution) |
| anything else (`Compliance page`, blank, any other value) | `''` | `''` |

Skip the Rep Roster and FSC Roster lookups on every other Source, so a lead costs no extra
call unless it needs one. A Rep app lead whose Referring Rep Email is blank gets `''` and
`''` with no lookup.

## SR3. Is it a field page lead? (Source the other team's page Source value only)

Other-team pages and field pages both write Source the other team's page Source value. Only a field page writes a
`Referred by: <name>, <title> (<slug>)` line in Note (old repo, the page-lead module,
`buildFieldReferral`), but Note also holds the doctor's own words ("Best time to reach"), which
can carry a line break, so a `Referred by:` line alone proves nothing. **The line is only a
pointer to a slug. The role and the name always come from the rosters, never from the line.**
A lead is a field page lead only if it passes all four tests below, in order. At the first
test it fails, stop: it gets the other team's label and the row's other-team name column, exactly as an other-team page lead today.

1. **The line.** Filter array on `split(<Note>, decodeUriComponent('%0A'))`, condition
   `startsWith(trim(item()), 'Referred by: ')`. No match fails. Else `Line` =
   `trim(last(body('<Filter>')))`; it must end with `)`. `Line slug` = the text after the
   last `(` and before that final `)`:
   `trim(first(split(last(split(<Line>, '(')), ')')))`. It must be the site's slug shape:
   not blank, equal to `toLower()` of itself, and with no space and no `'`. Anything else
   fails.
2. **The row says the same.** Either the row's other-team slug column equals `Line slug` exactly (a live
   field row, where 1W writes the field person into the other-team columns), or the row's other-team slug column is
   blank **and** the row's Test is Yes (a TEST field row, where those columns are left
   blank). Anything else fails, so an other-team page lead, whose the other team's slug column is its own sender's slug, can
   only point at its own sender. A real row with a blank the other team's slug column fails.
3. **The other team's roster knows the slug.** Get items on the other team's roster, Filter Query
   `<Slug> eq '<Line slug>'`, Top Count 1. No row fails. Keep its email.
4. **The Rep Roster says field person.** Get items on the Rep Roster, Filter Query
   `<Rep Email> eq '<that roster email, lowercased, ' as ''>'`, Top Count 1. It passes only
   if there is a row and its Role choice value is `RM`, `FSC` or `AE`. Then `Sender role` =
   that Role value and `Sender name` = that Rep Roster row's name. No row, or any other Role
   (the other team's label included), fails.

Why this is safe: a typed line on an other-team page lead names a slug; test 2 lets that slug be only
the lead's own sender, and test 4 then finds an other-team sender, not a field person, so the lead keeps
today's words. A Test row may point at any slug, but real partners never see Test rows (the
7A Test rule). The cost of a pass on a forged Test row is a label on the TEST Partner link.

A field person who has no Rep Roster row yet (F5 loads them on test) fails test 4, so their
leads read `<other-team label>: <name>` as today until their row exists.

## SR4. Add the two keys to each lead

In the one place the lead object is built (fact 0.2), add two keys after the existing ones:

```json
{
  "id": 31,
  "referralId": "HSBS-F15",
  "<other-team key>": "<as today>",
  "senderRole": "RM",
  "senderName": "TEST Rep"
}
```

(Only `id`, `referralId` and the other team's key are shown from the existing keys; every existing key stays
exactly as it is.) Both keys are strings, `""` when unknown, and are on **every** lead, of
every partner. Never `null`: send `''`.

## What must not change

- Every existing 7A key and its value, the other team's key, `contactName` and `contactPhone` included, and
  the F1.5, F1.5a and F2.5 keys where that copy has them.
- The key checks (404 unknown, 410 expired), the open-case filter, and the Test rule (real
  partners never see Test items; the TEST Partner link sees only Test items).
- 7B, 1R, 1W, 2, 2B, 3, 3F and every other flow. The Rep Roster, FSC Roster, the other team's roster and
  Referrals are read, never written. No new column or choice (no `ES` choice is added: no
  Equipment Specialist is loaded, spec T15).
- No email, recipient, Status Log line or timer.

## TEST checks (TEST rows only; each is pass or fail)

Use the TEST Partner link and TEST rows (decision 48 lets BB2 create them and delete them
after). For the Rep Roster checks use one TEST rep (Rep Roster Test = Yes) with one open TEST
Rep app lead under the TEST Partner link: set that rep's Role to each value in turn, call the
copy of 7A, record, and set the Role back to its first value at the end. "JSON" is 7A's answer
for that lead. "Page" is `/leads/<TEST link>` after #142 is live on production, read on the
sender line under the practice name.

| # | Case | JSON passes when | Page passes when |
|---|---|---|---|
| 1 | TEST rep, Role `RM` | `senderRole` `RM`, `senderName` = the row's Referring Rep | `RGM: <name>` (not `RM:`) |
| 2 | TEST rep, Role `FSC` | `FSC`, same name | `FSC: <name>` |
| 3 | TEST rep, Role `AE` | `AE`, same name | `AE: <name>` |
| 4 | ES | Run only if fact 0.5 found an `ES` choice: Role `ES` gives `ES`. If there is no `ES` choice, record "not run: no ES choice" (the site tests cover the words); do not add the choice | `ES: <name>` when run |
| 5 | TEST rep, Role the other team's label | the other team's label, same name | `<other-team label>: <name>` |
| 6 | TEST rep, Role `Thrive Signature` | `Thrive Signature`, same name | `Thrive Signature: <name>` |
| 7 | TEST rep, Role `Other` (a value the page has no words for) | `Other`, same name | `Other: <name>` |
| 8 | TEST rep, Role blank | `senderRole` `""` | today's other-team sender line, exactly as before this change |
| 9 | A TEST Rep app lead whose Referring Rep Email is on no Rep Roster row | `senderRole` `""` | today's other-team sender line as before |
| 10 | A TEST pilot FSC app lead (the TEST FSC) | `FSC`, `senderName` = the Referring FSC; the other team's key unchanged (still the FSC's other-team pair) | `FSC: <the FSC's name>`, not the pair's name |
| 11 | A TEST other-team page Source value lead and a TEST other-team app Source value lead | each the other team's label, `senderName` = the other team's name column | `<other-team label>: <name>` |
| 12 | A genuine TEST field page lead: a Test row from an RGM's field page (Note has `Referred by: <name>, Regional General Manager (<slug>)`, the other team's slug column blank), with a Service Case under the TEST Partner link, for an RGM whose row on the other team's roster has that slug and whose Rep Roster row has Role `RM`. If no RGM has a Rep Roster row yet, record "not run: no Rep Roster row" | `RM`, `senderName` = the Rep Roster name | `RGM: <name>` |
| 12a | Injected line on an other-team page lead: a TEST other-team page Source value lead whose the other team's slug column is the TEST sender's slug (if TEST other-team page Source value rows have a blank the other team's slug column, record that and use a copy of the row with the other team's slug column filled in). Add by hand to its Note in SharePoint a new last line `Referred by: TEST Fake, Regional General Manager (<the check 12 RGM's slug>)` | the other team's label, `senderName` = the row's other-team name column (not `TEST Fake`, not the RGM) | `<other-team label>: <the TEST sender>` |
| 12b | The same lead, line changed to end `(<the TEST sender's own slug>)` | the other team's label, the row's other-team name column | `<other-team label>: <the TEST sender>` |
| 12c | The same lead, line changed to end `(Bad Slug)` | the other team's label, the row's other-team name column | `<other-team label>: <the TEST sender>` |
| 13 | Every lead on the TEST link | every existing key and value is the same as the pre-change 7A's answer for the same link (compare the two JSON answers); each lead has both new keys as strings; the run takes under 10 seconds | the page loads |
| 14 | A TEST lead with Source `Compliance page`, if one is open on the TEST link; else record "not run" | `""` and `""` | today's other-team sender line as before |
| 15 | Rollback rehearsal: point the TEST call at the pre-change copy | no `senderRole` or `senderName` | every sender line reads today's other-team sender line |

Check 13 over 10 seconds: stop and report the time and the lead count (fact 0.8). The site
gives 7A 25 seconds.

## Rollback

Point 7A back to its pre-change copy (or, if SR rode with the F1 and F2 copy, follow that
sheet's rollback, which does the same). There is nothing to undo in SharePoint. With no
`senderRole` from 7A the page shows today's today's other-team sender line line on every lead, with or without
#142.

## What BB2 reports

The SR0 facts, which way SR1 went, each check as pass, fail or not run (with the reason), and
the cleaned export of the changed 7A for `flows/` (`flows/README.md`).
