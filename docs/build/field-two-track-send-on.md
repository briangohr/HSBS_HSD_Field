# Field two-track app: build sheet F7, sending a handed-back lead on

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and the other team's exact list and column names are only in the old repo's copy.

Builder: BB2 (decision 91).

Checked against BB2 step 1 facts v2 (11/13): F7-0.1 to F7-0.12, F3-0.1, F3-0.3, F3-0.4,
F3-0.8, F3-0.9, F3-2N, R1, R4, and the v2 decision 97 checks. Results are in "Step 0
results"; the stop items they raise are S2 to S9.

**Brian's answers, 11/14 (decisions 100, 101, 103 and 105, `docs/claude-code/DECISIONS.md`).**
"Reuse 3F" (100), "Add a Test column" (101), "Yes, skip in all three" (103) and "Own Service
Case column" (105) close S3, S6 and S7, and close S2, S4 and S5 for a first row with Source
`Rep app`. Decision 112 closes S1 for 3F (sheet F3, Part U). S1 for HSBS 3, S8 and S9,
and S2, S4 and S5 for every other Source, still wait. Scope
(Brian, 11/14): field (`Rep app`) and FSC app rows only; nothing here changes the other team's path.

Written 11/13/2026 by Claude for BB2 (the builder bot) and for Brian, from the approved spec
"Field two-track app: team members and managers (v1)", `docs/build/field-two-track-spec.md`
(approved by Brian 11/13: "approve the spec"). Section numbers (4, 6, 9, 13) and check names
(M13, M21, M22) are that spec's. Sheets F1, F2 and F6 are in
`docs/build/field-two-track-flow-contracts.md`; this sheet uses its words and rules.

Later decisions this sheet follows (Brian, 11/13), recorded in
`docs/claude-code/DECISIONS.md` on `main`.

**Gate (met).** BB2 was to build nothing from this sheet, and Brian was not to use Parts B
and C, until PR #121 put decisions 75, 81 and 82 in `docs/claude-code/DECISIONS.md` on
`main`. PR #121 is merged, and the three decisions there read as cited below, so the gate is
met.

- **75** (Brian: "Matt Penny" and "Matt Penny for the payout list too"). Matt Penny at
  Direct Dental receives the staffing leads. His address is on the
  staffing Routing row in SharePoint and never in this repo or this sheet. A lead sent on to
  staffing goes to whoever that Routing row names, as any staffing intro does; this sheet
  adds no recipient.
