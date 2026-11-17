# Field two-track app: build sheet F3, the staffing intro email

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and names in code quotes are live SharePoint and flow names.

Builder: BB2 (decision 91).

Checked against BB2 step 1 facts v2 (11/13): F3-0.1 to F3-0.10, F3-2N, R1, F7-0.6, and the
v2 decision 97 checks (3F's Test_mode now reads the row's Test; the test path; no Test
column on Service Cases). Results are in "Step 0 results"; the stop items they raise are
S1 to S6 below.

**Brian's answers, 11/14 (decisions 100, 101 and 103, `docs/claude-code/DECISIONS.md`).**
"Reuse 3F": 1R writes Route `Direct to partner` on every `Rep app` row, and the 3F copy
starts on Source `FSC app` or `Rep app` with that Route (B0b). "Add a Test column": Service
Cases gets a Test column that 3F copies from the row (Part T). "Yes, skip in all three":
HSBS 2, 2B and 3 each skip Source `Rep app` (Part S). These close stop items S1, S3 and S5
and settle most of S2. Scope (Brian, 11/14): field (`Rep app`) and FSC app rows only. HSBS
2, 2B and 3 serve the other team's path, so their one new condition skips `Rep app` rows and changes
nothing for an other-team row.

**There is no repo copy of HSBS 3F.** `flows/` on `main` holds only `flows/README.md`
(checked 11/13). Before building anything, BB2 reads the live 3F and the flows named in Step
0 (read only) and records every fact there in the build report. Each fact says what this
sheet assumes and what BB2 does if the live flow differs. Facts 0.1 to 0.10 were recorded on
11/13, and several differ. After Brian's 11/14 answers, S1, S3 and S5 are closed; Part B
is built only as far as the open stop items (S2's remainder, S4, S6) allow.

Written 11/13/2026 by Claude for BB2 (the builder bot) and for Brian, from the approved spec
"Field two-track app: team members and managers (v1)", `docs/build/field-two-track-spec.md`
(approved by Brian 11/13: "approve the spec"). Section numbers (4, 6, 9, 12) are that spec's.
Sheets F1, F2 and F6 are in `docs/build/field-two-track-flow-contracts.md`; this sheet uses their
words and rules.

The spec's row for this sheet (section 9, F3), word for word: "3F: the intro for a staffing
row from the rep app (practice type, point of contact, the consent text, the need
'Staffing'). Recipients: the staffing contact from Routing, the referring rep, Brian. Nobody
else."

Decisions this sheet follows, all in `docs/claude-code/DECISIONS.md` on `main` (PR #121,
merged 11/13):

- **75.** Matt Penny at Direct Dental receives the staffing leads (this intro). His address
  goes only into Routing in SharePoint. It is never in this repo, this sheet, a build report,
  a Status Log line, a test note or a commit. Brian types it in (step R2); BB2 never does.
- **81.** A sender is named by their roster role: FSC, AE, ES, RGM. The Rep Roster stores an
  RGM as `RM`, shown as "RGM". This sheet uses the same words in the intro.
- **86.** Through 12/31 the staffing choice is Staffing only. There is no GoTu selection, so
  the intro never says GoTu.

Rulings on this sheet's open items (conductor, 11/13): the rep app staffing intro goes only
through the new `Rep app staffing` Routing row, and the existing staffing Routing row is
never touched; the intro carries no partner update page link; the words in B7 and B8 stand
as written.

This is a build sheet. This repo never edits a flow. BB2 builds it in Power Automate and
SharePoint, on a copy of 3F, with TEST rows only.

## Decision 119 (11/14): a field 3F copy, no live edit, no swap

Brian, 11/14: "yes, all field pieces as copies, prove on preview".

**The Sunday TEST build of the field 3F copy is built and checked from sheet 3F-F,
`docs/build/field-two-track-3f-field-copy.md`, alone.** That sheet uses only Part T and Part U's U1
and U2 from this sheet. Nothing else in this sheet (P1 to P4, Step 0's baseline, Part R,
Part S, Part B, U3, Part D or the numbered checks) applies to the Sunday build.

The live 3F is never edited and never swapped. It keeps taking only Source `FSC app` rows
(fact 0.1). The field copy takes only Source `Rep app` rows, plus Test = Yes until go-live.

This sheet comes back, revised for the copy, for two later builds:
- **The staffing branch** (Part B with U3, Part R and the staffing checks), built into the
  field copy after Sunday. Staffing stays off in the app until Brian's go.
- **Go-live:** Part S (a live edit to HSBS 2, 2B and 3, on Brian's go), then the copy's Test
  = Yes condition comes off and the copy is turned on. There is no swap, and rollback is
  turning the copy off. S7 needs Brian's ruling first.

## Stop-and-ask items (decision 89)

From BB2's step 1 facts (11/13). At each one BB2 stops, builds nothing past it, reports, and
the question goes to Brian.

| # | Where | Stop when |
|---|---|---|
| S1 | Fact 0.1; B0, B1 and everything after | 3F does not start on a `Rep app` row (fact F3-0.1): its trigger needs Source `FSC app`, Route `Direct to partner`, Introduced On empty and the SystemEditAt rule. **Decided: decision 100** ("Reuse 3F"). Build: 1R writes Route `Direct to partner` on every `Rep app` row (sheet F1, F1.4 rule 7), and the 3F copy's Source condition takes `FSC app` or `Rep app` (B0b) |
| S2 | Facts 0.4 and 0.5; B5, B7, B8, B9; checks 6 and 10; baseline (a) | No exported flow sends a rep app HealthFirst intro or a rep receipt (fact F3-0.4). **Settled in part by decision 100:** the staffing branch copies 3F's own send step (Send_intro's action, mailbox and format) and 3F's own writes (Mark_introduced and the Service Case create); receipt is off, since no flow sends a rep receipt today (fact 0.4, "Receipt off"). **Still open:** a HealthFirst `Rep app` row now runs down the B1 No side, 3F's FSC path, whose intro names Referring FSC as the referrer and copies the Routing backup and the other-team sender's email. Before check 10 is judged, BB2 records that TEST intro; if it does not name the rep, or copies anyone beyond the spec's three (partner contact, rep, Brian), stop and ask Brian |
| S3 | Fact 0.9 | HSBS 2, 2B and 3 have no Source `Rep app` skip (fact F3-0.9). **Decided: decision 103** ("Yes, skip in all three"). Build: Part S, one trigger condition in each, after BB2 asks BB1 (decision 91). It must be live before Part D |
| S4 | Fact 0.3; B2, B9; checks 7 and 9; Part D | 3F stamps Introduced On in Mark_introduced before Send_intro runs (fact F3-0.3; send-on stop item S1). The guard is not proof of a send. **Decided: decision 112** (Brian, 11/14: "yes" to clearing the mark when the send fails). Build: Part U. The stamp stays where it is, before the send; when no intro went out, 3F puts the three stamped columns back, so the row is not marked introduced and the next poll retries it. Still open: S7 (an endless retry when the send keeps failing). BB2 still stops and asks before any resubmit by hand |
| S5 | Prerequisite P3; fact 0.11; checks 0 and 6 | Service Cases has no Test column (v2 check 5), and neither 3F nor HSBS 3 writes Test on a case (fact F3-0.5). **Decided: decision 101** ("Add a Test column"). Build: Part T adds the column, and the 3F copy's case create copies Test from the row (B9). P3 and fact 0.11 read the case's Test once Part T and B9 are built |
| S6 | Fact 0.6; checks 11, 13 and D4 | On 3F's test path the intro subject starts `[TEST]`, but the `Tell_PVA` email has no `[TEST]` in its subject (v2 check 3; 3F's wording, unchanged). Apart from Part U (decision 112), this sheet leaves the FSC path as it is. BB2 records it and asks Brian whether it changes (a 3F change outside this sheet) before check 11 is judged |
| S7 | Part U (decision 112); Part D | Putting the stamp back is an edit, so 3F's created-or-modified trigger retries the row on the next poll. A send that keeps failing retries every poll with no end (nothing is sent; run history fills). Brian decides how retries end before Part D. Not a stop for the TEST build |

