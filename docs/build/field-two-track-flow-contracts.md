# Field two-track app: flow build sheets F1, F2 and F6

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and the other team's exact list and column names are only in the old repo's copy.

Builder: BB2 (decision 91).

Checked against BB2 step 1 facts v2 (11/13): R1 to R12, F3-0.1, F3-0.5, F3-0.8, F7-0.1,
F7-0.6, F7-0.9, F7-0.11 and F7-0.12. Facts R1 to R12 were read from the FSC copies of 1R, 7A
and 7B (pre-build check PB1). Results, pre-build checks and stop items ST1 to ST3 are under
"BB2 records before building".

**Brian's answers, 11/14 (decisions 100 to 105, `docs/claude-code/DECISIONS.md`).** Stop
items ST1 to ST3 are now decided and written below as build steps. Scope (Brian, 11/14:
"what you are working on is the FSC and the AE, RGM app. Not the other-team sender"): each of these
changes applies only to a **field or FSC case** ("Words used"). 7B and Service Cases are
shared with the other team's path, so every new 7B step branches on the case's referral Source, and
a other-team case is saved exactly as today.

**There is no repo copy of HSBS 1R, 7A or 7B. Before building any step, BB2 must read the
live 1R, 7A and 7B (read only) and record in the build report every point this file marks
"not in the repo copy" and every "BB2 records before building" line.** Step 1 did this on
11/13 for the FSC copies; see "Step 1 results".

Written 11/13/2026 by Claude for BB2, from the approved spec "Field two-track app: team members
and managers (v1)" (approved by Brian 11/13: "approve the spec"), now on `main` as
`docs/build/field-two-track-spec.md` (PR #111). Section numbers below
(section 4, 5, 6, 7, 9) and check names (S1 to S8, M1 to M24) are that spec's.

**Amended 11/13 for decision 82** ("Before a staffing award is made, the partner confirms
the practice type when answering 'Does this lead qualify?' ... 7B stamps Award Practice Type
only from that confirmation"; Brian: "Yes, partner confirms it"): 7B accepts a new optional
key, `PracticeTypeConfirmed`, and stamps Award Practice Type only from it (F1.6 rules 1, 2a
and 9, F2.9 rule 3, F1 checks 11b to 11g, F2 check 18). The site half is PR #136, and it
must be live on production before the site switch goes on ("Build order", step 6).

These are build sheets. BB2 builds them in Power Automate and SharePoint. This repo never
edits a flow. Sheets F3, F4, F5 and F7 come later and are not in this file.

Same house rules as `docs/build/rep-app-flow-contracts.md` and `docs/fsc-flow-contracts.md`: one
HTTP trigger per flow, method POST, `Content-Type: application/json`, success is HTTP 200
only after the row is written, and flow URLs are Sensitive Vercel env values that never
appear in the repo, a sheet, a log or a build report.

## Before you start (all three sheets)

### What the repo shows, and what it does not

- `flows/` on `main` holds only `flows/README.md`. **There is no repo copy of HSBS 1R, 7A or
  7B.** No branch on the remote has one either (checked 11/13). So every "What exists today"
  line below comes from the contract docs and the site code on `main`, and names the file it
  came from. Anything those do not show is marked **not in the repo copy**: BB2 reads it in
  the live flow (read only) and writes what he found in the build report before he changes
  anything.
- After each sheet is built and passes, BB2 exports the changed flow and cleans it as
  `flows/README.md` says, so the next review can read the real logic.

### Rules for every step in every sheet

1. Build on a copy of each flow. The live flow is untouched until Brian says to swap.
2. TEST rows only while testing: a Referrals row with Test = Yes, TEST in the practice name
   and a made-up contact, its Service Case under the TEST Partner link, and a TEST rep
   (Rep Roster Test = Yes). Decision 48 (11/12) lets BB2 create these and delete them after.
3. No live sends. No email to a real partner, rep, manager or other-team sender. A TEST row's mail goes
   only where today's TEST rule sends it.
4. No new email recipients in any flow. None of these three sheets adds an email.
5. No secrets anywhere: no flow URL, key, link key, token or password in a sheet, a build
   report, a Status Log line, a test note or a commit.
6. Escape `'` as `''` in every Filter Query, as today (`docs/build/rep-app-flow-contracts.md`,
   "Every filter").

### Words used in all three sheets

- **The two companies** are the two company keys in spec section 4:

  | Company key | Solutions value on the row (exactly, unchanged from today) | Name on screens |
  |---|---|---|
  | `HealthFirst` | `HealthFirst` | HealthFirst |
  | `Staffing` | `HS Staffing / Recruiting Services (including GoTu)` | Direct Dental |

- **A HealthFirst case** is a Service Case whose company is the Solutions value
  `HealthFirst`. **A staffing case** is one whose company is the Solutions value
  `HS Staffing / Recruiting Services (including GoTu)`. Compare the whole string, exactly.
  The Service Cases column that holds a case's company is **`Service`**, a choice column
  read and written by its Value (fact R1). 1R does not write it: 1R makes no Service Case.
  3F and HSBS 3 write `Service` when they make the case, after the intro (facts R1,
  F7-0.1). Every sheet below means `Service` when it says "the case's company". 7A reads it
  to send `company` (sheet F1, F1.5a). 7B reads it from the stored case to decide which
  rules apply, and never takes a company from the request body.
- **A field or FSC case** is a Service Case whose linked Referrals row (its Referral link)
  has Source `Rep app` or `FSC app`. **A other-team case** is any other Service Case. 7B
  reads the linked Referrals row's Source to tell them apart (it already reads that row to
  write the shared update column, fact R9). Decisions 102, 104 and 105 change field and FSC cases
  only; a other-team case keeps today's 7B behavior.
- **A field case** is a Service Case whose linked Referrals row has Source `Rep app`
  exactly. It is the narrower group: decision 135 ("F2 at launch") changes field cases
  only. An FSC app case keeps today's email and wording (decisions 42 and 56).
- **Every other case** is any Service Case that is not a HealthFirst case or a staffing case
  (Unitas, eAssist, Practice Booster, WeCare, Cardio Partners and the rest).
- **Missing or `""`** on a request key means "leave that column as it is". The one place a
  column is cleared is sheet F2, step F2.7 rule 2 (a Qualified `Yes` save clears the stored
  reason and note).
- **The case's list.** 7A and 7B read and write the Service Case (conductor ruling, 11/13,
  from `CLAUDE.md`: partner status has been on Service Cases since the 10/22 cutover).

### BB2 records before building

1. The Service Cases column that holds a case's company, by exact name (above).
2. **Where the live 7B writes Closed Reason for a case:** the list (Service Cases, one per
   doctor per company, or Referrals, one per doctor), the column name and its type. F2.4
   adds the two choices there, and F6.2 reads `closedReason` from the same place. If it is
   on Referrals (per doctor), not on the Service Case, **stop and ask the conductor before
   building F2 or F6**: two companies on one Referrals row would share one reason.
3. Whether `PARTNER_STAGES_ENABLED` is on (ask Brian; it is a plain on or off switch, not a
   secret), because F2 check 6a needs the site to send `StageFromAnswers` (check 6b runs
   with it off).
4. What 7B does today with a save on a closed case (Status `Closed - Won`, `Closed - Lost`,
   `Held` and the rest): saves it, skips it, or refuses it.
5. Whether 7B today refuses a save whose `TalkedToDoctor` is `""` (F2.7 rule 4).
6. What `company` on a 1R `list` line holds today (sheet F6, F6.1).
7. How 1R answers a refused submit today (status code), so the new refusals in F1.4 match.
8. The exact test 7A uses to decide which cases to list (the Status values it leaves out,
   the Introduced On rule and the Test rule), because 7B's `closed` refusal (sheet F2,
   F2.6 rule 3) uses the same test. `docs/partner-status-flow.md` gives Status not
   `Closed - Won`, `Closed - Lost`, `Not a Fit`, `Closed` or `Held`, and Introduced On set;
   record what the live 7A actually does.
9. How today's 7B treats an update with nothing to save (no `choice`, no `Stand`, no
   answer): skipped with no stamp, no log line and not counted in `saved`, or something
   else (sheet F2, F2.6 rule 4).
10. Today's trigger concurrency setting on 7B (off, or on with what limit).
11. Whether the live 7B trigger can be set to a concurrency limit of 1 (sheet F2, "One
    request at a time"), and the expected wait that adds under normal load (how long one
    7B run takes today, from run history). If the limit cannot be set, **stop and ask the
    conductor** before building F2.
12. Any duplicate Status Log pair (the same answer logged twice in a row for one case, as
    a timed-out save and its retry can make) seen during the F2 checks, with the case and
    time.

### Step 1 results (BB2 step 1 facts v2, 11/13)

Read from the FSC copies of 1R, 7A and 7B (PB1 says what still has to be read).

| Item | Fact | What the flow does | What it means here |
|---|---|---|---|
| 1 | R1 | The company column is `Service`. 1R makes no Service Case; 3F and HSBS 3 write `Service` when they make one | Match. "Words used" now names it |
| 2 | R2 | 7B accepts `ClosedReason` on the body and never reads or writes it. Its Update case step has no Closed Reason field | Mismatch: today no flow stores a closed reason. Stop item ST1 |
| 3 | R3 | `PARTNER_STAGES_ENABLED` is a site switch, not in any flow. 7B applies a `Stage` value when one is sent | Pending: PB3 |
| 4 | R4 | 7B saves an update on a closed case. Get partner cases filters only by `Service`; nothing skips or refuses Partner Status `Signed`, `Close won`, `Close loss`, `Held` or the like | Match. With `EnforceQualify` off, the new 7B saves it too (F2.5b) |
| 5 | R5 | 7B does not refuse an empty `TalkedToDoctor`; the stored Talked To Doctor is left as it is | Match. F2.7 rule 4: change nothing |
| 6 | R6 | `company` on a `list` line is the case's `Service` Value (or `Service` itself when the Value is missing). In the FSC copy, `list` answers only an FSC key; any other role gets HTTP 400 "list is FSC only" | Match. F6.1 rule 1 applies: add no `solutions` key, unless PB1 finds the Rep 1R differs |
| 7 | R7 | A refused submit is HTTP 400 `{"error":"missing or invalid fields"}`. Also: 404 unknown key, 400 unknown action, 500 when the roster lookup, the dedupe or the create fails, 200 on success and on a repeat (`ok` true, `duplicate` true). Every trigger property is optional | Match. F1.4 uses that 400 |
| 8 | R8 | 7A reads Service Cases, not a Status column. Get open cases keeps cases whose Partner Status is not `Close won`, `Close loss`, `Returned to HSBS`, `Signed`, `Not moving forward` or `Hand back to HSBS`. A second loop keeps only cases whose `Service` is on the partner's Services, with a Referral link, Partner Status not `Close won`, `Close loss` or `Returned to HSBS`, whose linked Referrals row's Test matches the partner (Partner Links Title contains `TEST`), and whose Referrals row has Introduced On set. `Held` and `Not a Fit` are not left out | Mismatch with `docs/partner-status-flow.md`. F2 "what exists today" is rewritten; F2.5 rule 4 and F2.6 rule 3 use this test; PB6 |
| 9 | R9 | An update with no `choice`, no `Stand` and no answer still passes (unless it is `signed` with no dates or `no change this week` with no LastTouch). 7B patches the case, adds a Service Case Status Log line, stamps Last Partner Update, may send the other-team sender update email, writes the shared update column on the Referrals row, and answers `saved` = the number of items in `updates`. `notified` is always `[]`. The 200 answer and the update loop appear to start together | Mismatch: today nothing is skipped. Stop item ST2; F2.9 rule 3; PB5 |
| 10 | R10 | 7B's HTTP trigger concurrency is off (unset). Its validate and update loops run one item at a time inside a run. 1R and 7A triggers are also unset | Match. "One request at a time" is still a build step |
| 11 | R11 | The package cannot show whether the trigger takes a limit of 1, or how long a run takes | Pending: PB4 |
| 12 | R12 | Recorded during the F2 TEST checks, not from the definition | Pending, as item 12 says |

### Pre-build checks (read only, before the part each one guards)