- **81** (Brian: "Each person should match their roster so a position or rep is either FSC,
  AE, ES, RGM"). Each lead on the partner update page names the sender by their roster role
  (FSC, AE, ES, RGM, or the other team's label). A sent-on row copies the first row's sender columns for its
  Source (step B4), so the page names the original sender and their role, never Brian.
- **82** (Brian: "Yes, partner confirms it"). Before a staffing award is made, the partner confirms the practice type when
  answering "Does this lead qualify?", and 7B stamps Award Practice Type only from that
  confirmation. A lead sent on to staffing has no type, so the partner always picks one.

This is a build sheet. This repo never edits a flow. BB2 builds Part D in Power Automate and
SharePoint, on copies, and Brian follows Parts B and C by hand in SharePoint.

**Source decides pay (spec section 6 and section 13).** A sent-on row keeps the first row's
Source, copied as it stands and never changed. Only a first row whose Source is `Rep app`,
with a Referring Rep Email on the Rep Roster, makes a new row that can earn. A hand back that
came from a field page, the pilot FSC app or any other source makes a new row that earns
nothing for anyone. Brian never changes Source to make a row earn. Step B1 says this again.

**There is no repo copy of HSBS 2, 2B, 3 or 3F.** `flows/` on `main` holds only
`flows/README.md` (checked 11/13). The spec says this sheet is written after reading the live
2, 2B and 3F, which Claude cannot do. So Step 0 has BB2 read them (read only) and record the
facts every later step depends on. Each fact says what this sheet assumes. If the live flow
differs, BB2 stops, builds nothing, does not start Part B, and reports; the fact names the
smallest change Claude would then propose. A proposal is not built until Claude writes it as
a new version of this sheet and Brian approves it.

## Stop-and-ask items (decision 89)

Review findings left after round 3 that are carried as stop items rather than redesigned.
At each one BB2 stops, reports, and asks the conductor before going on.

| # | Where | Stop when |
|---|---|---|
| S1 | Fact 0.3 and step B6 | The live intro flow stamps its guard column before the send action succeeds (or whether it stamps after can't be confirmed). Then the guard is not proof of a send: B6 checks the send action's run history, and BB2 stops and asks before Part C resubmits any intro run. **Confirmed 11/13:** 3F and HSBS 3 both stamp Introduced On before the send (facts F3-0.3, F7-0.3). **Decided for 3F: decision 112** (Brian, 11/14: "yes"): 3F puts the stamp back when no intro went out (sheet F3, Part U). **Still open for HSBS 3** (the other team's path, BB1's flow), which still stamps before it sends. For a 3F intro the guard means "an intro went out or may have"; BB2 still stops and asks before Part C resubmits any intro run |

Added from BB2's step 1 facts (11/13). Each one is a stop for Brian, not the conductor.

| # | Where | Stop when |
|---|---|---|
| S2 | Fact 0.1; B6 step 1; Part C step 3; proposals P1 to P3 | No flow makes a Service Case for a row added by hand (fact F7-0.1). 1R and 1W make none; 2B makes none; 3F makes one only for Source `FSC app` with Route `Direct to partner`; HSBS 3 only when Status is already `Introduced to Solution Company`. Neither copies Test or writes Pipeline Stage `Received`: they write Status `Sent` or `Held` and Stage `New lead`. **Decided for a `Rep app` first row: decision 100.** The new 3F (sheet F3, B0b) starts on a created `Rep app` row with Route `Direct to partner` (B4 step 2b) and makes the case after its intro, copying Test (decision 101). **Still open for every other Source:** fact 0.1's rule points to P1, P2 or P3; Brian picks before Part B is used for one |
| S3 | Fact 0.3; Part B for a first row with Source `Rep app` | No flow sent an intro for a `Rep app` row (facts F3-0.1, F7-0.3). **Decided: decision 100.** Once sheet F3's new 3F (with B0b) and Part S are live, 3F sends it and guards on Introduced On (stop item S1 still applies to that guard) |
| S4 | Fact 0.5; B4 | The intro flows' conditions read columns B4 leaves blank (fact F7-0.5): 3F needs Route `Direct to partner` and Introduced On empty; HSBS 3 needs Status `Introduced to Solution Company`, Partner, the permission column, the other team's email column and Introduced On empty; 2B needs Partner empty and an other-team email column. **Decided for a `Rep app` first row: decision 100** ("the partner always calls first"): B4 step 2b sets Route `Direct to partner`, and Introduced On stays blank. **Still open for every other Source:** adding columns to B4 is a sheet change with Brian's OK |
| S5 | Fact 0.6; checks 10, 14, 20, 20a | HSBS 2, 2B and 3 skip Test = Yes rows and practice names containing `test` (fact F7-0.6), so a TEST sent-on row that relies on HSBS 3 gets no case and no intro, and its words cannot be read. **Closed for a `Rep app` first row by decision 100:** 3F handles it, reads the row's Test (decision 97) and sends a Test row only to its test path, where BB2 reads it. **Still open for any Source that relies on HSBS 3:** fact 0.6's rule needs a flow change for HSBS 3, not decided |
| S6 | B6 step 1; Part C step 2; D3 step 3; checks 9 and 12 | Service Cases had no Test column (v2 check 5). **Decided: decision 101** ("Add a Test column"). Build: sheet F3, Part T adds it, and 3F copies the row's Test onto each field or FSC case it makes. A case HSBS 3 makes (the other team's path) carries the column default, No |
| S7 | Fact 0.9; D3 step 4; Part D | The hand-back note is in the shared update column on the **Referrals row**, shared by two companies, and every later 7B save on that doctor rewrites it (facts F7-0.9, R4). **Decided: decision 105** ("Own Service Case column"). Build: proposal P4, built in sheet F2, F2.11: for a field or FSC case 7B writes the note to Hand Back Note on that company's Service Case, never overwritten. A other-team case keeps today's the shared update column only |
| S8 | Fact 0.10; Part D | There is no daily exceptions email with a hand-back part (fact F7-0.10). The one daily flow to Brian, "HSBS Daily gap check (TEST)", is On at 6:00 PM Eastern with one To and no CC or BCC, and lists only today's `FSC app` Referrals rows and their integrity flags. Part D waits; Brian picks the gap check or sheet F4's exceptions email |
| S9 | Fact 0.4; B2, B4 step 4; check 10 | Neither intro reads the consent column (fact F7-0.4): 3F reads the permission column, and HSBS 3 reads Contact Instructions. So Brian's consent line in `Consenttext` would not reach the partner, and check 10 cannot pass. Fact 0.4's rule needs a column the intro reads; there is none for consent. Stop and ask Brian. On the test path 3F's the extra notice step subject also has no `[TEST]` (v2 check 3); BB2 records it when reading a TEST intro |

## Pre-build checks (read only)

- **PB1 (before Part B).** List read of the Referrals Source choices (fact F7-0.3), and of
  Title: whether it is required or unique, and what Brian types for a row he adds by hand
  (fact F7-0.11). 1R and 1W set Title themselves (`HSBS-A` plus the item ID, `HSBS-W` plus a
  time); no flow titles a hand-added row, so if Title is required, fact 0.11's own stop
  holds.
- **PB2 (before Part B).** List read of the Referrals columns in fact 0.12, with internal
  names: `JDEAccount` (no column named Account Number was found), `Consenttext`, the permission column
  (the permission column in 3F), Referring Rep and Referring Rep Email, and whether
  Practice Type exists yet (facts F3-0.8, F7-0.12).
- **PB3 (before Part B).** Export HSBS 4 (status update to the other team), HSBS 6 (Partner handback
  intake) and HSBS 7 (Partner page), and record whether each fires on a created or modified
  Referrals row and what it sends (facts F7-0.5, F7-0.7).
- **PB4 (before D1a).** Export HSBS 7D (Monday overdue, cases) and HSBS 8 (Doctor roll-up,
  FSC copy), plus HSBS 4 and HSBS 7 if they fire on a Service Case edit, and record what
  each does on an edit that changes only Hand Back Sorted, and whether any reads Modified
  (fact F7-0.8).
- **PB5 (before Part B).** Export the 1R the rep app reaches (sheets F1, F2 and F6, PB1),
  and record the needs line it writes in Note and its Source value. The FSC copy writes
  `Details for the specialist: ` before the notes and Source `FSC app` or the other team's app Source value only
  (fact F7-0.11).

## Who does what

| Who | Does |
|---|---|
| BB2 | Step 0 (read and record), Part D (the Hand Back Sorted column and the hand-back list in Brian's daily exceptions), the TEST checks, and the resubmits in Part C on TEST rows |
| Brian | Parts B and C for each lead he sends on, by hand in SharePoint, and the resubmits in Part C on a live row |
| Anyone else | Nothing. Only Brian can send a lead on; no partner, rep or manager can (spec section 6) |

## Rules for every step

1. **TEST rows only while testing.** Until Brian says the two-track build is live, Parts B and
   C are used only on a first row whose Test is Yes. A TEST row has TEST in the practice name
   and a made-up contact (decision 48 lets BB2 make these and delete them after).
2. **A TEST row never sends a live intro.** The new row's Test is copied from the first row
   and is the first field filled (step B4). It is in the row's first saved version, never
   added by a later edit.
3. **No live sends while testing.** No email to a real partner, rep, manager or other-team sender. A TEST
   row's mail goes only where today's TEST rule sends it (Step 0, fact 0.6).
4. **No new email recipients.** This sheet adds none. The hand-back list goes in an email that
   already goes to Brian only (fact 0.10).
5. **No secrets** in this sheet, a build report, a Note, a consent line, a Status Log line or
   a commit: no flow URL, key, link key, token, password, phone number or email address.
6. **One sent-on row per first row and destination, ever.** Every run of Part B starts with
   the lookup in B1, and Part C finishes a row that exists. Nobody adds a second row.
7. **Never edit the first Referrals row,** and never edit the new row after its one save.
   Never use grid view (Edit in grid view, Quick edit) or paste rows on Referrals or Service
   Cases for this work: grid view saves each cell as it is typed, so a row could exist with
   Solutions set before Test is.
8. Escape `'` as `''` in every Filter Query, as today.

## Words used in this sheet

- **The two companies** (spec section 4). Part B sends a lead on only between these two:

  | Company key | Solutions value (exactly) | Name on screens | Need for that company | Words for [service] in the consent line |
  |---|---|---|---|---|
  | `HealthFirst` | `HealthFirst` | HealthFirst | `OSHA and HIPAA compliance` | OSHA and HIPAA compliance |
  | `Staffing` | `HS Staffing / Recruiting Services (including GoTu)` | Direct Dental | `Staffing` | staffing |

  The need is the destination's, never the first row's (spec section 6). The staffing
  service word is the one the staffing form's permission box uses ("about staffing").
- **Handed back:** a Service Case whose Partner Status is `Hand back to HSBS` or the old
  stored value `Returned to HSBS` (`docs/fsc-flow-contracts.md`: both count as handed back).
- **First case:** the handed-back Service Case. **First row:** its Referrals row.
- **Destination:** the other of the two companies.
- **New row:** the Referrals row Brian adds for the destination. **New case:** its Service Case.
- **[ID]:** the first row's SharePoint ID column (a number), which is never blank, never
  reused and never changes. The Note line is exactly `Sent on from referral [ID]`, for example
  `Sent on from referral 1234`, alone on its line.
- **Brian's consent line** (spec section 6, word for word):
  `[Name] agreed on [date], by [phone or email], that [partner] may contact them about [service]. Recorded by Brian Gohr.`
  [Name] is the customer's name, [date] the day they gave the OK, [phone or email] the word
  `phone` or `email` for how they gave it (never the number or the address), [partner]
  `Direct Dental` or `HealthFirst`, and [service] from the table above.

---

## Step 0: BB2 reads the live flows and records the facts (read only)

Read the live HSBS 1R, 1W, 2, 2B, 3, 3F, 7A and 7B (no flow named 2N exists among the 48
HSBS flows, fact F3-2N), every other flow whose trigger is a
created or modified item on Referrals or Service Cases, and the flow that sends Brian's daily
exceptions email. Change nothing. Write each fact below in the build report, with the flow
and step it came from. Use one TEST rep app row made by 1R (one HealthFirst, one staffing)
and its run history where a fact needs an example.

**The two repo hints, checked 11/13.** `docs/fsc-flow-contracts.md` says 1R makes the
Service Case in its own run, starting at `Received`. It does not: 1R makes no case, and 3F
or HSBS 3 makes it after the intro, at Status `Sent` or `Held` and Stage `New lead` (facts
R1, F7-0.1). The old repo's page-lead contract asks whether 2B and 3 fire when Solutions is set
on an existing item: 2B fires on created items only; 3F and HSBS 3 fire on created or
modified items (fact F7-0.7). Either way a row added by hand gets no case and no intro
unless it meets 3F's or HSBS 3's conditions (stop items S2 to S4).

| # | Fact | This sheet assumes | If the live flow differs: BB2 stops and reports. The smallest change Claude would propose |
|---|---|---|---|
| 0.1 | What makes a Service Case for a new Referrals row | A Referrals row added by hand in SharePoint (the New form, one save) with one company in Solutions gets exactly one Service Case for that company, made by a flow that fires on a created Referrals row, with Test copied from the row and Pipeline Stage `Received`. Record the flow, its trigger (in 1R's own run, on created, or on created or modified), its trigger conditions and every Service Cases column it fills | Proposal P1, or P2 if P1 cannot work, or P3 if the flow fires only on an edit (see "Proposals" below) |
| 0.2 | A second case is never made | The step that makes the case first looks for a case for the same row and company and makes none if one exists, so resubmitting a failed run (Part C) cannot make two | Add that lookup before the create: Get items on Service Cases, filtered on the row and the company, Top Count 1; create only when none is found. Until then Part C never resubmits a case run; it stops and reports |
| 0.3 | What sends the intro, and what stops a second one | For Source `Rep app`, 3F sends one intro to the destination's Routing contact (for staffing, the contact decision 75 put on Routing) for a created row (or its created case), not only inside 1R's run, and, only after the send action succeeds, stamps a column (for example Introduced On or Last Notified Status) that stops a second intro (record which comes first; stop item S1), so a resubmit or a later run sends nothing more. For every other Source that B4 accepts, which is every value on the Referrals Source choice list (at least `FSC app`, the other team's app Source value, the other team's page Source value for a field or other-team page lead written by 1W, and `Compliance page`), the flow that sends that Source's intro today does the same. Record, for each Source on the choice list, the flow, trigger, conditions and guard column. B6 and Part C use the guard recorded for the new row's Source | A Source with no intro flow or no guard: Part B is not used for a first row with that Source, and BB2 reports it. No guard: add one (send only when the guard column is blank, then stamp it); until then Part C never resubmits an intro run. No intro for a hand-made row: P1 or P2 |
| 0.4 | What the intro reads | The intro reads, from the Referrals row: the consent from Consent text, the phone from Customer Phone, the preferred contact from Preferred Contact, the JDE from Account Number, the need from the needs line in Note, and the referrer from Referring Rep. Record the source of each | A value read from another column: Brian also fills that column in B4 (a sheet change). A value read from somewhere Brian cannot fill (a 1R run variable or the roster): P2 |
| 0.5 | Which columns decide whether, and what, a flow sends | The trigger and branch conditions of every flow that fires on a created Referrals row (2, 2B, 3, 3F and any other) read only columns Brian fills in B4. Record every column each condition reads, and what HSBS 2 and HSBS 3 send for an other-team page Source value row whose other-team columns are filled (step B4 2a) | A condition reads a column B4 leaves blank (for example Route, Lead Type, Help area, Contact Instructions, Submission ID, Campaign, an other-team sender or FSC column step 2a does not copy, Introduced On, Last Notified Status) and the blank changes whether or what it sends: add that column to B4 with the value 1R (or 1W, for the other team's page Source value) writes for that Source. A sheet change, with Brian's OK |
| 0.6 | Test rows | Each flow in 0.1 to 0.5 still makes the case for a Test = Yes row and runs as for any row, but sends its mail only to the TEST inbox the flows already use, never to a real partner, rep, manager or other-team sender. The TEST intro can be read in full, words included, in the flow's run history or in the TEST partner mailbox BB2 controls. Record each flow's Test rule and where BB2 reads the TEST intro | A flow that could mail a real person for a Test row: nothing in Part B is tried; add the Test rule sheet F5 already asks of 3F and 7B. A Test row's intro skipped before its words are written, so they cannot be read: the flow writes the TEST intro and sends it only to the TEST inbox |
| 0.7 | Flows that fire on an edited Referrals row | Parts B and C never edit a Referrals row after its one save, so an edit sends nothing because none is made. Record which flows fire on a modified Referrals item and what each would send. This fact alone stops nothing | A flow that 0.1 or 0.3 needs fires only on an edit (for example 2B only when Solutions changes on an existing item): P3 |
| 0.8 | Flows that fire on an edited Service Case | Marking Hand Back Sorted (one column, on a closed case) sends no email and writes, changes or voids no ledger row. Any flow that fires on a Service Case edit (7D, HSBS 8, HSBS 10 when built, others) finds nothing to do on a handed-back case. Record each such flow and what it does on that edit. The same for the one-time backfill (D1a), which edits every Service Case, open ones included: an edit that changes only Hand Back Sorted, on any case, sends no email and writes nothing else. Record also whether any flow or report reads Modified on Service Cases | Add a trigger condition to that flow so it skips a case whose Partner Status is `Hand back to HSBS` or `Returned to HSBS`. If the backfill would make any flow send or write on an open case, D1a stops before it starts; Claude proposes, for Brian's OK, a trigger condition on that flow or running D1a while that flow is off for the minutes it takes |
| 0.9 | The column that holds the hand-back note today | On a hand back save, 7B writes `<partner>: <label>. <note>` to **the shared update column on the Service Case** (`docs/partner-status-flow.md`, "HSBS 7B contract", step 3), with the note as the partner typed it, and no save or flow writes the shared update column on that case after the hand back. Record the list and column the hand back save writes the note to, every flow that writes the shared update column, and what today's 7B does with a later save on a `Held` case (the same as sheet F2's "BB2 records" item 4) | The note is on Referrals (one row per doctor, shared by two companies), or in no single column, or a later save or flow can overwrite it: proposal P4 |
| 0.10 | Brian's daily exceptions email | One scheduled flow sends Brian a daily exceptions email, to Brian only, and it lists hand backs today (rep app spec v3, "Exceptions Brian sees in one daily email"). Record the flow, its schedule, its recipients, and how it finds hand backs | No daily email to Brian, or none with a hand-back part: Part D waits. Claude proposes adding the hand-back list to the daily email that does go to Brian only (the gap check), or building it into sheet F4's exceptions email; Brian picks |
| 0.11 | What 1R writes on a new row, and how any new row gets its Title | From the TEST 1R rows: the Title 1R writes, the Status value (assumed `Received`), the exact needs line in Note (the words around the need and the line breaks), the Source choice values, and whether Title is required or unique. Also how the Title of any new Referrals row is set: by a flow on create, by a column default, or typed by a person, and what Brian types for a Referrals row he adds by hand today. No flow reads Title's prefix or the Status to decide anything B4 does not cover | The need is in a column, not in Note, or a flow reads Title's prefix: B4 follows what 1R writes. A sheet change. No flow sets the Title and there is no way Brian titles a hand-added row today: stop; Claude asks Brian, and this sheet sets no format of its own |
| 0.12 | Referrals column names | Referrals has these columns, under these names: Title, Test, Practice Name, Customer Name, Customer Phone, Doctor Email, Preferred Contact, Account Number, Referring Rep, Referring Rep Email, Referring FSC, Referring FSC Email, the other team's name column, the other team's email column, the other team's slug column, Source, Solutions, Consent text, the permission column, Note, Status, Practice Type (sheet F1). Record any name that differs | A column is missing: stop. A name differs: record it; this sheet means that column |

### Step 0 results (BB2 step 1 facts v2, 11/13)

Facts 0.1, 0.3, 0.4, 0.6, 0.9 and 0.10 differ, so under this sheet's own rule BB2 builds
nothing and Part B is not used. The stops are S1 to S9 above; Brian's 11/14 answers
(decisions 100, 101, 103, 105) close some of them, as the stop table says.

| # | Result | What it means here |
|---|---|---|
| 0.1 | Differs (F7-0.1). No flow makes a case for a created row. 3F makes one after its intro, only for Source `FSC app` with Route `Direct to partner`; HSBS 3 after its intro when Status is already `Introduced to Solution Company`. Neither copies Test or writes Pipeline Stage `Received`; they write Status `Sent` or `Held` and Stage `New lead` | Stop item S2 |
| 0.2 | Differs (F7-0.2). Neither 3F nor HSBS 3 looks for an existing case for the same referral and company before creating one. Introduced On, stamped first, usually stops a second run | As this fact's rule says: Part C never resubmits a case run; it stops and reports |
| 0.3 | Differs (F7-0.3). FSC app with Direct to partner: 3F. Other Sources that reach Status `Introduced to Solution Company` with Partner filled (a 1W the other team's page Source value row after 2B, possibly a `Rep app` row): HSBS 3. Both guard on Introduced On, stamped before the send. No intro for `Rep app` or `Compliance page` without the HSBS 3 stamps | Stop items S1, S3; PB1 for the Source choices |
| 0.4 | Differs (F7-0.4). 3F reads the permission column (not the consent column), Doctor Cell then Customer Phone, Preferred Contact, `JDEAccount`, Note, Referring FSC (not Referring Rep), and practice, title, other-team and customer fields. HSBS 3 reads Contact Instructions, the other team's name column and the other team's email column as the referrer, `JDEAccount`, Customer Phone, Note and practice and customer fields; not the consent column, Preferred Contact or Referring Rep | Stop item S9. B4 now names `JDEAccount` and `Consenttext` |
| 0.5 | Recorded (F7-0.5). HSBS 2 (created): Referral Source, Test, PracticeName, Source. 2B (created): the permission column, Partner, Solutions, Test, PracticeName, the other team's email column. 3F (created or modified): Source, Route, Introduced On, SystemEditAt, Modified. HSBS 3 (created or modified): Status, the permission column, Last Notified Status, Partner, Introduced On, Referral Source, Test, PracticeName, the other team's email column, SystemEditAt, Modified, Source. For an other-team page Source value row with other-team columns filled: 2 sends the other-team sender a receipt unless Test, Salesforce or Partner handback; 2B may set Partner and Status; 3 then sends the intro and the extra notice step | Stop item S4; PB3 for HSBS 6 |
| 0.6 | Differs (F7-0.6); 3F part fixed 11/13 by decision 97. 3F now reads the row's Test and sends a Test row only to its test path (Brian, no CC, intro subject `[TEST]`, the extra notice step subject without it). HSBS 2, 2B and 3 skip Test rows and send nothing. 1R (FSC copy) sets Referrals Test from a practice or doctor name starting `TEST`, not from a roster Test column | Stop items S5, S6 |
| 0.7 | Pending (F7-0.7). 3F and HSBS 3 fire on modified Referrals items; 2 and 2B only on created; 7B writes the Referrals row (Status, the shared update column and related columns) after a save; 2B does not fire when Solutions changes on an existing row | PB3 |
| 0.8 | Pending (F7-0.8). No exported flow has a Service Case trigger; 7B writes Service Cases | PB4 before D1a |
| 0.9 | Differs (F7-0.9). 7B writes the note to the shared update column on the Referrals row, on every save; the case gets a Status Log line. A later save on a `Held` case is still saved (R4) | Stop item S7 |
| 0.10 | Differs (F7-0.10). The only daily flow to Brian is "HSBS Daily gap check (TEST)", Referrals integrity for `FSC app` rows only, no hand backs | Stop item S8 |
| 0.11 | Matches (F7-0.11). 1R writes Title `HSBS-A pending` and then `HSBS-A` plus the item ID, Status `Received`, Note `Details for the specialist: ` plus the notes and optional lines, Source `FSC app` or the other team's app Source value. 1W writes Title `HSBS-W` plus a time, Status `Received`, Source the other team's page Source value, Test and `Consenttext` from the body | PB1 for Title; PB5 for the rep app 1R |
| 0.12 | Pending (F7-0.12). JDE is `JDEAccount`, consent is `Consenttext`, Practice Type is not used yet | PB2 |

### Proposals (named here, not built)

- **P1. Brian adds the case by hand too.** Only if 0.3 shows the intro fires for a case or row
  made by hand. Right after B5, in the Service Cases New form (never grid view), the columns
  3F and HSBS 3 fill when they make a case (fact F3-0.5: Title, Referral link, Owner,
  Receiver name and email, `Service`, Status, Dispatch, Stage `New lead`), with Practice
  Type blank. Service Cases has no Test column (stop item S6). A sheet change, no flow
  change.
- **P2. A small new flow that Brian runs.** If the case or the intro happens only inside 1R's
  run. A new instant flow, "HSBS 1S Send on", run by hand from Brian's login, with three
  inputs: the first row's ID, the destination company key and Brian's consent line. It
  refuses an empty or incomplete consent line, does B1's lookup and answers with the found
  row if there is one, else creates the new row with B4's values (Test in the same create),
  then the case and the intro with the steps 3F uses (1R's Partner route makes neither,
  fact F7-0.1). It adds no recipient.
  A new flow, not an edit to 1R, and it needs its own sheet and Brian's OK.
- **P3. Two saves.** If a needed flow fires only on an edit. B5 saves the row with every B4
  value except Solutions; then Brian edits only Solutions, once. Test is in the first save,
  so no live intro can go out for a TEST row. A sheet change; that one edit would be the only
  exception to rule 7.
- **P4. A note column of its own. Decided 11/14: decision 105; built in sheet F2, F2.11,
  for field and FSC cases only.** 7B also writes the typed `Note`, exactly as sent, to a new
  Service Cases column, Hand Back Note (Multiple lines of text, plain), on a hand back save
  only and on no other save. Part D reads that column. A 7B change, built after sheet F2's 7B
  with its own TEST checks.

---

## Part A: what exists today (Step 0 recorded it 11/13)

- **1R** writes one Referrals row and **no Service Case** (facts R1, F7-0.1), and answers
  200 only after the row exists. It writes the `needs` words into Note, not a column (the
  FSC copy starts the line `Details for the specialist: `, fact F7-0.11). The case is made
  after the intro by 3F or HSBS 3 (Part A, next bullet). Whether the 1R the rep app reaches
  writes Referring Rep and Referring Rep Email from the Rep Roster is PB5.
- **On a `Rep app` row.** The rep app spec v3 says HSBS 2 and HSBS 3 skip it, 2B copies
  Solutions, 2N never fires, and 3F sends the intro and the rep's receipt. **That is not
  what runs:** 3F starts only on Source `FSC app` with Route `Direct to partner`; HSBS 2, 2B
  and 3 have no `Rep app` skip; no flow named 2N exists; no flow sends a rep app intro or a
  rep receipt (facts F3-0.1, F3-0.4, F3-0.9, F3-2N; stop item S3).
- **Where cases and intros come from today:** 3F for Source `FSC app` with Route `Direct to
  partner`, and HSBS 3 for any other Source once Status is `Introduced to Solution Company`
  with Partner, the permission column and an other-team email column (2B may set those on a new row). Each stamps
  Introduced On on the Referrals row before its send, then sends, then makes one Service
  Case (`Service`, Status `Sent` or `Held`, Stage `New lead`, no Test) (facts F3-0.3,
  F3-0.5, F7-0.3).
- **A field page lead** comes through 1W with Source the other team's page Source value, Solutions set on create, and
  while on test, the other team's name column, the other team's email column and the other team's slug column blank (the old repo's page-lead contract).
- **Why a new row and not an edit to the first row:** HSBS 3 sends per Referrals row, so a
  second company added to an existing row gets no intro (`docs/fsc-flow-contracts.md`, the
  HSBS 9 paragraph), and spec section 4 keeps one company per referral.
- **A hand back** (7B choice `handback`): Partner Status `Hand back to HSBS`, Status `Held`,
  Next Update Due cleared, Pipeline Stage `Handed back`; 7A no longer lists the case, and
  once sheet F2's `EnforceQualify` is on, 7B refuses any later save on a HealthFirst or
  staffing case (`closed`). Today 7B saves a later save on a handed-back or `Held` case
  (fact R4). The partner's note goes to the shared update column on the **Referrals row**, as
  `<partner> (<Service>): <label or status>. <note>`, rewritten on every later save for
  that doctor, and the case gets a Status Log line (fact F7-0.9; stop item S7).
- **Hand Back Sorted** does not exist yet. Part D adds it.

---

## Part B: Brian's steps to send a lead on

Do these in order, in one sitting where you can. Stop wherever a step says stop.

**B1. Look up first, and read the Source.**

1. Open the first case (the handed-back Service Case). Its Partner Status must be
   `Hand back to HSBS` or `Returned to HSBS`, and its company must be HealthFirst or staffing.
   If not, stop: this sheet does not apply.
2. Open the first row. Write down its ID, Title, Test, Source, Solutions, `JDEAccount` and
   Practice Name. While testing, if Test is not Yes, stop (rule 1).
3. The destination is the other company. If the first row's Solutions already names the
   destination, stop: that partner already has its own case and intro for this lead, and
   this sheet does not apply.
4. **The lookup.** It must work past 5,000 rows, so the indexed, selective column goes first
   (Part D step D2 indexes `JDEAccount` and Practice Name on Referrals before Part B is
   used). On Referrals, filter first on `JDEAccount` equal to the first row's (when the
   first row has no `JDEAccount`, Practice Name equal to the first row's, exactly). Then
   narrow those rows to the ones whose Solutions holds the destination's Solutions value.
   Open each row left and read its Note.

   **A first row with neither a `JDEAccount` nor a Practice Name** is looked up by the
   Note line itself, which is unique because [ID] is. Note is multi-line text and cannot be
   indexed, so Brian asks BB2, who runs the lookup read only, in ID windows: a sent-on row is
   always added after the first row, so the windows run from [ID] + 1 to the highest ID on
   Referrals (`ID ge N and ID lt N+5000`, Top Count 5000 on each Get items, ID being the
   indexed column that leads), and BB2 reads each row's Note for a line that is exactly
   `Sent on from referral [ID]`. The same three outcomes follow.
   - One row whose Note has a line that is exactly `Sent on from referral [ID]`: that row was
     already sent on. Go to Part C with it. Never add a second row.
   - More than one such row: stop, touch none of them, and tell BB2, who reports it.
   - None: go on to B1 step 5.
5. **Read the Source.** Source decides pay. `Rep app`, with a Referring Rep Email that is on
   the Rep Roster: the new row can earn under the destination's rules. Anything else: the new
   row keeps that Source and earns nothing for anyone. Go on either way; never change Source.

**B2. Get the customer's OK for the destination, and write the consent line.**

1. Ask the customer whether the destination partner (Direct Dental or HealthFirst) may contact
   them about that service. The first row's consent named only the first partner and does
   not cover this.
2. **No OK: stop.** Add no row. Go to B7 when you have dealt with the hand back.
3. With the OK, write Brian's consent line (see "Words used"). Every bracket is filled in and
   nothing is blank. If any part is missing, stop and add no row.

**B3. Open the Referrals list and choose New** (the full new item form). Never grid view,
Quick edit or a paste (rule 7).

**B4. Fill in the form in this order. Do not save until every line is done.**

1. **Test:** the same as the first row. A TEST first row means Yes. Look at it a second time.
2. **Copy each of these from the first row exactly as it stands,** never changed and never
   tidied (spec section 6). A column blank on the first row stays blank.

   | Column | Note |
   |---|---|
   | Practice Name | |
   | Customer Name | the contact name |
   | Customer Phone | |
   | Doctor Email | |
   | Preferred Contact | |
   | `JDEAccount` | the JDE, as text, leading zeros kept |
   | Referring Rep | |
   | Referring Rep Email | Track finds a rep's rows by it |
   | Source | never changed (B1 step 5) |

   Customer Email is not copied: it is not on the spec's list (see "Ask Brian").

2a. **The sender, by the first row's Source** (decision 81: the partner page names the
   original sender by roster role, never Brian). Copy these as they stand too, and no other
   person's columns:

   | First row's Source | Also copy |
   |---|---|
   | `Rep app` | nothing more (Referring Rep and Referring Rep Email are in step 2) |
   | `FSC app` | Referring FSC, Referring FSC Email (not the other-team sender columns, which name the FSC's other-team pair) |
   | the other team's page Source value or the other team's app Source value (a field page lead, an other-team page lead, or an other-team sender's own referral) | the other team's name column, the other team's email column, the other team's slug column, and the `Referred by:` line in Note when the first row has one (step 6) |
   | any other Source (for example `Compliance page`) | nothing more. A Source with no sender columns is copied as it is: Source kept, no sender column copied, and the new row earns nothing |

   On a TEST field page row the other-team sender columns are blank (the old repo's page-lead contract), so the
   copied `Referred by: <name>, <role> (<slug>)` line is where the sender is held; copy it
   exactly. On a live field page row the other-team sender columns name the field person, and HSBS 2 may
   send them a receipt for the new row as it does for any of their page leads (fact 0.5
   records it; it is not a new kind of recipient).

   Whatever the Source, the new row's intro is the one fact 0.3 recorded for that Source,
   and B6 and Part C use that Source's guard column.

2b. **Route, for a `Rep app` first row only** (decision 100, Brian 11/14: "Reuse 3F"; the
   partner always calls first): `Direct to partner`. It is what starts sheet F3's new 3F on
   the new row. For any other Source, leave Route blank (stop item S4).
3. **Solutions:** the destination's Solutions value only, exactly as in "Words used". One
   company.
4. **Consent (`Consenttext`):** Brian's consent line from B2, exactly. Never the first row's consent.
5. **the permission column:** Yes. The customer gave Brian the OK, and 2B needs this column
   (the old repo's other-team app contract).
6. **Note:** these lines and nothing else. First, the needs line exactly as 1R writes it
   (fact 0.11), with the destination's need: `Staffing` for Direct Dental,
   `OSHA and HIPAA compliance` for HealthFirst, never the first row's need. Second, only when
   step 2a says so, the first row's `Referred by:` line, copied exactly. Last,
   `Sent on from referral [ID]`.
7. **Status:** `Received` (or the value fact 0.11 recorded).
8. **Title:** whatever fact 0.11 recorded for any new Referrals row. If a flow or a column
   default sets it, leave it as the form shows. If a person must type one, type what Brian
   types for any Referrals row he adds by hand, as fact 0.11 recorded. This sheet sets no
   Title format of its own.
9. **Leave every other column blank,** Practice Type included: a lead sent on to staffing has
   no practice type from the rep, and the staffing partner sets one before it can answer the
   qualify question (spec section 6). Introduced On and Last Notified Status stay blank.

**B5. Check, then save once.** Before Save, look again at Test (the first row's value),
Solutions (one company, the destination), `Consenttext` (Brian's line, not empty) and Note
(the `Sent on from referral [ID]` line). If `Consenttext` is empty, close the form without
saving: no row, no intro. Otherwise save once, and write down the new row's ID.

**B6. Check it went through** (allow 15 minutes; the rep app's intro target is 5).

1. The new row has exactly one Service Case, for the destination, with the same Test value.
   (Service Cases gets its Test column from sheet F3, Part T, decision 101; 3F copies the
   row's Test onto the case.)
2. The intro went out once: the guard column fact 0.3 recorded for the new row's Source is
   set, which counts as proof only where fact 0.3 confirms the flow stamps it after a
   successful send (stop item S1). Otherwise, before B7, BB2 reads that flow's run history
   and confirms its send action succeeded once for this row. For a TEST row, BB2 reads the
   TEST intro where fact 0.6 says.
3. If either is not true after 15 minutes, do not edit, re-save, delete or re-add the row. Go
   to Part C.

**B7. Mark the first case sorted.** When the hand back is dealt with (B6 passed, or Brian
decided not to send it on), open the first case (the Service Case, not the Referrals row),
Edit, set **Hand Back Sorted** to Yes, change nothing else, and save. The case keeps its
handed-back status and its note; only the daily list drops it (spec section 6).

---

## Part C: finishing a row that was already sent on

Brian comes here from B1 step 4 (the lookup found the row) or from B6 step 3.

1. **Add no row,** and do not edit, re-save, delete or re-add the found row to start a flow
   again.
2. **Read the found row.** Test is the first row's value, Solutions is the destination only,
   `Consenttext` is a complete consent line, and Note has the `Sent on from referral [ID]`
   line. If any is wrong, stop and tell BB2, who reports it. Nothing else is done.
3. **Its case.**
   - Exactly one case for the destination: go to step 4.
   - More than one: stop and report. Touch none.
   - None: open the run history of the flow that makes cases (fact 0.1) for this row. If a
     run for it failed or was cancelled, and fact 0.2 holds, resubmit that one run, once
     (BB2 on a TEST row, Brian on a live row). Otherwise stop and report.
4. **Its intro.**
   - The guard column fact 0.3 recorded for the row's Source is set and the run history shows
     one intro: go to step 5.
   - Not sent: open the intro flow's run history (fact 0.3) for this row or case. If a run
     failed or was cancelled before it sent, and the guard is still blank, resubmit that one
     run, once (BB2 on a TEST row, Brian on a live row). Otherwise stop and report.
5. Then B7, if the first case is not marked sorted yet.

---

## Part D: what BB2 builds (on copies; TEST rows only)

Build only after Step 0 is recorded with no stop on facts 0.8, 0.9 and 0.10.

**D1. Service Cases column.** Add:

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| Hand Back Sorted | Yes/No | No | No | Brian sets Yes when he has dealt with this hand back, sent on or not. It takes the case off the daily hand-back list and changes nothing else |

No flow writes it, apart from the one-time backfill in D1a. Brian alone sets it to Yes, in
SharePoint. 7A, 7B, 1R, the site and HSBS 10 never read it.

**D1a. Backfill, once.** A case that existed before the column may hold a blank, not No. Only
after fact 0.8 is recorded with no stop: BB2 walks Service Cases in ID windows of 5,000
(`ID ge N and ID lt N+5000`, from the lowest ID to the highest, found with a Get items
ordered by ID descending, Top Count 1; Top Count 5000 on each window's Get items), and sets Hand Back Sorted to
No on every case in the window whose value is blank, changing nothing else. Afterwards no
case is blank (TEST check 2a), and every new case gets No from the column default.

**D2. Indexes.** On Service Cases, index Partner Status and Hand Back Sorted, the columns D3
filters on, after the backfill. On Referrals, index `JDEAccount` and Practice Name, the columns B1's lookup
filters on first. Add each only where it is missing, and record in the build report which
indexes existed and which were added. Part B is not used until the two Referrals indexes
exist.

**D3. The hand-back list in Brian's daily exceptions email** (the flow from fact 0.10, on a
copy). It replaces any hand-back part the email has today; it is not added beside it.

1. **Every query is bounded so it never passes the 5,000 item threshold.** Neither Partner
   Status alone (sorted cases keep their status, so its count only grows) nor Hand Back
   Sorted = No alone (every open case that was never handed back is No too) is selective by
   itself. So the leading predicate is an ID window, which SharePoint always indexes and
   which holds at most 5,000 cases. First get the highest ID (Get items, ordered by ID
   descending, Top Count 1). Then, for each window from the lowest ID to the highest
   (`ID ge N and ID lt N+5000`), run two Get items, one per stored value:
   - Query A: the window, then Hand Back Sorted equals No, then Partner Status equals
     `Hand back to HSBS`.
   - Query B: the window, then Hand Back Sorted equals No, then Partner Status equals
     `Returned to HSBS`.

   Hand Back Sorted equals No works because D1a left no blank. Use the internal column
   names BB2 records. Top Count 5000 on each query. Merge every result, order the merged
   list by Last Partner Update, oldest first, and keep the first 500.
2. TEST cases are listed too, each line starting with `TEST`. The email goes to Brian only.
3. One line per case: `TEST` when the case is a Test case; the company's name on screens
   (HealthFirst, Direct Dental, or for any other company its Solutions value as stored); the
   Practice Name; the first row's ID and Title; its Source; its Referring Rep, when there is
   one; the hand back date (the Last Partner Update date, Eastern); and the note.
4. **The note is printed exactly as 7B stored it,** from the column fact 0.9 names (the shared update column,
   or Hand Back Note under proposal P4): no trimming, no rewording, line breaks kept. A
   blank note prints `(no note typed)`. Fact 0.9 found the note in the shared update column on the
   Referrals row, rewritten by later saves. Decision 105: for a field or FSC case (its
   Referrals Source `Rep app` or `FSC app`) print Hand Back Note (sheet F2, F2.11). For a
   other-team case print the shared update column from its Referrals row as stored, as today; a later
   save may have rewritten it.
4a. **Every value from a list is HTML-encoded** before it goes into the email: the note, the
   Practice Name (it comes from public forms), the Title, the Source, the Referring Rep, the
   stored company value and every other column value. `&`, `<`, `>`, `"` and `'` are encoded
   so each value shows as typed and none can change the email.
4b. **Line breaks show.** After encoding, each line break in the note (CR LF, CR or LF) is
   turned into `<br>`, so a two line note shows on two lines. Nothing else in the note is
   changed.
5. If the merged list held more than 500 cases, add the line `500 or more open hand backs. Only the oldest 500 are
   listed.` If none, `No open hand backs.`
6. The list's own columns carry no customer phone, email or contact name and no dollar amount (D15); the partner's note is still shown word for word as typed (spec section 6), and the list goes to Brian only.

**D4. What must not change.**

- A hand back never writes, voids or changes a ledger row, and no flow reads the note to
  decide pay (spec section 6). Marking Hand Back Sorted changes no ledger row either.
- Marking it changes no other column: Partner Status, Status, Pipeline Stage, Closed Reason,
  the note and the Status Log stay as they were.
- A handed-back case is never on either silent-partner list (sheet F4), sorted or not. It is
  on the hand-back list until Brian marks it sorted.
- No recipient changes in any flow. No flow other than the daily exceptions email changes
  under this sheet (proposals P1 to P4 are not built here).

---

## TEST checks (TEST rows only; each is pass or fail)

Read every recipient in the run history of each flow that ran. A check that needs a later
sheet or slice cannot pass until that piece is built; until then BB2 records it as "waits for
<sheet or slice>", and M22 is not passed.

1. **Step 0.** The build report has all twelve facts (0.1 to 0.12), each with the flow and step
   it came from, and either no stop, or the stop reported and nothing built after it.
2. **Column.** Service Cases has Hand Back Sorted: Yes/No, not required, default No. The build
   report lists the indexes on Partner Status and Hand Back Sorted, and on `JDEAccount` and
   Practice Name on Referrals.
2a. **Backfill.** After D1a, a pass over every ID window (`ID ge N and ID lt N+5000`, Top
   Count 5000 on each Get items) finds no Service Case with Hand Back Sorted blank. The build report records how many cases were blank and how many were set to
   No, and the two numbers match. The run history of every flow in fact 0.8 shows no email
   and no write from the backfill. A TEST case made after the backfill reads No.
3. **Note printed as typed (M21, the note part).** A TEST HealthFirst case and a TEST staffing
   case are each handed back with the note `TEST it's A & B <b>x</b>` followed by a second
   line `line two`; the HealthFirst case's practice is named `TEST <i>Tag</i> & Co`. On the
   next daily email each is listed once, starting `TEST`, with its note word for word and
   rendered on two lines (`line two` on its own line, not run on after the first), the tags
   shown as text, not bold, and the practice name shown as typed, not italic.
3a. **Both stored values, oldest first.** A TEST case handed back with Partner
   Status `Returned to HSBS` (set by BB2 on a TEST case) is listed with the others, in Last
   Partner Update order. A TEST case handed back with the highest ID on the list is listed,
   so the last window is read. The build report records the number of Service Cases, the
   number of windows, and that every query ran without a threshold error.
3b. **More than 500 open hand backs.** BB2 hands back 501 TEST cases, each with its own Last
   Partner Update. The next daily email lists exactly 500, the oldest 500 by Last Partner
   Update, and carries the line `500 or more open hand backs. Only the oldest 500 are
   listed.` The newest of the 501 is not listed. BB2 deletes the TEST cases afterwards.
4. **A new case is listed when handed back.** A TEST case made after the column was added,
   never edited by hand, reads No and is listed once it is handed back.
5. **Sorted.** Brian sets Hand Back Sorted to Yes on the check 3 HealthFirst case. The next
   daily email does not list it. In SharePoint the case still has its Partner Status, Status,
   Pipeline Stage, note and Status Log as before. The run history of every flow in fact 0.8
   shows no email and no ledger write from that edit. Set back to No, it is listed again the
   next day.
6. **M22, forward: the new row.** A TEST rep app lead to HealthFirst (with a Test = Yes TEST
   rep) is handed back. Brian follows Part B to staffing with a TEST consent line (a made-up
   name, `phone`, Direct Dental, staffing). The new row has: Test Yes; Solutions the staffing
   value only; Source `Rep app`; the first row's Referring Rep and Referring Rep Email; the
   first row's Practice Name, Customer Name, Customer Phone, Doctor Email, Preferred Contact
   and `JDEAccount`, unchanged; Customer Email and every other-team and FSC column blank; `Consenttext` equal to Brian's line; Note
   with the needs line naming `Staffing` (not `OSHA and HIPAA compliance`) and the line
   `Sent on from referral [ID]`; Practice Type blank.
7. **Test first.** In the new row's version history, its first version already has Test Yes.
8. **The first row is unchanged.** Its version history has no version after the hand back, and
   it has no staffing Service Case.
9. **One case.** The new row has exactly one Service Case, for staffing, with Test Yes and
   Practice Type blank. (Test comes from 3F's copy of the row's Test, decision 101.)
10. **One TEST intro**, read where fact 0.6 says. It shows Brian's consent line and not the
    HealthFirst consent, shows the phone and the preferred contact, names the need
    `Staffing` and not `OSHA and HIPAA compliance`, and went to no live address (not to the
    live staffing contact on Routing either).
10a. **The sender on the partner page (decision 81).** The TEST partner page shows the new
    lead with the original TEST rep's name and roster role, not Brian. For check 20's field
    page lead, it shows the TEST field person's name and roster role (RGM for an RGM), held
    on the new row by the copied `Referred by:` line and other-team columns (step B4 2a), not Brian.
    Waits for the decision 81 build (7A role and the site change).
11. **Practice type first.** On the new case, 7B refuses a Qualified Yes and a Qualified No with
    `practice_type` until a practice type is set (sheet F2, check 14). Waits for F1 and F2.
12. **Pay.** The staffing partner saves reached Yes, then Qualified Yes, confirming
    `Private practice` as the qualify answer asks (decision 82): one $100 Reached row for the
    original rep, Company `Staffing`, Test yes, in no real batch. The HealthFirst case has no
    ledger row. Waits for F4 and the decision 82 build.
13. **Screens.** The TEST rep's Track and the TEST manager's My Team show two rows: the
    HealthFirst row with its handed-back status and the staffing row in staffing's words with
    the $100. Waits for F6 and slices S4 and S5.
14. **M22, reverse.** A TEST rep app lead to staffing is handed back before any award answer:
    without an answer to question 1 and with the qualify question blank, so the staffing case
    earns nothing and has no ledger row to keep. It is sent on to HealthFirst by Part B. Checks 6 to 10 and 12 to 13 pass with the roles swapped: Solutions
    `HealthFirst`, the needs line naming `OSHA and HIPAA compliance` (not `Staffing`), the
    HealthFirst intro naming that need, and the award at the HealthFirst plan amount. No
    practice type is asked for.
15. **Silent-partner lists.** The forward first case was handed back without an answer to
    question 1, and five business days have passed. It is on neither silent-partner list,
    before or after Brian marks it sorted, and after he marks it, it is off the hand-back list
    too and still shows its handed-back status and note in SharePoint. Waits for F4.
16. **No consent, no send.** Part B is tried with the consent line left empty. The steps stop at
    B2 (and B5 would not save). No new row exists, no case-making or intro run is in the run
    history for it, and a lookup the next day finds nothing.
17. **Retry.** Part B is stopped right after B5's save (B6 and B7 not done), then run again from
    B1. The lookup finds the row and sends Brian to Part C. The result: one new row, one new
    case, one intro in the run history, and at most one award.
18. **Double entry.** Part B is run twice end to end for the same first row. The second run
    stops at B1 step 4. There is one new row.
19. **Resume by resubmit.** On a TEST sent-on row, BB2 cancels the intro run while it is running
    (run history, Cancel), then follows Part C step 4: after one resubmit there is one intro
    and the guard is set, and a second resubmit (a test of the guard only; Part C never
    resubmits twice) sends nothing. If the run finishes before it
    can be cancelled, this check is recorded as not run, and Brian decides whether that is
    enough.
20. **A field page hand back earns nothing (spec section 6, M22).** A TEST field page lead
    (`/rgm/<slug>`, HealthFirst ticked) is handed back and sent on to staffing by Part B. The
    new row's Source is the first row's, unchanged, and its Note carries the first row's
    `Referred by:` line exactly. Its intro is sent by the flow fact 0.3
    names for that Source, to the TEST inbox only. The partner confirms a practice type, then
    reached Yes, Qualified Yes, and Signed with a date and a product: no ledger row is written
    for anyone (check M13's rule). Waits for F4.
20a. **Every other Source (fact 0.3).** For each Source on the choice list other than
    `Rep app` and the other team's page Source value (at least `FSC app`, the other team's app Source value and `Compliance page`), BB2 makes
    one TEST first row with the app or form that writes that Source, has it handed back, and
    Brian sends it on by Part B. Each time: one new row with the Source unchanged; the sender
    columns step B4 2a names for that Source, copied as they stand (none for `Compliance
    page`); one new case; one intro, sent by the flow fact 0.3 recorded for that Source, to
    the TEST inbox only, with that Source's guard column set; and, after the partner answers
    reached Yes, Qualified Yes and Signed with a date and a product, no ledger row for anyone.
    A Source fact 0.3 found with no intro flow or guard is not run, and is in the build report
    as stopped. Waits for F4 (the ledger part).
20b. **A rep no longer on the Rep Roster earns nothing.** A TEST rep app lead is handed back,
    then BB2 deletes that TEST rep's Rep Roster row, and Brian sends the lead on by Part B.
    The new row keeps Source `Rep app` and the rep's Referring Rep Email. After the partner
    answers reached Yes, Qualified Yes and Signed with a date and a product, no ledger row is
    written for the rep or a manager. Waits for F4.
20c. **Lookup with no `JDEAccount` and no Practice Name.** A TEST first row with both blank
    is handed back and sent on by Part B; B1's lookup is then run again for it. The ID window
    lookup finds the one sent-on row by its Note line, every window's Get items ran without a
    threshold error, and no second row is added.
21. **No live email.** For every check above, the run history of 2, 2B, 3, 3F, 7B and the
    daily exceptions flow shows no real partner, rep, manager or other-team sender address.

## Rollback

- **Part D:** point the daily exceptions flow back at its pre-change copy (it was built on a
  copy). Hand Back Sorted may stay: nothing else reads it. Do not delete it while it holds
  TEST data until Brian says.
- **A Hand Back Sorted mark made in error:** Brian sets it back to No. The case is listed again
  on the next daily email.
- **TEST rows:** BB2 deletes the TEST Referrals rows, their Service Cases and their Test ledger
  rows when the checks are done (decision 48).
- **A live sent-on row made in error:** settled default 4: do not delete or edit it.
- No other flow is changed by this sheet, so nothing else rolls back. A proposal (P1 to P4),
  if built later, carries its own rollback in its own sheet.

## Spec clause to sheet step

| Spec clause | Sheet step or check |
|---|---|
| 9 F7: written after reading the live 2, 2B and 3F | Step 0, facts 0.1 to 0.7; check 1 |
| 9 F7: if the live flows cannot do it from the row, say so and propose the smallest change | Step 0 table, last column; "Proposals" P1 to P3 |
| 9 F7: the steps begin with the lookup; a found row is resumed, never a second | B1 step 4; Part C; checks 17, 18 |
| 9 F7: how to finish a row whose case or intro did not complete | Part C steps 3 and 4; facts 0.2, 0.3; check 19 |
| 6 and 13: Source decides pay; a sent-on row keeps its Source | Opening paragraph; B1 step 5; B4 step 2; check 20 |
| 6: the copy list, each copied as it stands | B4 step 2; check 6 |
| 6: one company in Solutions, the need that goes with it, never the first row's | B4 steps 3 and 6; checks 6, 10, 14 |
| 6: the Note line "Sent on from referral [ID]" | "Words used"; B4 step 6; check 6 |
| 6: Brian's consent, typed into `Consenttext`; no OK, no send; the intro carries it | B2; B4 step 4; B5; checks 10, 16 |
| 6: Test copied before anything else; the flows still run; no live email; Test rows in no real batch | Rules 1 to 3; B4 step 1; fact 0.6; checks 7, 12, 21 |
| 6: the TEST intro is read in the run history or the TEST partner mailbox | Fact 0.6; check 10 |
| 6: practice type blank on a lead sent on to staffing; no qualify answer until one is set | B4 step 9; check 11 |
| 6: the new row pays under the destination's rules; the first row never blocks it | Checks 12, 14 |
| 6: Track and My Team show two rows | Check 13 |
| 6 and 9 F7: the column the hand-back note is read from; printed exactly in the daily exceptions | Fact 0.9; P4; D3 step 4; check 3 |
| 6 and 9 F7: Hand Back Sorted, a Service Cases Yes/No column that only takes the case off the daily list | D1; D3 step 1; B7; checks 2, 4, 5 |
| 6: a hand back changes no ledger row | D4; fact 0.8; check 5 |
| 6: a handed-back case is on no silent-partner list | D4; check 15 |
| 6: only Brian can send a lead on | "Who does what" |
| 13: a sent-on row could turn a non-rep lead into one that earns | Opening paragraph; B1 step 5; check 20 |
| M22 | Checks 6 to 18, 20 and 20a to 20c |
| Decisions 75, 81, 82 (11/13), on PR #121 | Opening gate and list; fact 0.3; B4 step 2a; checks 10, 10a, 12 |
| Review of 6da09ed: lookup and hand-back list past 5,000 rows; every email value encoded | B1 step 4; D2; D3 steps 1 and 4a; checks 3, 3a |
| Review of 71e3f85: Top Count on every window; a rep off the roster; the lookup with no JDE and no name | B1 step 4; D1a; checks 2a, 20b, 20c |
| Review of 2b733d8: backfill and ID windows; line breaks; every Source; sender-less Sources; no Title format | D1a; D3 steps 1 and 4b; facts 0.3, 0.8, 0.11; B4 steps 2a and 8; checks 2a, 3, 3a, 4, 20a |
| M21 (the note part) | Check 3 |

## Settled defaults (conductor, 11/13)

The first draft asked Brian five questions. The conductor ruled on 11/13: take Claude's
stated defaults. They are settled for this sheet, not open asks. The fifth, a Title format
for the new row, is withdrawn: the new row gets its Title the way any new Referrals row does
(fact 0.11, step B4 8), and this sheet sets no format of its own.

1. **Which hand backs go on the daily list:** every company's, including every case handed back
   before this sheet. Nothing is hidden without being on Brian's list.
2. **Columns the spec does not list:** not copied (the rep's own notes, the call first line in
   Contact Instructions, Route, and any person's columns other than the sender's). The one
   addition is the sender's columns for the first row's Source (step B4 2a), so the partner
   page can name the original sender by roster role (decision 81; review of 6da09ed). If fact
   0.5 shows a flow needs another column to send, BB2 stops there. Route is still not
   copied, but on a `Rep app` first row B4 step 2b sets it to `Direct to partner`
   (decision 100).
3. **The rep's receipt:** this default assumed 3F sends the rep a receipt for every `Rep app`
   row. It does not: no flow sends a rep receipt today (fact F3-0.4). With no flow change,
   the rep gets none for a lead Brian sent on. Nothing is built for it here; sheet F3, stop
   item S2, holds the receipt question.
4. **A live sent-on row made in error** (the wrong partner, or no real OK): not deleted and not
   edited. Brian tells the partner himself, and the row stays as the record.

## Ask Brian

1. **Customer Email on a field page lead.** A field page lead (1W) keeps the customer's email in
   Customer Email and leaves Doctor Email blank, so a lead sent on from a field page reaches
   the new partner with no email, only the phone. Should Part B also copy Customer Email?
   Safe default, until Brian answers: no, copy only the spec's list; the partner uses the
   copied Customer Phone.

## Notes for the conductor

- `docs/partner-status-flow.md` still describes 7A and 7B on Referrals; since the 10/22 cutover
  partner status is on Service Cases (`docs/build/field-two-track-flow-contracts.md`, "Stale docs
  found"). Fact 0.9 found the shared update column on the Referrals row (fact F7-0.9, 11/13).
- Sheet F4 owns Brian's daily exceptions email and its silent-partner lists. If F4 rebuilds
  that email, it carries D3 as written here.