## Pre-build checks (read only)

- **PB1 (before Part R).** List read of Routing: every column and type, any Active column,
  and each row's Title label, no addresses (fact F3-0.7). The export shows Title as a
  picker. If Title is a choice column, fact 0.7's own rule stops step R1.
- **PB2 (before Part R).** Export HSBS 9 (the Salesforce loader): whether it reads Routing
  and what it does with a `Rep app` row (facts F3-0.7, F3-0.9).
- **PB3 (before B1).** List read of Referrals and Service Cases: internal names and types
  for the fact 0.8 columns, including `JDEAccount` (no column named Account Number was
  found), `Consenttext`, whether Solutions is multi-choice, and whether Referring Rep and
  Referring Rep Email exist (the FSC and other-team packages use Referring FSC, not Referring
  Rep; fact F3-0.8).
- **PB4 (before any rep app post).** The 1R the rep app reaches (sheets F1, F2 and F6,
  PB1): whether it writes Source `Rep app`, Referring Rep and Referring Rep Email, and
  leaves `PVA Email` blank.
- **PB5 (before Part B).** List read of the Referrals Source choices.

## Who does what

| Who | Does |
|---|---|
| BB2 | The prerequisites, Step 0 (read and record), steps R1 and R3 (the Routing row, with no address in it), Part T, Part S (after BB1's OK), B0 to B10, the TEST checks, and the swap and rollback when Brian says |
| Brian | Step R2: types the staffing contact's address into the new Routing row, himself, in SharePoint. Gives the go for the swap, in chat, in his own words |
| Anyone else | Nothing |

## Rules for every step

1. **Build on a copy of 3F.** Before the swap, the live 3F gets exactly one edit: the trigger
   condition in step B0a, which only makes it skip the copy's own TEST rows. Nothing else in
   the live 3F changes. The swap happens only on Brian's go (Part D).
2. **TEST rows only while testing.** A Referrals row with Test = Yes, TEST in the practice
   name and a made-up contact, sent by a TEST rep (Rep Roster Test = Yes). Decision 48 lets
   BB2 make these and delete them after.
3. **No live sends.** No email to a real partner, rep, manager or other-team sender. Every email the copy
   sends for a Test row goes only to the TEST inbox the flows already use (fact 0.6), in all
   three recipient slots, Brian's included.
4. **No new email recipients beyond the spec's three.** The staffing intro and the rep's
   staffing receipt go only to the staffing contact from Routing, the referring rep and
   Brian. Never a Routing CC column, a Partner Links contact or CC, an other-team sender, a manager or anyone
   else.
5. **No secrets** in this sheet, a build report, a Status Log line, a test note or a commit:
   no flow URL, key, link key, token, password, phone number or email address. Where a check
   needs an address, BB2 records "matches" or "does not match", never the address.
6. **No partner link in the intro.** The partner update page link (`/leads/<key>`) is a bearer
   key: whoever holds it can read and save every open case on that partner's page. The rep is
   copied on the intro, so the staffing intro and receipt carry no link of any kind.
7. **Leave every other intro unchanged.** The pilot FSC app intro (any company), the other-team sender
   intro (HSBS 3) and the Salesforce lead intro send exactly as today: same steps, same
   words, same recipients. The only changes are decided ones: 3F's Source condition also
   takes `Rep app` (decision 100), its case create copies Test (decision 101), it puts the stamp back when no intro went out
   (decision 112, Part U; the sends themselves are unchanged), and HSBS 2, 2B and 3 skip
   `Rep app` rows (decision 103). A HealthFirst `Rep app` row runs 3F's FSC
   path (stop item S2's open part). No existing Routing row is edited.
8. Escape `'` as `''` in every Filter Query, as today.

## Words used in this sheet

- **The staffing value:** the Solutions value `HS Staffing / Recruiting Services (including GoTu)`,
  spelled exactly (spec section 4). It is how the flow recognizes a staffing row. It is never
  printed in an email.
- **A rep app staffing row:** a Referrals row whose Source is `Rep app` and whose Solutions
  holds exactly one value, the staffing value. 1R refuses a rep app submit with no company
  or more than one (sheet F1, F1.4 rule 1), so a rep app row always has one.
- **The `Rep app staffing` Routing row:** the Routing row step R1 adds. The staffing branch
  reads it and nothing else reads it.
- **The staffing branch:** the new steps this sheet adds to the 3F copy (Part B).
- **The watched list:** the list 3F's trigger watches (fact 0.1): Referrals or Service Cases.
- **A copy test row:** a TEST row whose Practice Name starts with `F3COPY TEST`. Only the copy
  runs on it, and the live 3F skips it (B0, B0a). Every TEST check below uses copy test rows,
  except the baseline (fact 0.11) and the post-swap check (D4), which use ordinary TEST rows.
- **Receipt on:** fact 0.4 shows that today's HealthFirst rep app path sends the rep a
  separate receipt email. Then the staffing branch sends one (B8). **Receipt off:** it does
  not, and the staffing branch sends none. Every check that names a receipt says what it
  expects for each.
- **Practice type words:** the words the rep picked on the screen (spec section 4). The row
  stores `Private practice` or `Group`; the screen showed:

  | Stored on the row | Words in the email |
  |---|---|
  | `Private practice` | Private practice |
  | `Group` | Group (3 or more locations) |
  | blank (a lead Brian sent on by sheet F7; the rep picked none) | Not set yet. Please set it on your update page. |

- **The consent words:** the row's `Consenttext` column, exactly as stored. From the staffing form it
  is `The customer gave permission for Direct Dental to contact them about staffing.*`
  (the box's words, asterisk included). On a lead Brian sent on (sheet F7) it is his recorded
  line. The flow never rewrites, shortens or rebuilds it.
- **The star line:** `* Direct Dental may void this referral if the customer did not give permission to be contacted about this service.`
  The words under the staffing form, word for word. The intro shows it only when the
  consent words end in `*`.
- **Role words** (decision 81): the referring rep's Rep Roster Role. `RM` reads `RGM`. Any
  other stored value (for example `FSC` or `AE`) reads as stored. No roster row, or a blank
  role: the role is left out and only the name shows.

## What the site sends (S3, PR #125, `src/lib/rep-staffing-form.mjs`)

A staffing send from the rep app posts the rep app submit to 1R with these values. The rep's
name and email are not in the body; 1R writes Referring Rep and Referring Rep Email from the
Rep Roster row that owns the key. The body has no Test field: 1R decides Test (prerequisite
P3).

```json
{
  "action": "submit",
  "referralKey": "<Referral Key from the Rep Roster>",
  "submissionId": "22222222-2222-4222-8222-222222222222",
  "leadType": "Practice owner",
  "doctorName": "TEST Office Manager",
  "practiceName": "F3COPY TEST Staffing Dental",
  "officePhone": "<a made-up TEST phone>",
  "doctorCell": "",
  "doctorEmail": "",
  "jde": "001234",
  "companies": ["HS Staffing / Recruiting Services (including GoTu)"],
  "needs": ["Staffing"],
  "PVApermission": true,
  "contactFirst": false,
  "preferredContact": "Call",
  "consentText": "The customer gave permission for Direct Dental to contact them about staffing.*",
  "notes": "",
  "route": "Partner",
  "referrerRole": "Rep",
  "source": "Rep app",
  "status": "Received",
  "practiceType": "Private practice"
}
```

1R writes `doctorName` to Customer Name (the point of contact), `officePhone` to Customer
Phone, `doctorEmail` to Doctor Email, `jde` to `JDEAccount` (text, leading zeros kept; the
facts found no column named Account Number, F3-0.8), `preferredContact` to Preferred
Contact, `consentText` to `Consenttext`, the `needs` words and then `notes` to Note,
`contactFirst` false as the line `Contact first: No` in Contact Instructions, and
`practiceType` to Practice Type on the row (sheet F1, F1.4). 1R makes no Service Case
(fact R1): the case, and its Practice Type, come from the step that makes the case (B9).
Whether that 1R writes Referring Rep and Referring Rep Email is PB4. The practice name above
is a copy test row's; the JDE is a made-up TEST value.

## What exists today (Step 0 recorded it 11/13)

- **3F on a rep app row.** The rep app spec v3 ("Existing flows on a Rep row") says 3F fires
  on Source `FSC app` with route `Direct to partner` and on Source `Rep app`, and sends a
  rep app row the HealthFirst intro and the rep's receipt. **That is not what runs** (facts
  F3-0.1, F3-0.4): 3F's trigger takes only Source `FSC app` with Route `Direct to partner`
  and Introduced On empty, and no exported flow sends a rep app intro or a rep receipt (stop
  items S1, S2). HSBS 2, 2B and 3 have no `Rep app` skip (fact F3-0.9, stop item S3).
- **3F's FSC path, step by step** (fact F3-0.2): Today_ET, Due_date, Test_mode,
  Mark_introduced (stamps Introduced On, Next Update Due and Last Notified Status
  `Introduced to Solution Company` on the Referrals row, before the send), Partner_names,
  then For_each_partner (Get_routing, Route, Routable, Intro_body, Send_intro), then a
  Service Case create (Title, Referral link, Owner, Receiver name and email, `Service`,
  Status `Sent` or `Held`, Dispatch, Stage `New lead`; no Test) (fact F3-0.5).
- **3F's Test rule** (decision 97, built 11/13): Test_mode is
  `equals(triggerOutputs()?['body/Test'], true)`, the row's Test column. Before 11/13 it was
  the literal `true`, so every run took the test path. On the test path the intro goes To
  3F's test-path address (Brian's), with no CC and a subject starting `[TEST]`, and `Tell_PVA`
  also goes only to Brian, with no `[TEST]` in its subject (stop item S6). Off the test
  path the intro goes To the Routing Primary email (or a fallback when not routable), CC the
  Routing backup, a fixed Brian address and the other-team sender's email (fact F3-0.4).
- **The rep's emailed receipt** is the app's receipt without the money line: no rep email
  carries a dollar amount (rep app spec v3, D15, "Receipt"). No flow sends one today.
- **On a pilot FSC app row** sent to the partner, 3F's intro names the FSC, copies the FSC's other-team pair
  and includes the same details (`docs/fsc-flow-contracts.md`, "What the flow does with
  route"). This sheet does not change it, for staffing or any company.
- **3F and HSBS 3 read Routing** with `Title eq '<partner value>'`, Top Count 1, an exact
  match (fact F3-0.7). The full Routing columns are PB1.

---

## Prerequisites (all before any baseline row, test post or build step)

| # | Prerequisite | How BB2 knows it is met | If not |
|---|---|---|---|
| P1 | Decisions 75, 81 and 86 are in `docs/claude-code/DECISIONS.md` on `main` | Met 11/13: PR #121 is merged and the three rows are there | Stop |
| P2 | Sheet F1 steps F1.1 to F1.4 are built: Practice Type on Referrals and Service Cases, and the 1R copy that writes it. F1 check 2a (the Referrals half) passes. F1 check 2b (the Service Case half) needs this sheet's 3F copy, so it runs after B9, with checks 2 and 6 | F1's build report | Stop |
| P3 | **Test propagation (sheet F5, PR #123, gate G3).** The 1R that every post below goes to (the F1 copy) makes a Test = Yes Referrals row for a Rep app submit from a Rep Roster row with Test = Yes, whatever the names. Either its Test expression already reads the Rep Roster row's Test column, or F5 step R is built into it and F5 checks R1 to R5 pass. A pilot FSC app submit with TEST in the practice and contact names also makes a Test = Yes row (F5 check R4). 1R makes no Service Case (fact R1): the case's Test comes from this sheet's Part T and B9 and is checked after they are built (checks 0 and 14), so it is not part of this prerequisite (Codex P1 on #151, 11/14) | BB2 writes the 1R copy's exact Test expression for the Referrals row in the build report, and the F5 R1 to R5 results if step R was built | Stop. Post nothing to any 1R: a row that comes out Test = No is a live row, and the live 3F would mail a real Routing contact |
| P4 | Step 0 facts 0.1 to 0.10 are all recorded and none of them says stop | The build report | Stop. Make no baseline row |

---

## Step 0: BB2 reads the live flows and records the facts (read only)

Read the live 3F, HSBS 2, 2B, 3, 7A, HSBS 9 (the Salesforce loader; no flow named 2N
exists among the 48 HSBS flows, fact F3-2N), every other flow
that reads the Routing list, and the Routing, Partner Links and Rep Roster lists. Change
nothing. Write each fact in the build report with the flow and step it came from, and no
address, key or URL. Record facts 0.1 to 0.10 first; make the baseline (0.11) only after P4.

| # | Fact | This sheet assumes | If the live flow differs |
|---|---|---|---|
| 0.1 | What starts 3F | 3F has its own SharePoint trigger on the watched list (Referrals or Service Cases), for created items or for created or modified items, with trigger conditions that pick Source `FSC app` with route `Direct to partner` and Source `Rep app`. Record the list, the event (created, or created or modified), every trigger condition word for word, and the concurrency setting | 3F is started by another flow (a child flow, an HTTP call from 1R, a call from 2B, or anything else): stop and report. This sheet covers only a 3F with its own SharePoint trigger, and edits no other flow; Claude writes a version for the topology found |
| 0.2 | Where a rep app row is handled | 3F has a point near the top, before any email or write step and outside any loop, where the row's Source and Solutions can be read. Record the step names from the trigger down to the first email step | No such point (for example every step sits inside a loop over Solutions): stop and report. Claude would propose putting the condition at the top of that loop, with no Terminate |
| 0.3 | What stops a second intro | 3F sends one intro per case, then stamps a guard column (for example Introduced On or Last Notified Status, on the row or the case), and sends nothing when the guard is already set. Record the column, the list it is on, and the check | No guard, and the trigger fires on modified items too: stop and report. A trigger on created items only, with no guard: record it; the staffing branch uses the same trigger, skips B2 and stamps no guard in B9 |
| 0.4 | Who today's rep app HealthFirst intro goes to | One intro email: To the contact column of the HealthFirst Routing row, with the referring rep (from Referring Rep Email on the row) and Brian on it as CC or BCC, and, if receipt on, one receipt email To the rep. Record each send step, each To, CC and BCC and where each comes from (a Routing column, a row column, a fixed value, a variable), and whether a separate receipt is sent (receipt on or off) | A different shape: record it. The staffing branch still sends exactly the shape in Part B. Any recipient beyond the three on today's HealthFirst intro (a Routing CC, a Partner Links CC, an other-team sender): record it and report it to the conductor; do not copy it into the staffing branch; change nothing in the HealthFirst path |
| 0.5 | What today's rep app HealthFirst path writes | Besides the emails, the path writes SharePoint columns (for example Introduced On, Last Notified Status, Status, Pipeline Stage, Stage Entered On, Next Update Due on the row or the case). Record every write step: list, column, value | None: record it. The staffing branch then writes nothing either, apart from the guard in fact 0.3 |
| 0.6 | The Test rule and the TEST inbox | 3F decides Test by the row's Test column, not by a name, and has a TEST inbox it sends Test row mail to. Record the rule, the step, the TEST inbox's source (a variable or a fixed value, never written down here), how today's rule treats Brian on a Test row, whether a Test subject starts with `TEST`, and where BB2 reads a TEST email in full (run history or the TEST mailbox BB2 controls) | 3F has no TEST inbox: use the one the other HSBS flows use for Test rows (decision 48) and record which flow it came from. None anywhere: stop. Today's rule could mail a real partner, rep, manager or other-team sender for a Test row: stop before the baseline (sheet F5, gate G4, owns that fix). Today's rule sends Brian's copy to his own inbox: record it; the staffing branch still sends Brian's slot to the TEST inbox (B5) |
| 0.7 | The Routing list | Record its columns (display and internal names, types), the column that picks a row (the key) and its type, the contact column, any CC column, any Active column, and every row's key (no addresses). Record each flow that reads Routing (3F, HSBS 3, 2B, HSBS 9, any other) and its exact filter | A flow reads Routing with no filter, a "contains" or "starts with" filter, or loops over every row, so that a new row could be picked up by it: stop before step R1. The key column is a choice column (a new row would need a new choice): stop before step R1. Claude proposes the smallest change |
| 0.8 | Referrals and Service Cases columns | The row has these columns, under these names: Test, Source, Solutions, Practice Name, Customer Name, Customer Phone, Doctor Email, Preferred Contact, Account Number, Rep Practice Type (`RepPracticeType`, sheet F1; not BB1's `Practice_x0020_Type`), Consent text, Note, Contact Instructions, Referring Rep, Referring Rep Email. The watched list has a Test column and a Practice Name column (or the column 1R fills from `practiceName` on it) for the B0 and B0a trigger conditions. Record each internal name and type, and whether Solutions is a multi-choice column or text | Practice Type is missing: stop (sheet F1, step F1.1, comes first). The watched list has no Test or no practice name column: stop. Any other column missing: stop. A name differs: record it; this sheet means that column |
| 0.9 | Other flows on a rep app staffing row | HSBS 2, 2B and 3 send nothing for a row with Source `Rep app`, whatever its Solutions. HSBS 9 never sees such a row. Record each flow's condition that skips Source `Rep app` | A flow other than 3F would send any email for a rep app staffing row (for example HSBS 3 sending a second intro): stop and report. This sheet does not edit that flow |
| 0.10 | The partner link on today's HealthFirst intro | Record whether today's rep app HealthFirst intro carries the partner's update page link (`/leads/<key>`) while the rep is copied. Never write the link or its key in the build report | Report only: if it does, tell the conductor (the same bearer key exposure, on HealthFirst intros). Change nothing in the HealthFirst path under this sheet. The staffing intro carries no link either way (rule 6) |
| 0.11 | The baseline | After P4, before building, BB2 posts three ordinary TEST rows to the F1 1R copy and saves, for each, the subject, the full body and the resolved To, CC and BCC of every email the live 3F sent (addresses recorded only as "TEST inbox" or "Brian"): (a) a rep app HealthFirst row from a TEST rep, (b) a pilot FSC app row to staffing with route `Direct to partner`, from a TEST FSC, (c) a rep app staffing row from a TEST rep, with the body above but practice name `TEST Staffing Dental`. For (c), also record what today's 3F did with it: sent nothing, sent a HealthFirst-worded intro, or something else. BB2 reads each new row's Test value: Yes on all three, on the row and its Service Case | A baseline row with Test = No, or any email from these runs to anyone but the TEST inbox or Brian: stop and report. Otherwise this is the "before" for checks 10 and 11 |

### Step 0 results (BB2 step 1 facts v2, 11/13)

P4 was **not met** on 11/13: facts 0.1, 0.3, 0.4, 0.5 and 0.9 said stop (stop items S1 to
S4), and fact 0.11's Service Case part could not hold (S5). Brian's 11/14 answers close S1,
S3 and S5 and most of S2. P4 is met once Part T and Part S are built and S4 is answered.
Today's live 3F does not run on a `Rep app` row, so baselines (a) and (c) record "sent
nothing"; check 10 then reads the new intro against stop item S2's open part.

| # | Result | What it means here |
|---|---|---|
| 0.1 | Differs (F3-0.1). Own SharePoint trigger, created or modified, on Referrals, every 5 minutes, no concurrency setting. Conditions: Source `FSC app`, Route `Direct to partner`, Introduced On empty, SystemEditAt empty or Modified more than 2 minutes after it. No Source `Rep app` condition | The topology is the one this sheet covers, but rep app rows never start 3F. Stop item S1, decided by decision 100: B0b widens the copy's Source condition |
| 0.2 | Matches (F3-0.2). A branch fits after Test_mode and before Mark_introduced, outside the partner loop and before any email | B1 goes there (S1 decided, decision 100) |
| 0.3 | Differs (F3-0.3). The guard is Introduced On on Referrals; 3F and HSBS 3 need it empty, stamp it in Mark_introduced, then send, then make the Service Case. The stamp comes before the send | Stop item S4 |
| 0.4 | Differs (F3-0.4). No rep app intro and no rep receipt in any export. 3F's recipients are in "What exists today" | Stop item S2. Receipt off: no flow sends a rep receipt today. Decision 100 settles which send step is copied |
| 0.5 | Differs (F3-0.5). 3F writes Introduced On, Next Update Due and Last Notified Status on the Referrals row, then after the send makes the Service Case (`Service`, Status `Sent` or `Held`, Stage `New lead`, no Test). HSBS 3 writes the same | B9 copies these writes and adds Practice Type and Test (decision 101, Part T) to the case create |
| 0.6 | Differed (F3-0.6); fixed 11/13 by decision 97. Test_mode now reads the row's Test. The test path goes to Brian's address only, no CC; the intro subject starts `[TEST]`, the `Tell_PVA` subject does not. HSBS 2, 2B and 3 skip Test = Yes rows and practice names containing `test`, with no TEST inbox path | Matches the sheet now. Here "the TEST inbox" is 3F's test-path address, which is Brian's (see check 13). Stop item S6 |
| 0.7 | Pending (F3-0.7). 3F and HSBS 3 read Routing by `Title eq '<partner value>'`, Top Count 1. Columns used: Title (a picker), Primaryemail, Verified, Backupemail, Primaryname | PB1 and PB2 before step R1 |
| 0.8 | Pending (F3-0.8). Columns in use include Test, Source, Solutions, PracticeName, CustomerName, CustomerPhone, CustomerEmail, Preferred Contact, `JDEAccount`, `Consenttext`, Note, Contact Instructions, Referring FSC, Referring FSC Email, `PVA Name`, `PVA Email`, `PVA Slug`, Title, Status, Route, Partner, Introduced On, `PVA permission`. Practice Type is not read or written. Referring Rep is not used | This sheet now says `JDEAccount` and `Consenttext`. PB3 |
| 0.9 | Differs (F3-0.9, F3-2N). No 2N exists. HSBS 2, 2B and 3 have no `Rep app` skip. HSBS 9 needs its export | Stop item S3, decided by decision 103: Part S; PB2 |
| 0.10 | Matches (F3-0.10). Neither 3F nor HSBS 3 puts a partner update page link in the intro | Nothing to report |

---

## Part R: the Routing row for staffing

Do this after Step 0 shows no stop in fact 0.7. The rep app staffing intro goes only to a new
Routing row that only the staffing branch reads. Every existing Routing row stays as it is,
so every other staffing intro (other-team, Salesforce, pilot FSC app) still goes where it goes today.

**R1. BB2 adds the row.** On the Routing list (site `HSBSPVAReferrals`), New form, one save:

| Column | Value |
|---|---|
| The key column (fact 0.7) | `Rep app staffing` |
| The contact column | blank. BB2 never types an address |
| Any CC column | blank, and it stays blank: the staffing branch never reads it |
| Any Active column | Yes |
| Every other column | blank, unless SharePoint requires it; then the existing staffing row's value (fact 0.7), never an address |

**R2. Brian enters the contact.** Brian opens that row in SharePoint and types the staffing
contact's address (decision 75) into the contact column, and nothing into any CC column. Only
Brian does this. The address is never sent in chat, written in this sheet, the build report
or a commit.

**R3. BB2 checks the row,** without writing the address down: exactly one row has the key
`Rep app staffing`; its contact column holds one address; its CC column, if any, is blank;
no other Routing row was edited (each existing row's version history shows no new version).

---

## Part T: the Service Cases Test column (decision 101)

Brian, 11/14: "Add a Test column". Field (`Rep app`) and FSC app cases only are written by
this sheet; the column itself is on every case.

**T1. Add the column.** On Service Cases (site `HSBSPVAReferrals`) add Test: Yes/No, not
required, default No. Build order step 1 of sheets F1, F2 and F6 (columns first).

**T2. Existing cases read No.** After adding it, BB2 reads (Get items in ID windows, `ID ge N
and ID lt N+5000`, Top Count 5000) how many existing cases read No and how many are blank.
All No: done. Any blank: stop and ask Brian before setting them, because an edit to every
case may start a flow that fires on a Service Case edit (sheet F7, PB4). **Answered 11/14
(decision 114):** BB2 found all 68 existing cases blank (SharePoint applies a default only
to new items), and Brian said leave them ("don't change"). So on Service Cases blank and No
both mean "not TEST": every flow tests `equals(<Test>, true)` (or Filter Query `Test eq 1`)
for TEST, and no flow or report may treat only `Test eq 0` or `equals(<Test>, false)` as a
real case, which would drop the 68.

**T3. Who writes it.** Only 3F, on the case it makes: the copy's staffing branch (B9) and
3F's FSC path case create (the No side), each copying the Referrals row's Test. HSBS 3 (the
other team's path) is not changed and writes no Test. Sheet F4 (pay) and reports filter on it.

## Part U: put the stamp back when no intro went out (decision 112)

Brian, 11/14: "yes" to clearing the introduced mark when the send fails. 3F only, on its FSC
path (the No side, every company) and the staffing branch (the Yes side). HSBS 3 (the other-team sender
path, BB1's flow) is not changed and still stamps before it sends (sheet F7, S1).

Why: Mark_introduced stamps three Referrals columns before the send (fact F3-0.3). If the
send fails, the row still looks introduced, the guard blocks every retry, and no partner has
the lead. Decision 97's stuck rows were the same kind of silent loss.

**The rule:** a retry must never email anyone twice. So the stamp goes back only when no
intro went out on that run, and a send that timed out counts as one that may have gone out.

**U1. Remember what was there.** Before Mark_introduced, Compose `Before_stamp` with the
row's Introduced On, Next Update Due and Last Notified Status from the trigger body, as they
were before the stamp (blank stays blank). Mark_introduced itself is unchanged.

**U2. The FSC path (No side).** Before For_each_partner, Initialize variable `Sent_or_maybe`
(Integer, 0). Inside the loop, right after Send_intro, add Increment variable
`Sent_or_maybe` by 1, set to run after Send_intro **is successful or has timed out**. Set
For_each_partner's concurrency to 1 (sequential), so the count is exact. After the loop, a
Condition `No_intro_went_out`, set to run after For_each_partner **has failed** (not
skipped, not timed out): `Sent_or_maybe` equals 0.
- **Yes (no intro went out):** Update item on the Referrals row: Introduced On, Next Update
  Due and Last Notified Status back to `Before_stamp`'s values. Then Terminate, status
  Failed, message `Intro not sent; stamp put back`. No Service Case is made (the case create
  runs only after the loop succeeds, as today).
- **No (at least one intro went out or may have):** change nothing, then Terminate, status
  Failed. The row stays introduced so no partner gets a second intro. Run history shows the
  failure for Brian.

**U3. The staffing branch (Yes side).** It sends one intro (B5). Right after that send, a
Condition set to run after the send **has failed** (not timed out): Update item on the
Referrals row with `Before_stamp`'s three values, then Terminate, status Failed. A send that
timed out leaves the stamp, as in U2.

**Known limits** (recorded, not built):
- A send that Outlook accepts and that later bounces counts as sent. Part U does not catch it.
- A timed-out send leaves the row introduced, as today.
- **S7 (open):** putting the stamp back is itself an edit, so a trigger that fires on
  modified items (fact 0.1) picks the row up on the next poll and tries again. If the send
  keeps failing (a bad partner address in Routing), it retries every poll with no end. It
  sends nothing, since every try fails, but it fills run history. This does not block the
  TEST build (checks U1 to U4). It blocks Part D: Brian decides how retries end before the
  swap.

## Part S: HSBS 2, 2B and 3 skip `Rep app` rows (decision 103)

Brian, 11/14: "Yes, skip in all three". 3F is then the only flow that sends a `Rep app`
intro. HSBS 2, 2B and 3 are BB1's flows: BB2 asks BB1 first (decision 91, through the
conductor) and builds only on BB1's OK.

**S-1.** In each of HSBS 2, 2B and 3, add one trigger condition beside the ones it has, and
change nothing else:

`@not(equals(coalesce(triggerOutputs()?['body/<Source internal name>']?['Value'], ''), 'Rep app'))`

A row with any other Source (`PVA page`, `PVA app`, `Salesforce`, `FSC app` and the rest)
makes the condition true, so every other-team row runs exactly as before.

**S-2.** Record each save time and export each changed flow for `flows/`.

**S-3.** Part S is live in all three before Part D (D2), so no live `Rep app` row can reach
HSBS 2, 2B or 3 once the new 3F takes `Rep app` rows.

## Part B: the staffing branch in the 3F copy

Build the steps in this order. "The row" is the Referrals row 3F is handling, and `<row ID>`
is its SharePoint ID. Each column is read by the internal name and type fact 0.8 recorded
(a choice column by its `Value`).

**B0. Make the copy.** (Replaced by decision 119: sheet 3F-F builds the field copy.) Save a copy of the live 3F (Save As). Leave it off until B10. Add one
trigger condition to the copy, beside the ones it already has, so it fires only on copy test
rows:

`@and(equals(triggerOutputs()?['body/<Test internal name>'], true), startsWith(coalesce(triggerOutputs()?['body/<Practice Name internal name>'], ''), 'F3COPY'))`

It is removed at the swap (Part D, step D2).

**B0b. Widen the copy's Source condition** (replaced by decision 119: sheet 3F-F sets the copy's conditions; decision 100, "Reuse 3F"). In the copy only,
change the existing trigger condition on Source from `FSC app` to `FSC app` or `Rep app`:
`or(equals(<Source value>, 'FSC app'), equals(<Source value>, 'Rep app'))`. The Route
`Direct to partner`, Introduced On and SystemEditAt conditions stay as they are. 1R writes
Route `Direct to partner` on every `Rep app` row (sheet F1, F1.4 rule 7), so every rep app
row meets the Route condition. Test handling (Test_mode) and the Service Case create are
3F's own. The widened condition stays at the swap (D2).

**B0a. Make the live 3F skip copy test rows.** (Dropped by decision 119: the live 3F gets no edit.) This is the one edit to the live 3F before the
swap. Do it at a quiet time and record when it was saved. Add one trigger condition, beside
the ones it already has, and change nothing else:

`@not(and(equals(triggerOutputs()?['body/<Test internal name>'], true), startsWith(coalesce(triggerOutputs()?['body/<Practice Name internal name>'], ''), 'F3COPY')))`

A live row has Test = No, so this condition is always true for it and the live 3F handles
every live row exactly as before. Only a Test row whose practice name starts with `F3COPY` is
skipped. With B0 and B0a, each TEST row is handled by one flow only, so the two never share a
guard (fact 0.3) or race to stamp it. Right after saving, run the D3 audit for the window
from one minute before the save to one minute after it. Check 0 confirms the split.

**B1. The one condition.** At the point fact 0.2 recorded (top level, before any email or
write step, outside any loop), add a Condition named `Rep app staffing row`. It is true when
both hold:

- the row's Source value equals `Rep app`, and
- Solutions holds exactly one value and that value equals the staffing value, compared as
  the whole string. For a multi-choice Solutions (fact 0.8):
  `length(<Solutions>)` equals `1` and `first(<Solutions>)?['Value']` equals
  `HS Staffing / Recruiting Services (including GoTu)`. For a text Solutions: the value
  equals that string.

**No** side: empty. The run carries on to today's steps, unchanged. Every HealthFirst rep app
row, every pilot FSC app row and every other row takes this side, so its emails and writes are
exactly today's.

**Yes** side: steps B2 to B9, in order. The Yes side ends with Terminate, status Succeeded, so
today's steps never run for this row.

**B2. The guard.** Check the guard from fact 0.3 the same way today's path checks it. If it is
already set: send nothing, write nothing, Terminate, status Succeeded.

**B3. Read the staffing contact.** Get items on Routing, Filter Query
`<key column internal name> eq 'Rep app staffing'`, Top Count 1. Read only the contact
column.

- No row, or the contact column is blank: send no intro and no receipt. Send Brian one email
  (on a Test row, to the TEST inbox instead), subject
  `No staffing contact on Routing: referral <row ID>`, body
  `3F found no staffing contact on the Rep app staffing Routing row, so no intro went out for referral <row ID>. Fill in the contact, then resubmit this run.`
  Do not stamp the guard and write nothing else. Terminate, status Failed.

**B4. Read the role.** Get items on the Rep Roster, Filter Query
`<Rep Email internal name> eq '<the row's Referring Rep Email, lowercased, with ' as ''>'`,
Top Count 1. Compose `Role words`:
`if(equals(<Role value>, 'RM'), 'RGM', <Role value>)`, where `<Role value>` is that roster
row's Role choice value, or `''` when there is no row or no role (wrap it in `coalesce(..., '')`).

**B5. Recipients.** Add a Compose named `Live recipients` that holds the three live addresses,
one per line: the contact from B3, the row's Referring Rep Email, and Brian's address from the
same source today's 3F uses for Brian (fact 0.4; if 3F has none, the source another HSBS flow
uses for Brian, recorded by flow and step; never typed from memory). This Compose is for the
run history and the checks only; nothing is sent from it. Then set each send's recipients:

| Email | Slot | Live row (Test = No) | Test row (Test = Yes) |
|---|---|---|---|
| Intro | To | the contact from B3 | the TEST inbox (fact 0.6) |
| Intro | CC, or BCC if fact 0.4 shows the rep there today | the row's Referring Rep Email | the TEST inbox |
| Intro | CC, or BCC if fact 0.4 shows Brian there today | Brian | the TEST inbox |
| Receipt (receipt on only) | To | the row's Referring Rep Email | the TEST inbox |

Test is read from the row's Test column, never from a name. No other address goes on either
email. Receipt off: skip B8.

**B6. Compose the fields.**

- `Practice type words`:
  `if(equals(<Practice Type value>, 'Group'), 'Group (3 or more locations)', if(equals(<Practice Type value>, 'Private practice'), 'Private practice', 'Not set yet. Please set it on your update page.'))`,
  where `<Practice Type value>` is the row's Rep Practice Type choice value (`RepPracticeType`,
  sheet F1's F1.1 ruling, 11/14; never BB1's `Practice_x0020_Type`), or `''` when blank.
  Read it from the Referrals row, which keeps the rep's pick (7B never writes it, sheet F1,
  F1.6 rule 6).
- `Star line`:
  `if(endsWith(<Consenttext>, '*'), '* Direct Dental may void this referral if the customer did not give permission to be contacted about this service.', '')`.
- `Sent by`: the row's Referring Rep; then, when `Role words` is not `''`, a comma, a space
  and `Role words`; then a comma, a space and the row's Referring Rep Email.
- `Email words`: the row's Doctor Email, or `Not given` when it is blank.

Insert every row value (`Consenttext`, Note and the rest) the same way today's HealthFirst
intro inserts it (same encoding, same line breaks), so the stored words reach the email
unchanged.

**B7. Send the intro.** The same send action, mailbox and format (HTML or text) today's
HealthFirst rep app intro uses (fact 0.4), with the recipients from B5.

Subject, on a live row:

`Staffing referral: <Practice Name>, from <Referring Rep>`

On a Test row the subject is `TEST: ` followed by the same words.

Body, line for line. Angle brackets name a value; everything else is typed exactly:

```
Hello,

<Referring Rep> at Henry Schein sent Direct Dental a staffing referral. Please call the point of contact within 24 hours.

Need: Staffing
Practice: <Practice Name>
Practice type: <Practice type words>
Point of contact: <Customer Name>
Best phone: <Customer Phone>
Email: <Email words>
Best way to reach them: <Preferred Contact>
JDE #: <JDEAccount>

The customer's permission, as saved with the referral:
<Consenttext>
<Star line>

Notes: <Note>

Sent by: <Sent by>

Thank you.
```

- `Need` is the fixed word `Staffing` (decision 86: Staffing only). It is not read from Note.
- When `Star line` is `''`, leave its line out.
- `Notes: <Note>` is the row's Note as stored (the needs line, then the rep's notes),
  inserted as today's HealthFirst intro inserts Note.
- There is no link of any kind (rule 6). Even if today's HealthFirst intro has a partner
  page link, do not copy it here.
- There is no call first line: the staffing form always sends `contactFirst` false.
- There is no dollar amount, no other-team name, and nothing about pay.

**B8. Send the rep's receipt (receipt on only).** Same send action, mailbox and format as
today's HealthFirst receipt (fact 0.4), To from B5.

Subject: `Sent to Direct Dental: <Practice Name>` (on a Test row, `TEST: ` followed by the
same words).

Body:

```
Sent to Direct Dental.

Direct Dental's team will call <Customer Name> at <Practice Name>.

Practice type: <Practice type words>
Best way to reach them: <Preferred Contact>

You can follow this referral on Track in your app.
```

No dollar amount (rep app spec v3, D15), and no link: the rep's app link holds their key.

**B9. The writes.** Make the writes fact 0.5 recorded: the same columns, the same values and
the same order as today's HealthFirst path writes them for its case, in the same place
relative to its emails, including the guard stamp from fact 0.3. The safe way: copy those
write steps from today's path (Copy to my clipboard) into the Yes side and change nothing in
them, then add Part U's U3 after the branch's send. Then Terminate, status Succeeded.

Today's 3F writes are in fact 0.5's result: Introduced On, Next Update Due and Last
Notified Status on the Referrals row before the send, and the Service Case create after
it. There is no rep app HealthFirst path to copy from (stop item S2), and the stamp comes
before the send (stop item S4). 1R makes no Service Case (fact R1), so the case's Practice
Type is set here. Build: the copied Service Case create also writes Practice Type, copied
from the row's Practice Type (sheet F1, F1.4 rule 4). Neither 3F nor HSBS 3 writes Test on
the case, and Service Cases has no Test column today. Build (decision 101): the copied
Service Case create also writes Test, copied from the Referrals row's Test, into the Part
T column. The same Test write goes on the case create of 3F's FSC path (the No side), so
every field or FSC case 3F makes carries the row's Test.

**B10. Turn the copy on.** It runs only on copy test rows (B0), and the live 3F skips them
(B0a). The checks read the copy's run history unless they say otherwise.

### Words that never appear in either staffing email

`HealthFirst`, `OSHA`, `HIPAA`, `GoTu`, `HS Staffing`, `Henry Schein Staffing and Recruiting`,
`Recruiting`, `PVA`, `HSPA`, `HSRA`, `NumbersIQ`, `sell my practice`, `http`, `/leads/`, a `$`
sign, an em dash or an arrow character. Direct Dental is spelled exactly. The Solutions value
is never printed.

---

## What must not change

- The No side of the B1 condition is empty, and every step after it is today's, apart from
  the Test write on the case create (decision 101) and Part U's put-back (decision 112,
  which changes no send, word or recipient): the pilot FSC app intro for every
  company (staffing included), and, since decision 100, a HealthFirst `Rep app` row.
