<!--
v2 source: Dropbox /HSBS_BOT/build/2026-11-07_HealthFirst_Rep_App_Spec_DRAFT_v2.md.
v3 written on PR #40 from Brian's 11/8 approval of decisions D1 to D14 (Codex and Claude
spec reviews). Approved by Brian, 11/8/2026.
-->

# HealthFirst rep app: build, lead management and reporting (v3, approved)

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and the other team's exact list and column names are only in the old repo's copy.

Created: November 7, 2026 (v1, v2). v3: November 8, 2026.
From: Claude, for Brian
Replaces: v2. Read this one only.
Status: Approved by Brian, 11/8/2026. Builders (Brian, 11/8): Claude builds the site, and Codex reviews each PR. BB1 builds the SharePoint lists and Power Automate flows in section 3, on copies with TEST rows only, from step-by-step build sheets Claude writes. Brian approves each piece and gives the go before anything goes live or sends mail. (rt2 was retired 11/8; BB1 replaces it.)
Builds on: the FSC referral app (/HSBS_BOT/build/2026-11-01_FSC_App_Spec_Update_v2.md) and the repo contract docs/fsc-flow-contracts.md. Everything there stands unless this file changes it.

## What changed from v2 (Brian approved, 11/8)

Codex and Claude reviewed v2 separately (PR #40). Brian approved every recommended answer:

| # | Change | Where |
|---|---|---|
| D1 | Each existing flow's behavior on a Rep app row is now written down | 3, "Existing flows on a Rep row" |
| D2 | Limits on /join and 1J so sign-up can't be used to send mail | 2 /join, 3 HSBS 1J |
| D3 | A paid award is never clawed back | 3 HSBS 10, 5 |
| D4 | A manager sees only a name for someone on the team who isn't on the app. Brian, 11/9 (D18): there is no unconfirmed state any more; a rep on the manager's Team Roster who hasn't signed up shows by name only, as "Not signed up yet." | 2 My Team, 3 team |
| D5 | Managers already on the other team's roster or the FSC Roster get My Team as an added tab | 1, 3 lookup |
| D6 | The ledger's unique key is Case ID + Event + Payee Role | 3 HSBS 10 |
| D7 | "Already a customer" becomes a closed reason on the partner page | 1, 3 |
| D8 | TEST awards earn into the ledger, marked Test, and never reach a real payout | 3 HSBS 10, 7 |
| D9 | Manager confirmation used a single-use link (11/8; changed on 11/9 by issue #49 and D17). Superseded by D18 (Brian, 11/9): there is no manager confirm at launch. The /confirm page and the 1J confirm actions from #43 stay in the code, not used by the rep journey at launch, and answer 404 before any 1J call unless `REP_CONFIRM_ENABLED=true` (unset at launch); removable later | 3 HSBS 1J |
| D10 | Auto-reached awards wait for Brian's review before they count | 3 HSBS 10, 5 |
| D11 | Earned means Waiting plus Paid. The ledger status for unpaid is "Waiting" | 2, 3 |
| D12 | Same office twice: the first referral wins, counted across every source | 3 HSBS 10, 5 |
| D13 | New Referrals columns Referring Rep and Referring Rep Email | 3 HSBS 1R |
| D14 | This build is a written exception to the launch freeze, behind two switches | 1 |
| D15 | The pay plan is a setting, not code (Brian, 11/9: the SPIFF is coming, its shape isn't final). `REP_PAY_PLAN` picks the plan; HSBS 10 uses the same amounts. Brian, 11/9: the draft pay plan is $150 on signing and $50 to the manager, no payment on reaching (`REP_PAY_PLAN=signed:150,manager:50`; HSBS 10 variables 0 / 150 / 50). It still needs Katy and Tracy, and `REP_PAY_ENABLED` stays off until they agree. **Brian, 11/11, replaces that draft:** $100 to the rep when HealthFirst reaches the office (`Talked To Doctor` is Yes), $50 to the rep's manager at closed won, nothing to the rep at the sign (`REP_PAY_PLAN=reached:100,manager:50`; HSBS 10 variables 100 / 0 / 50). Paid at reached, not at send. Brian, 11/11: "yes on the payment"; `REP_PAY_ENABLED` stays off until he turns it on | 5 |
| D16 | My Team numbers are computed by the site from each rep's own rows, the same way the rep's screen does, so they can't disagree. Reps don't change their own manager: managers don't change teams before year end, and Brian handles any roster update by hand (Brian, 11/9). Every team read checks the caller's current Team Roster rows (D18); manager pay is decided at the sign and never moves (issue #57) | 2 My Team, 3 HSBS 1R, 3 HSBS 10 |
| D17 | Brian, 11/9: manager pay follows Brian's team roster (supersedes the same-day option B and the Approved Managers list). A new read-only Team Roster list pairs each rep with their manager. Superseded in part the same day by D18: the Team Roster list stays and gains Rep Name; its confirmed-and-paired pay rule gave way to D18's one rule | 3 Team Roster |
| D18 | Brian, 11/9: managers come from Brian's Team Roster; no manager confirm. A rep's manager is the manager on the rep's Active Team Roster row, and that row alone decides isManager, My Team and manager pay. Nobody confirms or affirms anything: no affirm card, no manager confirm email, no Confirm or Not my team. /join still asks for the manager, kept only as a hint for Brian's daily gap check. Team visibility and manager pay rest only on Brian's roster, which no flow and no user can write. This replaces the same-day manager confirm and affirm plan (#49 nomination, Manager Mail Log, Confirm For, the confirmed rule) and D17's confirmed-and-paired pay rule | 1, 2, 3, 4, 5, 7 |

## Decisions this rests on (Brian, 11/6 to 11/8)

- Katy, 11/6: HealthFirst compliance is the top Business Solutions push for Q4. Only HealthFirst goes to the AEs, the Thrive Signature team and field sales.
- One QR code and one link for everyone. No pre-built pages. A rep's record and personal link are created when the rep signs up.
- The app carries the HSBS name. HealthFirst is the only service through December 31.
- January 1: every HSBS company opens to every registered rep. Registration is the only gate. Not part of this build.
- Referral pay is 50-100-50, funded by HealthFirst: $50 to the rep when HealthFirst reaches the office, $100 to the rep when the office signs, $50 to the rep's manager on the sign. That is the default plan. D15 (Brian, 11/9) makes the plan a setting, so the dollar wording in this spec is the default plan's; under another plan every screen words it from `REP_PAY_PLAN` (section 5). The 11/9 draft plan was $150 on signing and $50 to the manager (D15). **Brian replaced it on 11/11:** $100 to the rep when HealthFirst reaches the office and $50 to the manager at closed won (section 5).
- Q4 upgrades reward reps (earnings, status). No new asks.
- Brian, 11/7: the money has to be as clear as the leads and the lead form. Every screen that shows a referral also shows its dollars: what it can earn, what it has earned, what has been paid and when, and why when it won't pay. Every dollar traces to one office and one event.
- Brian, 11/8: decisions D1 to D14 above.
- Brian, 11/9: managers come from Brian's Team Roster; no manager confirm (D18).
- Brian, 11/9: draft pay plan is $150 on signing and $50 to the manager, no payment on reaching (D15 setting `signed:150,manager:50`; still needs Katy and Tracy).
- Brian, 11/11: the pay plan is $100 to the rep when HealthFirst reaches the office and $50 to the manager at closed won, nothing to the rep at the sign (D15 setting `reached:100,manager:50`). Paid at reached, not at send. Replaces the 11/9 draft. Brian, 11/11: "yes on the payment". Pay stays off until he turns it on.
- Brian, 11/9: Track has to be easier to read on a phone. One short row per office, and a tap opens a screen for that office with its dates and where it stands in plain words. HealthFirst bills an office as soon as it signs, so the signed step reads "Signed and billed."
- Brian, 11/8: HealthFirst is wholly owned by Henry Schein. No Compliance sign-off is needed, taxes on the payments are already handled, and paying for referrals is standard practice. Don't reopen this.

## 1. Scope

Ships for the Q4 push:
- A public sign-up page at /join (the QR target).
- The rep's personal app at /refer/<key> with three tabs: Send a Referral (HealthFirst only), Track My Referrals (one short row per office, each opening a lead screen), and My Earnings.
- A fourth tab, My Team, for anyone who is the manager on at least one Active Team Roster row (D18).
- A Rep Roster list, Brian's Team Roster list, a sign-up flow, a SPIFF ledger, and the reports in section 6.

Freeze exception and switches (D14):
- Brian's written exception to the launch freeze (until the readout, about December 4): this build ships during the freeze.
- Everything new sits behind `REP_APP_ENABLED`. With it off, /join, the Rep role and My Team are unreachable, and the other team's and FSC screens match `main`.
- The dollar amounts on every screen, the receipt and the emails sit behind a second switch, `REP_PAY_ENABLED`. It turns on only after the Tuesday 11/10 call confirms the pay terms. With it off, screens show the referral status without dollars.

Does not change:
- The other team's links and the 26 pilot FSC links keep their current menus. The one addition: anyone on the other team's roster or the FSC Roster who is a manager on Brian's Team Roster gets the My Team tab (D5, D18).
- The partner update pages at /leads/<key> and the status standard (Talked with the doctor? / Where does it stand?). The one addition: "Already a customer" joins the closed reasons (D7).
- Routing rules, intro emails for other companies, Salesforce loading.

## 2. Build: the site

### /join (sign-up, once)

Short link for the QR code: /j. Mobile first, works on a desktop for AEs.

Screen:
- Title: "Set up your HSBS app." Line under it: "One time, about a minute."
- First name, Last name
- Henry Schein email (must end in @henryschein.com; the page says so before it posts)
- Mobile
- Role: AE, FSC, RM, Thrive Signature, Other (11/7 list; the live list is in `docs/field-flow-contract.md`)
- Manager's name and manager's Henry Schein email (must end in @henryschein.com and differ from the rep's own email; the page says so before it posts). This is a hint for Brian only (D18): it doesn't make that person the rep's manager, and they get no email.
- Branch or territory (free text, short)
- Button: "Send my link"

After Send: "Check your Henry Schein email. Your personal link is there. Open it on your phone and tap Add to Home Screen." The page shows the same words whether the email is new, already registered, or over its limit (D2), so it never reveals who is registered.

The page posts to /api/register, which posts to REGISTER_FLOW_URL (new Vercel env, Sensitive, Production and Preview). The site stores nothing and logs nothing. /api/register limits each IP to 200 sign-ups per 10 minutes (REGISTER_IP_LIMIT overrides it for a launch window) and each email to 5 from one IP. Those limits are only a speed bump; the real limits live in 1J (section 3).

### /refer/<key> for a Rep key

Lookup returns role "Rep" (section 3). The page opens the Rep version of the app.

Send a Referral, top to bottom:
- Header: "HealthFirst compliance referral" and "Sending as [rep name]."
- Pay line (only when `REP_PAY_ENABLED`), directly under the header, same size as the field labels: "You earn $50 when HealthFirst reaches the office and $100 more when it signs." (default plan; under the draft plan, "You earn $150 when the office signs.")
- Guide box (always shown, three lines):
  - Ask: Has the office done this year's OSHA and HIPAA training? Are the manuals current?
  - If either answer is no, ask: Can HealthFirst call you to get it handled?
  - If they say yes, send it.
- Fields: Contact name, Practice name, JDE # (required, numeric keypad, stored as text so leading zeros survive), Best phone, Email (optional), Best way to reach them (Call / Text / Email, required), Notes (optional).
- Required checkbox: "The office agreed to a call from HealthFirst." Saved word for word in Consent text.
- Send button label walks the rep through what's missing, the same way the FSC app does, ending in "Send to HealthFirst."

Submit body: the FSC submit in docs/fsc-flow-contracts.md with these values: companies ["HealthFirst"], needs ["OSHA and HIPAA compliance"], route "Partner", referrerRole "Rep", source "Rep app", contactFirst false (no toggle in this version), leadType "Practice owner".

Receipt: check mark, "Sent to HealthFirst," "HealthFirst's team will call [contact] [within one business day]," the money line (only when `REP_PAY_ENABLED`) "You'll earn $50 when HealthFirst reaches [contact], and $100 more if the office signs" (draft plan: "You'll earn $150 if the office signs"), and two buttons, "Track this referral" and "Send another referral." The flow emails the same receipt without the money line: no rep email carries a dollar amount (D15), because the flows can't see the plan or `REP_PAY_ENABLED`. The app shows the money.

No manager check (D18). The Send tab asks nothing about the manager, and the app never shows the rep the manager they typed on /join. A rep's manager is the one on Brian's Team Roster. The rep can't set or change it; Brian does.

Money words used on every screen (D11):
- **Earned**: the total of Waiting and Paid.
- **Waiting**: earned and not yet paid.
- **Paid**: paid, with the date.
- **Pending review**: an auto-reached award Brian hasn't cleared yet (D10). Not counted in Earned until he clears it.
- **Not paid**: voided, always with the reason in words.

Track My Referrals (Brian, 11/7: a running status update, with the money on it. Brian, 11/9: easier to read on a phone, with one short row per office that opens its own screen):
- Tiles at the top: Sent, In progress, Signed, and Earned ($ total, with "Paid $X" under it). The dollar tile is the same size as the others.
- The list: one compact row per referral, newest sent first. Each row holds the office name (as a link), the date sent ("Sent Nov 3") and a status chip in the plain words below. A referral with no update in 7 days also shows the existing flag on its row, in plain words: "No update in 9 days." With pay on, a row may carry one short money hint: the office's earned total ("$150 earned") or "Not paid". It never carries a promise; the full money is on the lead screen. Each row is one tap target at least 44px tall, and the list reads at 375px wide with no sideways scroll.
- The lead screen: tapping a row opens a full screen for that office inside the app. There is no new server route and no key in a new URL: the page draws it from the list answer it already holds. Top to bottom:
  - "Back to Track", which returns to the list where the rep left it.
  - The office name, "Sent Nov 3", the company (HealthFirst) and the contact the rep sent (name only, as the card shows it today).
  - The status timeline: one line per step, oldest first, in the plain words below, each with its date where the list has one (the sent date, and the date on each Status Log entry). A step the data doesn't show isn't drawn.
  - The latest partner update: HealthFirst's line detail, with its date.
  - With pay on, the money line (below).
- Status words. Only from what the list action already sends (the HealthFirst line's status, the `closed` and `signed` flags, and the Status Log); the flow sends nothing new:

  | What the list sends | The chip and timeline say |
  |---|---|
  | Sent, or no partner save yet | Sent to HealthFirst |
  | Not yet, still trying; Trying to reach | HealthFirst is reaching out |
  | Not yet, haven't tried | Sent to HealthFirst (no attempt yet, so it doesn't say HealthFirst is reaching out; Brian to confirm the words) |
  | Yes to "Talked with the doctor?"; Reached the doctor; Meeting held | HealthFirst talked with the doctor |
  | Meeting set | Meeting set. The timeline step adds the date when the Status Log has one: "Meeting set for Nov 12" |
  | Proposal or agreement sent | HealthFirst sent a proposal |
  | No change this week | HealthFirst is working on it |
  | Signed or Won, or `signed` true | Signed and billed |
  | Not moving forward, Already a customer, Hand back to HSBS, Closed or Not a Fit, or `closed` true | Closed: [reason], for example "Closed: not moving forward", "Closed: already a customer", "Closed: handed back to HSBS". With no reason, "Closed" |
  | Anything else | The existing display words for that value, never blank |

  Signed means HealthFirst bills the office right away (Brian, 11/9), so the signed step reads "Signed and billed" wherever the copy shows the status.

  Each Status Log line is "[date] [partner]: [label]. [note]". Only the label is read as a status. The partner's free-text note never is, so a note like "Signed up for a demo" never draws a "Signed and billed" step.
- "Latest updates," under the list: a running feed across all of the rep's referrals, newest first, in the same plain words. One line per event with the date, and the dollars when the event pays: "Nov 10. North Side Dental: HealthFirst talked with the doctor. You earned $50." "Nov 14. North Side Dental: Signed and billed. You earned $100." "Nov 30. Paid $150." "Nov 12. No update in 7 days on South Park Dental." Shows the last 10, with "See all" for the rest. Tapping a feed line opens that office's lead screen.
- The money line on the lead screen, in plain words (default plan; the draft plan's words are in section 5):
  - Sent, not reached yet: "$50 when HealthFirst reaches them. $100 more if they sign."
  - Reached, auto (D10): "$50 pending review. HealthFirst hasn't confirmed contact yet."
  - Reached: "$50 earned Nov 10. $100 more if they sign."
  - Signed: "$150 earned. Paid $50 on Nov 30. $100 waiting to be paid."
  - Won't pay: "Not paid: this office was referred to HealthFirst in the last 12 months." The reason is always shown.
- Data: the existing 1R list action, plus the earnings action for the money. The page joins them by referral ID. No new action and no new field.

My Earnings (third tab, always shown, from the first day):
- Three tiles, same size as the referral tiles: Earned, Waiting, Paid. Earned equals Waiting plus Paid.
- A line for Pending review, when there is any: "$X pending review."
- A fourth line: "Up to $X more if your open referrals sign" (default plan: $100 for each reached office that hasn't signed or closed; draft plan: $150 for each open office that hasn't signed or closed).
- One line per ledger row, newest first: date, office, what it was for ("HealthFirst reached the office" or "Office signed"), amount, and status in words (Pending review, Waiting, Paid on [date], or Not paid with the reason). Tapping a line opens that office's lead screen.
- Before the first referral: "$0 so far. Here's how you earn: $50 when HealthFirst reaches an office you sent, $100 more when it signs." (draft plan: "$0 so far. Here's how you earn: $150 when an office you sent signs.")
- Footer: "Earnings follow HealthFirst's updates. Paid [monthly / by date, from Tuesday]."
- Data: a new 1R action "earnings" (key in, that rep's SPIFF Ledger rows out, nobody else's).

### My Team (fourth tab, managers only)

Shows when the lookup says this key's person is the manager on at least one Active Team Roster row (D5, D18). It works the same on a Rep link, an FSC link or an other-team link. A manager who also refers keeps their other tabs.

Who is on the team: every Active Team Roster row that names this person as the manager. Brian's roster is the whole answer; nobody confirms anything, and the manager a rep typed on /join plays no part (D18).

- Four tiles, signed-up reps only: Team referrals, Signed, Team earned, Team paid.
- Your own pay, as prominent as the tiles: "You've earned $[X] from your team's signed offices. Paid $[Y]. Waiting $[Z]." Tapping it lists each manager award by office, rep and date.
- Team list, one row per signed-up rep (on the team, with a Rep Roster row that isn't Disabled): name (as Brian's roster spells it, never as typed on /join, since anyone can sign up with someone else's email), role, registered date, referrals, reached, signed, earned, paid, and last referral date. Sort by most referrals. A rep registered 14 or more days with no referral shows "No referral yet" in words, so the manager knows who to call.
- Not signed up yet: a rep on the team with no Rep Roster row yet shows only the name from Brian's roster and "Not signed up yet." No email, no date and nothing else (D4), so the manager knows who to ask to sign up.
- Tap a signed-up rep to see that rep's referrals in the same compact rows and the same lead screen the rep sees, with the same money line. Contact name, doctor phone, email and notes are never shown on this tab, and the lead screen here leaves out the partner's free-text update (it can name the doctor); the timeline shows only the plain step words and dates.
- Your own pay shows whenever pay is on and the plan pays a manager, even before the first manager award.
- With four tabs (a rep who is also a manager, pay on), the labels shorten to Send, Track, Earnings and Team so they fit a phone.
- Data: a new 1R action "team" (section 3). It needs JavaScript, as Track does.

## 3. Build: SharePoint and flows (BB1, in Power Automate, from Claude's build sheets)

### New list: Rep Roster (the shared SharePoint site)

Columns: Rep Name, Rep Email (unique), Mobile, Role (choice), Manager Name and Manager Email (what the rep typed on /join: a hint for Brian's daily gap check, D18; they never decide the manager), Branch, Referral Key (24 or more URL-safe characters), Services (text, "HealthFirst" for now), Registered On, First Opened On, Status (Pending, Active, Disabled), Source (QR, AE link, Thrive Signature link, Other), Test (yes/no; Yes when the rep's name or email contains TEST, per BB1 sheet 1).

Sheet 1 also has Manager Confirmed, Confirm Token, Confirm Expires, Confirm Used and Manager Emails Sent for the #43 confirm page. They stay on the list as they are (no BB1 rework on sheet 1), not used at launch; removable later. Not built (D18): Manager Affirmed, Confirm For, Send Manager Email and Needs Brian from BB1 sheet 2 v3. If they're already on a copy, leave them blank.

### New list: Link Resends

Columns: Email (unique), Last Sent (date and time). One row per address 1J has sent a link to, from any roster, so the 10-minute limit covers emails from every roster. No keys.

The Manager Mail Log (issue #50) is not built: there is no manager confirm email, and 1J sends no manager email (D18).

### New list: Team Roster (D17, D18)

Brian's roster of managers and the reps (FSCs, AEs and others) on their teams, and the one source of who manages whom (D18). Columns: Rep Email (Title, unique, lowercased, one row per rep), Rep Name (as Brian's roster spells it, so a manager sees a rep on their team who hasn't signed up yet), Manager Email (lowercased: the manager this rep reports to on Brian's roster), Active (yes/no: Yes while the pairing is current; Brian sets No instead of deleting a row), Updated On (date Brian last changed the row). Brian loads it from the roster he sends, and he alone edits it. Flows only read it, like the other rosters; no flow and no user ever writes to Team Roster. TEST pairs (TEST in both emails) are for testing only. Compare emails with toLower, and escape `'` as `''` in every Filter Query.

Who manages whom (D18): a rep's manager is the Manager Email on the rep's Team Roster row with Active = Yes. Nothing a rep types sets it, including the manager on /join. That one row decides all three: isManager (the caller is the Manager Email on at least one Active row), My Team (every Active row that names the caller) and manager pay at the sign (HSBS 10). There is no confirmed or unconfirmed state and no paired flag: every team row is paired by definition. Contract: docs/rep-app-flow-contracts.md, "Who manages whom".

### New flow: HSBS 1J (sign-up)

HTTP trigger, POST, JSON. One action, "register."
1. Refuse anything that is not an @henryschein.com address (4xx, no row). Refuse a manager email that isn't @henryschein.com or equals the rep's own email (4xx, no row).
2. Limits (D2). Send a link to the same email at most once every 10 minutes, whatever roster it's on (check Link Resends). Over that limit: send nothing, write nothing, reply 200 with the same words as success.
3. Email already on the Rep Roster, the FSC Roster or the other team's roster: send that person their existing link again, within the limit. No new row, and nothing on the existing row changes. Reply 200.
4. New email: create a Rep Roster row, Status Pending, Services "HealthFirst," a new Referral Key, and the manager's name and email as typed (a hint, D18). Reply 200 only after the row exists.
5. Welcome email to the rep, from [Brian's mailbox or an HSBS mailbox], HTML, with the personal link and the Add to Home Screen steps. Text approved by Brian before the first live send.
6. No manager email, at sign-up or later (D18). The manager the rep typed is only a hint: Brian's daily gap check shows it while the rep has no Active Team Roster row, and Brian adds the pair. Nobody is asked to confirm.
7. A manager who has no link gets one the same way anyone does: they sign up at /join (Role RM, for example). My Team comes from the Team Roster, not from the role they pick.
8. The #43 confirm-peek and confirm actions and the /confirm page: not used by the rep journey at launch; removable later. 1J writes no Confirm Token, nothing links to /confirm, and a confirm would grant no My Team and no pay. The site answers 404 to /confirm and /api/confirm before any 1J call unless `REP_CONFIRM_ENABLED=true`, which stays unset, so made-up tokens never reach 1J.

### HSBS 1R changes

- lookup: check the other team's roster, then FSC Roster, then Rep Roster. A Rep hit returns {"role":"Rep","repName","repEmail","services":["HealthFirst"],"isManager":true or false}. The other answers add the same `isManager` field (D5); a missing field means false, so today's answers still work. isManager is true when this person's roster email is the Manager Email on at least one Active Team Roster row (D18). Every lookup carries `activate`: true only while `REP_APP_ENABLED=true`; a missing value counts as false (#52). Only a lookup with `activate` true sets First Opened On and Status Active, the first time a Rep key is looked up. A Rep key with `activate` false answers 404 and writes nothing to the Rep Roster. Status Disabled answers 404. The lookup carries no manager name, email or status (D18).
- team: new, read only. Key in. Out: one entry per Active Team Roster row whose Manager Email is this key's email. A rep with a Rep Roster row that isn't Disabled gets a full entry: name, role, registered on, each rep's referral list as the list action builds it (plus a reached flag), and the rep's own ledger rows as the earnings action builds them. The site computes referrals, reached, signed, earned, paid and last referral from those rows, with the same code as the rep's own screen (D16), and shows no contact name, phone, email or notes. A rep with no Rep Roster row yet gets the name from the Team Roster only, which the site shows as "Not signed up yet." (D4): no email and nothing else. A Disabled rep is left out. No confirm token and no confirmed, unconfirmed or paired field: every entry is on the roster by definition. Plus this manager's own ledger rows (Payee Role Manager). Unknown key, or no Active Team Roster row names this person: 404. Contract: docs/rep-app-flow-contracts.md, "HSBS 1R for My Team".
- submit: accepts referrerRole "Rep." Writes two new Referrals columns, **Referring Rep** and **Referring Rep Email** (D13), from the Rep Roster row, never from the page. The FSC columns stay blank on a Rep row. New Referrals choice in Source: "Rep app."
- list: a Rep key returns the rows whose Referring Rep Email is that rep's email. Track's compact rows and lead screen are drawn from this answer, with no new field.
- earnings: new. Returns that rep's SPIFF Ledger rows, nobody else's. Rows marked Test only for a TEST rep.
- Not built (D18): affirm-manager and the site's /api/affirm-manager and /api/team-answer.

### Existing flows on a Rep row (D1)

A Rep row names no one outside the field build. Each flow that fires on a new Referrals row or a case update does this when Source is "Rep app":

| Flow | Today | On a Rep app row |
|---|---|---|
| HSBS 2 (other-team receipt) | Receipt to the other team's sender | Skips the row |
| HSBS 2B (Solutions to Partner) | Copies Solutions, sets Introduced | Same as today |
| HSBS 2N (needs a partner) | Fires when companies are empty | Never fires (companies is always HealthFirst) |
| HSBS 3 (other-team partner intro) | Intro naming the other team's sender | Skips the row |
| HSBS 3F (FSC intro) | Intro for Source FSC app and Direct to partner | Also fires on Source "Rep app". The intro names the rep as referrer, copies no one outside the field build, and includes the office's OK, best phone, preferred contact, JDE and the guide answers. Sends the rep their receipt. |
| HSBS 7B (partner save) | Update email to the other team's sender and the referring FSC | Update email to the referring rep |
| HSBS 8 (roll-up) | Rolls case status up to the referral | Same as today |

Approved recipients on Rep rows: the HealthFirst contact from Routing, the referring rep, and Brian. Nobody else.

### Partner page change (D7)

Add "Already a customer" to the closed reasons, after "Not a fit". Three places change together: `CLOSED_REASONS` in `src/lib/partner-flow.ts`, the HSBS 7B check, and the Closed Reason choice on the Referrals list. Old saves still work.

### HealthFirst routing for this push

- The HealthFirst Routing and Partner Links rows point to [Brian Sawyer's outbound team contact, from Tuesday]. Today they point to Rebecca Byrne. Change only on Brian's go.
- HealthFirst gets one /leads/<key> page for its team, with the status standard as it is today plus D7.

### New flow: HSBS 10 (SPIFF Ledger)

New list: SPIFF Ledger. Columns: Award Key (unique: Case ID + Event + Payee Role, D6), Referral ID, Service Case ID, Practice Name, Rep Email, Payee Email, Payee Role (Rep or Manager), Event (Reached, Signed), Amount, Earned On, Status (Pending review, Waiting, Paid, Void), Void Reason (plain words, shown to the rep), Disputed (yes/no), Dispute Note, Payout Batch, Paid On, Payer (HealthFirst), Test (yes/no).

Runs on every HealthFirst Service Case save, and once a day at 7 AM ET. Writing a row whose Award Key already exists does nothing (D6):
- **Reached**: Talked To Doctor is "Yes" for the first time. Write one row: Rep, $50 (default plan), Status Waiting. Under a plan with no reached award (the draft plan), write no Reached row.
- **Auto-reached** (D10): five business days after the intro with no partner answer to question 1. Write one row: Rep, $50, Event Reached, Status **Pending review**, and add the case to Brian's daily exceptions. Brian clears it to Waiting, or voids it with a reason. If HealthFirst answers "Yes" before Brian acts, the row becomes Waiting.
- **Signed**: Where does it stand is "Signed" with a signed date and a product. The sign is handled once, by the run that finds no Rep Signed row for the case yet (the sign run; under the 11/11 plan, which pays the rep nothing at the sign, the run that finds no Manager row yet, Brian 11/11); a later save or daily run that finds the Rep Signed row writes no Manager row, whatever the plan or the Team Roster say then. In the sign run, write the Manager row (below) first, then the Rep row (the plan's sign award, Waiting: $100 under the default plan, $150 under the draft plan). With the plan's manager award at 0 in the sign run, write no Manager row, now or later; raising the plan pays only later signs. Otherwise write one Manager row (Award Key Case ID + Signed + Manager) by one rule, read in that same run (D18): Waiting (the plan's manager award), Payee Email = the manager on the rep's Active Team Roster row, when the rep has such a row, its Manager Email isn't blank, and that manager isn't the rep; otherwise Void, "no manager on the team roster when the office signed", Payee Email blank. No Manager row is ever Pending review. A later Team Roster change never adds, moves, releases or re-points a Manager row for a sign already handled; adding or changing a pair pays only offices that sign after it, and a new manager never gets credit for an earlier sign.
- **No pay** (D12): write a Void row with the reason in words, or void a row that isn't Paid, when any of these is true. The Void row never counts and never pays; it's how the rep sees "Not paid: [reason]" (Brian, 11/8).
  - The same JDE was already referred to HealthFirst in the 12 months before this referral, from any source: the other team's page Source value, the other team's app Source value, `FSC app`, `Rep app` or Salesforce. The earliest Referrals row by created time keeps the credit.
  - Closed reason "Already a customer" (D7).
  - Hand back with the note "No permission."
- **Paid rows are never voided** (D3). If a paid award turns out ineligible, set Disputed = yes with a note, and add it to Brian's exceptions. Nothing is clawed back. The rep sees the row as Paid.
- **TEST** (D8): a referral from a TEST rep, or with TEST in the doctor or practice name, earns rows with Test = yes, following every rule above. A real payout batch never includes a Test row.

## 4. Lead management: the life of a HealthFirst referral

| Stage | What happens | Owner | Clock (business days, Eastern) |
|---|---|---|---|
| Sent | Referrals row, Service Case, receipt to the rep, intro to HealthFirst (3F) | Flows | Intro within 5 minutes |
| First contact | HealthFirst answers "Talked with the doctor?" on its page | HealthFirst outbound | Answer within 2 business days. Reminder to HealthFirst and Brian at day 2 |
| Reached | Talked To Doctor "Yes." Rep earns $50 (default plan; nothing under the draft plan). Rep gets an email, with no dollar amounts | HealthFirst, then HSBS 10 | At day 5 with no answer: $50 pending Brian's review (default plan only) |
| Working | Meeting set, Proposal or agreement sent, No change this week | HealthFirst | Friday 8 AM update email (existing). Red flag on the rep's tab after 7 days with no update (existing) |
| Signed | Signed with date and product. HealthFirst bills the office right away (Brian, 11/9). Rep earns $100, and the manager on the rep's Active Team Roster row earns $50 (default plan; draft plan: $150 and $50) | HealthFirst, then HSBS 10 | Rep and manager emailed the same day |
| Closed | Not moving forward, Already a customer, or Hand back to HSBS | HealthFirst, then Brian | Brian reviews every hand back within 2 business days |

Exceptions Brian sees in one daily email: awards pending review, disputed paid awards, duplicate JDEs, hand backs, failed flow runs, and the existing daily gap check. The gap check also lists every non-Disabled Rep Roster row with no Active Team Roster row (D18), with the manager the rep typed on /join as a hint: "[Rep] ([rep email]) has no manager on the team roster. At sign-up they named [Manager name] ([manager email])." Brian adds the pair before an office signs: a sign with no Active row voids that sign's manager award for good. It also lists every Active Team Roster row whose Manager Email is the rep's own: "[Rep Name] ([Rep Email]) is their own manager on the team roster." Brian fixes the pair, because such a sign voids its manager award. The hint sends nobody anything and never sets a manager on its own.

## 5. Pay rules, mapped to the status standard

**The plan is a setting (D15).** We will pay a SPIFF, but its shape isn't settled, so the site and HSBS 10 build for either plan and switch without a code change:

| Plan | `REP_PAY_PLAN` | Rep earns | Manager earns |
|---|---|---|---|
| Current (v3, the default) | `reached:50,signed:100,manager:50` | $50 when reached, $100 more when signed | $50 on the sign |
| Closed won only | `signed:<amount>`, for example `signed:150` | One award when the office signs | Optional: add `manager:<amount>` |
| Draft (Brian, 11/9; replaced 11/11) | `signed:150,manager:50` (HSBS 10 variables 0 / 150 / 50) | $150 when the office signs, nothing on reaching | $50 on the sign |
| **Chosen (Brian, 11/11; pay stays off)** | `reached:100,manager:50` (HSBS 10 variables 100 / 0 / 50) | $100 when HealthFirst reaches the office, nothing on the sign | $50 on the sign (closed won) |

Under the chosen plan (`reached:100,manager:50`) the screens read: pay line "You earn $100 when HealthFirst reaches the office."; receipt "You'll earn $100 when HealthFirst reaches [contact]."; lead screen money line "$100 when HealthFirst reaches them." before the reach and "$100 earned Nov 10." after it, with no "more if they sign" part; the fourth My Earnings line reads "Up to $X more if HealthFirst reaches your open referrals." and counts $100 for each referral with no Reached row of any status (a day-5 Pending review row counts as "$X pending review", not here), no Signed row, and not closed, signed or a no-pay office; the empty My Earnings line "$0 so far. Here's how you earn: $100 when HealthFirst reaches an office you sent."; My Team "You earn $50 each time an office your team sent signs." No screen promises the rep anything at the sign. The auto-reached row (D10) and the day 5 pending row are $100 under this plan. `signed` is no longer required: a plan needs at least one of `reached` or `signed`. The code change (plan parser, wording, "Up to $X more") is a separate PR; until it merges, this value does not parse and the site shows no dollar amount, which is safe because pay is off.

Under the draft plan the screens read: pay line "You earn $150 when the office signs."; receipt "You'll earn $150 if the office signs."; lead screen money line "$150 if they sign." before the sign and "$150 earned." after it; "Up to $X more" counts $150 for each open office that hasn't signed or closed; the empty My Earnings line "$0 so far. Here's how you earn: $150 when an office you sent signs."; My Team "You earn $50 each time an office your team sent signs." No screen says "$50 when HealthFirst reaches", and no "Up to" total counts a reached award. The amounts need no code change; check each screen's copy under this plan before pay goes on. Sheet 4 (HSBS 10) stays on hold; only its variables are noted.

- Every promise on every screen (the pay line, the receipt, the money lines, "Up to $X more", the empty My Earnings line) is worded from the plan. Totals always come from the ledger.
- HSBS 10 writes rows with the same amounts. Under closed won only it writes no Reached rows and no auto-reached (D10) rows.
- No email to a rep or manager carries a dollar amount, under any plan: the flows can't see the plan or `REP_PAY_ENABLED`. Emails say what happened; the app shows the money. (A payout statement, a later sheet, lists ledger lines and is the one exception.)
- An office whose only ledger rows are Void (no pay, D12 or D7) counts nothing in "Up to $X more", under any plan, and its lead screen shows only "Not paid: [reason]."
- Rows earned under an earlier plan keep counting, and paid rows stay paid (D3). A plan change never adds an award to a sign already handled.
- A value that doesn't parse turns every dollar amount off rather than show a wrong one.

The rules below are the default plan:

- Rep $50: every field filled, the office's permission checked, and HealthFirst answers "Yes" to "Talked with the doctor?". Or five business days pass with no answer and Brian clears it (D10).
- Rep $100: "Signed" with a signed date and a product.
- Manager $50: on the same sign, to the manager on the rep's Active Team Roster row (D18), if that row has a Manager Email and that manager isn't the rep. Eligibility is that row as the run that handles the sign reads it, decided once; no later run adds a manager award for that sign. No such row then: a Void row, "no manager on the team roster when the office signed", with a blank payee, so a later manager can never pick it up. A later Team Roster change never pays an earlier sign. A later transfer never moves the award. Under a plan with no manager award, no Manager row is written. Paid stays paid (D3).
- No pay: the office was already referred to HealthFirst in the last 12 months from any source (D12), already a HealthFirst customer (D7), the office says it never agreed, TEST rows (D8).
- A paid award stays paid. Nothing is clawed back (D3).
- Everything earned by December 31 is paid by HealthFirst. Payout method, timing and any payroll fields: from the Tuesday call with Tracy.

### Payout, step by step

1. On the payout date, HSBS 10 builds a batch: every ledger row with Status Waiting and Test = no, grouped by payee. One file to HealthFirst, one line per payee with the total, and the ledger rows under it.
2. Brian checks the batch against the exceptions list and sends it on his go.
3. When HealthFirst confirms payment, the batch's rows flip to Paid with the date. Nothing flips to Paid on a guess.
4. Each rep and manager gets a statement email the same day: "Paid $[total] on [date]," then one line per office and event, the same lines as My Earnings.
5. A rep who questions a number taps the line, sees the office and the event, and replies to the statement. Brian answers from the ledger.

A TEST batch (Test rows only) runs the same steps with Brian as the only recipient and is never sent to HealthFirst.

## 6. Reporting

| Audience | What they get | When | Built from |
|---|---|---|---|
| Rep | Track My Referrals with the running feed, My Earnings, an email at each status change | Live | 1R list and earnings |
| Manager | My Team tab: the reps on their Team Roster rows, referrals, reached, signed, team earned, their own earnings, reps with no referral yet, reps not signed up yet. Same numbers in a Monday email, added to the existing Nudge Report | Live, and Monday | 1R team |
| HealthFirst (Tracy, Sawyer) | Referrals received, share answered within 2 business days, reached, signed, open more than 7 days, SPIFF earned, paid and owed by payee | Monday, plus the payout batch | Service Cases, Ledger |
| Katy and leadership | Sign-ups by role and region, reps who have sent a referral, referrals, median days to first contact, reached, signed, close rate, sales at about $700 per sign, SPIFF earned, paid and owed, progress against 105 and 345 signs | Monday one page, plus a Power BI page | All four lists |
| Brian | Exceptions email, failed runs, gap check | Daily | Flows |

Definitions (one meaning each, used in every report):
- Registered: a Rep Roster row whose link has been opened.
- Active rep: at least one referral that passed the form.
- Reached: Talked To Doctor has ever been "Yes."
- Days to first contact: business days from the sent date to the first "Yes."
- Signed: "Signed" with a date and a product.
- Close rate: signed divided by reached.
- Earned: Waiting plus Paid. Pending review and Void are not counted. Test rows are never counted.

Power BI: add Rep Roster and SPIFF Ledger as sources and one page, "HealthFirst push." Refresh stays hourly, 9 AM to 4 PM ET.

## 7. Pass or fail before launch (TEST rows only)

1. Sign-up takes under 60 seconds on a phone. The welcome email arrives within 2 minutes.
2. A non-Henry Schein address is refused. A manager email equal to the rep's own is refused. A repeat sign-up resends the link and makes no second row.
3. A second sign-up for the same email within 10 minutes sends nothing and shows the same words as success. Sign-up sends no manager email (D18).
4. The link opens the Rep app with "Sending as [name]" and only the HealthFirst form.
5. A referral sends in under 60 seconds. JDE blank, preferred contact blank or the box unchecked blocks the send. A double tap makes one row. A JDE with a leading zero is stored with the zero.
6. The HealthFirst intro goes out within 5 minutes from 3F with the office's OK, best phone, preferred contact, JDE and the guide answers in the note. HSBS 2 and HSBS 3 send nothing for the row.
7. A TEST HealthFirst "Yes" writes one $50 rep row, Waiting, Test = yes (default plan; the draft plan writes none). A TEST "Signed" with date and product writes one rep row for the plan's sign award, and one manager row for the plan's manager award, Waiting, to the manager on the rep's Active Team Roster row. Saving the case again writes no new rows.
8. A day-5 case with no answer writes a $50 row as Pending review and lists it in Brian's exceptions (default plan). It isn't in Earned until Brian clears it. A duplicate JDE writes one Void row, "this office was referred to HealthFirst in the last 12 months", that never counts or pays.
9. A Paid TEST row that is then marked "Already a customer" stays Paid and shows as Disputed in Brian's exceptions.
10. Track My Referrals and My Earnings show only that rep's rows. A TEST partner save shows on the referral's row, its lead screen and the Latest updates feed within 5 minutes.
11. My Team (D18): a TEST manager with two TEST reps on Brian's Team Roster, one signed up and one not, sees a full row for the signed-up rep and only "[Name]. Not signed up yet." for the other, with no email, date or anything else. A /join under the second rep's email with a different name changes nothing about the name that rep shows under. A person who is no Active row's manager sees no My Team tab, even when a rep typed them on /join. Anyone on the other team's roster or the FSC Roster who is a manager on the Team Roster sees My Team added to their current link. No rep app screen has a Confirm or Not my team button, and the team answer carries no confirm token and no confirmed, unconfirmed or paired field. Doctor phone, email and notes never appear on My Team.
12. With `REP_APP_ENABLED` off, /join, the Rep role and My Team are unreachable, and the other team's and FSC screens match `main`. With `REP_PAY_ENABLED` off, no dollar amount appears on any screen or email.
13. A forced flow failure emails Brian within the hour.
14. Money: every referral's lead screen shows a money line. The Earned tile, the My Earnings total and the ledger total (Waiting plus Paid) for that rep match to the dollar. Every My Earnings line opens its lead screen. A voided row shows its reason in words. A TEST payout batch includes only Test rows, goes only to Brian, flips only its own rows to Paid, and the statement lists the same lines as My Earnings.
15. The partner page accepts "Already a customer" as a closed reason, and a save from last week's page still works.
16. No manager confirm (D18): the Send tab shows no manager card, no confirm email goes to any manager (1J sends no manager email), and nothing in the rep journey links to /confirm. With `REP_APP_ENABLED` on and `REP_CONFIRM_ENABLED` unset, /confirm/<any token> and /api/confirm answer 404 and nothing reaches 1J. /api/affirm-manager and /api/team-answer answer 404. Sign up a TEST rep naming TEST manager A on /join, with a Team Roster row pairing the rep with TEST manager B: the rep shows on B's My Team only, A gets no tab, and a TEST sign pays B.
17. Track rows (Brian, 11/9): on a 375px-wide phone, each referral is one row, newest first, with the office name, "Sent [date]" and a status chip; every row is at least 44px tall, and the page doesn't scroll sideways. TEST cases at each step show "Sent to HealthFirst", "HealthFirst is reaching out", "HealthFirst talked with the doctor", "Signed and billed" and "Closed: already a customer". An open TEST case with no update in 9 days shows "No update in 9 days." on its row.
18. Lead screen: tapping a Track row, a feed line or a My Earnings line opens that office's screen inside the app, with no new server route and no key in a new URL. It shows the office, the sent date, HealthFirst, the timeline in plain words with dates, the latest partner update and, with pay on, the money line. "Back to Track" returns to the list where the rep left it. A manager opening a rep's referral from My Team sees the same rows and screen without the contact name, phone, email, notes or the partner's free-text update.
19. Permissions: two unrelated TEST managers each see only the reps on their own Active Team Roster rows; a Rep key that is no Active row's manager gets no team (404); a rep Brian sets to Active No leaves the manager's team at once.
20. Manager pay (D18): a TEST sign for a rep with an Active Team Roster row writes one Waiting manager row to that manager; saving again writes none. A sign for a rep with no Active row (no row, or Active No) writes one Void row, "no manager on the team roster when the office signed", with a blank payee, that no manager's My Team shows. Brian then adds the pair, the case is saved and the 7 AM run happens: nothing changes and no new row is written; a later sign for the same rep writes one Waiting manager row. A Team Roster move after the sign leaves the row with the first manager. A plan with no manager award writes no manager row. A Paid manager row stays Paid. No manager row is ever Pending review. Then, with manager pay 0: a TEST sign under manager A writes no manager row; Brian moves the rep to B on the Team Roster; the plan is raised to pay a manager; save the case again and wait for the 7 AM run: still no manager row, for A or B.
21. Daily gap check (D18): a non-Disabled TEST rep with no Active Team Roster row is listed, with the manager they typed on /join as the hint, and the listing stops once Brian adds an Active pair. An Active TEST pair whose Manager Email is the rep's own is listed as "is their own manager on the team roster". A Disabled rep is never listed. The gap check sends nothing to the rep or the hinted manager.
22. Draft plan: with `REP_PAY_PLAN=signed:150,manager:50` and pay on, every screen reads as section 5 says. No screen says "$50 when HealthFirst reaches", and "Up to $X more" counts $150 for each open office.
23. Chosen plan (Brian, 11/11): with `REP_PAY_PLAN=reached:100,manager:50` and pay on, the value parses (`signed` is not required), every screen reads as section 5 says, and no screen promises the rep anything at the sign. A TEST "Yes" writes one $100 Waiting rep row. A TEST sign writes no rep row and one $50 Waiting manager row (HSBS 10 variables 100 / 0 / 50). "Up to $X more" counts $100 for each referral with no Reached row of any status, no Signed row and not closed, so a day-5 Pending review row is not counted twice. With the plan set to `reached:100` alone, no manager row is written. This test cannot pass until the parser PR and Sheet 4 are rebuilt.
Delete the TEST rows, cases and ledger rows afterwards.

## 8. Timeline

- Sun 11/8: Brian approved this file (v3).
- Sun 11/8 and Mon 11/9: site side on branches, preview only, behind both switches. Claude writes the build sheets for the Rep Roster, the Team Roster, HSBS 1J, the 1R changes, the flow branches in section 3 and HSBS 10. BB1 builds them on copies, TEST rows only. Brian gives the go before any goes live.
- Mon 11/9: Brian walks Katy through the preview.
- Tue 11/10: Tracy call settles the SPIFF, the payout method, Sawyer's contact and the call-back promise. `REP_PAY_ENABLED` stays off until then.
- Wed 11/11 to Fri 11/13: fill in the bracketed items, run the tests, walk Sawyer's team through their page, Brian merges.
- Go-live gate (D17, D18): Brian loads the real Team Roster, with Rep Name, before real signs can happen. A sign before a rep's pair is loaded voids that sign's manager award for good (decided once), and a manager doesn't see a rep on My Team until the pair is in.
- Field call (about a week after Tuesday): the QR code goes live. From launch to December 31, nothing reps or HealthFirst see changes except fixes.

## 9. Open for Brian

1. Welcome emails: from your mailbox or an HSBS shared mailbox? (This also decides which mailbox sends the rep's receipts and updates. No manager confirm email goes out, D18.)
2. HealthFirst intro contact for this push: switch from Rebecca Byrne to Sawyer's team, or copy both?
3. The call-back promise on the receipt: one business day, or wait for Sawyer?
4. The 26 pilot FSCs: keep their full menu (pilot exception), or switch them to HealthFirst only until January?
5. Not a field question. Left with the other team.
6. Not a field question. Left with the other team.
7. "Up to $X more" under the default plan counts $100 per reached office. Should it also count $150 per office not reached yet? (Under the draft plan there is no reached award, so it already counts $150 per open office.)
8. Timeline: the 11/13 merge falls in the same week as the 11/13 partner send, the partner link expiry and the Salesforce naming fix.
9. Late manager approval (issue #57): superseded twice on 11/9. D17 moved manager pay to Brian's team roster, then D18 dropped the manager confirm: the manager on the rep's Active Team Roster row at the sign is the one rule. There is no per-manager approval and no held row. History (superseded): earlier on 11/9 Brian chose option B, where a confirmed manager he hadn't approved yet when the office signed got the manager row as Pending review, held in his exceptions until he released it.
10. Pilot FSCs on your Team Roster have FSC Roster links, not Rep Roster rows, so My Team would show them as "Not signed up yet," and a /join from them only resends their FSC link. Show their FSC app referrals on My Team, or leave it as is until January?
11. "Latest updates" now sits under the Track list. Keep it, shorten it to the last 5, or drop it now that each office has its own screen?