- **PB1 (before any step).** Facts R1 to R12 come from "HSBS 1R (FSC copy)", "HSBS 7A
  Partner leads (FSC copy)" and "HSBS 7B Partner save (FSC copy)". The On flows the live 1R, "HSBS 7A Partner leads read" and "HSBS 7B Partner status save" were not
  exported. BB2 finds which flow the rep app submit, the partner page load and the partner
  save each reach (by run history after a TEST call, never by URL), exports those, and
  confirms R1 to R12 on them. For 1R also record: whether it writes Source `Rep app` (the
  FSC copy writes only `FSC app` or the other team's app Source value, fact F7-0.11), and whether `list`, `team` and
  `earnings` answer a Rep key (the FSC copy's `list` refuses every non-FSC key, fact R6).
- **PB2 (before F2.4, F2.10 and F6.2).** List read: whether a Closed Reason column exists,
  on which list, and its type and choices (fact R2).
- **PB3 (before F2 check 6a).** Ask Brian, or read on the site, whether
  `PARTNER_STAGES_ENABLED` is on (fact R3).
- **PB4 (before F2 "One request at a time").** In the designer and run history: whether
  7B's trigger takes a concurrency limit of 1, and how long one run takes today (fact R11).
  If the limit cannot be set, stop and ask, as item 11 says. **Answered 11/15, decision
  136:** the limit can't be set together with a 200 answer after the update loop, and
  Brian chose no limit (see "One request at a time").
- **PB5 (before F2.6 and gate 0a).** In the designer: whether 7B's 200 Response runs
  after the update loop or alongside it (fact R9). The house rules above say 200 comes
  only after the row is written. If they start together today, build: the new 7B's 200
  Response runs after the update loop ends, and gate 0a times it that way.
- **PB6 (before F2.5 and F2.6 rule 3).** From the 7B export: which Partner Status a lost
  save, a not-qualified close, a signed save and a hand back each write, so it is known
  that 7A's test (fact R8) drops each of them.
- **PB7 (before F1.1, F1.2 and F2.1 to F2.4).** List read: Referrals and Service Cases
  display names, internal names and types for the columns these sheets name, including
  whether Practice Type already exists, whether Solutions is multi-choice, and that the
  JDE column is `JDEAccount` and the consent column `Consenttext` (facts F3-0.8, F7-0.12).

### Stop-and-ask items (BB2 step 1 facts)

All three were answered by Brian on 11/14 and are closed.

| # | Where | Was | Now |
|---|---|---|---|
| ST1 | F2.4, F2.6 rule 3 (the Closed Reason part), F2.10, F6.2; F2 checks 1, 6, 15, 17a; F6 checks 2, 4, 4a | Today 7B ignores `ClosedReason` (fact R2) and no column holds a closed reason | **Decided: decision 102.** Build: PB2 first; use an unused Closed Reason column on Service Cases if one exists, else add one (F2.4). The new 7B writes `ClosedReason` to it on a close of a field or FSC case. other-team cases: no write, as today |
| ST2 | F2.6 rule 4 ("Nothing to save is not a refusal"); F2 check 21b | Today 7B saves an update with nothing in it as a full save (fact R9) | **Decided: decision 104.** Build: on a field or FSC case of any company the new 7B skips an untouched update (F2.6 rule 1a, before the company check; rule 4 defines nothing to save). A other-team case keeps today's full save |
| ST3 | F1.4 rule 4 (the Service Case half); F1 check 2b; F6 check 11 | 1R makes no Service Case, and no flow makes one for a `Rep app` row (facts R1, F7-0.1, F3-0.1) | **Decided: decision 100.** Build: the new 1R writes Route `Direct to partner` on every `Rep app` row (F1.4 rule 7), and the 3F copy starts on Source `FSC app` or `Rep app` with that Route and makes the case (sheet F3, B0 and B9), copying Practice Type (F1.4 rule 4) and Test (decision 101) |

### Build order across the three sheets

1. Sheet F1 steps F1.1, F1.2 and F1.2a (Award Practice Type), sheet F2 steps F2.1 to
   F2.4 and F2.11's Hand Back Note column, and the Service Cases Test column (sheet F3,
   Part T, decision 101): all SharePoint columns and
   choices first. Nothing reads them yet, so this changes no behavior.
2. Sheet F1 step F1.3 and F1.4 (1R submit).
3. **Prerequisite for any new 7B: the S6 site slice is live on production** (the
   422-aware partner save route, PR #116), merged with its switch `PARTNER_QUALIFY_ENABLED`
   off (the default). Today's site turns every 422 from 7B into a generic 503 "try again",
   so a new 7B swapped in before S6 is live would show partners the wrong message on every
   refusal. Brian or Claude confirms S6 is live; BB2 does not swap 7B until then.
4. Then the new **7B** (sheet F1 step F1.6 and sheet F2 steps F2.5b to F2.10) with its own
   setting `EnforceQualify` **off** (sheet F2, F2.5b). With it off, every save today's 7B
   accepts is still accepted.
5. Then the new **7A** (sheet F1 steps F1.5 and F1.5a, sheet F2 step F2.5).
6. **Gate: the decision 82 site half (PR #136) is live on production** before this step.
   Brian or Claude confirms it; until then `PARTNER_QUALIFY_ENABLED` stays off. Without
   #136 the page preselects the rep's pick and never sends `PracticeTypeConfirmed`, so no
   staffing case would get an Award Practice Type and F4 would write no staffing award.
   Then Brian turns `PARTNER_QUALIFY_ENABLED` on. Only then does the page show the qualify
   question and send the new keys.
7. Then, with Brian's go, BB2 sets `EnforceQualify` **on** in 7B. From here every F2 rule
   applies. Between step 6 and this step a partner can still sign a HealthFirst or staffing
   case without answering the qualify question. That is today's behavior, and it is
   accepted for that short window. Steps 6 and 7 are done in one sitting, so the window is
   minutes. A HealthFirst or staffing case that signs in that window with Qualified blank
   is corrected by Brian in SharePoint (after a sign the correction is his alone; spec
   section 6), never through 7B. On a staffing case he sets two fields together:
   Qualified `Yes` and Award Practice Type = the case's Practice Type as it stands then
   (decision 84). This is the one way Award Practice Type is set without a
   `PracticeTypeConfirmed` from the partner (F1.6 rule 9). A signed case is closed, so it
   never passes through 7B again to get the stamp.
8. Sheet F6 (1R list, team, earnings). Step F6.4 needs the SPIFF Ledger's Company column,
   which sheet F4 adds; build F6.4 after F4's column exists.

**Rollback is the reverse:** `EnforceQualify` off first, then `PARTNER_QUALIFY_ENABLED`
off, then 7A back to its pre-change copy, then 7B, then 1R.

Every new request key is optional and missing means unchanged. Even so, the new 7B adds
refusals, and only the S6 route shows them in words, which is why step 3 comes first and
why the refusals an old page could hit wait for `EnforceQualify` (step 7).

---

## Sheet F1: Practice Type

Spec: section 4 ("Practice type has two stored values", "Submit body"), section 6
("Staffing amount"), section 7 ("On the staffing partner's page only"), section 9 row F1,
check M23.

### F1: what exists today

- **1R submit (Rep key):** body in `docs/build/rep-app-flow-contracts.md`, "HSBS 1R for Rep keys",
  "submit". It has no practice type key. 1R writes one Referrals row and **no Service
  Case** (facts R1, F7-0.1; the contract docs say 1R makes one per company, which the live
  FSC copy does not). The case is made after the intro, by 3F (Source `FSC app`, Route
  `Direct to partner`) or HSBS 3 (Status `Introduced to Solution Company`), with Status
  `Sent` or `Held` and Stage `New lead`, not `Received` (fact F3-0.5). Every trigger
  property is optional (fact R7). The Rep submit branch is PB1.
- **Referrals and Service Cases:** no Practice Type column in any doc on `main`. Not in the
  repo copy whether the live lists have one.
- **7A:** today's 7A sends the keys `PartnerLead` held before S6 (id, referralId, doctor,
  practice, the other team's key, helpArea, introducedOn, stage, lastUpdate, nextUpdateDue, talkedToDoctor,
  stand, lastTouch, preferredContact, phone, jde, nextStepDate, dealValue, contactFirst,
  contactName, contactPhone). No practice type and no company key. Since S6 (PR #116) the
  site's `PartnerLead` (`src/lib/partner-flow.ts` lines 79 to 121) also reads `company`,
  `qualified`, `notQualifiedReason`, `notQualifiedNote` and `practiceType`, only while
  `PARTNER_QUALIFY_ENABLED` is on; with none sent it shows no qualify question. 7A reads
  Service Cases (fact R8; `docs/partner-status-flow.md` still says Referrals, see "Stale
  docs found") and returns `company` from `Service` (fact R1).
- **7B:** each update carries the keys in `PartnerUpdate`, `src/lib/partner-flow.ts` lines
  172 to 204. Since S6 that type has `PracticeType`, which the site sends only on a staffing
  case while `PARTNER_QUALIFY_ENABLED` is on; today's 7B ignores it. The decision 82 site
  change (PR #136) stops the page preselecting the rep's pick and adds `PracticeTypeConfirmed`,
  the type the partner picked in that save, sent only when they picked one; today's 7B
  ignores that too. 7B answers 200
  `{"saved": n, "notified": [...]}` (`docs/partner-status-flow.md`, "HSBS 7B contract", step
  5; read by the site in `src/lib/partner-flow.ts` lines 628 to 648). Today `saved` is the
  number of items in `updates` and `notified` is always `[]` (fact R9).

### F1: the change, step by step

**F1.1 Referrals column.** Conductor ruling (11/14, replaces the same day's "reuse it"
ruling): BB2's PB7 read found Referrals already has a Practice Type column
(`Practice_x0020_Type`, Single line of text), but it is BB1's: HSBS 9 v2 (TEST) writes the
Salesforce engagement's free-text type of practice into it (for example `General
dentistry`), and BB1's HSBS 3 TEST copy reads it into the other-team intro. That is the practice's
specialty; this sheet's Practice Type is ownership (`Private practice` or `Group`). One
column can't hold both. So the field app gets its own column, and BB1's column is left
exactly as it is (not read, not written, not changed by any field sheet).

On the Referrals list (on the shared SharePoint site) add:

| Column | Internal name | Type | Choices, spelled exactly | Required | Default | Fill-in |
|---|---|---|---|---|---|---|
| Rep Practice Type | `RepPracticeType` | Choice (single, drop-down) | `Private practice`, `Group` | No | none (blank) | No |

To get that internal name, create the column as `RepPracticeType` (no spaces), save, then
rename its display name to `Rep Practice Type`. BB2 records the internal name it got.

**In every field sheet, "Practice Type" on Referrals or Service Cases means this column**
(`RepPracticeType`), never `Practice_x0020_Type`. 1R writes it (F1.4 rule 4), 3F copies it
to the case and reads it for the intro (sheet F3, B6 and B9), and 7A returns the case's value
as `practiceType` (F1.5). Award Practice Type (F1.2a) is unchanged.

**F1.2 Service Cases column.** On Service Cases add the same column: display name `Rep
Practice Type`, internal name `RepPracticeType`, same type, choices and settings as F1.1.

**F1.2a Award Practice Type.** On Service Cases also add Award Practice Type: Choice
(single, drop-down), choices `Private practice` and `Group` spelled exactly, not required,
no default, no fill-in. 7B writes it once, only from the partner's `PracticeTypeConfirmed`
(F1.6 rule 9, decision 82); HSBS 10 (sheet F4) reads it, not
Practice Type, for the staffing amount (spec commit 108b556, section 6, "Staffing amount").

The stored value is one of those two strings and nothing else. "Group (3 or more
locations)" is a screen label only and is never stored (spec section 4).

**F1.3 1R trigger schema.** Add one optional property, `practiceType` (string). Do not make
it required: lookup, list, team, earnings, the other-team sender submit, the FSC submit and a HealthFirst
Rep submit never send it.

**F1.4 1R checks the rep app submit, then writes Practice Type to both rows.** 1R checks the
rule itself, so it does not rest on the site alone (spec section 6, "1R checks the rep app
submit too"). On a submit, before any row is written:

1. **One company.** When `source` is `Rep app`: refuse when `companies` is missing, empty or
   names more than one company. Answer as 1R answers a refused submit today, HTTP 400
   `{"error":"missing or invalid fields"}` (fact R7), write nothing and send nothing.
2. **Staffing needs a practice type.** When `source` is `Rep app` and `companies` is exactly
   `["HS Staffing / Recruiting Services (including GoTu)"]`: refuse, the same way, when
   `practiceType` is missing, `""`, or not exactly `Private practice` or `Group`.
3. A repeat `submissionId` whose first post made a row still answers 200 with `ok` true
   (and `duplicate` true, as today, fact R7) and makes no second row. Run the duplicate
   check in the same place it runs today.
4. **Write.** On a staffing Rep submit that passed, write `practiceType` to Practice Type on
   the new Referrals row, in the create step that writes the other columns. Today 1R makes
   no Service Case (facts R1, F7-0.1), so 1R cannot write the case's Practice Type. Build:
   the step that makes the case for a rep app staffing row copies Practice Type from the
   Referrals row: the 3F copy's case create (sheet F3, B9; decision 100).
5. On every other submit (a HealthFirst Rep submit, the other-team sender submit, the FSC submit), write
   nothing to either Practice Type column, whatever the body holds, and do not refuse for
   it. Rules 1 and 2 apply only to `source` `Rep app`.
6. Nothing else in the submit changes: the identity from the Rep Roster, the refusal of a
   key that is not on the Rep Roster, the 200 `{"ok":true}` only after the row exists.
7. **Route on every Rep app row** (decision 100, Brian 11/14: "Reuse 3F"). On every
   submit whose `source` is `Rep app`, write Route `Direct to partner` on the new Referrals
   row, whatever `route` holds: on a field row the partner always calls first. That Route
   is what starts the 3F copy (sheet F3). The other-team submit and the FSC submit keep today's
   Route mapping (`docs/fsc-flow-contracts.md`, "Decision 97: done").

**F1.5 7A returns it on each staffing lead.**

1. For each lead that is a staffing case, add the key `practiceType`: the Service Case's
   Practice Type as stored (`Private practice` or `Group`), or `""` when it is blank.
2. Read it from the Service Case, not from the Referrals row. The Service Case is where the
   partner's correction is saved.
3. Do not add `practiceType` to a HealthFirst lead or to any other case's lead.

**F1.5a 7A names each case's company.** The S6 partner page shows the qualify question only
when it knows the case is a HealthFirst or staffing case, and today's 7A sends no company
key (before S6; the site reads it since PR #116, `src/lib/partner-flow.ts` lines 79 to 121).

1. On each HealthFirst lead and each staffing lead, add `company`: the case's company column
   (above, "Words used") as stored, spelled exactly: `HealthFirst`, or
   `HS Staffing / Recruiting Services (including GoTu)`.
2. On every other lead, `company` is optional. If 7A sends it, it is that case's stored
   value as is (for example `Unitas`); the page asks no question for any other value, or
   when the key is missing, as today. Building it for every lead with one Select is fine.
3. Never build `company` from the Partner Links row's Services or the partner's name: it is
   the case's own value.
4. The site posts `company` back to its own server but never forwards it to 7B. 7B decides
   the company from the stored case (sheet F2, F2.6 rule 1).

**F1.6 7B accepts `PracticeType` and `PracticeTypeConfirmed` on a staffing save.**

1. Add two optional properties to each update object in the 7B trigger schema:
   `PracticeType` (string) and `PracticeTypeConfirmed` (string).
2. Only on a staffing case: if `PracticeType` is exactly `Private practice` or exactly
   `Group`, write it to the Service Case's Practice Type in the same Update item step as
   Stage and Status, or, on an update with no Stand, in the standalone step (sheet F2,
   F2.9). Every F2.6 check runs first, so a practice type save on a case that is no longer
   open to the partner (signed, handed back or closed) is refused `closed`.
2a. **`PracticeTypeConfirmed`** (decision 82) is the practice type the partner picked
   themselves in this save. The page never preselects it, so a pick is the partner's
   confirmation; the site sends it only when the partner picked one, always with the same
   value in `PracticeType`. Only on a staffing case: when it is present and not `""`, it
   must be exactly `Private practice` or exactly `Group` and the same string as this
   update's `PracticeType`; otherwise refuse the whole request with code `practice_type`
   (F2.6 rule 5). It writes no column of its own and does not change Practice Type
   (`PracticeType` does that). Its one use is rule 9. Missing or `""` means no
   confirmation in this save: it changes nothing and is never refused for being missing.
3. Missing or `""`: leave Practice Type as it is.
4. Any other value: refuse the whole request with code `practice_type` (sheet F2, step
   F2.6 rule 5, and "How 7B refuses"). Practice type sets the staffing amount, so a bad
   value is never saved around (conductor ruling, 11/13).
5. On a HealthFirst case or any other case, ignore `PracticeType` and
   `PracticeTypeConfirmed`: write nothing for them and do not refuse for them.
6. Never write the Referrals row's Practice Type from 7B. It keeps the rep's pick.
7. When the written value differs from the stored one, add the Status Log tail part
   `Practice type <old> to <new>` (old is `blank` when it was empty). Sheet F2, step F2.8
   has the log rule.
8. The practice type check on a qualify answer is sheet F2, step F2.6 rule 5.
9. **Award Practice Type, written once, only from a confirmation** (decision 82). On a
   staffing case whose Award Practice Type is still blank, stamp it only on a 7B save that
   meets all three:
   - the update carries a `PracticeTypeConfirmed` value that passed rule 2a;
   - after the save, reached is Yes: this update's `TalkedToDoctor` is `Yes`, or it is
     missing or `""` and the stored Talked To Doctor is `Yes` (as in F2.6 rule 8);
   - after the save, Qualified is Yes: this update's `Qualified` is `Yes`, or it is missing
     or `""` and the stored Qualified is `Yes`.

   Write Award Practice Type = that `PracticeTypeConfirmed` value, in the same write as the
   rest of the save. That is the save that first leaves reached Yes and Qualified Yes, or a
   later save that confirms the type while both are already Yes (a standalone save
   included, F2.9).

   **Never stamp from anything else.** Not from `PracticeType`, not from the Practice Type
   stored on the case, and not from a confirmation sent on an earlier save: a
   `PracticeTypeConfirmed` on a save that does not leave both Yes stamps nothing and is not
   kept for later. A Qualified Yes on a staffing case with no confirmation is still
   accepted and saved as usual (no refusal), and Award Practice Type stays blank; sheet F4
   then writes no award row and lists the case in Brian's exceptions until it is filled
   (section 9 row F4). The partner can confirm on a later save while the case is open, and
   the page asks for a pick on every staffing Yes save. Brian's turn-on gap fix (build order
   step 7, decision 84) still sets Qualified and Award Practice Type together by hand.

   Never write it again once it holds a value: not on a later practice type correction, not
   on a later confirmation, not on any later save.

### F1: request and response JSON

1R submit, a staffing Rep submit (the rep app v3 body with the spec section 4 values; only
`practiceType` is new):

```json
{
  "action": "submit",
  "referralKey": "<Referral Key from the Rep Roster>",
  "submissionId": "11111111-1111-4111-8111-111111111111",
  "leadType": "Practice owner",
  "doctorName": "TEST Office Manager",
  "practiceName": "TEST North Side Dental",
  "officePhone": "303-555-0100",
  "doctorCell": "",
  "doctorEmail": "",
  "jde": "001234",
  "companies": ["HS Staffing / Recruiting Services (including GoTu)"],
  "needs": ["Staffing"],
  "the permission column": true,
  "contactFirst": false,
  "preferredContact": "Call",
  "consentText": "<the words on the screen>",
  "notes": "",
  "route": "Partner",
  "referrerRole": "Rep",
  "source": "Rep app",
  "status": "Received",
  "practiceType": "Group"
}
```

| Key | Type | Values | Missing or `""` |
|---|---|---|---|
| `practiceType` | string | `Private practice` or `Group`, exactly | On a staffing Rep submit: refused, no row. On any other submit: write nothing, both Practice Type columns stay blank |

The 1R success answer is unchanged: 200 `{"ok":true}` only after the row exists. A refusal
under F1.4 rules 1 and 2 is the 4xx 1R already uses for a refused submit, with no row
written. The site already treats a 4xx on submit as "This link does not work." or the field
errors (`docs/build/rep-app-flow-contracts.md`, "What the Rep app shows").

7A, one staffing lead (only the new keys shown; every existing key stays as it is):

```json
{ "id": 31, "referralId": "HSBS-R251113120000", "company": "HS Staffing / Recruiting Services (including GoTu)", "practiceType": "Group" }
```

| Key | Type | Values | When |
|---|---|---|---|
| `company` | string | The case's Solutions value as stored, exactly: `HealthFirst` or `HS Staffing / Recruiting Services (including GoTu)` | Required on HealthFirst and staffing leads. Optional on every other lead (that case's own stored value). Missing or any other value: the page asks no qualify question |
| `practiceType` | string | `Private practice`, `Group`, or `""` when blank | Staffing leads only. Absent on every other lead |

7B, one update on a staffing case (only the new key shown):

```json
{ "id": 31, "choice": "nochange", "Stand": "No change this week", "PracticeType": "Private practice", "PracticeTypeConfirmed": "Private practice" }
```

| Key | Type | Values | Missing or `""` |
|---|---|---|---|
| `PracticeType` | string | `Private practice` or `Group`, exactly. Any other value is refused, code `practice_type` | Leave Practice Type as it is |
| `PracticeTypeConfirmed` | string | `Private practice` or `Group`, exactly, and the same as `PracticeType` in that update. Anything else is refused, code `practice_type`. Staffing only; ignored on every other case | No confirmation in this save: nothing changes, nothing is refused, and Award Practice Type is not stamped |

The 7B success answer is unchanged: 200 `{"saved": n, "notified": [...]}`. The refusal
answer is in sheet F2, "F2: request and response JSON".

### F1: what must not change

- The other-team submit, the FSC submit (pilot FSC app) and a HealthFirst Rep submit save exactly
  as today. They send no `practiceType` and their rows get a blank Practice Type.
- A rep app submit names exactly one company. The site enforces it (spec section 4, "One
  referral, one company"), and 1R now refuses a `Rep app` submit that does not (F1.4 rule
  1). 1R never splits, merges or adds companies. For every other source, 1R's handling of
  `companies`, `needs`, `route`, `source` and identity does not change.
- 7A leads for HealthFirst and every other partner (Unitas, eAssist, Practice Booster,
  WeCare, Cardio Partners and the rest) carry no `practiceType` key. Apart from `company`
  (F1.5a; required on HealthFirst leads, optional on the others), they are as today.
- Sheet F1 changes no 7B behavior on any case that is not a staffing case, and a body with
  no `PracticeType` and no `PracticeTypeConfirmed` meets no sheet F1 rule. (Sheet F2 adds its own rules on HealthFirst and
  staffing cases; see F2's own list.)
- **Status Log:** the one addition from sheet F1 is the `Practice type <old> to <new>` tail
  part (F1.6 rule 7, check 11a). Every other Status Log behavior is unchanged.
- **Practice Type keeps taking corrections** after the qualifying save, as F1.6 says; only
  Award Practice Type is fixed once written.
- **Missing means unchanged** for `PracticeTypeConfirmed` too: a body without it (an old
  page, or a save with no pick) is never refused for lacking it and writes nothing for it.
- No email, recipient, Next Update Due rule or 7A filter changes.
- The other team's app and pages, field pages and the pilot FSC app are untouched.

### F1: TEST checks (TEST rows only; each is pass or fail)

1. Referrals and Service Cases each have Rep Practice Type (internal `RepPracticeType`),
   Choice, with exactly the two choices `Private practice` and `Group`, not required, no
   default, no fill-in (F1.1 ruling, 11/14). BB1's `Practice_x0020_Type` on Referrals is
   unchanged (same type, same values as PB7 recorded). Service Cases also has Award Practice Type, Choice, with exactly
   the two choices `Private practice` and `Group`, not required, no default, no fill-in, before any new
   7B is tested or swapped in.
2. **2a, Referrals half (1R; gates sheet F3 prerequisite P2).** A TEST Rep staffing submit
   with `practiceType` `Private practice` makes one Referrals row with Practice Type
   `Private practice` and Route `Direct to partner` (F1.4 rule 7). Repeat with `Group`.
   (S3 flow side; M23 first step.)
   **2b, Service Case half (run after the 3F copy is built).** 1R makes no Service Case
   (fact R1); the 3F copy makes it (decision 100; sheet F3, B9). Once the copy runs, the
   case for each 2a row has the same Practice Type. Sheet F3 checks 2 and 6 record it. 2b
   is not a prerequisite for building F3, so the two sheets do not wait on each other
   (Codex P1 on #151, 11/14).
3. A TEST Rep HealthFirst submit with no `practiceType` makes its rows exactly as before,
   with Practice Type blank on both.
4. A TEST other-team submit and a TEST FSC app submit save as before, Practice Type blank.
5. A TEST staffing Rep submit with `practiceType` `Group (3 or more locations)` is refused
   with a 4xx and makes no row. The same with `practiceType` missing, and with `""`: refused,
   no row, no email.
6. A repeat of check 2's `submissionId` answers 200 `{"ok":true}` and makes no second row.
6a. A TEST Rep submit with `companies` `[]` is refused, no row. One with `["HealthFirst",
   "HS Staffing / Recruiting Services (including GoTu)"]` is refused, no row. A TEST FSC
   app submit naming two companies saves as on `main`.
7. 7A on the TEST Partner link returns the check 2 staffing lead with `practiceType`
   `Private practice`, read from the Service Case. (M23 second step.)
8. 7A returns no `practiceType` key on a TEST HealthFirst lead or a TEST Unitas lead.
8a. 7A returns `company` `HealthFirst` on a TEST HealthFirst lead and `company`
   `HS Staffing / Recruiting Services (including GoTu)` on a TEST staffing lead, each
   spelled exactly as the Service Case stores it.
8b. A TEST Unitas lead either has no `company` key or has `company` `Unitas`; either way the
   TEST partner page shows no qualify question for it.
9. A 7B save on that staffing case with `PracticeType` `Group` sets the Service Case to
   `Group`; the Referrals row still says `Private practice`. 7A then returns `Group`.
   (M23 third and fourth steps.)
10. A 7B save on that case with no `PracticeType` key (an old page) leaves `Group` stored.
    A save with `PracticeType` `""` leaves `Group` stored. (M23 last step.)
11. A 7B save on that case with `PracticeType` `group` (wrong letter case) is refused with
    HTTP 422 `{"error":"practice_type"}`; `Group` stays stored and nothing else in the
    request is written.
11a. After check 9, the case's Status Log line for that save ends with the tail part
    `Practice type Private practice to Group`. A save that sends the stored value again
    adds no practice type part.
11b. **Award Practice Type holds.** On a TEST staffing case with Practice Type `Private
    practice`, a 7B save answers reached Yes and Qualified Yes with `PracticeType` and
    `PracticeTypeConfirmed` both `Private practice`: Award Practice Type reads `Private
    practice`. A later 7B save sends `PracticeType` and `PracticeTypeConfirmed` both `Group`:
    Practice Type reads `Group` and Award Practice Type still reads `Private practice`. A
    further save (No change) leaves Award Practice Type as it is. (Spec M3, flow side.)
11c. **Reached after qualified.** On a TEST staffing case with Practice Type `Group`,
    Qualified Yes already stored and Talked To Doctor `Not yet, still trying`, a Meeting
    set save with `TalkedToDoctor` `Yes` and `PracticeType` and `PracticeTypeConfirmed` both
    `Group` stamps Award Practice Type `Group` in that save. On a second such TEST staffing
    case the same save without `PracticeTypeConfirmed` is accepted and leaves Award Practice
    Type blank. On a TEST HealthFirst case the save with `PracticeTypeConfirmed` `Group`
    leaves Award Practice Type blank.
11d. **No confirmation never stamps** (decision 82). On a TEST staffing case with Practice
    Type `Private practice` and Talked To Doctor Yes, a 7B save with `Qualified` `Yes` and
    `PracticeType` `Private practice` and no `PracticeTypeConfirmed` key answers 200 and
    stores Qualified Yes; Award Practice Type stays blank. The same on a second TEST case
    with `PracticeTypeConfirmed` `""`: blank. Then, on the first case, a standalone save
    `{"id": <that id>, "Qualified": "Yes", "PracticeType": "Group", "PracticeTypeConfirmed":
    "Group"}` (a later save that confirms it while both are Yes) stamps Award Practice Type
    `Group`.
11e. **An earlier confirmation is not kept.** On a TEST staffing case with Practice Type
    `Group` and Talked To Doctor `Not yet, still trying`, a save with `Qualified` `Yes` and
    `PracticeType` and `PracticeTypeConfirmed` both `Group` stores Qualified Yes; Award
    Practice Type is blank (not reached). A later Meeting set save with `TalkedToDoctor`
    `Yes` and no `PracticeTypeConfirmed` leaves Award Practice Type blank.
11f. **A bad confirmation is refused.** On an open TEST staffing case, each of these is
    refused 422 `{"error":"practice_type","id":<that id>}` and writes nothing: a save with
    `PracticeTypeConfirmed` `group`; one with `Group (3 or more locations)`; one with
    `PracticeTypeConfirmed` `Group` and `PracticeType` `Private practice`; one with
    `PracticeTypeConfirmed` `Group` and no `PracticeType`. The same four on a TEST
    HealthFirst case and a TEST Unitas case are not refused and write nothing for the key.
11g. **An old page still saves.** On a TEST staffing case, a save from a page loaded before
    decision 82 (`PracticeType` sent, no `PracticeTypeConfirmed`) with Stand `No change this
    week` and no `Qualified` is accepted as before, and Award Practice Type is unchanged.
12. A 7B save on a TEST HealthFirst case and on a TEST Unitas case with `PracticeType`
    `Group` writes nothing to their Practice Type, and the rest saves as on `main`.
13. No email went out from any check above except what today's TEST rule already sends.

### F1: rollback

In the order of "Build order across the three sheets" (`EnforceQualify` off, then the site
switch off), point each trigger back at the pre-change copy of 7A, then 7B, then 1R (the
old flows were never edited). The Practice Type and Award Practice Type columns may stay: nothing reads them once the old flows run. Do
not delete a column that holds TEST data until Brian says so.

---

## Sheet F2: the qualify answer

Spec: section 6 ("Qualified", "How the answer travels (the 7B request)", "A not-qualified
save closes the case through the existing lost path", "Only HealthFirst and staffing cases
have the question", "A sign needs both partner answers", "After the sign, only Brian can
correct the qualify answer", "Practice type" under T23, "No permission (T4)"), section 7,
section 9 row F2, slice S6, checks M10, M11, M16, M18, M22 (practice type part), M24.

### F2 at launch: the field 7B copy (decision 135)

Field leads launch on two new flows, **HSBS 7A Field copy** and **HSBS 7B Field copy**,
built by BB3 from today's FSC copies, the flows that carry today's partner traffic (Field
Build Desk 008, fact 1; desk 054). This part says what the 7B copy does on a field case at
launch, and which checks prove it. Where this part and the rest of F2 differ, this part
wins.

**What today's FSC 7B does** (desk 008, BB1's read). It writes Talked To Doctor, Signed
Product, Signed Date, Last Touch, Partner Updated By, a dated Status Log line, Missed
Updates 0, Last Partner Update, Next Update Due, Meeting Date and Partner Status. It never
writes Stage, Status or Pipeline Stage. It has no separate lost branch and no bracketed
Status Log tail, and it drops Stand, TalkedOn and TriedVia. Unless the choice is No change,
it sends an update email (partner-status-flow.md, 7B step 4), and a Return to HSBS also
emails Brian.

**L1. Qualify stays off.** `EnforceQualify` is `false` (F2.5b) and `PARTNER_QUALIFY_ENABLED`
is off, so the page sends no qualify keys and F2.6 rules 3 and 8 never run.

**L2. Every close is stored on the Service Case.** Power BI reads SharePoint, so these
columns are what it can show about what closed and why. On a field case:

| The partner picks | Written on the Service Case |
|---|---|
| Signed | Partner Status, Signed Date, Signed Product (as today) |
| Not moving forward | Partner Status (as today), and Closed Reason as sent (F2.4 rule 3, new) |
| Return to HSBS | Partner Status (as today), and Hand Back Note (F2.11, new) |

- The page sends Closed Reason on every Not moving forward save, always one of the six
  site choices (`src/lib/partner-flow.ts`, `CLOSED_REASONS`). The copy writes it, so no
  closed field case is left with a blank Closed Reason.
- **Closed On** (Claude's design under decision 135; Brian can drop it). On any of the three
  closes on a field case, the copy also writes Closed On = the Eastern save date, when the
  case's Closed On is blank. That gives Power BI a close date that no later save moves.
  BB3 records whether Service Cases has a Closed On column. If it does not, stop and ask
  before adding one.
- BB3 records the Partner Status value the copy writes for each of the three closes.

**L3. No update email on a field case.** On a field case, the copy skips today's update
email step for every save. Nothing is sent in its place. An update email to the rep would
be a new recipient, and only Brian adds one.

**L4. No name in `notified`.** A field case's save adds no name to `notified`, so the page
says "Saved 1 update." and names no one.

**L5. The Return to HSBS email to Brian.** On a field case it still goes, to Brian only.
Its subject and body read no other-team name column and never name the other team. BB3 records
the subject and body as built.

**L6. Not changed at launch.**
- FSC app and other-team cases: every email, recipient and line exactly as today's FSC copy.
- the shared update column on the Referrals row is written as today. It is a column on the list, not
  shown on the partner page and not in any field email. Renaming it would change the
  live flows.
- Stage, Status and Pipeline Stage stay unwritten for every case, as today.
- Stand, TalkedOn and TriedVia are still dropped (runbook, "Not in this launch").
- Trigger concurrency stays off (decision 136, "One request at a time").

**Launch checks** (TEST rows only, on the 7B Field copy, each pass or fail). Use an open
TEST field case for each of L-a to L-d.

- **L-a. A save sends no email.** A Meeting set save from the page answers 200. Meeting Date
  and Partner Status are stored. The run history shows no email step ran, and the page says
  "Saved 1 update." with no name.
- **L-b. A lost save stores the closed reason.** Not moving forward with reason `Price`:
  Partner Status is written, Closed Reason is `Price`, Closed On is the save date, no email
  goes, and 7A no longer lists the case. (Check 28, first half.)
- **L-c. A sign is stored.** Signed with a date and a product: Partner Status, Signed Date
  and Signed Product are stored, Closed On is the save date, and no email goes.
- **L-d. A Return to HSBS.** With the note `TEST note one`: Hand Back Note is `TEST note
  one` (check 26), Closed On is the save date, and exactly one email goes, to Brian only,
  with no other-team name in its subject or body.
- **L-e. FSC cases are unchanged.** A Meeting set save on an open TEST FSC app case sends
  the same update email as today's FSC copy, to the TEST inbox under today's TEST rule.
- **L-f. other-team cases are unchanged.** Check 28, second half: a lost save on an open TEST
  other-team case writes no Closed Reason, and its email is as today.
- **L-g. No other mail.** No run in L-a to L-f sent email to any address other than the
  TEST inbox and Brian.
- Also at launch: gate 0a, checks 21b to 21d (the untouched skip), 23, 26, 27 and 28. The
  other F2 checks need `EnforceQualify` on or the qualify page, and run before either goes
  on.

### F2: what exists today

- **7B update keys** (new page body): `id`, `choice`, `label`, `Stage`, `Status`,
  `MeetingDate`, `ClosedReason`, `Note`, `TalkedToDoctor`, `TalkedOn`, `TriedVia`, `Stand`,
  `LastTouch`, `SignedDate`, `SignedProduct`, and while their switches are on `DealValue`,
  `DealValueType`, `NextStepDate`, `StageFromAnswers`, and since S6, only while
  `PARTNER_QUALIFY_ENABLED` is on, `Qualified`, `NotQualifiedReason`, `NotQualifiedNote` and
  `PracticeType` (`docs/fsc-flow-contracts.md`, "7B partner save" and "Qualify question and
  practice type"; `src/lib/partner-flow.ts` lines 172 to 204). The old page body has only the
  first eight (`docs/fsc-flow-contracts.md`, "Old page, still accepted").
- **Signed today:** new page `choice` `signed`, Stand `Signed`, Stage `Close won`, Status
  `Closed - Won`, needs `SignedDate` and `SignedProduct`; old page `choice` `won`, Status
  `Closed - Won`. "The flow should refuse a Signed without a date and a product"
  (`docs/fsc-flow-contracts.md`, the paragraph after the choice table).
- **Lost today:** `choice` `lost`, Stand `Not moving forward`, Stage `Close loss`, Status
  `Closed - Lost`, needs `ClosedReason`. Next Update Due is cleared
  (`docs/fsc-flow-contracts.md`, "Next Update Due"); Next Step Date is cleared when the case
  closes, and Pipeline Stage becomes `Lost` through `StageFromAnswers` under stage rule 3
  (same file, "Pipeline stage and next step"; only while `PARTNER_STAGES_ENABLED` is on).
- **Closed Reason choices the site offers today:** `No response`, `Chose another provider`,
  `Price`, `Timing`, `Not a fit`, `Other` (`src/lib/partner-flow.ts` line 165, whose comment
  says the column is on the Referrals list). 7B accepts `ClosedReason` on the body and
  never reads or writes it; its Update case step has no Closed Reason field (fact R2). So
  today no closed reason is stored anywhere by 7B. Whether a Closed Reason column exists,
  and on which list, is PB2. Decision 102 puts it on Service Cases (F2.4).
- **Question 1:** the site requires it on every save except No change and, since S6, a
  not-qualified close (`src/lib/partner-flow.ts` line 421). 7B does not refuse a save with
  `TalkedToDoctor` `""`; it leaves the stored Talked To Doctor as it is (fact R5).
- **Refusals:** today's 7B sends no refusal body. Since S6 (PR #116) the site reads 200,
  404, 410 and a 422 whose `error` is one of the six codes in "F2: request and response
  JSON", which it shows in its own words. Any other status, or a 422 with an unknown code,
  shows "We could not save just now. Nothing was lost on this page; try Save again in a
  minute." (`src/lib/partner-flow.ts` lines 628 to 648, `src/pages/api/partner-update.ts`
  lines 74 to 78).
- **7A open-case filter (fact R8):** 7A reads Service Cases and tests Partner Status, not
  a Status column. It lists a case when its Partner Status is not `Close won`, `Close
  loss`, `Returned to HSBS`, `Signed`, `Not moving forward` or `Hand back to HSBS`, its
  `Service` is on the partner's Services, it has a Referral link, its linked Referrals
  row's Test matches the partner (Partner Links Title contains `TEST`), and that Referrals
  row has Introduced On set. `Held` and `Not a Fit` are not left out.
  `docs/partner-status-flow.md` ("HSBS 7A contract", step 3) still gives Status not
  `Closed - Won`, `Closed - Lost`, `Not a Fit`, `Closed` or `Held`; that is not what runs.
  7D works only on open items (same file, "HSBS 7D").
- **7B today (fact R9):** every update that passes validation is saved, even one with no
  `choice`, no `Stand` and no answer: the case is patched, a Status Log line is added, Last
  Partner Update is stamped, the other-team sender update email may go, and the shared update column is written on
  the **Referrals row** as `<partner> (<Service>): <label or status>. <note>`.
- **Service Cases:** no Qualified, Not Qualified Reason or Not Qualified Note column in any
  doc on `main`.

### F2: the change, step by step

**Before step F2.6: the S6 site slice must be live on production** with
`PARTNER_QUALIFY_ENABLED` off ("Build order across the three sheets", step 3). The new 7B
is swapped in only after that with `EnforceQualify` off, the new 7A after 7B, then the site
switch goes on, and `EnforceQualify` goes on last. Columns F2.1 to F2.4 may be added at any
time.

**F2.1 Qualified.** On Service Cases add:

| Column | Type | Choices, spelled exactly | Required | Default | Fill-in |
|---|---|---|---|---|---|
| Qualified | Choice (single, drop-down) | `Yes`, `No` | No | none (blank until the partner answers) | No |

**F2.2 Not Qualified Reason.** On Service Cases add:

| Column | Type | Choices, spelled exactly | Required | Default | Fill-in |
|---|---|---|---|---|---|
| Not Qualified Reason | Choice (single, drop-down) | `No permission to contact`, `Other` | No | none | No |

**F2.3 Not Qualified Note.** On Service Cases add Not Qualified Note: **Multiple lines of
text, plain text** (not rich text, no append changes), not required, no default. The note is
1 to 300 characters and a Single line of text holds only 255 (conductor ruling, 11/13).

**F2.4 Closed Reason gains two choices.** One location, no migration (conductor ruling,
11/13). Add `Not qualified` and `Already a customer`, spelled exactly, keeping every
existing choice, to the Closed Reason column on Service Cases. Today 7B writes no Closed
Reason anywhere (fact R2), so there is no "column the live 7B writes". Decision 102 (Brian,
11/14: "Service Cases column"):

1. PB2 first, read only: whether a Closed Reason column already exists on Service Cases
   and is unused (no item holds a value). If so, use it: add the two choices there. If it
   is not a Choice column, record its type and stop and ask.
2. If Service Cases has none (missing, or only on Referrals), add one on Service Cases:
   Closed Reason, Choice (single, drop-down), the six site choices `No response`, `Chose
   another provider`, `Price`, `Timing`, `Not a fit`, `Other`, plus `Not qualified` and
   `Already a customer`, not required, no default, no fill-in. A Referrals column is never
   used or changed.
3. **The new 7B writes it** on a close of a field or FSC case ("Words used"): on a lost
   save (Stand `Not moving forward`, or `choice` `lost`), write `ClosedReason` as sent when
   it is one of the column's choices. On a other-team case 7B writes no Closed Reason, as
   today. A sign writes none.

**F2.5 7A returns the qualify answer on HealthFirst and staffing leads.**

1. For each lead that is a HealthFirst case or a staffing case, add three keys, each the
   Service Case's value as stored, or `""` when blank: `qualified`, `notQualifiedReason`,
   `notQualifiedNote`.
2. The note goes to the partner's own page only. It is never sent by 1R `list` or `team`
   (sheet F6) or by any other flow to a rep or manager.
3. Do not add the three keys to any other case's lead.
4. Do not change the open-case filter. 7A drops a case by its Partner Status (fact R8),
   not by Status `Closed - Lost` or `Closed - Won`. A not-qualified close leaves the page
   only if its lost save writes a Partner Status 7A leaves out (`Not moving forward` or
   `Close loss`), and a signed case only if its sign writes `Signed` or `Close won`. PB6
   confirms which value each save writes before F2.5 is built.

**F2.5b 7B's own setting, `EnforceQualify`.** At the top of 7B, before any other step, add
one Initialize variable step: name `EnforceQualify`, type Boolean, value `false`. It is a
plain on or off setting, not a secret. BB2 changes it to `true` only at build order step 7,
with Brian's go, and back to `false` first on any rollback.

- **Off:** 7B still accepts and stores `Qualified`, `NotQualifiedReason`,
  `NotQualifiedNote` and `PracticeType` when sent, still logs them (F2.8), and still does
  the not-qualified close (F2.10). It makes none of the refusals an old page could hit:
  rule 3 (`closed`) and rule 8 (`reload`) in F2.6 are skipped. A save that today's 7B
  accepts is still accepted, and a case on which today's 7B already skips or refuses a
  save (recorded under item 4) is handled the same way as today.
- **Always on, whatever the setting:** rules 4 to 7 (`bad_value`, `practice_type`,
  `reason`, `note`). Only a request carrying the new keys, sent by a page with the site
  switch on or by a direct post, can meet them; an old page never sends those keys. Rule 5
  fires only when a qualify answer, a `PracticeType` or a `PracticeTypeConfirmed` is sent.
- **Why `closed` waits too:** an old page left open in a second tab can post a save to a
  case that has since signed or been handed back, and today's 7B may accept it (item 4).
  So rule 3 is behind the setting like rule 8.
- **On:** everything in F2 as written.

**F2.6 7B: check every update, and refuse the whole request, before any write.** Add three
optional string properties to each update object in the 7B trigger schema: `Qualified`,
`NotQualifiedReason`, `NotQualifiedNote` (`PracticeType` is sheet F1, F1.6). Then, after
today's key checks (404 unknown, 410 expired) and ownership checks (unchanged), run the
rules below on **every** update in the request, before any Update item, email or Status Log
write. Stop at the first rule that refuses.

1. **Which case it is** comes from the stored Service Case's company column, never from the
   request. If an update carries a `company` key, ignore it.
   **1a. The untouched skip comes first, for every company** (decision 104; Codex P1 on
   #151, 11/14). Before the company check, read the linked Referrals row's Source. On a
   **field or FSC case** (Source `Rep app` or `FSC app`) of **any** company, an update that
   is **genuinely untouched** is skipped: no case write, no Last Partner Update stamp, no
   Status Log line, no email, no Referrals write (the shared update column included), not counted in
   `saved`. Genuinely untouched means `Stand` and `choice` are both missing or `""`, and
   on a HealthFirst or staffing case `Qualified`, `NotQualifiedReason`, `NotQualifiedNote`,
   `ClosedReason` and `PracticeTypeConfirmed` are each missing or `""`, and so is
   `PracticeType` on a staffing case (on a HealthFirst case `PracticeType` is ignored, check
   21b). On every other case the qualify and practice type keys are ignored, so only
   `Stand` and `choice` count. An update that carries any of those keys with a value is
   not untouched: it goes on to rules 2 to 8, so a bad qualify answer is still refused
   (`bad_value`, check 18a) and refuses the whole request (Codex P1 on #151, 11/14). An
   update that passes the rules and still has nothing to save is skipped under rule 4.
   A **other-team case** keeps today's full save, whatever its company.
   **Every other case:** after 1a, ignore `Qualified`, `NotQualifiedReason`,
   `NotQualifiedNote` and `PracticeType`, skip rules 2 to 8, and treat the update exactly as
   on `main`.
2. **Read the stored values** of the Service Case: the columns 7A's open-case test reads
   (item 8), Talked To Doctor, Qualified, Closed Reason, and on a staffing case Practice
   Type.
3. **`closed`** (only while `EnforceQualify` is on, F2.5b). The case is no longer open to the partner: signed, handed back, or closed
   for any reason (including Closed Reason `Not qualified` or `Already a customer`). Use
   exactly the test 7A uses to decide which cases to list ("BB2 records before building",
   item 8): a case 7A would not list is not open. Refuse **any** partner save on it,
   Signed or not, whatever it carries. A second tab left open can never reopen, requalify,
   re-sign or change it. The one change that does not go through 7B is Brian's own
   correction in SharePoint (spec section 6, "After the sign"); this rule does not touch
   it.
4. **`bad_value`.** Refuse when any of these hold:
   - `Qualified` is present and not `Yes`, `No` or `""`;
   - `Qualified` is `No` and `NotQualifiedReason` is not `No permission to contact`,
     `Other` or `""`;
   - `Qualified` is `No` and `NotQualifiedNote` is longer than 300 characters after
     trimming. (Beside a `Yes` or a blank Qualified, a reason or note is ignored: never
     checked, never refused, never stored; conductor ruling R2, 11/13.)
   - `Qualified` is `No` and `Stand` is not `Not moving forward` (a missing or `""` Stand
     counts as not `Not moving forward`: a No is never a standalone save);
   - `Qualified` is `No`, Stand `Not moving forward` is sent, and `ClosedReason` is not
     `Not qualified`;
   - `ClosedReason` is `Not qualified` and `Qualified` is not `No`.

   **Nothing to save is not a refusal.** An update with `Stand` and `choice` both missing
   or `""`, no `Qualified` `Yes`, and no `PracticeType` that counts is treated exactly as
   an update with nothing to save is treated today: no write, no Last Partner Update stamp,
   no Status Log line, no email, and not counted in `saved`. `PracticeType` counts only
   when the stored case is a staffing case (conductor ruling, 11/13); on a HealthFirst case
   it is ignored, so a HealthFirst update that carries only `PracticeType` is a nothing to
   save update. **Recorded 11/13 (fact R9): today's 7B does not skip it.** It patches the
   case, adds a Status Log line, stamps Last Partner Update, may send the other-team sender update email,
   writes the shared update column on the Referrals row, and counts it in `saved`.
   **Decided 11/14: decision 104** ("Skip untouched leads"). Build: on a **field or FSC
   case**, the new 7B skips such an update: no case write, no Last Partner Update stamp, no
   Status Log line, no email, no Referrals write (the shared update column included), and it is not
   counted in `saved`. On a **other-team case** 7B keeps today's full save, unchanged. 7B
   reads the linked Referrals row's Source to choose ("Words used"). The skip runs in rule
   1a, before the company check, so it covers field and FSC cases of every company. BB2
   checks it with a TEST partner (F2 checks 21b, 21c and 21d).
5. **`practice_type`** (staffing cases only). Refuse when `PracticeType` is present, not
   `""`, and not exactly `Private practice` or `Group` (sheet F1, F1.6 rule 4). Refuse when
   `PracticeTypeConfirmed` is present, not `""`, and not exactly `Private practice` or
   `Group`, or not the same string as this update's `PracticeType` (sheet F1, F1.6 rule
   2a). A missing or `""` `PracticeTypeConfirmed` is never refused. Refuse when
   `Qualified` is `Yes` or `No` and the practice type is not set: it is set when this
   update's `PracticeType` is `Private practice` or `Group`, or the Service Case already
   stores one. HealthFirst cases have no practice type and skip this rule.
6. **`reason`.** `Qualified` is `No` and `NotQualifiedReason` is missing or `""`.
7. **`note`.** `Qualified` is `No`, `NotQualifiedReason` is `Other`, and `NotQualifiedNote`
   is missing or empty after trimming.
8. **`reload`** (only while `EnforceQualify` is on, F2.5b). The update is a Signed save (`Stand` is `Signed`, or `choice` is `signed`
   or `won`, or `Status` is `Closed - Won`), and not both of these hold, each on this save
   or already stored:
   - reached: this update's `TalkedToDoctor` is `Yes`, or it is missing or `""` and the
     stored Talked To Doctor is `Yes`;
   - qualified: this update's `Qualified` is `Yes`, or it is missing or `""` and the stored
     Qualified is `Yes`.

   So a case marked No can never be saved Signed, and an old page, which sends no
   `Qualified`, can sign only when Qualified Yes is already stored. Today's date and
   product rule for Signed stays as it is for every company.

**One request at a time: not built (decision 136, Brian 11/15: "A").** The spec asked for
a trigger concurrency limit of 1 (spec commit 127464f, section 6). Power Automate won't save
7B with that limit and a 200 answer after the update loop (BB3, 11/15), and the answer
after the loop wins: the page hears "saved" only once the case is written (PB5). Build:
leave the 7B HTTP trigger's concurrency off, as on today's FSC 7B (fact R10). Don't turn it
on: once on, it can't be turned off without a new flow (Microsoft Learn, "Optimize Power
Automate triggers"). The two validate loops still run one item at a time inside a run.

**The update loop runs 20 leads at a time (v2.3, desk 064, Claude under decision 139,
11/15).** Run one at a time, the field copy took about 8 s plus 3.1 s a lead (BB3, 059
facts), so with the 200 after the loop (PB5) any save of about 6 leads or more would pass
the site's 25 second wait. Today's FSC 7B answers before its loop, so this would have been a
regression for every partner at go-live step 7. Build, from v2.2:

- `Apply_to_each` concurrency 20, the same degree as the 7A lead loop that runs live.
- The `saved` count no longer uses a variable (Learn: Set, Increment and Append in a parallel
  loop give unpredictable results). A per-pass Compose `Saved_flag`, which runs after its
  two branches only on Succeeded or Skipped, is counted after the loop through `result()`.
  A failed write still fails the loop, so the page still gets no 200.
- A failed update email or Return to HSBS email no longer stops the 200: a Compose after
  each send runs on Succeeded, Failed or TimedOut, which Learn counts as handling the
  failure. The writes come before the emails, so the 200 still means the rows exist. This
  answers desk 053 item 3.
- Unitas (with HSRA) and Aligned Advisors (with NumbersIQ) can save two cases for one doctor
  in one request. If `Update_doctor` writes a value worked out from all of the doctor's
  cases, a `Reroll_doctors` loop (one at a time, after the update loop) writes those values
  again for each referral that appeared twice, so the parallel passes can't leave a stale
  roll-up. the shared update column is not rewritten; it holds the last update either way.
- The site already refuses two updates for the same case in one request
  (`src/pages/api/partner-update.ts`), so no case is written twice in parallel.
- Imported as Update over "HSBS 7B Field copy", so its trigger address doesn't change.

- **Still holds:** a request holding several leads is checked (F2.6) before any write, so
  "a refused request writes nothing for any lead" holds for every lead in it.
- **No longer holds:** two requests on the same case at the same moment can both run. Each
  is judged against what was stored when it read the case, and the later write wins. With
  `EnforceQualify` on, a second tab could get past rule 3 (`closed`) if both saves land
  within about a second. Today's live 7B has the same risk. No per-item conditional write
  is used.

**The answer must come back under the site's timeout.** The site waits 25 seconds for 7B,
and 7B answers only after its update loop, so a large batch can time out. (With no trigger
limit, decision 136, requests don't queue behind each other.) What a timed-out save looks like today: the partner is told the save did not go
through and to try again; 7B may still finish the first request, so the retry can add a
second Status Log entry and send a second update email for the same answer. No request id
is added in this wave. Instead, before the new 7B goes live:

- **Rollout gate (BB2 or BB3).** On the TEST copy, with trigger concurrency off (decision
  136) and `EnforceQualify` on (so every F2.6 rule runs), the builder makes two timed runs of direct posts
  and records each request's total time from request to response:
  - **Run 1:** three single saves on three different TEST cases, fired at the same moment.
  - **Run 2, the largest batch.** The page puts every picked lead in one request. The save
    route takes up to 100 updates in one request (`MAX_UPDATES`,
    `src/pages/api/partner-update.ts` line 15), but the biggest partner page on 11/15 had 18
    open leads (BB3, desk 064 step 0), so the gate's batch is **40 updates** (decision 145,
    Brian 11/15: "Yes, 40"; revisit when any partner passes 30 open leads): a Meeting set
    save (`TalkedToDoctor` `Yes` with a `TalkedOn` date, and a meeting date) on each of 40
    open TEST HealthFirst cases under the TEST Partner link. It is fired at the same moment
    as two single saves on two other TEST cases. The builder makes the 40 TEST Referrals rows
    and their Service Cases for this (rule 2) and deletes them after; each case's update
    email goes only where today's TEST rule sends it (rule 3).

  **Pass: all six requests answer 200, and the slowest of the six is under 20 seconds.**
  If any request takes 20 seconds or more or does not answer 200, BB2 stops, leaves the
  old 7B live, and reports the six times to Brian. Nothing is turned on (F2 check 0a). A
  batch of fewer than 40 updates does not count for run 2.
- BB2 reports any duplicate Status Log pair (the same answer logged twice in a row for one
  case) seen during any F2 check ("BB2 records", item 12).

**How 7B refuses.** If any update in the request is refused, write nothing for any update in
it: no Update item, no Status Log line, no email, no Last Partner Update. Answer HTTP 422
with the body in "F2: request and response JSON": the code of the first refusal, and the
lead `id` it applies to. The site supplies the words for each code (slice S6, for example
"Reload this page to finish your update." for `reload`); 7B sends no words, and no flow text
is ever shown to the partner.

**F2.7 7B: write the answer.** For each update in a request that passed F2.6, on a
HealthFirst or staffing case, in the same Update item step as Stage and Status (or the
standalone step in F2.9):

1. `Qualified` is `Yes` or `No`: write it to Qualified. Missing or `""`: leave Qualified as
   it is.
2. **A Yes clears the reason and note.** When `Qualified` is `Yes`, set Not Qualified Reason
   and Not Qualified Note to blank.
3. **Reason and note belong to a No.** When `Qualified` is `No`, write `NotQualifiedReason`
   to Not Qualified Reason, and the trimmed `NotQualifiedNote` to Not Qualified Note when it
   is not empty. On any update whose `Qualified` is not `No`, write neither column from the
   body (rule 2 still clears them on a Yes).
4. **Question 1 is not required on a not-qualified save.** The live 7B does not refuse an
   empty `TalkedToDoctor` (fact R5), so change nothing.
5. **The note is not a status, and never goes in mail.** Never put `NotQualifiedNote` in
   the shared update column, `label`, the Status Log, any column other than Not Qualified Note, or
   the subject or body of any email 7B sends (the update email on an FSC or other-team case,
   the Return to HSBS email, or any other). A field case gets no update email (L3).
6. The success answer is unchanged: 200 `{"saved": n, "notified": [...]}`.

**F2.8 7B: the Status Log records qualify and practice type changes.** Add these parts to the
end of the bracketed tail on that update's Status Log line (after `Stand <words>`, same `; `
separator; today's FSC 7B writes no tail, desk 008, so on the field copy these parts start
one; the line already starts with the date and the partner, which is the
when and the who), each only when the value written differs from the value stored:

- `Qualified Yes`, or `Qualified No (<reason>)` with the reason choice, for example
  `Qualified No (No permission to contact)` or `Qualified No (Other)`. Never the note.
- `Practice type <old> to <new>`, old is `blank` when it was empty (sheet F1, F1.6 rule 7).

If no other tail part is present, these parts make the tail on their own:
`[Qualified Yes; Practice type blank to Group]`.

**F2.9 7B: a standalone save (no Stand).** A `Qualified` `Yes` or a staffing practice type
correction may arrive on its own, with `Stand` and `choice` both missing or `""`, carrying
the lead `id` and only the new keys (`Qualified`, `NotQualifiedReason`, `NotQualifiedNote`,
`PracticeType`, `PracticeTypeConfirmed`). A standalone save is only ever a Yes or a practice type: a No is always
the full lost save in F2.10, and a No with no Stand is refused `bad_value` (F2.6 rule 4).
On a HealthFirst or staffing case that passed F2.6:

1. Write Qualified (with F2.7 rules 2 and 3) and, on a staffing case, Practice Type.
2. **Stamp the partner's action:** set Last Partner Update = now and Partner Updated By =
   the Partner Links row's Email, as every save does today. **Leave the reminder schedule
   alone:** Missed Updates and Next Update Due do not change, because the partner still
   owes a status.
3. Leave every other field of the case as it is: Stage, Status, Partner Status, Talked To
   Doctor, Last Touch, First Touch, Next Step Date, Pipeline Stage, Closed Reason, Last
   Notified Status and the deal value columns. the shared update column is on the Referrals row, not
   the case, and today 7B writes it on every save, one with no Stand included (facts R9,
   F7-0.9). Build: a standalone save does not write the shared update column on the Referrals row. **The one exception is Award
   Practice Type:** when this save carries a `PracticeTypeConfirmed` value and leaves a
   staffing case with reached Yes and Qualified Yes, and Award Practice Type is blank, 7B
   stamps it from that value in the same write (sheet F1, F1.6 rule 9). With no
   confirmation it stays blank. On a HealthFirst case it stays blank.
4. Add one Status Log line `<date> <partner>: ` followed by the F2.8 tail. If no qualify
   answer or practice type changed, add no line (Last Partner Update is still stamped).
5. Send no email for it (today 7B may send the other-team sender update email on such a save, fact R9;
   build: it sends none). Count it in `saved`; it adds no name to `notified`.

**F2.10 The not-qualified save is the existing lost save.** The site sends it as `choice`
`lost`, Stand `Not moving forward`, Stage `Close loss`, Status `Closed - Lost`,
`ClosedReason` `Not qualified`, a `label`, and `StageFromAnswers` as on any lost save today
(spec commit 00356d4), plus `Qualified` `No` and the reason. Run 7B's existing lost save
unchanged, with Next Update Due cleared. Today's FSC 7B has no separate lost branch and
writes no Stage or Status (desk 008); on the field copy the close is stored as L2 says,
and a field case gets no email (L3). An FSC or other-team case gets the usual email, as
today. Today's lost save writes no Closed Reason
(fact R2); on a field or FSC case the new 7B writes `Not qualified` to the Service Cases
Closed Reason (F2.4, decision 102). **Pipeline Stage:**
on every not-qualified close 7B sets Pipeline Stage to `Lost` itself, whether or not the
request carries `StageFromAnswers` (conductor ruling, 11/13). This is the one addition to
the lost branch; it matches the spec's lost path ("Pipeline Stage Lost") and stage rule 3
(a closed stage is always written). It is a stage change like any other, so the existing
"When the stage changes" steps (`docs/fsc-flow-contracts.md`, "Pipeline stage and next
step") run with it whether the stages switch is on or off:

- Stage Entered On = the Eastern save date, and Closed On = the save date when it is empty.
- **The existing stage-change Status Log line** `<date> Stage: <old> to Lost`, for example
  `2026-11-14 Stage: Introduced to Lost`. It is a line of its own, added beside the save's
  own line (the one whose tail ends with the F2.8 `Qualified No (<reason>)` part).
- One save makes one stage change: when `StageFromAnswers` is `Lost` as well, 7B writes
  `Lost` once and adds one stage line, not two.
- Stage rule 1 still comes first: if the stored Pipeline Stage is already `Won`, `Lost` or
  `Handed back` (for example a stale tab while `EnforceQualify` is off), 7B leaves it, sets
  no date and adds no stage line.

A Qualified No is never a standalone save; one that arrives with no Stand is refused
`bad_value` (F2.6 rule 4).

**F2.11 Hand Back Note** (decision 105, Brian 11/14: "Own Service Case column"). Today 7B
writes the partner's hand-back note only to the shared update column on the Referrals row, shared by
every company on that doctor, and every later save rewrites it (fact F7-0.9). Build:

1. On Service Cases add Hand Back Note: **Multiple lines of text, plain text** (not rich
   text, no append changes), not required, no default. Build order step 1.
2. On a hand back save (`choice` `handback`, or Stand `Hand back to HSBS`) of a **field or
   FSC case**, the new 7B writes the request's `Note`, exactly as sent, to that case's Hand
   Back Note, in the same write as the rest of the save.
3. **Never overwritten.** No other save writes Hand Back Note, and a hand back save on a
   case whose Hand Back Note already holds a value leaves it as it is. Brian's own edit in
   SharePoint is the only other change.
4. the shared update column on the Referrals row is written exactly as today, on every case. On a
   **other-team case** 7B writes no Hand Back Note: its hand back is saved exactly as today.
5. Sheet F7 (Part D, step D3) reads the note from Hand Back Note for a field or FSC case.

### F2: request and response JSON

7B, a not-qualified save on a HealthFirst or staffing case (new page):

```json
{
  "key": "<40 hex link key>",
  "updates": [
    {
      "id": 31,
      "choice": "lost",
      "label": "Not moving forward. Not qualified.",
      "Stage": "Close loss",
      "Status": "Closed - Lost",
      "MeetingDate": "",
      "ClosedReason": "Not qualified",
      "Note": "",
      "TalkedToDoctor": "",
      "TalkedOn": "",
      "TriedVia": "",
      "Stand": "Not moving forward",
      "LastTouch": "",
      "SignedDate": "",
      "SignedProduct": "",
      "Qualified": "No",
      "NotQualifiedReason": "No permission to contact",
      "NotQualifiedNote": ""
    }
  ]
}
```

A Qualified Yes rides on any other save (for example Meeting set, or No change), with
`"Qualified": "Yes"`, `"NotQualifiedReason": ""`, `"NotQualifiedNote": ""`. A standalone
save (F2.9) carries `id` and the column keys with no `Stand`:

```json
{ "id": 31, "Qualified": "Yes", "NotQualifiedReason": "", "NotQualifiedNote": "", "PracticeType": "Group", "PracticeTypeConfirmed": "Group" }
```

The site builds `label` and decides exactly which other keys a standalone save carries
(slice S6); 7B goes by F2.6 and F2.9 whatever else is present.

| Key | Type | Values | Missing or `""` |
|---|---|---|---|
| `Qualified` | string | `Yes`, `No` | Leave Qualified as it is |
| `NotQualifiedReason` | string | `No permission to contact`, `Other`; read only when `Qualified` is `No` | Leave Not Qualified Reason as it is (a `Yes` save still clears it) |
| `NotQualifiedNote` | string | 1 to 300 characters; read only when `Qualified` is `No` | Leave Not Qualified Note as it is (a `Yes` save still clears it) |

7B refusal, HTTP 422:

```json
{ "error": "reload", "id": 31 }
```

| Key | Type | Values |
|---|---|---|
| `error` | string | Exactly one of `reload`, `reason`, `note`, `practice_type`, `closed`, `bad_value` |
| `id` | number | The `id` of the update that was refused. Leave the key out only if 7B cannot give it |

7A, one HealthFirst or staffing lead (only the new keys shown):

```json
{ "id": 31, "qualified": "", "notQualifiedReason": "", "notQualifiedNote": "" }
```

| Key | Type | Values | When |
|---|---|---|---|
| `qualified` | string | `Yes`, `No`, or `""` when blank | HealthFirst and staffing leads only |
| `notQualifiedReason` | string | `No permission to contact`, `Other`, or `""` | Same |
| `notQualifiedNote` | string | the stored note, or `""` | Same; the partner's own page only |

### F2: what must not change

- **Every other-team case** (Referrals Source not `Rep app` or `FSC app`). Decisions 102, 104
  and 105 change field and FSC cases only: a other-team case's save, empty or not, its hand
  back and its close are written exactly as today's 7B writes them (checks 21c, 27, 28).
- **Every other partner's 7A and 7B behavior.** Unitas, eAssist, Practice Booster, WeCare,
  Cardio Partners, Compliance Training Partners, Dental Resource Center, Aligned Advisors,
  Grapevine and every other case: their 7A leads get none of the three keys, their 7B saves
  ignore the new keys, and none of the F2.6 refusals applies to them. The one change for
  them is decision 104's untouched skip on a field or FSC case (F2.6 rule 1a, check 21d); a
  other-team case of theirs saves exactly as today. A TEST Unitas save
  behaves as on `main`.
- **Talked To Doctor** keeps its column and its three answers (`Yes`, `Not yet, still
  trying`, `Not yet, haven't tried`), read and written by 7A and 7B as today. The words
  "Talked with the customer?" on the staffing page are site side.
- **The lost path** keeps every existing step. No new close branch is built.
- **Old page bodies** (none of the new keys, or the old eight-key body) save exactly as
  today while `EnforceQualify` is off. With it on, two of their saves change on a
  HealthFirst or staffing case: a Signed save with no Qualified Yes stored is refused
  `reload` (spec section 6, "A sign needs both partner answers"), and any save on a case
  no longer open to the partner is refused `closed`.
- **Status Log:** the additions are the F2.8 tail parts (`Qualified ...`, `Practice type
  ...`), a standalone save's own line (F2.9 rule 4), and, on a not-qualified close, the
  existing stage-change line `<date> Stage: <old> to Lost` (F2.10). That stage line is
  today's line for any stage change, written because F2.10 adds a stage change, not a new
  kind of line. Every other Status Log behavior, including the existing tail parts, is
  unchanged.
- The 7A open-case filter, the key checks (404 unknown, 410 expired), Deal value, Pipeline
  Stage and Next Step Date rules, 7C and 7D.
- No email recipient, subject or body changes, except on a field case: no update email
  (L3), and a Return to HSBS email to Brian with no other-team name text (L5). No email is added for a
  qualify answer or a standalone save.
- No ledger row is written by 7B. The ledger rules for the qualify answer are sheet F4
  (HSBS 10), which reads these columns. The not-qualified Void row there applies only to a
  row whose Source is "Rep app" (spec section 6); this sheet closes the case for every
  source the same way.
- **After the sign, only Brian corrects the answer**, by editing Qualified and Not Qualified
  Reason on the Service Case in SharePoint (spec section 6). No flow in this sheet writes
  Partner Status, Pipeline Stage or Closed Reason on that edit, and no flow refuses it.

### F2: TEST checks (TEST rows only; each is pass or fail)

0. **Precondition.** The S6 site slice (PR #116) is live on production with
   `PARTNER_QUALIFY_ENABLED` off before the new 7B is swapped in. A 422 `reason` from the
   TEST 7B copy, sent through the site's partner save route, shows S6's words for
   `reason`, not "We could not save just now". If S6 is not live, stop: no other F2 check
   is run against a swapped 7B.

0a. **Answer time gate.** With trigger concurrency off (decision 136) and `EnforceQualify`
   on, on the TEST copy, both runs in "The answer must come back under the site's
   timeout": run 1, three
   single saves on three TEST cases fired at the same moment; run 2, one request with 40
   Meeting set updates on 40 open TEST HealthFirst cases (decision 145) fired at the same moment as two
   single saves on two other TEST cases. Pass: all six requests answer 200 and the slowest
   total time from request to response is under 20 seconds. BB2 records the six times. If
   any is 20 seconds or more, or any request does not answer 200, stop: the old 7B stays
   live, Brian gets the times, and nothing is turned on.
   **On the 7B Field copy (decision 138):** run 2 uses Rep app TEST cases (no email), and
   run 1 uses three FSC app TEST cases (3 update emails, to the TEST rule's address only).
   Record run 1's times beside run 2's single-save times. One canary row and one save come
   first; if HSBS 4, 6, 8 or any other On HSBS flow runs at the canary's times, stop.

Checks 1 to 22 run on the TEST copy of 7B with `EnforceQualify` **on**, unless they say
otherwise. Checks 23 to 25 test the setting itself. At launch only the checks listed in
"F2 at launch" apply. Checks 6 and 6a to 6b also need Stage and Status writes that today's
FSC 7B does not have (desk 008), so they are reworded before `EnforceQualify` goes on.

1. Service Cases has Qualified (`Yes`, `No`), Not Qualified Reason (`No permission to
   contact`, `Other`), and Not Qualified Note (multiple lines of text, plain text), none
   required, no defaults. The Closed Reason column 7B writes has `Not qualified` and
   `Already a customer` beside every existing choice.
2. 7A returns `qualified`, `notQualifiedReason`, `notQualifiedNote` (all `""`) on a new TEST
   HealthFirst lead and a new TEST staffing lead, and none of them on a TEST Unitas lead.
   (S6: "The question shows from the first visit".)
3. A 7B save with `Qualified` `Yes` and `TalkedToDoctor` `Not yet, haven't tried` on a TEST
   HealthFirst case stores Qualified Yes; Talked To Doctor is as sent; the Status Log tail
   ends `Qualified Yes`. (S6 "Yes saves Qualified"; M16 "Qualified Yes before reaching
   anyone".)
4. `Qualified` `No` with `NotQualifiedReason` `""` is refused, 422 `reason`, nothing written,
   no email. (S6; spec section 6.)
5. `Qualified` `No`, reason `Other`, note `""` is refused, 422 `note`; a note of only spaces,
   refused `note`; a 301 character note, refused `bad_value`. (S6 "Reason Other with an
   empty note is refused, by the page and by 7B".)
6. A 7B not-qualified save (the JSON above) on a TEST staffing case with Practice Type set:
   Qualified No, Not Qualified Reason `No permission to contact`, Stand `Not moving
   forward`, Status `Closed - Lost`, Stage `Close loss`, Closed Reason `Not qualified`,
   Next Update Due blank, Next Step Date blank, saved with `TalkedToDoctor` `""`, and the
   save's own Status Log line has a tail that ends `Qualified No (No permission to
   contact)`. Pipeline Stage, run both ways, each on its own open TEST staffing case whose
   Pipeline Stage BB2 notes before the save (call it `<old>`; for example `Introduced`):
   - 6a. The body carries `StageFromAnswers` `Lost`: Pipeline Stage is `Lost`.
   - 6b. With the stages switch off, the body has no `StageFromAnswers`: Pipeline Stage is
     still `Lost`, set by 7B itself (F2.10).

   In both, Stage Entered On and Closed On are the save date, and the save adds exactly two
   Status Log lines: the save's own line above, and one stage line
   `<date> Stage: <old> to Lost` (F2.10). A missing stage line, or two, fails the check.

   7A no longer returns the case. 7D sends no reminder for it on its next run. (S6 "No with
   a reason closes the case"; M16 third case, flow side.)
7. The same save with reason `Other` and a TEST note stores the note in Not Qualified Note.
   The note is not in the shared update column, the other-team sender's email or the Status Log (the tail says
   `Qualified No (Other)`). (S6 TEST Other note, flow side; the exceptions part is F4.)
7a. On a TEST FSC app case, open the TEST update email 7B sent for that not-qualified
   close (reason `Other`, TEST note), where today's TEST rule sends it: the note text is in
   neither its subject nor its body. On a TEST field case the same close sends no email
   (L3). (S6 row.)
8. On a TEST HealthFirst case with Qualified Yes stored, a 7B save with none of the new keys
   (an old page, Stand `No change this week`) saves and leaves Qualified Yes; a save with all
   three `""` does the same, and neither adds a `Qualified` tail part. (S6 "A save from a
   page loaded before this change".)
9. On a TEST HealthFirst case with Talked To Doctor Yes and Qualified blank, an old page
   Signed save (no `Qualified` key, a date and a product) is refused, 422
   `{"error":"reload","id":<that id>}`, nothing written. An old `choice` `won` body is
   refused `reload` too. (S6; M24 "a direct post to 7B is refused too".)
10. Then a 7B save with `Qualified` `Yes` and Stand `Signed`, a date and a product, is
    accepted. (S6 "after a reload the partner answers Qualified Yes and the sign saves";
    M24 last step, flow side.)
11. On a TEST staffing case with Qualified Yes stored and Talked To Doctor Yes, an old page
    Signed save with a date and a product is accepted. (S6 "The same old-page Signed
    save on a case that already has Qualified Yes stored is accepted".)
12. On an open TEST HealthFirst case, a Signed save with `Qualified` `No`, a reason, a date
    and a product is refused (`bad_value`, because No needs Not moving forward). On an open
    TEST case where Qualified No was set by hand in SharePoint, a Signed save with no
    `Qualified` key is refused `reload`. (S6 "A case marked No cannot be saved Signed"; M10
    "a later sign is refused".)
13. On a TEST staffing case, a Signed save with Talked To Doctor Yes and Qualified Yes but no
    `SignedProduct` is refused, as on a HealthFirst case. (S6.)
14. On a TEST staffing case with Practice Type blank, a save with `Qualified` `Yes` and no
    `PracticeType` is refused `practice_type`; with `Qualified` `No` and a reason, refused
    `practice_type`. The same save with `PracticeType` `Private practice` is accepted and
    stores both. (M22 "cannot save Qualified Yes or Qualified No until a practice type is
    set"; spec section 6 "Practice type".)
15. On a TEST staffing case closed `Already a customer` with no qualify answer, a direct 7B
    Signed save is refused `closed`, and 7A does not return the case. On the case closed
    `Not qualified` in check 6, a No change save from a stale second tab, a standalone
    `Qualified` `Yes` save and a Signed save are each refused `closed`, and the case is
    unchanged. (M18, flow side; spec section 6, "What 7B refuses, and how".)
15a. **Two tabs, after Signed.** Open the TEST partner page in two tabs on one TEST
    HealthFirst case that is reached and qualified. Tab 1 saves Signed with a date and a
    product (accepted). Tab 2, still showing the case, then saves Meeting set: refused 422
    `{"error":"closed","id":<that id>}`. A standalone `Qualified` `No` from tab 2 is refused
    `closed` too. The case stays signed and unchanged, no Status Log line, no email.
15b. **Two tabs, after Hand back to HSBS.** Same on a TEST staffing case: tab 1 saves Hand
    back to HSBS with a note (accepted). Tab 2 then saves `Qualified` `Yes` with Stand
    Proposal or agreement sent: refused `closed`. A standalone `PracticeType` `Group` from
    tab 2 is refused `closed`. The case keeps its handed-back status and note, unchanged.
15c. Brian's own correction in SharePoint on the signed case from check 15a (Qualified to
    No with a reason) is not a 7B save: it is stored, and no flow in this sheet refuses or
    reverses it.
16. On a TEST open HealthFirst case, a save with `Qualified` `No`, a reason and Stand
    `Meeting set` is refused `bad_value`. A lost save with `ClosedReason` `Not qualified`
    and `Qualified` `""` is refused `bad_value`. A save with `Qualified` `maybe` is refused
    `bad_value`.
17. **A mixed request writes nothing.** One request with a valid No change update on TEST
    case A and a `Qualified` `No` with no reason on TEST case B: 422 `reason` with case B's
    id. Case A is unchanged (no column, no Last Partner Update), neither case gets a Status
    Log line, and no email goes out.
17a. **Not run while trigger concurrency is off (decision 136).** Checks 17a and 17c need
    one request at a time, which isn't built. They stay here for the record. Neither is a
    launch check.
    **Two saves at the same moment.** For one open TEST HealthFirst case that is reached
    and qualified, send two requests at the same moment (two direct posts started
    together): a Qualified No close (the not-qualified lost save) and a Signed save with a
    date and a product. Exactly one is accepted (200); the other gets 422
    `{"error":"closed","id":<that id>}`. The case holds only the accepted save's fields:
    either Closed - Lost with Closed Reason `Not qualified` and Qualified No, or Closed -
    Won with the signed date and product and Qualified Yes, never a mix. Status Log lines
    only for the accepted save (its own line, plus the stage line `<date> Stage: <old> to
    <new>` when it changed Pipeline Stage, which a Qualified No close always does here,
    F2.10), none for the refused one, and only the accepted save's email. Run it three
    times; the result holds each time. (Spec section 6, "What 7B refuses"; S6.)
17c. **A two-lead request races a single save.** Request 1 holds two updates: a No change
    with a last-touch date on open TEST case A, and a Meeting set with a meeting date on
    open TEST case B. Request 2, sent at the same moment, is a single save that closes case
    B (a Qualified No close, or Hand back to HSBS). Exactly one outcome holds, every run:
    either request 1 is written whole (both A and B carry its fields) and request 2 is then
    refused `closed`, or request 2 is written first and request 1 is refused `closed` with
    case B's id and case A is unchanged (no column, no Last Partner Update, no log line, no
    email). Never one lead of request 1 written without the other. Run it three times.
17b. **Stale tab after a Qualified No.** One tab saves the not-qualified close (reason
    `Other` and a TEST note). The stale tab then posts `Qualified` `Yes` with Stand
    `Meeting set`: refused `closed`. The case stays Closed - Lost with Qualified No, its
    reason and its note. (S6 "Two tabs".)
18. **Standalone save.** On an open TEST staffing case with Practice Type `Private
    practice`, Qualified blank, Partner Status `Meeting set`, Missed Updates 1 and a Next
    Update Due, a request with one update `{"id": <that id>, "Qualified": "Yes",
    "PracticeType": "Group", "PracticeTypeConfirmed": "Group"}` and no Stand: Qualified Yes and Practice Type `Group` are
    stored; Last Partner Update is now and Partner Updated By is the TEST Partner Links
    row's Email; Missed Updates is still 1 and Next Update Due is unchanged; the case had
    Talked To Doctor Yes, so Award Practice Type is now `Group` (this request's
    `PracticeTypeConfirmed`, F1.6 rule 9); Stage, Status, Partner Status, Talked To Doctor, Pipeline Stage and every
    other column are unchanged;
    one Status Log line ends `[Qualified Yes; Practice type Private practice to Group]`; no
    email; answer 200 with `saved` 1. Run it twice, once from the S6 page (no stand chosen;
    the partner picks Group, so the page sends both keys) and once as a direct post; the
    result is the same. The same direct post without `PracticeTypeConfirmed`, on a second
    such TEST case, stores Qualified Yes and Group and leaves Award Practice Type blank. A direct post of only
    `{"id": <that id>, "Qualified": "Yes"}` on an open TEST HealthFirst case with Talked To
    Doctor Yes saves Qualified Yes the same way, and its Award Practice Type stays blank.
    (S6 "Standalone saves".)
18a. **A No is never standalone.** On an open TEST HealthFirst case, a request with one
    update `{"id": <that id>, "Qualified": "No", "NotQualifiedReason": "No permission to
    contact"}` and no Stand is refused, 422 `{"error":"bad_value","id":<that id>}`. Nothing
    is written: Qualified, the reason, Partner Status, Status, Last Partner Update and every
    other column are unchanged, no Status Log line, no email, and 7A still lists the case.
19. **A Yes clears the reason and note.** On an open TEST HealthFirst case where Qualified No,
    reason `Other` and a note were set by hand in SharePoint, a save with `Qualified` `Yes`
    stores Yes and blanks Not Qualified Reason and Not Qualified Note. A save with
    `Qualified` `Yes` and `NotQualifiedReason` `Other` sent beside it writes no reason.
19a. **Junk beside a Yes is ignored.** On an open TEST HealthFirst case, a save with
    `Qualified` `Yes`, `NotQualifiedReason` `maybe` and a 400 character `NotQualifiedNote`
    is accepted (200): Qualified Yes is stored, Not Qualified Reason and Not Qualified
    Note stay blank, and the note text is in no Status Log line or email.
20. On a TEST case with Qualified Yes, Talked To Doctor Yes, signed (`Closed - Won`), Brian
    sets Qualified to No with a reason in SharePoint. No flow in this sheet runs on it or
    changes Partner Status, Pipeline Stage or Closed Reason. (M11 second order, flow side;
    the ledger part is sheet F4.)
21. A TEST Unitas case: a 7B save carrying all the new keys with `Qualified` `No` and no
    reason is not refused and writes none of them; a Unitas Signed save with no qualify
    answer, a date and a product is accepted as on `main`. (S6 "A TEST Unitas case".)
21a. A direct 7B post on that TEST Unitas case carrying `"company": "HealthFirst"` and
    `Qualified` `No` with no reason is still treated as a Unitas save (not refused, the new
    keys not written). A post on a TEST HealthFirst case carrying `"company": "Unitas"` and
    `Qualified` `No` with no reason is still refused `reason`.
21b. **Practice type only on a HealthFirst case.** On an open TEST HealthFirst case, a request
    with one update `{"id": <that id>, "PracticeType": "Group"}` and no Stand: not refused,
    nothing written (no Practice Type, no Last Partner Update, no Status Log line), no email,
    and the answer's `saved` does not count it (treated as today's nothing to save update,
    as BB2 recorded under item 9). The same update on an open TEST staffing case stores
    `Group` (F2 check 18 pattern). Both TEST cases are field or FSC cases (decision 104).
21c. **A other-team case keeps today's save** (decision 104 scope). On an open TEST case
    whose Referrals row has Source the other team's app Source value (or the other team's page Source value), a request with one update
    carrying only `id` (no `choice`, no Stand, no answer) is saved exactly as today's 7B
    saves it (fact R9): the case patched, one Status Log line, Last Partner Update stamped,
    the shared update column written on the Referrals row, and counted in `saved`. The same update on
    an open TEST field case (Source `Rep app`) writes nothing, adds no log line, sends no
    email, leaves the shared update column as it was, and is not counted in `saved`.
21d. **The untouched skip covers every company** (decision 104, F2.6 rule 1a). On an open
    TEST case for Unitas whose Referrals row has Source `FSC app`, a request with one update
    carrying only `id` (no `choice`, no Stand) writes nothing to the case, adds no Status Log
    line, stamps no Last Partner Update, sends no email, leaves the shared update column as it was, and
    is not counted in `saved`. The same update on an open TEST Unitas case whose Referrals
    row has Source the other team's app Source value is saved exactly as today (as in check 21c).
22. No email went out from any check above except what today's TEST rule already sends,
    and on a field case none except the Return to HSBS email to Brian (L3, L5).
23. **`EnforceQualify` off, site switch off.** With the new 7B copy at `EnforceQualify` off
    and `PARTNER_QUALIFY_ENABLED` off, on a TEST HealthFirst case with Talked To Doctor Yes
    and Qualified blank, the partner page (no qualify question) saves Signed with a date
    and a product exactly as today: 200, the case signed, the same columns, Status Log line
    and email as on `main`. A stale-tab No change on that signed case is handled exactly as
    today's 7B handles it (item 4). A direct post with `Qualified` `No` and no reason is
    still refused `reason`.
24. **Both on.** With `PARTNER_QUALIFY_ENABLED` on and `EnforceQualify` on, a Signed save
    from a page loaded before the switch went on, on a TEST HealthFirst case with
    Qualified blank, is refused `reload` and the page shows "Reload this page to finish
    your update."; after the reload the page shows the qualify question, the partner
    answers Qualified Yes and signs, and the sign is accepted.
25. **A sign in the gap, end to end.** With `PARTNER_QUALIFY_ENABLED` off and
    `EnforceQualify` off, a TEST staffing case with Practice Type `Private practice`,
    Talked To Doctor Yes and Qualified blank is saved Signed from the page (accepted, as
    today). Award Practice Type is blank. Brian then sets Qualified `Yes` and Award Practice
    Type `Private practice` together in SharePoint (decision 84; no `PracticeTypeConfirmed`
    is involved). No 7B run touches the case afterwards,
    a direct 7B post on it is refused `closed` once `EnforceQualify` is on, and both fields
    keep Brian's values. (The award row is sheet F4's; see open items.)
26. **Hand Back Note** (decision 105). On an open TEST field case (Referrals Source `Rep
    app`), a hand back save with the note `TEST note one` stores `TEST note one` in Hand
    Back Note; the shared update column on the Referrals row is written as today. A later save on
    another company's TEST case for the same doctor rewrites the shared update column but leaves the
    first case's Hand Back Note as `TEST note one`. A direct second hand back post on the
    first case with `TEST note two` leaves `TEST note one` stored (and is refused `closed`
    once `EnforceQualify` is on).
27. **A other-team hand back is as today** (decision 105 scope). On an open TEST case whose
    Referrals Source is the other team's app Source value, a hand back save writes the shared update column exactly as
    today's 7B does, and Hand Back Note stays blank.
28. **Closed reason on field and FSC cases only** (decision 102). A lost save with
    `ClosedReason` `Price` on an open TEST field case stores `Price` in the Service Cases
    Closed Reason. The same save on an open TEST other-team case writes no Closed Reason, as
    today.

### F2: rollback

Reverse order: BB2 sets `EnforceQualify` off first, then Brian turns
`PARTNER_QUALIFY_ENABLED` off, then 7A goes back to its pre-change copy, then 7B. The new columns (Hand Back Note and Closed Reason included) and
choices may stay; nothing reads them once the old flows run. Do not delete a column holding TEST data until Brian says so.

---

## Sheet F6: 1R list, team and earnings

Spec: section 5 ("The qualify answer and the closed reason reach Track as values, not as
text"), section 6 ("After the sign", "Ledger", "What each track sees"), section 9 row F6,
slice S4, check M12.

### F6: what exists today

- **1R `list`:** `{"referrals":[...]}`, each referral with `id`, `doctorName`,
  `practiceName`, `sentOn`, `route`, the other team's name key, `closed`, `signed`, `lines` and `history`;
  each line has `company`, `status`, `detail`, `updatedOn` (`docs/fsc-flow-contracts.md`,
  "1R list"). On an other-team sender-first referral one line names the other-team sender in `company`. The site keeps
  only those line keys (`src/lib/fsc-track.mjs` lines 110 to 121) and picks the HealthFirst
  line by `company === 'HealthFirst'` (`src/lib/rep-lead.mjs` line 154,
  `src/lib/rep-track.mjs` line 59). `company` holds the case's `Service` choice Value, or
  `Service` itself when the Value is missing (fact R6). In the FSC copy `list` answers only
  an FSC key and refuses every other role with HTTP 400 "list is FSC only"; what the 1R the
  rep app calls does for a Rep key is PB1.
- **1R `team`:** each signed-up entry's `referrals` is "each row exactly as the list action
  builds it, plus `reached`", `rows` is "exactly what the earnings action returns for this
  rep", and `managerRows` is the earnings row shape plus `repEmail`
  (`docs/build/rep-app-flow-contracts.md`, "team (new, read only)"). Whether the live team branch
  calls the list and earnings logic or repeats it is not in the repo copy.
- **1R `earnings`:** `{"rows":[...]}`, each with `referralId`, `practiceName`, `event`,
  `payeeRole`, `amount`, `earnedOn`, `status`, `paidOn`, `voidReason`, `disputed`
  (`docs/build/rep-app-flow-contracts.md`, "HSBS 1R earnings"). No company key. The SPIFF Ledger
  has no Company column today; sheet F4 adds it (spec section 6, "Ledger").

### F6: the change, step by step

**F6.1 The Solutions value on each line.** For each line built from a Service Case:

1. Check what today's `company` holds. If it is the case's Solutions value exactly as stored
   (for staffing, `HS Staffing / Recruiting Services (including GoTu)`), add no key: the
   site reads it from `company`. Record "company is the Solutions value" in the build
   report.
2. If it is anything else (a display name, a short name), keep `company` exactly as it is
   and add `solutions`: the case's Solutions value exactly as stored (key name confirmed by
   the conductor, 11/13). Record which in the build report.

**F6.2 Three fields on each line.** On each line built from a Service Case, add:

| Key | Type | Value |
|---|---|---|
| `qualified` | string | The Service Case's Qualified as stored: `Yes`, `No`, or `""` when blank |
| `notQualifiedReason` | string | Not Qualified Reason as stored, for example `No permission to contact`, or `""` |
| `closedReason` | string | Closed Reason as stored for that case, read from the Service Cases column F2.4 sets up (decision 102; today 7B writes none, fact R2), for example `Already a customer` or `Not qualified`, or `""`. A other-team case has none, so it is `""` |

Send them on every Service Case line, whatever the company; they are `""` where blank. An
other-team line on an other-team sender-first referral (no Service Case) sends all three as `""`. Send the stored
choice exactly, never words built from it: the site maps values to words (spec section 5).
Never send Not Qualified Note.

**F6.2a Practice type on each staffing line.** On each line built from a staffing case, add
`practiceType`: the Service Case's Practice Type as stored (`Private practice` or `Group`),
or `""` when blank. Read it from the Service Case (the partner's correction), not from the
Referrals row. Do not add it to any other line. The screens need it to word $100 or $200
before an award exists (spec section 9, row F6).

**F6.3 The same on `team`.** Each `team[].referrals[]` entry carries F6.1, F6.2 and F6.2a exactly as
`list` does. If the live team branch reuses the list logic, check that the new keys come
through; if it builds its own lines, add them there too.

**F6.4 Company on every ledger row.** After sheet F4's SPIFF Ledger Company column exists:

1. `earnings`: add `company` to every row, the ledger row's Company as stored (`HealthFirst`
   or `Staffing`, the company key, not the Solutions value), or `""` when blank.
2. `team`: add the same `company` to every row in each `team[].rows[]` and every row in
   `managerRows`.
3. Build each object with a Select or Compose that names its keys, as today; never pass a
   whole row.
4. On every staffing row in `earnings`, `team[].rows[]` and `managerRows`, add
   `practiceType`: the ledger row's Practice Type as stored (`Private practice` or `Group`,
   the value HSBS 10 wrote from Award Practice Type), or `""` when blank. Do not add it to a
   HealthFirst row. The site only names the type on the line ("Direct Dental, Group"); the
   amount it shows is always the row's `amount`, never one worked out from the type (slice
   S5, decision 82). Without the key the line names no type.

### F6: request and response JSON

Requests are unchanged:

```json
{ "action": "list", "referralKey": "<key>" }
{ "action": "team", "referralKey": "<key>" }
{ "action": "earnings", "referralKey": "<Rep key>" }
```

`list`, one referral (new keys on the line; `solutions` only if F6.1 rule 2 applies):

```json
{
  "referrals": [
    {
      "id": "HSBS-R251113120000",
      "doctorName": "TEST Office Manager",
      "practiceName": "TEST North Side Dental",
      "sentOn": "2026-11-13",
      "route": "Partner",
      "<other-team name key>": "",
      "closed": true,
      "signed": false,
      "lines": [
        {
          "company": "HS Staffing / Recruiting Services (including GoTu)",
          "status": "Not moving forward",
          "detail": "",
          "updatedOn": "2026-11-14",
          "practiceType": "Group",
          "qualified": "No",
          "notQualifiedReason": "No permission to contact",
          "closedReason": "Not qualified"
        }
      ],
      "history": []
    }
  ]
}
```

| Key (on each line) | Type | Missing or `""` means |
|---|---|---|
| `solutions` | string | Only sent if `company` is not the Solutions value (F6.1) |
| `practiceType` | string | Staffing lines only. `""`: no practice type stored |
| `qualified` | string | `""`: no qualify answer stored |
| `notQualifiedReason` | string | `""`: none stored |
| `closedReason` | string | `""`: none stored |

`earnings`, one row (new key `company`; every other key as today):

```json
{
  "rows": [
    {
      "referralId": "HSBS-R251113120000",
      "practiceName": "TEST North Side Dental",
      "event": "Reached",
      "payeeRole": "Rep",
      "amount": 200,
      "earnedOn": "2026-11-14",
      "status": "Waiting",
      "paidOn": "",
      "voidReason": "",
      "disputed": false,
      "company": "Staffing"
    }
  ]
}
```

| Key | Type | Values | `""` means |
|---|---|---|---|
| `company` | string | `HealthFirst` or `Staffing` (the company key) | No Company on the row. The site shows no plan for it (spec section 4: "A row whose Solutions value is not in the table has no key, so it has no plan") |

`team`: each `team[].referrals[]` line as `list` above, each `team[].rows[]` row and each
`managerRows[]` row as `earnings` above (plus `repEmail` on manager rows, as today).

### F6: what must not change

- **No Not Qualified Note.** `list`, `team` and `earnings` never carry the note, the
  partner's free-text update or the Note column (spec section 6: the note is never shown to
  a rep or manager).
- Who sees what: a key reads only its own rows; `team` reads only the caller's current
  Active Team Roster rows; Test rows only for a TEST person. Unchanged.
- Every existing key, shape, cap (200 referrals per team entry, 200 team entries), date
  format, the 404 rules and the time limits. No referral key in any answer. No counts or
  totals.
- `lookup` and `submit` are not touched by this sheet.
- The other team's app, the pilot FSC app and every other partner's lines keep today's keys and
  values; they only gain `qualified`, `notQualifiedReason`, `closedReason` (and `solutions`
  where F6.1 rule 2 applies), set to `""` where blank. `practiceType` is on staffing lines
  only.
- No write and no email from `list`, `team` or `earnings`.

### F6: TEST checks (TEST rows only; each is pass or fail)

1. Build report states whether `company` on a line is the exact Solutions value, for a TEST
   HealthFirst line, a TEST staffing line and a TEST Unitas line. If not, `solutions` holds
   it exactly on each.
2. `list` for a TEST rep: a staffing case marked not qualified for no permission returns
   `qualified` `No`, `notQualifiedReason` `No permission to contact`, `closedReason`
   `Not qualified`. (S4 "A case marked not qualified for no permission", flow side.)
3. A TEST HealthFirst case reached with no qualify answer returns `qualified` `""`. (S4
   "Before the partner answers the qualify question".)
4. A TEST case closed `Already a customer` returns `closedReason` `Already a customer`.
4a. A lost TEST case closed earlier with an existing reason (for example `Price`, saved
   before this change) returns that reason as `closedReason` in `list`, and the same value
   on that rep's referral in `team`, read from the F2.4 column. Today's 7B stores no reason
   (fact R2), so a case closed before the new 7B has none: BB2 sets `Price` on a TEST case
   by hand in SharePoint for this check, or records it as not run.
5. A TEST signed case that Brian changed to Qualified No in SharePoint returns `qualified`
   `No` and its `closedReason` unchanged (blank for a sign), so the site still reads it as
   signed. (M11 second order, list part.)
6. A TEST case with reason `Other` and a note returns `notQualifiedReason` `Other`, and the
   note text appears nowhere in the `list` or `team` answer.
7. `team` for a TEST manager returns the same line keys and values as check 2 for that TEST
   rep's referral. (S4 "on the manager's view of that rep".)
8. A TEST other-team list read and a TEST FSC list read return today's keys plus the new keys as
   `""` on lines with no answer, and nothing else changes.
9. After sheet F4's Company column exists: `earnings` for a TEST rep returns `company`
   `Staffing` on a staffing row and `HealthFirst` on a HealthFirst row; a row with a blank
   Company returns `""`. (M12 needs this: the existing staffing award still shows with its
   amount, which the site can only label from `company`.)
10. `team` returns `company` on every `rows[]` row and every `managerRows[]` row.
11. **Practice type before any award.** Two new TEST staffing referrals from a TEST rep, one
    sent as `Private practice` and one as `Group`, with no partner save and no ledger row:
    `list` for the TEST rep returns `practiceType` `Private practice` and `Group` on their
    lines, and `team` for the TEST manager returns the same values on that rep's
    referrals. A TEST HealthFirst line has no `practiceType` key.
12. After the partner corrects the `Group` case to `Private practice` (sheet F1, check 9
    pattern), `list` and `team` return `Private practice` for it, read from the Service
    Case.
13. No email and no write from any check above.

### F6: rollback

Point 1R back at its pre-change copy. The answers lose only the new keys, which today's site
already ignores (it keeps only known keys, `src/lib/fsc-track.mjs` lines 110 to 121 and
`src/lib/rep-earnings.mjs` lines 47 to 75).

---

## Spec clause to sheet step

| Spec clause | Sheet step or check |
|---|---|
| 9 F1: Referrals and Service Cases Practice Type choice (`Private practice`, `Group`) | F1.1, F1.2; F1 check 1 |
| 6 (Staffing amount): Award Practice Type column on Service Cases, written once | F1.2a, F1.6 rule 9; F1 checks 1, 11b, 11c |
| Decision 82: Award Practice Type only from the partner's own confirmation, `PracticeTypeConfirmed`; a staffing Yes with none never stamps | F1.6 rules 2a and 9, F2.6 rule 5, F2.9 rule 3; F1 checks 11b to 11g; F2 check 18 |
| 4: two stored values spelled exactly; label never stored | F1.1, F1.2, F1.4 rule 2; F1 check 5 |
| 9 F1: 1R submit writes it from `practiceType` to both | F1.3, F1.4 rules 4 and 5; F1 checks 2, 3, 4 |
| 6: 1R refuses a staffing Rep app submit whose `practiceType` is missing or not one of the two | F1.4 rule 2; F1 check 5 |
| 4 and 6: one company per rep app submit; 1R refuses none or more than one for Source "Rep app" | F1.4 rule 1; F1 check 6a; F1 "what must not change" |
| 9 F1: 7A returns it on each staffing lead as `practiceType`, the Service Case's value | F1.5; F1 checks 7, 8 |
| 9 F1: 7B accepts `PracticeType` on a staffing save, writes the Service Case; missing or `""` unchanged | F1.6; F1 checks 9, 10, 12 |
| 6: a `PracticeType` that is not one of the two is refused, code `practice_type` | F1.6 rule 4, F2.6 rule 5; F1 check 11 |
| 6: staffing amount from Award Practice Type, stamped only from the partner's `PracticeTypeConfirmed` (decision 82, superseding "partner's answer, else rep's pick"); a blank Award Practice Type gives no award, with no fallback to the type on the case or the rep's pick | F1.6 rules 2a and 9 (Referrals keeps the rep's pick, which never sets the amount); the amount itself is F4 |
| 7: staffing page shows the rep's pick as a hint line only and never preselects it (decision 82); the partner picks the type, saved with the case | F1.5, F1.6; site PR #136 |
| M23 | F1 checks 2, 7, 9, 10 |
| 9 F2: Qualified (`Yes`, `No`), Not Qualified Reason (`No permission to contact`, `Other`), Not Qualified Note (plain text) | F2.1, F2.2, F2.3; F2 check 1 |
| 6: Other needs a note of 1 to 300 characters | F2.3, F2.6 rules 4 and 7; F2 check 5 |
| 9 F2: Closed Reason gains `Not qualified` and `Already a customer` | F2.4; F2 check 1 |
| 9 F2 and 6: 7A returns the three values for HealthFirst and staffing cases; the note to the partner's own page only | F2.5; F2 check 2; F6.2 last line |
| 6: three new keys on the 7B save; missing or `""` leaves the column | F2.6 intro, F2.7 rule 1; F2 check 8 |
| 6: reason and note belong to a No; a Yes clears them | F2.7 rules 2 and 3; F2 check 19 |
| 6 and 9 F2: refuse No with no reason (`reason`), Other with no note (`note`) | F2.6 rules 6 and 7; F2 checks 4, 5 |
| 6: refuse a qualify answer on a staffing case with no practice type (`practice_type`) | F2.6 rule 5; F2 check 14 |
| 6, 7 and 9 F2: Signed refused unless reached Yes and Qualified Yes, this save or stored (`reload`); a case marked No refused | F2.6 rule 8; F2 checks 9, 10, 11, 12 |
| 6: old-page Signed refused, the page says "Reload this page to finish your update."; every other old-page save works | F2.6 rule 8 and "How 7B refuses"; F2 checks 8, 9, 11 |
| 6: refusal is HTTP 422 with a code; the site supplies the words; no flow text shown | "How 7B refuses"; refusal JSON; F2 checks 4, 5, 9, 14 to 17 |
| Rollout: no old-page refusal until `EnforceQualify` is on | F2.5b; "Build order" step 7; F2 checks 23, 24 |
| 6: one request at a time (trigger concurrency 1); a several-lead request is written whole or not at all | F2 "One request at a time" (the limit is not built, decision 136; a refused request still writes nothing); F2 checks 17a, 17c |
| 6: a refused save writes nothing, for any lead in that request | "How 7B refuses"; F2 check 17 |
| 6: `closed`, any partner save on a HealthFirst or staffing case no longer open to the partner (signed, handed back or closed), by 7A's test; Brian's SharePoint correction is not a 7B save | F2.6 rule 3, "BB2 records" item 8; F2 checks 15, 15a, 15b, 15c |
| 6: `bad_value`, values outside the choices, No with another Stand, Closed Reason `Not qualified` without No | F2.6 rule 4; F2 checks 5, 12, 16 |
| 6: a qualify answer or practice type can be saved on its own; stamps Last Partner Update and Partner Updated By; reminder schedule unchanged | F2.9 rules 1 to 5; F2 check 18 |
| 6: Qualified `No` is never standalone; it is always the full lost save, and a No with no Stand is refused `bad_value` | F2.6 rule 4, F2.9 intro, F2.10; F2 checks 6, 18a |
| 7A names the case's company (`company`, the Solutions value) so the page knows when to ask | F1.5a; F1 checks 8a, 8b |
| 7B decides the company from the stored case, never from the request | "Words used", F2.6 rule 1; F2 check 21a |
| 6: rules apply to HealthFirst and staffing cases only | F2.6 rule 1; F2 check 21 |
| 6: the Status Log records qualify and practice type changes, who and when, never the note | F2.8, F1.6 rule 7; F1 check 11a; F2 checks 3, 6, 7, 18 |
| 7: Signed needs a date and a product for every company, as today | F2.6 rule 8 last line; F2 check 13 |
| 6 and 9 F2: a not-qualified save takes the existing lost path; question 1 not required | F2.10, F2.7 rule 4; F2 check 6 |
| 6: lost path includes Pipeline Stage Lost (7B sets it on every not-qualified close) | F2.10; F2 checks 6a and 6b |
| 6: the note is never read as a status or shown to a rep or manager | F2.7 rule 5; F2 check 7; F6.2; F6 check 6 |
| 6: only HealthFirst and staffing cases have the question; every other partner as on `main`, apart from decision 104's untouched skip on field and FSC cases | F2.6 rules 1 and 1a, F2.5 rule 3; F2 checks 2, 21, 21d |
| 9 F2: Talked To Doctor field and answers do not change | F2 "what must not change" |
| 9 F2: no other partner's 7A or 7B behavior changes | F2 "what must not change"; F2 check 21 |
| 6: after the sign only Brian corrects, in SharePoint; status columns untouched | F2 "what must not change"; F2 check 20; F6 check 5 |
| 7: the question can be answered before or after question 1 | F2.6 (no order rule); F2 check 3 |
| 6: 7A loads only open cases | F2.5 rule 4; F2 checks 6, 15 |
| 6 (no permission, T4): no separate void, no flow reads free text | F2.7 rule 5 |
| S6 flow-side checks | F2 checks 2 to 19, 21 |
| M10, M11, M16, M18, M24 (flow side) | F2 checks 12; 20; 3 and 6; 15; 9 and 10 |
| M22 (practice type part) | F2 check 14 |
| 9 F6: `practiceType` on each staffing case in `list` and `team` | F6.2a, F6.3; F6 checks 11, 12 |
| 9 F6: `list` and `team` return each case's Solutions value where they do not already, as `solutions` | F6.1, F6.3; F6 check 1 |
| 9 F6 and 5: `qualified`, `notQualifiedReason`, `closedReason` per case, as stored | F6.2, F6.3; F6 checks 2 to 8 |
| 9 F6: `earnings` and the ledger rows in `team` return the ledger `Company` key on every row | F6.4; F6 checks 9, 10 |
| S4 flow side | F6 checks 2, 3, 7 |
| M12 (ledger part) | F6 check 9 |
| Every sheet: TEST rows only, no live sends, no new recipients, no secrets | "Rules for every step"; each sheet's last check |

## Conductor rulings (11/13)

The first draft of this file listed 16 questions (Q1 to Q16); later rounds added R1 to R5
and O1 and O2. The conductor ruled on all of them on 11/13, and the sheets above follow them:

| # | Ruling | Where |
|---|---|---|
| Q1 | 7A and 7B read and write Service Cases | "Words used", "Stale docs found" |
| Q2 | Add the two choices to the Closed Reason column 7B writes today; BB2 records which list | F2.4, "BB2 records" item 2 |
| Q3 | Not Qualified Note is Multiple lines of text, plain | F2.3 |
| Q4 | 1R refuses a staffing Rep app submit with a missing or wrong `practiceType` | F1.4 rule 2 |
| Q5 | 7B refuses a bad `PracticeType`, code `practice_type` | F1.6 rule 4, F2.6 rule 5 |
| Q6 | For Source "Rep app", 1R refuses a submit naming no company or more than one | F1.4 rule 1 |
| Q7 | 7A keys `qualified`, `notQualifiedReason`, `notQualifiedNote`; the note to the partner's own page only | F2.5 |
| Q8 | Refuse the whole request before writing anything | "How 7B refuses" |
| Q9 | HTTP 422, `{"error":"<code>"}` plus the lead `id`; the site supplies the words | "How 7B refuses", refusal JSON |
| Q10 | Reason and note written only on a No save; a Yes clears them; missing or `""` Qualified is unchanged | F2.7 |
| Q11 | Log qualify and practice type changes, never the note | F2.8, F1.6 rule 7 |
| Q12 | The key is `solutions` | F6.1 |
| Q13 | Add `practiceType` on each staffing line of `list` and `team` | F6.2a |
| Q14 | Refuse saves on a case closed `Already a customer` or `Not qualified`, code `closed`; then widened to every save (conductor, 11/13); BB2 records what 7B does on closed cases today | F2.6 rule 3, "BB2 records" item 4 |
| Q15 | Refuse, code `bad_value` | F2.6 rule 4 |
| Q16 | Do not assume the switch; check 6 runs both ways; BB2 records whether it is on (superseded for 6b by the P1 (stage) row below: Lost either way) | F2 check 6, "BB2 records" item 3 |
| R1 | The new 7B rules, `closed` included, apply to HealthFirst and staffing cases only; every other partner's save is as on `main`, apart from decision 104's untouched skip on field and FSC cases | F2.6 rules 1 and 1a |
| R2 | A reason or note sent beside a Yes or a blank Qualified is ignored, not refused | F2.7 rule 3; F2 check 19 |
| R3 | A No with Stand Not moving forward must carry Closed Reason `Not qualified`, else `bad_value` | F2.6 rule 4 |
| R4 | A standalone save stamps Last Partner Update and Partner Updated By, and leaves Missed Updates and Next Update Due alone | F2.9 rule 2; F2 check 18 |
| R5 | The spec on the branch and in the scratchpad now carries the widened `closed` rule and the standalone save | Read again 11/13; nothing in these sheets contradicts section 6 |
| O1, O2 | Settled by spec commit 00356d4: Qualified No is never standalone; the page sends the full lost save (Stand, Closed Reason `Not qualified`, stage, status, label, `StageFromAnswers`), so Pipeline Stage and the usual lost email happen as today; a No with no Stand is refused `bad_value` | F2.6 rule 4, F2.9, F2.10; F2 check 18a |
| P1 (order) | The S6 site slice (PR #116, the 422-aware route) live on production, switch `PARTNER_QUALIFY_ENABLED` off, is a prerequisite for the new 7B. Order: site slice, then 7B, then 7A, then the switch on; rollback the reverse, switch off first | "Build order" steps 3 to 6; top of F2's steps; F2 check 0; F2 rollback |
| P1 (Closed Reason) | One location, no migration: F2 writes the two new values where the live 7B writes Closed Reason today, F6 reads `closedReason` from the same place; if that is per doctor on Referrals, stop and ask | "BB2 records" item 2; F2.4; F6.2; F6 check 4a |
| P1 (practice type) | `PracticeType` counts only on a staffing case; on any other case it is ignored, and an update with nothing else is today's nothing to save update | F2.6 rule 4; "BB2 records" item 9; F2 check 21b |
| 8c505c3, 127464f | One request at a time, by a trigger concurrency limit of 1 only (the per-item conditional write was dropped: it could write lead A and then lose the race on lead B); a several-lead request is checked and written as a unit; the second request is judged against what the first wrote | F2 "One request at a time"; "BB2 records" items 10 and 11; F2 checks 17a, 17b, 17c |
| P1 (rollout) | 7B gets its own setting, `EnforceQualify`, a Boolean variable at the top of the flow, default off. Off: the new keys are stored and the not-qualified close works, but no refusal an old page could hit (`reload`, and `closed`, which a stale old tab can also hit); `reason`, `note`, `bad_value` and `practice_type` stay on. Order: site slice, 7B off, 7A, site switch on, `EnforceQualify` on; rollback the reverse, setting off first | F2.5b; F2.6 rules 3 and 8; "Build order" steps 4 to 7; F2 rollback; F2 checks 23, 24 |
| P1 (Status Log) | The practice type tail (F1) and the F2.8 parts are the only new kinds of Status Log part; the forced `Lost` on a not-qualified close also writes the existing stage-change line, as every stage change does; every other Status Log behavior is unchanged | F1 and F2 "what must not change"; F2.10; F2 checks 6, 17a |
| 108b556 | Award Practice Type: a Service Cases column 7B writes once on the first save with reached Yes and Qualified Yes, never changed; the note is in no email; site switch on and `EnforceQualify` on in one sitting, a sign in the gap corrected by Brian in SharePoint | F1.2a, F1.6 rule 9, F1 check 11b; F2.7 rule 5, F2 check 7a; "Build order" step 7 |
| P1 (Award column order) | Award Practice Type (F1.2a) is created in build order step 1 with the other columns, before any new 7B is tested or swapped in | "Build order" step 1; F1 check 1; F1 rollback |
| P1 (Award on a standalone save) | Award Practice Type is the one stated exception to "every other field unchanged" on a standalone save; any save that completes reached Yes and Qualified Yes on a staffing case stamps it (narrowed by decision 82: only a save that carries `PracticeTypeConfirmed`) | F2.9 rule 3; F1.6 rule 9; F1 check 11c; F2 check 18 |
| Decision 82 (Brian, 11/13) | Supersedes 108b556's "from the type on the case": 7B stamps Award Practice Type only from `PracticeTypeConfirmed`, the type the partner picked in that save, on a save that leaves reached Yes and Qualified Yes or a later save that confirms it while both are Yes; never from `PracticeType` or the stored type; a staffing Yes with no confirmation is accepted and never stamps; a bad or mismatched confirmation is refused `practice_type`; missing means unchanged; decision 84's hand fix stands | F1.6 rules 2a and 9; F2.6 rule 5; F2.9 rule 3; F1 checks 11b to 11g; F2 checks 18, 25 |
| P1 (Award in the gap) | A staffing case signed in the gap with Qualified blank: Brian sets Qualified Yes and Award Practice Type (the case's Practice Type then) together in SharePoint; F4 lists a Qualified Yes case with blank Award Practice Type and writes no award row | "Build order" step 7; F2 check 25; open items |
| P1 (queue time) | No request id this wave. Rollout gate: three simultaneous TEST saves, then a 100 update request (the route's cap) with two single saves, slowest under 20 seconds, or BB2 stops with the old 7B live; BB2 reports duplicate Status Log pairs | F2 "The answer must come back under the site's timeout"; F2 check 0a; "BB2 records" item 12; open items |
| P1 (stage) | 7B sets Pipeline Stage `Lost` itself on every not-qualified close, with or without `StageFromAnswers`, with the existing stage-change steps (dates and the `Stage: <old> to Lost` line); stage rule 1 still comes first; this replaces the Q16 "both ways" reading of check 6 | F2.10; F2 checks 6a, 6b |
| P1 (reason and note) | R2 stands: the reason choice check and the 300 character limit apply only when Qualified is `No`; beside a Yes or blank they are ignored, never refused, never stored | F2.6 rule 4; F2 check 19a |
| Later | `closed` covers every case no longer open to the partner (signed, handed back, closed), by 7A's test; Brian's SharePoint correction is not a 7B save | F2.6 rule 3; F2 checks 15a, 15b, 15c |

## Questions for the conductor

None open. Stop items ST1 to ST3 (from the step 1 facts, 11/13) were decided by Brian on
11/14 (decisions 100, 102, 104).

Open items for a later wave:

- **For sheet F4 (not written yet):** a staffing case with Qualified Yes and a blank Award
  Practice Type gets no award row and is listed in Brian's exceptions until he fills it.
  Since decision 82 this also covers a staffing case the partner qualified without
  confirming the practice type.

- A request id on each partner save that 7B dedupes, so a retry after a timeout never logs
  or emails twice, is a wave 2 candidate. It needs a site change as well as a 7B change.

- **Key check before the 7B queue**, a wave 2 candidate beside the request id. With the
  concurrency limit of 1, every post to 7B waits in the one line before 7B checks its key,
  so a caller with a made-up 40 hex key can take places in that line ahead of real
  partners. The only brake is the site's per address limit (20 saves per 10 minutes on each
  warm server, `src/lib/http.ts`). Power Automate applies the trigger's limit to the whole
  run, so 7B cannot check the key before the line. A fix needs a check in front of 7B: on
  the site, or in a small flow with no limit that checks the key and then calls 7B.

Also recorded: points where these sheets and the S6 site slice as merged to `main` (PR
#116) differ, read again 11/13 after merging `main`:

1. **The refusal body.** `docs/fsc-flow-contracts.md` ("Qualify question and practice
   type") gives `{"error": "<code>"}`. These sheets add the lead `id` (conductor ruling Q9).
   S6's `savePartnerUpdates` reads only `error` (`src/lib/partner-flow.ts` lines 636 to
   640), so the extra key is harmless; that doc could add it.
2. **A standalone save stamps the partner's action.** Settled: the merged doc now says 7B
   stamps Last Partner Update and Partner Updated By on it, as F2.9 rule 2 does.
3. **The site accepts more for `company`.** S6's `qualifyCompanyOf`
   (`src/lib/partner-qualify.mjs`) trims the value and also accepts the company key
   (`HealthFirst`, `Staffing`). 7A sends the Solutions value exactly (F1.5a), which the
   site accepts, so nothing breaks.
4. **The site's Signed check is stricter.** S6 refuses Signed unless the same save has
   question 1 `Yes` and `Qualified` `Yes`; 7B (F2.6 rule 8) also accepts either answer
   already stored. The page is stricter than the flow; the flow never refuses what the page
   sends.
5. **How 7A names the company.** Settled: the merged doc's 7A table points to F1.5a for
   `company`.

## Stale docs found

- `docs/partner-status-flow.md`, "HSBS 7A contract" step 3 and "HSBS 7B contract": says 7A
  reads Referrals items and 7B updates them. Since the 10/22 cutover the partner status is
  on Service Cases (`CLAUDE.md`; conductor ruling Q1). Not fixed here; for a separate PR.
- `src/lib/partner-flow.ts` line 164: the comment on `CLOSED_REASONS` says the column is on
  the Referrals list. Site code, out of scope for this file; for slice S6 or a separate PR.