- The live 3F's only edit before the swap is the B0a trigger condition, which skips nothing
  but copy test rows.
- HSBS 1R (beyond what sheets F1 and F5 build on its copy), 7A, 7B and HSBS 9 are not
  edited by this sheet. HSBS 2, 2B and 3 get only the one Part S trigger condition each
  (decision 103); every other-team row runs through them exactly as before.
- No existing Routing row and no Partner Links row is edited.
- No new recipient anywhere except the spec's three on the staffing branch, and no link in
  either staffing email.

---

## TEST checks (TEST rows only; each is pass or fail)

Make each copy test row by posting the body above to the F1 1R copy (prerequisite P3) with a
TEST rep's key (Rep Roster Test = Yes), a new `submissionId` each time, and a practice name
that starts with `F3COPY TEST`. Read each email in full where fact 0.6 says. Record no
address: write "TEST inbox", "Brian", "matches" or "does not match".

0. **One flow per TEST row.** A copy test rep app HealthFirst row: the copy's run history has
   one run for it and the live 3F's has none (the live 3F does not take `Rep app` rows). An
   ordinary TEST pilot FSC app row with route `Direct to partner` (practice name `TEST ...`,
   no `F3COPY`): the live 3F has one run and the copy has none. Both new rows have Test =
   Yes, and the copy's case for the first has Test = Yes (decision 101).
