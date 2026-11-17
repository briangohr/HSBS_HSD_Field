# Field two-track app: team members and managers (v1)

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and the other team's exact list and column names are only in the old repo's copy.

Created: November 12, 2026
From: Claude (conductor chat), for Brian
Status: Approved by Brian, 11/13/2026 ("approve the spec"). The site slices in section 10 may be built. Pay stays off, every page stays on test, and nothing goes live without Brian's go.
Builds on: `docs/build/healthfirst-rep-app-spec.md` (v3, approved) and `docs/build/rep-app-flow-contracts.md`.
Everything there stands unless this file changes it.

## What Brian asked for (11/12)

"Ideally I want it to have 2 tracks. The manager does everything a team member can but also
can track their teams referrals and see their money along with their teams individual and
group earnings. The FSC, AE can easily input leads, track status and see what they made. For
the near term, only health first and staffing will be shown but will still have the backend
ready for the remainder of the companies for when I want to turn it on. All leads go to the
partners directly."

Then: "extend the rep app, write the spec".

## Decisions this rests on (Brian, 11/12, in chat)

| # | Decision | Brian's words |
|---|---|---|
| T1 | Build it by extending the HealthFirst rep app, not the field app | "extend the rep app, write the spec" |
| T2 | Field people get no practice value box. No field lead goes to the other team. Decision 30 (value route to Jim Higgins) is dropped | "Remove it" |
| T3 | Staffing pays the sender $100 for a private practice and $200 for a group with 3 or more locations (T25) | "two spiffs and both on a qualified introduction $100 for a Private practice $200 for Groups greater than 3 locations", then "3 or more equals $200" |
| T4 | To send a staffing referral the rep enters the point of contact and ticks a permission box. An asterisk says the partner may void it | "Rep inputs the point of contact and then selects the check box that states the customer has provided permission for the partner to contact them. There should be an asterisk that says the partner has the discretion to void the referral if the customer did not give permission to contact them about the service." |
| T5 | Nothing pays at send. HealthFirst and staffing both pay after the partner reaches the customer | "Both pay only after the partner reaches the customer" |
| T6 | The rep picks private practice or group. The staffing partner can correct it. The partner's answer sets the pay | "Rep picks, partner can correct" |
| T7 | The manager gets $50 on a team member's staffing referral, paid when staffing closes the deal | "Same amount to the manager as healthfirst" and "When staffing closes the deal" |
| T8 | The new app has no route that hands a lead to the other team. The pilot FSC app keeps its own (decision 42), untouched | "No [other-team] route in the new app" |
| T9 | It goes to all 30 RGM teams at once | "All 30 RGM teams" |
| T10 | An AE is a team member, built like an FSC. AEs are a separate group from the FSCs | "AE's are the same as FSC's they also have a manager. Check the roster to see who it is." Then, when the roster did not show them under an RGM: "AE's are a separate group but similar to FSC's just build them out like an FsC" |
| T12 | This build is a written exception to the launch freeze, and it is switched on when ready | "Yes, and switch on when ready" (build now, turn on before December 4 once the TEST checks pass and Brian gives the go) |
| T13 | The staffing partner pays the staffing awards | "The staffing partner pays" |
| T14 | Reps and customers see the staffing partner as Direct Dental | "Direct Dental" |
| T15 | The first load is RGMs and FSCs. Equipment Specialists are not included | "FSCs only for now" |
| T16 | The partner update page has a spot where the partner marks whether the lead qualifies. The sender is paid only when the partner has reached the customer and marked it qualified. "Does not qualify" pays nothing and shows the partner's reason. This replaces a separate no-permission choice | "The partner update will allow for a spot that give the partner the ability to select if the lead qualifies or not", then "Reached and qualified" |
| T17 | The qualify step applies to HealthFirst and staffing alike. This changes rep app v3, which paid HealthFirst at reached alone | "Both partners" |
| T18 | When a partner stays silent, nothing pays and the case is flagged to Brian. The 5 day held award (rep app v3, D10) is retired for both partners | "Nothing pays; flag it to me" |
| T19 | RGMs and their FSCs may be added to the Rep Roster. This lifts the 11/12 rule (`AGENTS.md` rule 19) that a field person is never added to the FSC or Rep roster | "Yes, add them" |
| T20 | Every FSC gets the new app and every RGM gets their own, pilot FSCs included. A person having two links is accepted | "There actually is only four and only one of those has actually tried to send something in, so I'm not worried about people having more than one app as far as I'm concerned, every FSC gets this one and every RM gets their own" |
| T21 | The not-qualified reasons are "No permission to contact" and "Other" | "Those two are enough" |
| T22 | A hand back goes to HSBS with a note and Brian sorts it. It changes no pay by itself. Some hand backs are really a lead for the other partner | "There may be instances where a customer was looking for staffing and they got routed to health first and vice versa, so the handback might not necessarily be a handback as much as it is handback to to another partner. so for that purpose, just have a handback to HSBS with a note and I'll filter through those" |
| T23 | When Brian sends a handed-back lead on to the other partner, the rep who sent it earns under that partner's rules | "Yes, the rep earns" |
| T24 | A lead from an RGM's public page pays nobody. Only leads sent from a rep's or manager's own app earn | "Right, they pay nobody" |
| T25 | A group is 3 or more locations. A practice with 3 locations earns the $200 award | "3 or more equals $200" (11/13) |
| T11 | HealthFirst pay is close to $100 to the rep at reached and $50 to the manager at closed won, not final | "The healthfirat is going to be something like that" |