1. **Routing row.** Step R3 passes: one row with key `Rep app staffing`, one address in its
   contact column, its CC blank, no existing Routing row edited.
2. **One intro to the right three.** A copy test staffing send with `Private practice`, from
   a TEST rep whose Role is `FSC`: the copy's run history shows exactly one run for that row,
   down the Yes side of B1, and the live 3F shows none. That run sent exactly one intro, and,
   if receipt on, exactly one receipt (receipt off: no receipt). Every To, CC and BCC on the
   emails it sent is the TEST inbox, in all three intro slots. `Live recipients` holds exactly
   three addresses: the first matches the contact on the `Rep app staffing` row, the second
   matches the TEST rep's Rep Email on the Rep Roster, the third is Brian.
3. **The intro's fields.** In check 2's intro: the subject is
   `TEST: Staffing referral: F3COPY TEST Staffing Dental, from <TEST rep's name>`; the body has
   the line `Need: Staffing`, the line `Practice type: Private practice`, the line
   `Point of contact: TEST Office Manager`, `Best phone:` with the posted phone,
   `Email: Not given`, `Best way to reach them: Call`, and `JDE #: 001234` (leading zeros
   kept); the line under "The customer's permission" is exactly
   `The customer gave permission for Direct Dental to contact them about staffing.*`, and the
   next line is exactly the star line; `Sent by:` shows the TEST rep's name, `FSC` and their
   roster email. If receipt on: the receipt's subject is
   `TEST: Sent to Direct Dental: F3COPY TEST Staffing Dental` and its body is the B8 words with
   those values. If receipt off: check 2 found no receipt.
4. **Group and RGM.** A copy test staffing send with `Group` from a TEST rep whose Role is
   `RM`: the intro says `Practice type: Group (3 or more locations)` and `Sent by:` shows
   `RGM`, never `RM`.
5. **Banned words, no link.** No email from checks 2 and 4 contains any word in "Words that
   never appear": no link of any kind and no dollar amount.
6. **Writes.** The copy set the same columns on the check 2 row and its Service Case that the
   live 3F set on baseline row (a) (fact 0.11; fact 0.5), with the same values apart from
   dates and times, and the guard from fact 0.3 is set.
7. **Once only.** A repeat post of check 2's `submissionId` makes no second row and no second
   intro. If the trigger fires on modified items (fact 0.1), an edit to the check 2 row's Note
   makes no second intro.
8. **Blank practice type.** Only if fact 0.1 shows 3F starts on a row made in the SharePoint
   New form: BB2 adds a copy test rep app staffing row by hand (Test set first, Practice Type
   blank, as sheet F7 does) and its intro says
   `Practice type: Not set yet. Please set it on your update page.` Otherwise this check is
   recorded as not run, and sheet F7's check 10 covers it.
9. **No contact.** In the copy only, BB2 changes B3's key to `Rep app staffing missing`
   (no such row) and sends one copy test staffing row: no intro and no receipt went out, one
   notice went to the TEST inbox with the B3 subject, the guard is not set, and the run status
   is Failed. BB2 then sets the key back to `Rep app staffing` and sends a new copy test
   staffing row: one intro, and, if receipt on, one receipt (receipt off: none), and the
   guard is set.