Earlier decisions this changes: 25 and 31 (full partner list on a field person's app), 30
(value route), the 11/11 rule that a field value box points to the other team, and the #103 rule of
no money on an RGM's My Team. Decision 42 stands for the pilot FSC app only.

## 1. The outcome in one table

| | Team member (FSC, AE) | Manager (RGM) |
|---|---|---|
| Send a referral to HealthFirst or staffing | Yes | Yes |
| Track their own referrals | Yes | Yes |
| See what they made | Yes | Yes |
| See each team member's referrals and earnings | No | Yes |
| See the team's total earnings and their own manager pay | No | Yes |

A manager is a team member with one more tab. That is how the rep app already works: Send,
Track, My Earnings, and My Team for anyone who is the manager on Brian's Team Roster (D18).

## 2. How it is built: what is reused and what is new

Reused as built (rep app v3): the personal link, sign-up at /join, Send, Track with a lead
screen, My Earnings, My Team with team and per-person numbers, the pay ledger, the rule
that the Team Roster alone decides who manages whom, and the two switches
(`REP_APP_ENABLED`, `REP_PAY_ENABLED`).

New in this spec:

1. A second company on the Send tab (staffing), and a switch for which companies show.
2. A practice type on a staffing referral, which the partner can correct.
3. A pay plan per company, with the staffing amount set by practice type.
4. A company on every ledger row, so screens and totals can say which company paid what.
5. A qualify step on the partner page: the partner marks each lead Qualified or not, and
   only a reached and qualified lead pays (T16).
6. RGMs and their teams loaded onto the rep app.
7. Field landing pages (`/rgm/<slug>`) lose the value box and show two boxes.

## 3. People and links

- **Team members and managers are both rows on the Rep Roster.** One link each, the rep app.
- **Who manages whom** comes only from Brian's Team Roster (D18). An RGM is a manager because
  team members' rows name the RGM. Nothing else makes anyone a manager.
- **AEs** (T10): the September 16 roster does not match this. Its only "AE" title is Area
  Executive: 3 people, one per area, each over about 10 RGMs. No AE on the roster reports to
  an RGM. The closest other title is Area Sales Executive (7 people on the Strategic Accounts
  tab, reporting to a Strategic Accounts director, not an RGM). Brian, 11/12: AEs are a
  separate group, built like an FSC. So an AE gets the same team member app, with nothing
  AE-specific in the build: a Rep Roster row (Role "AE", which /join already offers) and,
  where they have one, a Team Roster row naming their manager. Their manager gets My Team
  the same way an RGM does, RGM or not. The list of AEs and their managers is not in the
  repo (section 11 item 1). Until Brian supplies it, the first load is the 30 RGMs and
  their FSCs.
- **The manager on a roster row is matched by email, not name.** The roster spells two RGMs
  differently on different tabs, and matching by name leaves 23 FSCs with no manager. A team
  member with no manager on the Team Roster can send and earn, but that sign's manager
  award is void for good (rep app v3), so the pairs are loaded and checked before go-live.
- **RGMs today** have a field entry in `src/data/field.mjs` (old repo) and an other-team roster row, which opens
  the field app. Under this spec an RGM also gets a Rep Roster row with its own new key.
  1R finds a person by key, so the two links do not collide: the old key still opens the
  field app, and the new key opens the rep app. This changes `AGENTS.md` rule 19 ("never
  added to the FSC or Rep roster"). Brian approved that rule change on 11/12 (T19).
- **Switching off must restore today.** The RGM rows on the other team's roster are not retired when
  the new links go out. With `REP_APP_ENABLED` off, the new keys answer "This link does not
  work" and every old RGM link works exactly as on `main`. The old rows are retired by a
  separate build sheet only after Brian says the new app is staying, and that step is not
  part of this spec's go-live.
- **Pilot FSCs are loaded like every other FSC** (T20). An FSC who already has a pilot link
  on the FSC Roster keeps it and also gets a Rep Roster row with a new key. 1R finds a
  person by key, so each link opens its own app and neither blocks the other. Brian accepts
  the two links. A referral sent from the pilot FSC app is not a "Rep app" row, so it
  earns nothing (section 8's rule), though it does count in the 12 month look-back, because
  the pilot app stores a JDE. The
  repo's docs speak of 26 pilot FSCs; Brian says four are active. The load does not depend
  on the number.
- **The field app** (the one-screen form on a field key) is no longer any RGM's app once the
  RGM has a rep link. Its code stays until a later cleanup. Decision 29 (the FSC pick list on
  that form, PR #110) has no user under this spec (section 11 item 3).
- **Rollout** (T9): all 30 RGM teams. The September 16 roster lists 560 Field Sales
  Consultants and 109 Equipment Specialists under the 30 RGMs in `src/data/teams.mjs`.
  The first load is the 30 RGMs and all 560 of their FSCs, pilot FSCs included (T20). Equipment
  Specialists get no link in this load (T15). The Strategic Accounts and Digital Workflow
  staff report to people who are not RGMs, so they are outside "all 30 RGM teams".

## 4. Send

The Send tab opens on a choice of company. Only companies that are switched on show.

**Switch.** A new setting, `REP_APP_COMPANIES`, lists the companies the rep app offers. Unset
means HealthFirst only, which is today's app. `HealthFirst,Staffing` shows both.
Those two words are the company keys, spelled exactly, and one table maps each key
everywhere it is used:

| Company key | Solutions value on the row (unchanged from today) | Name on screens |
|---|---|---|
| `HealthFirst` | `HealthFirst` | HealthFirst |
| `Staffing` | `HS Staffing / Recruiting Services (including GoTu)` | Direct Dental |

The key is what `REP_APP_COMPANIES`, the pay plan settings and the ledger's Company column
hold. The Solutions value is what the submit sends in `companies` and what Referrals and
Service Cases store, exactly as the FSC app sends it today. The site and HSBS 10 turn one
into the other with this table and nothing else. A row whose Solutions value is not in the
table has no key, so it has no plan and shows no dollars. The other
HSBS companies are defined in the same list in code, each off until its name is added. A
company with no form defined cannot be switched on. The server refuses a company that is
not switched on, whatever the page sends.

**The switch gates sending only.** It decides which companies the Send tab offers and which
the server accepts on a new send. It never hides a referral or an award that already
exists. If staffing is switched off after staffing referrals were sent, those referrals
stay on Track, their ledger rows stay on My Earnings and My Team, and every total still
equals the ledger. Their status and pay rules keep running in the flows.

**One referral, one company.** A doctor who needs both gets two sends. Each makes its own
Referrals row and Service Case, so each has its own status and its own pay. The server
enforces it: a rep app submit must name exactly one company, and that company must be
switched on. A request naming none, two, or one that is off is refused, whatever the
browser posts, because the consent on each form names one partner only.

**HealthFirst form:** unchanged from rep app v3.

**Staffing form,** top to bottom:
- Header: "Staffing referral" and "Sending as [rep name]."
- Pay line (only when pay is on and a staffing plan is set): "You earn $100 for a private
  practice, or $200 for a group with 3 or more locations, when Direct Dental reaches
  the customer and confirms the lead qualifies."
- Fields: Point of contact (name), Practice name, JDE # (required, stored as text), Best
  phone, Email (optional), Best way to reach them (Call / Text / Email), Practice type
  (required, two choices), Notes (optional).
- Required checkbox: "The customer gave permission for Direct Dental to contact them
  about staffing.*" Saved word for word in Consent text.
- Under the form: "* Direct Dental may void this referral if the customer did not give
  permission to be contacted about this service."
- Button ends in "Send to Direct Dental."

**Practice type has two stored values, spelled exactly:** `Private practice` and `Group`.
Those two strings are the value in the request, the Referrals and Service Cases choice
columns, the partner page and the ledger. The screen labels are "Private practice" and
"Group (3 or more locations)"; the label is display only and is never stored. Any other
value is refused by the server.

Direct Dental is the name the rep and the customer see (T14).

**Submit body:** the rep app submit, with `companies` set to the staffing Solutions value
that exists today, `needs` set to `["Staffing"]` (the staffing label the FSC form already
uses, in place of the rep app's HealthFirst need "OSHA and HIPAA compliance"), `route` "Partner", `referrerRole` "Rep", `source` "Rep app", and one new
field, `practiceType` (`Private practice` or `Group`). The rep's name and email still come
from the Rep Roster row, never the page.

Every lead goes to the partner directly (HSBS 3F). No one outside the field build is named or copied (T2, T8).

## 5. Track

Same compact rows and lead screen as rep app v3. The status words are a table per company.
HealthFirst's words do not change when staffing is switched on.

| What the list sends | HealthFirst row (rep app v3, unchanged) | Staffing row |
|---|---|---|
| Sent, or no partner save yet; Not yet, haven't tried | Sent to HealthFirst | Sent to Direct Dental |
| Not yet, still trying | HealthFirst is reaching out | Direct Dental is reaching out |
| Yes to question 1 | HealthFirst talked with the doctor | Direct Dental talked with the customer |
| Meeting set | Meeting set | Meeting set |
| Proposal or agreement sent | HealthFirst sent a proposal | Direct Dental sent a proposal |
| No change this week | HealthFirst is working on it | Direct Dental is working on it |
| Signed | Signed and billed | Signed |
| Marked not qualified | Closed: did not qualify ([reason]) | Closed: did not qualify ([reason]) |
| Closed, any other reason | Closed: [reason], as rep app v3 | Closed: [reason] |

Today the code falls back to "HealthFirst" in several places; each becomes the row's own
company from the key table in section 4.

**The qualify answer and the closed reason reach Track as values, not as text.** Today the
list answer carries the case status and no reason, and the site never reads the partner's
typed note as a status. Sheet F6 adds three fields per case to the list and team answers:
`qualified` (`Yes`, `No` or blank), `notQualifiedReason` (the choice as stored, for example
`No permission to contact`) and `closedReason` (the Closed Reason choice as stored, for
example `Already a customer`). The site maps those values to the words above, on the rep's
Track and on a manager's view of a team member's referral alike. A reason of `Other` reads
"Closed: did not qualify", with the partner's typed note never shown. A value the site does
not know shows "Closed", never the raw text.

## 6. Pay

Pay stays off (`REP_PAY_ENABLED`) until Brian turns it on. With it off no screen shows a
dollar amount, as today.

**Plan per company.** The plan setting gains a company:

| Company | Rep earns | Manager earns |
|---|---|---|
| HealthFirst (T11, not final) | $100 when HealthFirst has reached the office and marked the lead qualified (T16, T17) | $50 at closed won |
| Staffing (T3, T5, T7) | $100 (private practice) or $200 (group, 3 or more locations) when Direct Dental has reached the customer and marked the lead qualified (T16) | $50 when staffing closes the deal |

**Plan settings.** `REP_PAY_PLAN` stays as it is and is the `HealthFirst` plan, so nothing
about HealthFirst pay changes shape (with slice S1 it accepts `reached:100,manager:50`).
The `Staffing` plan is a second setting, `REP_PAY_PLAN_STAFFING`, with three parts:
`reached_private:100,reached_group:200,manager:50`. `reached_private` pays a Reached award
whose practice type is `Private practice`, `reached_group` one whose type is `Group`, and
`manager` pays at the sign. All three are required. HSBS 10 holds the same three amounts as
variables. A value that does not parse turns off every staffing promise, meaning the amounts worded
from the plan (the pay line, the receipt, "when it qualifies" lines, "Up to $X more"). It
never hides an award that already exists: earned and paid amounts come from ledger rows,
not from the plan, and totals always equal the ledger.

A company with no plan set shows status only and promises nothing, even with pay on. HealthFirst is the one company with a built-in plan: with `REP_PAY_PLAN` unset it keeps the rep app's existing default, as on `main` today, so this build changes nothing for a site that has not set it. Brian sets `REP_PAY_PLAN` to the new HealthFirst terms before pay is switched on for field people. Staffing has no built-in plan: `REP_PAY_PLAN_STAFFING` unset means no staffing promise.
"No dollars" here means no promised dollars. The site's plan settings word promises; HSBS
10 holds its own copy of the amounts and writes the rows. So if the site's staffing plan is
unset or bad while HSBS 10's amounts are in place, a lead that is reached and qualified
still gets its Reached row, and that row shows on the screens with its ledger amount, as
every existing row does. Brian changes a plan in both places together; a mismatch shows
as rows with no promise before them, never as a hidden award.

**Promise wording.** Every HealthFirst promise that rep app v3 words as "when HealthFirst
reaches the office" becomes "when HealthFirst reaches the office and confirms the lead
qualifies": the pay line, the receipt, the lead screen money line, "Up to $X more" and the
empty My Earnings line. A reached case with no qualify answer yet reads "$100 when
HealthFirst confirms the lead qualifies." on its lead screen.

**Rules.** The rep app v3 rules apply to both companies unless a line here says otherwise.
- **Reached** is the partner's "Yes" to question 1 on its update page. The stored field does
  not change: it is the existing Talked To Doctor column, with the same three answers, and
  7A and 7B read and write it as today. Only the words on the staffing partner's page
  change, to "Talked with the customer?", because a staffing point of contact is often an
  office manager. HealthFirst's page keeps "Talked with the doctor?".
- **Qualified** (T16, T17) is a new answer on the partner's page, "Does this lead qualify?",
  stored in a new Service Cases choice column, Qualified: `Yes`, `No`, or blank until the
  partner answers. `No` needs a reason from a second choice column, Not Qualified Reason:
  `No permission to contact` or `Other`. `Other` needs a short typed note (1 to 300 characters), stored in
  a third new column, Not Qualified Note (plain text). The note is listed with the case in
  Brian's daily exceptions and is never read as a status or shown to a rep or manager.
- **How the answer travels (the 7B request).** Three new keys on the partner save:
  `Qualified` (`Yes`, `No` or `""`), `NotQualifiedReason` (`No permission to contact`,
  `Other` or `""`) and `NotQualifiedNote` (text or `""`). A key that is missing or `""`
  means leave that column as it is, so a page loaded before this change, which sends none
  of the three, keeps saving and never erases an answer a newer page stored. 7B refuses
  `Qualified` = `No` with no reason, and reason `Other` with no note.
- **Reason and note belong to a No.** 7B writes the reason and the note only on a save
  whose Qualified is `No`. A save of Qualified `Yes` clears a stored reason and note. 7A
  returns all three to the partner's own page (`qualified`, `notQualifiedReason`,
  `notQualifiedNote`); the note goes to no other screen.
- **What 7B refuses, and how.** A refused save writes nothing, for any lead in that
  request. 7B answers HTTP 422 with a `code` the site turns into its own words; flow text
  is never shown. Codes: `reload` (a Signed save with no stored or sent Qualified Yes and
  reached Yes; the page says "Reload this page to finish your update."), `reason` (No with
  no reason), `note` (Other with no note), `practice_type` (a qualify answer on a staffing
  case with no practice type, or a `PracticeType` that is not one of the two values),
  `closed` (any partner save at all on a case that is no longer open to the partner: one
  that is signed, handed back, or closed for any reason, `Already a customer` and
  `Not qualified` included. The test is the one 7A uses to decide which cases to list, so
  a case that has left the partner's page takes no more saves. A second tab left open
  cannot reopen, requalify or retype a case the first tab finished, and a correction
  after that is Brian's, in SharePoint. The check and the write are one step for the
  whole request: 7B runs one request at a time (a trigger concurrency limit of 1), so two
  requests that arrive together cannot both pass the check, and a request holding several
  leads is checked and written as a unit with nothing else writing in between. The second
  request is judged against what the first wrote), and `bad_value` (anything else that does not fit: a value outside the
  choices, Qualified `No` sent with a Stand other than Not moving forward, or Closed
  Reason `Not qualified` without Qualified `No`).
- **A qualify answer or a practice type can be saved on its own.** The partner does not
  have to choose "Where does it stand?" to answer the qualify question or to correct the
  practice type. That save carries the lead and only the new keys (`Qualified`,
  `NotQualifiedReason`, `NotQualifiedNote`, `PracticeType`): no Stand, status, dates or
  label. 7B writes those columns and the log line, stamps Last Partner Update and
  Partner Updated By, and leaves every other field of the case as it was. The reminder
  schedule does not move (Next Update Due, Missed Updates): the partner still owes a
  status. A reason or note sent beside a Yes or a blank Qualified is ignored, not stored.
  All of these rules, the `closed` refusal included, apply to HealthFirst and staffing
  cases only; no other partner's save changes. A standalone save is only ever a Qualified `Yes` or a practice type.
  Qualified `No` is never standalone: the page always sends it as the full lost save
  (above), with its stand, stage, status and label, so the close, the Pipeline Stage and
  the usual lost email all happen as they do for any lost case today. A `No` that arrives
  with no stand is refused (`bad_value`).
- **The Status Log** records each change to the qualify answer and to the practice type,
  with who and when, as it does other partner answers. The typed note never goes in the
  log, because the rep's Track history reads the log.
- **1R checks the rep app submit too,** so the rule does not rest on the site alone: for
  Source "Rep app" it refuses a submit naming no company or more than one, and a staffing
  submit whose `practiceType` is missing or not one of the two values.
- **A not-qualified save closes the case through the existing lost path.** The site sends
  it as the existing `lost` choice: Stand "Not moving forward", with `ClosedReason` set to a
  new Closed Reason choice, `Not qualified`. So 7B's existing rules for a lost case apply
  unchanged: Stage Close loss, Status Closed - Lost, Pipeline Stage Lost, Next Update Due
  and Next Step Date cleared, no more reminders. Question 1 is not required on this save: it is the one lost save 7B accepts with Talked To Doctor empty, and when it is empty 7B leaves the stored answer as it was. A not-qualified close sent before question 1 was ever answered is a check in S6 and on sheet F2.
- **Only HealthFirst and staffing cases have the question.** The page shows it, and the
  site sends the three keys, only for a case whose company is one of the two keys in
  section 4. Every other partner's page, request body and save behavior stay exactly as on
  `main`.
- **The rep's award is written when both are true: reached is Yes and Qualified is Yes,** on
  the first save where both hold. Reached alone writes nothing. Qualified alone writes
  nothing. This is the rule for HealthFirst and staffing alike, and it replaces rep app
  v3's "paid at reached" for HealthFirst. The ledger Event stays `Reached`, so the Award
  Key does not change. A Reached row that already exists when this rule goes live stands as written: it was earned under the rule of its day, and an award earned stands. The rule applies to every case with no Reached row at that moment. Before the first batch after go-live, Brian's exceptions list each open rep app case that has a Waiting Reached row and no Qualified answer, so he sees them once.
- **Not qualified pays nothing, and on a rep app referral leaves a ledger row wherever the plan has a reached award.**
  Qualified = `No` closes the case, whatever its source. The ledger part applies only to a
  row whose Source is "Rep app", because HSBS 10 writes rows for no other source: a field
  page or pilot FSC app case marked not qualified closes and writes nothing. If no Reached row exists yet, which is the usual case when No is the partner's
  first answer, HSBS 10 writes one Void Reached row with the reason (its amount is the plan's reached amount; under a plan with no reached award there is nothing to void, so no row is written and the closed reason on the case is the record. This holds for every no-pay reason, `Already a customer` and a repeat office included: a Void Reached row is written only where the company's plan has a reached award), so the rep sees "Not
  paid: [partner name] marked this lead as not qualified ([reason])." on the ledger like
  every other no-pay case (rep app v3). If a Reached award is Waiting, it becomes Void with
  that reason. The same holds for a Waiting Manager row on a case that had already signed.
  Any row that is already Paid, the rep's or the manager's, stays Paid (D3): it is marked
  Disputed and listed in Brian's exceptions.
- **Staffing amount** is set once, when the Reached row is written (reached and qualified), from the practice type
  on the case at that save. That is the partner's answer if they changed it, else the rep's
  pick (T6). A change after that does not change the row. It goes to Brian's daily
  exceptions. So that a correction made between the qualifying save and HSBS 10's run cannot move the amount, 7B stamps the type on the Service Case at that save in a column of its own, Award Practice Type, written once and never changed, and HSBS 10 reads that column, not Practice Type, for the amount.
- **A sign needs both partner answers.** For these two companies the partner page and 7B
  refuse a Signed save unless reached is Yes and Qualified is Yes, on that save or already
  stored. So a case can never sign with the qualify question blank. This is the one save a
  page loaded before this change cannot make: it sends no qualify answer, so its Signed
  save is refused unless Qualified Yes is already stored. 7B answers with the words
  "Reload this page to finish your update." The partner reloads, sees the qualify
  question, answers it and signs. Every other save from an old page still works. HSBS 10 checks the same
  two columns itself before it writes a Manager row, and writes none if either is not Yes.
- **After the sign, only Brian can correct the qualify answer.** A signed case is closed,
  and 7A loads only open cases, so it is no longer on the partner's page. If a partner
  tells Brian a signed lead should not have qualified, Brian changes Qualified to `No`
  with a reason on the Service Case in SharePoint, and changes nothing else. HSBS 10 reads
  the Service Case columns, not who saved them, so the ledger rules below apply the same
  way. The case itself stays signed: Partner Status, Pipeline Stage and Closed Reason are
  not touched, because the sign happened. So the screens keep counting it as signed. Track
  and My Team word a case as "did not qualify" only when its Closed Reason is
  `Not qualified`, never from the Qualified column alone; a signed case reads as signed,
  and the correction shows on the money lines as "Not paid" or "Disputed" from the ledger.
- **Manager pay** is written at the sign ("Signed" with a date and a product), to the manager on the
  rep's Active Team Roster row as the run that handles the sign reads it, decided once
  (D18). Same for both companies. That run can be later than the sign itself, so a roster or
  plan change made between the sign and the run is what the run sees. Rep app v3 accepts
  this with a process, not a snapshot: managers do not change teams before year end (D16),
  and Brian is the only one who edits the Team Roster or the plan. This spec keeps that
  process and adds one rule for Brian: do not change a Team Roster pair or a pay plan while
  the daily exceptions email lists a failed or pending HSBS 10 run. Whether to build an
  event-time snapshot instead is open (section 11 item 15).
- **A manager's own referral** pays the manager as the sender. It pays no manager award to
  themselves (existing rule: the manager is not the rep).
- **A no-pay case pays nobody.** A case is no-pay when it is a duplicate, or its closed
  reason is "Already a customer", or the partner marked it not qualified. The test is the case, not
  the state of the rep's row: it holds when the rep's award is Void and also when the
  rep's award was already Paid and stays Paid (D3). A no-pay case that can still sign, which
  is a duplicate with both partner answers Yes, writes the Manager row Void with the same
  reason, never Waiting. A case closed "Already a customer" or not qualified cannot sign at
  all (the rule above), so it never gets a Manager row.
- **No pay:** the same office already referred to the same company in the last 12 months
  (D12, now per company), "Already a customer" (D7), not qualified (above). The 12 month
  look-back counts an earlier referral to that company from every source, as D12 does
  today: the other team's app, the FSC app, the rep app or Salesforce. The look-back matches on JDE, so
  it can only count a row that has one. A public page lead (a field page or an other-team page)
  stores no JDE today, so it cannot block a later award, and this spec does not add a JDE
  box to those pages. An
  earlier referral blocks a later award even though it earned nothing itself. The look-back
  is by company, not by row: a Referrals row can name several companies in Solutions, and
  each one has its own Service Case, so an earlier row that named HealthFirst and staffing
  together counts as an earlier referral to each of them.
- **TEST rows earn like real ones** (D8): a TEST referral writes ledger rows with Test = yes
  under every rule here, and the screens show them to the TEST rep and TEST manager. A real
  payout batch never includes a Test row.
- **Paid is never clawed back** (D3).
- **No auto-reached award** for either company (T18, below). Rep app v3's D10 rule is
  retired by this spec.

**Hand backs (T22).** "Hand back to HSBS" stays as it is on the partner page: a choice with
a typed note. A hand back never writes, voids or changes a ledger row, and no flow reads
the note to decide pay. The note is printed, exactly as 7B stored it, next to the case in
Brian's daily exceptions; sheet F7 names the column it is read from. A handed-back case
stays on that list until Brian marks it sorted, in a new Service Cases Yes/No column, Hand
Back Sorted. He marks it when he has dealt with it, whether he sent it on or not. The case
keeps its handed-back status and its note; only the daily list drops it. Brian decides what
happens next, including sending the customer to the other partner when the lead was meant
for them. This closes open decision 26: there is no automatic void on a hand back. The
only automatic no-pay answers are "does not qualify" and "Already a customer".

**Pay on a handed-back case.** The hand back itself changes nothing. An award the case
earned before the hand back stands: a Waiting Reached row stays Waiting and goes into the
next payout batch like any other Waiting row. A case handed back before it earned writes
no row, then or later, because a handed-back case is closed to the partner and gets no
more answers.

**A lead Brian sends on to the other partner (T23).** Brian does this by hand, from the
steps on sheet F7. The result is a new Referrals row for the other company, copied from
the first: the same practice, contact name, Customer Phone, Doctor Email, Preferred Contact, JDE, Referring Rep, Referring Rep Email (Track
finds a rep's rows by it), Source and Test
value, each copied as it stands and never changed, one
company in Solutions, the need that goes with that company ("Staffing" for Direct
Dental, "OSHA and HIPAA compliance" for HealthFirst, never the first row's need), and a
Note line "Sent on from referral [ID of the first row]". So
"one referral, one company" (section 4) still holds, and the new row has its own Service
Case, status and pay.
- **Source decides pay, as on any row.** Only a first row whose Source is "Rep app", with
  a Referring Rep Email on the Rep Roster, makes a new row that can earn. A hand back
  that came from a field page or any other source keeps that Source on the new row and
  earns nothing for anyone. F7 says so in its first step, and M22 sends on one field page
  hand back and checks that no ledger row is written for it.
- **Consent.** The first row's consent names only the first partner. Before sending on,
  Brian gets the customer's OK for the second partner and types it into the new row's
  Consent text: "[Name] agreed on [date], by [phone or email], that [partner] may contact
  them about [service]. Recorded by Brian Gohr." No OK, no send. The intro to the second
  partner carries those words, not the first row's consent.
- **Screens.** The rep's Track and the manager's My Team show two rows. The first keeps
  its handed-back status, as rep app v3 shows a handed-back case today. The new row reads
  as any referral to that company does, in that company's words.
- **Pay.** The new row is an ordinary referral to that company: the rep earns when that
  partner marks it reached and qualified, at that company's plan amount, and the manager
  earns at its sign. The 12 month look-back applies to the second company as usual; the
  first row named only the first company, so it never blocks the second.
- **Practice type.** A lead sent on to staffing has no practice type from the rep. Brian
  leaves it blank, and the staffing partner must set one before it can save either qualify
  answer, Yes or No. The page and 7B refuse a qualify answer on a staffing case with no
  practice type. The one row that can be written with no type is the Void row for a
  staffing case closed "Already a customer" before anyone set one: the partner is not made
  to pick a type just to say that. That Void row carries the private practice amount, has
  a blank Practice Type, and never pays. So every staffing ledger row has an amount.
- **Test.** A row sent on from a TEST lead is a TEST row: Test = Yes is copied before
  anything else. Test = Yes means what it means for every TEST row today: the flows still
  make the Service Case and run the status and ledger rules, but no email goes to a real
  partner, rep or manager, and its awards are Test rows in no real batch. The TEST intro
  is checked where sheet F7 says TEST intros are inspected (the flow's run history, or the
  TEST partner mailbox BB2 controls), never in a live inbox.
- Only Brian can send a lead on; no partner, rep or manager can.

**No permission (T4).** The asterisk on the staffing form says the partner may void a
referral if the customer did not give permission. The partner does that with the qualify
answer: Qualified = `No`, reason `No permission to contact`. There is no separate void
button, and no flow reads a partner's free-text note to decide pay.

**A silent partner (T18).** Auto-reached (rep app v3, D10) is retired for both companies.
No award is ever written without the partner's two answers, and nobody, Brian included,
can release one in their place. When a case has had no partner answer to question 1 for
five business days after the intro, it is listed in Brian's daily exceptions so he can
chase the partner, and it stays listed until the partner answers. The same goes for a case
that is reached but has had no qualify answer for five business days. Both lists cover
open cases only. A case that is closed for any reason, a hand back included, is never on
a silent-partner list: a handed-back case is on the hand-back list instead, until Brian
marks it sorted. Nothing is written
to the ledger for either. The rep's screen keeps showing the plain status ("is reaching
out", or "talked with the customer") and no earned amount.

**Ledger.** Each row gains Company and, for staffing, Practice Type. A row written before the column existed has it blank, and every such row is HealthFirst: sheet F4 fills Company on the existing rows once, and until then, and for any row that is ever blank, the site, 1R and HSBS 10 read a blank Company as `HealthFirst`. Go-live runs top down: Brian sets a manager's Test value to No before, or together with, any rep on that manager's team, so a live rep always has a live manager. As a backstop, a manager's award row on a referral from a live rep whose manager is still Test is written as a Test row, kept out of real batches, and listed in Brian's exceptions; when he sets that manager live he clears Test on that row by hand, and it then shows and batches like any other. No row is ever lost or hidden without being on his list. The unique key stays
Case ID + Event + Payee Role, which already separates companies because a case belongs to
one company.

**What each track sees.**
- Team member: My Earnings as built, with the company on each line, and totals across both
  companies. Earned equals Waiting plus Paid.
- Manager: My Team as built: team referrals, signed, team earned, team paid, each person's
  earned and paid, and "You've earned $X from your team's signed offices." Each line names
  the company. The manager's own referrals are on their own Track and My Earnings tabs.
- Every dollar on any screen traces to one ledger row. A manager sees only their own team.
  A team member sees only their own rows.
- No email carries a dollar amount (D15).

## 7. Partner side

On both partners' update pages (`/leads/<key>`):
- A new question, "Does this lead qualify?", with Yes and No. No asks for a reason: "No
  permission to contact" or "Other" with a short note. The question is on the page from the first
  visit, next to question 1, and the partner may answer it in any order: Yes or No before
  reaching anyone, or after. An award still needs both answers (section 6).
- "Signed" is closed won, and it needs a signed date and a product, exactly as 7B requires
  today for every company. A case cannot be saved as Signed unless it is marked
  reached and qualified; a case marked not qualified, or with the qualify question still
  blank, is refused.

On the staffing partner's page only:
- The case shows the practice type the rep picked. The partner can change it. The change is
  saved with the case.
- Question 1 reads "Talked with the customer?". The staffing partner types what was placed
  (for example "Permanent hire" or "Temporary staffing") in the product box at the sign.

## 8. Field landing pages (`/rgm/<slug>`)

- The practice value box comes off (T2). the old value field is no longer required on a field entry.
- The page shows two boxes: compliance (HealthFirst) and staffing. The other boxes stay
  defined and hidden, behind the same idea as the app switch.
- Page leads stay partner first, as built. A page lead pays nobody (T24):
  HSBS 10 writes awards only for rows whose Source is "Rep app" (check M13).
- On a field page the staffing box and its consent name Direct Dental (T14), in place of
  "Henry Schein Staffing and Recruiting (including GoTu)". The saved consent is the words on
  the screen. The other team's pages are not changed by this spec.
- **Every field page stays on test under this spec.** A public page can be posted to by
  anyone, and a live one would write rows and send partner mail. Taking any field page
  live is not part of this build. It needs decision 38 answered, a control written down
  with its own pass or fail check on TEST rows (a bot check on the form, or a hold before
  the partner is introduced), and Brian's go.
- `CLAUDE.md` (field page rule) and `AGENTS.md` (rules 6 and 19) change to match, in the
  same PR as the page change, with Brian's approval of this spec as the basis.

## 9. What a builder bot must build (from sheets Claude writes; nothing here edits a flow)

| Sheet | What | Why |
|---|---|---|
| F1 | Referrals and Service Cases: a Practice Type choice column (`Private practice`, `Group`). 1R submit writes it from `practiceType` to both. 7A returns it on each staffing lead as `practiceType`, the Service Case's value. 7B accepts `PracticeType` on a staffing save and writes it to the Service Case; missing or `""` leaves it unchanged. Service Cases also gains Award Practice Type (same two choices, no default): 7B writes it once on a staffing case, at the first save that leaves reached Yes and Qualified Yes, from the type on the case at that save, and never changes it | Staffing amount, partner correction, check M23 |
| F2 | Service Cases: three new columns, Qualified (choice: `Yes`, `No`), Not Qualified Reason (choice: `No permission to contact`, `Other`) and Not Qualified Note (plain text). Closed Reason gains two choices, `Not qualified` and `Already a customer`. 7A returns the three values for HealthFirst and staffing cases. 7A also returns a `company` field on each lead, holding the Service Case's Solutions value as stored; the page shows the qualify question only when it is HealthFirst or the staffing value, and a missing or other value means no question, as today. 7B decides the company from the stored case, never from the request. 7B's two new refusals that a page loaded before this change could hit (`reload`, a Signed save with no stored Qualified `Yes`, and `closed`, a save from a stale tab on a case no longer open) sit behind a flow setting, `EnforceQualify`, off by default, so the new 7B can go live before the page shows the question without blocking a sign. Order: site slice live with `PARTNER_QUALIFY_ENABLED` off, new 7B with `EnforceQualify` off, new 7A, site switch on, then `EnforceQualify` on. Rollback runs in reverse. Steps four and five are done in one sitting. A sign that still slips through from an old page in that gap leaves a signed case with no qualify answer: Brian's exceptions list every signed HealthFirst or staffing case with Qualified blank, he sets Qualified in SharePoint (after a sign that correction is his alone), and HSBS 10 awards from his answer. S6 checks one such case end to end. 7B accepts `Qualified`, `NotQualifiedReason` and `NotQualifiedNote`, where missing or `""` leaves the column unchanged; refuses No with no reason and Other with no note; refuses Signed on a case marked No; treats a not-qualified save as the existing lost path. Practice type load and save are on sheet F1. The Talked To Doctor field and its answers do not change; only the question's words differ on the staffing page (site side). No other partner's 7A or 7B behavior changes | Sections 6 and 7, slice S6 |
| F3 | 3F: the intro for a staffing row from the rep app (practice type, point of contact, the consent text, the need "Staffing"). Recipients: the staffing contact from Routing, the referring rep, Brian. Nobody else | Section 4. New recipients need Brian's OK |
| F4 | HSBS 10 and the SPIFF Ledger (Sheet 4, on hold today): add Company and Practice Type, per-company amounts, the staffing amount by practice type, read from the Service Case's Award Practice Type and never from Practice Type, the reached and qualified trigger for both companies, no auto-reached award (T18) and the two silent-partner lines in Brian's exceptions, the not-qualified void, the 12 month duplicate check per company, Payer set per company, one payout batch per payer. No staffing payout is built until the staffing payer is decided. A staffing case with Qualified Yes and a blank Award Practice Type gets no award row and is listed in Brian's exceptions until he fills it. No staffing award rows are created until Brian decides whether the partner's practice type pick must be an explicit confirmation | Section 6, checks M1 to M8, and a TEST staffing case with Qualified Yes and a blank Award Practice Type that gets no award row and appears in the exceptions list |
| F5 | Roster loads: Rep Roster rows, each with a new key and a Role from the choices the Rep Roster already has (`RM` for each RGM, `FSC` for each Field Sales Consultant; never the words "RGM" or "Field Sales Consultant"), for the 30 RGMs and every Field Sales Consultant on their teams, pilot FSCs included (T20). No Equipment Specialist is loaded (T15). A person with no email on the roster, or whose display name is still an open question in `DECISIONS.md` (questions 5 and 6: 9 of the 560 FSCs today), is held out of the load until Brian answers. Team Roster pairs matched by email. Every row is loaded with Test = Yes and Services = `HealthFirst`, which the key lookup already requires for a rep link to open; the company switch, not Services, decides what a rep can send. A Test rep's referral is a TEST row, not a blocked one: 1R writes Test = Yes on the Referrals row and its Service Case, so no live partner email goes out, no receipt or update email goes to the person either (every flow that emails a referring rep, 3F and 7B included, skips a Test row or sends it only to the TEST inbox the flows already use), no award joins a real batch, and checks such as M20 can still run. The sheet has BB2 confirm this from the live 1R and add it if it is missing. A person goes live only when Brian has their Test value set to No. No field person is loaded until check M27 passes and AGENTS rule 19 is reworded (T19). Existing row on the other team's rosters (RGMs) and FSC Roster rows (pilot FSCs) are left in place | Section 3, checks M9 and M25 |
| F7 | Sending a handed-back lead on: the exact steps for Brian to add a new Referrals row for the other company (copied from the first, Test value included and set first, with the fresh consent he recorded and the "Sent on from referral [ID]" Note line) so that its Service Case is made and the partner intro goes out once, written after reading the live 2, 2B and 3F. The sheet also names the column the hand-back note is stored in, has the daily exceptions print it, and adds the Service Cases Yes/No column Hand Back Sorted, which takes a case off the daily list. If the live flows cannot do it from an edit to the row, the sheet says so and proposes the smallest change | Section 6, check M22 The steps begin with a lookup: search Referrals for the Note line "Sent on from referral [ID]" for the destination company. If a row exists, Brian resumes from that row and never adds a second; the sheet says how to finish a row whose Service Case or intro did not complete |
| F6 | 1R `list` and `team` referral cases: return `practiceType` on each staffing case (the screens need it to word $100 or $200 before an award exists), each case's Solutions value where they do not already (as a key named `solutions`), and three fields per case, `qualified`, `notQualifiedReason` and `closedReason`, each holding the choice as stored. 1R `earnings` and the ledger rows inside `team` (each rep's rows and the manager's own): return the ledger's `Company` key on every row. A ledger row has no Solutions value, so the key is how the site labels the line and picks the plan | Sections 5 and 6, slice S4, check M12 |

## 10. Site build, in small PRs

Each is one PR, behind the switches, reviewed against this spec.

| # | Slice | Pass or fail (TEST rows only) |
|---|---|---|
| S1 | Pay plan: accept a plan with no sign award (`reached:100,manager:50` is rejected today), and a plan per company | The 11/11 plan parses. An unparseable value promises no dollars anywhere (ledger rows that exist still show their amounts) With `REP_PAY_PLAN` unset and pay on, HealthFirst shows the same plan as `main`; with `REP_PAY_PLAN_STAFFING` unset, staffing shows no promised dollars |
| S2 | Company list and `REP_APP_COMPANIES`. Send opens on the company choice | Unset, for a rep with no staffing referral: every rep page is the same HTML as `main`. A company that is off is refused by the server on a new send. A direct post naming both companies, or none, is refused and no row is made |
| S3 | Staffing form: practice type, permission box, asterisk line, submit body | Missing practice type or an unticked box blocks the send. The saved consent is the words on the screen. A double tap makes one row. The posted body has `needs` `["Staffing"]`; the saved TEST row's Note and the TEST intro to Direct Dental say Staffing and never "OSHA and HIPAA compliance" After a good staffing send, the receipt names Direct Dental and never HealthFirst, both the server-rendered receipt and the JavaScript one; with pay on it carries the staffing promise for the practice type picked, and with pay off no dollars |
| S4 | Track and lead screen words per company | A staffing row never says HealthFirst. With staffing switched on, a HealthFirst row still reads "HealthFirst talked with the doctor" and "Signed and billed", word for word as on `main`. A case marked not qualified for no permission reads "Closed: did not qualify (no permission to contact)" on the rep's Track and on the manager's view of that rep, from `qualified` and `notQualifiedReason`, with the partner's typed note ignored. Before the partner answers the qualify question, a reached case shows no earned amount |
| S5 | Earnings and My Team with a company on each row; staffing wording and amounts | Earned, My Earnings and the ledger total agree to the dollar per person and per team. A TEST private practice that is reached and qualified shows $100; a TEST group that is reached and qualified shows $200; a reached case with no qualify answer shows no earned amount; a TEST staffing sign shows $50 for the manager |
| S6 | Partner page: the qualify question on both partners' pages, practice type correction on staffing | The question shows from the first visit and can be answered before or after question 1. Yes saves Qualified. No with no reason is refused. Reason Other with an empty note is refused, by the page and by 7B. No with a reason closes the case: Stand Not moving forward, Closed Reason `Not qualified`, Pipeline Stage Lost, Next Update Due cleared, and no reminder goes out for it afterwards. A TEST Other note is stored in Not Qualified Note, appears in Brian's exceptions, and appears on no rep or manager screen. A save from a page loaded before this change (none of the three keys) still saves and leaves a stored Qualified answer untouched. A case marked No cannot be saved Signed. A Signed save from a page loaded before this change, on a case with no stored qualify answer, is refused with "Reload this page to finish your update."; after a reload the partner answers Qualified Yes and the sign saves. The same old-page Signed save on a case that already has Qualified Yes stored is accepted. A staffing "Signed" with no product is refused, as HealthFirst's is. The staffing page asks "Talked with the customer?" and saves to the same field HealthFirst's page does. A TEST Unitas case: its page has no qualify question, its request body has none of the three keys, and its save behaves as on `main`. Money: checks M10, M11 and M16 Standalone saves: a Qualified Yes alone, and a practice type correction alone, each save with no stand chosen, from the page and as a direct post, and every other field of the case is unchanged afterwards. A direct post of Qualified No with a reason and no Stand is refused (`bad_value`): Qualified stays empty, the case stays open and no log line or email is made. Two tabs: one tab saves Qualified No, then the stale tab posts Qualified Yes with an in-progress stand; it is refused (`closed`) and the case stays closed with its reason and note. One request holding a valid update followed by an invalid one is refused whole: neither case changes, no log line is written and no email goes out Two saves sent at the same moment for one open TEST case, a Qualified No close and a Signed save: exactly one is accepted, the other is refused (`closed`), and the case holds only the accepted save's fields. The same with a two-lead request racing a single save that closes its second lead: either the whole two-lead request is written or none of it is. Two more two-tab orderings: one tab saves Signed, and one tab saves Hand back to HSBS; in each, the stale tab then posts a qualify answer or a practice type on its own and is refused (`closed`), and the case is unchanged The TEST update email for a not-qualified close with reason Other is opened: the typed note is not in it, in the subject or the body |
| S7 | Field pages: value box off, two boxes; the staffing box and its consent name Direct Dental; rule files updated | No field page offers the other team. Hidden boxes are refused by the server. On a TEST field page with staffing ticked, the consent on the screen reads "I agree that Direct Dental may contact me about this request." and the saved consent is the same words. No field page says "Henry Schein Staffing and Recruiting" |
| S8 | Permissions check | Two TEST managers each see only their own team. A team member key gets no team (404) |

With `REP_APP_ENABLED` off, the other team's, FSC and field screens match `main`. With
`REP_APP_COMPANIES` unset, the Send tab is HealthFirst only and no rep screen shows
anything about staffing, for a rep with no staffing referral. That is not the same as
matching `main` once every slice is in: the HealthFirst qualify rule and its promise
wording (section 6) apply whether or not staffing is on. Slice S2 on its own changes no
HealthFirst screen, which is what its check asserts. A rep who already has staffing
referrals keeps seeing them (check M15).

Money checks for sheet F4 and slice S5 (TEST rows only; each is pass or fail):

| # | Check |
|---|---|
| M1 | Rep picks `Private practice`. Partner changes it to `Group`, then answers reached Yes and Qualified Yes. One Reached row, $200 |
| M2 | Rep picks `Group`. Partner changes it to `Private practice`, then answers reached Yes and Qualified Yes. One Reached row, $100 |
| M3 | After M1's row exists, the partner changes the type back to `Private practice`. The row stays $200, no new row is written, and the case is in Brian's exceptions Then a delayed run: on a new TEST case the partner saves Reached and Qualified as `Private practice`, corrects it to `Group` before HSBS 10 runs, and the row is still $100, from Award Practice Type |
| M4 | Same JDE sent to HealthFirst last month, then to staffing. The staffing referral earns: a HealthFirst referral never blocks a staffing award. Then the reverse on another JDE: sent to staffing first, then to HealthFirst. The HealthFirst referral earns too |
| M5 | Same JDE sent to staffing twice inside 12 months. The second writes one Void row, "this office was referred to Direct Dental in the last 12 months", that never counts or pays. The first keeps its award. Then the second case is saved Signed with a date and a product: its Manager row is Void with the same reason, and no Waiting manager award exists for it |
| M6 | A TEST staffing sign writes one $50 Manager row to the manager on the rep's Active Team Roster row. Saving again writes none |
| M7 | A TEST payout batch for one payer holds only that payer's rows. A staffing Test row is never in a HealthFirst batch |
| M8 | Every TEST award above has Test = yes, shows on the TEST rep's and TEST manager's screens, and is in no real batch |
| M10 | Run once for staffing and once for HealthFirst. Reached Yes and Qualified Yes: one Reached award, Waiting. The partner then changes Qualified to No, reason "No permission to contact". The row becomes Void with the reason in words, Earned drops by its amount, and a later sign is refused, so no Manager row is written |
| M11 | Run once for staffing and once for HealthFirst. A Reached award is Paid. The partner then changes Qualified to No. The row stays Paid, is marked Disputed, and is in Brian's exceptions. Nothing is clawed back, and no Waiting manager award exists for the case. Second order: the case is reached, qualified, signed, and both the Reached row and the Manager row are Paid. The signed case is not on the partner's page. Brian changes Qualified to No with a reason on the TEST Service Case in SharePoint. Both rows stay Paid and both are Disputed. The case's Partner Status, Pipeline Stage and Closed Reason are unchanged. The TEST rep's Track still reads the case as signed, the TEST manager's My Team still counts it as signed, and both show the two awards as Disputed Third order, the Waiting manager award: the case is reached, qualified and signed, and both rows are still Waiting. Brian changes Qualified to No with a reason in SharePoint. Both rows become Void with the same reason, and a TEST payout batch run afterwards holds neither |
| M13 | A TEST lead from a field page (`/rgm/<slug>`) with HealthFirst ticked, and one with staffing ticked. Each is marked reached Yes and Qualified Yes, then saved Signed with a date and a product, and the sign is accepted. A third field-page TEST lead is marked Qualified No with a reason: the case closes and no Void row is written. No ledger row is written for either, for a rep or a manager: HSBS 10 awards only rows whose Source is "Rep app" On the staffing lead the partner sets a practice type first, since a field page collects none: before that, both qualify answers are refused |
| M16 | Run once for staffing and once for HealthFirst. The partner answers reached Yes and leaves the qualify question blank: no ledger row, and the rep's lead screen shows no earned amount. The partner then answers Qualified Yes: one Reached row, Waiting, for the plan amount. On another case the partner answers Qualified Yes before reaching anyone: no row until reached is Yes. On a third the partner's first answer is Qualified No: one Void Reached row is written with the reason, nothing is ever Waiting, and the rep sees "Not paid" with the reason
| M19 | Run once for staffing and once for HealthFirst. A TEST case gets no partner answer for five business days after the intro: it is in Brian's exceptions, no ledger row exists, and no Pending review row is ever written. A second TEST case is answered reached Yes and then left with no qualify answer for five business days: it is in Brian's exceptions and no ledger row exists. Once the partner answers Qualified Yes, the award is written and the case leaves the exceptions |
| M27 | Before any roster load. A TEST row is added to the Rep Roster with Test = Yes and a referral is sent from its link to each switched-on company. Each Referrals row and Service Case has Test = Yes, no live partner email goes out, the rep's own address receives no receipt and no update email when the TEST partner page saves an update (the run history of 3F and 7B is read to confirm the recipients), the award row made at Reached and Qualified is a Test row in no real batch, and Track shows the referral. Then the load itself is checked: every loaded row has Test = Yes Staged go-live: a TEST FSC is set to Test = No while its TEST manager is still Test = Yes, and a referral signs; the manager's award row is a Test row in no real batch. Then the TEST manager is set to Test = No and Brian clears Test on that row: it shows on the manager's My Team and is in the next batch for its payer, once, and it was in no batch before that. A ledger row with a blank Company shows as HealthFirst on My Earnings and My Team and batches as HealthFirst. A Waiting Reached row written before the qualify rule, on a case with no Qualified answer, is still Waiting after go-live and appears in Brian's exceptions |
| M20 | A TEST FSC has a pilot link on the FSC Roster and a new Rep Roster row. The pilot link opens the pilot FSC app as on `main`. The new link opens the rep app. The FSC shows as signed up on the manager's My Team. A referral sent from the pilot app writes no ledger row; one sent from the new app earns under the rules above |
| M21 | Run once for staffing and once for HealthFirst. A TEST case with a Waiting Reached award is handed back to HSBS with a note. No ledger row is written, changed or voided, the award is still Waiting, and the case is in Brian's exceptions with the note word for word as typed. A TEST payout batch for that payer run after the hand back includes the row. A TEST case with no award is handed back: no ledger row is written, then or later |
| M22 | A TEST rep-app lead to HealthFirst is handed back. Brian sends it on to staffing by sheet F7, with a TEST consent line typed in. A new Referrals row exists with Solutions staffing only, the same Referring Rep, Source "Rep app", the Note line "Sent on from referral [ID]" and Brian's consent line as its Consent text. The first row is unchanged and has no staffing Service Case. The TEST intro to Direct Dental shows Brian's consent line and not the HealthFirst consent. The new row has the original rep's Referring Rep Email. The new row has the first row's Customer Phone, Doctor Email and Preferred Contact, and the TEST intro shows the phone and the preferred contact. The staffing partner cannot save Qualified Yes or Qualified No until a practice type is set. Reached Yes, Qualified Yes, `Private practice`: one $100 Reached row for the original rep, Company `Staffing`. The HealthFirst case has no ledger row. The TEST rep's Track and the TEST manager's My Team show two rows: the HealthFirst row with its handed-back status and the staffing row with staffing's words and the $100. Then the reverse, staffing handed back and sent on to HealthFirst, with the same checks. The new row and its Service Case have Test = Yes, the $100 row is a Test row, no live email goes out for it, and it is in no real batch. Brian then marks the first case Hand Back Sorted: it is gone from the next daily exceptions, from the hand-back list and from both silent-partner lists (the partner handed it back without answering question 1, and five business days have passed), and it still shows its handed-back status and note in SharePoint. Last, F7 is tried with the consent line left empty: the sheet's steps stop there and no intro goes out In each direction the new row's need is the destination company's ("Staffing" one way, "OSHA and HIPAA compliance" the other), and the TEST intro names that need and not the first partner's A retry: F7 is stopped after the new row is saved and before the intro, then run again from the top; the result is one row, one Service Case, one intro and at most one award |
| M17 | An earlier FSC-app Referrals row for a JDE names both HealthFirst and staffing in Solutions. Inside 12 months the same JDE is sent from the rep app, once to HealthFirst and once to staffing, each reached, qualified and signed. Both rep-app cases write a Void Reached row and a Void Manager row |
| M23 | Practice type round trip. A TEST rep sends a staffing lead as `Private practice`. The partner page loads showing Private practice, from 7A. The partner changes it to `Group` and saves. The page is reloaded and shows Group. A save from a page loaded before this change (no `PracticeType` key) leaves Group stored Before any award exists, 1R `list` and `team` return `practiceType` `Private practice` for one TEST staffing case and `Group` for another, and the TEST rep's lead screen and the TEST manager's view word $100 for the first and $200 for the second |
| M24 | Run once for staffing and once for HealthFirst. The partner answers reached Yes, leaves the qualify question blank, and tries to save Signed with a date and a product: the page refuses it, and a direct post to 7B is refused too. No Manager row exists. The partner then answers Qualified Yes and signs: one Reached row and one Manager row, both Waiting |
| M18 | Run once for staffing and once for HealthFirst. A case is closed "Already a customer" before any award. A Void Reached row is written with that reason. For staffing, run it a second time on a sent-on case with no practice type: the Void row is written with the private practice amount and a blank Practice Type, and is in no batch. The case cannot then earn or sign: it has left the partner's page, and a direct post to 7B saving it Signed is refused because reached and Qualified are not both Yes. No Manager row exists M17 and M18 are run under a plan with a reached award. Run once more under `signed:150,manager:50`: no Void Reached row is written for any no-pay reason, and the case's closed reason is the record |
| M14 | A TEST lead to staffing for a JDE from the pilot FSC app (a source that stores a JDE and earns nothing). Then the same JDE is sent to staffing from the rep app inside 12 months, reached, qualified and signed. The rep-app case writes one Void Reached row ("this office was referred to Direct Dental in the last 12 months") and a Void Manager row. Nothing is Waiting. Same sequence for HealthFirst. Separately, a TEST field-page lead for the same practice name with no JDE does not block a later rep-app award |
| M15 | A TEST rep has a staffing referral with a Waiting award. `REP_APP_COMPANIES` is then set back to HealthFirst only. The Send tab offers HealthFirst only and the server refuses a new staffing send. The staffing referral is still on Track, its award is still on My Earnings and on the manager's My Team, and Earned still equals the ledger total |
| M12 | A TEST rep has a Waiting staffing award. `REP_PAY_PLAN_STAFFING` is then unset or made unparseable, with pay on. No screen promises a staffing amount (no pay line, no "when it qualifies" amount, nothing for staffing in "Up to $X more"). The existing award still shows with its amount on My Earnings and My Team, and Earned still equals the ledger total. HealthFirst promises and amounts are unchanged Second order, starting with the plan bad: with `REP_PAY_PLAN_STAFFING` unparseable and HSBS 10's staffing amounts in place, a TEST staffing lead is marked reached and qualified. Before that no screen promised an amount. HSBS 10 writes the Reached row, and it then shows with its ledger amount on My Earnings and My Team |
| M9 | With `REP_APP_ENABLED` off after the new links are loaded: a new RGM key answers "This link does not work", and the RGM's old link opens the field app exactly as on `main` |
| M25 | Roster reconciliation, run by script against the source roster file after the load and read-only. The Rep Roster holds exactly one row for each of the 30 RGMs (Role `RM`) and one for each loaded Field Sales Consultant (Role `FSC`), matched by email. With the nine people held out today that is 551 FSCs and 30 RGMs, 581 rows. Each held-out person is named in the output with the open question that holds them, and has no row. No Equipment Specialist has a row. Every loaded FSC has exactly one Active Team Roster pair, and its manager is that FSC's RGM on the source roster. Every key is unique. The counts in, loaded, held out and skipped add up to the source total. Every loaded row has Services `HealthFirst`, and one loaded TEST link opens the app. Every loaded row has Registered On set to the load date; any loaded row with Registered On blank or a different date fails the check |
| M26 | Pay off. A TEST rep has a HealthFirst and a staffing referral, each with a ledger row, and both plans are set and valid. `REP_PAY_ENABLED` is then turned off, and nothing else. No dollar amount shows anywhere: the staffing form and its pay line, the receipt, Track, the lead screen, My Earnings, My Team, or any email the site sends. The referrals and their statuses still show |

## 11. Open for Brian

1. **AEs:** the list of AEs and who manages each. The September 16 roster has no AE group
   at the FSC level, so the names have to come from Brian.
2. Decided (T19): RGMs and their FSCs may be on the Rep Roster. `AGENTS.md` rule 19 and
   the matching line in the old repo's other-team app contract change in the first build PR that
   needs it, not in this spec PR. The RGM rows on the other team's roster stay (check M9).
3. **Decision 29 and PR #110** (FSC pick list on the field app): under this spec no RGM uses
   that form. Close #110, or keep it?
4. Decided (T15): Equipment Specialists are not in the first load.
5. Decided (T18): a silent partner pays nothing and is flagged to Brian. Auto-reached is
   retired.
6. Decided (T22, T23): hand backs go to Brian and change no pay; a lead he sends on to the
   other partner earns for the rep under that partner's rules.
7. Decided (T24): a public page lead pays nobody.
8. **Direct Dental's contacts:** who gets staffing leads, and who receives the staffing
   payout file. (The name on screens is decided, T14.)
9. Decided (T25): a group is 3 or more locations.
10. **Katy's 11/6 rule** (only HealthFirst goes to field sales through 12/31): staffing is
    added before then. Confirm she knows.
11. Decided (T13): the staffing partner pays. Still open: is paying staffing referral
    awards cleared the same way HealthFirst's was on 11/8?
12. Decided (T12): this build is a written exception to the launch freeze, switched on
    when the TEST checks pass and Brian gives the go.
16. Decided (T21): the reasons are "No permission to contact" and "Other".
13. **Bot check (decision 38)** on field pages before any leaves test. Not part of this
    build: every field page stays on test (section 8).
14. Decided (T20): pilot FSCs get the new app like every other FSC, and keep their pilot
    link.
15. **Manager and plan at the sign:** keep the rep app v3 process (the run that handles the
    sign reads the roster and plan as they are then), or have a builder bot stamp the
    manager on the case when the partner saves Signed?
17. Decided (Brian's approval of this spec, 11/13): before he sends a handed-back lead
    on, Brian gets the customer's OK for the second partner and types it in (T23).

## 12. What this spec does not do

- It does not turn pay on, send anything live, or add an email recipient.
- It does not change the pilot FSC app or anything on the other team's side.
- It does not add the other HSBS companies. They stay off until Brian adds each name.

## 13. Review items logged at merge (11/13)

Brian's call on 11/13: merge this spec with the remaining review findings logged here
rather than run another review round. The last review (of commit 108b556) raised three.
Each is answered in the text above, but those answers have not been through review, so
each stays open until the sheet or slice that builds it passes its own review.

| Item | Where it is answered | Closes when |
|---|---|---|
| Award Practice Type had no sheet | Section 9: F1 adds the column and the 7B stamp, F4 reads it | The F1 and F4 sheets pass review |
| A sent-on row could turn a non-rep lead into one that earns | Section 6, "Source decides pay"; check M22 | The F7 sheet passes review |
| Nothing tested releasing a manager's Test row after go-live | Check M27 | The F4 and F5 sheets pass review |
| What email goes out when a partner saves only the qualify answer or only the practice type (no label, no Note) | Not yet answered | Sheet F2 states it and a check reads the TEST email |
| Award type on a staffing case signed in the turn-on gap | Ruled 11/13: Brian sets Qualified and Award Practice Type together in SharePoint. The guard belongs to HSBS 10, so sheet F4 carries it (section 9): a staffing case with Qualified Yes and a blank Award Practice Type gets no award row and is listed in Brian's exceptions until he fills it | In the F1 and F2 sheets; closes when F4 passes review |
| Registered On is blank on rows loaded by F5, so the 14 day no-referral nudge never shows | Not yet answered: F5 sets it to the load date and M25 asserts that every loaded row has it | Sheet F5 passes review |
| An RGM or pilot FSC is on two rosters; `/join` resends only the old link | Open for Brian: how these people get the new link | Brian decides; sheet F5 passes review |
| Security review: a rep can pick Group for a one-location office and the partner may not correct it | The partner page requires a practice type before a qualify answer; whether that must be an explicit confirmation is open | Brian decides before staffing award creation (F4) is turned on, not only before the payout is built. Until he decides, the safe default holds: no staffing award rows are created |