10. **HealthFirst rep app row.** A copy test rep app HealthFirst send: the copy's run goes
    down the No side and sends one intro by 3F's FSC path (baseline (a) is "sent nothing":
    the live 3F does not take `Rep app` rows). BB2 records its subject, body and recipients
    for stop item S2's open part; the check passes only once Brian has ruled on them.
11. **Pilot FSC app unchanged.** A copy test pilot FSC app send to staffing, route
    `Direct to partner`: the copy's run goes down the No side, and its intro has the same
    subject, body and recipients as baseline (b), apart from the row's own values.
12. **Nothing else edited.** 7A, 7B and HSBS 9 have no new version since Step 0. HSBS 2,
    2B and 3 each have exactly one new version, the Part S condition, and nothing else
    changed in them. No existing Routing row and no Partner Links row has a new version since Step 0.
    The live 3F has exactly one new version, B0a, whose only change is the added trigger
    condition.
13. **No live email.** For every check above, every To, CC and BCC on every email the copy
    sent is the TEST inbox, never a real partner, rep, manager or other-team sender, or the address on the
    `Rep app staffing` row. 3F's test-path address is Brian's own (v2 check 3), so on this
    flow "the TEST inbox" is that address. The live 3F's runs (check 0's ordinary row) mailed no real partner,
    rep, manager or other-team sender.

14. **Test column** (decision 101). Service Cases has Test, Yes/No, default No (T1), and T2
    found no blank existing case. The check 2 case and the check 0 rep app case each have
    Test = Yes, copied from their Test = Yes rows. A copy test pilot FSC app case (check 11)
    has Test = Yes too.
15. **Rep app skip** (decision 103). For each of HSBS 2, 2B and 3: the saved definition has
    the S-1 condition and no other change (compare exports before and after). A TEST
    `Rep app` row starts no run of any of the three. If a flow's existing Test skip is
    also a trigger condition, a TEST row alone cannot show which condition stopped it:
    BB2 records that and relies on the export comparison for that flow.
16. **other-team rows unchanged** (decision 103 scope). A TEST `PVA page` row and a TEST
    `PVA app` row run HSBS 2, 2B and 3 exactly as before Part S (each run, or each skip for
    Test, is the same as on a baseline TEST row of that Source made before S-1).

17. **U1, no intro, stamp back** (decision 112). No Routing row is edited (check 12). In
    the copy only, as check 9 does, BB2 changes Send_intro's test-path To to an address the
    send action refuses (record the error text, not the address), and sends one copy test
    pilot FSC app row to one partner. The run ends Failed with `Intro not sent; stamp put
    back`. Introduced On, Next Update Due and Last Notified Status read as before the run.
    No Service Case was made. No email reached anyone.
18. **U2, retry sends once.** BB2 puts the copy's test-path To back. The next run (the poll
    after the put-back edit) sends exactly one intro and makes exactly one Service Case.
    Then the row is introduced and no further run starts.
19. **U3, one of two failed.** In the copy only, BB2 makes the test-path To refused for one
    named partner only (an `if` on the loop's current partner), and sends a copy test pilot
    FSC app row to two partners: one intro went out, the run ends Failed, and the row stays
    introduced (no second intro to the first partner, on that poll or later).
20. **U4, success untouched.** With the copy's To back as it was: Check 2's ordinary staffing send and check 11's FSC send:
    the stamp stays, and neither the Condition's Yes side nor any put-back ran.

21. **U3, staffing send fails** (Codex, #154). In the copy only, BB2 changes the staffing
    branch's send (B5) so its To is an address the send action refuses (record the error
    text, not the address), and sends one copy test rep app staffing row. The run ends
    Failed. Introduced On, Next Update Due and Last Notified Status read as before the run.
    No Service Case was made. No email reached anyone. Then BB2 puts the To back: the next
    run (the poll after the put-back edit) sends exactly one staffing intro and makes
    exactly one Service Case, and no further run starts.

Checks 0 to 9, 13, 14, 15 and 17 to 21 pass, 11, 12 and 16 show no change (Part U
aside), and check 10 has Brian's ruling (stop item S2), before Part D. Part D also waits
on S7.

---

## Part D: the swap (only on Brian's go)

(Replaced by decision 119: no swap. See the decision 119 section near the top for going live.)

Prerequisites: every check passes; sheet F1's 1R change is live (so a live staffing row has a
Practice Type); `REP_APP_COMPANIES` does not yet list `Staffing` on production, so no live
rep app staffing row can arrive during the swap. Brian gives the go in chat, in his own words.

- **D1.** Record the time. Turn the live 3F off. It is kept, with its B0a condition, as the
  rollback copy.
- **D2.** Remove the B0 condition from the new 3F, so it has the old 3F's trigger
  conditions (fact 0.1) with the Source condition widened by B0b to `FSC app` or `Rep app`
  (decision 100). Part S must already be live in HSBS 2, 2B and 3. Turn the new 3F on,
  within one minute of D1. Record the time.
- **D3. The gap audit.** On the watched list (fact 0.1), list every item whose trigger event
  falls between the D1 and D2 times: Created in that window for a created-items trigger; Created
  or Modified in that window for a created or modified trigger. Keep only the items the new
  3F's trigger conditions (after D2) would pick, and for each record whether the
  guard (fact 0.3) is set. Report every item whose guard is blank to Brian by its ID. Resend
  nothing without his OK.
- **D4.** One ordinary TEST staffing send (practice name `TEST ...`, no `F3COPY`) on the new
  live 3F: exactly one run, exactly one intro, and, if receipt on, one receipt (receipt off:
  none), every address the TEST inbox; the old 3F has no run. One ordinary TEST HealthFirst
  send: exactly one run of the new 3F and exactly the intro Brian approved in check 10
  (stop item S2), every address the TEST inbox; the old 3F has no run. Baseline (a) sent
  nothing, so it is not the bar here. D4 cannot pass until Brian has ruled on S2.
- **D5.** Export the new 3F's definition and clean it as `flows/README.md` says, for Claude
  to commit and Codex to review against this sheet.

Only after D4 passes does Brian add `Staffing` to `REP_APP_COMPANIES` (slice S3). This sheet
does not turn staffing on.

## Rollback

1. **Pause every rep app send first.** After Part S, the new 3F is the only intro path for
   `Rep app` rows, HealthFirst as well as staffing: HSBS 2, 2B and 3 skip them, and the old
   3F takes only `FSC app` rows. Taking `Staffing` out of `REP_APP_COMPANIES` is not
   enough, because an empty `REP_APP_COMPANIES` still means HealthFirst. So Brian sets
   `REP_APP_ENABLED` off in Vercel and redeploys production (an env change takes effect
   only on a new deployment). With it off the whole rep app is off: Send, Track, My
   Earnings and My Team. Confirm the redeploy is live (a rep link no longer opens the app)
   before step 2. (Codex P1 on #151, 11/14.)
2. Record the time. Turn the new 3F off and the old 3F on, within one minute, and record the
   time. Run the D3 audit for that window. The old 3F's B0a condition may stay: it skips only
   copy test rows.
2a. The rep app stays off until a 3F that sends the HealthFirst intro for `Rep app` rows is
   back on and passes D4 again. Then Brian sets `REP_APP_ENABLED` on and redeploys.
3. The `Rep app staffing` Routing row may stay: nothing reads it once the old 3F runs. Brian
   decides whether to clear the address on it. No existing Routing row was changed, so none
   needs restoring.
4. BB2 deletes the TEST rows and their Service Cases when the checks are done (decision 48).
5. Intros that went out stay sent. No row is edited to undo one.

## Spec clause to sheet step

| Spec clause | Sheet step or check |
|---|---|
| 9 F3: 3F, the intro for a staffing row from the rep app | B1; checks 2, 10, 11 |
| 9 F3: practice type, in the words the rep picked on the screen (section 4 labels) | "Practice type words"; B6; checks 3, 4, 8 |
| 9 F3: point of contact | B7 `Point of contact:`; check 3 |
| 9 F3: the consent text, word for word (section 4) | "The consent words"; B6, B7; check 3 |
| 4: the asterisk line under the form | "The star line"; B6; check 3 |
| 9 F3: the need "Staffing" (section 4 submit body; decision 86) | B7 `Need: Staffing`; checks 3, 5 |
| 9 F3: recipients, the staffing contact from Routing, the referring rep, Brian; nobody else | Rule 4; Part R; B3, B5; checks 1, 2, 13 |
| 9 F3: new recipients need Brian's OK; decision 75 | P1; Part R (Brian types the address, R2) |
| 4 and T14: Direct Dental is the name shown; never "Henry Schein Staffing and Recruiting" | B7, B8; "Words that never appear"; check 5 |
| 4: no "OSHA and HIPAA compliance" on a staffing intro | "Words that never appear"; check 5 |
| 4: the rep's identity from the roster, never the page | B4, B5 read the row and the Rep Roster; check 2 |
| Decision 81: the sender by roster role, RM shown as RGM | "Role words"; B4; checks 3, 4 |
| 12: no email recipient added, nothing live | Rules 3 and 4; check 13 |
| Section 6 (Test) and 9 F5: a Test row's mail goes only to the TEST inbox; 1R sets Test from the Rep Roster | Rule 3; P3; fact 0.6; B5; checks 0, 2, 13 |
| HealthFirst and other-team intros unchanged | Rule 7; B0a; B1 No side; "What must not change"; checks 10, 11, 12 |
| Rep app v3 D15: no dollar amount in a rep email | B8; check 5 |
| Threat model T2 and T5: no partner key where a rep can see it | Rule 6; B7; check 5; fact 0.10 |

## Open items

The three items this sheet first asked (who gets the rep app staffing intro, the update
page link, and the words) were ruled 11/13; see the top of this sheet. Stop items S1 to S6
(from the step 1 facts, 11/13): S1, S3 and S5 were decided by Brian on 11/14 (decisions
100, 103, 101) and most of S2 by decision 100. S4 was decided 11/14 (decision 112, Part
U), which raised S7. S2's open part, S6 and S7 still wait on Brian.
